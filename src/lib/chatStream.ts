/**
 * Extract streamed text from an SSE event JSON line, handling
 * the three protocols kie.ai uses:
 *
 *   openai     — choices[0].delta.content  (OpenAI chat completions)
 *   anthropic  — delta.text when type === "content_block_delta" (Anthropic Messages)
 *   responses  — delta when type === "response.output_text.delta" (OpenAI Responses)
 */
export type ChatProtocol = "anthropic" | "openai" | "responses";

export function extractDelta(json: unknown): string {
  const j = json as Record<string, unknown>;

  // OpenAI chat completions
  const choices = j.choices as Array<{ delta?: { content?: string } }> | undefined;
  if (choices?.[0]?.delta?.content) return choices[0].delta.content;

  // Anthropic Messages
  if (j.type === "content_block_delta") {
    const delta = j.delta as { text?: string } | undefined;
    if (delta?.text) return delta.text;
  }

  // OpenAI Responses
  if (j.type === "response.output_text.delta") {
    if (typeof j.delta === "string") return j.delta;
  }

  return "";
}
