import { describe, it, expect } from "vitest";
import { onRequestPost, onRequestGet } from "../../functions/api/suno/[[route]]";
import { makeCtx, req, fetchResponse, mockFetchSequence } from "../helpers";

const post = (action: string, body: unknown, key: string | null = "k") => {
  const ctx = makeCtx(
    req(`https://x/api/suno/${action}`, { method: "POST", key, body: JSON.stringify(body) })
  );
  ctx.params = { route: [action] };
  return onRequestPost(ctx);
};

const poll = (query: string, key: string | null = "k") =>
  onRequestGet(makeCtx(req(`https://x/api/suno/status?${query}`, { key })));

describe("suno actions (POST)", () => {
  it("401s without a key", async () => {
    expect((await post("wav", { taskId: "t", audioId: "a" }, null)).status).toBe(401);
  });

  it("400s on an unknown action", async () => {
    expect((await post("bogus", {})).status).toBe(400);
  });

  it("extend: validates required fields and posts to /generate/extend", async () => {
    expect((await post("extend", { prompt: "p", model: "V5_5" })).status).toBe(400); // no audioId
    expect((await post("extend", { audioId: "a", model: "V5_5" })).status).toBe(400); // no prompt
    expect((await post("extend", { audioId: "a", prompt: "p" })).status).toBe(400); // no model

    const fetchMock = mockFetchSequence(fetchResponse({ data: { taskId: "E1" } }));
    const res = await post("extend", {
      audioId: "a", prompt: "keep going", model: "V5_5", continueAt: 120,
    });
    expect(await res.json()).toEqual({ taskId: "E1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.kie.ai/api/v1/generate/extend");
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      defaultParamFlag: false, audioId: "a", prompt: "keep going", model: "V5_5", continueAt: 120,
    });
    // BYOK: no callback URL is ever registered — polling only.
    expect(body.callBackUrl).toBeUndefined();
  });

  it("stems: posts taskId/audioId/type to /vocal-removal/generate", async () => {
    expect((await post("stems", { audioId: "a" })).status).toBe(400);

    const fetchMock = mockFetchSequence(fetchResponse({ data: { taskId: "S1" } }));
    const res = await post("stems", { taskId: "t", audioId: "a", type: "split_stem" });
    expect(await res.json()).toEqual({ taskId: "S1" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.kie.ai/api/v1/vocal-removal/generate");
    expect(JSON.parse(init.body)).toEqual({ taskId: "t", audioId: "a", type: "split_stem" });
  });

  it("stems: defaults type to separate_vocal", async () => {
    const fetchMock = mockFetchSequence(fetchResponse({ data: { taskId: "S2" } }));
    await post("stems", { taskId: "t", audioId: "a" });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).type).toBe("separate_vocal");
  });

  it("wav: posts to /wav/generate", async () => {
    const fetchMock = mockFetchSequence(fetchResponse({ data: { taskId: "W1" } }));
    const res = await post("wav", { taskId: "t", audioId: "a" });
    expect(await res.json()).toEqual({ taskId: "W1" });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.kie.ai/api/v1/wav/generate");
  });

  it("lyrics: posts the prompt to /lyrics", async () => {
    const fetchMock = mockFetchSequence(fetchResponse({ data: { taskId: "L1" } }));
    const res = await post("lyrics", { prompt: "a song about the sea" });
    expect(await res.json()).toEqual({ taskId: "L1" });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.kie.ai/api/v1/lyrics");
  });

  it("timestamped-lyrics: synchronous — returns alignedWords directly", async () => {
    const fetchMock = mockFetchSequence(
      fetchResponse({
        data: { alignedWords: [{ word: "[Verse] hello", startS: 1.2, endS: 1.6 }] },
      })
    );
    const res = await post("timestamped-lyrics", { taskId: "t", audioId: "a" });
    expect(await res.json()).toEqual({
      alignedWords: [{ word: "[Verse] hello", startS: 1.2, endS: 1.6 }],
    });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.kie.ai/api/v1/generate/get-timestamped-lyrics"
    );
  });

  it("propagates upstream errors with their status", async () => {
    mockFetchSequence(fetchResponse("quota", { ok: false, status: 429, text: "quota" }));
    const res = await post("wav", { taskId: "t", audioId: "a" });
    expect(res.status).toBe(429);
  });

  it("502s when the upstream accepts but returns no taskId", async () => {
    mockFetchSequence(fetchResponse({ code: 500, msg: "boom", data: {} }));
    const res = await post("wav", { taskId: "t", audioId: "a" });
    expect(res.status).toBe(502);
    expect((await res.json()).error).toBe("boom");
  });
});

