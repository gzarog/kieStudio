import { describe, it, expect } from "vitest";
import { extractDelta } from "../../src/lib/chatStream";

describe("extractDelta", () => {
  it("extracts OpenAI chat completions delta", () => {
    const event = { choices: [{ delta: { content: "hello" } }] };
    expect(extractDelta(event)).toBe("hello");
  });

  it("extracts Anthropic Messages content_block_delta", () => {
    const event = { type: "content_block_delta", delta: { text: "world" } };
    expect(extractDelta(event)).toBe("world");
  });

  it("extracts OpenAI Responses output_text delta", () => {
    const event = { type: "response.output_text.delta", delta: "foo" };
    expect(extractDelta(event)).toBe("foo");
  });

  it("returns empty string for unrecognised events", () => {
    expect(extractDelta({ type: "message_start" })).toBe("");
    expect(extractDelta({ type: "content_block_start" })).toBe("");
    expect(extractDelta({})).toBe("");
  });

  it("returns empty string when delta content is empty", () => {
    expect(extractDelta({ choices: [{ delta: {} }] })).toBe("");
    expect(extractDelta({ choices: [{ delta: { content: "" } }] })).toBe("");
  });
});
