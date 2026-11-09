// Renders one `<a2ui>` block from an assistant message: compile Express with the upstream
// parser, validate against the catalog, render natively. Loaded lazily (Express parser ~300 KB).
import { ExpressFormat } from "@a2ui/agent";
import { A2uiSurface, type ReactCatalogComponent } from "@a2ui/react";
import { MessageProcessor, type SurfaceModel } from "@a2ui/web_core";
import { a2uiActionMessage } from "@t3tools/shared/a2uiMessage";
import { useState } from "react";

import { t3BasicCatalog } from "./a2uiCatalog";

const parser = new ExpressFormat([t3BasicCatalog]).createParser();

type Compiled =
  | { readonly ok: true; readonly surfaces: SurfaceModel<ReactCatalogComponent>[] }
  | { readonly ok: false; readonly error: string };

type ActionHandler = ConstructorParameters<typeof MessageProcessor>[1];

/** Compiles and validates; anything the catalog rejects never reaches the DOM. */
function compile(source: string, onAction: ActionHandler): Compiled {
  try {
    const processor = new MessageProcessor<ReactCatalogComponent>([t3BasicCatalog], onAction);
    for (const part of parser.parseResponse(source, { wrapped: false })) {
      if (part.type === "a2ui") processor.processMessages(part.a2ui);
    }
    const surfaces = [...processor.model.surfacesMap.values()];
    return surfaces.length > 0 ? { ok: true, surfaces } : { ok: false, error: "No surface" };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

export default function A2uiBlock({
  source,
  onSendMessage,
}: {
  readonly source: string;
  readonly onSendMessage: ((text: string) => Promise<void>) | undefined;
}) {
  const [sent, setSent] = useState<"idle" | "sending" | "sent" | "failed">("idle");
  const compiled = compile(source, async (action) => {
    if (!onSendMessage) return;
    setSent("sending");
    try {
      await onSendMessage(a2uiActionMessage(action));
      setSent("sent");
    } catch {
      setSent("failed");
    }
  });

  if (!compiled.ok) {
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
          <p className="mt-1 text-muted-foreground">{compiled.error.split(" - Help:")[0]}</p>
          <pre className="mt-1 overflow-x-auto whitespace-pre-wrap font-mono">{source}</pre>
        </details>
      </div>
    );
  }
  return (
    <div
      data-a2ui-surface
      aria-busy={sent === "sending" || undefined}
      className="my-2 flex flex-col gap-2"
    >
      <fieldset
        disabled={!onSendMessage || sent === "sending" || sent === "sent"}
        className="contents"
      >
        {compiled.surfaces.map((surface) => (
          <A2uiSurface key={surface.id} surface={surface} />
        ))}
      </fieldset>
      {sent === "sent" ? <p className="text-xs text-muted-foreground">Sent to the agent</p> : null}
      {sent === "failed" ? (
        <p className="text-xs text-destructive-foreground">Could not send. Try again.</p>
      ) : null}
    </div>
  );
}
