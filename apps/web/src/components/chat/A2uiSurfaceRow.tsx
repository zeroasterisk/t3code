// One live A2UI surface, shared by the timeline (`A2uiBlock`) and the right panel (`A2uiPanel`):
// the surface behind a lock once its action is sent, its send notice, and in a thread the
// "Open in panel" button or, while the panel holds it, a stub that points there.
import { A2uiSurface, type ReactCatalogComponent } from "@a2ui/react";
import type { SurfaceModel } from "@a2ui/web_core";
import { parseScopedThreadKey } from "@t3tools/client-runtime/environment";
import { PanelRightOpenIcon } from "lucide-react";

import {
  rightPanelHostRef,
  selectThreadRightPanelState,
  useRightPanelStore,
} from "../../rightPanelStore";
import { Button } from "../ui/button";
import type { A2uiSendState } from "./a2uiThread";

/** The surfaces a thread has open in the right panel, and a way to open one there. */
export function useA2uiPanel(threadKey: string | undefined) {
  const ref = threadKey ? parseScopedThreadKey(threadKey) : null;
  // One string, so the selector result stays stable between renders.
  const ids = useRightPanelStore((state) =>
    ref
      ? selectThreadRightPanelState(state.byThreadKey, rightPanelHostRef(ref))
          .surfaces.flatMap((surface) =>
            surface.kind === "a2ui" && surface.threadKey === threadKey ? [surface.surfaceId] : [],
          )
          .join("\n")
      : "",
  );
  // The surface showing in the open panel, if it is one of this thread's.
  const shown = useRightPanelStore((state) => {
    if (!ref) return null;
    const panel = selectThreadRightPanelState(state.byThreadKey, rightPanelHostRef(ref));
    const active = panel.isOpen
      ? panel.surfaces.find((surface) => surface.id === panel.activeSurfaceId)
      : undefined;
    return active?.kind === "a2ui" && active.threadKey === threadKey ? active.surfaceId : null;
  });
  if (!ref || !threadKey) return null;
  return {
    inPanel: new Set(ids ? ids.split("\n") : []),
    shown,
    open: (surfaceId: string) =>
      useRightPanelStore.getState().openA2uiSurface(ref, threadKey, surfaceId),
  };
}

export function A2uiLockedSurface({
  surface,
  sent,
  locked,
  dimmed,
}: {
  readonly surface: SurfaceModel<ReactCatalogComponent>;
  readonly sent: A2uiSendState | undefined;
  readonly locked: boolean;
  readonly dimmed: boolean;
}) {
  return (
    <>
      {/* `inert` also locks Base UI controls, which ignore `<fieldset disabled>`. */}
      <div
        inert={locked}
        data-a2ui-locked={locked || undefined}
        className={dimmed ? "flex flex-col gap-2 opacity-64" : "flex flex-col gap-2"}
      >
        <A2uiSurface surface={surface} />
      </div>
      {sent === "sent" ? <p className="text-xs text-muted-foreground">Sent to the agent</p> : null}
      {sent === "failed" ? (
        <p className="text-xs text-destructive-foreground">Could not send. Try again.</p>
      ) : null}
    </>
  );
}

export function A2uiSurfaceRow({
  surfaceId,
  panel,
  ...props
}: Parameters<typeof A2uiLockedSurface>[0] & {
  readonly surfaceId: string;
  readonly panel: ReturnType<typeof useA2uiPanel>;
}) {
  if (panel?.inPanel.has(surfaceId)) {
    return (
      <div data-a2ui-in-panel className="flex items-center gap-1 text-xs text-muted-foreground">
        <span>Interactive reply open in panel</span>
        {panel.shown === surfaceId ? null : (
          <Button size="xs" variant="ghost" onClick={() => panel.open(surfaceId)}>
            Show
          </Button>
        )}
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-1">
      {panel ? (
        <Button
          size="icon-xs"
          variant="ghost"
          className="self-end"
          aria-label="Open in panel"
          title="Open in panel"
          onClick={() => panel.open(surfaceId)}
        >
          <PanelRightOpenIcon />
        </Button>
      ) : null}
      <A2uiLockedSurface {...props} />
    </div>
  );
}
