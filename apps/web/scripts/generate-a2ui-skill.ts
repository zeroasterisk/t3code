import * as NodeFS from "node:fs";

import { buildA2uiSkill } from "../src/components/chat/a2uiSkill.ts";

const skill = buildA2uiSkill();
const root = new URL("../../../", import.meta.url);
NodeFS.writeFileSync(new URL("docs/user/skills/t3code-cards/SKILL.md", root), skill);
NodeFS.writeFileSync(
  new URL("packages/shared/src/a2uiSkill.ts", root),
  `// Generated from the T3 A2UI catalog by apps/web/scripts/generate-a2ui-skill.ts. Do not edit.\nexport const A2UI_SKILL_MARKDOWN = ${JSON.stringify(skill)};\n`,
);
