import { describe, it, expect } from "vitest";
import { onRequestPost, onRequestGet } from "../../functions/api/jobs/[[route]]";
import { makeCtx, req, fetchResponse, mockFetchSequence } from "../helpers";

const submit = (body: unknown, key: string | null = "k") =>
  onRequestPost(
    makeCtx(req("https://x/api/jobs/submit", { method: "POST", key, body: JSON.stringify(body) }))
  );

const poll = (query: string, key: string | null = "k") =>
  onRequestGet(makeCtx(req(`https://x/api/jobs/status?${query}`, { key })));

describe("jobs submit (POST)", () => {
  it("401s without a key", async () => {
    expect((await submit({ model: "m", input: {} }, null)).status).toBe(401);
  });

  it("400s when the model is missing", async () => {
    expect((await submit({ input: { prompt: "x" } })).status).toBe(400);
  });

  it("400s when the input object is missing", async () => {
    expect((await submit({ model: "m" })).status).toBe(400);
  });

  it("forwards model + input to /jobs/createTask and returns the taskId", async () => {
    const fetchMock = mockFetchSequence(fetchResponse({ data: { taskId: "J1" } }));
    const res = await submit({ model: "gemini-omni-video", input: { prompt: "hi" } });
    expect(await res.json()).toEqual({ taskId: "J1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.kie.ai/api/v1/jobs/createTask");
    expect(JSON.parse(init.body)).toEqual({ model: "gemini-omni-video", input: { prompt: "hi" } });
  });

  it("maps friendly model keys through jobsModelId", async () => {
    const fetchMock = mockFetchSequence(fetchResponse({ data: { taskId: "J2" } }));
    await submit({ model: "kling-3.0", input: { prompt: "hi" } });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe("kling-3.0/video");
  });

  it("propagates an upstream error with its status", async () => {
    mockFetchSequence(fetchResponse("nope", { ok: false, status: 429, text: "nope" }));
    const res = await submit({ model: "m", input: { prompt: "x" } });
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("nope");
  });
});

describe("jobs status (GET)", () => {
  it("400s when taskId is missing", async () => {
    expect((await poll("")).status).toBe(400);
  });

  it("returns success with resultUrls parsed from resultJson", async () => {
    mockFetchSequence(
      fetchResponse({
        data: { state: "success", resultJson: JSON.stringify({ resultUrls: ["u1", "u2"] }) },
      })
    );
    const res = await poll("taskId=J1");
    expect(await res.json()).toEqual({ status: "success", result: { resultUrls: ["u1", "u2"] } });
  });

  it("returns failed with failMsg on state 'fail'", async () => {
    mockFetchSequence(fetchResponse({ data: { state: "fail", failMsg: "boom" } }));
    const res = await poll("taskId=J1");
    expect(await res.json()).toEqual({ status: "failed", result: null, error: "boom" });
  });

  it("returns pending for the lowercase in-flight states", async () => {
    for (const state of ["waiting", "queuing", "generating"]) {
      mockFetchSequence(fetchResponse({ data: { state } }));
      const res = await poll("taskId=J1");
      expect(await res.json()).toEqual({ status: "pending", result: null });
    }
  });
});
