import { ExpressFormat } from "@a2ui/agent";
import { Catalog, MessageProcessor } from "@a2ui/web_core";
import { A2UI_SKILL_MARKDOWN } from "@t3tools/shared/a2uiSkill";
import { describe, expect, it } from "vite-plus/test";

import installableSkill from "../../../../../docs/user/skills/t3code-cards/SKILL.md?raw";
import t3CatalogJson from "./a2uiT3Catalog.json" with { type: "json" };
import { A2UI_SKILL_EXAMPLE, buildA2uiSkill } from "./a2uiSkill";

const REGENERATE = "Run `node apps/web/scripts/generate-a2ui-skill.ts` after changing the catalog.";

describe("A2UI skill", () => {
  it("matches the generated copies", () => {
    const skill = buildA2uiSkill();
    expect(installableSkill, REGENERATE).toBe(skill);
    expect(A2UI_SKILL_MARKDOWN, REGENERATE).toBe(skill);
  });

  it("teaches an example the catalog accepts", () => {
    const api = Catalog.fromJson(t3CatalogJson);
    const catalog = new Catalog(api.id, api.protocolVersion, [...api.components.values()], []);
    const parts = new ExpressFormat([api]).createParser().parseResponse(A2UI_SKILL_EXAMPLE);
    const processor = new MessageProcessor([catalog]);
    const errors = parts.flatMap((part) =>
      part.type === "a2ui" ? processor.processMessagesWithErrors(part.a2ui) : [],
    );
    expect(errors).toEqual([]);
    expect(processor.getSurfaces().size).toBe(1);
  });
});
