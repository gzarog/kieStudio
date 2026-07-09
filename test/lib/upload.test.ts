import { describe, it, expect, vi } from "vitest";
import { fileToDataUrl, uploadFile, MAX_UPLOAD_BYTES } from "../../src/lib/upload";
import { setApiKey } from "../../src/lib/apiKey";
import { fetchResponse } from "../helpers";

describe("fileToDataUrl", () => {
  it("reads a File into a base64 data URL", async () => {
    const file = new File(["hello"], "hello.txt", { type: "text/plain" });
    const url = await fileToDataUrl(file);
    expect(url).toMatch(/^data:text\/plain;base64,/);
    expect(atob(url.split(",")[1])).toBe("hello");
  });
});

describe("uploadFile", () => {
  it("rejects files over the 10MB cap without touching the network", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const big = new File([new Uint8Array(1)], "big.png");
    Object.defineProperty(big, "size", { value: MAX_UPLOAD_BYTES + 1 });
    await expect(uploadFile(big)).rejects.toThrow(/too large/i);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("POSTs the data URL to /api/upload and returns the hosted URL", async () => {
    setApiKey("k");
    const fetchMock = vi.fn().mockResolvedValue(fetchResponse({ fileUrl: "https://host/f.png" }));
    vi.stubGlobal("fetch", fetchMock);

    const file = new File(["x"], "f.png", { type: "image/png" });
    const result = await uploadFile(file);
    expect(result.fileUrl).toBe("https://host/f.png");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/upload");
    const body = JSON.parse(init.body);
    expect(body.fileName).toBe("f.png");
    expect(body.uploadPath).toBe("images");
    expect(body.base64Data).toMatch(/^data:image\/png;base64,/);
  });
});
