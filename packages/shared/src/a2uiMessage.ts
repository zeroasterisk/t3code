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

/** A CommonMark fence opener/closer: 3+ backticks or tildes, up to 3 spaces of indent. */
const FENCE_LINE = /^ {0,3}(`{3,}|~{3,})(.*)$/;

/**
 * Where the block's `</a2ui>` starts, or -1 while it streams. Like `@a2ui/agent`'s lexer, the
 * tag only counts outside Express strings and comments, so `Text("</a2ui>")` stays source.
 */
function findCloseTag(text: string, from: number): number {
  let i = from;
  while (i < text.length) {
    if (text.startsWith(CLOSE_TAG, i)) return i;
    const ch = text[i];
    if (ch === '"') {
      const triple = text.startsWith('"""', i);
      const quote = triple ? '"""' : '"';
      i += quote.length;
      while (i < text.length && !text.startsWith(quote, i)) {
        if (!triple && text[i] === "\n") break;
        i += text[i] === "\\" ? 2 : 1;
      }
      i += quote.length;
    } else if (ch === "#" || text.startsWith("//", i)) {
      const lineEnd = text.indexOf("\n", i);
      i = lineEnd === -1 ? text.length : lineEnd;
    } else if (text.startsWith("/*", i)) {
      const commentEnd = text.indexOf("*/", i + 2);
      i = commentEnd === -1 ? text.length : commentEnd + 2;
    } else {
      i += 1;
    }
  }
  return -1;
}

/**
 * Splits message text into markdown and A2UI blocks. A block opens on a line that starts with
 * `<a2ui>`. Tags inside fenced code stay markdown (fences pair by character and length, as in
 * CommonMark), so an agent can show A2UI source without rendering it. An unclosed block (still
 * streaming) comes back with `closed: false`.
 */
export function splitA2uiSegments(text: string): A2uiMessageSegment[] {
  if (!text.includes(OPEN_TAG)) return [{ kind: "markdown", offset: 0, markdown: text }];
  const segments: A2uiMessageSegment[] = [];
  let markdownStart = 0;
  let cursor = 0;
  let fence: string | null = null;
  while (cursor < text.length) {
    const lineEnd = text.indexOf("\n", cursor);
    const next = lineEnd === -1 ? text.length : lineEnd + 1;
    const line = text.slice(cursor, next).replace(/\r?\n$/, "");
    const fenceMatch = FENCE_LINE.exec(line);
    if (fence === null && fenceMatch) {
      const marker = fenceMatch[1]!;
      // A backtick fence's info string can't hold a backtick.
      if (marker[0] === "~" || !fenceMatch[2]!.includes("`")) fence = marker;
    } else if (
      fence !== null &&
      fenceMatch &&
      fenceMatch[1]![0] === fence[0] &&
      fenceMatch[1]!.length >= fence.length &&
      fenceMatch[2]!.trim() === ""
    ) {
      fence = null;
    } else if (fence === null && line.trimStart().startsWith(OPEN_TAG)) {
      const sourceStart = cursor + line.indexOf(OPEN_TAG) + OPEN_TAG.length;
      const close = findCloseTag(text, sourceStart);
      pushMarkdown(segments, markdownStart, text.slice(markdownStart, cursor));
      let source = text.slice(sourceStart, close === -1 ? text.length : close);
      if (source.startsWith("\n")) source = source.slice(1);
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
