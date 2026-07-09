import { describe, it, expect, vi } from "vitest";
import { onRequestGet } from "../../functions/api/validate/[[route]]";
import { makeCtx, req, fetchResponse, mockFetchSequence } from "../helpers";

const validate = (key: string | null = "k") =>
  onRequestGet(makeCtx(req("https://x/api/validate", { key })));

describe("validate route", () => {
  it("401s without a key", async () => {
    expect((await validate(null)).status).toBe(401);
  });

  it("returns valid + credits from the credits endpoint (remainingCredits preferred)", async () => {
    const fetchMock = mockFetchSequence(
      fetchResponse({ data: { remainingCredits: 42, credits: 99 } })
    );
    const res = await validate();
    expect(await res.json()).toEqual({ valid: true, credits: 42 });
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.kie.ai/api/v1/chat/credit");
  });

  it("uses credits when remainingCredits is absent", async () => {
    mockFetchSequence(fetchResponse({ data: { credits: 7 } }));
    expect(await (await validate()).json()).toEqual({ valid: true, credits: 7 });
  });

  it("reads the verified Common API shape where data IS the number", async () => {
    // GET /chat/credit → { code: 200, msg: "success", data: 100 }
    mockFetchSequence(fetchResponse({ code: 200, msg: "success", data: 100 }));
    expect(await (await validate()).json()).toEqual({ valid: true, credits: 100 });
  });

  it("returns valid:false immediately on a 401 from credits (no fallback)", async () => {
    const fetchMock = mockFetchSequence(fetchResponse(null, { ok: false, status: 401 }));
    const res = await validate();
    expect(await res.json()).toEqual({ valid: false });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("returns valid:false on a 403 from credits", async () => {
    mockFetchSequence(fetchResponse(null, { ok: false, status: 403 }));
    expect(await (await validate()).json()).toEqual({ valid: false });
  });

  it("falls back to a chat probe when credits endpoint 404s", async () => {
    const fetchMock = mockFetchSequence(
      fetchResponse(null, { ok: false, status: 404 }),
      fetchResponse({ choices: [] }, { ok: true, status: 200 })
    );
    const res = await validate();
    expect(await res.json()).toEqual({ valid: true });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.kie.ai/api/v1/chat/completions");
  });

  it("falls back to the chat probe when the credits fetch throws", async () => {
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new Error("dns"))
      .mockResolvedValueOnce(fetchResponse({}, { ok: true }));
    vi.stubGlobal("fetch", fetchMock);
    expect(await (await validate()).json()).toEqual({ valid: true });
  });

  it("reports valid:false when the chat probe also fails", async () => {
    mockFetchSequence(
      fetchResponse(null, { ok: false, status: 404 }),
      fetchResponse(null, { ok: false, status: 401 })
    );
    expect(await (await validate()).json()).toEqual({ valid: false });
  });
});
