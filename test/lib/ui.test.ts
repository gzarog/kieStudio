import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  toast,
  dismissToast,
  subscribeToasts,
  requestKey,
  subscribeKeyRequests,
  type Toast,
} from "../../src/lib/ui";

beforeEach(() => {
  vi.useRealTimers();
  // Drain any toasts left over from a previous test.
  let current: Toast[] = [];
  const unsub = subscribeToasts((t) => (current = t));
  for (const t of current) dismissToast(t.id);
  unsub();
});

describe("ui: toast bus", () => {
  it("delivers the current toast list to a new subscriber immediately", () => {
    const seen: Toast[][] = [];
    const unsub = subscribeToasts((t) => seen.push(t));
    expect(seen[0]).toEqual([]);
    unsub();
  });

  it("emits added toasts with an incrementing id, message and kind", () => {
    let latest: Toast[] = [];
    const unsub = subscribeToasts((t) => (latest = t));

    toast("hello", "success", 0);
    expect(latest).toHaveLength(1);
    expect(latest[0]).toMatchObject({ message: "hello", kind: "success" });

    toast("world", "error", 0);
    expect(latest).toHaveLength(2);
    expect(latest[1].id).toBeGreaterThan(latest[0].id);
    unsub();
  });

  it("defaults kind to info", () => {
    let latest: Toast[] = [];
    const unsub = subscribeToasts((t) => (latest = t));
    toast("plain", undefined, 0);
    expect(latest.at(-1)!.kind).toBe("info");
    unsub();
  });

  it("dismissToast removes a specific toast", () => {
    let latest: Toast[] = [];
    const unsub = subscribeToasts((t) => (latest = t));
    toast("a", "info", 0);
    const id = latest[0].id;
    dismissToast(id);
    expect(latest.find((t) => t.id === id)).toBeUndefined();
    unsub();
  });

  it("auto-dismisses after the ttl elapses", () => {
    vi.useFakeTimers();
    let latest: Toast[] = [];
    const unsub = subscribeToasts((t) => (latest = t));
    toast("temp", "info", 1000);
    expect(latest).toHaveLength(1);
    vi.advanceTimersByTime(1000);
    expect(latest).toHaveLength(0);
    unsub();
    vi.useRealTimers();
  });

  it("stops notifying after unsubscribe", () => {
    const spy = vi.fn();
    const unsub = subscribeToasts(spy);
    unsub();
    spy.mockClear();
    toast("ignored", "info", 0);
    expect(spy).not.toHaveBeenCalled();
  });
});

describe("ui: key-modal bus", () => {
  it("notifies every subscriber when requestKey is called", () => {
    const a = vi.fn();
    const b = vi.fn();
    const ua = subscribeKeyRequests(a);
    const ub = subscribeKeyRequests(b);
    requestKey();
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
    ua();
    ub();
  });

  it("does not notify after unsubscribe", () => {
    const a = vi.fn();
    subscribeKeyRequests(a)();
    requestKey();
    expect(a).not.toHaveBeenCalled();
  });
});
