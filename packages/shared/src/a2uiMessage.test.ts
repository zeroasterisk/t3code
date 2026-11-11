import { describe, expect, it } from "vite-plus/test";

import {
  A2UI_MAX_SOURCE_LENGTH,
  a2uiActionMessage,
  a2uiActionSummary,
  splitA2uiSegments,
} from "./a2uiMessage.ts";

describe("splitA2uiSegments", () => {
  it.each([
    ["plain text", "Hello", [{ kind: "markdown", offset: 0, markdown: "Hello" }]],
    [
      "a closed block between prose",
      'Pick one:\n<a2ui>\nroot = Text("hi")\n</a2ui>\nThanks.',
      [
        { kind: "markdown", offset: 0, markdown: "Pick one:\n" },
        { kind: "a2ui", offset: 10, source: 'root = Text("hi")\n', closed: true },
        { kind: "markdown", offset: 42, markdown: "\nThanks." },
      ],
    ],
    [
      "a block still streaming",
      "Pick one:\n<a2ui>\nroot = Col",
      [
        { kind: "markdown", offset: 0, markdown: "Pick one:\n" },
        { kind: "a2ui", offset: 10, source: "root = Col", closed: false },
      ],
    ],
    [
      "a tag inside fenced code",
      '```\n<a2ui>\nroot = Text("x")\n</a2ui>\n```',
      [{ kind: "markdown", offset: 0, markdown: '```\n<a2ui>\nroot = Text("x")\n</a2ui>\n```' }],
    ],
    [
      "an inline mention",
      "Use the <a2ui> tag to render.",
      [{ kind: "markdown", offset: 0, markdown: "Use the <a2ui> tag to render." }],
    ],
  ])("splits %s", (_name, text, expected) => {
    expect(splitA2uiSegments(text)).toEqual(expected);
  });

  it("renders an oversized block as code", () => {
    const source = "x".repeat(A2UI_MAX_SOURCE_LENGTH + 1);
    const [segment] = splitA2uiSegments(`<a2ui>\n${source}</a2ui>`);
    expect(segment?.kind).toBe("markdown");
  });

  it("keeps two surfaces apart", () => {
    const segments = splitA2uiSegments("<a2ui>\na\n</a2ui>\nmid\n<a2ui>\nb\n</a2ui>");
    expect(segments.map((s) => s.kind)).toEqual(["a2ui", "markdown", "a2ui"]);
  });
});

describe("a2uiActionMessage", () => {
  it.each([
    ["apply_triage", "Apply triage"],
    ["saveDeal", "Save deal"],
    ["", "Action"],
  ])("titles %s as %s", (name, heading) => {
    const text = a2uiActionMessage({ surfaceId: "s", name, sourceComponentId: "b", context: {} });
    expect(text.split("\n")[0]).toBe(heading);
  });

  it("leads with a readable line and carries the exact payload", () => {
    const text = a2uiActionMessage(
      { surfaceId: "s", name: "apply", sourceComponentId: "go", context: { pr: 12 } },
      "Apply triage",
    );
    expect(text).toBe(
      'Apply triage\n\npr: 12\n\n```a2ui-action\n{"surfaceId":"s","name":"apply","sourceComponentId":"go","context":{"pr":12}}\n```',
    );
  });

  it("skips the summary when the action has no values", () => {
    const text = a2uiActionMessage({
      surfaceId: "s",
      name: "ok",
      sourceComponentId: "b",
      context: {},
    });
    expect(text.startsWith("Ok\n\n```a2ui-action\n")).toBe(true);
  });
});

describe("a2uiActionSummary", () => {
  it("lists what the user chose, short and markdown-safe", () => {
    expect(
      a2uiActionSummary({
        pr415: ["revert"],
        notify: true,
        note: "x".repeat(60),
        empty: "",
        tag: "*bold*",
      }),
    ).toBe(`pr415: revert · notify: yes · note: ${"x".repeat(39)}… · tag: \\*bold\\*`);
  });

  it("caps the number of fields", () => {
    const context = Object.fromEntries(Array.from({ length: 8 }, (_, i) => [`f${i}`, i]));
    expect(a2uiActionSummary(context).endsWith("f5: 5 · +2 more")).toBe(true);
  });
});
