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
import { setProgressStage } from "@/lib/ingest/pipeline-progress";
import { isPathAllowed, parseRobotsTxt, type RobotRules } from "@/lib/ingest/robots";

const FETCH_TIMEOUT_MS = DEFAULT_FETCH_TIMEOUT_MS;
const MAX_PAGES = 24;
const MAX_DEPTH = 2;
const USER_AGENT = DEFAULT_USER_AGENT;

const HUB_PATHS = ["/about", "/team", "/careers", "/press", "/news", "/blog", "/company", "/contact"];
const MAX_SITEMAP_INDEXES = 3;
const MAX_SITEMAP_PAGE_URLS = 36;
const MAX_SITEMAP_XML_CHARS = 2_000_000;

/**
 * Leave generous room for downstream Tavily + multiple OpenAI calls inside the
 * same serverless invocation (total Vercel `maxDuration` is 300s in our config).
 */
const CRAWL_BUDGET_MS = 90_000;
const CRAWL_CONCURRENCY = 5;
const SITEMAP_BUDGET_MS = 15_000;
const SITEMAP_FETCH_TIMEOUT_MS = 8_000;
const MAX_LINKS_PER_PAGE = 15;

async function fetchText(url: string, timeoutMs: number = FETCH_TIMEOUT_MS): Promise<Response> {
  return fetchWithTimeout(url, timeoutMs, USER_AGENT);
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
  const deadline = Date.now() + SITEMAP_BUDGET_MS;

  let sitemapXml: string;
  try {
    const sitemapUrl = new URL("/sitemap.xml", origin).toString();
    const res = await fetchText(sitemapUrl, SITEMAP_FETCH_TIMEOUT_MS);
    if (!res.ok) {
      return out;
    }
    const rawSitemap = await res.text();
    sitemapXml =
      rawSitemap.length > MAX_SITEMAP_XML_CHARS ? rawSitemap.slice(0, MAX_SITEMAP_XML_CHARS) : rawSitemap;
  } catch {
    return out;
  }

  if (Date.now() >= deadline) {
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
    const children = indexLocs.slice(0, MAX_SITEMAP_INDEXES);
    const childResponses = await Promise.all(
      children.map(async (childUrl) => {
        try {
          const res = await fetchText(childUrl, SITEMAP_FETCH_TIMEOUT_MS);
          if (!res.ok) {
            return null;
          }
          const raw = await res.text();
          return raw.length > MAX_SITEMAP_XML_CHARS ? raw.slice(0, MAX_SITEMAP_XML_CHARS) : raw;
        } catch {
          return null;
        }
      }),
    );
    for (const childXml of childResponses) {
      if (!childXml) {
        continue;
      }
      if (Date.now() >= deadline) {
        break;
      }
      for (const loc of parseSitemapLocs(childXml)) {
        tryAddUrl(loc);
        if (out.length >= MAX_SITEMAP_PAGE_URLS) {
          return [...new Set(out)];
        }
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

type QueueItem = { url: string; depth: number };
type ProcessOutcome = {
  url: string;
  depth: number;
  skipReason?: string;
  page?: CrawledPage;
  links?: string[];
};

async function processQueueItem(
  item: QueueItem,
  originHost: string,
  robotsRules: RobotRules,
  ingestCompanyId: string,
): Promise<ProcessOutcome> {
  const { url, depth } = item;

  let current: URL;
  try {
    current = new URL(url);
  } catch {
    return { url, depth, skipReason: "bad_url" };
  }
  if (current.hostname !== originHost) {
    return { url, depth, skipReason: "cross_origin" };
  }
  if (!isPathAllowed(current.pathname + current.search, robotsRules)) {
    return { url, depth, skipReason: "robots_disallow" };
  }

  logIngestEvent(ingestCompanyId, "crawl_fetch", { url });

  let res: Response;
  try {
    res = await fetchText(url);
  } catch {
    return { url, depth, skipReason: "fetch_error" };
  }
  if (!res.ok) {
    return { url, depth, skipReason: `http_${res.status}` };
  }
  const contentType = res.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("text/html")) {
    return { url, depth, skipReason: "not_html" };
  }

  let html: string;
  try {
    html = await res.text();
  } catch {
    return { url, depth, skipReason: "read_error" };
  }

  html = truncateHtmlForIngest(html);
  logIngestEvent(ingestCompanyId, "crawl_parse_begin", { url, htmlChars: html.length });
  const text = extractReadableText(html, url);
  logIngestEvent(ingestCompanyId, "crawl_parse_done", { url, textChars: text.length });

  const page = text.length > 80 ? { url, text } : undefined;
  const links =
    depth < MAX_DEPTH
      ? collectSameOriginLinks(html, current, originHost).slice(0, MAX_LINKS_PER_PAGE)
      : undefined;

  return { url, depth, page: page ?? undefined, links, skipReason: page ? undefined : "text_too_short" };
}

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
  await setProgressStage(ingestCompanyId, "Reading sitemap");
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
  const queue: QueueItem[] = seedUrls.map((url) => ({ url, depth: 0 }));
  const results: CrawledPage[] = [];
  const deadline = Date.now() + CRAWL_BUDGET_MS;

  logIngestEvent(ingestCompanyId, "crawl_bfs_begin", {
    queueLength: queue.length,
    seedDistinct: seedUrls.length,
    budgetMs: CRAWL_BUDGET_MS,
    concurrency: CRAWL_CONCURRENCY,
  });

  let batchIndex = 0;
  while (queue.length > 0 && results.length < MAX_PAGES) {
    if (Date.now() >= deadline) {
      logIngestEvent(ingestCompanyId, "crawl_budget_exceeded", {
        resultsCount: results.length,
        queueRemaining: queue.length,
      });
      break;
    }

    const batch: QueueItem[] = [];
    while (batch.length < CRAWL_CONCURRENCY && queue.length > 0 && results.length + batch.length < MAX_PAGES) {
      const item = queue.shift();
      if (!item) {
        break;
      }
      if (visited.has(item.url)) {
        logIngestEvent(ingestCompanyId, "crawl_skip", { url: item.url, reason: "visited" });
        continue;
      }
      visited.add(item.url);
      batch.push(item);
    }
    if (batch.length === 0) {
      break;
    }

    batchIndex += 1;
    logIngestEvent(ingestCompanyId, "crawl_batch_begin", {
      batch: batchIndex,
      size: batch.length,
      queueRemaining: queue.length,
      resultsCount: results.length,
    });

    const outcomes = await Promise.all(
      batch.map((item) => processQueueItem(item, originHost, robotsRules, ingestCompanyId)),
    );

    for (const outcome of outcomes) {
      if (outcome.skipReason && !outcome.page) {
        logIngestEvent(ingestCompanyId, "crawl_skip", {
          url: outcome.url,
          reason: outcome.skipReason,
        });
      }
      if (outcome.page && results.length < MAX_PAGES) {
        results.push(outcome.page);
      }
      if (outcome.links) {
        for (const link of outcome.links) {
          if (!visited.has(link)) {
            queue.push({ url: link, depth: outcome.depth + 1 });
          }
        }
      }
    }

    await setProgressStage(
      ingestCompanyId,
      `Crawling website (${results.length} / ${MAX_PAGES} pages)`,
    );
  }

  logIngestEvent(ingestCompanyId, "crawl_bfs_done", {
    resultsCount: results.length,
    queueRemaining: queue.length,
    visitedCount: visited.size,
  });

  if (results.length === 0) {
    throw new Error("No readable page content could be collected from the site.");
  }

  return results;
}
