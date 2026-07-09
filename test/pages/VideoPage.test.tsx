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

  it("Image-to-Video mode: uploads, then submits the model's image field + string duration", async () => {
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
    // Default i2v model is the first image-capable video model (Veo 3.1 → imageUrls).
    expect(body.model).toBe("veo-3.1");
    expect(body.input).toEqual({ duration: "5", imageUrls: ["https://host/frame.png"] });
  });

  it("Image-to-Video mode: Generate stays disabled until an image is uploaded", () => {
    setApiKey("k");
    render(<VideoPage />);
    fireEvent.click(screen.getByRole("button", { name: /Image to Video/i }));
    type(screen.getByRole("textbox"), "some motion");
    expect(screen.getByRole("button", { name: /Generate/i })).toBeDisabled();
  });

  it("sends the selected model, resolution and duration", async () => {
    setApiKey("k");
    const fetchMock = vi.fn().mockResolvedValue(fetchResponse({ taskId: "V1" }));
    vi.stubGlobal("fetch", fetchMock);

    render(<VideoPage />);
    type(screen.getByRole("textbox"), "a clip");
    type(screen.getByDisplayValue("Veo 3.1"), "seedance-2.0");
    type(screen.getByDisplayValue("1080p"), "720p");
    type(screen.getByDisplayValue("5s"), "10");
    await clickGenerate();
    await tick(0);

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toMatchObject({ model: "seedance-2.0", resolution: "720p", duration: 10 });
  });
});
