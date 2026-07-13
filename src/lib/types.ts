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
  /** When the track landed in history — drives the 14-day expiry badge. */
  createdAt?: number;
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

export type ModelCategory = "chat" | "image" | "video" | "music" | "speech";

export type Capability = "chat" | "t2i" | "i2i" | "edit" | "upscale" | "t2v" | "i2v" | "v2v" | "music" | "tts";

/** UI hints for which extra controls a model's `input` accepts. */
export type InputHint = "size" | "resolution" | "duration" | "image" | "video" | "instrumental";

/**
 * The `input` field name a model expects its source image URL(s) under.
 * Verified per doc page — NOT uniform across providers:
 *   image_urls / image_input / input_urls / imageUrls take an ARRAY of URLs,
 *   image_url / image / first_frame_url take a single URL string.
 */
export type ImageField =
  | "image_urls"
  | "image_url"
  | "image_input"
  | "input_urls"
  | "image"
  | "imageUrls"
  | "first_frame_url";

const IMAGE_ARRAY_FIELDS: ReadonlySet<ImageField> = new Set([
  "image_urls",
  "image_input",
  "input_urls",
  "imageUrls",
]);

/**
 * The `input` field name a video-to-video / video-edit / upscale model expects
 * its source video URL(s) under. Verified per doc page:
 *   video_urls takes an ARRAY of URLs; video_url takes a single URL string.
 */
export type VideoField = "video_urls" | "video_url";

const VIDEO_ARRAY_FIELDS: ReadonlySet<VideoField> = new Set(["video_urls"]);

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
  /** Where the uploaded source video URL goes in `input` (verified per doc page). */
  videoField?: VideoField;
  /** The model works without a text prompt (e.g. background removal). */
  promptOptional?: boolean;
}

