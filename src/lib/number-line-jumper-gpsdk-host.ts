/**
 * Number Line Jumper's opt-in Game Platform SDK host wire.
 *
 * The default static-web frame remains unchanged. A release candidate must
 * explicitly opt in after it contains the matching SDK game runtime.
 */

import type {
  GameIdentity,
  HostLaunchConfig,
  ProtocolErrorPayload,
  SessionCompletionPayload
} from "@setnessconsulting/game-platform-sdk/core";
import {
  IframeTransport,
  performHostHandshake,
  type HostTransport
} from "@setnessconsulting/game-platform-sdk/host";
import adoption from "./number-line-jumper-gpsdk-adoption.json";

export const NUMBER_LINE_JUMPER_HOST_CONFIG: HostLaunchConfig = {
  protocolVersion: "1.0",
  sessionMode: "embedded",
  surfaceContext: {
    surface: "arcade",
    launchReason: "direct"
  }
};

export const NUMBER_LINE_JUMPER_SDK_VERSION = adoption.sdkVersion;

export type GpsdkSessionIds = {
  channelId: string;
  sessionId: string;
};

function createFallbackUuid(): string {
  const bytes = new Uint8Array(16);
  const cryptoApi = globalThis.crypto;

  if (typeof cryptoApi?.getRandomValues === "function") {
    cryptoApi.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }

  bytes[6] = (bytes[6]! & 0x0f) | 0x40;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function createDefaultUuid(): string {
  const cryptoApi = globalThis.crypto;
  return typeof cryptoApi?.randomUUID === "function"
    ? cryptoApi.randomUUID()
    : createFallbackUuid();
}

export function createGpsdkSessionIds(
  randomUuid: () => string = createDefaultUuid
): GpsdkSessionIds {
  return { channelId: randomUuid(), sessionId: randomUuid() };
}

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
  const channelId = stage?.getAttribute("data-gpsdk-channel");
  const sessionId = stage?.getAttribute("data-gpsdk-session");
  if (!channelId || !sessionId) return null;
  return { channelId, sessionId };
}

function isExpectedGame(value: unknown): value is GameIdentity {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const identity = value as Record<string, unknown>;
  return (
    identity.gameId === adoption.gameId &&
    typeof identity.gameVersion === "string" &&
    identity.gameVersion.length > 0 &&
    identity.sdkVersion === adoption.sdkVersion &&
    identity.protocolVersion === "1.0" &&
    identity.runtimeKind === "web-dom" &&
    typeof identity.capabilities === "object" &&
    identity.capabilities !== null &&
    !Array.isArray(identity.capabilities)
  );
}

function isCompletionPayload(
  value: unknown,
  sessionId: string,
  identity: GameIdentity
): value is SessionCompletionPayload {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return false;
  const payload = value as Record<string, unknown>;
  return (
    payload.sessionId === sessionId &&
    payload.gameId === identity.gameId &&
    payload.gameVersion === identity.gameVersion &&
    typeof payload.durationMs === "number" &&
    Number.isFinite(payload.durationMs) &&
    payload.durationMs >= 0 &&
    ["user-exit", "deadline", "game-completed", "host-exit", "error"].includes(
      String(payload.reason)
    )
  );
}

export type NumberLineJumperGpsdkHostWire = {
  transport: HostTransport;
  teardownHandshake: () => void;
  destroy: () => void;
};

export type NumberLineJumperGpsdkHostOptions = {
  origin?: string;
  onGameReady?: (identity: GameIdentity) => void;
  onGameRejected?: () => void;
  onGameError?: (error: ProtocolErrorPayload) => void;
  onSessionComplete?: (payload: SessionCompletionPayload) => void;
};

export type NumberLineJumperGpsdkActivationOptions = NumberLineJumperGpsdkHostOptions & {
  randomUuid?: () => string;
  wireHost?: (
    stage: Element | null,
    frame: HTMLIFrameElement | null,
    options?: NumberLineJumperGpsdkHostOptions
  ) => NumberLineJumperGpsdkHostWire | null;
};

