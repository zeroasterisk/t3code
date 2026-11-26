// The agent side of A2UI replies: `a2uiRules()` is the full Express prompt an agent loads on
// demand, and `checkA2uiReply()` checks a draft reply's `<a2ui>` blocks the way the thread's
// renderer (apps/web `a2uiThread.ts`) will apply them, after the thread's earlier blocks.
// `@a2ui/*` loads on the first call, so server boot never pulls in the parser.
import { a2uiThreadBlocks, splitA2uiSegments } from "@t3tools/shared/a2uiMessage";

/** The id the web catalog and the published v1.0 basic catalog share. */
export const A2UI_BASIC_CATALOG_ID =
  "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json";

/** The draft's message id while it is checked; never a real message id. */
const DRAFT_ID = "__a2ui_draft__";

/** Teaches what the upstream rules don't: follow-ups and how answers come back. */
const HOST_RULES = `

## In T3 Code
- Put prose first, then the block between <a2ui> and </a2ui>, each tag on its own line. Never wrap the block in a code fence.
- Name a surface with surface("<id>") on the block's first line. To change a form you already drew, reply with surface("<id>", update=true) and the new tree; drawing the same id again without update=true is an error.
- When the user presses a button, their next message ends with an a2ui-action fenced JSON payload: surfaceId, name, sourceComponentId and context (the bound values).
- Call a2ui_check with your draft reply before you send it, and fix the first error it reports.
`;

type A2ui = Awaited<ReturnType<typeof importA2ui>>;

async function importA2ui() {
  const [agent, core, basic] = await Promise.all([
    import("@a2ui/agent"),
    import("@a2ui/web_core"),
    import("@a2ui/web_core/catalogs/basic/v1"),
  ]);
  // Schema only: the same id, components and functions the web catalog registers.
  const catalog = new core.Catalog(
    A2UI_BASIC_CATALOG_ID,
    "1.0",
    basic.BASIC_COMPONENTS,
    basic.BASIC_FUNCTIONS,
    basic.BasicCatalogThemeSchema,
  );
  return { agent, core, catalog };
}

let loading: Promise<A2ui> | undefined;
/** `@a2ui/*` and the schema catalog, loaded once per process. */
export function loadA2ui(): Promise<A2ui> {
  loading ??= importA2ui().catch((error: unknown) => {
    loading = undefined;
    throw error;
  });
  return loading;
}

let rules: string | undefined;
export async function a2uiRules(): Promise<string> {
  if (rules === undefined) {
    const { agent, catalog } = await loadA2ui();
    rules = new agent.ExpressPromptGenerator([catalog]).generate() + HOST_RULES;
  }
  return rules;
}

export type A2uiCheckResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: string };

/**
 * Checks every `<a2ui>` block in `text` after the thread's earlier blocks, and returns the
 * first error. `earlier` must hold only the messages the web draws blocks from (assistant
 * messages, oldest first): a user's `<a2ui>` text is prose there and claims no surface.
 */
export async function checkA2uiReply(
  text: string,
  earlier: ReadonlyArray<{ readonly id: string; readonly text: string }>,
): Promise<A2uiCheckResult> {
  const segments = splitA2uiSegments(text).filter((segment) => segment.kind === "a2ui");
  if (segments.length === 0) {
    return {
      ok: false,
      error: "No <a2ui>…</a2ui> block outside a code fence: reply with plain text instead.",
    };
  }
  if (segments.some((segment) => !segment.closed)) {
    return { ok: false, error: "An <a2ui> block is not closed with </a2ui> on its own line." };
  }
  const { agent, core, catalog } = await loadA2ui();
  const processor = new core.MessageProcessor([catalog]);
  const state = agent.RendererState.of(processor);
  // Same per-block default surface and same failure rules as the web thread store.
  const apply = (block: { readonly key: string; readonly source: string }): string | undefined => {
    const parser = new agent.ExpressFormat([catalog], {
      surfaceId: `a2ui-${block.key}`,
    }).createParser();
    try {
      let drew = false;
      for (const part of parser.parseResponse(block.source, { state, wrapped: false })) {
        if (part.type === "a2ui" && part.a2ui.length > 0) drew = true;
      }
      return drew ? undefined : "The block drew no surface.";
    } catch (error) {
      return error instanceof Error ? error.message : String(error);
    }
  };
  // An earlier block that failed is one the web blocked: it changed nothing, so skip it.
  for (const block of a2uiThreadBlocks(earlier)) apply(block);
  for (const block of a2uiThreadBlocks([{ id: DRAFT_ID, text }])) {
    const error = apply(block);
    if (error !== undefined) return { ok: false, error };
  }
  return { ok: true };
}
