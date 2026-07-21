import { describe, it, expect } from "vitest";
import {
  MODEL_CATALOG,
  catalogByCategory,
  catalogModel,
  groupByProvider,
  defaultModel,
  imageCapableModels,
  imageInputFor,
  videoCapableModels,
  videoInputFor,
  optionDefaults,
  optionInputFor,
  sunoLimits,
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

  it("filters a category by capability", () => {
    const t2i = catalogByCategory("image", "t2i");
    expect(t2i.length).toBeGreaterThan(0);
    expect(t2i.every((m) => m.capabilities.includes("t2i"))).toBe(true);
    // an edit-only model is excluded from the t2i view
    expect(t2i.find((m) => m.id === "ideogram/v3-edit")).toBeUndefined();
    // but present in the unfiltered view
    expect(catalogByCategory("image").find((m) => m.id === "ideogram/v3-edit")).toBeDefined();
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
    // Phase 5: ElevenLabs Turbo 2.5 is the speech default (Jobs API).
    expect(defaultModel("speech")).toBe("elevenlabs/text-to-speech-turbo-2-5");
  });

  it("speech models ride the generic Jobs proxy (not dedicated)", () => {
    const speech = catalogByCategory("speech");
    expect(speech.length).toBe(3); // Phase 4 adds Dialogue V3
    expect(speech.every((m) => !m.dedicated && m.capabilities.includes("tts"))).toBe(true);
  });

  it("groupByProvider preserves first-seen order and groups members", () => {
    const groups = groupByProvider(catalogByCategory("video"));
    const providers = groups.map(([p]) => p);
    expect(providers[0]).toBe("Google"); // Veo 3.1 is first video entry
    const google = groups.find(([p]) => p === "Google")?.[1] ?? [];
    expect(google.map((m) => m.id)).toContain("gemini-omni-video");
  });

  it("imageCapableModels returns only models with a verified imageField", () => {
    const image = imageCapableModels("image");
    expect(image.length).toBeGreaterThan(0);
    expect(image.every((m) => m.imageField)).toBe(true);
    expect(image.find((m) => m.id === "ideogram/v3-edit")).toBeDefined();
    const video = imageCapableModels("video");
    expect(video.map((m) => m.id)).toContain("kling-2.6/image-to-video");
  });

  it("imageInputFor uses the verified per-model field name and shape", () => {
    // array-shaped fields
    expect(imageInputFor("google/nano-banana-edit", "u")).toEqual({ image_urls: ["u"] });
    expect(imageInputFor("nano-banana", "u")).toEqual({ image_input: ["u"] });
    expect(imageInputFor("flux-2/pro-image-to-image", "u")).toEqual({ input_urls: ["u"] });
    expect(imageInputFor("veo-3.1", "u")).toEqual({ imageUrls: ["u"] });
    // single-string fields
    expect(imageInputFor("qwen2/image-edit", "u")).toEqual({ image_url: "u" });
    expect(imageInputFor("recraft/remove-background", "u")).toEqual({ image: "u" });
    expect(imageInputFor("wan/2-5-image-to-video", "u")).toEqual({ image_url: "u" });
    // unknown model → no image fragment
    expect(imageInputFor("nope", "u")).toEqual({});
  });

  it("keeps Veo and the chat/Suno models on dedicated routers", () => {
    expect(catalogModel("veo-3.1")?.dedicated).toBe(true);
    expect(catalogModel("claude-sonnet-4-6")?.dedicated).toBe(true);
    expect(catalogModel("V5_5")?.dedicated).toBe(true);
    // Jobs API models are not flagged dedicated.
    expect(catalogModel("kling-3.0")?.dedicated).toBeUndefined();
  });
});

