/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from "vitest";
import type {
  ProtocolEnvelope,
  SessionCompletionPayload
} from "@setnessconsulting/game-platform-sdk/core";
import {
  NUMBER_LINE_JUMPER_SDK_VERSION,
  NUMBER_LINE_JUMPER_HOST_CONFIG,
  wireNumberLineJumperGpsdkHost
} from "../src/lib/number-line-jumper-gpsdk-host";

function createHostHarness() {
  const stage = document.createElement("div");
  stage.setAttribute("data-gpsdk-channel", "channel-a");
  stage.setAttribute("data-gpsdk-session", "session-b");
  const frame = document.createElement("iframe");
  const targetWindow = { postMessage: vi.fn() } as unknown as Window;
  Object.defineProperty(frame, "contentWindow", { value: targetWindow });
  return { frame, stage, targetWindow };
}

function identity(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    gameId: "number-line-jumper",
    gameVersion: "4.2.0",
    sdkVersion: NUMBER_LINE_JUMPER_SDK_VERSION,
    protocolVersion: "1.0",
    runtimeKind: "web-dom",
    capabilities: { canPause: false },
    ...overrides
  };
}

function dispatch(
  targetWindow: Window,
  channelId: string,
  sessionId: string,
  messageType: string,
  payload: unknown,
  sequenceNumber = 0
) {
  const envelope: ProtocolEnvelope = {
    protocolVersion: "1.0",
    channelId,
    sessionId,
    messageId: `${messageType}-${sequenceNumber}`,
    sequenceNumber,
    timestampEpochMs: Date.now(),
    messageType: messageType as ProtocolEnvelope["messageType"],
    payload
  };
  window.dispatchEvent(
    new MessageEvent("message", {
      data: JSON.stringify(envelope),
      origin: window.location.origin,
      source: targetWindow
    })
  );
}

describe("Number Line Jumper GPSDK host wire", () => {
  it("accepts a matching game and binds completion to the exact accepted identity", () => {
    const { frame, stage, targetWindow } = createHostHarness();
    const onGameReady = vi.fn();
    const onSessionComplete = vi.fn();
    const wire = wireNumberLineJumperGpsdkHost(stage, frame, {
      onGameReady,
      onSessionComplete
    });
    const acceptedIdentity = identity({ gameVersion: "7.8.9" });

    dispatch(targetWindow, "channel-a", "session-b", "HANDSHAKE_INIT", {
      gameIdentity: acceptedIdentity
    });

    expect(wire).not.toBeNull();
    expect(onGameReady).toHaveBeenCalledWith(acceptedIdentity);
    expect(targetWindow.postMessage).toHaveBeenCalledTimes(1);
    const ack = JSON.parse(vi.mocked(targetWindow.postMessage).mock.calls[0]![0] as string);
    expect(ack.messageType).toBe("HANDSHAKE_ACK");
    expect(ack.payload.hostConfig).toEqual(NUMBER_LINE_JUMPER_HOST_CONFIG);

    const completion: SessionCompletionPayload = {
      sessionId: "session-b",
      gameId: acceptedIdentity.gameId as string,
      gameVersion: acceptedIdentity.gameVersion as string,
      durationMs: 1_200,
      reason: "user-exit"
    };
    dispatch(targetWindow, "channel-a", "session-b", "COMPLETE_SESSION", completion, 1);
    dispatch(targetWindow, "channel-a", "session-b", "COMPLETE_SESSION", completion, 2);

    expect(onSessionComplete).toHaveBeenCalledTimes(1);
    expect(onSessionComplete).toHaveBeenCalledWith(completion);
    wire?.destroy();
  });

  it("rejects a game with a different SDK version before acknowledging it", () => {
    const { frame, stage, targetWindow } = createHostHarness();
    const onGameRejected = vi.fn();
    const wire = wireNumberLineJumperGpsdkHost(stage, frame, { onGameRejected });

    dispatch(targetWindow, "channel-a", "session-b", "HANDSHAKE_INIT", {
      gameIdentity: identity({ sdkVersion: "0.0.0" })
    });

    expect(onGameRejected).toHaveBeenCalledOnce();
    expect(targetWindow.postMessage).not.toHaveBeenCalled();
    wire?.destroy();
  });

  it("reports game timeout signals to the frame owner", () => {
    const { frame, stage, targetWindow } = createHostHarness();
    const onGameError = vi.fn();
    const wire = wireNumberLineJumperGpsdkHost(stage, frame, { onGameError });
    const error = {
      code: "TRANSPORT_FAILURE",
      severity: "recoverable",
      source: "game",
      message: "The game platform handshake timed out."
    };

    dispatch(targetWindow, "channel-a", "session-b", "HANDSHAKE_INIT", {
      gameIdentity: identity()
    });
    dispatch(targetWindow, "channel-a", "session-b", "ERROR_SIGNAL", error, 1);

    expect(onGameError).toHaveBeenCalledWith(error);
    wire?.destroy();
  });

  it("refuses an opaque origin", () => {
    const { frame, stage } = createHostHarness();
    expect(wireNumberLineJumperGpsdkHost(stage, frame, { origin: "null" })).toBeNull();
  });
});
