/** Placeholder while an A2UI block streams or its renderer chunk loads. */
export function A2uiPending() {
  return (
    <div
      data-a2ui-pending
      aria-label="Loading interactive reply"
      className="my-2 h-24 animate-pulse rounded-2xl border border-border/60 bg-muted/30"
    />
  );
}
