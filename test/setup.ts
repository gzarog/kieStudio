import "@testing-library/jest-dom/vitest";
import { afterEach, beforeAll, vi } from "vitest";
import { cleanup } from "@testing-library/react";

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
