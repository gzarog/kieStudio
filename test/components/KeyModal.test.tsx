import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { KeyModal } from "../../src/components/shared/KeyModal";
import * as kieClient from "../../src/lib/kieClient";
import { getApiKey, setApiKey } from "../../src/lib/apiKey";

beforeEach(() => localStorage.clear());

describe("<KeyModal />", () => {
  it("prefills the input with the stored key", () => {
    setApiKey("stored-key");
    render(<KeyModal onClose={() => {}} />);
    expect(screen.getByPlaceholderText(/Paste your key/i)).toHaveValue("stored-key");
  });

  it("disables Save when the input is empty", () => {
    render(<KeyModal onClose={() => {}} />);
    expect(screen.getByRole("button", { name: /Save key/i })).toBeDisabled();
  });

  it("saves the key, shows credits, and closes on a valid key", async () => {
    const user = userEvent.setup();
    vi.spyOn(kieClient, "validateKey").mockResolvedValue({ valid: true, credits: 80 });
    const onClose = vi.fn();
    render(<KeyModal onClose={onClose} />);

    await user.type(screen.getByPlaceholderText(/Paste your key/i), "good-key");
    await user.click(screen.getByRole("button", { name: /Save key/i }));

    expect(getApiKey()).toBe("good-key");
    expect(await screen.findByText(/Verified.*80 credits/i)).toBeInTheDocument();
    await waitFor(() => expect(onClose).toHaveBeenCalled(), { timeout: 1500 });
  });

  it("shows a rejection message and does not close on an invalid key", async () => {
    const user = userEvent.setup();
    vi.spyOn(kieClient, "validateKey").mockResolvedValue({ valid: false });
    const onClose = vi.fn();
    render(<KeyModal onClose={onClose} />);

    await user.type(screen.getByPlaceholderText(/Paste your key/i), "bad-key");
    await user.click(screen.getByRole("button", { name: /Save key/i }));

    expect(await screen.findByText(/rejected by kie\.ai/i)).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("clears the stored key and input via the Clear button", async () => {
    const user = userEvent.setup();
    setApiKey("stored-key");
    render(<KeyModal onClose={() => {}} />);

    await user.click(screen.getByRole("button", { name: /Clear/i }));
    expect(getApiKey()).toBe("");
    expect(screen.getByPlaceholderText(/Paste your key/i)).toHaveValue("");
  });

  it("saves on Enter keypress", async () => {
    const user = userEvent.setup();
    const spy = vi.spyOn(kieClient, "validateKey").mockResolvedValue({ valid: true });
    render(<KeyModal onClose={() => {}} />);

    const input = screen.getByPlaceholderText(/Paste your key/i);
    await user.type(input, "enter-key{Enter}");
    await waitFor(() => expect(spy).toHaveBeenCalled());
    expect(getApiKey()).toBe("enter-key");
  });
});