describe("suno status (GET)", () => {
  it("400s without taskId or with an unknown kind", async () => {
    expect((await poll("kind=wav")).status).toBe(400);
    expect((await poll("taskId=t&kind=nope")).status).toBe(400);
  });

  it("extend: polls /generate/record-info and returns the sunoData tracks", async () => {
    const fetchMock = mockFetchSequence(
      fetchResponse({
        data: { status: "SUCCESS", response: { sunoData: [{ id: "a1", title: "Ext" }] } },
      })
    );
    const res = await poll("taskId=E1&kind=extend");
    expect(await res.json()).toEqual({ status: "success", result: [{ id: "a1", title: "Ext" }] });
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.kie.ai/api/v1/generate/record-info?taskId=E1"
    );
  });

  it("stems: string successFlag SUCCESS → non-null stem URLs", async () => {
    mockFetchSequence(
      fetchResponse({
        data: {
          successFlag: "SUCCESS",
          response: { vocalUrl: "v.mp3", instrumentalUrl: "i.mp3", drumsUrl: null },
        },
      })
    );
    const res = await poll("taskId=S1&kind=stems");
    expect(await res.json()).toEqual({
      status: "success",
      result: { vocalUrl: "v.mp3", instrumentalUrl: "i.mp3" },
    });
  });

  it("wav: returns the audioWavUrl on SUCCESS", async () => {
    const fetchMock = mockFetchSequence(
      fetchResponse({ data: { successFlag: "SUCCESS", response: { audioWavUrl: "m.wav" } } })
    );
    const res = await poll("taskId=W1&kind=wav");
    expect(await res.json()).toEqual({ status: "success", result: { audioWavUrl: "m.wav" } });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.kie.ai/api/v1/wav/record-info?taskId=W1");
  });

  it("lyrics: returns the variations array on SUCCESS", async () => {
    mockFetchSequence(
      fetchResponse({
        data: { status: "SUCCESS", response: { data: [{ title: "T", text: "[Verse]…" }] } },
      })
    );
    const res = await poll("taskId=L1&kind=lyrics");
    expect(await res.json()).toEqual({
      status: "success",
      result: [{ title: "T", text: "[Verse]…" }],
    });
  });

  it("maps PENDING (string successFlag) to pending", async () => {
    mockFetchSequence(fetchResponse({ data: { successFlag: "PENDING" } }));
    expect(await (await poll("taskId=W1&kind=wav")).json()).toEqual({
      status: "pending", result: null,
    });
  });

  it("maps GENERATE_WAV_FAILED to failed with the error message", async () => {
    mockFetchSequence(
      fetchResponse({ data: { successFlag: "GENERATE_WAV_FAILED", errorMessage: "no audio" } })
    );
    expect(await (await poll("taskId=W1&kind=wav")).json()).toEqual({
      status: "failed", result: null, error: "no audio",
    });
  });

  it("treats the interim TEXT_SUCCESS / FIRST_SUCCESS extend states as pending", async () => {
    for (const status of ["TEXT_SUCCESS", "FIRST_SUCCESS", "PENDING"]) {
      mockFetchSequence(fetchResponse({ data: { status } }));
      expect(await (await poll("taskId=E1&kind=extend")).json()).toEqual({
        status: "pending", result: null,
      });
    }
  });
});
