import { describe, it, expect, afterEach } from "vitest";
import { render, screen, act, cleanup } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Toaster } from "../../src/components/shared/Toaster";
import { toast, dismissToast, subscribeToasts, type Toast } from "../../src/lib/ui";

afterEach(() => {
  // Unmount first so draining toasts doesn't update a live component (act warning).
  cleanup();
  let current: Toast[] = [];
  const unsub = subscribeToasts((t) => (current = t));
  for (const t of current) dismissToast(t.id);
  unsub();
});

describe("<Toaster />", () => {
  it("renders nothing when there are no toasts", () => {
    const { container } = render(<Toaster />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders a toast pushed via the toast() bus", () => {
    render(<Toaster />);
    act(() => {
      toast("saved!", "success", 0);
    });
    expect(screen.getByText("saved!")).toBeInTheDocument();
  });

  it("renders multiple toasts", () => {
    render(<Toaster />);
    act(() => {
      toast("one", "info", 0);
      toast("two", "error", 0);
    });
    expect(screen.getByText("one")).toBeInTheDocument();
    expect(screen.getByText("two")).toBeInTheDocument();
  });

  it("dismisses a toast when clicked", async () => {
    const user = userEvent.setup();
    render(<Toaster />);
    act(() => {
      toast("click me", "info", 0);
    });
    await user.click(screen.getByText("click me"));
    expect(screen.queryByText("click me")).not.toBeInTheDocument();
  });
});