export type NumberLineJumperGpsdkFrameActivation = {
  ids: GpsdkSessionIds;
  wire: NumberLineJumperGpsdkHostWire;
};

export function wireNumberLineJumperGpsdkHost(
  stage: Element | null,
  frame: HTMLIFrameElement | null,
  options: NumberLineJumperGpsdkHostOptions = {}
): NumberLineJumperGpsdkHostWire | null {
  const ids = readGpsdkIdsFromStage(stage);
  if (!ids || !frame?.contentWindow) return null;

  const origin = options.origin ?? (typeof window !== "undefined" ? window.location.origin : "");
  if (!origin || origin === "null") return null;

  const transport = new IframeTransport({
    channelId: ids.channelId,
    sessionId: ids.sessionId,
    targetWindow: frame.contentWindow,
    targetOrigin: origin,
    allowedOrigins: [origin]
  });
  let acceptedIdentity: GameIdentity | null = null;
  let completionSeen = false;
  const handshakeTransport: HostTransport = {
    get channelId() {
      return transport.channelId;
    },
    get sessionId() {
      return transport.sessionId;
    },
    sendMessage: (messageType, payload) => transport.sendMessage(messageType, payload),
    onMessage: (handler) =>
      transport.onMessage((envelope) => {
        if (envelope.messageType === "HANDSHAKE_INIT") {
          const payload = envelope.payload;
          const identity =
            typeof payload === "object" && payload !== null && !Array.isArray(payload)
              ? (payload as Record<string, unknown>).gameIdentity
              : null;
          if (!isExpectedGame(identity)) {
            options.onGameRejected?.();
            return;
          }
        }
        handler(envelope);
      }),
    destroy: () => transport.destroy()
  };
  const teardownHandshake = performHostHandshake(
    handshakeTransport,
    NUMBER_LINE_JUMPER_HOST_CONFIG,
    (identity) => {
      acceptedIdentity = identity;
      options.onGameReady?.(identity);
    }
  );
  const unsubscribeError = transport.onMessage((envelope) => {
    if (envelope.messageType === "ERROR_SIGNAL" && acceptedIdentity) {
      options.onGameError?.(envelope.payload as ProtocolErrorPayload);
    }
  });
  const unsubscribeCompletion = transport.onMessage((envelope) => {
    if (
      acceptedIdentity &&
      !completionSeen &&
      envelope.messageType === "COMPLETE_SESSION" &&
      isCompletionPayload(envelope.payload, ids.sessionId, acceptedIdentity)
    ) {
      completionSeen = true;
      options.onSessionComplete?.(envelope.payload);
    }
  });

  return {
    transport,
    teardownHandshake,
    destroy: () => {
      teardownHandshake();
      unsubscribeError();
      unsubscribeCompletion();
      transport.destroy();
    }
  };
}

export function activateNumberLineJumperGpsdkFrame(
  stage: Element | null,
  frame: HTMLIFrameElement | null,
  entryUrl: string,
  options: NumberLineJumperGpsdkActivationOptions = {}
): NumberLineJumperGpsdkFrameActivation | null {
  if (!stage || !frame) return null;

  const ids = createGpsdkSessionIds(options.randomUuid);
  stage.setAttribute("data-gpsdk-channel", ids.channelId);
  stage.setAttribute("data-gpsdk-session", ids.sessionId);

  const wire = (options.wireHost ?? wireNumberLineJumperGpsdkHost)(stage, frame, {
    origin: options.origin,
    onGameReady: options.onGameReady,
    onGameRejected: options.onGameRejected,
    onGameError: options.onGameError,
    onSessionComplete: options.onSessionComplete
  });
  if (!wire) return null;

  frame.setAttribute("src", appendGpsdkQuery(entryUrl, ids));
  return { ids, wire };
}
