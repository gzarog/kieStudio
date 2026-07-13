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
    // Phase 2: Suno V5.5 is the default (the owner's daily driver).
    expect(body.model).toBe("V5_5");
  });
});

const clickTab = (name: RegExp) =>
  act(async () => fireEvent.click(screen.getByRole("button", { name })));

describe("<MusicPage /> custom mode", () => {
  it("gates Generate on title + style and posts a custom-mode body", async () => {
    setApiKey("k");
    const fetchMock = vi.fn().mockResolvedValue(fetchResponse({ taskId: "C1" }));
    vi.stubGlobal("fetch", fetchMock);

    render(<MusicPage />);
    await clickTab(/^Custom$/);

    const generate = screen.getByRole("button", { name: /Generate/i });
    expect(generate).toBeDisabled(); // no title/style/lyrics yet

    type(screen.getByLabelText("Title"), "Aegean Nights");
    type(screen.getByLabelText("Style"), "dark synthwave");
    type(screen.getByLabelText("Lyrics"), "[Verse] running through neon");
    expect(generate).not.toBeDisabled();

    await clickGenerate();
    await tick(0);

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body).toMatchObject({
      customMode: true, instrumental: false, model: "V5_5",
      title: "Aegean Nights", style: "dark synthwave", prompt: "[Verse] running through neon",
    });
    expect(body.callBackUrl).toBeUndefined();
  });

  it("shows the model's style character limit (V5.5 vs V4)", async () => {
    setApiKey("k");
    render(<MusicPage />);
    await clickTab(/^Custom$/);
    // Default V5.5 → style cap 1000.
    expect(screen.getByText("0/1000")).toBeInTheDocument();
    // Switch to Suno V4 → style cap drops to 200.
    fireEvent.change(screen.getByLabelText("Model"), { target: { value: "V4" } });
    expect(screen.getByText("0/200")).toBeInTheDocument();
  });

  it("replaces the style text when Boost returns an inline result", async () => {
    setApiKey("k");
    const fetchMock = vi.fn().mockResolvedValue(
      fetchResponse({ status: "success", result: "Pop, mysterious, cinematic" })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<MusicPage />);
    await clickTab(/^Custom$/);
    type(screen.getByLabelText("Style"), "pop mysterious");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /Boost/i })));
    await tick(0);

    expect(screen.getByLabelText("Style")).toHaveValue("Pop, mysterious, cinematic");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/suno/boost-style");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({ content: "pop mysterious" });
  });

  it("writes lyrics and fills the textarea from a chosen variation", async () => {
    setApiKey("k");
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === "POST") return Promise.resolve(fetchResponse({ taskId: "L1" }));
      return Promise.resolve(
        fetchResponse({ status: "success", result: [{ title: "Neon", text: "[Verse] city lights" }] })
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<MusicPage />);
    await clickTab(/^Custom$/);
    type(screen.getByLabelText("Lyrics idea"), "a song about the city at night");
    await act(async () => fireEvent.click(screen.getByRole("button", { name: /Write lyrics/i })));
    await tick(4000);

    await act(async () => fireEvent.click(screen.getByRole("button", { name: /Use .*Neon/i })));
    expect(screen.getByLabelText("Lyrics")).toHaveValue("[Verse] city lights");
    // Empty title is backfilled from the variation.
    expect(screen.getByLabelText("Title")).toHaveValue("Neon");
  });
});
