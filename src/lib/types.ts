export type TaskStatus = "idle" | "pending" | "success" | "failed";

export interface ChatMessage { role: "user" | "assistant"; content: string }

export interface Track {
  id: string; audioUrl: string; imageUrl: string;
  title: string; tags: string; duration: number;
  /** The generation taskId this track came from — required by the studio actions
   *  (stems / WAV / timestamped lyrics all take { taskId, audioId }). */
  taskId?: string;
  /** Model that produced the track — Extend must use the same model. */
  model?: string;
}

// ── Model catalog ────────────────────────────────────────────────────────────
//
// A single source of truth for the model pickers. `id` is the exact value the
// frontend sends to the worker (a friendly key mapped in functions/api/_lib.ts,
// or an already-exact Jobs identifier that passes through untouched).
//
// `verified` = the identifier is confirmed against KIE-API-VERIFIED.md / the live
// docs. Entries that would require a live doc fetch to confirm are intentionally
// absent (docs.kie.ai is network-gated here) and tracked in the phase summary;
// adding one later is a single row in the arrays below.

export type ModelCategory = "chat" | "image" | "video" | "music";

export type Capability = "chat" | "t2i" | "i2i" | "edit" | "upscale" | "t2v" | "i2v" | "music";

/** UI hints for which extra controls a model's `input` accepts. */
export type InputHint = "size" | "resolution" | "duration" | "image" | "instrumental";

/**
 * The `input` field name a model expects its source image URL(s) under.
 * Verified per doc page — NOT uniform across providers:
 *   image_urls / image_input / input_urls / imageUrls take an ARRAY of URLs,
 *   image_url / image take a single URL string.
 */
export type ImageField =
  | "image_urls"
  | "image_url"
  | "image_input"
  | "input_urls"
  | "image"
  | "imageUrls";

const IMAGE_ARRAY_FIELDS: ReadonlySet<ImageField> = new Set([
  "image_urls",
  "image_input",
  "input_urls",
  "imageUrls",
]);

export interface CatalogModel {
  id: string;
  label: string;
  provider: string;
  category: ModelCategory;
  capabilities: Capability[];
  verified: boolean;
  /** Uses a dedicated router (Veo, Suno, Chat) rather than the Jobs API. */
  dedicated?: boolean;
  inputs?: InputHint[];
  /** Where the uploaded image URL goes in `input` (verified per doc page). */
  imageField?: ImageField;
  /** The model works without a text prompt (e.g. background removal). */
  promptOptional?: boolean;
}

