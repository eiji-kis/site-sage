import { z } from "zod";

export const createCompanySchema = z.object({
  companyName: z.string().trim().min(1, "Company name is required").max(200),
  sourceUrl: z.string().trim().url("Enter a valid URL"),
});

export type CreateCompanyInput = z.infer<typeof createCompanySchema>;

export const deleteCompanySchema = z.object({
  companyId: z.string().cuid("Invalid company."),
});

export type DeleteCompanyInput = z.infer<typeof deleteCompanySchema>;
