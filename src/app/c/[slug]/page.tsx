import { notFound } from "next/navigation";
import { CompanyChat } from "@/components/chat/company-chat";
import { BrandEyebrow } from "@/components/marketing/brand-eyebrow";
import { PublicLeadCta } from "@/components/marketing/public-lead-cta";
import { prisma } from "@/lib/prisma";

type PageProps = { params: Promise<{ slug: string }> };

export default async function PublicCompanyChatPage(props: PageProps) {
  const { slug } = await props.params;
  const company = await prisma.company.findFirst({
    where: { slug, status: "READY" },
    select: { slug: true, companyName: true, publicAgentDescription: true },
  });

  if (!company) {
    notFound();
  }

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 px-4 py-10">
      <div className="flex flex-col gap-2">
        <BrandEyebrow text="Public chat" />
        <h1 className="text-balance text-2xl font-semibold tracking-tight md:text-3xl">
          <span className="text-gradient-brand">{company.companyName}</span>
        </h1>
        <p className="text-pretty text-sm leading-relaxed text-muted-foreground">
          {company.publicAgentDescription?.trim()
            ? company.publicAgentDescription
            : "This assistant answers from a curated knowledge base for this company."}
        </p>
      </div>
      <div className="flex flex-col gap-3">
        <CompanyChat
          slug={company.slug}
          companyName={company.companyName}
          publicAgentDescription={company.publicAgentDescription}
        />
        <PublicLeadCta slug={company.slug} companyName={company.companyName} />
      </div>
    </div>
  );
}
