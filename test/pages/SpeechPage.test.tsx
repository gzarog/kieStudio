import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { SpeechPage, speechInputFor } from "../../src/pages/SpeechPage";
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

describe("<SpeechPage /> integration", () => {
  it("prompts for the key when generating without one", async () => {
    clearApiKey();
    const requestKey = vi.spyOn(ui, "requestKey").mockImplementation(() => {});
    vi.spyOn(ui, "toast").mockImplementation(() => {});

    render(<SpeechPage />);
    type(screen.getByRole("textbox", { name: "" }), "hello world");
    await clickGenerate();
    expect(requestKey).toHaveBeenCalled();
  });

  it("submits through the generic Jobs proxy with the default voice, then renders the audio", async () => {
    setApiKey("k");
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === "POST") return Promise.resolve(fetchResponse({ taskId: "TTS1" }));
      return Promise.resolve(
        fetchResponse({ status: "success", result: { resultUrls: ["https://s/voice.mp3"] } })
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<SpeechPage />);
    type(container.querySelector("textarea")!, "Unlock powerful API with Kie.ai!");
    await clickGenerate();
    await tick(4000);

    expect(container.querySelector("audio")).toHaveAttribute("src", "https://s/voice.mp3");

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/jobs/submit");
    const body = JSON.parse(init!.body as string);
    // Verified ElevenLabs Turbo 2.5 identifier + documented default voice ID.
    expect(body.model).toBe("elevenlabs/text-to-speech-turbo-2-5");
    expect(body.input).toEqual({
      text: "Unlock powerful API with Kie.ai!",
      speed: 1,
      voice: "EkK5I93UQWFDigLMpZcX",
    });
  });

  it("switching to Multilingual V2 swaps in its default preset voice", async () => {
    setApiKey("k");
    const fetchMock = vi.fn().mockResolvedValue(fetchResponse({ taskId: "TTS2" }));
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<SpeechPage />);
    type(container.querySelector("textarea")!, "bonjour");
    type(screen.getByLabelText("Model"), "elevenlabs/text-to-speech-multilingual-v2");
    expect(screen.getByLabelText("Voice")).toHaveValue("Rachel");

    await clickGenerate();
    await tick(0);
    const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
    expect(body.model).toBe("elevenlabs/text-to-speech-multilingual-v2");
    expect(body.input.voice).toBe("Rachel");
  });

  it("passes a custom voice and speed through the input", async () => {
    setApiKey("k");
    const fetchMock = vi.fn().mockResolvedValue(fetchResponse({ taskId: "TTS3" }));
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<SpeechPage />);
    type(container.querySelector("textarea")!, "fast one");
    type(screen.getByLabelText("Voice"), "Arabella");
    type(screen.getByLabelText("Speed"), "1.2");
    await clickGenerate();
    await tick(0);

    const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
    expect(body.input.voice).toBe("Arabella");
    expect(body.input.speed).toBe(1.2);
  });

  it("Dialogue V3 submits the dialogue-array input shape with its default voice", async () => {
    setApiKey("k");
    const fetchMock = vi.fn().mockResolvedValue(fetchResponse({ taskId: "DLG1" }));
    vi.stubGlobal("fetch", fetchMock);

    const { container } = render(<SpeechPage />);
    type(container.querySelector("textarea")!, "Hello there.");
    type(screen.getByLabelText("Model"), "elevenlabs/text-to-dialogue-v3");
    await clickGenerate();
    await tick(0);

    const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
    expect(body.model).toBe("elevenlabs/text-to-dialogue-v3");
    // Dialogue V3 wraps text in a `dialogue` array — not a flat { text, speed }.
    expect(body.input).toEqual({
      dialogue: [{ text: "Hello there.", voice: "EkK5I93UQWFDigLMpZcX" }],
    });
    expect(body.input).not.toHaveProperty("speed");
  });
});

describe("speechInputFor", () => {
  it("builds the flat { text, speed, voice? } body for the standard TTS models", () => {
    expect(
      speechInputFor("elevenlabs/text-to-speech-turbo-2-5", { text: "hi", voice: "James", speed: 1 })
    ).toEqual({ text: "hi", speed: 1, voice: "James" });
    // an empty voice is omitted
    expect(
      speechInputFor("elevenlabs/text-to-speech-multilingual-v2", { text: "hi", voice: "  ", speed: 0.9 })
    ).toEqual({ text: "hi", speed: 0.9 });
  });

  it("wraps Dialogue V3 in a dialogue array and defaults a missing voice", () => {
    expect(
      speechInputFor("elevenlabs/text-to-dialogue-v3", { text: "line", voice: "Bella", speed: 1 })
    ).toEqual({ dialogue: [{ text: "line", voice: "Bella" }] });
    expect(
      speechInputFor("elevenlabs/text-to-dialogue-v3", { text: "line", voice: "", speed: 1 })
    ).toEqual({ dialogue: [{ text: "line", voice: "EkK5I93UQWFDigLMpZcX" }] });
  });
});
