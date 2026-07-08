import { describe, it, expect } from "vitest";
import { onRequestPost, onRequestGet } from "../../functions/api/music/[[route]]";
import { makeCtx, req, fetchResponse, mockFetchSequence } from "../helpers";

const submit = (body: unknown, key: string | null = "k") =>
  onRequestPost(
    makeCtx(req("https://x/api/music", { method: "POST", key, body: JSON.stringify(body) }))
  );

const poll = (query: string, key: string | null = "k") =>
  onRequestGet(makeCtx(req(`https://x/api/music?${query}`, { key })));

describe("music submit (POST)", () => {
  it("401s without a key", async () => {
    expect((await submit({ prompt: "song" }, null)).status).toBe(401);
  });

  it("400s when prompt is blank", async () => {
    expect((await submit({ prompt: "  " })).status).toBe(400);
  });

  it("posts to /generate with customMode:false and returns taskId", async () => {
    const fetchMock = mockFetchSequence(fetchResponse({ data: { taskId: "M1" } }));
    const res = await submit({ prompt: "greek pop", model: "V4_5", instrumental: true });

    expect(await res.json()).toEqual({ taskId: "M1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.kie.ai/api/v1/generate");
    const sent = JSON.parse(init.body);
    expect(sent).toMatchObject({
      prompt: "greek pop",
      customMode: false,
      instrumental: true,
      model: "V4_5",
    });
  });

  it("propagates an upstream error with its status", async () => {
    mockFetchSequence(fetchResponse("nope", { ok: false, status: 403, text: "nope" }));
    const res = await submit({ prompt: "greek pop", model: "V4_5" });
    expect(res.status).toBe(403);
    expect((await res.json()).error).toBe("nope");
  });
});

describe("music poll (GET)", () => {
  it("400s when taskId missing", async () => {
    expect((await poll("")).status).toBe(400);
  });

  it("returns success with the sunoData array", async () => {
    const sunoData = [{ id: "t1", audioUrl: "http://a/1.mp3" }];
    mockFetchSequence(fetchResponse({ data: { status: "SUCCESS", response: { sunoData } } }));
    const res = await poll("taskId=M1");
    expect(await res.json()).toEqual({ status: "success", result: sunoData });
  });

  it("returns an empty array on success when sunoData absent", async () => {
    mockFetchSequence(fetchResponse({ data: { status: "SUCCESS", response: {} } }));
    const res = await poll("taskId=M1");
    expect(await res.json()).toEqual({ status: "success", result: [] });
  });

  it("returns failed with the error message", async () => {
    mockFetchSequence(fetchResponse({ data: { status: "FAILED", errorMessage: "moderation" } }));
    const res = await poll("taskId=M1");
    expect(await res.json()).toEqual({ status: "failed", result: null, error: "moderation" });
  });

  it("returns pending while generating", async () => {
    mockFetchSequence(fetchResponse({ data: { status: "GENERATING" } }));
    const res = await poll("taskId=M1");
    expect(await res.json()).toEqual({ status: "pending", result: null });
  });
});
