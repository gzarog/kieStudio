export type TaskStatus = "idle" | "pending" | "success" | "failed";

export interface ChatMessage { role: "user" | "assistant"; content: string }

export interface Track {
  id: string; audioUrl: string; imageUrl: string;
  title: string; tags: string; duration: number;
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
}

export const MODEL_CATALOG: CatalogModel[] = [
  // Chat (dedicated /chat/completions router — OpenAI-compatible)
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", provider: "Anthropic", category: "chat", capabilities: ["chat"], verified: true, dedicated: true },
  { id: "gpt-4o", label: "GPT-4o", provider: "OpenAI", category: "chat", capabilities: ["chat"], verified: true, dedicated: true },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "Google", category: "chat", capabilities: ["chat"], verified: true, dedicated: true },

  // Image (Unified Jobs API)
  { id: "gpt-image-2", label: "GPT Image 2", provider: "OpenAI", category: "image", capabilities: ["t2i"], verified: true, inputs: ["size"] },
  { id: "nano-banana", label: "Nano Banana", provider: "Google", category: "image", capabilities: ["t2i", "i2i"], verified: true, inputs: ["image"] },
  { id: "grok-imagine/text-to-image", label: "Grok Imagine (T2I)", provider: "xAI", category: "image", capabilities: ["t2i"], verified: true },
  { id: "grok-imagine/image-to-image", label: "Grok Imagine (I2I)", provider: "xAI", category: "image", capabilities: ["i2i"], verified: true, inputs: ["image"] },

  // Video (Unified Jobs API, except Veo which keeps its dedicated router)
  { id: "veo-3.1", label: "Veo 3.1", provider: "Google", category: "video", capabilities: ["t2v", "i2v"], verified: true, dedicated: true, inputs: ["resolution", "duration", "image"] },
  { id: "kling-3.0", label: "Kling 3.0", provider: "Kling", category: "video", capabilities: ["t2v"], verified: true, inputs: ["resolution", "duration"] },
  { id: "seedance-2.0", label: "Seedance 2.0", provider: "ByteDance", category: "video", capabilities: ["t2v"], verified: true, inputs: ["resolution", "duration"] },
  { id: "gemini-omni-video", label: "Gemini Omni Video", provider: "Google", category: "video", capabilities: ["t2v"], verified: true, inputs: ["duration"] },

  // Music (dedicated Suno /generate router)
  { id: "V5_5", label: "Suno V5.5", provider: "Suno", category: "music", capabilities: ["music"], verified: true, dedicated: true },
  { id: "V4_5", label: "Suno V4.5", provider: "Suno", category: "music", capabilities: ["music"], verified: true, dedicated: true },
];

/** All catalog models for a category, in catalog (curated) order. */
export function catalogByCategory(category: ModelCategory): CatalogModel[] {
  return MODEL_CATALOG.filter((m) => m.category === category);
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

/** The first model of a category — the sensible default selection. */
export function defaultModel(category: ModelCategory): string {
  return catalogByCategory(category)[0]?.id ?? "";
}
