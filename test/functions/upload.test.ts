import { describe, it, expect } from "vitest";
import { onRequestPost } from "../../functions/api/upload/[[route]]";
import { makeCtx, req, fetchResponse, mockFetchSequence } from "../helpers";

const upload = (body: unknown, key: string | null = "k") =>
  onRequestPost(
    makeCtx(req("https://x/api/upload", { method: "POST", key, body: JSON.stringify(body) }))
  );

describe("upload proxy (POST)", () => {
  it("401s without a key", async () => {
    expect((await upload({ base64Data: "data:image/png;base64,AA==" }, null)).status).toBe(401);
  });

  it("400s when base64Data is missing or not a data: URL", async () => {
    expect((await upload({})).status).toBe(400);
    expect((await upload({ base64Data: "not-a-data-url" })).status).toBe(400);
  });

  it("forwards to the File Upload API and returns the hosted URL", async () => {
    const fetchMock = mockFetchSequence(
      fetchResponse({
        success: true,
        code: 200,
        // Real API shape: the hosted URL comes back as `downloadUrl`.
        data: { downloadUrl: "https://tempfile.redpandaai.co/xxx/a.png", fileName: "a.png", uploadedAt: "2026-07-12T00:00:00Z" },
      })
    );
    const res = await upload({ base64Data: "data:image/png;base64,AA==", fileName: "a.png" });
    expect(await res.json()).toEqual({
      fileUrl: "https://tempfile.redpandaai.co/xxx/a.png",
      fileName: "a.png",
      expiresAt: "2026-07-12T00:00:00Z",
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://kieai.redpandaai.co/api/file-base64-upload");
    expect(init.headers.Authorization).toBe("Bearer k");
    const body = JSON.parse(init.body);
    expect(body).toEqual({
      base64Data: "data:image/png;base64,AA==",
      fileName: "a.png",
      uploadPath: "images",
    });
  });

  it("still accepts a legacy `fileUrl` response field", async () => {
    mockFetchSequence(
      fetchResponse({ success: true, code: 200, data: { fileUrl: "https://kieai.redpandaai.co/files/images/b.png" } })
    );
    const res = await upload({ base64Data: "data:image/png;base64,AA==" });
    expect((await res.json()).fileUrl).toBe("https://kieai.redpandaai.co/files/images/b.png");
  });

  it("propagates upstream errors with their status", async () => {
    mockFetchSequence(fetchResponse("too big", { ok: false, status: 413, text: "too big" }));
    const res = await upload({ base64Data: "data:image/png;base64,AA==" });
    expect(res.status).toBe(413);
    expect((await res.json()).error).toBe("too big");
  });

  it("502s when the upstream succeeds without a fileUrl", async () => {
    mockFetchSequence(fetchResponse({ success: true, data: {} }));
    expect((await upload({ base64Data: "data:image/png;base64,AA==" })).status).toBe(502);
  });
});
