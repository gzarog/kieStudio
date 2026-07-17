import { describe, it, expect, vi } from "vitest";
import { onRequestPost } from "../../functions/api/chat/[[route]]";
import { makeCtx, req, mockFetchSequence, streamOf } from "../helpers";

const post = (body: unknown, key: string | null = "k") =>
  onRequestPost(
    makeCtx(req("https://x/api/chat/completions", { method: "POST", key, body: JSON.stringify(body) }))
  );

describe("chat route", () => {
  it("401s when no key is present", async () => {
    const res = await post({ model: "gemini-2.5-pro", messages: [{ role: "user", content: "hi" }] }, null);
    expect(res.status).toBe(401);
  });

  it("400s when model is missing", async () => {
    const res = await post({ messages: [{ role: "user", content: "hi" }] });
    expect(res.status).toBe(400);
  });

  it("400s when messages array is empty", async () => {
    const res = await post({ model: "gemini-2.5-pro", messages: [] });
    expect(res.status).toBe(400);
  });

  it("400s for an unknown model id", async () => {
    const res = await post({ model: "nonexistent-model", messages: [{ role: "user", content: "hi" }] });
    expect(res.status).toBe(400);
    expect(await res.text()).toContain("Unknown chat model");
  });

  it("routes Claude to /claude/v1/messages with Anthropic body shape", async () => {
    const upstream = new Response(streamOf("data: {}\n\n"), {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });
    const fetchMock = mockFetchSequence(upstream);

    const res = await post({ model: "claude-opus-4-8", messages: [{ role: "user", content: "hi" }] });

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Chat-Protocol")).toBe("anthropic");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.kie.ai/claude/v1/messages");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer k");
    const body = JSON.parse(init.body);
    expect(body.model).toBe("claude-opus-4-8");
    expect(body.messages).toBeDefined();
    expect(body.stream).toBe(true);
    expect(body.max_tokens).toBe(2048);
  });

  it("routes Gemini to the per-model chat/completions path with OpenAI body", async () => {
    const upstream = new Response(streamOf("data: {}\n\n"), {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });
    const fetchMock = mockFetchSequence(upstream);

    const res = await post({ model: "gemini-2.5-pro", messages: [{ role: "user", content: "hi" }] });

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Chat-Protocol")).toBe("openai");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.kie.ai/gemini-2.5-pro/v1/chat/completions");
    const body = JSON.parse(init.body);
    expect(body.messages).toBeDefined();
    expect(body.stream).toBe(true);
  });

  it("routes GPT-5.5 to /codex/v1/responses with Responses body (input, not messages)", async () => {
    const upstream = new Response(streamOf("data: {}\n\n"), {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });
    const fetchMock = mockFetchSequence(upstream);

    const res = await post({ model: "gpt-5-5", messages: [{ role: "user", content: "hi" }] });

    expect(res.status).toBe(200);
    expect(res.headers.get("X-Chat-Protocol")).toBe("responses");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.kie.ai/codex/v1/responses");
    const body = JSON.parse(init.body);
    expect(body.input).toBeDefined();
    expect(body.messages).toBeUndefined();
    expect(body.stream).toBe(true);
  });

  it("routes Grok to /grok/v1/responses", async () => {
    const upstream = new Response(streamOf("data: {}\n\n"), {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });
    const fetchMock = mockFetchSequence(upstream);

    await post({ model: "grok-4-5", messages: [{ role: "user", content: "hi" }] });

    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.kie.ai/grok/v1/responses");
  });

  it("streams the upstream body as SSE on success", async () => {
    const upstream = new Response(streamOf("data: {}\n\n"), {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });
    mockFetchSequence(upstream);

    const res = await post({ model: "gemini-2.5-pro", messages: [{ role: "user", content: "hi" }] });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(res.headers.get("Cache-Control")).toBe("no-cache");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await res.text()).toContain("data:");
  });

  it("passes an upstream error body through verbatim with its status", async () => {
    const upstream = new Response("insufficient credits", { status: 402 });
    mockFetchSequence(upstream);

    const res = await post({ model: "claude-sonnet-4-6", messages: [{ role: "user", content: "hi" }] });
    expect(res.status).toBe(402);
    expect(await res.text()).toBe("insufficient credits");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("returns a 500 (never throws) when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const res = await post({ model: "claude-fable-5", messages: [{ role: "user", content: "hi" }] });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("network down");
  });

  it("detects a JSON error wrapped in HTTP 200 and returns the real status", async () => {
    const body = JSON.stringify({ code: 401, msg: "Unauthorized" });
    const upstream = new Response(body, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    mockFetchSequence(upstream);

    const res = await post({ model: "claude-opus-4-7", messages: [{ role: "user", content: "hi" }] });
    expect(res.status).toBe(401);
    expect(await res.text()).toContain("Unauthorized");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
