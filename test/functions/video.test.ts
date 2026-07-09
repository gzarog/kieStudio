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

  it("submits Kling/Seedance through the Jobs API with the mapped id", async () => {
    const fetchMock = mockFetchSequence(fetchResponse({ data: { taskId: "V1" } }));
    const res = await submit({ prompt: "drone shot", model: "kling-3.0" });
    expect(await res.json()).toEqual({ taskId: "V1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.kie.ai/api/v1/jobs/createTask");
    expect(JSON.parse(init.body)).toEqual({
      model: "kling-3.0/video",
      input: { prompt: "drone shot" },
    });
  });

  it("submits Seedance with its verified provider-prefixed id", async () => {
    const fetchMock = mockFetchSequence(fetchResponse({ data: { taskId: "V2" } }));
    await submit({ prompt: "clip", model: "seedance-2.0" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).model).toBe("bytedance/seedance-2");
  });

  it("keeps Veo 3.1 on its dedicated /veo/generate router", async () => {
    const fetchMock = mockFetchSequence(fetchResponse({ data: { taskId: "V3" } }));
    await submit({ prompt: "veo clip", model: "veo-3.1" });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.kie.ai/api/v1/veo/generate");
  });

  it("propagates an upstream error with its status", async () => {
    mockFetchSequence(fetchResponse("bad", { ok: false, status: 400, text: "bad" }));
    const res = await submit({ prompt: "x", model: "veo-3.1" });
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("bad");
  });
});

describe("video poll (GET) — Jobs models", () => {
  it("400s when taskId missing", async () => {
    expect((await poll("model=kling-3.0")).status).toBe(400);
  });

  it("returns videoUrl from parsed resultJson via /jobs/recordInfo", async () => {
    const fetchMock = mockFetchSequence(
      fetchResponse({
        data: { state: "success", resultJson: JSON.stringify({ resultUrls: ["http://v/1.mp4"] }) },
      })
    );
    const res = await poll("taskId=V1&model=kling-3.0");
    expect(await res.json()).toEqual({
      status: "success",
      result: { videoUrl: "http://v/1.mp4", resultUrls: ["http://v/1.mp4"] },
    });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.kie.ai/api/v1/jobs/recordInfo?taskId=V1");
  });

  it("returns failed with failMsg on state 'fail'", async () => {
    mockFetchSequence(fetchResponse({ data: { state: "fail", failMsg: "timeout" } }));
    const res = await poll("taskId=V1&model=seedance-2.0");
    expect(await res.json()).toEqual({ status: "failed", result: null, error: "timeout" });
  });

  it("returns pending while generating", async () => {
    mockFetchSequence(fetchResponse({ data: { state: "queuing" } }));
    const res = await poll("taskId=V1&model=kling-3.0");
    expect(await res.json()).toEqual({ status: "pending", result: null });
  });
});

describe("video poll (GET) — Veo dedicated router", () => {
  it("polls /veo/record-info and returns videoUrl", async () => {
    const fetchMock = mockFetchSequence(
      fetchResponse({ data: { successFlag: 1, response: { videoUrl: "http://v/9.mp4" } } })
    );
    const res = await poll("taskId=V9&model=veo-3.1");
    expect(await res.json()).toEqual({ status: "success", result: { videoUrl: "http://v/9.mp4" } });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.kie.ai/api/v1/veo/record-info?taskId=V9"
    );
  });

  it("falls back to response.resultUrls[0] for the video url", async () => {
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
