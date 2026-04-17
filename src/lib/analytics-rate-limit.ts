const WINDOW_MS = 60_000;
const MAX_PER_WINDOW_PUBLIC = 120;

type Bucket = { timestamps: number[] };

const buckets = new Map<string, Bucket>();

function prune(bucket: Bucket, now: number) {
  const cutoff = now - WINDOW_MS;
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);
}

/** Simple in-memory sliding window limiter (best-effort; resets on cold start). */
export function analyticsRateLimitAllow(key: string, maxPerWindow = MAX_PER_WINDOW_PUBLIC): boolean {
  const now = Date.now();
  let bucket = buckets.get(key);
  if (!bucket) {
    bucket = { timestamps: [] };
    buckets.set(key, bucket);
  }
  prune(bucket, now);
  if (bucket.timestamps.length >= maxPerWindow) {
    return false;
  }
  bucket.timestamps.push(now);
  return true;
}
