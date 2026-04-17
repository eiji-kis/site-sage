"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

type CompanyIngestTabsProps = {
  crawlCorpus: string | null;
  webResearchCorpus: string | null;
  knowledgeMarkdown: string | null;
  systemPrompt: string | null;
  publicAgentDescription: string | null;
};

function ScrollPanel({ text, emptyLabel }: { text: string | null; emptyLabel: string }) {
  if (!text?.trim()) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <pre className="max-h-[min(28rem,calc(100vh-14rem))] overflow-auto whitespace-pre-wrap break-words rounded-lg border border-border/60 bg-muted/25 p-4 font-mono text-xs leading-relaxed text-foreground">
      {text}
    </pre>
  );
}

function VisitorIntroPanel({ text, emptyLabel }: { text: string | null; emptyLabel: string }) {
  if (!text?.trim()) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }
  return (
    <div className="max-h-[min(28rem,calc(100vh-14rem))] overflow-auto rounded-lg border border-border/60 bg-muted/25 p-4 text-sm leading-relaxed text-foreground">
      {text}
    </div>
  );
}

export function CompanyIngestTabs({
  crawlCorpus,
  webResearchCorpus,
  knowledgeMarkdown,
  systemPrompt,
  publicAgentDescription,
}: CompanyIngestTabsProps) {
  const defaultTab = crawlCorpus?.trim()
    ? "crawl"
    : webResearchCorpus?.trim()
      ? "web"
      : knowledgeMarkdown?.trim()
        ? "knowledge"
        : "system";

  return (
    <Tabs defaultValue={defaultTab} className="w-full gap-4">
      <TabsList className="flex-wrap gap-1">
        <TabsTrigger value="crawl">Official crawl</TabsTrigger>
        <TabsTrigger value="web">Web research</TabsTrigger>
        <TabsTrigger value="knowledge">Knowledge base</TabsTrigger>
        <TabsTrigger value="system">System prompt</TabsTrigger>
        <TabsTrigger value="visitor">Visitor intro</TabsTrigger>
      </TabsList>
      <TabsContent value="crawl" className="mt-4">
        <p className="mb-3 text-xs text-muted-foreground">
          Official-site pages only (same-origin crawl). Primary input for the knowledge-base model.
        </p>
        <ScrollPanel
          text={crawlCorpus}
          emptyLabel="No official crawl text stored yet. Re-run ingestion after deploy to populate this field."
        />
      </TabsContent>
      <TabsContent value="web" className="mt-4">
        <p className="mb-3 text-xs text-muted-foreground">
          Tavily search + optional third-party page fetches (credit-budgeted). Supplementary context for the
          knowledge base; may be empty if Tavily is not configured.
        </p>
        <ScrollPanel
          text={webResearchCorpus}
          emptyLabel="No web research text. Set TAVILY_API_KEY to enable off-site discovery on the next ingestion."
        />
      </TabsContent>
      <TabsContent value="knowledge" className="mt-4">
        <p className="mb-3 text-xs text-muted-foreground">
          Markdown knowledge base generated from the official crawl and optional web research (used as chat
          context).
        </p>
        <ScrollPanel
          text={knowledgeMarkdown}
          emptyLabel="No knowledge base yet. Status must reach READY after ingestion completes."
        />
      </TabsContent>
      <TabsContent value="system" className="mt-4">
        <p className="mb-3 text-xs text-muted-foreground">
          System instructions generated for the public chat assistant.
        </p>
        <ScrollPanel
          text={systemPrompt}
          emptyLabel="No system prompt yet. It is created when ingestion reaches READY."
        />
      </TabsContent>
      <TabsContent value="visitor" className="mt-4">
        <p className="mb-3 text-xs text-muted-foreground">
          Shown under the title on the public chat page for this company.
        </p>
        <VisitorIntroPanel
          text={publicAgentDescription}
          emptyLabel="No visitor intro yet. It is generated when ingestion reaches READY (new ingestions only for existing companies)."
        />
      </TabsContent>
    </Tabs>
  );
}
