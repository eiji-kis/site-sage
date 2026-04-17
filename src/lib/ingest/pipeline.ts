import { createOpenAI } from "@ai-sdk/openai";
import { generateText } from "ai";
import { revalidatePath } from "next/cache";
import { CompanyStatus } from "@/generated/prisma/enums";
import { crawlPublicSite } from "@/lib/ingest/crawl";
import { logIngestEvent } from "@/lib/ingest/ingest-telemetry";
import { setProgressStage } from "@/lib/ingest/pipeline-progress";
import { prisma } from "@/lib/prisma";
import { buildWebResearchCorpus } from "@/lib/ingest/research-from-web";

function requireOpenAI() {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error("OPENAI_API_KEY is not configured.");
  }
  return createOpenAI({ apiKey });
}

function formatCorpus(pages: { url: string; text: string }[]): string {
  return pages
    .map((p, i) => `### Source ${i + 1}: ${p.url}\n\n${p.text}`)
    .join("\n\n---\n\n");
}

async function generateKnowledgeMarkdown(
  companyName: string,
  sourceUrl: string,
  officialSiteCorpus: string,
  thirdPartyCorpus: string | null,
): Promise<string> {
  const openai = requireOpenAI();
  const webBlock = thirdPartyCorpus?.trim()
    ? `\n\n---\n\n## Third-party public research (Tavily discovery + optional page fetches)\n\n${thirdPartyCorpus.trim().slice(0, 48_000)}`
    : "";

  const { text } = await generateText({
    model: openai("gpt-4o-mini"),
    system: `You are a careful researcher. You write structured Markdown knowledge bases for downstream chatbots.

Source policy:
- **Primary authority:** the official-site crawl (on-domain pages from the organization's website). Treat it as the ground truth when facts conflict.
- **Supplementary:** when third-party research is provided, you may use it only as additional *public* context. Attribute claims to their URLs. If third-party sources disagree with the official site, prefer the official site and briefly note the conflict.
- If something is unknown from all provided material, say so in the document.

Organize with clear headings: Overview, Products and services, People and leadership, Locations and contact, Policies and legal (if present), Other public facts.
Include a short "Sources" section grouping **Official site** URLs vs **Third-party** URLs you relied on.`,
    prompt: `Company display name: ${companyName}
Official site (seed URL): ${sourceUrl}

## Official-site crawl (primary)

${officialSiteCorpus}
${webBlock}`,
  });
  return text.trim();
}

async function generateSystemPrompt(
  companyName: string,
  sourceUrl: string,
  knowledgeMarkdown: string,
): Promise<string> {
  const openai = requireOpenAI();
  const { text } = await generateText({
    model: openai("gpt-4o-mini"),
    system: `You write system prompts for knowledge-grounded AI assistants used on public pages. At runtime, the assistant will receive a Markdown knowledge base in a separate message. Your output must be instructions only (no knowledge text pasted in), concise (aim under ~800 words), and written in second person ("You are…") or imperative form addressed to the assistant.`,
    prompt: `Organization display name: ${companyName}
Official site (seed URL): ${sourceUrl}

The knowledge base is built from the official website plus optional third-party public pages (clearly cited there). The assistant will answer visitors using ONLY that knowledge base plus this system prompt. Write ONE cohesive system prompt for the assistant that:

1) Role and positioning
- Infer the type of organization, primary audiences (e.g. hotel guests, patients, buyers), and what they most likely need from chat.
- Give the assistant a specific, credible role title (e.g. digital concierge, visitor guide, patient services assistant, product specialist)—not a generic "Q&A bot" or "customer support" label unless that truly fits.
- Match tone to the vertical (warm for hospitality, calm and clear for healthcare, crisp for B2B SaaS, etc.) while staying professional.

2) Value-forward behaviors (still grounded)
- Encourage helpful patterns that showcase what chat can do when grounded: clarify services and policies in plain language; compare options that appear in the knowledge base; suggest sensible follow-up questions; help someone prepare for a visit, stay, or purchase using only facts from the knowledge base; offer step-by-step guidance only when each step is supported by the knowledge base.

3) Hard grounding, source priority, and honesty
- The assistant must not invent facts, prices, dates, availability, contacts, or policies. If something is missing or unclear in the knowledge base, it must say so and offer what it can from the knowledge base instead.
- When the knowledge base includes third-party URLs, treat them as secondary; if they conflict with the official site content, **follow the official site** and do not present third-party material as overriding the organization's own published information.
- It must not claim it can take real-world actions (charge cards, confirm reservations, access private accounts or medical records, submit forms on the user's behalf) unless the knowledge base explicitly describes that capability.

4) Safety by vertical
- For healthcare or medical-adjacent sites: informational and scheduling-oriented only—no diagnosis, no treatment recommendations, no interpreting symptoms as medical advice. Encourage appropriate professional care and emergency services when a reasonable reader could be facing an urgent medical situation.
- For financial or legal topics: provide general information from the knowledge base only; defer to qualified professionals when the knowledge base does not cover it.

5) Output rules for YOUR reply
- Output only the system prompt text the assistant will read—no preamble, no markdown code fences, no title like "System prompt:".
- Do not include the knowledge base content in your output.

Knowledge base (reference only, for inferring role and vertical):

${knowledgeMarkdown.slice(0, 12000)}`,
  });
  return text.trim();
}

