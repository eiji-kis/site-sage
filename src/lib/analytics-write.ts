import type { AnalyticsEventType, Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: string }).code === "P2002"
  );
}

export type AnalyticsEventCreate = {
  type: AnalyticsEventType;
  companyId: string | null;
  slug?: string | null;
  visitorKey?: string | null;
  dedupeKey?: string | null;
  properties?: Prisma.InputJsonValue;
};

export async function createAnalyticsEvent(data: AnalyticsEventCreate): Promise<void> {
  try {
    await prisma.analyticsEvent.create({
      data: {
        type: data.type,
        companyId: data.companyId,
        slug: data.slug ?? null,
        visitorKey: data.visitorKey ?? null,
        dedupeKey: data.dedupeKey ?? null,
        properties: data.properties ?? undefined,
      },
    });
  } catch (error) {
    if (isUniqueViolation(error)) {
      return;
    }
    throw error;
  }
}

/** Fire-and-forget analytics insert; swallows DB errors so UX is never blocked. */
export function createAnalyticsEventNonBlocking(data: AnalyticsEventCreate): void {
  void createAnalyticsEvent(data).catch(() => {
    // intentional no-op
  });
}
