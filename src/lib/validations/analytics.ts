import { z } from "zod";

const linkSurfaceSchema = z.enum([
  "assistant_markdown",
  "public_chat_header",
  "public_chat_body",
  "public_chat_lead_cta",
  "marketing_home",
]);

const safeHrefSchema = z
  .string()
  .min(1)
  .max(2000)
  .refine((h) => {
    const lower = h.toLowerCase();
    if (lower.startsWith("javascript:") || lower.startsWith("data:")) {
      return false;
    }
    return (
      lower.startsWith("https://") ||
      lower.startsWith("http://") ||
      h.startsWith("/") ||
      h.startsWith("#") ||
      h.startsWith("mailto:") ||
      h.startsWith("tel:")
    );
  }, "Invalid href");

export const publicAnalyticsPayloadSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("PUBLIC_CHAT_VIEW"),
    slug: z.string().min(1).max(200),
    referrer: z.string().max(2000).optional(),
    search: z.string().max(2000).optional(),
    userAgent: z.string().max(500).optional(),
  }),
  z.object({
    type: z.literal("LINK_CLICK"),
    slug: z.string().min(1).max(200),
    href: safeHrefSchema,
    surface: linkSurfaceSchema,
    label: z.string().max(500).optional(),
  }),
]);

export type PublicAnalyticsPayload = z.infer<typeof publicAnalyticsPayloadSchema>;
