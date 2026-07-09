import { describe, it, expect, vi } from "vitest";
import { onRequestPost } from "../../functions/api/chat/[[route]]";
import { makeCtx, req, mockFetchSequence, streamOf } from "../helpers";

const post = (body: unknown, key: string | null = "k") =>
  onRequestPost(
    makeCtx(req("https://x/api/chat/stream", { method: "POST", key, body: JSON.stringify(body) }))
  );

describe("chat route", () => {
  it("401s when no key is present", async () => {
    const res = await post({ model: "gpt-4o", messages: [{ role: "user", content: "hi" }] }, null);
    expect(res.status).toBe(401);
  });

  it("400s when model is missing", async () => {
    const res = await post({ messages: [{ role: "user", content: "hi" }] });
    expect(res.status).toBe(400);
  });

  it("400s when messages array is empty", async () => {
    const res = await post({ model: "gpt-4o", messages: [] });
    expect(res.status).toBe(400);
  });

  it("streams the upstream body as SSE on success", async () => {
    const upstream = new Response(streamOf("data: {}\n\n"), {
      status: 200,
      headers: { "Content-Type": "text/event-stream" },
    });
    const fetchMock = mockFetchSequence(upstream);

    const res = await post({ model: "gpt-4o", messages: [{ role: "user", content: "hi" }] });

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
    expect(res.headers.get("Cache-Control")).toBe("no-cache");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect(await res.text()).toContain("data:");

    // Verifies it forwarded the user key as a bearer token and requested a stream.
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.kie.ai/api/v1/chat/completions");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer k");
    expect(JSON.parse(init.body).stream).toBe(true);
  });

  it("passes an upstream error body through verbatim with its status", async () => {
    const upstream = new Response("insufficient credits", { status: 402 });
    mockFetchSequence(upstream);

    const res = await post({ model: "gpt-4o", messages: [{ role: "user", content: "hi" }] });
    expect(res.status).toBe(402);
    expect(await res.text()).toBe("insufficient credits");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });

  it("returns a 500 (never throws) when fetch rejects", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    const res = await post({ model: "gpt-4o", messages: [{ role: "user", content: "hi" }] });
    expect(res.status).toBe(500);
    expect((await res.json()).error).toBe("network down");
  });

  it("detects a JSON error wrapped in HTTP 200 and returns the real status", async () => {
    const body = JSON.stringify({ code: 401, msg: "Unauthorized" });
    const upstream = new Response(body, {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
    mockFetchSequence(upstream);

    const res = await post({ model: "gpt-4o", messages: [{ role: "user", content: "hi" }] });
    expect(res.status).toBe(401);
    expect(await res.text()).toContain("Unauthorized");
    expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
  });
});