// Every `id` below is either in KIE-API-VERIFIED.md or stated verbatim in the
// official docs index (llms.txt) description — never inferred from a URL path.
// Chat model identifiers are intentionally limited to the three already in
// production use: the docs index does not state chat `model` strings and the
// existing ids mix dashed/dotted forms, so the rest await the doc page bodies.
export const MODEL_CATALOG: CatalogModel[] = [
  // ── Chat (dedicated /chat/completions router — OpenAI-compatible) ──
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", provider: "Anthropic", category: "chat", capabilities: ["chat"], verified: true, dedicated: true },
  { id: "gpt-4o", label: "GPT-4o", provider: "OpenAI", category: "chat", capabilities: ["chat"], verified: true, dedicated: true },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "Google", category: "chat", capabilities: ["chat"], verified: true, dedicated: true },

  // ── Image (Unified Jobs API) ──
  { id: "gpt-image-2", label: "GPT Image 2", provider: "OpenAI", category: "image", capabilities: ["t2i"], verified: true, inputs: ["size"] },
  { id: "nano-banana", label: "Nano Banana Pro", provider: "Google", category: "image", capabilities: ["t2i", "i2i"], verified: true, inputs: ["image"], imageField: "image_input" },
  { id: "google/nano-banana", label: "Nano Banana", provider: "Google", category: "image", capabilities: ["t2i", "i2i"], verified: true, inputs: ["image"] },
  { id: "grok-imagine/text-to-image", label: "Grok Imagine (T2I)", provider: "xAI", category: "image", capabilities: ["t2i"], verified: true },
  { id: "grok-imagine/image-to-image", label: "Grok Imagine (I2I)", provider: "xAI", category: "image", capabilities: ["i2i"], verified: true, inputs: ["image"], imageField: "image_urls" },
  { id: "flux-2/flex-image-to-image", label: "Flux-2 Flex (I2I)", provider: "Flux", category: "image", capabilities: ["i2i"], verified: true, inputs: ["image"], imageField: "input_urls" },
  { id: "flux-2/pro-image-to-image", label: "Flux-2 Pro (I2I)", provider: "Flux", category: "image", capabilities: ["i2i"], verified: true, inputs: ["image"], imageField: "input_urls" },
  { id: "ideogram/v3-text-to-image", label: "Ideogram V3 (T2I)", provider: "Ideogram", category: "image", capabilities: ["t2i"], verified: true },
  { id: "ideogram/v3-edit", label: "Ideogram V3 Edit", provider: "Ideogram", category: "image", capabilities: ["edit"], verified: true, inputs: ["image"] },
  { id: "ideogram/v3-remix", label: "Ideogram V3 Remix", provider: "Ideogram", category: "image", capabilities: ["edit"], verified: true, inputs: ["image"] },
  { id: "ideogram/character", label: "Ideogram Character", provider: "Ideogram", category: "image", capabilities: ["t2i"], verified: true },
  { id: "ideogram/character-edit", label: "Ideogram Character Edit", provider: "Ideogram", category: "image", capabilities: ["edit"], verified: true, inputs: ["image"] },
  { id: "ideogram/character-remix", label: "Ideogram Character Remix", provider: "Ideogram", category: "image", capabilities: ["edit"], verified: true, inputs: ["image"] },
  { id: "qwen2/text-to-image", label: "Qwen2 (T2I)", provider: "Qwen", category: "image", capabilities: ["t2i"], verified: true },
  { id: "qwen2/image-edit", label: "Qwen2 Edit", provider: "Qwen", category: "image", capabilities: ["edit"], verified: true, inputs: ["image"], imageField: "image_url" },
  { id: "qwen/image-edit", label: "Qwen Edit", provider: "Qwen", category: "image", capabilities: ["edit"], verified: true, inputs: ["image"] },
  { id: "google/nano-banana-edit", label: "Nano Banana Edit", provider: "Google", category: "image", capabilities: ["edit", "i2i"], verified: true, inputs: ["image"], imageField: "image_urls" },
  { id: "seedream/4.5-edit", label: "Seedream 4.5 Edit", provider: "ByteDance", category: "image", capabilities: ["edit", "i2i"], verified: true, inputs: ["image"], imageField: "image_urls" },
  { id: "recraft/remove-background", label: "Recraft Remove BG", provider: "Recraft", category: "image", capabilities: ["edit"], verified: true, inputs: ["image"], imageField: "image", promptOptional: true },

  // ── Video (Unified Jobs API, except Veo which keeps its dedicated router) ──
  { id: "veo-3.1", label: "Veo 3.1", provider: "Google", category: "video", capabilities: ["t2v", "i2v"], verified: true, dedicated: true, inputs: ["resolution", "duration", "image"], imageField: "imageUrls" },
  { id: "kling-3.0", label: "Kling 3.0", provider: "Kling", category: "video", capabilities: ["t2v"], verified: true, inputs: ["resolution", "duration"] },
  { id: "seedance-2.0", label: "Seedance 2.0", provider: "ByteDance", category: "video", capabilities: ["t2v"], verified: true, inputs: ["resolution", "duration"] },
  { id: "kling-2.6/image-to-video", label: "Kling 2.6 (I2V)", provider: "Kling", category: "video", capabilities: ["i2v"], verified: true, inputs: ["duration", "image"], imageField: "image_urls" },
  { id: "gemini-omni-video", label: "Gemini Omni Video", provider: "Google", category: "video", capabilities: ["t2v"], verified: true, inputs: ["duration"] },
  { id: "bytedance/v1-pro-text-to-video", label: "ByteDance V1 Pro (T2V)", provider: "ByteDance", category: "video", capabilities: ["t2v"], verified: true },
  { id: "bytedance/v1-pro-image-to-video", label: "ByteDance V1 Pro (I2V)", provider: "ByteDance", category: "video", capabilities: ["i2v"], verified: true, inputs: ["image"], imageField: "image_url" },
  { id: "bytedance/v1-lite-text-to-video", label: "ByteDance V1 Lite (T2V)", provider: "ByteDance", category: "video", capabilities: ["t2v"], verified: true },
  { id: "bytedance/v1-lite-image-to-video", label: "ByteDance V1 Lite (I2V)", provider: "ByteDance", category: "video", capabilities: ["i2v"], verified: true, inputs: ["image"], imageField: "image_url" },
  { id: "hailuo/2-3-image-to-video-pro", label: "Hailuo 2.3 Pro (I2V)", provider: "Hailuo", category: "video", capabilities: ["i2v"], verified: true, inputs: ["image"], imageField: "image_url" },
  { id: "hailuo/2-3-image-to-video-standard", label: "Hailuo 2.3 Std (I2V)", provider: "Hailuo", category: "video", capabilities: ["i2v"], verified: true, inputs: ["image"] },
  { id: "hailuo/02-text-to-video-pro", label: "Hailuo 02 Pro (T2V)", provider: "Hailuo", category: "video", capabilities: ["t2v"], verified: true },
  { id: "hailuo/02-text-to-video-standard", label: "Hailuo 02 Std (T2V)", provider: "Hailuo", category: "video", capabilities: ["t2v"], verified: true },
  { id: "hailuo/02-image-to-video-pro", label: "Hailuo 02 Pro (I2V)", provider: "Hailuo", category: "video", capabilities: ["i2v"], verified: true, inputs: ["image"] },
  { id: "hailuo/02-image-to-video-standard", label: "Hailuo 02 Std (I2V)", provider: "Hailuo", category: "video", capabilities: ["i2v"], verified: true, inputs: ["image"] },
  { id: "wan/2-5-text-to-video", label: "Wan 2.5 (T2V)", provider: "Wan", category: "video", capabilities: ["t2v"], verified: true },
  { id: "wan/2-5-image-to-video", label: "Wan 2.5 (I2V)", provider: "Wan", category: "video", capabilities: ["i2v"], verified: true, inputs: ["image"], imageField: "image_url" },

  // ── Music (dedicated Suno /generate router) ──
  { id: "V5_5", label: "Suno V5.5", provider: "Suno", category: "music", capabilities: ["music"], verified: true, dedicated: true },
  { id: "V4_5", label: "Suno V4.5", provider: "Suno", category: "music", capabilities: ["music"], verified: true, dedicated: true },
];

