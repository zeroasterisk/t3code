import { describe, expect, it } from "vite-plus/test";

import {
  markA2uiCanvasStateShared,
  provideA2uiCanvasState,
  takeChangedA2uiCanvasState,
} from "./a2uiCanvasReplica";

describe("takeChangedA2uiCanvasState", () => {
  it("returns a canvas once after the user changes it, and not what the agent already set", () => {
    let npm = true;
    provideA2uiCanvasState("thread-1", () => [{ surfaceId: "release", dataModel: { npm } }]);
    markA2uiCanvasStateShared("thread-1", { surfaceId: "release", dataModel: { npm: true } });
    expect(takeChangedA2uiCanvasState("thread-1")).toEqual([]);

    npm = false;
    expect(takeChangedA2uiCanvasState("thread-1")).toEqual([
      { surfaceId: "release", dataModel: { npm: false } },
    ]);
    expect(takeChangedA2uiCanvasState("thread-1")).toEqual([]);
    expect(takeChangedA2uiCanvasState("thread-without-canvas")).toEqual([]);
  });
});
