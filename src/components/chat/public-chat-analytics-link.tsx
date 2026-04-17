"use client";

import Link from "next/link";
import { forwardRef, type ComponentProps } from "react";
import { logPublicAnalytics } from "@/actions/analytics-actions";

type Surface =
  | "assistant_markdown"
  | "public_chat_header"
  | "public_chat_body"
  | "public_chat_lead_cta"
  | "marketing_home";

type LinkProps = Omit<ComponentProps<typeof Link>, "onClick"> & {
  slug: string;
  surface: Surface;
  label?: string;
};

export function PublicChatAnalyticsLink({ slug, surface, href, label, children, ...rest }: LinkProps) {
  const hrefStr = typeof href === "string" ? href : String(href ?? "");
  return (
    <Link
      {...rest}
      href={href}
      onClick={() => {
        void logPublicAnalytics({
          type: "LINK_CLICK",
          slug,
          href: hrefStr,
          surface,
          label,
        });
      }}
    >
      {children}
    </Link>
  );
}

type OutboundProps = ComponentProps<"a"> & {
  slug: string;
  surface: Surface;
  label?: string;
};

export const PublicChatAnalyticsOutboundLink = forwardRef<HTMLAnchorElement, OutboundProps>(
  function PublicChatAnalyticsOutboundLink({ slug, surface, href, label, children, onClick, ...rest }, ref) {
    const hrefStr = typeof href === "string" ? href : String(href ?? "");
    return (
      <a
        ref={ref}
        {...rest}
        href={href}
        onClick={(e) => {
          onClick?.(e);
          void logPublicAnalytics({
            type: "LINK_CLICK",
            slug,
            href: hrefStr,
            surface,
            label,
          });
        }}
      >
        {children}
      </a>
    );
  },
);
