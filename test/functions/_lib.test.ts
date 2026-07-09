import { describe, it, expect } from "vitest";
import {
  KIE_BASE,
  JOBS_CREATE,
  JOBS_STATUS,
  JOBS_MODEL_IDS,
  jobsModelId,
  createJob,
  jobStatus,
  parseJobResult,
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
import { makeCtx, req, fetchResponse, mockFetchSequence } from "../helpers";

describe("_lib: Jobs API constants + model mapping", () => {
  it("exposes the documented base URL and Jobs paths", () => {
    expect(KIE_BASE).toBe("https://api.kie.ai/api/v1");
    expect(JOBS_CREATE).toBe("/jobs/createTask");
    expect(JOBS_STATUS).toBe("/jobs/recordInfo");
  });

  it("maps friendly keys to their verified Jobs identifiers", () => {
    expect(jobsModelId("gpt-image-2")).toBe("gpt-image-2-text-to-image");
    expect(jobsModelId("nano-banana")).toBe("nano-banana-pro");
    expect(jobsModelId("kling-3.0")).toBe("kling-3.0/video");
    expect(jobsModelId("seedance-2.0")).toBe("bytedance/seedance-2");
    expect(JOBS_MODEL_IDS["gpt-image-2"]).toBe("gpt-image-2-text-to-image");
  });

  it("passes through already-exact ids and empty for undefined", () => {
    expect(jobsModelId("bytedance/seedance-2")).toBe("bytedance/seedance-2");
    expect(jobsModelId(undefined)).toBe("");
    expect(jobsModelId("")).toBe("");
  });
});

describe("_lib: Jobs API helpers", () => {
  it("createJob POSTs to /jobs/createTask with model+input and bearer auth", async () => {
    const fetchMock = mockFetchSequence(fetchResponse({ data: { taskId: "T" } }));
    await createJob("mykey", "gpt-image-2-text-to-image", { prompt: "cat" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.kie.ai/api/v1/jobs/createTask");
    expect(init.method).toBe("POST");
    expect(init.headers.Authorization).toBe("Bearer mykey");
    expect(JSON.parse(init.body)).toEqual({
      model: "gpt-image-2-text-to-image",
      input: { prompt: "cat" },
    });
  });

  it("createJob includes callBackUrl only when provided", async () => {
    const fetchMock = mockFetchSequence(fetchResponse({ data: { taskId: "T" } }));
    await createJob("k", "m", { prompt: "x" }, "https://cb");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body).callBackUrl).toBe("https://cb");
  });

  it("jobStatus GETs /jobs/recordInfo with an encoded taskId", async () => {
    const fetchMock = mockFetchSequence(fetchResponse({ data: {} }));
    await jobStatus("k", "a/b");
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.kie.ai/api/v1/jobs/recordInfo?taskId=a%2Fb"
    );
  });
});

describe("_lib: parseJobResult (stringified resultJson)", () => {
  it("parses a stringified JSON and returns resultUrls", () => {
    expect(parseJobResult(JSON.stringify({ resultUrls: ["u1", "u2"] }))).toEqual({
      resultUrls: ["u1", "u2"],
    });
  });

  it("tolerates snake_case result_urls", () => {
    expect(parseJobResult(JSON.stringify({ result_urls: ["u"] }))).toEqual({ resultUrls: ["u"] });
  });

  it("returns empty for missing / malformed / empty input", () => {
    expect(parseJobResult(undefined)).toEqual({ resultUrls: [] });
    expect(parseJobResult("")).toEqual({ resultUrls: [] });
    expect(parseJobResult("not json")).toEqual({ resultUrls: [] });
    expect(parseJobResult(JSON.stringify({}))).toEqual({ resultUrls: [] });
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
  it("maps success-ish statuses (incl. lowercase Jobs state)", () => {
    for (const s of ["SUCCESS", "success", "Completed", "SUCCEED"]) {
      expect(normalizeStatus({ status: s })).toBe("success");
    }
    expect(normalizeStatus({ state: "success" })).toBe("success");
  });

  it("maps the Jobs lowercase 'fail' state to failed", () => {
    expect(normalizeStatus({ state: "fail" })).toBe("failed");
    expect(normalizeStatus({ status: "fail" })).toBe("failed");
  });

  it("maps failed / error statuses (including *_ERROR substrings)", () => {
    for (const s of ["FAILED", "ERROR", "CONTENT_ERROR", "canceled"]) {
      expect(normalizeStatus({ status: s })).toBe("failed");
    }
  });

  it("treats the Jobs lowercase pending states as pending", () => {
    for (const s of ["waiting", "queuing", "generating"]) {
      expect(normalizeStatus({ state: s })).toBe("pending");
    }
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
    for (const s of ["GENERATING", "WAITING", "QUEUING", "PENDING", ""]) {
      expect(normalizeStatus({ status: s })).toBe("pending");
    }
    expect(normalizeStatus({})).toBe("pending");
  });
});
