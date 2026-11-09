import { ExpressFormat, SkillGenerator } from "@a2ui/agent";
import { Catalog } from "@a2ui/web_core";

import t3CatalogJson from "./a2uiT3Catalog.json" with { type: "json" };

export const A2UI_SKILL_EXAMPLE = `A card that asks once:

<a2ui>
surface("review")
$/scope = ["patch"]
diff = Diff("""@@ -3,1 +3,3 @@
-  return Math.min(Math.max(value, min), max);
+  if (min > max) throw new RangeError("min > max");
+  return Math.min(Math.max(value, min), max);""", path="src/math.ts")
scope = Choice([{label: "Patch only", value: "patch"}, {label: "Open a PR", value: "pr"}], $/scope, label="How should I land it?")
apply = Button("Apply", Event("apply", {scope: $/scope}), tone="primary")
root = Panel([diff, scope, Stack([apply, Button("Not now", Event("skip"), tone="ghost")], direction="horizontal", gap="small")], title="clamp() rejects inverted bounds")
</a2ui>

A live canvas, then a later reply that changes it in place:

<a2ui>
surface("release", sendDataModel=true)
$/version = "1.5.0"
$/npm = true
root = Panel([Field("Version", $/version), Switch("Publish to npm", $/npm), Button("Ship", Event("ship"), tone="primary")], title="Release plan")
</a2ui>

<a2ui>
surface("release", update=true)
$/version = "1.5.0-beta.1"
$/npm = false
</a2ui>`;

/** The optional agent skill for T3 Code's A2UI cards, compiled from the catalog. */
export function buildA2uiSkill(): string {
  const catalog = Catalog.fromJson(t3CatalogJson);
  const format = new ExpressFormat([catalog], {
    examples: { [catalog.id]: A2UI_SKILL_EXAMPLE },
  });
  return new SkillGenerator(format)
    .generateSkill({
      name: "t3code-cards",
      description:
        "Reply in T3 Code with an interactive card built from its own components: diffs, code, commands, tables, alerts, choices, switches, fields, and buttons. Use when a structured answer or a question for the user reads better as UI than as prose.",
    })
    .toMarkdown();
}
