---
name: t3code-cards
description: "Reply in T3 Code with an interactive card built from its own components: diffs, code, commands, tables, alerts, choices, switches, fields, and buttons. Use when a structured answer or a question for the user reads better as UI than as prose."
---

# A2UI Express DSL Output Contract

You must output the user interface using A2UI Express.

IMPORTANT: You MUST always surround the entire A2UI Express block with the literal sentinel tags `<a2ui>` and `</a2ui>` (always include both the opening and closing tags; do NOT wrap the tags in backticks or replace the opening tag with a markdown code fence such as ```a2ui).

The host compiler will compile your A2UI Express output into the correct JSON envelopes automatically.

## Grammar Rules

1. Component constructors can be assigned to variables or nested inline inside parent component arguments:
   header = ComponentA(prop1="val1")
   root = ComponentB([header, ComponentC("Click", action=Event("submit"))])

   Keyword arguments (`param=value`) and positional arguments with `_` placeholders are supported.

   Variable names MUST start with a letter or underscore, and only contain letters, digits, and underscores.

2. The interface tree must have a single entry point assigned to the reserved variable 'root'.

3. Primitives:
   - Strings: Quoted with `"` or `"""`. Support for `\n`, `\t`, `\\`, and `\"` escapes.
     Raw Strings: Prefaced by `r` (e.g., `r"..."` or `r"""..."""`), with no escape processing.
   - Numbers: write as integers or decimals, e.g., 42
   - Booleans: write true or false
   - Null values: write null
   - Dates & Times: Values for date-time inputs (e.g. in DateTimeInput) must strictly use RFC 3339 format with a timezone offset (e.g. "2026-03-14T00:00:00Z").

4. Lists: represent as arrays, e.g., [child1, child2].

5. Maps: represent as key-value blocks, e.g., {title: "Overview", child: contentCol}. Map keys are always literal strings (dynamic variable resolution is not supported for keys).

6. Data bindings: prefix absolute paths in the data model with '$', e.g., $/user/firstName.
   Prefix relative list scopes with '$', e.g., $firstName.
   A lone '$' represents an empty relative path which resolves to the root of the current context (e.g. inside a template, representing the entire item itself).

7. Logic and validation: prefix client check rules with '?', e.g., ?required or ?regex("^[0-9]{5}$"). To specify a custom error message for validation failures, append it as an extra string argument, e.g. ?regex("^[0-9]{5}$", "Postal code must be 5 digits").

8. Action events: represent server-side actions using the Event helper:
   Event("save_deal", {rep: $/form/rep})

9. Nested functions: call client functions directly using catalog signatures, for example myFunction("value").

10. Data model population: Assign a value directly to an absolute data path (e.g. $/path/to/key = "value") to populate or initialize values inside the shared dataModel. The value can be a primitive, array, or map.

11. Dynamic list templates: If a component expects a template child list, represent it using the _template helper:
    _template($/path/to/list, itemTemplate)
    And define the template component variable on another line, utilizing relative path references prefixed with $:
    itemTemplate = Image($url)

12. To delete a user interface surface, output the standalone `deleteSurface(surfaceId)` command (no variable assignment):
    deleteSurface("dashboard-surface-1")

13. Static properties: Arguments annotated with '(static)' in the signatures below MUST be defined as literal values or arrays inline. You CANNOT use a dynamic data binding path (prefixed by $) for these arguments.

14. Required actions: Parameters named 'action' (or annotated in component signatures) are strictly required. You must pass a valid Event (e.g. Event("click")) or function call. If no specific action is described in the user request, you must provide a dummy click event like Event("click") instead of passing null or omitting the parameter.

15. Surface targeting: Output `surface(surfaceId)` to specify or target a user interface surface:
    surface("dashboard-surface-1")
    root = Panel(...)

## Positional Component Signatures

Use these exact positional signatures to instantiate components. Do not output property keys:
• Activity(items (static))
  - Description: A list of steps in the style of T3 Code's tool activity log.
  - items: Steps, top to bottom.
    List of maps keys:
    * label - What happened.
    * icon - Glyph for the step.
    * detail - Optional trailing muted text, such as a count or duration.
    * failed - Marks the step as failed.
• Alert(title, description?, tone? (static))
  - Description: A callout with an icon, for a result, warning, or failure.
  - title: Main line.
  - description: Optional detail under the title.
  - tone: Color and icon. Must be one of: 'neutral', 'info', 'success', 'warning', 'error'
• Badge(text, tone? (static))
  - Description: A small status label.
  - text: Label text.
  - tone: Color. Must be one of: 'neutral', 'info', 'success', 'warning', 'error'
• Button(label, action (static), tone? (static))
  - Description: Sends an action back to the agent as the user's next message.
  - label: Button text.
  - tone: Button style. Use primary for the main choice. Must be one of: 'primary', 'secondary', 'outline', 'ghost', 'destructive'
• Choice(options (static), value, label?, multiple? (static), style? (static))
  - Description: Lets the user pick one or more options. Bind value to a data path so a Button action can send it.
  - options: Options to pick from.
    List of maps keys:
    * label - Shown text.
    * value - Stable value sent back.
  - value: Selected values.
  - label: Optional label above the options.
  - multiple: Allow more than one selection.
  - style: Segmented chips or a vertical list of radios or checkboxes. Must be one of: 'chips', 'list'
• CodeBlock(code, language? (static), title? (static))
  - Description: Syntax-highlighted code in T3 Code's code block, with copy and wrap controls.
  - code: The source code.
  - language: Language id for highlighting, such as ts, py, sh, json.
  - title: Optional header label, such as a file name.
• Command(command)
  - Description: A shell command in T3 Code's command box with a copy button.
  - command: The command line, without a prompt sign.
• Diff(patch, path? (static))
  - Description: A unified diff for one file: a file chip and +/- counts above the highlighted patch. Counts are computed from the patch.
  - patch: Unified diff text (lines starting with +, -, or a space; @@ hunk headers allowed).
  - path: File path shown in the header.
• DiffStat(additions (static), deletions (static))
  - Description: Green and red line counts, as in T3 Code's change summaries.
  - additions: Lines added.
  - deletions: Lines removed.
• Field(label, value, placeholder?, multiline? (static))
  - Description: A text input. Bind value to a data path so a Button action can send it.
  - label: Label above the input.
  - value: Current text.
  - placeholder: Hint shown when empty.
  - multiline: Use a multi-line text area.
• File(path (static), label? (static))
  - Description: An inline file chip with the file-type icon T3 Code uses for paths.
  - path: File path. The icon follows the extension.
  - label: Optional text to show instead of the file name.
• Keys(keys (static))
  - Description: A keyboard shortcut in T3 Code's key caps.
  - keys: Keys in order, such as ["Ctrl", "K"].
• Panel(children, title?, description?)
  - Description: A bordered card, the same surface T3 Code uses for its own request cards. Use one as the root of most replies.
  - children: Components inside the panel, top to bottom.
  - title: Optional heading at the top of the panel.
  - description: Optional muted line under the title.
• Stack(children, direction? (static), gap? (static), align? (static), justify? (static))
  - Description: Lays children out in a column or a row.
  - children: Components to lay out.
  - direction: Column or row. Must be one of: 'vertical', 'horizontal'
  - gap: Space between children. Must be one of: 'small', 'medium', 'large'
  - align: Cross-axis alignment. Must be one of: 'start', 'center', 'end', 'stretch'
  - justify: Main-axis distribution. Must be one of: 'start', 'center', 'end', 'between'
• Switch(label, value, description?)
  - Description: An on/off setting row, as in T3 Code's settings.
  - label: Setting name.
  - value: On or off.
  - description: Optional muted explanation.
• Table(columns (static), rows (static))
  - Description: A table in T3 Code's markdown table style.
  - columns: Column headers.
  - rows: Rows of cell text, one array per row.
• Text(text, variant? (static))
  - Description: Plain text in T3 Code's chat typography. No markdown.
  - text: The text.
  - variant: Text style. Must be one of: 'title', 'heading', 'body', 'muted', 'caption'

## Positional Function Signatures

Use these exact positional signatures to instantiate check rules or logic functions:


## Catalog Instructions

Compose replies from T3 Code's own components. Start with a Panel as root, use Stack for layout, and end with Buttons when the user should choose. Inputs (Choice, Switch, Field) only reach the agent through a Button action context, so bind each input's value to a data path and include those paths in the action context. A click arrives as the user's next message: a short line and an a2ui-action code block holding JSON with surfaceId, name, sourceComponentId, and context. A card sends one action, so send a new card to ask again.

### Examples:

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
