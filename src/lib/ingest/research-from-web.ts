import { DEFAULT_FETCH_TIMEOUT_MS, extractReadableText, fetchWithTimeout } from "@/lib/ingest/fetch-page";
import { normalizeSeedUrl } from "@/lib/ingest/normalize-seed-url";
import { isPathAllowed, loadRobotRulesForOrigin, type RobotRules } from "@/lib/ingest/robots";
import { searchTavily, tavilySearchCreditCost, type TavilySearchDepth, type TavilyWebResult } from "@/lib/ingest/tavily-search";

const DEFAULT_CREDIT_BUDGET = 5;
const MAX_TAVILY_RESULTS_PER_QUERY = 6;
const MAX_EXTERNAL_FETCHES = 10;
const MIN_PAGE_TEXT_LEN = 80;
const SEARCH_DEPTH: TavilySearchDepth = "basic";

const TAVILY_EXCLUDE_DOMAINS = [
  "facebook.com",
  "instagram.com",
  "tiktok.com",
  "pinterest.com",
  "reddit.com",
  "twitter.com",
  "x.com",
  "linkedin.com",
];

function hostKey(hostname: string): string {
  const h = hostname.toLowerCase();
  return h.startsWith("www.") ? h.slice(4) : h;
}

function canonicalUrlString(raw: string): string | null {
  try {
    const u = new URL(raw);
    u.hash = "";
    return u.toString();
  } catch {
    return null;
  }
}

function parseCreditBudget(): number {
  const raw = process.env.TAVILY_MAX_CREDITS_PER_COMPANY_INGEST?.trim();
  if (!raw) {
    return DEFAULT_CREDIT_BUDGET;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 0) {
    return DEFAULT_CREDIT_BUDGET;
  }
  return n;
}

function parseTavilyTimeoutMs(): number {
  const raw = process.env.TAVILY_TIMEOUT_MS?.trim();
  if (!raw) {
    return 25_000;
  }
  const n = Number.parseInt(raw, 10);
  if (!Number.isFinite(n) || n < 1000) {
    return 25_000;
  }
  return n;
}

function buildOrderedQueries(companyName: string, companyHostname: string): string[] {
  const hk = hostKey(companyHostname);
  return [`"${companyName}" official`, `"${companyName}" site:${hk}`, `${companyName} Wikipedia`];
}

function mergeTavilyResults(existing: Map<string, TavilyWebResult>, incoming: TavilyWebResult[]): void {
  for (const row of incoming) {
    const key = canonicalUrlString(row.url);
    if (!key) {
      continue;
    }
    if (!existing.has(key)) {
      existing.set(key, { ...row, url: key });
    }
  }
}

function scoreCandidate(url: string, companyHostKey: string): number {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return 0;
  }
  const hk = hostKey(u.hostname);
  if (hk === companyHostKey) {
    return 0;
  }
  if (hk.endsWith("wikipedia.org")) {
    return 100;
  }
  if (hk.endsWith(".gov") || hk.endsWith(".gov.uk")) {
    return 80;
  }
  return 50;
}

export type WebResearchResult = {
  corpus: string | null;
  creditsUsed: number;
  creditBudget: number;
};

/**
 * Discover and fetch third-party pages via Tavily (credit-budgeted), formatted for the KB model.
 */
