// Renders one `<a2ui>` block from an assistant message: compile Express with the upstream
// parser, validate against the catalog, render natively. Loaded lazily (Express parser ~300 KB).
// In a thread, blocks share one processor (`a2uiThread`), so a later reply can update an earlier
// reply's surface; the earlier block then says "updated below" and one live copy stays.
import { A2uiSurface } from "@a2ui/react";
import { useState, useSyncExternalStore } from "react";

import { A2uiPending } from "./A2uiPending";
import { A2uiThreadStore, a2uiThreadStore, type A2uiThreadBlock } from "./a2uiThread";

export default function A2uiBlock({
  source,
  onSendMessage,
  thread,
}: {
  readonly source: string;
  readonly onSendMessage: ((text: string) => Promise<void>) | undefined;
  /** The thread's closed blocks in order, and this block's key. Absent, the block stands alone. */
  readonly thread?:
    | {
        readonly threadKey: string;
        readonly blocks: readonly A2uiThreadBlock[];
        readonly blockKey: string;
      }
    | undefined;
}) {
  const [ownStore] = useState(() => new A2uiThreadStore());
  const store = thread ? a2uiThreadStore(thread.threadKey) : ownStore;
  const blockKey = thread?.blockKey ?? "block";
  // Idempotent: blocks already applied are skipped, so re-renders keep the edited data model.
  store.sync(thread?.blocks ?? [{ key: blockKey, source }]);
  store.setSendMessage(onSendMessage);
  const version = useSyncExternalStore(store.subscribe, store.getVersion);
  // Reads take `version` so the React Compiler re-derives them when the store changes.
  const view = store.view(blockKey, version);

  const result = view.result;
  if (!result) return <A2uiPending />;
  if (!result.ok) {
    return (
      <div
        data-a2ui-error
        role="note"
        className="my-2 rounded-xl border border-warning/40 p-3 text-xs"
      >
        <p className="font-medium text-foreground">Interactive reply blocked</p>
        <p className="mt-0.5 text-muted-foreground">
          It uses something outside T3 Code's component catalog. Nothing was rendered, loaded or
          run.
        </p>
        <details className="mt-2">
          <summary className="cursor-pointer text-muted-foreground">Details</summary>
          <p className="mt-1 text-muted-foreground">{result.error.split(" - Help:")[0]}</p>
          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap font-mono">{source}</pre>
        </details>
      </div>
    );
  }

  // Each surface stays live in the block that last drew it, so one copy can be edited.
  const live = view.live;
  if (live.length === 0) {
    return (
      <p data-a2ui-superseded className="my-2 text-xs text-muted-foreground">
        Interactive reply updated below
      </p>
    );
  }
  const states = view.states;
  return (
    <div
      data-a2ui-surface
      aria-busy={states.includes("sending") || undefined}
      className="my-2 flex flex-col gap-2"
    >
      {live.map((surfaceId, index) => {
        const surface = view.surfaces[index];
        const sent = states[index];
        const locked = !onSendMessage || sent === "sending" || sent === "sent";
        return surface ? (
          // `inert` also locks Base UI controls, which ignore `<fieldset disabled>`.
          <div
            key={surfaceId}
            inert={locked}
            data-a2ui-locked={locked || undefined}
            className={
              locked && onSendMessage ? "flex flex-col gap-2 opacity-64" : "flex flex-col gap-2"
            }
          >
            <A2uiSurface surface={surface} />
          </div>
        ) : null;
      })}
      {states.includes("sent") ? (
        <p className="text-xs text-muted-foreground">Sent to the agent</p>
      ) : null}
      {states.includes("failed") ? (
        <p className="text-xs text-destructive-foreground">Could not send. Try again.</p>
      ) : null}
    </div>
  );
}
