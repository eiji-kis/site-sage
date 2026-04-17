"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Polls `router.refresh()` while an ingestion is in progress so the admin UI
 * picks up `progressStage` / `status` transitions without a manual reload.
 * Stops polling as soon as nothing is in-progress.
 */
export function AutoRefreshWhileIngesting({
  hasInProgress,
  intervalMs = 4000,
}: {
  hasInProgress: boolean;
  intervalMs?: number;
}) {
  const router = useRouter();

  useEffect(() => {
    if (!hasInProgress) {
      return;
    }
    const id = setInterval(() => {
      router.refresh();
    }, intervalMs);
    return () => clearInterval(id);
  }, [hasInProgress, intervalMs, router]);

  return null;
}
