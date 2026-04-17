/**
 * Minimal robots.txt handling for same-origin crawl politeness.
 */

export type RobotRules = {
  disallows: string[];
};

export function parseRobotsTxt(raw: string): RobotRules {
  const lines = raw.split(/\r?\n/);
  let applies = false;
  const disallows: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const lower = trimmed.toLowerCase();
    if (lower.startsWith("user-agent:")) {
      const ua = trimmed.slice("user-agent:".length).trim();
      applies = ua === "*";
      continue;
    }
    if (applies && lower.startsWith("disallow:")) {
      const path = trimmed.slice("disallow:".length).trim();
      if (path) {
        disallows.push(path);
      }
    }
  }

  return { disallows };
}

export function isPathAllowed(path: string, rules: RobotRules): boolean {
  return !rules.disallows.some((prefix) => path.startsWith(prefix));
}

/**
 * Fetch and parse robots.txt for an origin (e.g. https://example.com).
 */
export async function loadRobotRulesForOrigin(
  origin: string,
  fetchRobots: (url: string) => Promise<Response>,
): Promise<RobotRules> {
  try {
    const robotsUrl = new URL("/robots.txt", origin).toString();
    const res = await fetchRobots(robotsUrl);
    if (res.ok) {
      const body = await res.text();
      return parseRobotsTxt(body);
    }
  } catch {
    /* ignore */
  }
  return { disallows: [] };
}
