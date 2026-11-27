import { OrchestratorMcpFailure } from "@t3tools/contracts";
import * as Effect from "effect/Effect";

import { a2uiRules, checkA2uiReply } from "../../../a2ui/A2uiReplyCheck.ts";
import * as ThreadManagementService from "../../../orchestration-v2/ThreadManagementService.ts";
import * as McpInvocationContext from "../../McpInvocationContext.ts";
import * as McpToolAccess from "../../McpToolAccess.ts";
import { A2uiToolkit } from "./tools.ts";

const loadFailure = (what: string) => () =>
  new OrchestratorMcpFailure({
    code: "orchestration_error",
    message: `The A2UI ${what} could not be loaded.`,
  });

export const layer = McpToolAccess.toLayer(A2uiToolkit, {
  a2ui_rules: McpToolAccess.readsAsCaller(() =>
    Effect.tryPromise({ try: () => a2uiRules(), catch: loadFailure("rules") }).pipe(
      Effect.map((rules) => ({ rules })),
    ),
  ),
  a2ui_check: McpToolAccess.readsAsCaller(({ reply }) =>
    Effect.gen(function* () {
      const scope = yield* McpInvocationContext.McpInvocationContext;
      const { thread } = yield* McpInvocationContext.requireThreadScope(scope, "a2ui_check");
      const threads = yield* ThreadManagementService.ThreadManagementService;
      // Only assistant messages draw forms (apps/web MessagesTimeline): a user's <a2ui> text is prose.
      const { messages } = yield* threads
        .getThreadRecords(thread.threadId, ["messages"], { messageRoles: ["assistant"] })
        .pipe(
          Effect.mapError(
            () =>
              new OrchestratorMcpFailure({
                code: "orchestration_error",
                message: "The thread's messages could not be read.",
              }),
          ),
        );
      // A still-streaming message is the reply being drafted, not an earlier one.
      const earlier = messages.filter(
        (message) =>
          message.role === "assistant" && !message.streaming && message.text.includes("<a2ui>"),
      );
      return yield* Effect.tryPromise({
        try: () => checkA2uiReply(reply, earlier),
        catch: loadFailure("checker"),
      });
    }),
  ),
});
