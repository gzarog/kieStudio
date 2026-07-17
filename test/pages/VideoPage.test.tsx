import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { VideoPage } from "../../src/pages/VideoPage";
import { setApiKey, clearApiKey } from "../../src/lib/apiKey";
import * as ui from "../../src/lib/ui";
import { fetchResponse } from "../helpers";

// FileReader never fires under fake timers — stub the upload helper instead.
// (Resolved value is set per-test: the global afterEach restores all mocks.)
vi.mock("../../src/lib/upload", () => ({ uploadFile: vi.fn() }));
import { uploadFile } from "../../src/lib/upload";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const tick = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
const type = (el: HTMLElement, value: string) => fireEvent.change(el, { target: { value } });
const clickGenerate = async () =>
  act(async () => {
    fireEvent.click(screen.getByRole("button", { name: /Generate/i }));
  });

describe("<VideoPage /> integration", () => {
  it("requests the key when generating without one", async () => {
    clearApiKey();
    const requestKey = vi.spyOn(ui, "requestKey").mockImplementation(() => {});
    vi.spyOn(ui, "toast").mockImplementation(() => {});

    render(<VideoPage />);
    type(screen.getByRole("textbox"), "drone shot");
    await clickGenerate();
    expect(requestKey).toHaveBeenCalled();
  });

  it("submits, polls (6s interval), and renders the finished video", async () => {
    setApiKey("k");
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === "POST") return Promise.resolve(fetchResponse({ taskId: "V1" }));
      return Promise.resolve(fetchResponse({ status: "success", result: { videoUrl: "http://v/1.mp4" } }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<VideoPage />);
    type(screen.getByRole("textbox"), "drone over santorini");
    await clickGenerate();

    // Video poller uses a 6s interval.
    await tick(6000);

    const video = container.querySelector("video");
    expect(video).toHaveAttribute("src", "http://v/1.mp4");
    // The history caption echoes the prompt used for this generation.
    expect(container.querySelector("p.truncate")?.textContent).toContain("drone over santorini");
  });

  it("Video-to-Video mode: uploads a video and submits the model's source-video field (no duration)", async () => {
    setApiKey("k");
    vi.mocked(uploadFile).mockResolvedValue({ fileUrl: "https://host/clip.mp4" });
    const fetchMock = vi.fn((url: string) => {
      if (String(url).endsWith("/api/upload"))
        return Promise.resolve(fetchResponse({ fileUrl: "https://host/clip.mp4" }));
      return Promise.resolve(fetchResponse({ taskId: "V2V" }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<VideoPage />);
    fireEvent.click(screen.getByRole("button", { name: /Video to Video/i }));

    const file = new File(["x"], "clip.mp4", { type: "video/mp4" });
    await act(async () => {
      fireEvent.change(screen.getByTestId("file-input"), { target: { files: [file] } });
      await vi.advanceTimersByTimeAsync(0);
    });

    type(screen.getByRole("textbox"), "restyle as watercolour");
    await clickGenerate();
    await tick(0);

    const postCall = fetchMock.mock.calls.find(
      (c) => String(c[0]).endsWith("/api/video") && (c[1] as RequestInit)?.method === "POST"
    );
    const body = JSON.parse((postCall![1] as RequestInit).body as string);
    // Default v2v model is the first video-capable model (Wan 2.6 V2V → video_urls array).
    expect(body.model).toBe("wan/2-6-video-to-video");
    // Wan 2.6 V2V documents duration ('5'|'10') and resolution ('720p'|'1080p').
    expect(body.input).toEqual({
      video_urls: ["https://host/clip.mp4"],
      duration: "5",
      resolution: "1080p",
    });
  });

  it("Video-to-Video mode: a prompt-optional model (Topaz upscale) generates without a prompt", async () => {
    setApiKey("k");
    vi.mocked(uploadFile).mockResolvedValue({ fileUrl: "https://host/clip.mp4" });
    const fetchMock = vi.fn((url: string) => {
      if (String(url).endsWith("/api/upload"))
        return Promise.resolve(fetchResponse({ fileUrl: "https://host/clip.mp4" }));
      return Promise.resolve(fetchResponse({ taskId: "UP1" }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<VideoPage />);
    fireEvent.click(screen.getByRole("button", { name: /Video to Video/i }));
    type(screen.getByDisplayValue("Wan 2.6 (V2V)"), "topaz/video-upscale");

    const file = new File(["x"], "clip.mp4", { type: "video/mp4" });
    await act(async () => {
      fireEvent.change(screen.getByTestId("file-input"), { target: { files: [file] } });
      await vi.advanceTimersByTimeAsync(0);
    });

    // No prompt typed — Generate should still be enabled for a prompt-optional model.
    expect(screen.getByRole("button", { name: /Generate/i })).not.toBeDisabled();
    await clickGenerate();
    await tick(0);

    const postCall = fetchMock.mock.calls.find(
      (c) => String(c[0]).endsWith("/api/video") && (c[1] as RequestInit)?.method === "POST"
    );
    const body = JSON.parse((postCall![1] as RequestInit).body as string);
    expect(body.model).toBe("topaz/video-upscale");
    // Topaz takes no prompt at all — only the source video and upscale factor.
    expect(body.prompt).toBe("");
    expect(body.input).toEqual({ video_url: "https://host/clip.mp4", upscale_factor: "2" });
  });

  it("Image-to-Video mode: uploads, then submits the model's image field + documented options", async () => {
    setApiKey("k");
    vi.mocked(uploadFile).mockResolvedValue({ fileUrl: "https://host/frame.png" });
    const fetchMock = vi.fn((url: string) => {
      if (String(url).endsWith("/api/upload"))
        return Promise.resolve(fetchResponse({ fileUrl: "https://host/frame.png" }));
      return Promise.resolve(fetchResponse({ taskId: "V9" }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<VideoPage />);
    fireEvent.click(screen.getByRole("button", { name: /Image to Video/i }));

    const file = new File(["x"], "frame.png", { type: "image/png" });
    await act(async () => {
      fireEvent.change(screen.getByTestId("file-input"), { target: { files: [file] } });
      await vi.advanceTimersByTimeAsync(0);
    });

    type(screen.getByRole("textbox"), "waves start rolling");
    await clickGenerate();
    await tick(0);

    const postCall = fetchMock.mock.calls.find(
      (c) => String(c[0]).endsWith("/api/video") && (c[1] as RequestInit)?.method === "POST"
    );
    const body = JSON.parse((postCall![1] as RequestInit).body as string);
    // Default i2v model is the first image-capable video model (Veo → imageUrls).
    // Veo documents aspect_ratio/resolution and an INTEGER duration (4|6|8).
    expect(body.model).toBe("veo-3.1");
    expect(body.input).toEqual({
      aspect_ratio: "16:9",
      resolution: "720p",
      duration: 8,
      imageUrls: ["https://host/frame.png"],
    });
  });

  it("Image-to-Video mode: Generate stays disabled until an image is uploaded", () => {
    setApiKey("k");
    render(<VideoPage />);
    fireEvent.click(screen.getByRole("button", { name: /Image to Video/i }));
    type(screen.getByRole("textbox"), "some motion");
    expect(screen.getByRole("button", { name: /Generate/i })).toBeDisabled();
  });

  it("Image-to-Video: a Phase 2 model (Kling V2.1 Pro) submits its single-string image_url", async () => {
    setApiKey("k");
    vi.mocked(uploadFile).mockResolvedValue({ fileUrl: "https://host/frame.png" });
    const fetchMock = vi.fn((url: string) => {
      if (String(url).endsWith("/api/upload"))
        return Promise.resolve(fetchResponse({ fileUrl: "https://host/frame.png" }));
      return Promise.resolve(fetchResponse({ taskId: "V7" }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<VideoPage />);
    fireEvent.click(screen.getByRole("button", { name: /Image to Video/i }));
    // Switch the i2v model picker to Kling V2.1 Pro (image_url, single string).
    type(screen.getByDisplayValue("Veo 3 Fast"), "kling/v2-1-pro");

    const file = new File(["x"], "frame.png", { type: "image/png" });
    await act(async () => {
      fireEvent.change(screen.getByTestId("file-input"), { target: { files: [file] } });
      await vi.advanceTimersByTimeAsync(0);
    });

    type(screen.getByRole("textbox"), "camera pushes in");
    await clickGenerate();
    await tick(0);

    const postCall = fetchMock.mock.calls.find(
      (c) => String(c[0]).endsWith("/api/video") && (c[1] as RequestInit)?.method === "POST"
    );
    const body = JSON.parse((postCall![1] as RequestInit).body as string);
    expect(body.model).toBe("kling/v2-1-pro");
    expect(body.input).toEqual({ duration: "5", image_url: "https://host/frame.png" });
  });

  it("T2V: sends the selected options inside `input` with their documented types", async () => {
    setApiKey("k");
    const fetchMock = vi.fn().mockResolvedValue(fetchResponse({ taskId: "V1" }));
    vi.stubGlobal("fetch", fetchMock);

    render(<VideoPage />);
    type(screen.getByRole("textbox"), "a clip");
    type(screen.getByDisplayValue("Veo 3 Fast"), "seedance-2.0");
    // Seedance 2.0's controls come from its verified doc schema.
    type(screen.getByLabelText("Resolution"), "1080p");
    type(screen.getByLabelText("Duration"), "10");
    await clickGenerate();
    await tick(0);

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.model).toBe("seedance-2.0");
    // duration is a NUMBER for Seedance; options ride inside `input`.
    expect(body.input).toEqual({ duration: 10, resolution: "1080p", aspect_ratio: "16:9" });
  });

  it("T2V: a Kling model carries its API-required constants (sound / aspect_ratio)", async () => {
    setApiKey("k");
    const fetchMock = vi.fn().mockResolvedValue(fetchResponse({ taskId: "V1" }));
    vi.stubGlobal("fetch", fetchMock);

    render(<VideoPage />);
    type(screen.getByRole("textbox"), "a clip");
    type(screen.getByDisplayValue("Veo 3 Fast"), "kling-2.6/text-to-video");
    await clickGenerate();
    await tick(0);

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    // Kling 2.6 requires sound + aspect_ratio + string duration on every task.
    expect(body.input).toEqual({ sound: false, duration: "5", aspect_ratio: "16:9" });
  });

  it("resets options to the new model's defaults when the model changes", async () => {
    setApiKey("k");
    render(<VideoPage />);
    // Veo's duration enum (4|6|8, default 8s) …
    expect(screen.getByLabelText("Duration")).toHaveValue("8");
    // … switches to Hailuo 02 Std's ('6'|'10', default 6s).
    type(screen.getByDisplayValue("Veo 3 Fast"), "hailuo/02-text-to-video-standard");
    expect(screen.getByLabelText("Duration")).toHaveValue("6");
    // Models without documented options render no option selects.
    type(screen.getByDisplayValue("Hailuo 02 Std (T2V)"), "hailuo/02-text-to-video-pro");
    expect(screen.queryByLabelText("Duration")).toBeNull();
  });
});
