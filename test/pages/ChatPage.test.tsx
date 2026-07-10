import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatPage } from "../../src/pages/ChatPage";
import { setApiKey, clearApiKey } from "../../src/lib/apiKey";
import * as ui from "../../src/lib/ui";
import { streamOf } from "../helpers";

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

const sse = (...deltas: string[]) =>
  streamOf(
    ...deltas.map((d) => `data: ${JSON.stringify({ choices: [{ delta: { content: d } }] })}\n`),
    "data: [DONE]\n"
  );

describe("<ChatPage /> integration", () => {
  it("renders the empty-state hint", () => {
    render(<ChatPage />);
    expect(screen.getByText(/Ask anything/i)).toBeInTheDocument();
  });

  it("streams and renders an assistant reply token-by-token", async () => {
    setApiKey("k");
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(new Response(sse("Hello", " world"), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<ChatPage />);
    await user.type(screen.getByPlaceholderText(/Message/i), "hi there");
    await user.click(screen.getByRole("button", { name: /Send/i }));

    expect(await screen.findByText("hi there")).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Hello world")).toBeInTheDocument());

    // Sent the chosen model + full message history to the worker.
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.model).toBe("claude-sonnet-4-6");
    expect(body.messages).toEqual([{ role: "user", content: "hi there" }]);
  });

  it("streams with a Phase 5 chat model when one is selected", async () => {
    setApiKey("k");
    const user = userEvent.setup();
    const fetchMock = vi.fn().mockResolvedValue(new Response(sse("ok"), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);

    render(<ChatPage />);
    await user.selectOptions(screen.getByLabelText("Model"), "claude-opus-4-8");
    await user.type(screen.getByPlaceholderText(/Message/i), "hello");
    await user.click(screen.getByRole("button", { name: /Send/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    // The dedicated /chat/completions router forwards the selected model id verbatim.
    expect(body.model).toBe("claude-opus-4-8");
  });

  it("toasts and requests the key when sending without one", async () => {
    clearApiKey();
    const user = userEvent.setup();
    const requestKey = vi.spyOn(ui, "requestKey").mockImplementation(() => {});
    const toast = vi.spyOn(ui, "toast").mockImplementation(() => {});

    render(<ChatPage />);
    await user.type(screen.getByPlaceholderText(/Message/i), "hi");
    await user.click(screen.getByRole("button", { name: /Send/i }));

    expect(toast).toHaveBeenCalledWith(expect.stringMatching(/API key/i), "error");
    expect(requestKey).toHaveBeenCalled();
  });

  it("shows an inline error message when the stream errors", async () => {
    setApiKey("k");
    const user = userEvent.setup();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("upstream boom", { status: 500 })));

    render(<ChatPage />);
    await user.type(screen.getByPlaceholderText(/Message/i), "hi");
    await user.click(screen.getByRole("button", { name: /Send/i }));

    expect(await screen.findByText(/upstream boom/)).toBeInTheDocument();
  });

  it("restores conversation history from sessionStorage", () => {
    sessionStorage.setItem(
      "kie_chat_history",
      JSON.stringify([{ role: "user", content: "earlier question" }])
    );
    render(<ChatPage />);
    expect(screen.getByText("earlier question")).toBeInTheDocument();
  });

  it("clears the conversation and its stored history", async () => {
    setApiKey("k");
    sessionStorage.setItem(
      "kie_chat_history",
      JSON.stringify([{ role: "user", content: "to be cleared" }])
    );
    const user = userEvent.setup();
    render(<ChatPage />);

    expect(screen.getByText("to be cleared")).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /^Clear$/i }));

    expect(screen.queryByText("to be cleared")).not.toBeInTheDocument();
    // clearChat removes the stored history; the persist effect then writes back an empty list.
    expect(JSON.parse(sessionStorage.getItem("kie_chat_history") ?? "[]")).toEqual([]);
  });

  it("disables Send until there is input", () => {
    render(<ChatPage />);
    expect(screen.getByRole("button", { name: /Send/i })).toBeDisabled();
  });

  it("shows a warning when the stream ends with no content", async () => {
    setApiKey("k");
    const user = userEvent.setup();
    const empty = streamOf("data: [DONE]\n");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(empty, { status: 200 })));

    render(<ChatPage />);
    await user.type(screen.getByPlaceholderText(/Message/i), "hello");
    await user.click(screen.getByRole("button", { name: /Send/i }));

    await waitFor(() => expect(screen.getByText(/No response received/)).toBeInTheDocument());
  });
});
