import { describe, it, expect } from "vitest";
import {
  MODEL_CATALOG,
  catalogByCategory,
  catalogModel,
  groupByProvider,
  defaultModel,
} from "../../src/lib/types";

describe("model catalog", () => {
  it("every entry has a non-empty id, label and provider", () => {
    for (const m of MODEL_CATALOG) {
      expect(m.id).toBeTruthy();
      expect(m.label).toBeTruthy();
      expect(m.provider).toBeTruthy();
      expect(m.capabilities.length).toBeGreaterThan(0);
    }
  });

  it("has unique ids", () => {
    const ids = MODEL_CATALOG.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("catalogByCategory returns only that category, in order", () => {
    const image = catalogByCategory("image");
    expect(image.length).toBeGreaterThan(0);
    expect(image.every((m) => m.category === "image")).toBe(true);
    expect(image[0].id).toBe("gpt-image-2");
  });

  it("catalogModel looks up by exact id", () => {
    expect(catalogModel("kling-3.0")?.label).toBe("Kling 3.0");
    expect(catalogModel("nope")).toBeUndefined();
  });

  it("only carries verified identifiers (unverified rows are omitted until docs confirm them)", () => {
    expect(MODEL_CATALOG.every((m) => m.verified)).toBe(true);
  });

  it("maps the verified defaults per category", () => {
    expect(defaultModel("chat")).toBe("claude-sonnet-4-6");
    expect(defaultModel("image")).toBe("gpt-image-2");
    expect(defaultModel("video")).toBe("veo-3.1");
    // Phase 2: Suno V5.5 is the music default.
    expect(defaultModel("music")).toBe("V5_5");
  });

  it("groupByProvider preserves first-seen order and groups members", () => {
    const groups = groupByProvider(catalogByCategory("video"));
    const providers = groups.map(([p]) => p);
    expect(providers[0]).toBe("Google"); // Veo 3.1 is first video entry
    const google = groups.find(([p]) => p === "Google")?.[1] ?? [];
    expect(google.map((m) => m.id)).toContain("gemini-omni-video");
  });

  it("keeps Veo and the chat/Suno models on dedicated routers", () => {
    expect(catalogModel("veo-3.1")?.dedicated).toBe(true);
    expect(catalogModel("claude-sonnet-4-6")?.dedicated).toBe(true);
    expect(catalogModel("V5_5")?.dedicated).toBe(true);
    // Jobs API models are not flagged dedicated.
    expect(catalogModel("kling-3.0")?.dedicated).toBeUndefined();
  });
});
