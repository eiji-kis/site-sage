import { randomUUID } from "node:crypto";
import { cookies } from "next/headers";
import OpenAI from "openai";
import type { ResponseInput } from "openai/resources/responses/responses";
import { z } from "zod";
import { AnalyticsEventType } from "@/generated/prisma/client";
import { analyticsRateLimitAllow } from "@/lib/analytics-rate-limit";
import { createAnalyticsEventNonBlocking } from "@/lib/analytics-write";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

const bodySchema = z.object({
  slug: z.string().min(1).max(200),
  clientRequestId: z.string().uuid().optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(20_000),
      }),
    )
    .max(40),
});

function clientIpFromRequest(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) {
      return first;
    }
  }
  return req.headers.get("x-real-ip") ?? "unknown";
}

function logChatError(params: {
  companyId: string | null;
  slug: string;
  visitorKey: string | null;
  clientRequestId: string;
  httpStatus: number;
  code: string;
}) {
  createAnalyticsEventNonBlocking({
    type: AnalyticsEventType.CHAT_REQUEST_ERROR,
    companyId: params.companyId,
    slug: params.slug,
    visitorKey: params.visitorKey,
    properties: {
      httpStatus: params.httpStatus,
      code: params.code,
      clientRequestId: params.clientRequestId,
    },
  });
}

export async function POST(req: Request) {
  const ip = clientIpFromRequest(req);
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Invalid request" }, { status: 400 });
  }

  const { slug, messages } = parsed.data;
  const clientRequestId = parsed.data.clientRequestId ?? randomUUID();
  const cookieStore = await cookies();
  const visitorKey = cookieStore.get("ss_vid")?.value ?? null;

  if (!analyticsRateLimitAllow(`chat:${ip}:${slug}`, 90)) {
    return Response.json({ error: "Too many requests" }, { status: 429 });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    logChatError({
      companyId: null,
      slug,
      visitorKey,
      clientRequestId,
      httpStatus: 503,
      code: "chat_not_configured",
    });
    return Response.json({ error: "Chat is not configured." }, { status: 503 });
  }

  const company = await prisma.company.findFirst({
    where: { slug, status: "READY" },
    select: {
      id: true,
      slug: true,
      companyName: true,
      systemPrompt: true,
      knowledgeMarkdown: true,
    },
  });

  if (!company?.systemPrompt || !company.knowledgeMarkdown) {
    logChatError({
      companyId: company?.id ?? null,
      slug,
      visitorKey,
      clientRequestId,
      httpStatus: 404,
      code: "not_found",
    });
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const userTurns = messages.filter((m) => m.role === "user").length;
  createAnalyticsEventNonBlocking({
    type: AnalyticsEventType.CHAT_USER_MESSAGE,
    companyId: company.id,
    slug: company.slug,
    visitorKey,
    dedupeKey: clientRequestId,
    properties: {
      userTurns,
      assistantTurns: messages.filter((m) => m.role === "assistant").length,
    },
  });

  const system = `${company.systemPrompt}

---

Company: ${company.companyName}

Knowledge base (ground truth):

${company.knowledgeMarkdown}`;

  const openaiClient = new OpenAI({ apiKey });
  const input: ResponseInput = [
    { role: "system", content: system },
    ...messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  ];

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      try {
        const responseStream = openaiClient.responses.stream({
          model: "gpt-5.4",
          input,
          text: {
            format: { type: "text" },
            verbosity: "medium",
          },
          reasoning: {
            effort: "medium",
            summary: "auto",
          },
          tools: [],
          store: true,
          include: ["reasoning.encrypted_content", "web_search_call.action.sources"],
        });

        for await (const event of responseStream) {
          if (event.type === "response.output_text.delta") {
            controller.enqueue(encoder.encode(event.delta));
            continue;
          }
          if (event.type === "error") {
            logChatError({
              companyId: company.id,
              slug,
              visitorKey,
              clientRequestId,
              httpStatus: 502,
              code: "openai_stream_error",
            });
            controller.error(new Error(event.message));
            return;
          }
          if (event.type === "response.failed") {
            logChatError({
              companyId: company.id,
              slug,
              visitorKey,
              clientRequestId,
              httpStatus: 502,
              code: "openai_response_failed",
            });
            controller.error(new Error("Assistant request failed."));
            return;
          }
        }
        controller.close();
      } catch (err) {
        logChatError({
          companyId: company.id,
          slug,
          visitorKey,
          clientRequestId,
          httpStatus: 502,
          code: "openai_exception",
        });
        controller.error(err instanceof Error ? err : new Error("Assistant request failed."));
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