async function generatePublicAgentDescription(
  companyName: string,
  sourceUrl: string,
  knowledgeMarkdown: string,
): Promise<string> {
  const openai = requireOpenAI();
  const { text } = await generateText({
    model: openai("gpt-4o-mini"),
    system: `You write short introductory copy for public websites. Output plain sentences only: no markdown, no title line, no bullets, no leading label like "Description:".`,
    prompt: `The visitor opened a public chat page for "${companyName}" (official site: ${sourceUrl}).

Write exactly 2 short sentences (under 320 characters total). Name the assistant's role and primary audience the same way you would for a tailored on-site guide (e.g. concierge for guests, guide for visitors)—inferred from the knowledge base. Explain what they can ask about. Friendly and professional.

The knowledge base may combine the organization's website with a small set of attributed third-party public pages when present. Do not imply live web browsing, bookings, medical advice, or access to private systems unless the knowledge base clearly supports it; when unsure, say answers are based on published information from the site (and cited public sources in the knowledge base).

Knowledge base:

${knowledgeMarkdown.slice(0, 8000)}`,
  });
  return text
    .trim()
    .replace(/^["']+|["']+$/g, "")
    .replace(/\s+/g, " ");
}

export async function runCompanyIngestion(companyId: string): Promise<void> {
  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) {
    logIngestEvent(companyId, "aborted_company_missing");
    return;
  }

  logIngestEvent(companyId, "run_begin", { slug: company.slug, sourceUrl: company.sourceUrl });

  try {
    await prisma.company.update({
      where: { id: companyId },
      data: {
        status: CompanyStatus.COLLECTING,
        progressStage: "Starting crawl",
        errorMessage: null,
      },
    });
    logIngestEvent(companyId, "status_collecting_written");

    logIngestEvent(companyId, "crawl_begin");
    await setProgressStage(companyId, "Crawling website");
    const pages = await crawlPublicSite(company.sourceUrl, companyId);
    logIngestEvent(companyId, "crawl_done", { pageCount: pages.length });
    const crawlCorpus = formatCorpus(pages);

    logIngestEvent(companyId, "web_research_begin");
    await setProgressStage(companyId, `Searching public sources (crawled ${pages.length} pages)`);
    const webResearch = await buildWebResearchCorpus({
      companyName: company.companyName,
      sourceUrl: company.sourceUrl,
      officialPageUrls: pages.map((p) => p.url),
    });
    logIngestEvent(companyId, "web_research_done", {
      corpusChars: webResearch.corpus?.length ?? 0,
      creditsUsed: webResearch.creditsUsed,
    });

    await prisma.company.update({
      where: { id: companyId },
      data: {
        status: CompanyStatus.GENERATING,
        crawlCorpus,
        webResearchCorpus: webResearch.corpus,
        progressStage: "Generating knowledge base",
      },
    });
    logIngestEvent(companyId, "status_generating_written");

    logIngestEvent(companyId, "knowledge_markdown_llm_begin");
    const knowledgeMarkdown = await generateKnowledgeMarkdown(
      company.companyName,
      company.sourceUrl,
      crawlCorpus,
      webResearch.corpus,
    );
    logIngestEvent(companyId, "knowledge_markdown_llm_done", {
      knowledgeChars: knowledgeMarkdown.length,
    });

    await setProgressStage(companyId, "Writing system prompt & intro");
    logIngestEvent(companyId, "llm_prompts_begin");
    const [systemPrompt, publicAgentDescription] = await Promise.all([
      generateSystemPrompt(company.companyName, company.sourceUrl, knowledgeMarkdown),
      generatePublicAgentDescription(company.companyName, company.sourceUrl, knowledgeMarkdown),
    ]);
    logIngestEvent(companyId, "llm_prompts_done");

    await prisma.company.update({
      where: { id: companyId },
      data: {
        status: CompanyStatus.READY,
        knowledgeMarkdown,
        systemPrompt,
        publicAgentDescription,
        progressStage: null,
        errorMessage: null,
      },
    });
    logIngestEvent(companyId, "status_ready_written");
    revalidatePath("/admin");
    revalidatePath(`/admin/companies/${company.slug}`);
    revalidatePath(`/c/${company.slug}`);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Ingestion failed.";
    logIngestEvent(companyId, "run_failed", { message });
    await prisma.company.update({
      where: { id: companyId },
      data: {
        status: CompanyStatus.FAILED,
        progressStage: null,
        errorMessage: message,
      },
    });
    revalidatePath("/admin");
    revalidatePath(`/admin/companies/${company.slug}`);
    revalidatePath(`/c/${company.slug}`);
  }
}
