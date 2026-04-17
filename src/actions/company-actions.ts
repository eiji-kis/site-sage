"use server";

import { after } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { runCompanyIngestion } from "@/lib/ingest/pipeline";
import { createUniqueCompanySlug } from "@/lib/slug";
import { createCompanySchema, deleteCompanySchema } from "@/lib/validations/company";

export type CreateCompanyState =
  | { ok: true; slug: string }
  | { ok: false; message: string }
  | null;

export async function createCompanyAndStartIngestion(
  _prev: CreateCompanyState,
  formData: FormData,
): Promise<CreateCompanyState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, message: "You must be signed in." };
  }

  const parsed = createCompanySchema.safeParse({
    companyName: formData.get("companyName"),
    sourceUrl: formData.get("sourceUrl"),
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid input.";
    return { ok: false, message: first };
  }

  const slug = await createUniqueCompanySlug(parsed.data.companyName);
  const company = await prisma.company.create({
    data: {
      slug,
      companyName: parsed.data.companyName,
      sourceUrl: parsed.data.sourceUrl,
    },
  });

  after(() => {
    void runCompanyIngestion(company.id);
  });

  revalidatePath("/admin");
  return { ok: true, slug: company.slug };
}

export type DeleteCompanyState =
  | { ok: true }
  | { ok: false; message: string }
  | null;

export async function deleteCompany(
  _prev: DeleteCompanyState,
  formData: FormData,
): Promise<DeleteCompanyState> {
  const session = await auth();
  if (!session?.user?.id) {
    return { ok: false, message: "You must be signed in." };
  }

  const parsed = deleteCompanySchema.safeParse({
    companyId: formData.get("companyId"),
  });
  if (!parsed.success) {
    const first = parsed.error.issues[0]?.message ?? "Invalid input.";
    return { ok: false, message: first };
  }

  const existing = await prisma.company.findUnique({
    where: { id: parsed.data.companyId },
    select: { slug: true },
  });
  if (!existing) {
    return { ok: false, message: "Company not found." };
  }

  await prisma.company.delete({ where: { id: parsed.data.companyId } });

  revalidatePath("/admin");
  revalidatePath(`/admin/companies/${existing.slug}`);
  revalidatePath(`/c/${existing.slug}`);

  return { ok: true };
}
