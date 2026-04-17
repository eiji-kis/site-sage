import Link from "next/link";
import { BrandEyebrow } from "@/components/marketing/brand-eyebrow";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SpotlightCard } from "@/components/ui/spotlight-card";

export default function HomePage() {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-4 py-16">
      <div className="flex flex-col gap-4">
        <BrandEyebrow />
        <h1 className="text-balance text-3xl font-semibold tracking-tight md:text-4xl">
          <span className="text-gradient-brand">Company knowledge bases</span>
          <span className="text-foreground">, shared safely</span>
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-muted-foreground">
          Admins ingest public website content into a Markdown knowledge base and system prompt. Visitors
          chat with a dedicated assistant on a stable public URL per company.
        </p>
        <div className="flex flex-wrap gap-3 pt-1">
          <Button asChild>
            <Link href="/login">Admin sign in</Link>
          </Button>
          <Button variant="outline" asChild>
            <Link href="/admin">Dashboard</Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <SpotlightCard>
          <Card className="border-0 bg-transparent shadow-none ring-0 backdrop-blur-none">
            <CardHeader>
              <CardTitle className="text-base">Admins</CardTitle>
              <CardDescription>Create an agent from a company name and website URL.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Crawling runs on the server with polite limits. When ingestion finishes, a public chat link is
              ready to share.
            </CardContent>
          </Card>
        </SpotlightCard>
        <SpotlightCard>
          <Card className="border-0 bg-transparent shadow-none ring-0 backdrop-blur-none">
            <CardHeader>
              <CardTitle className="text-base">Visitors</CardTitle>
              <CardDescription>Open a company chat at a predictable path.</CardDescription>
            </CardHeader>
            <CardContent className="text-sm text-muted-foreground">
              Each company uses a slug, for example{" "}
              <code className="rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5 font-mono text-xs">
                /c/acme
              </code>
              . The assistant only sees that company&apos;s knowledge base.
            </CardContent>
          </Card>
        </SpotlightCard>
      </div>
    </div>
  );
}
