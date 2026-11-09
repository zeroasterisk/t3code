import { A2UI_ACTION_FENCE_LANGUAGE, A2UI_STATE_FENCE_LANGUAGE } from "@t3tools/shared/a2uiMessage";
import { ChevronRightIcon, LayersIcon, MousePointerClickIcon, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";

import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "../ui/collapsible";

/** One line saying what an A2UI exchange did; the payload stays one click away. */
export function A2uiReceipt({
  icon: Icon,
  label,
  children,
}: {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <Collapsible className="my-1" data-a2ui-receipt="">
      <CollapsibleTrigger className="group/receipt flex max-w-full min-w-0 items-center gap-1.5 text-left text-xs text-muted-foreground hover:text-foreground">
        <Icon aria-hidden className="size-3.5 shrink-0" />
        <span className="truncate">{label}</span>
        <ChevronRightIcon
          aria-hidden
          className="size-3.5 shrink-0 transition-transform group-data-panel-open/receipt:rotate-90"
        />
      </CollapsibleTrigger>
      <CollapsiblePanel>{children}</CollapsiblePanel>
    </Collapsible>
  );
}

function parseJson(code: string): unknown {
  try {
    return JSON.parse(code);
  } catch {
    return undefined;
  }
}

/** Labels the action and state blocks a card adds to user messages; null for any other block. */
export function a2uiFenceReceipt(
  language: string,
  code: string,
): { readonly icon: LucideIcon; readonly label: string } | null {
  if (language === A2UI_ACTION_FENCE_LANGUAGE) {
    const action = parseJson(code) as { name?: unknown; surfaceId?: unknown } | undefined;
    const name = typeof action?.name === "string" ? action.name.replaceAll("_", " ") : "an action";
    const surface = typeof action?.surfaceId === "string" ? ` from ${action.surfaceId}` : "";
    return { icon: MousePointerClickIcon, label: `Sent ${name}${surface}` };
  }
  if (language === A2UI_STATE_FENCE_LANGUAGE) {
    const states = parseJson(code);
    const ids = Array.isArray(states)
      ? states.flatMap((state) =>
          typeof state?.surfaceId === "string" ? [state.surfaceId as string] : [],
        )
      : [];
    return {
      icon: LayersIcon,
      label: `Shared the current state of ${ids.join(", ") || "a canvas"}`,
    };
  }
  return null;
}
