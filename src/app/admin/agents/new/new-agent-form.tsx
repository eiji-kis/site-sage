"use client";

import Link from "next/link";
import { useActionState } from "react";
import { createCompanyAndStartIngestion, type CreateCompanyState } from "@/actions/company-actions";
import BorderGlow from "@/components/BorderGlow";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function NewAgentForm() {
  const [state, formAction, pending] = useActionState<CreateCompanyState, FormData>(
    createCompanyAndStartIngestion,
    null,
  );

  return (
    <BorderGlow
      animated
      className="max-w-lg border-0 shadow-2xl shadow-black/45 ring-1 ring-white/[0.08] backdrop-blur-xl"
      borderRadius={18}
      backgroundColor="rgba(26, 22, 42, 0.78)"
      colors={["#a78bfa", "#38bdf8", "#f472b6"]}
      glowColor="280 65% 72"
      glowRadius={28}
      edgeSensitivity={26}
      fillOpacity={0.42}
    >
      <Card className="border-0 bg-transparent shadow-none ring-0 backdrop-blur-none">
        <CardHeader>
          <CardTitle>New company agent</CardTitle>
          <CardDescription>
            We crawl public pages from the site you provide, then generate a knowledge base and chat
            prompt. This can take a minute.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {state?.ok ? (
            <div className="flex flex-col gap-4 text-sm">
              <p>
                Ingestion started for slug{" "}
                <code className="rounded-md border border-border/60 bg-muted/50 px-1.5 py-0.5 font-mono text-xs">
                  {state.slug}
                </code>
                .
              </p>
              <p className="text-muted-foreground">
                When status is READY, the public chat will be available at{" "}
                <Link href={`/c/${state.slug}`} className="text-primary underline-offset-4 hover:underline">
                  /c/{state.slug}
                </Link>
                .
              </p>
              <Button asChild variant="outline">
                <Link href="/admin">Back to dashboard</Link>
              </Button>
            </div>
          ) : (
            <form action={formAction} className="flex flex-col gap-4">
              <div className="flex flex-col gap-2">
                <label htmlFor="companyName" className="text-sm font-medium">
                  Company name
                </label>
                <Input
                  id="companyName"
                  name="companyName"
                  placeholder="Acme Corp"
                  required
                  autoComplete="organization"
                />
              </div>
              <div className="flex flex-col gap-2">
                <label htmlFor="sourceUrl" className="text-sm font-medium">
                  Website URL
                </label>
                <Input
                  id="sourceUrl"
                  name="sourceUrl"
                  type="url"
                  placeholder="https://www.example.com"
                  required
                />
              </div>
              {state?.ok === false ? (
                <p className="text-sm text-destructive">{state.message}</p>
              ) : null}
              <Button type="submit" disabled={pending}>
                {pending ? "Starting…" : "Start"}
              </Button>
            </form>
          )}
        </CardContent>
      </Card>
    </BorderGlow>
  );
}
