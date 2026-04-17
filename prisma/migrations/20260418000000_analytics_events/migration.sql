-- CreateEnum
CREATE TYPE "site_sage"."AnalyticsEventType" AS ENUM ('PUBLIC_CHAT_VIEW', 'LINK_CLICK', 'CHAT_USER_MESSAGE', 'CHAT_REQUEST_ERROR');

-- CreateTable
CREATE TABLE "site_sage"."AnalyticsEvent" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "type" "site_sage"."AnalyticsEventType" NOT NULL,
    "companyId" TEXT,
    "slug" TEXT,
    "visitorKey" TEXT,
    "dedupeKey" TEXT,
    "properties" JSONB,

    CONSTRAINT "AnalyticsEvent_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AnalyticsEvent_companyId_createdAt_idx" ON "site_sage"."AnalyticsEvent"("companyId", "createdAt");

-- CreateIndex
CREATE INDEX "AnalyticsEvent_type_createdAt_idx" ON "site_sage"."AnalyticsEvent"("type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "AnalyticsEvent_companyId_dedupeKey_key" ON "site_sage"."AnalyticsEvent"("companyId", "dedupeKey");

-- AddForeignKey
ALTER TABLE "site_sage"."AnalyticsEvent" ADD CONSTRAINT "AnalyticsEvent_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "site_sage"."Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
