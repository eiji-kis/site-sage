import { Readability } from "@mozilla/readability";
import { JSDOM } from "jsdom";

export const DEFAULT_FETCH_TIMEOUT_MS = 12_000;
export const DEFAULT_USER_AGENT = "SiteSageBot/0.1 (+https://example.local; research crawler)";

export async function fetchWithTimeout(
  url: string,
  timeoutMs: number = DEFAULT_FETCH_TIMEOUT_MS,
  userAgent: string = DEFAULT_USER_AGENT,
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": userAgent,
        Accept: "text/html,application/xhtml+xml;q=0.9,application/xml;q=0.8,*/*;q=0.7",
      },
    });
  } finally {
    clearTimeout(id);
  }
}

export function extractReadableText(html: string, pageUrl: string): string {
  const dom = new JSDOM(html, { url: pageUrl });
  const doc = dom.window.document;
  const article = new Readability(doc).parse();
  const text = article?.textContent?.trim();
  if (text) {
    return text;
  }
  return doc.body?.textContent?.replace(/\s+/g, " ").trim() ?? "";
}
