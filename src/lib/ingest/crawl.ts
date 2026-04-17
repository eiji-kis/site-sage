import * as cheerio from "cheerio";
import {
  DEFAULT_FETCH_TIMEOUT_MS,
  DEFAULT_USER_AGENT,
  extractReadableText,
  fetchWithTimeout,
  truncateHtmlForIngest,
} from "@/lib/ingest/fetch-page";
import { logIngestEvent } from "@/lib/ingest/ingest-telemetry";
import { normalizeSeedUrl } from "@/lib/ingest/normalize-seed-url";
import { isPathAllowed, parseRobotsTxt, type RobotRules } from "@/lib/ingest/robots";

const FETCH_TIMEOUT_MS = DEFAULT_FETCH_TIMEOUT_MS;
const MAX_PAGES = 24;
const MAX_DEPTH = 2;
const USER_AGENT = DEFAULT_USER_AGENT;

const HUB_PATHS = ["/about", "/team", "/careers", "/press", "/news", "/blog", "/company", "/contact"];
const MAX_SITEMAP_INDEXES = 3;
const MAX_SITEMAP_PAGE_URLS = 36;
const MAX_SITEMAP_XML_CHARS = 2_000_000;

async function fetchText(url: string): Promise<Response> {
  return fetchWithTimeout(url, FETCH_TIMEOUT_MS, USER_AGENT);
}

function collectSameOriginLinks(html: string, base: URL, originHost: string): string[] {
  const $ = cheerio.load(html);
  const out: string[] = [];
  $("a[href]").each((_, el) => {
    const href = $(el).attr("href");
    if (!href) {
      return;
    }
    try {
      const next = new URL(href, base);
      if (next.protocol !== "http:" && next.protocol !== "https:") {
        return;
      }
      if (next.hostname !== originHost) {
        return;
      }
      next.hash = "";
      out.push(next.toString());
    } catch {
      /* ignore bad URLs */
    }
  });
  return out;
}

function parseSitemapLocs(xml: string): string[] {
  const out: string[] = [];
  const re = /<loc[^>]*>\s*([^<\s]+)\s*<\/loc>/gi;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const t = m[1]?.trim();
    if (t) {
      out.push(t);
    }
  }
  return out;
}

function isSitemapIndex(xml: string): boolean {
  const lower = xml.slice(0, 800).toLowerCase();
  return lower.includes("<sitemapindex") || lower.includes("sitemapindex");
}

async function collectSitemapSeedUrls(root: URL, robotsRules: RobotRules): Promise<string[]> {
  const originHost = root.hostname;
  const origin = root.origin;
  const out: string[] = [];

  let sitemapXml: string;
  try {
    const sitemapUrl = new URL("/sitemap.xml", origin).toString();
    const res = await fetchText(sitemapUrl);
    if (!res.ok) {
      return out;
    }
    const rawSitemap = await res.text();
    sitemapXml =
      rawSitemap.length > MAX_SITEMAP_XML_CHARS ? rawSitemap.slice(0, MAX_SITEMAP_XML_CHARS) : rawSitemap;
  } catch {
    return out;
  }

  const tryAddUrl = (raw: string) => {
    let u: URL;
    try {
      u = new URL(raw);
    } catch {
      return;
    }
    if (u.hostname !== originHost) {
      return;
    }
    if (u.protocol !== "http:" && u.protocol !== "https:") {
      return;
    }
    u.hash = "";
    if (!isPathAllowed(u.pathname + u.search, robotsRules)) {
      return;
    }
    out.push(u.toString());
  };

  if (isSitemapIndex(sitemapXml)) {
    const indexLocs = parseSitemapLocs(sitemapXml).filter((l) => l.toLowerCase().includes(".xml"));
    for (const childUrl of indexLocs.slice(0, MAX_SITEMAP_INDEXES)) {
      try {
        const childRes = await fetchText(childUrl);
        if (!childRes.ok) {
          continue;
        }
        const rawChild = await childRes.text();
        const childXml =
          rawChild.length > MAX_SITEMAP_XML_CHARS ? rawChild.slice(0, MAX_SITEMAP_XML_CHARS) : rawChild;
        for (const loc of parseSitemapLocs(childXml)) {
          tryAddUrl(loc);
          if (out.length >= MAX_SITEMAP_PAGE_URLS) {
            return [...new Set(out)];
          }
        }
      } catch {
        /* skip bad child sitemap */
      }
    }
  } else {
    for (const loc of parseSitemapLocs(sitemapXml)) {
      tryAddUrl(loc);
      if (out.length >= MAX_SITEMAP_PAGE_URLS) {
        break;
      }
    }
  }

  return [...new Set(out)];
}

