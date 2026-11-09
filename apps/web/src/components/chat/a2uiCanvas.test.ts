import { Catalog } from "@a2ui/web_core";
import { describe, expect, it, vi } from "vite-plus/test";

import t3CatalogJson from "./a2uiT3Catalog.json" with { type: "json" };
import { isCanvasSource, ThreadCanvas } from "./a2uiCanvas";

const CREATE = `surface("release", sendDataModel=true)
$/version = "1.5.0"
$/npm = true
version = Field("Version", $/version)
npm = Switch("Publish to npm", $/npm)
root = Panel([version, npm], title="Release 1.5.0")`;
const UPDATE = `surface("release", update=true)
$/version = "1.5.0-beta.1"
$/npm = false`;

function canvas() {
  const api = Catalog.fromJson(t3CatalogJson);
  const onShared = vi.fn();
  const renderCatalog = new Catalog(api.id, api.protocolVersion, [...api.components.values()], []);
  return { canvas: new ThreadCanvas({ apiCatalog: api, renderCatalog, onShared }), onShared };
}

describe("ThreadCanvas", () => {
  it("applies a later update to the surface its earlier block created", () => {
    const { canvas: thread, onShared } = canvas();
    expect(thread.register("create", "1", CREATE)).toEqual({
      kind: "surfaces",
      surfaceIds: ["release"],
    });
    expect(thread.register("update", "2", UPDATE)).toEqual({
      kind: "update",
      surfaceIds: ["release"],
    });
    expect(thread.dataModel("release")).toEqual({ version: "1.5.0-beta.1", npm: false });
    expect(thread.title("release")).toBe("Release 1.5.0");
    expect(onShared).toHaveBeenLastCalledWith({
      surfaceId: "release",
      dataModel: { version: "1.5.0-beta.1", npm: false },
    });
  });

  it("rebuilds in message order when the update mounts before the canvas it updates", () => {
    const { canvas: thread } = canvas();
    expect(thread.register("update", "2", UPDATE)).toEqual({ kind: "failed" });
    thread.register("create", "1", CREATE);
    expect(thread.register("update", "2", UPDATE)).toEqual({
      kind: "update",
      surfaceIds: ["release"],
    });
    expect(thread.dataModel("release")).toEqual({ version: "1.5.0-beta.1", npm: false });
    expect(thread.generation).toBe(1);
  });

  it("reports the user's edits in its snapshot of live surfaces", () => {
    const { canvas: thread } = canvas();
    thread.register("create", "1", CREATE);
    thread.surface("release")?.dataModel.set("/npm", false);
    expect(thread.snapshot()).toEqual([
      { surfaceId: "release", dataModel: { version: "1.5.0", npm: false } },
    ]);
  });

  it("treats only sendDataModel or update surfaces as canvas blocks", () => {
    expect(isCanvasSource(CREATE)).toBe(true);
    expect(isCanvasSource(UPDATE)).toBe(true);
    expect(isCanvasSource('surface("card")\nroot = Text("hi")')).toBe(false);
  });
});
