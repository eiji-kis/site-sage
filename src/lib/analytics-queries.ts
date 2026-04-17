import { AnalyticsEventType } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

export type AnalyticsRollup = {
  pageViews: number;
  linkClicks: number;
  userMessages: number;
  chatErrors: number;
  uniqueVisitors: number;
};

function emptyRollup(): AnalyticsRollup {
  return {
    pageViews: 0,
    linkClicks: 0,
    userMessages: 0,
    chatErrors: 0,
    uniqueVisitors: 0,
  };
}

export async function analyticsRollupForCompany(companyId: string, since: Date): Promise<AnalyticsRollup> {
  const [groups, uniqueRows] = await Promise.all([
    prisma.analyticsEvent.groupBy({
      by: ["type"],
      where: { companyId, createdAt: { gte: since } },
      _count: { _all: true },
    }),
    prisma.analyticsEvent.findMany({
      where: {
        companyId,
        type: AnalyticsEventType.PUBLIC_CHAT_VIEW,
        createdAt: { gte: since },
        visitorKey: { not: null },
      },
      distinct: ["visitorKey"],
      select: { visitorKey: true },
    }),
  ]);

  const out = emptyRollup();
  for (const row of groups) {
    const c = row._count._all;
    switch (row.type) {
      case AnalyticsEventType.PUBLIC_CHAT_VIEW:
        out.pageViews += c;
        break;
      case AnalyticsEventType.LINK_CLICK:
        out.linkClicks += c;
        break;
      case AnalyticsEventType.CHAT_USER_MESSAGE:
        out.userMessages += c;
        break;
      case AnalyticsEventType.CHAT_REQUEST_ERROR:
        out.chatErrors += c;
        break;
      default:
        break;
    }
  }
  out.uniqueVisitors = uniqueRows.length;
  return out;
}

export type CompanyListAnalytics = {
  pageViews: number;
  userMessages: number;
  linkClicks: number;
};

export async function analyticsRollupForCompanies(
  companyIds: string[],
  since: Date,
): Promise<Map<string, CompanyListAnalytics>> {
  const map = new Map<string, CompanyListAnalytics>();
  for (const id of companyIds) {
    map.set(id, { pageViews: 0, userMessages: 0, linkClicks: 0 });
  }
  if (companyIds.length === 0) {
    return map;
  }

  const groups = await prisma.analyticsEvent.groupBy({
    by: ["companyId", "type"],
    where: {
      companyId: { in: companyIds },
      createdAt: { gte: since },
    },
    _count: { _all: true },
  });

  for (const row of groups) {
    if (!row.companyId) {
      continue;
    }
    const bucket = map.get(row.companyId);
    if (!bucket) {
      continue;
    }
    const c = row._count._all;
    if (row.type === AnalyticsEventType.PUBLIC_CHAT_VIEW) {
      bucket.pageViews += c;
    } else if (row.type === AnalyticsEventType.CHAT_USER_MESSAGE) {
      bucket.userMessages += c;
    } else if (row.type === AnalyticsEventType.LINK_CLICK) {
      bucket.linkClicks += c;
    }
  }

  return map;
}
