import { describe, it, expect } from "vitest";
import { onRequestPost, onRequestGet } from "../../functions/api/video/[[route]]";
import { makeCtx, req, fetchResponse, mockFetchSequence } from "../helpers";

const submit = (body: unknown, key: string | null = "k") =>
  onRequestPost(
    makeCtx(req("https://x/api/video", { method: "POST", key, body: JSON.stringify(body) }))
  );

const poll = (query: string, key: string | null = "k") =>
  onRequestGet(makeCtx(req(`https://x/api/video?${query}`, { key })));

describe("video submit (POST)", () => {
  it("401s without a key", async () => {
    expect((await submit({ prompt: "x" }, null)).status).toBe(401);
  });

  it("400s when prompt is blank", async () => {
    expect((await submit({ prompt: "" })).status).toBe(400);
  });

  it("routes per-model and returns the taskId", async () => {
    const fetchMock = mockFetchSequence(fetchResponse({ data: { taskId: "V1" } }));
    const res = await submit({ prompt: "drone shot", model: "kling-3.0", resolution: "1080p", duration: 5 });
    expect(await res.json()).toEqual({ taskId: "V1" });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.kie.ai/api/v1/kling/generate");
  });

  it("uses the fallback endpoint for an unknown model", async () => {
    const fetchMock = mockFetchSequence(fetchResponse({ data: { taskId: "V2" } }));
    await submit({ prompt: "drone shot", model: "unknown", resolution: "720p", duration: 8 });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.kie.ai/api/v1/video/generate");
  });

  it("propagates an upstream error with its status", async () => {
    mockFetchSequence(fetchResponse("bad", { ok: false, status: 400, text: "bad" }));
    const res = await submit({ prompt: "x", model: "veo-3.1" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("bad");
  });
});

describe("video poll (GET)", () => {
  it("400s when taskId missing", async () => {
    expect((await poll("model=veo-3.1")).status).toBe(400);
  });

  it("returns success with videoUrl", async () => {
    mockFetchSequence(
      fetchResponse({ data: { successFlag: 1, response: { videoUrl: "http://v/1.mp4" } } })
    );
    const res = await poll("taskId=V1&model=veo-3.1");
    expect(await res.json()).toEqual({ status: "success", result: { videoUrl: "http://v/1.mp4" } });
  });

  it("falls back to resultUrls[0] for the video url", async () => {
    mockFetchSequence(
      fetchResponse({ data: { state: "SUCCESS", response: { resultUrls: ["http://v/2.mp4"] } } })
    );
    const res = await poll("taskId=V1&model=veo-3.1");
    expect((await res.json()).result.videoUrl).toBe("http://v/2.mp4");
  });

  it("returns failed with the error message on successFlag 2", async () => {
    mockFetchSequence(fetchResponse({ data: { successFlag: 2, errorMessage: "timeout" } }));
    const res = await poll("taskId=V1&model=veo-3.1");
    expect(await res.json()).toEqual({ status: "failed", result: null, error: "timeout" });
  });

  it("returns pending while generating", async () => {
    mockFetchSequence(fetchResponse({ data: { successFlag: 0 } }));
    const res = await poll("taskId=V1&model=veo-3.1");
    expect(await res.json()).toEqual({ status: "pending", result: null });
  });
});
