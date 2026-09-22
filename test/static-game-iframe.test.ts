/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from "vitest";
import { probeEntryUrl, wireStaticGameIframe, type FetchLike } from "../src/lib/static-game-iframe";

function mockResponse(status: number): Response {
  return new Response(null, { status });
}

describe("probeEntryUrl", () => {
  it("returns true when HEAD succeeds", async () => {
    const fetchImpl: FetchLike = vi.fn(async () => mockResponse(200));
    await expect(probeEntryUrl("/game-assets/x/1/index.html", fetchImpl)).resolves.toBe(true);
    expect(fetchImpl).toHaveBeenCalledWith("/game-assets/x/1/index.html", {
      method: "HEAD",
      cache: "no-store"
    });
  });

  it("returns false when HEAD is 404", async () => {
    const fetchImpl: FetchLike = vi.fn(async () => mockResponse(404));
    await expect(probeEntryUrl("/missing", fetchImpl)).resolves.toBe(false);
  });

  it("falls back to a ranged GET when HEAD is not allowed", async () => {
    const fetchImpl: FetchLike = vi.fn(async (_url, init) => {
      if (init?.method === "HEAD") return mockResponse(405);
      return mockResponse(206);
    });
    await expect(probeEntryUrl("/asset", fetchImpl)).resolves.toBe(true);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
  });

  it("returns false when fetch throws", async () => {
    const fetchImpl: FetchLike = vi.fn(async () => {
      throw new Error("network down");
    });
    await expect(probeEntryUrl("/asset", fetchImpl)).resolves.toBe(false);
  });
});

describe("wireStaticGameIframe", () => {
  function buildStage() {
    const stage = document.createElement("div");
    stage.innerHTML = `
      <div data-static-game-loading></div>
      <div data-static-game-error hidden></div>
      <iframe data-static-game-frame></iframe>
    `;
    document.body.appendChild(stage);
    const frame = stage.querySelector<HTMLIFrameElement>("[data-static-game-frame]")!;
    frame.getAttribute = ((name: string) =>
      name === "src" ? "/game-assets/demo/1/index.html" : null) as typeof frame.getAttribute;
    return {
      stage,
      loading: stage.querySelector("[data-static-game-loading]")!,
      error: stage.querySelector("[data-static-game-error]")!,
      frame
    };
  }

  it("shows the error panel when the entry URL probe fails after load", async () => {
    const { stage, loading, error, frame } = buildStage();
    const fetchImpl: FetchLike = vi.fn(async () => mockResponse(404));

    wireStaticGameIframe(stage, { fetchImpl, timeoutMs: 60_000 });
    frame.dispatchEvent(new Event("load"));
    await vi.waitFor(() => {
      expect(error.hasAttribute("hidden")).toBe(false);
    });

    expect(loading.hasAttribute("hidden")).toBe(true);
    expect(frame.hasAttribute("hidden")).toBe(true);
  });

  it("hides loading when the entry URL probe succeeds after load", async () => {
    const { stage, loading, error, frame } = buildStage();
    const fetchImpl: FetchLike = vi.fn(async () => mockResponse(200));

    wireStaticGameIframe(stage, { fetchImpl, timeoutMs: 60_000 });
    frame.dispatchEvent(new Event("load"));
    await vi.waitFor(() => {
      expect(loading.hasAttribute("hidden")).toBe(true);
    });

    expect(error.hasAttribute("hidden")).toBe(true);
    expect(frame.hasAttribute("hidden")).toBe(false);
  });

  it("shows the error panel when the iframe error event fires", () => {
    const { stage, loading, error, frame } = buildStage();

    wireStaticGameIframe(stage, {
      fetchImpl: vi.fn(async () => mockResponse(200)),
      timeoutMs: 60_000
    });
    frame.dispatchEvent(new Event("error"));

    expect(loading.hasAttribute("hidden")).toBe(true);
    expect(error.hasAttribute("hidden")).toBe(false);
    expect(frame.hasAttribute("hidden")).toBe(true);
  });

  it("shows the error panel when the readiness timeout elapses", async () => {
    const { stage, loading, error, frame } = buildStage();
    const timers: Array<() => void> = [];
    const setTimeoutFn = ((fn: () => void) => {
      timers.push(fn);
      return 0;
    }) as typeof setTimeout;

    wireStaticGameIframe(stage, {
      fetchImpl: vi.fn(async () => mockResponse(200)),
      timeoutMs: 1,
      setTimeoutFn
    });
    expect(timers).toHaveLength(1);
    timers[0]!();

    expect(loading.hasAttribute("hidden")).toBe(true);
    expect(error.hasAttribute("hidden")).toBe(false);
    expect(frame.hasAttribute("hidden")).toBe(true);
  });
});
