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

const SUMMARY_VALUE_MAX = 40;
const SUMMARY_FIELDS_MAX = 6;

function summaryValue(value: unknown): string {
  const text = Array.isArray(value)
    ? value.map(summaryValue).join(", ")
    : typeof value === "boolean"
      ? value
        ? "yes"
        : "no"
      : value !== null && typeof value === "object"
        ? "…"
        : String(value ?? "");
  const short = text.length > SUMMARY_VALUE_MAX ? `${text.slice(0, SUMMARY_VALUE_MAX - 1)}…` : text;
  return short.replace(/[\\`*_[\]<>#|~]/g, "\\$&");
}

/** `pr415: revert · note: ship it`: what the user chose, short enough for a phone. */
export function a2uiActionSummary(context: Readonly<Record<string, unknown>>): string {
  const fields = Object.entries(context).filter(([, value]) => value !== "" && value != null);
  const shown = fields
    .slice(0, SUMMARY_FIELDS_MAX)
    .map(([key, value]) => `${summaryValue(key)}: ${summaryValue(value)}`);
  if (fields.length > SUMMARY_FIELDS_MAX) shown.push(`+${fields.length - SUMMARY_FIELDS_MAX} more`);
  return shown.join(" · ");
}

/**
 * The user message an A2UI action sends: a readable heading and summary, then the exact
 * payload in an `a2ui-action` fence (the chat shows that fence collapsed).
 */
export function a2uiActionMessage(action: A2uiActionEvent, label?: string): string {
  const payload = {
    surfaceId: action.surfaceId,
    name: action.name,
    sourceComponentId: action.sourceComponentId,
    context: action.context,
  };
  const heading = label?.trim() || humanize(action.name);
  const summary = a2uiActionSummary(action.context);
  const lead = summary ? `${heading}\n\n${summary}` : heading;
  return `${lead}\n\n\`\`\`${ACTION_FENCE}\n${JSON.stringify(payload)}\n\`\`\``;
}
