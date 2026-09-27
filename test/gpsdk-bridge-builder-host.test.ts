/** @vitest-environment happy-dom */
import { describe, expect, it, vi } from "vitest";
import { runHostConformanceTests } from "@setnessconsulting/game-platform-sdk/testing";
import {
  appendGpsdkQuery,
  activateBridgeBuilderGpsdkFrame,
  BRIDGE_BUILDER_HOST_CONFIG,
  createGpsdkSessionIds,
  readGpsdkIdsFromStage,
  wireBridgeBuilderGpsdkHost
} from "../src/lib/gpsdk-bridge-builder-host";

describe("Bridge Builder GPSDK host (SDK-6)", () => {
  it("passes runHostConformanceTests for the Bridge Builder host config", () => {
    const report = runHostConformanceTests({
      hostConfig: BRIDGE_BUILDER_HOST_CONFIG
    });
    expect(report.failed, JSON.stringify(report.results, null, 2)).toBe(0);
    expect(report.passed).toBe(report.total);
  });

  it("creates distinct channel and session ids", () => {
    let n = 0;
    const ids = createGpsdkSessionIds(() => `id-${++n}`);
    expect(ids).toEqual({ channelId: "id-1", sessionId: "id-2" });
  });

  it("appends gpsdk query params without disturbing the asset path", () => {
    const ids = { channelId: "ch", sessionId: "se" };
    expect(appendGpsdkQuery("/game-assets/bridge-builder/1.0.0/index.html", ids)).toBe(
      "/game-assets/bridge-builder/1.0.0/index.html?gpsdkChannel=ch&gpsdkSession=se"
    );
    expect(appendGpsdkQuery("/game-assets/bridge-builder/1.0.0/index.html?x=1", ids)).toBe(
      "/game-assets/bridge-builder/1.0.0/index.html?x=1&gpsdkChannel=ch&gpsdkSession=se"
    );
  });

  it("reads gpsdk ids from the stage only when both attributes are present", () => {
    const stage = document.createElement("div");
    expect(readGpsdkIdsFromStage(stage)).toBeNull();
    stage.setAttribute("data-gpsdk-channel", "c");
    expect(readGpsdkIdsFromStage(stage)).toBeNull();
    stage.setAttribute("data-gpsdk-session", "s");
    expect(readGpsdkIdsFromStage(stage)).toEqual({ channelId: "c", sessionId: "s" });
  });

  it("returns null from wireBridgeBuilderGpsdkHost when the stage is not opted in", () => {
    const stage = document.createElement("div");
    const frame = document.createElement("iframe");
    Object.defineProperty(frame, "contentWindow", { value: window });
    expect(wireBridgeBuilderGpsdkHost(stage, frame, { origin: "http://localhost" })).toBeNull();
  });

  it("opens a host transport when the stage carries gpsdk ids", () => {
    const stage = document.createElement("div");
    stage.setAttribute("data-gpsdk-channel", "channel-a");
    stage.setAttribute("data-gpsdk-session", "session-b");
    const frame = document.createElement("iframe");
    Object.defineProperty(frame, "contentWindow", { value: window });
    const onGameReady = vi.fn();

    const wire = wireBridgeBuilderGpsdkHost(stage, frame, {
      origin: "http://localhost",
      onGameReady
    });
    expect(wire).not.toBeNull();
    expect(wire!.transport.channelId).toBe("channel-a");
    expect(wire!.transport.sessionId).toBe("session-b");
    wire!.destroy();
  });

  it("creates runtime ids and installs the host listener before iframe navigation", () => {
    const stage = document.createElement("div");
    const frame = document.createElement("iframe");
    const order: string[] = [];
    let nextId = 0;
    const wire = {
      transport: {} as never,
      teardownHandshake: vi.fn(),
      destroy: vi.fn()
    };
    const onGameReady = vi.fn();
    const gameIdentity = {
      gameId: "bridge-builder",
      gameVersion: "0.1.0-qualification.10",
      sdkVersion: "0.1.1",
      protocolVersion: "1.0",
      runtimeKind: "web-dom",
      capabilities: {}
    } as const;
    const setAttribute = frame.setAttribute.bind(frame);
    vi.spyOn(frame, "setAttribute").mockImplementation((name, value) => {
      if (name === "src") order.push("iframe-navigation");
      setAttribute(name, value);
    });

    const activation = activateBridgeBuilderGpsdkFrame(
      stage,
      frame,
      "/game-assets/bridge-builder/1.0.0/index.html",
      {
        randomUuid: () => `runtime-${++nextId}`,
        onGameReady,
        wireHost: (wiredStage, wiredFrame, wireOptions) => {
          expect(wiredStage).toBe(stage);
          expect(wiredFrame).toBe(frame);
          expect(wireOptions?.onGameReady).toBe(onGameReady);
          expect(stage.getAttribute("data-gpsdk-channel")).toBe("runtime-1");
          expect(stage.getAttribute("data-gpsdk-session")).toBe("runtime-2");
          order.push("host-listener");
          wireOptions?.onGameReady?.(gameIdentity);
          return wire;
        }
      }
    );

    expect(activation?.ids).toEqual({ channelId: "runtime-1", sessionId: "runtime-2" });
    expect(onGameReady).toHaveBeenCalledWith(gameIdentity);
    expect(order).toEqual(["host-listener", "iframe-navigation"]);
    expect(frame.getAttribute("src")).toBe(
      "/game-assets/bridge-builder/1.0.0/index.html?gpsdkChannel=runtime-1&gpsdkSession=runtime-2"
    );
  });
});
