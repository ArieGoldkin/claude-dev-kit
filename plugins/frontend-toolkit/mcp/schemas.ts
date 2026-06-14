import { z } from "zod";

export const DEVICE_TYPE_VALUES = ["MOBILE", "DESKTOP", "TABLET", "AGNOSTIC"] as const;
export type DeviceType = (typeof DEVICE_TYPE_VALUES)[number];

export const MODEL_ID_VALUES = ["GEMINI_3_PRO", "GEMINI_3_FLASH"] as const;
export type ModelIdType = "GEMINI_3_PRO" | "GEMINI_3_FLASH" | undefined;

export const CREATIVE_RANGE_VALUES = ["REFINE", "EXPLORE", "REIMAGINE"] as const;
export const ASPECT_VALUES = ["LAYOUT", "COLOR_SCHEME", "IMAGES", "TEXT_FONT", "TEXT_CONTENT"] as const;

export const DeviceTypeSchema = z
  .enum(DEVICE_TYPE_VALUES)
  .default("DESKTOP")
  .describe("Target device type for the generated design");

export const ModelIdSchema = z
  .enum(MODEL_ID_VALUES)
  .optional()
  .describe("Gemini model: GEMINI_3_PRO (higher quality) or GEMINI_3_FLASH (faster). Defaults to Flash.");

export const VariantOptionsSchema = z.object({
  variant_count: z.number().int().min(1).max(5).default(3).describe("Number of variants (1-5)"),
  creative_range: z.enum(CREATIVE_RANGE_VALUES).default("EXPLORE").describe("REFINE (tweaks), EXPLORE (moderate), REIMAGINE (radical)"),
  aspects: z.array(z.enum(ASPECT_VALUES)).min(1).max(10).describe("Which aspects to vary"),
});

export const PromptSchema = z
  .string()
  .min(3, "Prompt must be at least 3 characters")
  .describe("Text description of the desired UI design or changes");

export const ProjectIdSchema = z
  .string()
  .min(1, "Project ID is required")
  .describe("Stitch project ID — use stitch_list_projects to find valid IDs");

export const ScreenIdSchema = z
  .string()
  .min(1, "Screen ID is required")
  .describe("Stitch screen ID — use stitch_list_screens to find valid IDs");
