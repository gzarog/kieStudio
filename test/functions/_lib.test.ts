import { describe, it, expect } from "vitest";
import {
  KIE_BASE,
  IMAGE_ENDPOINTS,
  VIDEO_ENDPOINTS,
  IMAGE_FALLBACK,
  VIDEO_FALLBACK,
  imageEndpoint,
  videoEndpoint,
  userKey,
  kieHeaders,
  withCors,
  onRequestOptions,
  json,
  noKey,
  badRequest,
  guard,
  normalizeStatus,
} from "../../functions/api/_lib";
import { makeCtx, req } from "../helpers";

describe("_lib: endpoint routing", () => {
  it("exposes the documented base URL", () => {
    expect(KIE_BASE).toBe("https://api.kie.ai/api/v1");
  });

  it("imageEndpoint returns per-model pair when known", () => {
    expect(imageEndpoint("gpt-image-2")).toEqual(IMAGE_ENDPOINTS["gpt-image-2"]);
    expect(imageEndpoint("nano-banana")).toEqual(IMAGE_ENDPOINTS["nano-banana"]);
  });

  it("imageEndpoint falls back for unknown / missing models", () => {
    expect(imageEndpoint("does-not-exist")).toBe(IMAGE_FALLBACK);
    expect(imageEndpoint(undefined)).toBe(IMAGE_FALLBACK);
    expect(imageEndpoint("")).toBe(IMAGE_FALLBACK);
  });

  it("videoEndpoint returns per-model pair when known", () => {
    expect(videoEndpoint("veo-3.1")).toEqual(VIDEO_ENDPOINTS["veo-3.1"]);
    expect(videoEndpoint("kling-3.0")).toEqual(VIDEO_ENDPOINTS["kling-3.0"]);
    expect(videoEndpoint("seedance-2.0")).toEqual(VIDEO_ENDPOINTS["seedance-2.0"]);
  });

  it("videoEndpoint falls back for unknown / missing models", () => {
    expect(videoEndpoint("nope")).toBe(VIDEO_FALLBACK);
    expect(videoEndpoint(undefined)).toBe(VIDEO_FALLBACK);
  });
});

describe("_lib: auth headers", () => {
  it("userKey reads the X-KIE-Key header", () => {
    expect(userKey(req("https://x/api", { key: "abc123" }))).toBe("abc123");
  });

  it("userKey returns null when header absent", () => {
    expect(userKey(req("https://x/api", { key: null }))).toBeNull();
  });

  it("kieHeaders builds a bearer + json content-type", () => {
    expect(kieHeaders("k")).toEqual({
      Authorization: "Bearer k",
      "Content-Type": "application/json",
    });
  });
});

describe("_lib: CORS", () => {
  it("withCors adds permissive CORS headers and preserves status/body", async () => {
    const res = withCors(new Response("hi", { status: 201, statusText: "Created" }));
    expect(res.status).toBe(201);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(res.headers.get("Access-Control-Allow-Headers")).toContain("X-KIE-Key");
    expect(await res.text()).toBe("hi");
  });

  it("onRequestOptions answers preflight with 204 + CORS headers", async () => {
    const res = await onRequestOptions(makeCtx(req("https://x/api")));
    expect(res.status).toBe(204);
    expect(res.headers.get("Access-Control-Allow-Methods")).toContain("POST");
  });
});

describe("_lib: JSON response helpers", () => {
  it("json returns a CORS-wrapped JSON response", async () => {
    const res = json({ a: 1 }, 202);
    expect(res.status).toBe(202);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await res.json()).toEqual({ a: 1 });
  });

  it("json defaults to status 200", () => {
    expect(json({}).status).toBe(200);
  });

  it("noKey returns 401 with a helpful error", async () => {
    const res = noKey();
    expect(res.status).toBe(401);
    expect((await res.json()).error).toMatch(/API key/i);
  });

  it("badRequest returns 400 with the given message", async () => {
    const res = badRequest("nope");
    expect(res.status).toBe(400);
    expect((await res.json()).error).toBe("nope");
  });
});

describe("_lib: guard", () => {
  it("passes through a successful response", async () => {
    const res = await guard(async () => json({ ok: true }));
    expect(await res.json()).toEqual({ ok: true });
  });

  it("converts a thrown Error into a CORS-safe 500 with the message", async () => {
    const res = await guard(async () => {
      throw new Error("boom");
    });
    expect(res.status).toBe(500);
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect((await res.json()).error).toBe("boom");
  });

  it("uses a generic message for non-Error throws", async () => {
    const res = await guard(async () => {
      throw "weird";
    });
    expect((await res.json()).error).toBe("Unexpected server error");
  });
});

describe("_lib: normalizeStatus", () => {
  it("maps success-ish statuses", () => {
    for (const s of ["SUCCESS", "success", "Completed", "SUCCEED"]) {
      expect(normalizeStatus({ status: s })).toBe("success");
    }
  });

  it("maps failed / error statuses (including *_ERROR substrings)", () => {
    for (const s of ["FAILED", "ERROR", "CONTENT_ERROR", "canceled"]) {
      expect(normalizeStatus({ status: s })).toBe("failed");
    }
  });

  it("falls back to data.state when status absent", () => {
    expect(normalizeStatus({ state: "SUCCESS" })).toBe("success");
    expect(normalizeStatus({ state: "GENERATING" })).toBe("pending");
  });

  it("interprets successFlag (1=success, 2/3=failed, 0=pending)", () => {
    expect(normalizeStatus({ successFlag: 1 })).toBe("success");
    expect(normalizeStatus({ successFlag: 2 })).toBe("failed");
    expect(normalizeStatus({ successFlag: 3 })).toBe("failed");
    expect(normalizeStatus({ successFlag: 0 })).toBe("pending");
  });

  it("accepts stringified successFlag", () => {
    expect(normalizeStatus({ successFlag: "1" })).toBe("success");
  });

  it("status takes precedence over successFlag", () => {
    expect(normalizeStatus({ status: "SUCCESS", successFlag: 2 })).toBe("success");
  });

  it("defaults unknown / pending shapes to pending", () => {
    for (const s of ["GENERATING", "WAITING", "QUEUEING", "PENDING", ""]) {
      expect(normalizeStatus({ status: s })).toBe("pending");
    }
    expect(normalizeStatus({})).toBe("pending");
  });
});
