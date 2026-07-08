export type TaskStatus = "idle" | "pending" | "success" | "failed";

export interface ChatMessage { role: "user" | "assistant"; content: string }
export type LLMModel = "claude-sonnet-4-6" | "gpt-4o" | "gemini-2.5-pro";

export interface Track {
  id: string; audioUrl: string; imageUrl: string;
  title: string; tags: string; duration: number;
}
export type SunoModel = "V4_5" | "V5_5";
export type ImageModel = "gpt-image-2" | "nano-banana";
export type VideoModel = "veo-3.1" | "kling-3.0" | "seedance-2.0";
