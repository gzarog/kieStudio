import "@testing-library/jest-dom/vitest";
import { afterEach, beforeAll, vi } from "vitest";
import { cleanup } from "@testing-library/react";

// Throttle is a no-op in tests — real rate limiting is only useful live.
vi.mock("../src/lib/throttle", () => ({ acquireToken: () => Promise.resolve() }));

// Vault uses IndexedDB which jsdom doesn't support.
vi.mock("../src/lib/vault", () => ({
  vaultSave: vi.fn(() => Promise.resolve(true)),
  vaultGet: vi.fn(() => Promise.resolve(null)),
  vaultHas: vi.fn(() => Promise.resolve(false)),
  vaultDelete: vi.fn(() => Promise.resolve(undefined)),
  vaultUsage: vi.fn(() => Promise.resolve({ used: 0, cap: 500 * 1024 * 1024 })),
}));

// jsdom doesn't implement layout APIs the pages call — provide no-op stubs.
beforeAll(() => {
  Element.prototype.scrollIntoView = vi.fn();
});

// Unmount React trees and reset the DOM between tests.
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.clearAllTimers();
  localStorage.clear();
  sessionStorage.clear();
});
