import { OrchestratorMcpFailure } from "@t3tools/contracts";
import * as Schema from "effect/Schema";
import { Tool, Toolkit } from "effect/ai";

const A2uiGuideTool = Tool.make("a2ui_guide", {
  description:
    "Get the components and syntax for answering with an interactive card (diff, code, table, choices, buttons) drawn by T3 Code. The user's click comes back as a message.",
  success: Schema.Struct({ skill: Schema.String }),
  failure: OrchestratorMcpFailure,
})
  .annotate(Tool.Title, "Get the A2UI card guide")
  .annotate(Tool.Readonly, true)
  .annotate(Tool.Destructive, false)
  .annotate(Tool.Idempotent, true)
  .annotate(Tool.OpenWorld, false);

export const A2uiToolkit = Toolkit.make(A2uiGuideTool);
