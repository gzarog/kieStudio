import { describe, it, expect, vi } from "vitest";
import { subscribeCredits, setCredits, refreshCredits } from "../../src/lib/credits";
import { setApiKey, clearApiKey } from "../../src/lib/apiKey";
import { fetchResponse } from "../helpers";

describe("credits bus", () => {
  it("broadcasts the current value to subscribers (immediately and on change)", () => {
    const seen: (number | null)[] = [];
    const unsub = subscribeCredits((c) => seen.push(c));
    setCredits(42);
    setCredits(41);
    unsub();
    setCredits(0);
    expect(seen.slice(-2)).toEqual([42, 41]);
  });

  it("refreshCredits is a no-op without a key", async () => {
    clearApiKey();
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    await refreshCredits();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("refreshCredits pulls the numeric credits from /validate and broadcasts", async () => {
    setApiKey("k");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fetchResponse({ valid: true, credits: 77 })));
    let latest: number | null = null;
    const unsub = subscribeCredits((c) => { latest = c; });
    await refreshCredits();
    unsub();
    expect(latest).toBe(77);
  });

  it("keeps the last value when validation fails", async () => {
    setApiKey("k");
    setCredits(10);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(fetchResponse({ valid: false })));
    let latest: number | null = null;
    const unsub = subscribeCredits((c) => { latest = c; });
    await refreshCredits();
    unsub();
    expect(latest).toBe(10);
  });
});
