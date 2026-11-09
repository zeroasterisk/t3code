import { createContext, lazy, Suspense, use, type ReactNode } from "react";

import { RenderErrorBoundary } from "../RenderErrorBoundary";

const A2uiSurfaceBlock = lazy(() => import("./A2uiSurface"));

export interface A2uiCardScopeValue {
  readonly threadKey: string | undefined;
  readonly messageId: string;
  readonly createdAt: string;
}

/**
 * Names the message a card belongs to, so its inputs and sent state survive re-mounts, and the
 * thread and order that live canvases are built in.
 */
export const A2uiCardScope = createContext<A2uiCardScopeValue | undefined>(undefined);

/** Renders a closed `a2ui` fence as an interactive surface; any failure shows `children`. */
export function MarkdownA2uiBlock({
  source,
  offset = 0,
  theme,
  onSendMessage,
  children,
}: {
  readonly source: string;
  /** Where the block starts in its message, which orders a message's canvas updates. */
  readonly offset?: number;
  readonly theme: "light" | "dark";
  readonly onSendMessage: (text: string) => Promise<void>;
  readonly children: ReactNode;
}) {
  const scope = use(A2uiCardScope);
  return (
    <RenderErrorBoundary resetKeys={[source]} fallback={children}>
      <Suspense fallback={children}>
        <A2uiSurfaceBlock
          key={source}
          source={source}
          scope={scope}
          offset={offset}
          theme={theme}
          onSendMessage={onSendMessage}
          fallback={children}
        />
      </Suspense>
    </RenderErrorBoundary>
  );
}
