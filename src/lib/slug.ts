import slugify from "slugify";
import { prisma } from "@/lib/prisma";

export async function createUniqueCompanySlug(companyName: string): Promise<string> {
  const base = slugify(companyName, { lower: true, strict: true }) || "company";
  let slug = base;
  for (let n = 0; n < 500; n += 1) {
    const existing = await prisma.company.findUnique({ where: { slug } });
    if (!existing) {
      return slug;
    }
    slug = `${base}-${n + 1}`;
  }
  throw new Error("Could not allocate a unique slug.");
}
