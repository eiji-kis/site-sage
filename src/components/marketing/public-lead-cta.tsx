import { ExternalLink, Mail } from "lucide-react";
import { PublicChatAnalyticsLink, PublicChatAnalyticsOutboundLink } from "@/components/chat/public-chat-analytics-link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

function normalizeLinkedInUrl(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  const lower = trimmed.toLowerCase();
  if (!lower.startsWith("https://") && !lower.startsWith("http://")) {
    return `https://${trimmed}`;
  }
  return trimmed;
}

/** English possessive for brand in "I saw {Brand}'s demo …" */
function possessiveBrand(name: string): string {
  const t = name.trim();
  if (!t) {
    return "our";
  }
  return /s$/i.test(t) ? `${t}'` : `${t}'s`;
}

function buildLeadMailtoHref(email: string, companyName: string): string {
  const greetingName = process.env.SITE_SAGE_LEADS_GREETING_NAME?.trim() || "Patrick";
  const brandName = process.env.SITE_SAGE_LEADS_BRAND_NAME?.trim() || "KIS Solutions";
  const company = companyName.trim() || "this company";
  const body = [
    `Hey ${greetingName},`,
    "",
    `I saw ${possessiveBrand(brandName)} demo for the chatbot for ${company}. I'd like to know more about this.`,
    "",
  ].join("\n");
  const params = new URLSearchParams();
  params.set("body", body);
  return `mailto:${email}?${params.toString()}`;
}

export function PublicLeadCta({ slug, companyName }: { slug: string; companyName: string }) {
  const email = process.env.SITE_SAGE_LEADS_EMAIL?.trim() ?? "";
  const linkedin = normalizeLinkedInUrl(process.env.SITE_SAGE_LINKEDIN_URL ?? "");
  const mailtoHref = email ? buildLeadMailtoHref(email, companyName) : "";

  return (
    <Card size="sm">
      <CardHeader className="pb-2">
        <CardTitle className="text-base">Like what you see?</CardTitle>
        <CardDescription className="text-pretty leading-relaxed">
          If you would like to discuss turning this into a professional, on-brand assistant experience for
          your company, we would love to hear from you.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3 pt-0">
        <div className="flex flex-wrap gap-3">
          {email ? (
            <Button variant="default" asChild>
              <PublicChatAnalyticsOutboundLink
                slug={slug}
                surface="public_chat_lead_cta"
                href={mailtoHref}
                label="Email us"
              >
                <Mail data-icon="inline-start" aria-hidden />
                Email us
              </PublicChatAnalyticsOutboundLink>
            </Button>
          ) : null}
          {linkedin ? (
            <Button variant="outline" asChild>
              <PublicChatAnalyticsOutboundLink
                slug={slug}
                surface="public_chat_lead_cta"
                href={linkedin}
                target="_blank"
                rel="noopener noreferrer"
                label="LinkedIn"
              >
                <ExternalLink data-icon="inline-start" aria-hidden />
                LinkedIn
              </PublicChatAnalyticsOutboundLink>
            </Button>
          ) : null}
        </div>
        {!email && !linkedin ? (
          <p className="text-sm text-muted-foreground">
            Visit{" "}
            <PublicChatAnalyticsLink
              href="/"
              slug={slug}
              surface="public_chat_lead_cta"
              label="Site Sage home"
              className="text-primary underline-offset-4 hover:underline"
            >
              Site Sage home
            </PublicChatAnalyticsLink>{" "}
            to learn more about building an assistant like this for your organization.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
