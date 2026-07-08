import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { MusicPage } from "../../src/pages/MusicPage";
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

const TRACK = {
  id: "t1",
  audioUrl: "http://a/1.mp3",
  imageUrl: "http://a/cover.png",
  title: "Aegean Nights",
  tags: "greek, pop",
  duration: 180,
};

describe("<MusicPage /> integration", () => {
  it("requests the key when generating without one", async () => {
    clearApiKey();
    const requestKey = vi.spyOn(ui, "requestKey").mockImplementation(() => {});
    vi.spyOn(ui, "toast").mockImplementation(() => {});

    render(<MusicPage />);
    type(screen.getByRole("textbox"), "greek pop");
    await clickGenerate();
    expect(requestKey).toHaveBeenCalled();
  });

  it("submits, polls, and renders the finished track with an audio player", async () => {
    setApiKey("k");
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === "POST") return Promise.resolve(fetchResponse({ taskId: "M1" }));
      return Promise.resolve(fetchResponse({ status: "success", result: [TRACK] }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<MusicPage />);
    type(screen.getByRole("textbox"), "upbeat greek summer pop");
    await clickGenerate();

    await tick(4000);

    expect(screen.getByText("Aegean Nights")).toBeInTheDocument();
    expect(screen.getByText("greek, pop")).toBeInTheDocument();
    expect(screen.getByText(/Download MP3/i)).toHaveAttribute("href", "http://a/1.mp3");
  });

  it("sends the instrumental flag when checked", async () => {
    setApiKey("k");
    const fetchMock = vi.fn().mockResolvedValue(fetchResponse({ taskId: "M1" }));
    vi.stubGlobal("fetch", fetchMock);

    render(<MusicPage />);
    type(screen.getByRole("textbox"), "ambient");
    fireEvent.click(screen.getByRole("checkbox"));
    await clickGenerate();
    await tick(0);

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.instrumental).toBe(true);
    expect(body.model).toBe("V4_5");
  });
});
