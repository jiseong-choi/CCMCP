import { z } from "zod";

export const courtStyleSchema = z.enum(["judge", "prosecutor", "defense"]).optional();
export const courtLanguageSchema = z.enum(["en", "ko"]).optional();

export const courtInputSchema = z.object({
  subject: z.string().min(1),
  body: z.string().optional(),
  diff: z.string().min(1),
  pr_body: z.string().optional(),
  style: courtStyleSchema,
  language: courtLanguageSchema
});

export const toolInputShape = {
  subject: z.string().min(1).describe("Commit subject line to put on trial."),
  body: z.string().optional().describe("Optional commit body."),
  diff: z.string().min(1).describe("Unified diff or patch text."),
  pr_body: z.string().optional().describe("Optional PR description."),
  style: z.enum(["judge", "prosecutor", "defense"]).optional().describe("Courtroom voice preset."),
  language: z.enum(["en", "ko"]).optional().describe("Rendered verdict language.")
};
