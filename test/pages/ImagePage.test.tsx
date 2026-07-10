import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import { ImagePage } from "../../src/pages/ImagePage";
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

describe("<ImagePage /> integration", () => {
  it("prompts for the key (and toasts) when generating without one", async () => {
    clearApiKey();
    const requestKey = vi.spyOn(ui, "requestKey").mockImplementation(() => {});
    const toast = vi.spyOn(ui, "toast").mockImplementation(() => {});

    render(<ImagePage />);
    type(screen.getByRole("textbox"), "a cat");
    await clickGenerate();

    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/API key/i), "error");
    expect(requestKey).toHaveBeenCalled();
  });

  it("submits, polls, and renders the finished image", async () => {
    setApiKey("k");
    const fetchMock = vi.fn((_url: string, init?: RequestInit) => {
      if (init?.method === "POST") return Promise.resolve(fetchResponse({ taskId: "T1" }));
      return Promise.resolve(fetchResponse({ status: "success", result: { imageUrl: "http://img/1.png" } }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ImagePage />);
    type(screen.getByRole("textbox"), "a cat on the moon");
    await clickGenerate();

    // Submit fired; badge shows pending.
    expect(screen.getByText(/Generating/i)).toBeInTheDocument();

    // Advance past the 4s poll interval to pick up the success.
    await tick(4000);

    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "http://img/1.png");
    // The history caption echoes the prompt used for this generation.
    expect(document.querySelector("p.truncate")?.textContent).toContain("a cat on the moon");

    // The submit POST carried the selected model.
    const postCall = fetchMock.mock.calls.find((c) => (c[1] as RequestInit)?.method === "POST");
    expect(JSON.parse((postCall![1] as RequestInit).body as string).model).toBe("gpt-image-2");
  });

  it("toasts when the submit request fails", async () => {
    setApiKey("k");
    const toast = vi.spyOn(ui, "toast").mockImplementation(() => {});
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        fetchResponse({ error: "no credits" }, { ok: false, status: 402, text: JSON.stringify({ error: "no credits" }) })
      )
    );

    render(<ImagePage />);
    type(screen.getByRole("textbox"), "a cat");
    await clickGenerate();
    await tick(0);

    expect(toast).toHaveBeenCalledWith("no credits", "error");
  });

  it("Edit mode: uploads the source image, then submits input with the model's image field", async () => {
    setApiKey("k");
    vi.mocked(uploadFile).mockResolvedValue({ fileUrl: "https://host/src.png" });
    const fetchMock = vi.fn((url: string) => {
      if (String(url).endsWith("/api/upload"))
        return Promise.resolve(fetchResponse({ fileUrl: "https://host/src.png" }));
      return Promise.resolve(fetchResponse({ taskId: "T9" }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ImagePage />);
    fireEvent.click(screen.getByRole("button", { name: /Edit \/ Remix/i }));

    // Upload a source image through the drop zone.
    const file = new File(["x"], "src.png", { type: "image/png" });
    await act(async () => {
      fireEvent.change(screen.getByTestId("file-input"), { target: { files: [file] } });
      await vi.advanceTimersByTimeAsync(0);
    });

    type(screen.getByRole("textbox"), "replace the sky");
    await clickGenerate();
    await tick(0);

    const postCall = fetchMock.mock.calls.find(
      (c) => String(c[0]).endsWith("/api/image") && (c[1] as RequestInit)?.method === "POST"
    );
    const body = JSON.parse((postCall![1] as RequestInit).body as string);
    // Default edit model is the first image-capable model (Nano Banana Pro → image_input).
    expect(body.model).toBe("nano-banana");
    expect(body.input).toEqual({ image_input: ["https://host/src.png"] });
    expect(body.prompt).toBe("replace the sky");
  });

  it("Edit mode: Generate stays disabled until a source image is uploaded", async () => {
    setApiKey("k");
    render(<ImagePage />);
    fireEvent.click(screen.getByRole("button", { name: /Edit \/ Remix/i }));
    type(screen.getByRole("textbox"), "some edit");
    expect(screen.getByRole("button", { name: /Generate/i })).toBeDisabled();
  });

  it("lets the user switch the model before generating", async () => {
    setApiKey("k");
    const fetchMock = vi.fn().mockResolvedValue(fetchResponse({ taskId: "T1" }));
    vi.stubGlobal("fetch", fetchMock);

    render(<ImagePage />);
    type(screen.getByRole("textbox"), "a cat");
    type(screen.getByDisplayValue("GPT Image 2"), "nano-banana");
    await clickGenerate();
    await tick(0);

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.model).toBe("nano-banana");
  });

  it("can select a Phase 1 text-to-image model (Seedream 4.5) and submit its exact id", async () => {
    setApiKey("k");
    const fetchMock = vi.fn().mockResolvedValue(fetchResponse({ taskId: "T1" }));
    vi.stubGlobal("fetch", fetchMock);

    render(<ImagePage />);
    type(screen.getByRole("textbox"), "a temple");
    type(screen.getByDisplayValue("GPT Image 2"), "seedream/4.5-text-to-image");
    await clickGenerate();
    await tick(0);

    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.model).toBe("seedream/4.5-text-to-image");
  });

  it("Edit mode: a Phase 1 i2i model submits its verified input_urls field", async () => {
    setApiKey("k");
    vi.mocked(uploadFile).mockResolvedValue({ fileUrl: "https://host/src.png" });
    const fetchMock = vi.fn((url: string) => {
      if (String(url).endsWith("/api/upload"))
        return Promise.resolve(fetchResponse({ fileUrl: "https://host/src.png" }));
      return Promise.resolve(fetchResponse({ taskId: "T9" }));
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ImagePage />);
    fireEvent.click(screen.getByRole("button", { name: /Edit \/ Remix/i }));
    type(screen.getByDisplayValue("Nano Banana Pro"), "gpt-image-2-image-to-image");

    const file = new File(["x"], "src.png", { type: "image/png" });
    await act(async () => {
      fireEvent.change(screen.getByTestId("file-input"), { target: { files: [file] } });
      await vi.advanceTimersByTimeAsync(0);
    });

    type(screen.getByRole("textbox"), "make it snow");
    await clickGenerate();
    await tick(0);

    const postCall = fetchMock.mock.calls.find(
      (c) => String(c[0]).endsWith("/api/image") && (c[1] as RequestInit)?.method === "POST"
    );
    const body = JSON.parse((postCall![1] as RequestInit).body as string);
    expect(body.model).toBe("gpt-image-2-image-to-image");
    expect(body.input).toEqual({ input_urls: ["https://host/src.png"] });
  });
});
