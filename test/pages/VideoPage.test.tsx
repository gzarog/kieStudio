import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { VideoPage } from "../../src/pages/VideoPage";
import { setApiKey, clearApiKey } from "../../src/lib/apiKey";
import * as ui from "../../src/lib/ui";
import { fetchResponse } from "../helpers";

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
