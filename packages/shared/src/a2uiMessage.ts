// A2UI interactive replies: an agent puts `<a2ui>…</a2ui>` (A2UI Express, the format
// `@a2ui/agent` skills teach) in plain message text, and clients render it natively.
// The data lives in the message, like assistant citations, so it works for every provider.

const OPEN_TAG = "<a2ui>";
const CLOSE_TAG = "</a2ui>";
const ACTION_FENCE = "a2ui-action";
/** Larger blocks render as code: a surface this big is a mistake, not a UI. */
export const A2UI_MAX_SOURCE_LENGTH = 32_000;

export type A2uiMessageSegment =
  | { readonly kind: "markdown"; readonly offset: number; readonly markdown: string }
  | {
      readonly kind: "a2ui";
      readonly offset: number;
      readonly source: string;
      readonly closed: boolean;
    };

/**
 * Splits message text into markdown and A2UI blocks. Tags inside fenced code stay markdown,
 * so an agent can show A2UI source without rendering it. An unclosed block (still streaming)
 * comes back with `closed: false`.
 */
export function splitA2uiSegments(text: string): A2uiMessageSegment[] {
  if (!text.includes(OPEN_TAG)) return [{ kind: "markdown", offset: 0, markdown: text }];
  const segments: A2uiMessageSegment[] = [];
  let markdownStart = 0;
  let cursor = 0;
  let inFence = false;
  while (cursor < text.length) {
    const lineEnd = text.indexOf("\n", cursor);
    const next = lineEnd === -1 ? text.length : lineEnd + 1;
    const line = text.slice(cursor, next).trim();
    if (line.startsWith("```") || line.startsWith("~~~")) inFence = !inFence;
    if (!inFence && line === OPEN_TAG) {
      const close = text.indexOf(CLOSE_TAG, next);
      pushMarkdown(segments, markdownStart, text.slice(markdownStart, cursor));
      const source = text.slice(next, close === -1 ? text.length : close);
      if (source.length > A2UI_MAX_SOURCE_LENGTH) {
        pushMarkdown(segments, cursor, "```\n" + source + "\n```");
      } else {
        segments.push({ kind: "a2ui", offset: cursor, source, closed: close !== -1 });
      }
      if (close === -1) return segments;
      cursor = close + CLOSE_TAG.length;
      markdownStart = cursor;
      continue;
    }
    cursor = next;
  }
  pushMarkdown(segments, markdownStart, text.slice(markdownStart));
  return segments;
}

/** `apply_triage` → `Apply triage`: the readable line of an action message. */
function humanize(name: string): string {
  const words = name
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .trim()
    .toLowerCase();
  return words ? words[0]!.toUpperCase() + words.slice(1) : "Action";
}

function pushMarkdown(segments: A2uiMessageSegment[], offset: number, markdown: string): void {
  if (markdown.trim() !== "") segments.push({ kind: "markdown", offset, markdown });
}

export interface A2uiActionEvent {
  readonly surfaceId: string;
  readonly name: string;
  readonly sourceComponentId: string;
  readonly context: Readonly<Record<string, unknown>>;
}

/** The user message an A2UI action sends: readable first, exact payload in a fence. */
export function a2uiActionMessage(action: A2uiActionEvent, label?: string): string {
  const payload = {
    surfaceId: action.surfaceId,
    name: action.name,
    sourceComponentId: action.sourceComponentId,
    context: action.context,
  };
  const heading = label?.trim() || humanize(action.name);
  return `${heading}\n\n\`\`\`${ACTION_FENCE}\n${JSON.stringify(payload)}\n\`\`\``;
}
