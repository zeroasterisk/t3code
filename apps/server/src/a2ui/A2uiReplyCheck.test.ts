import { describe, expect, it } from "@effect/vitest";

import { BASIC_COMPONENTS } from "@a2ui/web_core/catalogs/basic/v1";

import { A2UI_BASIC_CATALOG_ID, a2uiRules, checkA2uiReply, loadA2ui } from "./A2uiReplyCheck.ts";

const FORM =
  'Pick one.\n<a2ui>\nsurface("triage")\nroot = Column([Text("Which?"), Button(Text("Go"), action=Event("go", {}))])\n</a2ui>';
const UPDATE = '<a2ui>\nsurface("triage", update=true)\nroot = Column([Text("Done")])\n</a2ui>';
const drawnForm = [{ id: "m1", text: FORM }];

// The `send` cases of factory conformance/prompt/prompt.json. `earlier` holds what the web
// draws blocks from (assistant messages); the per-agent ownership case does not apply.
const cases: ReadonlyArray<
  readonly [string, string, ReadonlyArray<{ id: string; text: string }>, boolean]
> = [
  ["valid form", FORM, [], true],
  ["no block", "Just prose.", [], false],
  ["fenced block is not a block", '```\n<a2ui>\nroot = Text("x")\n</a2ui>\n```', [], false],
  ["unclosed block", '<a2ui>\nroot = Text("x")', [], false],
  [
    "off-catalog component",
    '<a2ui>\nsurface("x")\nroot = Iframe(url="https://example.com")\n</a2ui>',
    [],
    false,
  ],
  [
    "update of an unknown surface",
    '<a2ui>\nsurface("nope", update=true)\nroot = Column([Text("Done")])\n</a2ui>',
    [],
    false,
  ],
  ["re-create of an existing surface", FORM, drawnForm, false],
  ["update of its own surface", UPDATE, drawnForm, true],
  // A user's `<a2ui>` text is prose on the web, so the caller leaves it out of `earlier`.
  ["form after a user's block", FORM, [], true],
  ["update of a user's block", UPDATE, [], false],
];

describe("checkA2uiReply", () => {
  it.each(cases)("%s", async (_name, text, earlier, ok) => {
    const result = await checkA2uiReply(text, earlier);
    expect(result.ok, JSON.stringify(result)).toBe(ok);
  });

  it("names the off-catalog component", async () => {
    const result = await checkA2uiReply(
      '<a2ui>\nsurface("x")\nroot = Iframe(url="https://example.com")\n</a2ui>',
      [],
    );
    expect(result).toMatchObject({ ok: false, error: expect.stringContaining("Iframe") });
  });

  it("skips an earlier block the web blocked", async () => {
    const blocked = {
      id: "m0",
      text: '<a2ui>\nsurface("triage")\nroot = Iframe(url="x")\n</a2ui>',
    };
    expect(await checkA2uiReply(FORM, [blocked])).toEqual({ ok: true });
  });

  it("checks two blocks of one draft in order", async () => {
    expect(await checkA2uiReply(`${FORM}\n${UPDATE}`, [])).toEqual({ ok: true });
  });
});

describe("a2uiRules", () => {
  it("is the Express prompt plus the follow-up rule", async () => {
    const rules = await a2uiRules();
    expect(new TextEncoder().encode(rules).length).toBeGreaterThan(4096);
    for (const text of [
      "surface(",
      "ChoicePicker",
      "Button",
      "Event(",
      "update=true",
      "a2ui-action",
    ]) {
      expect(rules).toContain(text);
    }
  });
});

describe("schema catalog", () => {
  it("matches the web catalog's id and components", async () => {
    const { catalog } = await loadA2ui();
    expect(catalog.id).toBe(A2UI_BASIC_CATALOG_ID);
    expect([...catalog.components.keys()].toSorted()).toEqual(
      BASIC_COMPONENTS.map((component) => component.name).toSorted(),
    );
  });
});
