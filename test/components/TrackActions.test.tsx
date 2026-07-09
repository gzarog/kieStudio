import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { TrackActions } from "../../src/components/music/TrackActions";
import { setApiKey } from "../../src/lib/apiKey";
import { fetchResponse } from "../helpers";
import type { Track } from "../../src/lib/types";

beforeEach(() => {
  vi.useFakeTimers();
  setApiKey("k");
});
afterEach(() => vi.useRealTimers());

const track: Track = {
  id: "audio-1", taskId: "task-1", model: "V5_5",
  audioUrl: "a.mp3", imageUrl: "c.png", title: "Song", tags: "pop", duration: 120,
};

const tick = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));
const click = (name: RegExp) =>
  act(async () => { fireEvent.click(screen.getByRole("button", { name })); });

describe("<TrackActions />", () => {
  it("renders the four studio action buttons", () => {
    render(<TrackActions track={track} />);
    for (const name of ["Extend", "Stems", "WAV", "Lyrics"]) {
      expect(screen.getByRole("button", { name })).toBeInTheDocument();
    }
  });

  it("WAV: submits { taskId, audioId }, polls, and shows the download link", async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === "POST") return Promise.resolve(fetchResponse({ taskId: "W1" }));
      return Promise.resolve(
        fetchResponse({ status: "success", result: { audioWavUrl: "https://s/m.wav" } })
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<TrackActions track={track} />);
    await click(/^WAV$/);
    await click(/Convert to WAV/i);
    await tick(4000);

    expect(screen.getByRole("link", { name: /WAV master/i })).toHaveAttribute(
      "href", "https://s/m.wav"
    );
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/suno/wav");
    expect(JSON.parse(init!.body as string)).toEqual({ taskId: "task-1", audioId: "audio-1" });
    // The poll carried the kind param.
    expect(String(fetchMock.mock.calls[1][0])).toContain("kind=wav");
  });

  it("Stems: submits the selected mode and lists each returned stem", async () => {
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === "POST") return Promise.resolve(fetchResponse({ taskId: "S1" }));
      return Promise.resolve(
        fetchResponse({
          status: "success",
          result: { vocalUrl: "https://s/v.mp3", instrumentalUrl: "https://s/i.mp3" },
        })
      );
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<TrackActions track={track} />);
    await click(/^Stems$/);
    fireEvent.change(screen.getByLabelText(/stem mode/i), { target: { value: "split_stem" } });
    await click(/Separate/i);
    await tick(4000);

    expect(screen.getByRole("link", { name: /Vocals/i })).toHaveAttribute("href", "https://s/v.mp3");
    expect(screen.getByRole("link", { name: /Instrumental/i })).toBeInTheDocument();
    expect(JSON.parse(fetchMock.mock.calls[0][1]!.body as string).type).toBe("split_stem");
  });

  it("Extend: submits prompt + source model and reports new tracks via onExtended", async () => {
    const extended = [{ id: "a2", audioUrl: "e.mp3", imageUrl: "", title: "Ext", tags: "", duration: 60 }];
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === "POST") return Promise.resolve(fetchResponse({ taskId: "E1" }));
      return Promise.resolve(fetchResponse({ status: "success", result: extended }));
    });
    vi.stubGlobal("fetch", fetchMock);
    const onExtended = vi.fn();

    render(<TrackActions track={track} onExtended={onExtended} />);
    await click(/^Extend$/);
    fireEvent.change(screen.getByLabelText(/extension prompt/i), { target: { value: "more chorus" } });
    await click(/Extend track/i);
    await tick(4000);

    const body = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
    expect(body).toEqual({ audioId: "audio-1", prompt: "more chorus", model: "V5_5" });
    // New tracks are tagged with the extend taskId + model for further actions.
    expect(onExtended).toHaveBeenCalledWith([
      expect.objectContaining({ id: "a2", taskId: "E1", model: "V5_5" }),
    ]);
  });

  it("Lyrics: fetches synchronously and renders timestamped words", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      fetchResponse({ alignedWords: [{ word: "[Verse] hello", startS: 1.25, endS: 1.7 }] })
    );
    vi.stubGlobal("fetch", fetchMock);

    render(<TrackActions track={track} />);
    await click(/^Lyrics$/);
    await click(/Get timestamped lyrics/i);
    await tick(0);

    expect(screen.getByText(/\[1\.25s\] \[Verse\] hello/)).toBeInTheDocument();
    expect(fetchMock.mock.calls[0][0]).toBe("/api/suno/timestamped-lyrics");
  });
});