export type CrawledPage = { url: string; text: string };

export async function crawlPublicSite(startUrl: string, ingestCompanyId: string): Promise<CrawledPage[]> {
  const root = normalizeSeedUrl(startUrl);
  const originHost = root.hostname;

  let robotsRules: RobotRules = { disallows: [] };
  try {
    const robotsUrl = new URL("/robots.txt", root.origin).toString();
    const robotsRes = await fetchText(robotsUrl);
    if (robotsRes.ok) {
      const body = await robotsRes.text();
      robotsRules = parseRobotsTxt(body);
    }
  } catch {
    /* ignore robots failures */
  }

  logIngestEvent(ingestCompanyId, "crawl_robots_done", { ruleCount: robotsRules.disallows.length });

  if (!isPathAllowed(root.pathname + root.search, robotsRules)) {
    throw new Error("Start URL is disallowed by robots.txt for this host.");
  }

  const seedUrls: string[] = [root.toString()];
  logIngestEvent(ingestCompanyId, "crawl_sitemap_begin");
  const sitemapUrls = await collectSitemapSeedUrls(root, robotsRules);
  logIngestEvent(ingestCompanyId, "crawl_sitemap_done", { urlCount: sitemapUrls.length });
  for (const u of sitemapUrls) {
    if (!seedUrls.includes(u)) {
      seedUrls.push(u);
    }
  }
  for (const path of HUB_PATHS) {
    try {
      const u = new URL(path, root.origin);
      u.hash = "";
      if (u.hostname !== originHost) {
        continue;
      }
      if (!isPathAllowed(u.pathname + u.search, robotsRules)) {
        continue;
      }
      const s = u.toString();
      if (!seedUrls.includes(s)) {
        seedUrls.push(s);
      }
    } catch {
      /* ignore */
    }
  }

  const visited = new Set<string>();
  const queue: { url: string; depth: number }[] = seedUrls.map((url) => ({ url, depth: 0 }));
  const results: CrawledPage[] = [];

  logIngestEvent(ingestCompanyId, "crawl_bfs_begin", {
    queueLength: queue.length,
    seedDistinct: seedUrls.length,
  });

  while (queue.length > 0 && results.length < MAX_PAGES) {
    const item = queue.shift();
    if (!item) {
      break;
    }
    const { url, depth } = item;
    if (visited.has(url)) {
      continue;
    }
    visited.add(url);

    let current: URL;
    try {
      current = new URL(url);
    } catch {
      continue;
    }
    if (current.hostname !== originHost) {
      continue;
    }
    if (!isPathAllowed(current.pathname + current.search, robotsRules)) {
      continue;
    }

    logIngestEvent(ingestCompanyId, "crawl_fetch", { url });

    let res: Response;
    try {
      res = await fetchText(url);
    } catch {
      continue;
    }
    if (!res.ok || !res.headers.get("content-type")?.toLowerCase().includes("text/html")) {
      continue;
    }

    let html: string;
    try {
      html = await res.text();
    } catch {
      continue;
    }

    html = truncateHtmlForIngest(html);
    logIngestEvent(ingestCompanyId, "crawl_parse_begin", { url, htmlChars: html.length });

    const text = extractReadableText(html, url);
    logIngestEvent(ingestCompanyId, "crawl_parse_done", { url, textChars: text.length });
    if (text.length > 80) {
      results.push({ url, text });
    }

    if (depth < MAX_DEPTH) {
      const links = collectSameOriginLinks(html, current, originHost);
      for (const link of links) {
        if (!visited.has(link)) {
          queue.push({ url: link, depth: depth + 1 });
        }
      }
    }
  }

  if (results.length === 0) {
    throw new Error("No readable page content could be collected from the site.");
  }

  return results;
}
