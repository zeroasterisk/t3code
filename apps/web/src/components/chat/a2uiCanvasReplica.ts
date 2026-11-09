import type { A2uiSurfaceState } from "@t3tools/shared/a2uiMessage";

/**
 * The composer's view of each thread's live A2UI canvases. It lives outside the lazy A2UI chunk
 * so sending a typed message never loads it; the chunk reports state here as canvases change.
 */
type Snapshot = () => ReadonlyArray<A2uiSurfaceState>;

const snapshots = new Map<string, Snapshot>();
const shared = new Map<string, string>();

const sharedKey = (threadKey: string, surfaceId: string) => `${threadKey}\u0000${surfaceId}`;

export function provideA2uiCanvasState(threadKey: string, snapshot: Snapshot): void {
  snapshots.set(threadKey, snapshot);
}

/** Records state the agent already knows: what it last set, or what the user last sent. */
export function markA2uiCanvasStateShared(threadKey: string, state: A2uiSurfaceState): void {
  shared.set(sharedKey(threadKey, state.surfaceId), JSON.stringify(state.dataModel));
}

/** The canvases the user changed since the agent last saw them, now marked as seen. */
export function takeChangedA2uiCanvasState(threadKey: string): ReadonlyArray<A2uiSurfaceState> {
  const changed = (snapshots.get(threadKey)?.() ?? []).filter(
    (state) =>
      shared.get(sharedKey(threadKey, state.surfaceId)) !== JSON.stringify(state.dataModel),
  );
  for (const state of changed) markA2uiCanvasStateShared(threadKey, state);
  return changed;
}