/**
 * Catalog models for a category, in curated order. Pass `capability` to keep
 * only models that advertise it (e.g. "t2i" to hide edit/i2i models from a
 * text-to-image picker until the image-upload flow wires them in Phase 3).
 */
export function catalogByCategory(category: ModelCategory, capability?: Capability): CatalogModel[] {
  return MODEL_CATALOG.filter(
    (m) => m.category === category && (!capability || m.capabilities.includes(capability))
  );
}

/** Look up a single model by its exact id. */
export function catalogModel(id: string): CatalogModel | undefined {
  return MODEL_CATALOG.find((m) => m.id === id);
}

/** Group a list of models by provider, preserving first-seen order. */
export function groupByProvider(models: CatalogModel[]): [string, CatalogModel[]][] {
  const groups = new Map<string, CatalogModel[]>();
  for (const m of models) {
    const list = groups.get(m.provider) ?? [];
    list.push(m);
    groups.set(m.provider, list);
  }
  return [...groups.entries()];
}

/** Models of a category that can take an uploaded source image (i2i / i2v / edit). */
export function imageCapableModels(category: ModelCategory): CatalogModel[] {
  return catalogByCategory(category).filter((m) => m.imageField);
}

/**
 * Build the model-specific `input` fragment carrying an uploaded image URL —
 * array vs single-string per the verified doc pages.
 */
export function imageInputFor(modelId: string, url: string): Record<string, unknown> {
  const field = catalogModel(modelId)?.imageField;
  if (!field) return {};
  return { [field]: IMAGE_ARRAY_FIELDS.has(field) ? [url] : url };
}

/** The first model of a category — the sensible default selection. */
export function defaultModel(category: ModelCategory): string {
  return catalogByCategory(category)[0]?.id ?? "";
}
