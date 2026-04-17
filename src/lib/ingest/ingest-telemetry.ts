/**
 * Structured logs for ingestion. In Vercel: Project → Observability → Logs (or Runtime Logs),
 * search for `site-sage-ingest` or a specific `companyId`.
 */
export function logIngestEvent(
  companyId: string,
  phase: string,
  detail?: Record<string, string | number | boolean | null | undefined>,
): void {
  const payload = {
    source: "site-sage-ingest",
    companyId,
    phase,
    at: new Date().toISOString(),
    vercelRegion: process.env.VERCEL_REGION,
    ...detail,
  };
  console.log(JSON.stringify(payload));
}
