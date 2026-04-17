const TAVILY_SEARCH_URL = "https://api.tavily.com/search";

export type TavilySearchDepth = "basic" | "advanced" | "fast" | "ultra-fast";

export type TavilyWebResult = {
  title: string;
  url: string;
  snippet: string;
};

/** Tavily Search API credit cost per request (see Tavily pricing docs). */
export function tavilySearchCreditCost(searchDepth: TavilySearchDepth): number {
  return searchDepth === "advanced" ? 2 : 1;
}

export type TavilySearchResponse = {
  results: TavilyWebResult[];
  creditsCharged: number;
};

export type TavilySearchOptions = {
  apiKey: string;
  query: string;
  maxResults: number;
  searchDepth?: TavilySearchDepth;
  timeoutMs?: number;
  excludeDomains?: string[];
};

export async function searchTavily(options: TavilySearchOptions): Promise<TavilySearchResponse> {
  const searchDepth = options.searchDepth ?? "basic";
  const timeoutMs = options.timeoutMs ?? 25_000;
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(TAVILY_SEARCH_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        api_key: options.apiKey,
        query: options.query,
        search_depth: searchDepth,
        max_results: options.maxResults,
        topic: "general",
        auto_parameters: false,
        include_answer: false,
        include_raw_content: false,
        include_images: false,
        exclude_domains: options.excludeDomains ?? [],
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Tavily search failed (${res.status}): ${errText.slice(0, 200)}`);
    }

    const json = (await res.json()) as {
      results?: Array<{ title?: string; url?: string; content?: string }>;
    };

    const raw = json.results ?? [];
    const results: TavilyWebResult[] = [];
    for (const row of raw) {
      const url = row.url?.trim();
      if (!url) {
        continue;
      }
      try {
        new URL(url);
      } catch {
        continue;
      }
      results.push({
        title: row.title?.trim() ?? "",
        url,
        snippet: row.content?.trim() ?? "",
      });
    }

    return {
      results,
      creditsCharged: tavilySearchCreditCost(searchDepth),
    };
  } finally {
    clearTimeout(id);
  }
}
