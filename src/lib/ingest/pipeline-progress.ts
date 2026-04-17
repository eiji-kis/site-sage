import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";

/**
 * Short human-readable stage label shown in the admin UI while ingestion runs.
 * Separate module so both the pipeline and inner stages (crawl, research) can
 * import without a circular dep.
 */
export async function setProgressStage(companyId: string, stage: string | null): Promise<void> {
  try {
    await prisma.company.update({
      where: { id: companyId },
      data: { progressStage: stage },
    });
    revalidatePath("/admin");
  } catch {
    // Best-effort — progress writes must never abort ingestion.
  }
}
