import { describe, it, expect, vi, afterEach } from "vitest";
import { loadHistory, saveHistory, daysLeft, expiryLabel, RETENTION_DAYS } from "../../src/lib/history";

afterEach(() => vi.useRealTimers());

const DAY = 86_400_000;

describe("history persistence", () => {
  it("round-trips entries through localStorage under a per-page key", () => {
    saveHistory("image", [{ imageUrl: "u", createdAt: 1 }]);
    expect(loadHistory("image")).toEqual([{ imageUrl: "u", createdAt: 1 }]);
    expect(localStorage.getItem("kie.history.image")).toBeTruthy();
    // Pages are isolated from each other.
    expect(loadHistory("video")).toEqual([]);
  });

  it("returns [] for missing or corrupt storage", () => {
    expect(loadHistory("nope")).toEqual([]);
    localStorage.setItem("kie.history.bad", "{not json");
    expect(loadHistory("bad")).toEqual([]);
    localStorage.setItem("kie.history.obj", '{"a":1}');
    expect(loadHistory("obj")).toEqual([]);
  });

  it("caps persisted history at 50 entries", () => {
    const many = Array.from({ length: 80 }, (_, i) => ({ i }));
    saveHistory("image", many);
    expect(loadHistory("image")).toHaveLength(50);
    expect(loadHistory<{ i: number }>("image")[0].i).toBe(0); // newest kept
  });
});

describe("expiry math (14-day retention)", () => {
  it("daysLeft counts down from the retention window", () => {
    vi.useFakeTimers();
    const now = Date.now();
    expect(daysLeft(now)).toBe(RETENTION_DAYS);
    expect(daysLeft(now - 3 * DAY)).toBe(11);
    expect(daysLeft(now - 14 * DAY)).toBe(0);
    expect(daysLeft(now - 20 * DAY)).toBeLessThan(0);
  });

  it("expiryLabel wording", () => {
    vi.useFakeTimers();
    const now = Date.now();
    expect(expiryLabel(now)).toBe("expires in 14 days");
    expect(expiryLabel(now - 13.5 * DAY)).toBe("expires within a day");
    expect(expiryLabel(now - 15 * DAY)).toBe("may have expired");
  });
});