// Every `id` below is copied verbatim from the model's docs.kie.ai page (or
// KIE-API-VERIFIED.md) — never inferred from a URL path. Naming is NOT uniform:
// several ids differ from their doc slug (dots vs dashes, provider prefixes,
// corrected "cluade" typos), so each was confirmed against the page body.
export const MODEL_CATALOG: CatalogModel[] = [
  // ── Chat (dedicated /chat/completions router — OpenAI-compatible) ──
  // The router forwards any `model` id verbatim; ids below are copied from each
  // model's docs.kie.ai page (dashed forms; "cluade" slug typos corrected).
  { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6", provider: "Anthropic", category: "chat", capabilities: ["chat"], verified: true, dedicated: true },
  { id: "gpt-4o", label: "GPT-4o", provider: "OpenAI", category: "chat", capabilities: ["chat"], verified: true, dedicated: true },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro", provider: "Google", category: "chat", capabilities: ["chat"], verified: true, dedicated: true },
  // Phase 5 chat expansion
  { id: "claude-opus-4-8", label: "Claude Opus 4.8", provider: "Anthropic", category: "chat", capabilities: ["chat"], verified: true, dedicated: true },
  { id: "claude-opus-4-7", label: "Claude Opus 4.7", provider: "Anthropic", category: "chat", capabilities: ["chat"], verified: true, dedicated: true },
  { id: "claude-opus-4-6", label: "Claude Opus 4.6", provider: "Anthropic", category: "chat", capabilities: ["chat"], verified: true, dedicated: true },
  { id: "claude-opus-4-5", label: "Claude Opus 4.5", provider: "Anthropic", category: "chat", capabilities: ["chat"], verified: true, dedicated: true },
  { id: "claude-sonnet-5", label: "Claude Sonnet 5", provider: "Anthropic", category: "chat", capabilities: ["chat"], verified: true, dedicated: true },
  { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5", provider: "Anthropic", category: "chat", capabilities: ["chat"], verified: true, dedicated: true },
  { id: "claude-haiku-4-5", label: "Claude Haiku 4.5", provider: "Anthropic", category: "chat", capabilities: ["chat"], verified: true, dedicated: true },
  { id: "claude-fable-5", label: "Claude Fable 5", provider: "Anthropic", category: "chat", capabilities: ["chat"], verified: true, dedicated: true },
  { id: "gpt-5-5", label: "GPT-5.5", provider: "OpenAI", category: "chat", capabilities: ["chat"], verified: true, dedicated: true },
  { id: "gpt-5-4", label: "GPT-5.4", provider: "OpenAI", category: "chat", capabilities: ["chat"], verified: true, dedicated: true },
  { id: "gpt-5-2", label: "GPT-5.2", provider: "OpenAI", category: "chat", capabilities: ["chat"], verified: true, dedicated: true },
  { id: "gpt-codex", label: "GPT Codex", provider: "OpenAI", category: "chat", capabilities: ["chat"], verified: true, dedicated: true },
  { id: "gemini-3-pro", label: "Gemini 3 Pro", provider: "Google", category: "chat", capabilities: ["chat"], verified: true, dedicated: true },
  { id: "gemini-3-1-pro", label: "Gemini 3.1 Pro", provider: "Google", category: "chat", capabilities: ["chat"], verified: true, dedicated: true },
  { id: "gemini-3-flash", label: "Gemini 3 Flash", provider: "Google", category: "chat", capabilities: ["chat"], verified: true, dedicated: true },
  { id: "gemini-3-5-flash", label: "Gemini 3.5 Flash", provider: "Google", category: "chat", capabilities: ["chat"], verified: true, dedicated: true },
  { id: "gemini-2-5-flash", label: "Gemini 2.5 Flash", provider: "Google", category: "chat", capabilities: ["chat"], verified: true, dedicated: true },
  { id: "grok-4-5", label: "Grok 4.5", provider: "xAI", category: "chat", capabilities: ["chat"], verified: true, dedicated: true },
  { id: "grok-4-3", label: "Grok 4.3", provider: "xAI", category: "chat", capabilities: ["chat"], verified: true, dedicated: true },

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
  { id: "recraft/crisp-upscale", label: "Recraft Crisp Upscale", provider: "Recraft", category: "image", capabilities: ["upscale"], verified: true, inputs: ["image"], imageField: "image", promptOptional: true },

  // ── Image · Phase 1 catalog expansion (ids/imageField verified per doc page) ──
  // Text-to-image
  { id: "bytedance/seedream-v4-text-to-image", label: "Seedream 4.0 (T2I)", provider: "ByteDance", category: "image", capabilities: ["t2i"], verified: true },
  { id: "seedream/4.5-text-to-image", label: "Seedream 4.5 (T2I)", provider: "ByteDance", category: "image", capabilities: ["t2i"], verified: true },
  { id: "seedream/5-lite-text-to-image", label: "Seedream 5 Lite (T2I)", provider: "ByteDance", category: "image", capabilities: ["t2i"], verified: true },
  { id: "seedream/5-pro-text-to-image", label: "Seedream 5 Pro (T2I)", provider: "ByteDance", category: "image", capabilities: ["t2i"], verified: true },
  { id: "google/imagen4", label: "Imagen 4", provider: "Google", category: "image", capabilities: ["t2i"], verified: true },
  { id: "google/imagen4-fast", label: "Imagen 4 Fast", provider: "Google", category: "image", capabilities: ["t2i"], verified: true },
  { id: "google/imagen4-ultra", label: "Imagen 4 Ultra", provider: "Google", category: "image", capabilities: ["t2i"], verified: true },
  { id: "nano-banana-2", label: "Nano Banana 2", provider: "Google", category: "image", capabilities: ["t2i", "i2i"], verified: true, inputs: ["image"], imageField: "image_input" },
  { id: "flux-2/pro-text-to-image", label: "Flux-2 Pro (T2I)", provider: "Flux", category: "image", capabilities: ["t2i"], verified: true },
  { id: "flux-2/flex-text-to-image", label: "Flux-2 Flex (T2I)", provider: "Flux", category: "image", capabilities: ["t2i"], verified: true },
  { id: "gpt-image/1.5-text-to-image", label: "GPT Image 1.5 (T2I)", provider: "OpenAI", category: "image", capabilities: ["t2i"], verified: true },
  { id: "qwen/text-to-image", label: "Qwen (T2I)", provider: "Qwen", category: "image", capabilities: ["t2i"], verified: true },
  { id: "z-image", label: "Z-Image", provider: "Z-Image", category: "image", capabilities: ["t2i"], verified: true },
  // Image-to-image / edit (source image field verified — array vs single per provider)
  { id: "bytedance/seedream-v4-edit", label: "Seedream 4.0 Edit", provider: "ByteDance", category: "image", capabilities: ["edit", "i2i"], verified: true, inputs: ["image"], imageField: "image_urls" },
  { id: "seedream/5-lite-image-to-image", label: "Seedream 5 Lite (I2I)", provider: "ByteDance", category: "image", capabilities: ["i2i"], verified: true, inputs: ["image"], imageField: "image_urls" },
  { id: "seedream/5-pro-image-to-image", label: "Seedream 5 Pro (I2I)", provider: "ByteDance", category: "image", capabilities: ["i2i"], verified: true, inputs: ["image"], imageField: "image_urls" },
  { id: "gpt-image-2-image-to-image", label: "GPT Image 2 (I2I)", provider: "OpenAI", category: "image", capabilities: ["i2i"], verified: true, inputs: ["image"], imageField: "input_urls" },
  { id: "gpt-image/1.5-image-to-image", label: "GPT Image 1.5 (I2I)", provider: "OpenAI", category: "image", capabilities: ["i2i"], verified: true, inputs: ["image"], imageField: "input_urls" },
  { id: "qwen/image-to-image", label: "Qwen (I2I)", provider: "Qwen", category: "image", capabilities: ["i2i"], verified: true, inputs: ["image"], imageField: "image_url" },
  { id: "wan/2-7-image", label: "Wan 2.7 Image", provider: "Wan", category: "image", capabilities: ["t2i", "i2i"], verified: true, inputs: ["image"], imageField: "input_urls" },

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

  // ── Video · Phase 2 catalog expansion (ids/imageField verified per doc page) ──
  // Text-to-video
  { id: "kling-2.6/text-to-video", label: "Kling 2.6 (T2V)", provider: "Kling", category: "video", capabilities: ["t2v"], verified: true, inputs: ["duration"] },
  { id: "kling/v3-turbo-text-to-video", label: "Kling V3 Turbo (T2V)", provider: "Kling", category: "video", capabilities: ["t2v"], verified: true, inputs: ["resolution", "duration"] },
  { id: "kling/v2-5-turbo-text-to-video-pro", label: "Kling V2.5 Turbo Pro (T2V)", provider: "Kling", category: "video", capabilities: ["t2v"], verified: true, inputs: ["duration"] },
  { id: "kling/v2-1-master-text-to-video", label: "Kling V2.1 Master (T2V)", provider: "Kling", category: "video", capabilities: ["t2v"], verified: true },
  { id: "wan/2-6-text-to-video", label: "Wan 2.6 (T2V)", provider: "Wan", category: "video", capabilities: ["t2v"], verified: true },
  { id: "wan/2-7-text-to-video", label: "Wan 2.7 (T2V)", provider: "Wan", category: "video", capabilities: ["t2v"], verified: true },
  { id: "grok-imagine/text-to-video", label: "Grok Imagine (T2V)", provider: "xAI", category: "video", capabilities: ["t2v"], verified: true },
  { id: "bytedance/seedance-2-fast", label: "Seedance 2.0 Fast", provider: "ByteDance", category: "video", capabilities: ["t2v", "i2v"], verified: true, inputs: ["image"], imageField: "first_frame_url" },
  { id: "happyhorse/text-to-video", label: "HappyHorse (T2V)", provider: "HappyHorse", category: "video", capabilities: ["t2v"], verified: true },
  { id: "happyhorse-1-1/text-to-video", label: "HappyHorse 1.1 (T2V)", provider: "HappyHorse", category: "video", capabilities: ["t2v"], verified: true },
  // Image-to-video (source image field verified — array vs single per provider)
  { id: "kling/v3-turbo-image-to-video", label: "Kling V3 Turbo (I2V)", provider: "Kling", category: "video", capabilities: ["i2v"], verified: true, inputs: ["duration", "image"], imageField: "image_urls" },
  { id: "kling/v2-5-turbo-image-to-video-pro", label: "Kling V2.5 Turbo Pro (I2V)", provider: "Kling", category: "video", capabilities: ["i2v"], verified: true, inputs: ["duration", "image"], imageField: "image_url" },
  { id: "kling/v2-1-master-image-to-video", label: "Kling V2.1 Master (I2V)", provider: "Kling", category: "video", capabilities: ["i2v"], verified: true, inputs: ["image"], imageField: "image_url" },
  { id: "kling/v2-1-pro", label: "Kling V2.1 Pro (I2V)", provider: "Kling", category: "video", capabilities: ["i2v"], verified: true, inputs: ["image"], imageField: "image_url" },
  { id: "kling/v2-1-standard", label: "Kling V2.1 Standard (I2V)", provider: "Kling", category: "video", capabilities: ["i2v"], verified: true, inputs: ["image"], imageField: "image_url" },
  { id: "bytedance/v1-pro-fast-image-to-video", label: "ByteDance V1 Pro Fast (I2V)", provider: "ByteDance", category: "video", capabilities: ["i2v"], verified: true, inputs: ["image"], imageField: "image_url" },
  { id: "bytedance/seedance-1.5-pro", label: "Seedance 1.5 Pro", provider: "ByteDance", category: "video", capabilities: ["t2v", "i2v"], verified: true, inputs: ["image"], imageField: "input_urls" },
  { id: "grok-imagine/image-to-video", label: "Grok Imagine (I2V)", provider: "xAI", category: "video", capabilities: ["i2v"], verified: true, inputs: ["image"], imageField: "image_urls" },
  { id: "wan/2-6-image-to-video", label: "Wan 2.6 (I2V)", provider: "Wan", category: "video", capabilities: ["i2v"], verified: true, inputs: ["duration", "image"], imageField: "image_urls" },
  { id: "wan/2-6-flash-image-to-video", label: "Wan 2.6 Flash (I2V)", provider: "Wan", category: "video", capabilities: ["i2v"], verified: true, inputs: ["image"], imageField: "image_urls" },
  { id: "happyhorse-1-1/image-to-video", label: "HappyHorse 1.1 (I2V)", provider: "HappyHorse", category: "video", capabilities: ["i2v"], verified: true, inputs: ["image"], imageField: "image_urls" },

  // ── Video · Phase 3: extra image-to-video (first_frame_url) + video-to-video ──
  // I2V models whose source frame goes in `first_frame_url` (single string)
  { id: "wan/2-7-image-to-video", label: "Wan 2.7 (I2V)", provider: "Wan", category: "video", capabilities: ["i2v"], verified: true, inputs: ["image"], imageField: "first_frame_url" },
  { id: "bytedance/seedance-2-mini", label: "Seedance 2.0 Mini", provider: "ByteDance", category: "video", capabilities: ["t2v", "i2v"], verified: true, inputs: ["image"], imageField: "first_frame_url" },
  // Video-to-video / video-edit / upscale — source video field verified per doc
  { id: "wan/2-6-video-to-video", label: "Wan 2.6 (V2V)", provider: "Wan", category: "video", capabilities: ["v2v"], verified: true, inputs: ["video"], videoField: "video_urls" },
  { id: "wan/2-6-flash-video-to-video", label: "Wan 2.6 Flash (V2V)", provider: "Wan", category: "video", capabilities: ["v2v"], verified: true, inputs: ["video"], videoField: "video_urls" },
  { id: "wan/2-7-videoedit", label: "Wan 2.7 Video Edit", provider: "Wan", category: "video", capabilities: ["v2v"], verified: true, inputs: ["video"], videoField: "video_url", promptOptional: true },
  { id: "topaz/video-upscale", label: "Topaz Video Upscale", provider: "Topaz", category: "video", capabilities: ["upscale", "v2v"], verified: true, inputs: ["video"], videoField: "video_url", promptOptional: true },

  // ── Speech / TTS (Unified Jobs API — via the generic /api/jobs proxy) ──
  { id: "elevenlabs/text-to-speech-turbo-2-5", label: "ElevenLabs Turbo 2.5", provider: "ElevenLabs", category: "speech", capabilities: ["tts"], verified: true },
  { id: "elevenlabs/text-to-speech-multilingual-v2", label: "ElevenLabs Multilingual V2", provider: "ElevenLabs", category: "speech", capabilities: ["tts"], verified: true },
  // Text-to-dialogue takes a `dialogue: [{ text, voice }]` array rather than a flat
  // { text, voice } body — the SpeechPage adapts the input shape per model.
  { id: "elevenlabs/text-to-dialogue-v3", label: "ElevenLabs Dialogue V3", provider: "ElevenLabs", category: "speech", capabilities: ["tts"], verified: true },

  // ── Music (dedicated Suno /generate router) ──
  // Model ids are the exact `model` values Suno's /generate accepts (verified on
  // the Generate Music doc page). V5_5 stays first — it's the default selection.
  { id: "V5_5", label: "Suno V5.5", provider: "Suno", category: "music", capabilities: ["music"], verified: true, dedicated: true },
  { id: "V5", label: "Suno V5", provider: "Suno", category: "music", capabilities: ["music"], verified: true, dedicated: true },
  { id: "V4_5PLUS", label: "Suno V4.5 Plus", provider: "Suno", category: "music", capabilities: ["music"], verified: true, dedicated: true },
  { id: "V4_5ALL", label: "Suno V4.5 All", provider: "Suno", category: "music", capabilities: ["music"], verified: true, dedicated: true },
  { id: "V4_5", label: "Suno V4.5", provider: "Suno", category: "music", capabilities: ["music"], verified: true, dedicated: true },
  { id: "V4", label: "Suno V4", provider: "Suno", category: "music", capabilities: ["music"], verified: true, dedicated: true },
];

/** Suno per-model character limits, for live prompt/style counters in the UI. */
export interface SunoLimits { prompt: number; style: number; title: number; nonCustomPrompt: number }

/**
 * Character limits per Suno model (verified on docs.kie.ai). V4 is the tightest
 * (prompt 3000 / style 200); every later model allows prompt 5000 / style 1000.
 * Non-custom mode caps the prompt at 500 on all models.
 */
export function sunoLimits(model: string): SunoLimits {
  if (model === "V4") return { prompt: 3000, style: 200, title: 80, nonCustomPrompt: 500 };
  return { prompt: 5000, style: 1000, title: 100, nonCustomPrompt: 500 };
}

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

/** Models of a category that can take an uploaded source video (v2v / video edit / upscale). */
export function videoCapableModels(category: ModelCategory): CatalogModel[] {
  return catalogByCategory(category).filter((m) => m.videoField);
}

/**
 * Build the model-specific `input` fragment carrying an uploaded source video
 * URL — array vs single-string per the verified doc pages.
 */
export function videoInputFor(modelId: string, url: string): Record<string, unknown> {
  const field = catalogModel(modelId)?.videoField;
  if (!field) return {};
  return { [field]: VIDEO_ARRAY_FIELDS.has(field) ? [url] : url };
}

/** The first model of a category — the sensible default selection. */
export function defaultModel(category: ModelCategory): string {
  return catalogByCategory(category)[0]?.id ?? "";
}
