import { describe, it, expect, beforeEach } from "vitest";
import { getApiKey, setApiKey, clearApiKey, hasApiKey } from "../../src/lib/apiKey";

describe("apiKey (localStorage BYOK store)", () => {
  beforeEach(() => localStorage.clear());

  it("returns an empty string when nothing is stored", () => {
    expect(getApiKey()).toBe("");
    expect(hasApiKey()).toBe(false);
  });

  it("persists a key and reports it as present", () => {
    setApiKey("my-key");
    expect(getApiKey()).toBe("my-key");
    expect(hasApiKey()).toBe(true);
    expect(localStorage.getItem("kie_api_key")).toBe("my-key");
  });

  it("trims whitespace on save", () => {
    setApiKey("  spaced  ");
    expect(getApiKey()).toBe("spaced");
  });

  it("clears the stored key", () => {
    setApiKey("my-key");
    clearApiKey();
    expect(getApiKey()).toBe("");
    expect(hasApiKey()).toBe(false);
  });

  it("hasApiKey is false for an empty/whitespace-only value", () => {
    setApiKey("   ");
    expect(getApiKey()).toBe("");
    expect(hasApiKey()).toBe(false);
  });
});
