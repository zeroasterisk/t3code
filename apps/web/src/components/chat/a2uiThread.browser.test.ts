import { describe, expect, it } from "vite-plus/test";

import { A2uiThreadStore } from "./a2uiThread";

const triage = (text: string) =>
  `surface("triage")\nroot = Column([Text("${text}"), Button(Text("Go"), action=Event("go", {}))])`;
const update = (text: string) => `surface("triage", update=true)\nroot = Column([Text("${text}")])`;

function texts(store: A2uiThreadStore, surfaceId: string): string[] {
  const json = JSON.stringify(store.surface(surfaceId), (_key, value) =>
    value instanceof Map ? Object.fromEntries(value) : value,
  );
  return [...(json ?? "").matchAll(/"text":"([^"]*)"/g)].map((match) => match[1]!);
}

describe("A2uiThreadStore", () => {
  it("lets a later block update an earlier block's surface", () => {
    const store = new A2uiThreadStore();
    store.sync([
      { key: "m1:0", source: triage("first") },
      { key: "m2:0", source: update("second") },
    ]);
    expect(store.result("m2:0")).toEqual({ ok: true, surfaceIds: ["triage"] });
    expect(store.isSuperseded("m1:0", "triage")).toBe(true);
    expect(store.isSuperseded("m2:0", "triage")).toBe(false);
    expect(texts(store, "triage")).toContain("second");
  });

  it("gives blocks without surface() their own surfaces", () => {
    const store = new A2uiThreadStore();
    store.sync([
      { key: "m1:0", source: 'root = Text("a")' },
      { key: "m2:0", source: 'root = Text("b")' },
    ]);
    expect(store.result("m1:0")).toEqual({ ok: true, surfaceIds: ["a2ui-m1:0"] });
    expect(store.result("m2:0")).toEqual({ ok: true, surfaceIds: ["a2ui-m2:0"] });
  });

  it("rejects a bad update and keeps the earlier surface", () => {
    const store = new A2uiThreadStore();
    store.sync([
      { key: "m1:0", source: triage("first") },
      { key: "m2:0", source: `surface("triage", update=true)\nroot = Iframe(url="https://x")` },
    ]);
    expect(store.result("m2:0")?.ok).toBe(false);
    expect(store.isSuperseded("m1:0", "triage")).toBe(false);
    expect(texts(store, "triage")).toContain("first");
  });

  it("rejects an update to a surface the thread never drew", () => {
    const store = new A2uiThreadStore();
    store.sync([{ key: "m1:0", source: update("ghost") }]);
    expect(store.result("m1:0")?.ok).toBe(false);
  });

  it("applies each block once and rebuilds when an earlier block changes", () => {
    const store = new A2uiThreadStore();
    const blocks = [{ key: "m1:0", source: triage("first") }];
    store.sync(blocks);
    const surface = store.surface("triage");
    store.sync(blocks);
    expect(store.surface("triage")).toBe(surface);
    store.sync([{ key: "m1:0", source: triage("edited") }]);
    expect(store.surface("triage")).not.toBe(surface);
    expect(texts(store, "triage")).toContain("edited");
  });
});
