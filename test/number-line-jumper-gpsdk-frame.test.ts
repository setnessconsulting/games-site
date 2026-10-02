/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from "vitest";
import type { ProtocolErrorPayload } from "@setnessconsulting/game-platform-sdk/core";
import type { HostTransport } from "@setnessconsulting/game-platform-sdk/host";
import {
  GPSDK_HANDSHAKE_TIMEOUT_MS,
  initializeNumberLineJumperGpsdkFrame
} from "../src/lib/number-line-jumper-gpsdk-frame";
import type {
  NumberLineJumperGpsdkActivationOptions,
  NumberLineJumperGpsdkHostWire
} from "../src/lib/number-line-jumper-gpsdk-host";

const ENTRY_URL = "/game-assets/number-line-jumper/candidate/index.html";

function createTimer(scheduled: Array<() => void>, delays: number[]): typeof setTimeout {
  return ((callback: () => void, delay = 0) => {
    scheduled.push(callback);
    delays.push(delay);
    return scheduled.length as unknown as ReturnType<typeof setTimeout>;
  }) as typeof setTimeout;
}

function createHarness(wireHost?: NumberLineJumperGpsdkActivationOptions["wireHost"]) {
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
  const scheduled: Array<() => void> = [];
  const delays: number[] = [];
  const wire: NumberLineJumperGpsdkHostWire = {
    transport: {} as HostTransport,
    teardownHandshake: vi.fn(),
    destroy: vi.fn()
  };
  let hostOptions:
    Parameters<NonNullable<NumberLineJumperGpsdkActivationOptions["wireHost"]>>[2] | undefined;
  const activation = initializeNumberLineJumperGpsdkFrame(stage, frame, ENTRY_URL, status, {
    randomUuid: (() => {
      let id = 0;
      return () => `id-${++id}`;
    })(),
    wireHost:
      wireHost ??
      ((_stage, _frame, options) => {
        hostOptions = options;
        return wire;
      }),
    setTimeoutFn: createTimer(scheduled, delays)
  });

  return {
    activation,
    delays,
    frame,
    hostOptions: () => hostOptions,
    scheduled,
    stage,
    status,
    wire
  };
}

describe("Number Line Jumper GPSDK frame activation", () => {
  it("installs the host wire before navigating and adds the per-frame ids", () => {
    const harness = createHarness();

    expect(harness.activation?.ids).toEqual({ channelId: "id-1", sessionId: "id-2" });
    expect(harness.frame.getAttribute("src")).toBe(
      `${ENTRY_URL}?gpsdkChannel=id-1&gpsdkSession=id-2`
    );
  });

  it("falls back to the plain asset URL when the host reports a handshake timeout", () => {
    const harness = createHarness();
    const error: ProtocolErrorPayload = {
      code: "TRANSPORT_FAILURE",
      severity: "recoverable",
      source: "game",
      message: "The game platform handshake timed out."
    };

    harness.hostOptions()?.onGameError?.(error);

    expect(harness.frame.getAttribute("src")).toBe(ENTRY_URL);
    expect(harness.status.textContent).toContain("Loading standalone play");
    expect(harness.wire.destroy).toHaveBeenCalledOnce();
  });

  it("falls back before the static iframe-readiness timeout can hide the frame", () => {
    const harness = createHarness();

    expect(harness.scheduled).toHaveLength(2);
    expect(harness.delays).toEqual([
      GPSDK_HANDSHAKE_TIMEOUT_MS + 5_000,
      GPSDK_HANDSHAKE_TIMEOUT_MS
    ]);
    harness.scheduled[1]!();

    expect(harness.frame.getAttribute("src")).toBe(ENTRY_URL);
    expect(harness.wire.destroy).toHaveBeenCalledOnce();
    expect(harness.status.textContent).toContain("Loading standalone play");
  });

  it("keeps the embedded session when the handshake completes before timeout", () => {
    const harness = createHarness();
    harness.hostOptions()?.onGameReady?.({
      gameId: "number-line-jumper",
      gameVersion: "0.1.0",
      sdkVersion: "0.1.1",
      protocolVersion: "1.0",
      runtimeKind: "web-dom",
      capabilities: { canPause: false }
    });

    expect(harness.status.textContent).toBe("Game connection ready.");
    harness.scheduled[1]!();
    expect(harness.frame.getAttribute("src")).toContain("gpsdkChannel=id-1");
  });
});
