// The "Open in panel" view of one A2UI surface. It reads the thread's store (`a2uiThread`), so the
// panel and the timeline share one SurfaceModel: an edit in either shows in both.
import { useSyncExternalStore } from "react";

import { A2uiLockedSurface } from "./A2uiSurfaceRow";
import { a2uiThreadStore } from "./a2uiThread";

export default function A2uiPanel({
  threadKey,
  surfaceId,
}: {
  readonly threadKey: string;
  readonly surfaceId: string;
}) {
  const store = a2uiThreadStore(threadKey);
  const version = useSyncExternalStore(store.subscribe, store.getVersion);
  const { surface, sent } = store.panelView(surfaceId, version);
  if (!surface) {
    return (
      <p data-a2ui-panel-missing className="p-4 text-xs text-muted-foreground">
        This interactive reply is no longer in memory. Reopen the thread to show it again.
      </p>
    );
  }
  const locked = !store.canSend() || sent === "sending" || sent === "sent";
  return (
    <div data-a2ui-panel className="flex h-full min-h-0 flex-col gap-2 overflow-y-auto p-3">
      <A2uiLockedSurface surface={surface} sent={sent} locked={locked} dimmed={locked} />
    </div>
  );
}
