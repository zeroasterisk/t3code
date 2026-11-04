export interface A2uiAction {
  readonly surfaceId: string;
  readonly name: string;
  readonly sourceComponentId: string;
  readonly context: Readonly<Record<string, unknown>>;
}

export const A2UI_FENCE_LANGUAGE = "a2ui";
const A2UI_ACTION_FENCE_LANGUAGE = "a2ui-action";
const A2UI_OPEN_TAG = "<a2ui>";
const A2UI_CLOSE_TAG = "</a2ui>";
const CODE_FENCE_OPEN = /^ {0,3}(`{3,}|~{3,})/;
const CODE_FENCE_CLOSE = /^ {0,3}(`{3,}|~{3,})\s*$/;

function fenceFor(body: string): string {
  const longestRun = Math.max(0, ...(body.match(/`+/g) ?? []).map((run) => run.length));
  return "`".repeat(Math.max(3, longestRun + 1));
}

function closesCodeFence(line: string, open: string): boolean {
  const marker = CODE_FENCE_CLOSE.exec(line)?.[1];
  return marker !== undefined && marker[0] === open[0] && marker.length >= open.length;
}

/**
 * Rewrites `<a2ui>` blocks, the A2UI agent SDK's default wrapper, as `a2ui` fences so both
 * forms render alike. An unclosed block becomes an open fence, as a streaming fence would be.
 */
export function a2uiTagsToFences(markdown: string): string {
  if (!markdown.includes(A2UI_OPEN_TAG)) return markdown;
  const lines = markdown.split("\n");
  const out: string[] = [];
  let codeFence: string | null = null;
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? "";
    if (codeFence !== null) {
      out.push(line);
      if (closesCodeFence(line, codeFence)) codeFence = null;
      continue;
    }
    const fenceOpen = CODE_FENCE_OPEN.exec(line)?.[1];
    if (fenceOpen !== undefined) {
      codeFence = fenceOpen;
      out.push(line);
      continue;
    }
    const trimmed = line.trimStart();
    if (!trimmed.startsWith(A2UI_OPEN_TAG)) {
      out.push(line);
      continue;
    }
    const body: string[] = [];
    let rest = trimmed.slice(A2UI_OPEN_TAG.length);
    let after: string | null = null;
    let cursor = index;
    while (true) {
      const close = rest.indexOf(A2UI_CLOSE_TAG);
      if (close >= 0) {
        const before = rest.slice(0, close);
        if (before.trim()) body.push(before);
        after = rest.slice(close + A2UI_CLOSE_TAG.length).trim();
        break;
      }
      if (cursor > index || rest.trim()) body.push(rest);
      cursor += 1;
      if (cursor >= lines.length) break;
      rest = lines[cursor] ?? "";
    }
    const source = body.join("\n");
    const fence = fenceFor(source);
    out.push(`${fence}${A2UI_FENCE_LANGUAGE}`, ...body);
    if (after !== null) {
      out.push(fence);
      if (after) out.push(after);
    }
    index = cursor;
  }
  return out.join("\n");
}

/** User message a surface sends to the agent when the user acts on it. */
export function a2uiActionMessage(action: A2uiAction): string {
  const payload = JSON.stringify({
    surfaceId: action.surfaceId,
    name: action.name,
    sourceComponentId: action.sourceComponentId,
    context: action.context,
  });
  const fence = fenceFor(payload);
  return `Applied ${action.name}.\n\n${fence}${A2UI_ACTION_FENCE_LANGUAGE}\n${payload}\n${fence}`;
}