export async function buildWebResearchCorpus(params: {
  companyName: string;
  sourceUrl: string;
  officialPageUrls: Iterable<string>;
}): Promise<WebResearchResult> {
  const apiKey = process.env.TAVILY_API_KEY?.trim();
  const creditBudget = parseCreditBudget();
  if (!apiKey || creditBudget === 0) {
    return { corpus: null, creditsUsed: 0, creditBudget };
  }

  const root = normalizeSeedUrl(params.sourceUrl);
  const companyHostKey = hostKey(root.hostname);
  const officialSet = new Set<string>();
  for (const raw of params.officialPageUrls) {
    const c = canonicalUrlString(raw);
    if (c) {
      officialSet.add(c);
    }
  }

  const costPerSearch = tavilySearchCreditCost(SEARCH_DEPTH);
  let creditsRemaining = creditBudget;
  const merged = new Map<string, TavilyWebResult>();
  const tavilyTimeout = parseTavilyTimeoutMs();

  const queries = buildOrderedQueries(params.companyName, root.hostname);
  for (let i = 0; i < queries.length; i++) {
    const query = queries[i];
    if (creditsRemaining < costPerSearch) {
      break;
    }
    try {
      const { results, creditsCharged } = await searchTavily({
        apiKey,
        query,
        maxResults: MAX_TAVILY_RESULTS_PER_QUERY,
        searchDepth: SEARCH_DEPTH,
        timeoutMs: tavilyTimeout,
        excludeDomains: TAVILY_EXCLUDE_DOMAINS,
      });
      creditsRemaining -= creditsCharged;
      mergeTavilyResults(merged, results);
    } catch {
      /* continue with partial results */
    }

    if (i >= 1 && merged.size >= 12) {
      break;
    }
  }

  const creditsUsed = creditBudget - creditsRemaining;
  if (merged.size === 0) {
    const note =
      creditsUsed > 0
        ? `Tavily returned no usable URLs (credits used: ${creditsUsed} / ${creditBudget}).`
        : "No Tavily search results.";
    return {
      corpus: `### Web research (Tavily)\n\n${note}\n`,
      creditsUsed,
      creditBudget,
    };
  }

  const candidates = [...merged.values()]
    .filter((row) => {
      const c = canonicalUrlString(row.url);
      if (!c || officialSet.has(c)) {
        return false;
      }
      try {
        return hostKey(new URL(c).hostname) !== companyHostKey;
      } catch {
        return false;
      }
    })
    .sort((a, b) => scoreCandidate(b.url, companyHostKey) - scoreCandidate(a.url, companyHostKey));

  const robotsByOrigin = new Map<string, RobotRules>();
  const loadRules = async (pageUrl: string): Promise<RobotRules> => {
    let origin: string;
    try {
      origin = new URL(pageUrl).origin;
    } catch {
      return { disallows: [] };
    }
    const hit = robotsByOrigin.get(origin);
    if (hit) {
      return hit;
    }
    const rules = await loadRobotRulesForOrigin(origin, (u) =>
      fetchWithTimeout(u, DEFAULT_FETCH_TIMEOUT_MS),
    );
    robotsByOrigin.set(origin, rules);
    return rules;
  };

  const sections: string[] = [];
  sections.push("### Web research (third-party, Tavily discovery)\n");
  sections.push(`Tavily API credits used this ingest: ${creditsUsed} / ${creditBudget}\n`);
  sections.push("\n---\n\n");

  let fetchCount = 0;
  for (const row of candidates) {
    if (fetchCount >= MAX_EXTERNAL_FETCHES) {
      break;
    }
    const url = canonicalUrlString(row.url);
    if (!url) {
      continue;
    }

    let fetched: string | null = null;
    try {
      const rules = await loadRules(url);
      const u = new URL(url);
      if (!isPathAllowed(u.pathname + u.search, rules)) {
        sections.push(`### Source (web): ${url}\n\n`);
        sections.push(`**Tavily snippet:** ${row.snippet || "(none)"}\n\n`);
        sections.push("**Fetched content:** (path disallowed by robots.txt)\n\n---\n\n");
        fetchCount++;
        continue;
      }
      const res = await fetchWithTimeout(url, DEFAULT_FETCH_TIMEOUT_MS);
      if (res.ok) {
        const ct = res.headers.get("content-type")?.toLowerCase() ?? "";
        if (ct.includes("text/html")) {
          const html = await res.text();
          const text = extractReadableText(html, url);
          if (text.length >= MIN_PAGE_TEXT_LEN) {
            fetched = text;
          }
        }
      }
    } catch {
      fetched = null;
    }

    sections.push(`### Source (web): ${url}\n\n`);
    if (row.title.trim()) {
      sections.push(`**Title:** ${row.title.trim()}\n\n`);
    }
    if (row.snippet.trim()) {
      sections.push(`**Tavily snippet:** ${row.snippet.trim()}\n\n`);
    }
    if (fetched) {
      sections.push(`**Fetched page text:**\n\n${fetched}\n\n`);
    } else {
      sections.push("**Fetched page text:** (unavailable or too short; rely on snippet only)\n\n");
    }
    sections.push("---\n\n");
    fetchCount++;
  }

  return {
    corpus: sections.join("").trimEnd(),
    creditsUsed,
    creditBudget,
  };
}
