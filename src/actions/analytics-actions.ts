"use server";

import { cookies, headers } from "next/headers";
import { AnalyticsEventType, type Prisma } from "@/generated/prisma/client";
import { analyticsRateLimitAllow } from "@/lib/analytics-rate-limit";
import { createAnalyticsEvent } from "@/lib/analytics-write";
import { prisma } from "@/lib/prisma";
import { publicAnalyticsPayloadSchema } from "@/lib/validations/analytics";

function clientIp(h: Headers): string {
  const xff = h.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  return h.get("x-real-ip") ?? "unknown";
}

export type LogPublicAnalyticsResult = { ok: true } | { ok: false };

export async function logPublicAnalytics(payload: unknown): Promise<LogPublicAnalyticsResult> {
  const parsed = publicAnalyticsPayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return { ok: false };
  }

  const h = await headers();
  const cookieStore = await cookies();
  const visitorKey = cookieStore.get("ss_vid")?.value ?? null;
  const ip = clientIp(h);
  const rateKey = `${visitorKey ?? "novis"}:${ip}`;
  if (!analyticsRateLimitAllow(rateKey)) {
    return { ok: false };
  }

  const company = await prisma.company.findFirst({
    where: { slug: parsed.data.slug, status: "READY" },
    select: { id: true, slug: true },
  });
  if (!company) {
    return { ok: false };
  }

  const base = {
    companyId: company.id,
    slug: company.slug,
    visitorKey,
  };

  try {
    if (parsed.data.type === "PUBLIC_CHAT_VIEW") {
      const properties: Prisma.InputJsonValue = {
        referrer: parsed.data.referrer,
        search: parsed.data.search,
        userAgent: parsed.data.userAgent,
      };
      await createAnalyticsEvent({
        type: AnalyticsEventType.PUBLIC_CHAT_VIEW,
        ...base,
        properties,
      });
    } else {
      const properties: Prisma.InputJsonValue = {
        href: parsed.data.href,
        surface: parsed.data.surface,
        label: parsed.data.label,
      };
      await createAnalyticsEvent({
        type: AnalyticsEventType.LINK_CLICK,
        ...base,
        properties,
      });
    }
  } catch {
    return { ok: false };
  }

  return { ok: true };
}
