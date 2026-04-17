"use client";

import type React from "react";
import { createContext, useContext, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { Components } from "react-markdown";
import { logPublicAnalytics } from "@/actions/analytics-actions";

const InsidePre = createContext(false);

function MarkdownCode({
  className,
  children,
  ...props
}: React.ComponentPropsWithoutRef<"code">) {
  const inPre = useContext(InsidePre);
  if (inPre) {
    return (
      <code
        className={`block w-full bg-transparent p-0 font-mono text-[0.8125rem] leading-relaxed text-foreground ${className ?? ""}`}
        {...props}
      >
        {children}
      </code>
    );
  }
  return (
    <code
      className="rounded-md border border-border/50 bg-background/60 px-1.5 py-0.5 font-mono text-[0.8125rem] text-foreground"
      {...props}
    >
      {children}
    </code>
  );
}

function makeMarkdownComponents(companySlug?: string): Components {
  return {
    p: ({ children }) => (
      <p className="mb-2 text-pretty last:mb-0 [&:not(:first-child)]:mt-2">{children}</p>
    ),
    ul: ({ children }) => (
      <ul className="mb-2 ml-4 list-disc space-y-1 text-pretty last:mb-0 [&:not(:first-child)]:mt-2">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="mb-2 ml-4 list-decimal space-y-1 text-pretty last:mb-0 [&:not(:first-child)]:mt-2">
        {children}
      </ol>
    ),
    li: ({ children }) => <li className="leading-relaxed [&>p]:mb-0">{children}</li>,
    a: ({ href, children }) => (
      <a
        href={href}
        className="font-medium text-primary underline decoration-primary/40 underline-offset-2 hover:decoration-primary"
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => {
          if (!companySlug || !href) {
            return;
          }
          void logPublicAnalytics({
            type: "LINK_CLICK",
            slug: companySlug,
            href,
            surface: "assistant_markdown",
          });
        }}
      >
        {children}
      </a>
    ),
    strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
    em: ({ children }) => <em className="italic">{children}</em>,
    del: ({ children }) => <del className="text-muted-foreground line-through">{children}</del>,
    h1: ({ children }) => (
      <h1 className="mb-2 mt-3 text-base font-semibold tracking-tight first:mt-0">{children}</h1>
    ),
    h2: ({ children }) => (
      <h2 className="mb-2 mt-3 text-[0.95rem] font-semibold tracking-tight first:mt-0">{children}</h2>
    ),
    h3: ({ children }) => (
      <h3 className="mb-1.5 mt-2 text-sm font-semibold tracking-tight first:mt-0">{children}</h3>
    ),
    blockquote: ({ children }) => (
      <blockquote className="my-2 border-l-2 border-primary/40 pl-3 text-muted-foreground italic">
        {children}
      </blockquote>
    ),
    hr: () => <hr className="my-3 border-border/60" />,
    code: MarkdownCode,
    pre: ({ children }) => (
      <InsidePre.Provider value={true}>
        <pre className="mb-2 max-w-full overflow-x-auto rounded-lg border border-border/60 bg-background/40 p-3 font-mono text-[0.8125rem] leading-relaxed last:mb-0">
          {children}
        </pre>
      </InsidePre.Provider>
    ),
    table: ({ children }) => (
      <div className="mb-2 max-w-full overflow-x-auto last:mb-0">
        <table className="w-full border-collapse text-left text-[0.8125rem]">{children}</table>
      </div>
    ),
    thead: ({ children }) => <thead className="border-b border-border/60">{children}</thead>,
    tbody: ({ children }) => <tbody className="divide-y divide-border/40">{children}</tbody>,
    tr: ({ children }) => <tr>{children}</tr>,
    th: ({ children }) => (
      <th className="px-2 py-1.5 font-semibold text-foreground">{children}</th>
    ),
    td: ({ children }) => <td className="px-2 py-1.5 align-top text-muted-foreground">{children}</td>,
  };
}

export function ChatMessageMarkdown({
  content,
  companySlug,
}: {
  content: string;
  companySlug?: string;
}) {
  const components = useMemo(() => makeMarkdownComponents(companySlug), [companySlug]);

  if (!content) {
    return null;
  }

  return (
    <div className="min-w-0 [&_code]:break-words [&_pre_code]:whitespace-pre [&_pre_code]:break-normal">
      <ReactMarkdown remarkPlugins={[remarkGfm]} components={components}>
        {content}
      </ReactMarkdown>
    </div>
  );
}
