import { createContext, lazy, Suspense, use, type ReactNode } from "react";

import { RenderErrorBoundary } from "../RenderErrorBoundary";

const A2uiSurfaceBlock = lazy(() => import("./A2uiSurface"));

/** Names the message a card belongs to, so its inputs and sent state survive re-mounts. */
export const A2uiCardScope = createContext<string | undefined>(undefined);

/** Renders a closed `a2ui` fence as an interactive surface; any failure shows `children`. */
export function MarkdownA2uiBlock({
  source,
  theme,
  onSendMessage,
  children,
}: {
  readonly source: string;
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
          theme={theme}
          onSendMessage={onSendMessage}
          fallback={children}
        />
      </Suspense>
    </RenderErrorBoundary>
  );
}
