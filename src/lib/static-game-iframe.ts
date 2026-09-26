/**
 * Shared iframe readiness for static-web play frames.
 * Iframe `error` events are unreliable; a same-origin HEAD probe catches missing
 * `/game-assets` responses that still fire `load` (e.g. under plain `astro preview`).
 */

export const STATIC_GAME_IFRAME_TIMEOUT_MS = 12_000;

export type FetchLike = (
  input: string,
  init?: { method?: string; cache?: RequestCache; headers?: HeadersInit }
) => Promise<Response>;

/** Returns true when the entry URL responds successfully (HEAD, with GET fallback). */
export async function probeEntryUrl(url: string, fetchImpl: FetchLike = fetch): Promise<boolean> {
  try {
    const head = await fetchImpl(url, { method: "HEAD", cache: "no-store" });
    if (head.ok) return true;
    if (head.status === 405 || head.status === 501) {
      const ranged = await fetchImpl(url, {
        method: "GET",
        cache: "no-store",
        headers: { Range: "bytes=0-0" }
      });
      return ranged.ok || ranged.status === 206;
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Wire loading/error overlays for a static iframe stage.
 * Expects `[data-static-game-loading]`, `[data-static-game-error]`, and
 * `[data-static-game-frame]` under `stage`.
 *
 * When `onFrameReady` is supplied it runs once the entry URL probe succeeds.
 * It may return a teardown callback that runs if the stage later shows an error
 * (or when a subsequent ready is impossible — callers typically tear down on page unload).
 */
export function wireStaticGameIframe(
  stage: Element | null,
  options: {
    fetchImpl?: FetchLike;
    timeoutMs?: number;
    setTimeoutFn?: typeof setTimeout;
    onFrameReady?: (frame: HTMLIFrameElement) => void | (() => void);
  } = {}
): void {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? STATIC_GAME_IFRAME_TIMEOUT_MS;
  const setTimeoutFn = options.setTimeoutFn ?? setTimeout;

  const loading = stage?.querySelector("[data-static-game-loading]");
  const error = stage?.querySelector("[data-static-game-error]");
  const frame = stage?.querySelector<HTMLIFrameElement>("[data-static-game-frame]");

  let settled = false;
  let readyTeardown: (() => void) | undefined;

  const showError = () => {
    if (settled) return;
    settled = true;
    readyTeardown?.();
    readyTeardown = undefined;
    loading?.setAttribute("hidden", "true");
    frame?.setAttribute("hidden", "true");
    error?.removeAttribute("hidden");
  };

  const showReady = () => {
    if (settled) return;
    settled = true;
    loading?.setAttribute("hidden", "true");
    if (frame && options.onFrameReady) {
      const teardown = options.onFrameReady(frame);
      if (typeof teardown === "function") readyTeardown = teardown;
    }
  };

  if (!stage || !loading || !error || !frame) {
    showError();
    return;
  }

  frame.addEventListener("error", () => {
    showError();
  });

  frame.addEventListener("load", () => {
    void (async () => {
      const entryUrl = frame.getAttribute("src") || frame.src;
      if (!entryUrl) {
        showError();
        return;
      }
      const ok = await probeEntryUrl(entryUrl, fetchImpl);
      if (ok) showReady();
      else showError();
    })();
  });

  setTimeoutFn(() => {
    if (!settled) showError();
  }, timeoutMs);
}
