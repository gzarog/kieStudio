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

  it("submits to the Jobs API with the mapped model id and prompt input", async () => {
    const fetchMock = mockFetchSequence(fetchResponse({ data: { taskId: "T1" } }));
    const res = await submit({ prompt: "a cat", model: "nano-banana" });

    expect(await res.json()).toEqual({ taskId: "T1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.kie.ai/api/v1/jobs/createTask");
    expect(JSON.parse(init.body)).toEqual({ model: "nano-banana-pro", input: { prompt: "a cat" } });
  });

  it("merges caller-supplied input over the prompt", async () => {
    const fetchMock = mockFetchSequence(fetchResponse({ data: { taskId: "T2" } }));
    await submit({ prompt: "a cat", model: "gpt-image-2", input: { image_size: "1024x1024" } });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      model: "gpt-image-2-text-to-image",
      input: { prompt: "a cat", image_size: "1024x1024" },
    });
  });

  it("propagates an upstream error with its status", async () => {
    mockFetchSequence(fetchResponse("rate limited", { ok: false, status: 429, text: "rate limited" }));
    const res = await submit({ prompt: "a cat", model: "gpt-image-2" });
    expect(res.status).toBe(429);
    expect((await res.json()).error).toBe("rate limited");
  });

  it("surfaces kie.ai business error instead of crashing on null data", async () => {
    mockFetchSequence(fetchResponse({ code: 402, msg: "Insufficient credits", data: null }));
    const res = await submit({ prompt: "a cat", model: "gpt-image-2" });
    expect(res.status).toBe(402);
    expect((await res.json()).error).toBe("Insufficient credits");
  });
});

describe("image poll (GET)", () => {
  it("401s without a key", async () => {
    expect((await poll("taskId=T1", null)).status).toBe(401);
  });

  it("400s when taskId is missing", async () => {
    expect((await poll("model=gpt-image-2")).status).toBe(400);
  });

  it("polls /jobs/recordInfo and returns imageUrl from parsed resultJson", async () => {
    const fetchMock = mockFetchSequence(
      fetchResponse({
        data: { state: "success", resultJson: JSON.stringify({ resultUrls: ["http://img/1.png"] }) },
      })
    );
    const res = await poll("taskId=T1&model=gpt-image-2");
    expect(await res.json()).toEqual({
      status: "success",
      result: { imageUrl: "http://img/1.png", resultUrls: ["http://img/1.png"] },
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.kie.ai/api/v1/jobs/recordInfo?taskId=T1"
    );
  });

  it("returns failed with the upstream failMsg on state 'fail'", async () => {
    mockFetchSequence(fetchResponse({ data: { state: "fail", failMsg: "nsfw" } }));
    const res = await poll("taskId=T1&model=gpt-image-2");
    expect(await res.json()).toEqual({ status: "failed", result: null, error: "nsfw" });
  });

  it("returns pending while still generating", async () => {
    mockFetchSequence(fetchResponse({ data: { state: "generating" } }));
    const res = await poll("taskId=T1&model=gpt-image-2");
    expect(await res.json()).toEqual({ status: "pending", result: null });
  });

  it("encodes the taskId in the recordInfo query", async () => {
    const fetchMock = mockFetchSequence(fetchResponse({ data: { state: "waiting" } }));
    await poll("taskId=a%2Fb&model=nano-banana");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.kie.ai/api/v1/jobs/recordInfo?taskId=a%2Fb"
    );
  });

  it("returns failed with kie.ai msg when data is null during poll", async () => {
    mockFetchSequence(fetchResponse({ code: 500, msg: "Internal error", data: null }));
    const res = await poll("taskId=T1&model=gpt-image-2");
    expect(await res.json()).toEqual({ status: "failed", result: null, error: "Internal error" });
  });
});
