import Link from "next/link";
import { Database, ExternalLink, MessageCircle } from "lucide-react";
import { analyticsRollupForCompanies } from "@/lib/analytics-queries";
import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { DeleteCompanyDialog } from "@/components/admin/delete-company-dialog";

export default async function AdminHomePage() {
  const companies = await prisma.company.findMany({
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      slug: true,
      companyName: true,
      sourceUrl: true,
      status: true,
      errorMessage: true,
      updatedAt: true,
    },
  });

  // Request-time window for analytics (not render-pure by design).
  const since7 = new Date(Date.now() - 7 * 86400000); // eslint-disable-line react-hooks/purity -- server-only relative window
  const listAnalytics = await analyticsRollupForCompanies(
    companies.map((c) => c.id),
    since7,
  );

  return (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight md:text-3xl">
            <span className="text-gradient-brand">Companies</span>
          </h1>
          <p className="text-sm text-muted-foreground">
            Create agents from a company site, then share the public chat URL.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/agents/new">New agent</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All companies</CardTitle>
          <CardDescription>Status updates as ingestion runs on the server.</CardDescription>
        </CardHeader>
        <CardContent>
          {companies.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No companies yet.{" "}
              <Link href="/admin/agents/new" className="text-primary underline-offset-4 hover:underline">
                Create one
              </Link>
              .
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden text-right xl:table-cell">7d views</TableHead>
                  <TableHead className="hidden text-right xl:table-cell">7d msgs</TableHead>
                  <TableHead className="hidden text-right xl:table-cell">7d clicks</TableHead>
                  <TableHead className="hidden lg:table-cell">Note</TableHead>
                  <TableHead className="hidden md:table-cell">Slug</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {companies.map((c) => {
                  const a = listAnalytics.get(c.id) ?? { pageViews: 0, userMessages: 0, linkClicks: 0 };
                  return (
                  <TableRow key={c.id}>
                    <TableCell className="font-medium">{c.companyName}</TableCell>
                    <TableCell className="text-muted-foreground">{c.status}</TableCell>
                    <TableCell className="hidden text-right font-mono text-xs tabular-nums text-muted-foreground xl:table-cell">
                      {a.pageViews}
                    </TableCell>
                    <TableCell className="hidden text-right font-mono text-xs tabular-nums text-muted-foreground xl:table-cell">
                      {a.userMessages}
                    </TableCell>
                    <TableCell className="hidden text-right font-mono text-xs tabular-nums text-muted-foreground xl:table-cell">
                      {a.linkClicks}
                    </TableCell>
                    <TableCell className="hidden max-w-xs truncate text-xs text-muted-foreground lg:table-cell">
                      {c.status === "FAILED" && c.errorMessage ? c.errorMessage : "—"}
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs text-muted-foreground md:table-cell">
                      {c.slug}
                    </TableCell>
                    <TableCell className="text-right">
                      <div
                        className="flex flex-wrap justify-end gap-2"
                        data-slot="button-group"
                      >
                        {c.status === "COLLECTING" ? (
                          <Button
                            variant="outline"
                            size="sm"
                            disabled
                            title="Collection is in progress. The data page will be available when it finishes."
                          >
                            <Database data-icon="inline-start" className="size-3.5" aria-hidden />
                            Data
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/admin/companies/${c.slug}`}>
                              <Database data-icon="inline-start" className="size-3.5" aria-hidden />
                              Data
                            </Link>
                          </Button>
                        )}
                        {c.status === "READY" ? (
                          <Button variant="outline" size="sm" asChild>
                            <Link href={`/c/${c.slug}`} target="_blank" rel="noreferrer">
                              <MessageCircle data-icon="inline-start" className="size-3.5" aria-hidden />
                              Open chat
                            </Link>
                          </Button>
                        ) : null}
                        <Button variant="outline" size="sm" asChild>
                          <Link href={c.sourceUrl} target="_blank" rel="noreferrer">
                            <ExternalLink data-icon="inline-start" className="size-3.5" aria-hidden />
                            Site
                          </Link>
                        </Button>
                        <DeleteCompanyDialog companyId={c.id} companyName={c.companyName} />
                      </div>
                    </TableCell>
                  </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
