import { OrchestratorMcpFailure } from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { Tool, Toolkit } from "effect/ai";

import * as ThreadManagementService from "../../../orchestration-v2/ThreadManagementService.ts";
import * as McpInvocationContext from "../../McpInvocationContext.ts";

// Both tools read only: they change nothing, so read-only sandboxes and plan mode may use them.
const A2uiRulesTool = Tool.make("a2ui_rules", {
  description:
    "The full rules for interactive A2UI forms in a reply: the Express syntax, the basic catalog's components, and how T3 Code shows them. Call before your first form.",
  // No `parameters`: Tool.make defaults to Tool.EmptyParams (an object root).
  success: Schema.Struct({ rules: Schema.String }),
  failure: OrchestratorMcpFailure,
  failureMode: "return",
  dependencies: [McpInvocationContext.McpInvocationContext],
})
  .annotate(Tool.Title, "A2UI rules")
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false)
  .annotate(Tool.Idempotent, true)
  .annotate(Tool.OpenWorld, false);

const A2uiCheckTool = Tool.make("a2ui_check", {
  description:
    "Check a draft reply's <a2ui> blocks the way this thread will draw them, after its earlier forms. Returns ok, or the first error to fix.",
  parameters: Schema.Struct({
    reply: Schema.String.check(Schema.isMinLength(1), Schema.isMaxLength(256_000)).annotate({
      description: "The whole draft reply, prose and blocks.",
    }),
  }),
  success: Schema.Struct({ ok: Schema.Boolean, error: Schema.optional(Schema.String) }),
  failure: OrchestratorMcpFailure,
  failureMode: "return",
  dependencies: [
    McpInvocationContext.McpInvocationContext,
    ThreadManagementService.ThreadManagementService,
  ],
})
  .annotate(Tool.Title, "Check A2UI reply")
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false)
  .annotate(Tool.Idempotent, true)
  .annotate(Tool.OpenWorld, false);

export const A2uiToolkit = Toolkit.make(A2uiRulesTool, A2uiCheckTool);