describe("Phase 1 — image catalog expansion", () => {
  // Ids/labels/fields copied verbatim from each model's docs.kie.ai page.
  const NEW_T2I = [
    "bytedance/seedream-v4-text-to-image",
    "seedream/4.5-text-to-image",
    "seedream/5-lite-text-to-image",
    "seedream/5-pro-text-to-image",
    "google/imagen4",
    "google/imagen4-fast",
    "google/imagen4-ultra",
    "nano-banana-2",
    "flux-2/pro-text-to-image",
    "flux-2/flex-text-to-image",
    "gpt-image/1.5-text-to-image",
    "qwen/text-to-image",
    "z-image",
  ];

  it("adds every new text-to-image model to the t2i picker", () => {
    const t2i = catalogByCategory("image", "t2i").map((m) => m.id);
    for (const id of NEW_T2I) expect(t2i).toContain(id);
  });

  it("preserves the exact (dotted / prefixed) model strings from the docs", () => {
    // These deliberately do NOT match their URL slug — dots vs dashes, provider prefix.
    expect(catalogModel("seedream/4.5-text-to-image")).toBeDefined();
    expect(catalogModel("gpt-image/1.5-text-to-image")).toBeDefined();
    expect(catalogModel("gpt-image/1.5-image-to-image")).toBeDefined();
    expect(catalogModel("bytedance/seedream-v4-text-to-image")).toBeDefined();
    expect(catalogModel("bytedance/seedream-v4-edit")).toBeDefined();
    // no accidental slug-shaped duplicates
    expect(catalogModel("seedream/4-5-text-to-image")).toBeUndefined();
    expect(catalogModel("gpt-image/1-5-text-to-image")).toBeUndefined();
  });

  it("wires each new image-to-image model's verified input field + shape", () => {
    // array-shaped `image_urls`
    expect(imageInputFor("bytedance/seedream-v4-edit", "u")).toEqual({ image_urls: ["u"] });
    expect(imageInputFor("seedream/5-lite-image-to-image", "u")).toEqual({ image_urls: ["u"] });
    expect(imageInputFor("seedream/5-pro-image-to-image", "u")).toEqual({ image_urls: ["u"] });
    // array-shaped `input_urls`
    expect(imageInputFor("gpt-image-2-image-to-image", "u")).toEqual({ input_urls: ["u"] });
    expect(imageInputFor("gpt-image/1.5-image-to-image", "u")).toEqual({ input_urls: ["u"] });
    expect(imageInputFor("wan/2-7-image", "u")).toEqual({ input_urls: ["u"] });
    // array-shaped `image_input`
    expect(imageInputFor("nano-banana-2", "u")).toEqual({ image_input: ["u"] });
    // single-string `image_url`
    expect(imageInputFor("qwen/image-to-image", "u")).toEqual({ image_url: "u" });
  });

  it("exposes new i2i / edit models in the require-image (edit) picker", () => {
    const editable = imageCapableModels("image").map((m) => m.id);
    for (const id of [
      "bytedance/seedream-v4-edit",
      "seedream/5-lite-image-to-image",
      "gpt-image-2-image-to-image",
      "qwen/image-to-image",
      "nano-banana-2",
      "wan/2-7-image",
    ]) {
      expect(editable).toContain(id);
    }
  });

  it("adds the Recraft crisp upscaler as a prompt-optional, image-in edit model", () => {
    const m = catalogModel("recraft/crisp-upscale");
    expect(m?.capabilities).toContain("upscale");
    expect(m?.promptOptional).toBe(true);
    expect(imageInputFor("recraft/crisp-upscale", "u")).toEqual({ image: "u" });
  });

  it("does not regress the image defaults (gpt-image-2 stays first / default)", () => {
    expect(catalogByCategory("image")[0].id).toBe("gpt-image-2");
    expect(defaultModel("image")).toBe("gpt-image-2");
  });

  it("keeps every catalog id unique after the expansion", () => {
    const ids = MODEL_CATALOG.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("Phase 2 — video catalog expansion", () => {
  // Ids/labels/fields copied verbatim from each model's docs.kie.ai page.
  const NEW_T2V = [
    "kling-2.6/text-to-video",
    "kling/v3-turbo-text-to-video",
    "kling/v2-5-turbo-text-to-video-pro",
    "kling/v2-1-master-text-to-video",
    "wan/2-6-text-to-video",
    "wan/2-7-text-to-video",
    "grok-imagine/text-to-video",
    "bytedance/seedance-2-fast",
    "happyhorse/text-to-video",
    "happyhorse-1-1/text-to-video",
  ];

  it("adds every new text-to-video model to the t2v picker", () => {
    const t2v = catalogByCategory("video", "t2v").map((m) => m.id);
    for (const id of NEW_T2V) expect(t2v).toContain(id);
  });

  it("preserves the exact (dotted / re-versioned) model strings from the docs", () => {
    // slug says v25-turbo / seedance-1-5, but the real model strings differ.
    expect(catalogModel("kling/v2-5-turbo-image-to-video-pro")).toBeDefined();
    expect(catalogModel("bytedance/seedance-1.5-pro")).toBeDefined();
    // the base kling/text-to-video slug is really versioned kling-2.6/text-to-video
    expect(catalogModel("kling-2.6/text-to-video")).toBeDefined();
    // no slug-shaped ghosts
    expect(catalogModel("kling/v25-turbo-image-to-video-pro")).toBeUndefined();
    expect(catalogModel("bytedance/seedance-1-5-pro")).toBeUndefined();
  });

  it("wires each new image-to-video model's verified input field + shape", () => {
    // array-shaped
    expect(imageInputFor("kling/v3-turbo-image-to-video", "u")).toEqual({ image_urls: ["u"] });
    expect(imageInputFor("grok-imagine/image-to-video", "u")).toEqual({ image_urls: ["u"] });
    expect(imageInputFor("wan/2-6-image-to-video", "u")).toEqual({ image_urls: ["u"] });
    expect(imageInputFor("wan/2-6-flash-image-to-video", "u")).toEqual({ image_urls: ["u"] });
    expect(imageInputFor("happyhorse-1-1/image-to-video", "u")).toEqual({ image_urls: ["u"] });
    expect(imageInputFor("bytedance/seedance-1.5-pro", "u")).toEqual({ input_urls: ["u"] });
    // single-string
    expect(imageInputFor("kling/v2-5-turbo-image-to-video-pro", "u")).toEqual({ image_url: "u" });
    expect(imageInputFor("kling/v2-1-pro", "u")).toEqual({ image_url: "u" });
    expect(imageInputFor("kling/v2-1-standard", "u")).toEqual({ image_url: "u" });
    expect(imageInputFor("bytedance/v1-pro-fast-image-to-video", "u")).toEqual({ image_url: "u" });
  });

  it("exposes new i2v models in the require-image (i2v) picker", () => {
    const i2v = imageCapableModels("video").map((m) => m.id);
    for (const id of [
      "kling/v3-turbo-image-to-video",
      "kling/v2-1-pro",
      "grok-imagine/image-to-video",
      "wan/2-6-image-to-video",
      "bytedance/seedance-1.5-pro",
    ]) {
      expect(i2v).toContain(id);
    }
  });

  it("lists Seedance 1.5 Pro in BOTH the t2v and i2v pickers", () => {
    expect(catalogByCategory("video", "t2v").map((m) => m.id)).toContain("bytedance/seedance-1.5-pro");
    expect(imageCapableModels("video").map((m) => m.id)).toContain("bytedance/seedance-1.5-pro");
  });

  it("does not regress the video defaults (Veo 3.1 stays first / default)", () => {
    expect(catalogByCategory("video")[0].id).toBe("veo-3.1");
    expect(defaultModel("video")).toBe("veo-3.1");
    expect(groupByProvider(catalogByCategory("video")).map(([p]) => p)[0]).toBe("Google");
  });
});

describe("Phase 3 — video/audio-input catalog expansion", () => {
  it("adds first_frame_url i2v models to the require-image picker with single-string shape", () => {
    const i2v = imageCapableModels("video").map((m) => m.id);
    for (const id of ["wan/2-7-image-to-video", "bytedance/seedance-2-fast", "bytedance/seedance-2-mini"]) {
      expect(i2v).toContain(id);
    }
    expect(imageInputFor("wan/2-7-image-to-video", "u")).toEqual({ first_frame_url: "u" });
    expect(imageInputFor("bytedance/seedance-2-mini", "u")).toEqual({ first_frame_url: "u" });
  });

  it("upgrades Seedance 2.0 Fast to also serve i2v (t2v + first_frame_url)", () => {
    const m = catalogModel("bytedance/seedance-2-fast");
    expect(m?.capabilities).toEqual(expect.arrayContaining(["t2v", "i2v"]));
    expect(m?.imageField).toBe("first_frame_url");
  });

  it("wires each video-to-video model's verified source-video field + shape", () => {
    // array-shaped video_urls
    expect(videoInputFor("wan/2-6-video-to-video", "u")).toEqual({ video_urls: ["u"] });
    expect(videoInputFor("wan/2-6-flash-video-to-video", "u")).toEqual({ video_urls: ["u"] });
    // single-string video_url
    expect(videoInputFor("wan/2-7-videoedit", "u")).toEqual({ video_url: "u" });
    expect(videoInputFor("topaz/video-upscale", "u")).toEqual({ video_url: "u" });
    // a model without a videoField yields no fragment
    expect(videoInputFor("veo-3.1", "u")).toEqual({});
    expect(videoInputFor("nope", "u")).toEqual({});
  });

  it("videoCapableModels lists exactly the models carrying a videoField", () => {
    const v2v = videoCapableModels("video").map((m) => m.id);
    expect(v2v).toEqual([
      "wan/2-6-video-to-video",
      "wan/2-6-flash-video-to-video",
      "wan/2-7-videoedit",
      "topaz/video-upscale",
    ]);
    // no image-only model leaks into the video-input picker
    expect(v2v).not.toContain("veo-3.1");
  });

  it("marks video-edit / upscale models prompt-optional", () => {
    expect(catalogModel("wan/2-7-videoedit")?.promptOptional).toBe(true);
    expect(catalogModel("topaz/video-upscale")?.promptOptional).toBe(true);
    // wan v2v requires a prompt per its doc
    expect(catalogModel("wan/2-6-video-to-video")?.promptOptional).toBeUndefined();
  });

  it("keeps every catalog id unique after all three expansions", () => {
    const ids = MODEL_CATALOG.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("Phase 7 — verified per-model video options", () => {
  const videoModels = catalogByCategory("video");

  it("every i2v-capable video model carries an imageField (no unreachable entries)", () => {
    for (const m of videoModels.filter((m) => m.capabilities.includes("i2v"))) {
      expect(m.imageField, `${m.id} is i2v but has no imageField`).toBeTruthy();
    }
  });

  it("every v2v-capable video model carries a videoField", () => {
    for (const m of videoModels.filter((m) => m.capabilities.includes("v2v"))) {
      expect(m.videoField, `${m.id} is v2v but has no videoField`).toBeTruthy();
    }
  });

  it("option enums are non-empty, include their default, and never collide with source/prompt fields", () => {
    for (const m of videoModels) {
      for (const o of m.options ?? []) {
        expect(o.values.length, `${m.id}.${o.field}`).toBeGreaterThan(0);
        expect(o.values, `${m.id}.${o.field} default`).toContain(o.default);
        expect(["prompt", m.imageField, m.videoField]).not.toContain(o.field);
      }
    }
  });

  it("optionInputFor preserves the documented value types (string vs number enums)", () => {
    // Hailuo documents duration as a STRING enum…
    expect(optionInputFor("hailuo/02-image-to-video-standard")).toEqual({
      duration: "10",
      resolution: "768P",
    });
    // …Seedance as a NUMBER (a "5" select value must come back as 5).
    expect(optionInputFor("seedance-2.0", { duration: "10", resolution: "1080p" })).toEqual({
      duration: 10,
      resolution: "1080p",
      aspect_ratio: "16:9",
    });
  });

  it("merges the API-required constants (fixedInput) into the option fragment", () => {
    expect(optionInputFor("kling-3.0")).toEqual({
      multi_shots: false,
      sound: false,
      duration: "5",
      mode: "std",
      aspect_ratio: "16:9",
    });
    expect(optionInputFor("wan/2-6-flash-image-to-video").audio).toBe(false);
  });

  it("optionDefaults exposes select-friendly string defaults", () => {
    expect(optionDefaults("veo-3.1")).toEqual({
      aspect_ratio: "16:9",
      resolution: "720p",
      duration: "8",
    });
    expect(optionDefaults("hailuo/02-text-to-video-pro")).toEqual({});
  });

  it("restores the three Hailuo I2V models to the picker via their doc-verified image_url", () => {
    const i2v = imageCapableModels("video").map((m) => m.id);
    for (const id of [
      "hailuo/2-3-image-to-video-standard",
      "hailuo/02-image-to-video-pro",
      "hailuo/02-image-to-video-standard",
    ]) {
      expect(i2v).toContain(id);
      expect(imageInputFor(id, "u")).toEqual({ image_url: "u" });
    }
  });

  it("drops the dead ByteDance V1 Pro/Lite entries (upstream server exception)", () => {
    for (const id of [
      "bytedance/v1-pro-text-to-video",
      "bytedance/v1-pro-image-to-video",
      "bytedance/v1-lite-text-to-video",
      "bytedance/v1-lite-image-to-video",
    ]) {
      expect(catalogModel(id), id).toBeUndefined();
    }
    // The fast i2v variant is alive and stays.
    expect(catalogModel("bytedance/v1-pro-fast-image-to-video")).toBeDefined();
  });

  it("marks Topaz as promptless and keeps both Veo tiers on the dedicated router", () => {
    expect(catalogModel("topaz/video-upscale")?.noPrompt).toBe(true);
    expect(catalogModel("veo-3.1")?.dedicated).toBe(true);
    expect(catalogModel("veo3")?.dedicated).toBe(true);
  });
});

describe("Phase 4 — speech catalog expansion", () => {
  it("adds ElevenLabs Dialogue V3 as a Jobs-proxy TTS model", () => {
    const m = catalogModel("elevenlabs/text-to-dialogue-v3");
    expect(m?.category).toBe("speech");
    expect(m?.capabilities).toContain("tts");
    expect(m?.dedicated).toBeUndefined();
  });

  it("keeps the speech default on Turbo 2.5 (Dialogue V3 is appended)", () => {
    expect(defaultModel("speech")).toBe("elevenlabs/text-to-speech-turbo-2-5");
    expect(catalogByCategory("speech").map((m) => m.id)).toContain("elevenlabs/text-to-dialogue-v3");
  });
});

describe("Phase 5 — chat catalog expansion", () => {
  const NEW_CHAT = [
    "claude-opus-4-8",
    "claude-opus-4-7",
    "claude-opus-4-6",
    "claude-opus-4-5",
    "claude-sonnet-5",
    "claude-sonnet-4-5",
    "claude-haiku-4-5",
    "claude-fable-5",
    "gpt-5-5",
    "gpt-5-4",
    "gpt-5-2",
    "gpt-5-codex",
    "gemini-3-pro",
    "gemini-3-1-pro",
    "gemini-3-flash",
    "gemini-3-5-flash",
    "gemini-2-5-flash",
    "grok-4-5",
    "grok-4-3",
  ];

  it("adds every new chat model as a verified, dedicated-router entry", () => {
    for (const id of NEW_CHAT) {
      const m = catalogModel(id);
      expect(m, id).toBeDefined();
      expect(m!.category).toBe("chat");
      expect(m!.dedicated).toBe(true);
      expect(m!.capabilities).toEqual(["chat"]);
    }
  });

  it("uses the corrected (dashed, typo-fixed) chat ids from the doc bodies", () => {
    // slug typos "cluade-*" resolve to real "claude-*" strings
    expect(catalogModel("claude-fable-5")).toBeDefined();
    expect(catalogModel("claude-sonnet-5")).toBeDefined();
    expect(catalogModel("cluade-fable-5")).toBeUndefined();
    expect(catalogModel("cluade-sonnet-5")).toBeUndefined();
  });

  it("keeps Claude Sonnet 4.6 the chat default (new models are appended)", () => {
    expect(defaultModel("chat")).toBe("claude-sonnet-4-6");
    expect(catalogByCategory("chat")[0].id).toBe("claude-sonnet-4-6");
  });

  it("groups the new chat provider (xAI / Grok) alongside the existing ones", () => {
    const providers = groupByProvider(catalogByCategory("chat")).map(([p]) => p);
    expect(providers).toContain("xAI");
    expect(providers[0]).toBe("Anthropic"); // Claude Sonnet 4.6 still first
  });

  it("keeps every catalog id unique after all expansions", () => {
    const ids = MODEL_CATALOG.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("Phase 6 — music catalog expansion + char limits", () => {
  // The exact `model` values Suno's /generate accepts (verified on the doc page).
  const NEW_MUSIC = ["V5", "V4_5PLUS", "V4_5ALL", "V4"];

  it("adds every new Suno model as a verified, dedicated music entry", () => {
    for (const id of NEW_MUSIC) {
      const m = catalogModel(id);
      expect(m, id).toBeDefined();
      expect(m!.category).toBe("music");
      expect(m!.dedicated).toBe(true);
      expect(m!.capabilities).toEqual(["music"]);
    }
  });

  it("keeps Suno V5.5 first / the music default (new models are appended around it)", () => {
    expect(catalogByCategory("music")[0].id).toBe("V5_5");
    expect(defaultModel("music")).toBe("V5_5");
  });

  it("lists the full six-model Suno lineup in curated order", () => {
    expect(catalogByCategory("music").map((m) => m.id)).toEqual([
      "V5_5", "V5", "V4_5PLUS", "V4_5ALL", "V4_5", "V4",
    ]);
  });

  it("sunoLimits: V4 is the tightest, later models allow the larger caps", () => {
    expect(sunoLimits("V4")).toEqual({ prompt: 3000, style: 200, title: 80, nonCustomPrompt: 500 });
    for (const id of ["V5_5", "V5", "V4_5PLUS", "V4_5ALL", "V4_5"])
      expect(sunoLimits(id)).toEqual({ prompt: 5000, style: 1000, title: 100, nonCustomPrompt: 500 });
  });

  it("keeps every catalog id unique after the music expansion", () => {
    const ids = MODEL_CATALOG.map((m) => m.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
