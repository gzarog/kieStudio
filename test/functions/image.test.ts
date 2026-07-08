import { describe, it, expect } from "vitest";
import { onRequestPost, onRequestGet } from "../../functions/api/image/[[route]]";
import { makeCtx, req, fetchResponse, mockFetchSequence } from "../helpers";

const submit = (body: unknown, key: string | null = "k") =>
  onRequestPost(
    makeCtx(req("https://x/api/image", { method: "POST", key, body: JSON.stringify(body) }))
  );

const poll = (query: string, key: string | null = "k") =>
  onRequestGet(makeCtx(req(`https://x/api/image?${query}`, { key })));

describe("image submit (POST)", () => {
  it("401s without a key", async () => {
    expect((await submit({ prompt: "cat" }, null)).status).toBe(401);
  });

  it("400s when prompt is blank", async () => {
    expect((await submit({ prompt: "   ", model: "gpt-image-2" })).status).toBe(400);
  });

  it("routes to the per-model submit endpoint and returns the taskId", async () => {
    const fetchMock = mockFetchSequence(fetchResponse({ data: { taskId: "T1" } }));
    const res = await submit({ prompt: "a cat", model: "nano-banana", size: "1024x1024" });

    expect(await res.json()).toEqual({ taskId: "T1" });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.kie.ai/api/v1/nano-banana/generate");
  });

  it("uses the fallback endpoint for an unknown model", async () => {
    const fetchMock = mockFetchSequence(fetchResponse({ data: { taskId: "T2" } }));
    await submit({ prompt: "a cat", model: "mystery", size: "512x512" });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.kie.ai/api/v1/image/generate");
  });

  it("propagates an upstream error with its status", async () => {
    mockFetchSequence(fetchResponse("rate limited", { ok: false, status: 429, text: "rate limited" }));
    const res = await submit({ prompt: "a cat", model: "gpt-image-2" });
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("rate limited");
  });
});

describe("image poll (GET)", () => {
  it("401s without a key", async () => {
    expect((await poll("taskId=T1", null)).status).toBe(401);
  });

  it("400s when taskId is missing", async () => {
    expect((await poll("model=gpt-image-2")).status).toBe(400);
  });

  it("returns success with imageUrl from response.imageUrl", async () => {
    mockFetchSequence(
      fetchResponse({ data: { status: "SUCCESS", response: { imageUrl: "http://img/1.png" } } })
    );
    const res = await poll("taskId=T1&model=gpt-image-2");
    expect(await res.json()).toEqual({ status: "success", result: { imageUrl: "http://img/1.png" } });
  });

  it("falls back to resultUrls[0] when imageUrl absent", async () => {
    mockFetchSequence(
      fetchResponse({ data: { status: "SUCCESS", response: { resultUrls: ["http://img/2.png"] } } })
    );
    const res = await poll("taskId=T1&model=gpt-image-2");
    expect((await res.json()).result.imageUrl).toBe("http://img/2.png");
  });

  it("returns failed with the upstream error message", async () => {
    mockFetchSequence(fetchResponse({ data: { status: "FAILED", errorMessage: "nsfw" } }));
    const res = await poll("taskId=T1&model=gpt-image-2");
    expect(await res.json()).toEqual({ status: "failed", result: null, error: "nsfw" });
  });

  it("returns pending while still generating", async () => {
    mockFetchSequence(fetchResponse({ data: { status: "GENERATING" } }));
    const res = await poll("taskId=T1&model=gpt-image-2");
    expect(await res.json()).toEqual({ status: "pending", result: null });
  });

  it("uses the per-model status endpoint and encodes the taskId", async () => {
    const fetchMock = mockFetchSequence(fetchResponse({ data: { status: "GENERATING" } }));
    await poll("taskId=a%2Fb&model=nano-banana");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.kie.ai/api/v1/nano-banana/record-info?taskId=a%2Fb"
    );
  });
});
