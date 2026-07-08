import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  postToWorker,
  getFromWorker,
  streamChat,
  validateKey,
} from "../../src/lib/kieClient";
import { setApiKey } from "../../src/lib/apiKey";
import { fetchResponse } from "../helpers";

beforeEach(() => {
  localStorage.clear();
  setApiKey("client-key");
});

describe("kieClient: postToWorker", () => {
  it("POSTs JSON to /api<path> with the X-KIE-Key header and returns parsed JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(fetchResponse({ taskId: "T1" }));
    vi.stubGlobal("fetch", fetchMock);

    const out = await postToWorker<{ taskId: string }>("/image", { prompt: "cat" });
    expect(out).toEqual({ taskId: "T1" });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/image");
    expect(init.method).toBe("POST");
    expect(init.headers["X-KIE-Key"]).toBe("client-key");
    expect(init.headers["Content-Type"]).toBe("application/json");
    expect(JSON.parse(init.body)).toEqual({ prompt: "cat" });
  });

  it("throws with the JSON `error` field on a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        fetchResponse({ error: "no credits" }, { ok: false, status: 402, text: JSON.stringify({ error: "no credits" }) })
      )
    );
    await expect(postToWorker("/image", {})).rejects.toThrow("no credits");
  });

  it("throws the raw text when the error body is not JSON", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(fetchResponse("boom", { ok: false, status: 500, text: "boom" }))
    );
    await expect(postToWorker("/image", {})).rejects.toThrow("boom");
  });
});

describe("kieClient: getFromWorker", () => {
  it("GETs /api<path> with the key header and returns parsed JSON", async () => {
    const fetchMock = vi.fn().mockResolvedValue(fetchResponse({ status: "pending", result: null }));
    vi.stubGlobal("fetch", fetchMock);

    const out = await getFromWorker("/image?taskId=T1");
    expect(out).toEqual({ status: "pending", result: null });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/image?taskId=T1");
    expect(init.headers["X-KIE-Key"]).toBe("client-key");
  });

  it("throws on a non-ok response", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(fetchResponse({ msg: "bad" }, { ok: false, status: 400, text: JSON.stringify({ msg: "bad" }) }))
    );
    await expect(getFromWorker("/image")).rejects.toThrow("bad");
  });
});

describe("kieClient: streamChat", () => {
  it("POSTs model+messages to /api/chat/stream with the key and abort signal", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response("ok"));
    vi.stubGlobal("fetch", fetchMock);
    const controller = new AbortController();

    await streamChat("gpt-4o", [{ role: "user", content: "hi" }], controller.signal);

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/chat/stream");
    expect(init.method).toBe("POST");
    expect(init.headers["X-KIE-Key"]).toBe("client-key");
    expect(init.signal).toBe(controller.signal);
    expect(JSON.parse(init.body)).toEqual({
      model: "gpt-4o",
      messages: [{ role: "user", content: "hi" }],
    });
  });
});

describe("kieClient: validateKey", () => {
  it("returns the worker result on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fetchResponse({ valid: true, credits: 10 })));
    expect(await validateKey()).toEqual({ valid: true, credits: 10 });
  });

  it("returns { valid:false } when the request throws", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("offline")));
    expect(await validateKey()).toEqual({ valid: false });
  });

  it("returns { valid:false } when the worker responds non-ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(fetchResponse({ error: "x" }, { ok: false, status: 500, text: "x" }))
    );
    expect(await validateKey()).toEqual({ valid: false });
  });
});
