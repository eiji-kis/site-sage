import Link from "next/link";
import { notFound } from "next/navigation";
import { AutoRefreshWhileIngesting } from "@/components/admin/auto-refresh-while-ingesting";
import { CompanyIngestTabs } from "@/components/admin/company-ingest-tabs";
import { CompanyStatusCell, isInProgress } from "@/components/admin/company-status-cell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { analyticsRollupForCompany } from "@/lib/analytics-queries";
import { prisma } from "@/lib/prisma";

type PageProps = { params: Promise<{ slug: string }> };

export default async function AdminCompanyIngestPage(props: PageProps) {
  const { slug } = await props.params;
  const company = await prisma.company.findUnique({
    where: { slug },
    select: {
      id: true,
      companyName: true,
      slug: true,
      sourceUrl: true,
      status: true,
      progressStage: true,
      errorMessage: true,
      crawlCorpus: true,
      webResearchCorpus: true,
      knowledgeMarkdown: true,
      systemPrompt: true,
      publicAgentDescription: true,
    },
  });

  if (!company) {
    notFound();
  }

  const now = Date.now(); // eslint-disable-line react-hooks/purity -- server-only relative window
  const since7 = new Date(now - 7 * 86400000);
  const since30 = new Date(now - 30 * 86400000);
  const [rollup7, rollup30] = await Promise.all([
    analyticsRollupForCompany(company.id, since7),
    analyticsRollupForCompany(company.id, since30),
  ]);

  return (
    <div className="flex flex-col gap-8">
      <AutoRefreshWhileIngesting hasInProgress={isInProgress(company.status)} />
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex flex-col gap-2">
          <Button variant="ghost" size="sm" className="h-auto w-fit px-0 text-muted-foreground hover:text-foreground" asChild>
            <Link href="/admin">← All companies</Link>
          </Button>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            <span className="text-gradient-brand">{company.companyName}</span>
          </h1>
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <CompanyStatusCell
              status={company.status}
              progressStage={company.progressStage}
              layout="inline"
            />
            <span aria-hidden>·</span>
            <Link href={company.sourceUrl} className="text-primary underline-offset-4 hover:underline" target="_blank" rel="noreferrer">
              Source site
            </Link>
            {company.status === "READY" ? (
              <>
                <span aria-hidden>·</span>
                <Link
                  href={`/c/${company.slug}`}
                  className="text-primary underline-offset-4 hover:underline"
                  target="_blank"
                  rel="noreferrer"
                >
                  Open chat
                </Link>
              </>
            ) : null}
          </div>
        </div>
      </div>

      {company.status === "FAILED" && company.errorMessage ? (
        <p className="rounded-lg border border-destructive/35 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {company.errorMessage}
        </p>
      ) : null}

      {company.status === "READY" ? (
        <Card>
          <CardHeader>
            <CardTitle>Public chat analytics</CardTitle>
            <CardDescription>
              Aggregate usage on <span className="font-mono text-foreground/90">/c/{company.slug}</span> — not
              message transcripts.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Last 7 days</p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Page views</dt>
                  <dd className="text-right font-mono tabular-nums">{rollup7.pageViews}</dd>
                  <dt className="text-muted-foreground">Unique visitors</dt>
                  <dd className="text-right font-mono tabular-nums">{rollup7.uniqueVisitors}</dd>
                  <dt className="text-muted-foreground">User messages</dt>
                  <dd className="text-right font-mono tabular-nums">{rollup7.userMessages}</dd>
                  <dt className="text-muted-foreground">Link clicks</dt>
                  <dd className="text-right font-mono tabular-nums">{rollup7.linkClicks}</dd>
                  <dt className="text-muted-foreground">Chat errors</dt>
                  <dd className="text-right font-mono tabular-nums">{rollup7.chatErrors}</dd>
                </dl>
              </div>
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Last 30 days</p>
                <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                  <dt className="text-muted-foreground">Page views</dt>
                  <dd className="text-right font-mono tabular-nums">{rollup30.pageViews}</dd>
                  <dt className="text-muted-foreground">Unique visitors</dt>
                  <dd className="text-right font-mono tabular-nums">{rollup30.uniqueVisitors}</dd>
                  <dt className="text-muted-foreground">User messages</dt>
                  <dd className="text-right font-mono tabular-nums">{rollup30.userMessages}</dd>
                  <dt className="text-muted-foreground">Link clicks</dt>
                  <dd className="text-right font-mono tabular-nums">{rollup30.linkClicks}</dd>
                  <dt className="text-muted-foreground">Chat errors</dt>
                  <dd className="text-right font-mono tabular-nums">{rollup30.chatErrors}</dd>
                </dl>
              </div>
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Ingestion output</CardTitle>
          <CardDescription>
            Review crawl text, generated knowledge, the assistant system prompt, and the public visitor intro.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <CompanyIngestTabs
            crawlCorpus={company.crawlCorpus}
            webResearchCorpus={company.webResearchCorpus}
            knowledgeMarkdown={company.knowledgeMarkdown}
            systemPrompt={company.systemPrompt}
            publicAgentDescription={company.publicAgentDescription}
          />
        </CardContent>
      </Card>
    </div>
  );
}
