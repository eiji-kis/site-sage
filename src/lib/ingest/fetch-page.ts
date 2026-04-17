import { Readability } from "@mozilla/readability";
import { parseHTML } from "linkedom";

export const DEFAULT_FETCH_TIMEOUT_MS = 10_000;
export const DEFAULT_USER_AGENT =
  "Mozilla/5.0 (compatible; SiteSageBot/0.1; +https://site-sage.local)";

/**
 * Large marketing sites ship multi‑MB HTML; linkedom + Readability + cheerio are
 * sync and can freeze the worker. 500k chars still captures a typical article
 * while dropping per-page parse from tens of seconds to a few hundred ms.
 */
export const MAX_HTML_CHARS_FOR_INGEST = 500_000;

export function truncateHtmlForIngest(html: string): string {
  if (html.length <= MAX_HTML_CHARS_FOR_INGEST) {
    return html;
  }
  return html.slice(0, MAX_HTML_CHARS_FOR_INGEST);
}

/**
 * Hard escape: if `p` hasn't settled in `ms`, reject with a timeout error.
 * The original promise may keep running in the background but the caller is unblocked.
 */
function raceWithTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`${label}: timed out after ${ms}ms`)), ms);
  });
  return Promise.race([p, timeout]).finally(() => {
    if (timer) {
      clearTimeout(timer);
    }
  });
}

export async function fetchWithTimeout(
  url: string,
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
  userAgent: string = DEFAULT_USER_AGENT,
): Promise<Response> {
  const controller = new AbortController();
  const abortTimer = setTimeout(() => controller.abort(), timeoutMs);
  // Belt-and-suspenders: some runtimes don't reliably abort a slow body read via the signal,
  // so wrap the whole fetch + body read in a Promise.race with a hard reject at timeoutMs * 1.2.
  const work = (async () => {
    try {
      const res = await fetch(url, {
        signal: controller.signal,
        redirect: "follow",
        headers: {
          "User-Agent": userAgent,
          Accept: "text/html,application/xhtml+xml;q=0.9,application/xml;q=0.8,*/*;q=0.7",
          "Accept-Language": "en-US,en;q=0.9",
        },
      });
      const text = await res.text();
      return new Response(text, {
        status: res.status,
        statusText: res.statusText,
        headers: new Headers(res.headers),
      });
    } finally {
      clearTimeout(abortTimer);
    }
  })();
  return raceWithTimeout(work, Math.ceil(timeoutMs * 1.2), `fetch ${url}`);
}

function applyBaseUrlToDocument(document: Document, pageUrl: string): void {
  let href: string;
  try {
    href = new URL(pageUrl).href;
  } catch {
    return;
  }
  const baseEl = document.createElement("base");
  baseEl.setAttribute("href", href);
  const head = document.head;
  if (head) {
    head.insertBefore(baseEl, head.firstChild);
    return;
  }
  const htmlEl = document.documentElement;
  if (!htmlEl) {
    return;
  }
  const newHead = document.createElement("head");
  newHead.appendChild(baseEl);
  htmlEl.insertBefore(newHead, htmlEl.firstChild);
}

export function extractReadableText(html: string, pageUrl: string): string {
  const clipped = truncateHtmlForIngest(html);
  const { document } = parseHTML(clipped);
  applyBaseUrlToDocument(document, pageUrl);
  const article = new Readability(document).parse();
  const text = article?.textContent?.trim();
  if (text) {
    return text;
  }
  return document.body?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}
