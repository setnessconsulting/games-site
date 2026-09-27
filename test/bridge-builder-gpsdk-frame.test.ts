/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from "vitest";
import {
  BRIDGE_BUILDER_HOST_CONFIG,
  type BridgeBuilderGpsdkActivationOptions,
  type GpsdkSessionIds
} from "../src/lib/gpsdk-bridge-builder-host";
import {
  GPSDK_HANDSHAKE_TIMEOUT_MS,
  initializeBridgeBuilderGpsdkFrame
} from "../src/lib/bridge-builder-gpsdk-frame";

const ENTRY_URL = "/game-assets/bridge-builder/0.1.0/index.html";

function createTestTimer(scheduled: Array<() => void>): typeof setTimeout {
  return ((callback: () => void) => {
    scheduled.push(callback);
    return scheduled.length as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;
}

function createHarness(wireHost?: BridgeBuilderGpsdkActivationOptions["wireHost"]) {
  const stage = document.createElement("div");
  stage.setAttribute("data-gpsdk-enabled", "true");
  stage.innerHTML = `
    <div data-static-game-loading></div>
    <div data-static-game-error hidden></div>
    <p data-gpsdk-handshake-status role="status"></p>
    <iframe data-static-game-frame></iframe>
  `;

  const frame = stage.querySelector<HTMLIFrameElement>("[data-static-game-frame]")!;
  const status = stage.querySelector<HTMLElement>("[data-gpsdk-handshake-status]")!;
  const targetWindow = { postMessage: vi.fn() } as unknown as Window;
  Object.defineProperty(frame, "contentWindow", { value: targetWindow });
  const scheduled: Array<() => void> = [];
  const activation = initializeBridgeBuilderGpsdkFrame(stage, frame, ENTRY_URL, status, {
    randomUuid: (() => {
      let nextId = 0;
      return () => `session-${++nextId}`;
    })(),
    wireHost,
    setTimeoutFn: createTestTimer(scheduled)
  });

  return {
    activation,
    frame,
    scheduled,
    stage,
    status,
    targetWindow
  };
}

function makeHandshake(
  ids: GpsdkSessionIds,
  overrides: { channelId?: string; sessionId?: string } = {}
) {
  return {
    protocolVersion: "1.0",
    channelId: ids.channelId,
    sessionId: ids.sessionId,
    messageId: "game-handshake-1",
    sequenceNumber: 0,
    timestampEpochMs: Date.now(),
    messageType: "HANDSHAKE_INIT",
    payload: {
      gameIdentity: {
        gameId: "bridge-builder",
        gameVersion: "0.1.0-qualification.10",
        sdkVersion: "0.1.1",
        protocolVersion: "1.0",
        runtimeKind: "web-dom",
        capabilities: {}
      }
    },
    ...overrides
  };
}

function dispatchGameMessage(
  targetWindow: Window,
  envelope: unknown,
  origin = window.location.origin
) {
  window.dispatchEvent(
    new MessageEvent("message", {
      data: JSON.stringify(envelope),
      origin,
      source: targetWindow
    })
  );
}

describe("Bridge Builder GPSDK frame initialization", () => {
  it("accepts the real SDK handshake boundary, replies with ACK, and announces readiness", () => {
    const harness = createHarness();
    const { activation, status, targetWindow } = harness;

    expect(activation).not.toBeNull();
    expect(status.textContent).toBe("Connecting to the game platform.");
    const ids = activation!.ids;
    const handshake = makeHandshake(ids);

    dispatchGameMessage(targetWindow, handshake);

    expect(status.textContent).toBe("Game connection ready.");
    expect(targetWindow.postMessage).toHaveBeenCalledTimes(1);
    const [serializedAck, targetOrigin] = vi.mocked(targetWindow.postMessage).mock.calls[0]!;
    const ack = JSON.parse(serializedAck as string);
    expect(targetOrigin).toBe(window.location.origin);
    expect(ack.messageType).toBe("HANDSHAKE_ACK");
    expect(ack.channelId).toBe(ids.channelId);
    expect(ack.sessionId).toBe(ids.sessionId);
    expect(ack.payload.hostConfig).toEqual(BRIDGE_BUILDER_HOST_CONFIG);

    dispatchGameMessage(targetWindow, handshake);
    expect(targetWindow.postMessage).toHaveBeenCalledTimes(1);
  });

  it("rejects messages from the wrong origin or source window", () => {
    const { activation, status, targetWindow } = createHarness();
    const handshake = makeHandshake(activation!.ids);
    const otherWindow = { postMessage: vi.fn() } as unknown as Window;

    dispatchGameMessage(targetWindow, handshake, "https://untrusted.example");
    dispatchGameMessage(otherWindow, handshake);

    expect(targetWindow.postMessage).not.toHaveBeenCalled();
    expect(status.textContent).toBe("Connecting to the game platform.");
  });

  it("ignores stale channel and session messages", () => {
    const { activation, status, targetWindow } = createHarness();
    const ids = activation!.ids;

    dispatchGameMessage(targetWindow, makeHandshake(ids, { channelId: "stale-channel" }));
    dispatchGameMessage(targetWindow, makeHandshake(ids, { sessionId: "stale-session" }));

    expect(targetWindow.postMessage).not.toHaveBeenCalled();
    expect(status.textContent).toBe("Connecting to the game platform.");
  });

  it("announces when the handshake does not arrive before the timeout", () => {
    const { scheduled, status } = createHarness();

    expect(scheduled).toHaveLength(2); // iframe readiness and handshake timeout
    scheduled[1]!();

    expect(status.textContent).toBe("The game platform connection has not been established.");
    expect(GPSDK_HANDSHAKE_TIMEOUT_MS).toBeGreaterThan(0);
  });

  it("wires overlays before falling back to the plain game URL after activation fails", () => {
    const stage = document.createElement("div");
    stage.setAttribute("data-gpsdk-enabled", "true");
    stage.innerHTML = `
      <div data-static-game-loading></div>
      <div data-static-game-error hidden></div>
      <p data-gpsdk-handshake-status role="status"></p>
      <iframe data-static-game-frame></iframe>
    `;
    const frame = stage.querySelector<HTMLIFrameElement>("[data-static-game-frame]")!;
    const status = stage.querySelector<HTMLElement>("[data-gpsdk-handshake-status]")!;
    const error = stage.querySelector<HTMLElement>("[data-static-game-error]")!;
    const setAttribute = frame.setAttribute.bind(frame);
    vi.spyOn(frame, "setAttribute").mockImplementation((name, value) => {
      setAttribute(name, value);
      if (name === "src") frame.dispatchEvent(new Event("error"));
    });

    initializeBridgeBuilderGpsdkFrame(stage, frame, ENTRY_URL, status, {
      wireHost: () => null,
      setTimeoutFn: createTestTimer([])
    });

    expect(frame.getAttribute("src")).toBe(ENTRY_URL);
    expect(status.textContent).toBe("Platform connection unavailable. Loading the game normally.");
    expect(error.hasAttribute("hidden")).toBe(false);
  });
});
