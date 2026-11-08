import { A2UI_SKILL_MARKDOWN } from "@t3tools/shared/a2uiSkill";
import * as Effect from "effect/Effect";

import * as McpToolAccess from "../../McpToolAccess.ts";
import { A2uiToolkit } from "./tools.ts";

export const layer = McpToolAccess.toLayer(A2uiToolkit, {
  a2ui_guide: McpToolAccess.reads(() => Effect.succeed({ skill: A2UI_SKILL_MARKDOWN })),
});
