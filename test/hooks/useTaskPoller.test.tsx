import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTaskPoller } from "../../src/hooks/useTaskPoller";
import * as kieClient from "../../src/lib/kieClient";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

// Advance the fake clock by `ms` and flush the async work the interval kicks off.
const tick = (ms: number) => act(async () => void (await vi.advanceTimersByTimeAsync(ms)));

describe("useTaskPoller", () => {
  it("starts idle with no result or error", () => {
    const { result } = renderHook(() => useTaskPoller<{ imageUrl: string }>("/image"));
    expect(result.current.status).toBe("idle");
    expect(result.current.result).toBeNull();
    expect(result.current.error).toBe("");
  });

  it("goes pending, then success and stops polling when the task completes", async () => {
    const get = vi
      .spyOn(kieClient, "getFromWorker")
      .mockResolvedValueOnce({ status: "pending", result: null })
      .mockResolvedValueOnce({ status: "success", result: { imageUrl: "http://img/1.png" } });

    const { result } = renderHook(() => useTaskPoller<{ imageUrl: string }>("/image", 1000));

    act(() => result.current.startPolling("T1", { model: "gpt-image-2" }));
    expect(result.current.status).toBe("pending");

    await tick(1000); // first poll: still pending
    expect(result.current.status).toBe("pending");

    await tick(1000); // second poll: success
    expect(result.current.status).toBe("success");
    expect(result.current.result).toEqual({ imageUrl: "http://img/1.png" });

    // Polling stopped — no further calls after success.
    const callsAfterSuccess = get.mock.calls.length;
    await tick(5000);
    expect(get.mock.calls.length).toBe(callsAfterSuccess);

    // The taskId + params were sent as the query string.
    expect(get.mock.calls[0][0]).toBe("/image?taskId=T1&model=gpt-image-2");
  });

  it("transitions to failed with the upstream error message", async () => {
    vi.spyOn(kieClient, "getFromWorker").mockResolvedValueOnce({
      status: "failed",
      result: null,
      error: "moderation",
    });

    const { result } = renderHook(() => useTaskPoller("/music", 1000));
    act(() => result.current.startPolling("M1"));
    await tick(1000);
    expect(result.current.status).toBe("failed");
    expect(result.current.error).toBe("moderation");
  });

  it("uses a default failure message when none is provided", async () => {
    vi.spyOn(kieClient, "getFromWorker").mockResolvedValueOnce({ status: "failed", result: null });
    const { result } = renderHook(() => useTaskPoller("/music", 1000));
    act(() => result.current.startPolling("M1"));
    await tick(1000);
    expect(result.current.error).toBe("Generation failed");
  });

  it("marks the task failed when the poll request throws", async () => {
    vi.spyOn(kieClient, "getFromWorker").mockRejectedValueOnce(new Error("network"));
    const { result } = renderHook(() => useTaskPoller("/video", 1000));
    act(() => result.current.startPolling("V1"));
    await tick(1000);
    expect(result.current.status).toBe("failed");
    expect(result.current.error).toBe("network");
  });

  it("stops polling when the component unmounts", async () => {
    const get = vi
      .spyOn(kieClient, "getFromWorker")
      .mockResolvedValue({ status: "pending", result: null });
    const { result, unmount } = renderHook(() => useTaskPoller("/image", 1000));
    act(() => result.current.startPolling("T1"));
    unmount();
    const before = get.mock.calls.length;
    await tick(5000);
    expect(get.mock.calls.length).toBe(before);
  });
});
