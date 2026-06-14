import { describe, it, expect } from "vitest";
import {
  ProjectIdSchema,
  ScreenIdSchema,
  PromptSchema,
  DeviceTypeSchema,
  ModelIdSchema,
  VariantOptionsSchema,
} from "../schemas.js";

describe("ProjectIdSchema", () => {
  it("rejects empty string", () => {
    expect(ProjectIdSchema.safeParse("").success).toBe(false);
  });

  it("accepts valid string", () => {
    const result = ProjectIdSchema.safeParse("proj-123");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("proj-123");
  });
});

describe("ScreenIdSchema", () => {
  it("rejects empty string", () => {
    expect(ScreenIdSchema.safeParse("").success).toBe(false);
  });

  it("accepts valid string", () => {
    const result = ScreenIdSchema.safeParse("sc-456");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("sc-456");
  });
});

describe("PromptSchema", () => {
  it("rejects string shorter than 3 characters", () => {
    expect(PromptSchema.safeParse("ab").success).toBe(false);
  });

  it("accepts string with exactly 3 characters", () => {
    const result = PromptSchema.safeParse("abc");
    expect(result.success).toBe(true);
  });

  it("accepts long string", () => {
    const result = PromptSchema.safeParse("a".repeat(500));
    expect(result.success).toBe(true);
  });
});

describe("DeviceTypeSchema", () => {
  it("accepts MOBILE", () => {
    const result = DeviceTypeSchema.safeParse("MOBILE");
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("MOBILE");
  });

  it("accepts DESKTOP", () => {
    expect(DeviceTypeSchema.safeParse("DESKTOP").success).toBe(true);
  });

  it("accepts TABLET", () => {
    expect(DeviceTypeSchema.safeParse("TABLET").success).toBe(true);
  });

  it("accepts AGNOSTIC", () => {
    expect(DeviceTypeSchema.safeParse("AGNOSTIC").success).toBe(true);
  });

  it("rejects invalid value WATCH", () => {
    expect(DeviceTypeSchema.safeParse("WATCH").success).toBe(false);
  });

  it("defaults to DESKTOP when undefined", () => {
    const result = DeviceTypeSchema.safeParse(undefined);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe("DESKTOP");
  });
});

describe("ModelIdSchema", () => {
  it("accepts GEMINI_3_PRO", () => {
    expect(ModelIdSchema.safeParse("GEMINI_3_PRO").success).toBe(true);
  });

  it("accepts GEMINI_3_FLASH", () => {
    expect(ModelIdSchema.safeParse("GEMINI_3_FLASH").success).toBe(true);
  });

  it("rejects invalid value GPT4", () => {
    expect(ModelIdSchema.safeParse("GPT4").success).toBe(false);
  });

  it("accepts undefined (optional)", () => {
    const result = ModelIdSchema.safeParse(undefined);
    expect(result.success).toBe(true);
  });
});

describe("VariantOptionsSchema", () => {
  it("accepts valid full object", () => {
    const result = VariantOptionsSchema.safeParse({
      variant_count: 2,
      creative_range: "EXPLORE",
      aspects: ["LAYOUT"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects variant_count of 0 (min 1)", () => {
    const result = VariantOptionsSchema.safeParse({
      variant_count: 0,
      aspects: ["LAYOUT"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects variant_count of 6 (max 5)", () => {
    const result = VariantOptionsSchema.safeParse({
      variant_count: 6,
      aspects: ["LAYOUT"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects non-integer variant_count", () => {
    const result = VariantOptionsSchema.safeParse({
      variant_count: 3.5,
      aspects: ["LAYOUT"],
    });
    expect(result.success).toBe(false);
  });

  it("accepts creative_range REFINE", () => {
    const result = VariantOptionsSchema.safeParse({
      creative_range: "REFINE",
      aspects: ["LAYOUT"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects creative_range WILD", () => {
    const result = VariantOptionsSchema.safeParse({
      creative_range: "WILD",
      aspects: ["LAYOUT"],
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty aspects array (min 1)", () => {
    const result = VariantOptionsSchema.safeParse({
      aspects: [],
    });
    expect(result.success).toBe(false);
  });

  it("accepts valid aspects array", () => {
    const result = VariantOptionsSchema.safeParse({
      aspects: ["LAYOUT", "COLOR_SCHEME"],
    });
    expect(result.success).toBe(true);
  });

  it("rejects invalid aspect value", () => {
    const result = VariantOptionsSchema.safeParse({
      aspects: ["INVALID_ASPECT"],
    });
    expect(result.success).toBe(false);
  });

  it("defaults variant_count to 3 when missing", () => {
    const result = VariantOptionsSchema.safeParse({
      aspects: ["LAYOUT"],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.variant_count).toBe(3);
  });

  it("defaults creative_range to EXPLORE when missing", () => {
    const result = VariantOptionsSchema.safeParse({
      aspects: ["LAYOUT"],
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.creative_range).toBe("EXPLORE");
  });
});
