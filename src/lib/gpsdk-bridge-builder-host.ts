/**
 * Bridge Builder–only Game Platform SDK host wire (SDK-6).
 *
 * Other static-web games keep the shared StaticGameFrame without this module.
 * Activation requires data-gpsdk-channel and data-gpsdk-session on the stage.
 */

import type { GameIdentity, HostLaunchConfig } from "@setnessconsulting/game-platform-sdk/core";
import {
  IframeTransport,
  performHostHandshake,
  type HostTransport
} from "@setnessconsulting/game-platform-sdk/host";

export const BRIDGE_BUILDER_HOST_CONFIG: HostLaunchConfig = {
  protocolVersion: "1.0",
  sessionMode: "embedded",
  surfaceContext: {
    surface: "arcade",
    launchReason: "direct"
  }
};

export type GpsdkSessionIds = {
  channelId: string;
  sessionId: string;
};

export function createGpsdkSessionIds(
  randomUuid: () => string = () => crypto.randomUUID()
): GpsdkSessionIds {
  return {
    channelId: randomUuid(),
    sessionId: randomUuid()
  };
}

/** Append gpsdkChannel / gpsdkSession to a relative or absolute entry URL. */
export function appendGpsdkQuery(entryUrl: string, ids: GpsdkSessionIds): string {
  const hashIndex = entryUrl.indexOf("#");
  const withoutHash = hashIndex === -1 ? entryUrl : entryUrl.slice(0, hashIndex);
  const hash = hashIndex === -1 ? "" : entryUrl.slice(hashIndex);
  const joiner = withoutHash.includes("?") ? "&" : "?";
  return (
    `${withoutHash}${joiner}` +
    `gpsdkChannel=${encodeURIComponent(ids.channelId)}` +
    `&gpsdkSession=${encodeURIComponent(ids.sessionId)}` +
    hash
  );
}

export function readGpsdkIdsFromStage(stage: Element | null): GpsdkSessionIds | null {
  if (!stage) return null;
  const channelId = stage.getAttribute("data-gpsdk-channel");
  const sessionId = stage.getAttribute("data-gpsdk-session");
  if (!channelId || !sessionId) return null;
  return { channelId, sessionId };
}

export type BridgeBuilderHostWire = {
  transport: HostTransport;
  teardownHandshake: () => void;
  destroy: () => void;
};

/**
 * Open IframeTransport + performHostHandshake against the play iframe.
 * Returns null when the stage is not Bridge Builder GPSDK-opted-in.
 */
export function wireBridgeBuilderGpsdkHost(
  stage: Element | null,
  frame: HTMLIFrameElement | null,
  options?: {
    origin?: string;
    onGameReady?: (identity: GameIdentity) => void;
  }
): BridgeBuilderHostWire | null {
  const ids = readGpsdkIdsFromStage(stage);
  if (!ids || !frame?.contentWindow) return null;

  const origin = options?.origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  if (!origin) return null;

  const transport = new IframeTransport({
    channelId: ids.channelId,
    sessionId: ids.sessionId,
    targetWindow: frame.contentWindow,
    targetOrigin: origin,
    allowedOrigins: [origin]
  });

  const teardownHandshake = performHostHandshake(
    transport,
    BRIDGE_BUILDER_HOST_CONFIG,
    (identity) => {
      options?.onGameReady?.(identity);
    }
  );

  return {
    transport,
    teardownHandshake,
    destroy: () => {
      teardownHandshake();
      transport.destroy();
    }
  };
}
