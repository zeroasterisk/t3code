// Keeps a thread's A2UI store (`a2uiThread`) in step with its closed blocks, from the timeline, so
// the right panel has its surface even when the row that drew it is virtualized away. Lazy, like
// A2uiBlock: it pulls in the Express parser.
import { useLayoutEffect } from "react";

import { a2uiThreadStore, type A2uiThreadBlock } from "./a2uiThread";

export default function A2uiThreadSync({
  threadKey,
  blocks,
  onSendMessage,
}: {
  readonly threadKey: string;
  readonly blocks: readonly A2uiThreadBlock[];
  readonly onSendMessage: ((text: string) => Promise<void>) | undefined;
}) {
  const store = a2uiThreadStore(threadKey);
  // oxlint-disable-next-line t3code/no-unreasoned-state-sync -- keeps the thread's A2UI processor, which lives outside React, in step with the closed blocks and send function while the timeline is mounted
  useLayoutEffect(() => {
    store.sync(blocks);
    store.setSendMessage(onSendMessage);
    return () => store.setSendMessage(undefined);
  }, [store, blocks, onSendMessage]);
  return null;
}
