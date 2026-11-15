// Renders one `<a2ui>` block from an assistant message: compile Express with the upstream
// parser, validate against the catalog, render natively. Loaded lazily (Express parser ~300 KB).
// In a thread, blocks share one processor (`a2uiThread`), so a later reply can update an earlier
// reply's surface; the earlier block then says "updated below" and one live copy stays.
import { useState, useSyncExternalStore } from "react";

import { A2uiPending } from "./A2uiPending";
import { A2uiSurfaceRow, useA2uiPanel } from "./A2uiSurfaceRow";
import { A2uiThreadStore, a2uiThreadStore } from "./a2uiThread";

export default function A2uiBlock({
  source,
  onSendMessage,
  thread,
}: {
  readonly source: string;
  readonly onSendMessage: ((text: string) => Promise<void>) | undefined;
  /** The thread, and this block's key. The timeline syncs the thread (`A2uiThreadSync`). */
  readonly thread?: { readonly threadKey: string; readonly blockKey: string } | undefined;
}) {
  // A standalone block owns its store, built once with its one block.
  const [ownStore] = useState(() => (thread ? null : standaloneStore(source, onSendMessage)));
  const store = thread ? a2uiThreadStore(thread.threadKey) : ownStore!;
  const blockKey = thread?.blockKey ?? "block";
  const version = useSyncExternalStore(store.subscribe, store.getVersion);
  // Reads take `version` so the React Compiler re-derives them when the store changes.
  const view = store.view(blockKey, version);
  // A thread block can open its surfaces in the right panel; a standalone block can't.
  const panel = useA2uiPanel(thread?.threadKey);

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

  // Each surface stays live in the block that last drew it, so one copy can be edited. A surface
  // open in the right panel is live there instead, and this row says so.
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
        if (!surface) return null;
        return (
          <A2uiSurfaceRow
            key={surfaceId}
            surfaceId={surfaceId}
            panel={panel}
            surface={surface}
            sent={sent}
            locked={locked}
            dimmed={locked && !!onSendMessage}
          />
        );
      })}
    </div>
  );
}

function standaloneStore(
  source: string,
  onSendMessage: ((text: string) => Promise<void>) | undefined,
): A2uiThreadStore {
  const store = new A2uiThreadStore();
  store.sync([{ key: "block", source }]);
  store.setSendMessage(onSendMessage);
  return store;
}
