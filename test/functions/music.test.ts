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

  it("never sends a callBackUrl (BYOK polls instead)", async () => {
    const fetchMock = mockFetchSequence(fetchResponse({ data: { taskId: "M1" } }));
    await submit({ prompt: "greek pop", model: "V5_5" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).callBackUrl).toBeUndefined();
  });
});

describe("music custom mode (POST)", () => {
  it("forwards customMode + style/title/lyrics and every optional param", async () => {
    const fetchMock = mockFetchSequence(fetchResponse({ data: { taskId: "C1" } }));
    const res = await submit({
      customMode: true, instrumental: false, model: "V5_5",
      style: "dark synthwave", title: "Neon", prompt: "[Verse] running…",
      negativeTags: "acoustic", vocalGender: "f",
      styleWeight: 0.7, weirdnessConstraint: 0.3, audioWeight: 0.5,
    });
    expect(await res.json()).toEqual({ taskId: "C1" });
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent).toEqual({
      customMode: true, instrumental: false, model: "V5_5",
      prompt: "[Verse] running…", style: "dark synthwave", title: "Neon",
      negativeTags: "acoustic", vocalGender: "f",
      styleWeight: 0.7, weirdnessConstraint: 0.3, audioWeight: 0.5,
    });
  });

  it("400s in custom mode without style or title", async () => {
    expect((await submit({ customMode: true, model: "V5_5", title: "T", prompt: "x" })).status).toBe(400);
    expect((await submit({ customMode: true, model: "V5_5", style: "S", prompt: "x" })).status).toBe(400);
  });

  it("400s for a custom vocal track without lyrics", async () => {
    const res = await submit({ customMode: true, model: "V5_5", style: "S", title: "T" });
    expect(res.status).toBe(400);
  });

  it("allows a custom instrumental track without lyrics", async () => {
    const fetchMock = mockFetchSequence(fetchResponse({ data: { taskId: "C2" } }));
    const res = await submit({ customMode: true, instrumental: true, model: "V5_5", style: "S", title: "T" });
    expect(await res.json()).toEqual({ taskId: "C2" });
    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.prompt).toBeUndefined();
    expect(sent).toMatchObject({ customMode: true, instrumental: true, style: "S", title: "T" });
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
