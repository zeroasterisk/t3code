import { describe, expect, it } from "vite-plus/test";

import { a2uiActionMessage, a2uiTagsToFences } from "./a2uiMessage.ts";

describe("a2uiActionMessage", () => {
  const action = {
    surfaceId: "triage",
    name: "apply",
    sourceComponentId: "apply-button",
    context: { note: "ship it", count: 2 },
  };

  it("serializes the action as an a2ui-action fenced JSON block", () => {
    const message = a2uiActionMessage(action);
    expect(message).toBe(
      'Applied apply.\n\n```a2ui-action\n{"surfaceId":"triage","name":"apply","sourceComponentId":"apply-button","context":{"note":"ship it","count":2}}\n```',
    );
    const json = /```a2ui-action\n(.*)\n```/s.exec(message)?.[1];
    expect(JSON.parse(json ?? "")).toEqual(action);
  });

  it("uses a longer fence when user-entered context contains backticks", () => {
    const message = a2uiActionMessage({ ...action, context: { note: "```\nbreak out```" } });
    expect(message).toContain("````a2ui-action\n");
    expect(message.endsWith("\n````")).toBe(true);
    const json = /````a2ui-action\n(.*)\n````/s.exec(message)?.[1];
    expect(JSON.parse(json ?? "").context.note).toBe("```\nbreak out```");
  });
});

describe("a2uiTagsToFences", () => {
  it.each([
    [
      "a closed block between prose",
      'Here:\n<a2ui>\nsurface("s")\nroot = Text("hi")\n</a2ui>\nDone.',
      'Here:\n```a2ui\nsurface("s")\nroot = Text("hi")\n```\nDone.',
    ],
    [
      "a block on one line",
      '<a2ui>root = Text("hi")</a2ui> after',
      '```a2ui\nroot = Text("hi")\n```\nafter',
    ],
    [
      "a body with a backtick run",
      '<a2ui>\nroot = Text("```")\n</a2ui>',
      '````a2ui\nroot = Text("```")\n````',
    ],
    [
      "an unclosed, still streaming block",
      '<a2ui>\nsurface("s")\nroot = Te',
      '```a2ui\nsurface("s")\nroot = Te',
    ],
    [
      "tags shown inside a code fence",
      '```md\n<a2ui>\nroot = Text("hi")\n</a2ui>\n```',
      '```md\n<a2ui>\nroot = Text("hi")\n</a2ui>\n```',
    ],
  ])("rewrites %s", (_name, input, expected) => {
    expect(a2uiTagsToFences(input)).toBe(expected);
  });
});
