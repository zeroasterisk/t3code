import { ExpressFormat } from "@a2ui/agent";
import { A2uiSurface, type ReactCatalogComponent } from "@a2ui/react";
import { type ActionPayload, MessageProcessor } from "@a2ui/web_core";
import { a2uiActionMessage } from "@t3tools/shared/a2uiMessage";
import { useEffect, useState, type ReactNode } from "react";

import { useStableCallback } from "../../hooks/useStableCallback";
import { A2uiThemeContext, a2uiApiCatalog, a2uiRenderCatalog } from "./a2uiCatalog";

/** Bounds parse cost; longer payloads render as the plain code block. */
const MAX_A2UI_SOURCE_LENGTH = 16_000;

interface CardState {
  processor: MessageProcessor<ReactCatalogComponent> | null;
  sent: boolean;
  dispatch: ((action: ActionPayload) => void) | undefined;
}

const MAX_KEPT_CARDS = 100;
/** Cards re-mount as the timeline virtualizes; keep their inputs and sent state per message. */
const keptCards = new Map<string, CardState>();

function createCardState(source: string): CardState {
  const state: CardState = { processor: null, sent: false, dispatch: undefined };
  state.processor = buildProcessor(source, (action) => state.dispatch?.(action));
  return state;
}

function cardState(scope: string | undefined, source: string): CardState {
  if (scope === undefined) return createCardState(source);
  const key = `${scope}\u0000${source}`;
  const kept = keptCards.get(key);
  if (kept) {
    keptCards.delete(key);
    keptCards.set(key, kept);
    return kept;
  }
  const state = createCardState(source);
  keptCards.set(key, state);
  const oldest = keptCards.keys().next();
  if (keptCards.size > MAX_KEPT_CARDS && !oldest.done) keptCards.delete(oldest.value);
  return state;
}

function setCardSent(state: CardState, sent: boolean) {
  state.sent = sent;
}

function routeCardActions(state: CardState, dispatch: (action: ActionPayload) => void) {
  state.dispatch = dispatch;
  return () => {
    if (state.dispatch === dispatch) state.dispatch = undefined;
  };
}

function buildProcessor(source: string, onAction: (action: ActionPayload) => void) {
  if (source.length > MAX_A2UI_SOURCE_LENGTH) return null;
  try {
    const parts = new ExpressFormat([a2uiApiCatalog]).createParser().parseResponse(source, {
      wrapped: false,
    });
    const processor = new MessageProcessor<ReactCatalogComponent>([a2uiRenderCatalog], onAction);
    for (const part of parts) {
      if (part.type !== "a2ui") continue;
      if (processor.processMessagesWithErrors(part.a2ui).length > 0) return null;
    }
    const surfaces = [...processor.getSurfaces().values()];
    if (surfaces.length === 0) return null;
    if (surfaces.some((surface) => !surface.componentsModel.get(surface.rootId))) return null;
    return processor;
  } catch {
    return null;
  }
}

export default function A2uiSurfaceBlock({
  source,
  scope,
  theme,
  onSendMessage,
  fallback,
}: {
  readonly source: string;
  readonly scope: string | undefined;
  readonly theme: "light" | "dark";
  readonly onSendMessage: (text: string) => Promise<void>;
  readonly fallback: ReactNode;
}) {
  const [state] = useState(() => cardState(scope, source));
  const [sent, setSent] = useState(state.sent);
  const onAction = useStableCallback((action: ActionPayload) => {
    if (state.sent) return;
    setCardSent(state, true);
    setSent(true);
    onSendMessage(
      a2uiActionMessage({
        surfaceId: action.surfaceId,
        name: action.name,
        sourceComponentId: action.sourceComponentId,
        context: action.context,
      }),
    ).catch(() => {
      setCardSent(state, false);
      setSent(false);
    });
  });
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- routes a kept processor's actions to whichever mount is live
  useEffect(() => routeCardActions(state, onAction), [state, onAction]);
  const { processor } = state;
  if (!processor) return fallback;
  return (
    <div
      className={`my-2 flex flex-col gap-3 ${sent ? "opacity-60" : ""}`}
      data-testid="a2ui-surface"
      data-a2ui-surface=""
      inert={sent}
    >
      <A2uiThemeContext value={theme}>
        {[...processor.getSurfaces().values()].map((surface) => (
          <A2uiSurface key={surface.id} surface={surface} />
        ))}
      </A2uiThemeContext>
    </div>
  );
}
