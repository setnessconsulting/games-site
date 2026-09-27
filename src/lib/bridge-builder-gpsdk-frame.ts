import {
  activateBridgeBuilderGpsdkFrame,
  type BridgeBuilderGpsdkActivationOptions,
  type BridgeBuilderGpsdkFrameActivation
} from "./gpsdk-bridge-builder-host";
import { wireStaticGameIframe } from "./static-game-iframe";

export const GPSDK_HANDSHAKE_TIMEOUT_MS = 10_000;

export type BridgeBuilderGpsdkFrameOptions = BridgeBuilderGpsdkActivationOptions & {
  handshakeTimeoutMs?: number;
  setTimeoutFn?: typeof setTimeout;
};

/**
 * Wire the static-game overlays before any GPSDK navigation, then activate the
 * host handshake. If GPSDK setup fails, the game still loads at its plain URL.
 */
export function initializeBridgeBuilderGpsdkFrame(
  stage: Element | null,
  frame: HTMLIFrameElement | null,
  entryUrl: string | null,
  statusElement: HTMLElement | null,
  options: BridgeBuilderGpsdkFrameOptions = {}
): BridgeBuilderGpsdkFrameActivation | null {
  const setTimeoutFn = options.setTimeoutFn ?? setTimeout;
  wireStaticGameIframe(stage, { setTimeoutFn });

  if (stage?.getAttribute("data-gpsdk-enabled") !== "true") return null;

  if (!frame || !entryUrl) {
    if (statusElement) statusElement.textContent = "The game connection could not be started.";
    return null;
  }

  let handshakeComplete = false;
  let pageIsLeaving = false;
  if (statusElement) statusElement.textContent = "Connecting to the game platform.";

  let activation: BridgeBuilderGpsdkFrameActivation | null = null;
  try {
    activation = activateBridgeBuilderGpsdkFrame(stage, frame, entryUrl, {
      randomUuid: options.randomUuid,
      wireHost: options.wireHost,
      onGameReady: (identity) => {
        if (handshakeComplete) return;
        handshakeComplete = true;
        if (statusElement) statusElement.textContent = "Game connection ready.";
        options.onGameReady?.(identity);
      }
    });
  } catch {
    // Loading the game is more useful than leaving an empty frame when the
    // browser cannot create ids or the host transport cannot be initialized.
  }

  if (!activation) {
    if (statusElement) {
      statusElement.textContent = "Platform connection unavailable. Loading the game normally.";
    }
    frame.setAttribute("src", entryUrl);
    return null;
  }

  const timeoutMs = options.handshakeTimeoutMs ?? GPSDK_HANDSHAKE_TIMEOUT_MS;
  setTimeoutFn(() => {
    if (!handshakeComplete && !pageIsLeaving && statusElement) {
      statusElement.textContent = "The game platform connection has not been established.";
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
