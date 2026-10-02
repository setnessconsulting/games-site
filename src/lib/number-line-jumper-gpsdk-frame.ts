import {
  activateNumberLineJumperGpsdkFrame,
  type NumberLineJumperGpsdkActivationOptions,
  type NumberLineJumperGpsdkFrameActivation
} from "./number-line-jumper-gpsdk-host";
import { wireStaticGameIframe } from "./static-game-iframe";

export const GPSDK_HANDSHAKE_TIMEOUT_MS = 10_000;

export type NumberLineJumperGpsdkFrameOptions = NumberLineJumperGpsdkActivationOptions & {
  handshakeTimeoutMs?: number;
  setTimeoutFn?: typeof setTimeout;
};

/** Keep the existing static frame behavior unless this candidate opts in. */
export function initializeNumberLineJumperGpsdkFrame(
  stage: Element | null,
  frame: HTMLIFrameElement | null,
  entryUrl: string | null,
  statusElement: HTMLElement | null,
  options: NumberLineJumperGpsdkFrameOptions = {}
): NumberLineJumperGpsdkFrameActivation | null {
  const setTimeoutFn = options.setTimeoutFn ?? setTimeout;
  const gpsdkEnabled = stage?.getAttribute("data-gpsdk-enabled") === "true";
  const timeoutMs = options.handshakeTimeoutMs ?? GPSDK_HANDSHAKE_TIMEOUT_MS;
  wireStaticGameIframe(stage, {
    setTimeoutFn,
    timeoutMs: gpsdkEnabled ? timeoutMs + 5_000 : undefined
  });

  if (!gpsdkEnabled) return null;

  if (!frame || !entryUrl) {
    if (statusElement) statusElement.textContent = "The game connection could not be started.";
    return null;
  }

  let handshakeComplete = false;
  let handshakeRejected = false;
  let pageIsLeaving = false;
  let fallbackStarted = false;
  if (statusElement) statusElement.textContent = "Connecting to the game platform.";

  let activation: NumberLineJumperGpsdkFrameActivation | null = null;
  const fallbackToStandalone = (message: string) => {
    if (fallbackStarted || handshakeComplete || pageIsLeaving) return;
    fallbackStarted = true;
    handshakeRejected = true;
    if (handshakeTimeoutId !== undefined) clearTimeout(handshakeTimeoutId);
    activation?.wire.destroy();
    if (statusElement) statusElement.textContent = message;
    frame.removeAttribute("hidden");
    stage?.querySelector("[data-static-game-loading]")?.setAttribute("hidden", "true");
    stage?.querySelector("[data-static-game-error]")?.setAttribute("hidden", "true");
    frame.setAttribute("src", entryUrl);
  };
  try {
    activation = activateNumberLineJumperGpsdkFrame(stage, frame, entryUrl, {
      randomUuid: options.randomUuid,
      wireHost: options.wireHost,
      origin: options.origin,
      onGameReady: (identity) => {
        if (handshakeComplete) return;
        handshakeComplete = true;
        if (handshakeTimeoutId !== undefined) clearTimeout(handshakeTimeoutId);
        if (statusElement) statusElement.textContent = "Game connection ready.";
        options.onGameReady?.(identity);
      },
      onGameRejected: () => {
        fallbackToStandalone(
          "The game connection returned an unexpected identity. Loading standalone play."
        );
        options.onGameRejected?.();
      },
      onGameError: () => {
        fallbackToStandalone("The platform connection failed. Loading standalone play.");
      },
      onSessionComplete: (payload) => {
        if (statusElement) statusElement.textContent = "The game session has ended.";
        options.onSessionComplete?.(payload);
      }
    });
  } catch {
    // The plain game URL remains useful if the browser cannot create the SDK transport.
  }

  if (!activation) {
    if (statusElement)
      statusElement.textContent = "Platform connection unavailable. Loading the game normally.";
    frame.setAttribute("src", entryUrl);
    return null;
  }

  const handshakeTimeoutId = setTimeoutFn(() => {
    if (!handshakeComplete && !handshakeRejected && !pageIsLeaving) {
      fallbackToStandalone("The platform connection timed out. Loading standalone play.");
    }
  }, timeoutMs);

  if (typeof window !== "undefined") {
    window.addEventListener(
      "pagehide",
      () => {
        pageIsLeaving = true;
        activation?.wire.destroy();
      },
      { once: true }
    );
  }

  return activation;
}
