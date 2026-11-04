import { createComponentImplementation, type ReactComponentImplementation } from "@a2ui/react";
import { Catalog } from "@a2ui/web_core";
import { CircleAlertIcon, CircleCheckIcon, InfoIcon, TriangleAlertIcon } from "lucide-react";
import { createContext, Suspense, use, useId, type ReactNode } from "react";

import { resolveDiffThemeName } from "../../lib/diffRendering";
import { documentChipKindForFileName } from "../../pierre-icons";
import { CommandBlock } from "../CommandBlock";
import { ContextChip, ContextChipLabel } from "../ContextChip";
import { RenderErrorBoundary } from "../RenderErrorBoundary";
import { Alert, AlertDescription, AlertTitle } from "../ui/alert";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { Kbd, KbdGroup } from "../ui/kbd";
import { Label } from "../ui/label";
import { Radio, RadioGroup } from "../ui/radio-group";
import { Switch } from "../ui/switch";
import { Textarea } from "../ui/textarea";
import { Toggle, ToggleGroup } from "../ui/toggle-group";
import t3CatalogJson from "./a2uiT3Catalog.json";
import { DiffStatLabel } from "./DiffStatLabel";
import { MarkdownCodeBlock, SuspenseShikiCodeBlock } from "./MarkdownCodeBlock";
import { MarkdownTable } from "./MarkdownTable";
import { PierreEntryIcon } from "./PierreEntryIcon";
import {
  failedToolIconClassName,
  WorkEntryIcon,
  type WorkEntryIconName,
} from "./TimelineToolActivityIcon";
import { MESSAGE_HEADING_LEVEL } from "./TimelineRowParts";
import { WorkLogList, WorkLogRow } from "./WorkLog";

/** Schema-only catalog the agent-side parser validates Express against. */
export const a2uiApiCatalog = Catalog.fromJson(t3CatalogJson);

export const A2uiThemeContext = createContext<"light" | "dark">("light");

function entry(name: string) {
  const api = a2uiApiCatalog.components.get(name);
  if (!api) throw new Error(`A2UI catalog has no component ${name}`);
  return api;
}

function childList(children: unknown, buildChild: (id: string) => ReactNode): ReactNode {
  return Array.isArray(children) ? children.map((id) => buildChild(String(id))) : null;
}

function strings(value: unknown): ReadonlyArray<string> {
  return Array.isArray(value) ? value.map(String) : [];
}

/** Agent data has no ids; repeats are told apart by occurrence so keys stay data-derived. */
function keyed<T>(items: ReadonlyArray<T>, name: (item: T) => string) {
  const seen = new Map<string, number>();
  return items.map((item) => {
    const base = name(item);
    const count = seen.get(base) ?? 0;
    seen.set(base, count + 1);
    return { key: `${base}#${count}`, item };
  });
}

const PanelImpl = createComponentImplementation(
  entry("Panel"),
  function A2uiPanel({ props, buildChild }) {
    return (
      <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-border/60 bg-card p-4 text-card-foreground">
        {props.title || props.description ? (
          <div className="flex min-w-0 flex-col gap-1">
            {props.title ? (
              <h3 aria-level={MESSAGE_HEADING_LEVEL + 1} className="text-sm font-medium">
                {props.title}
              </h3>
            ) : null}
            {props.description ? (
              <p className="text-sm wrap-anywhere text-muted-foreground">{props.description}</p>
            ) : null}
          </div>
        ) : null}
        {childList(props.children, buildChild)}
      </div>
    );
  },
);

const GAP = { small: "gap-1.5", medium: "gap-3", large: "gap-5" } as const;
const ALIGN = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
} as const;
const JUSTIFY = {
  start: "justify-start",
  center: "justify-center",
  end: "justify-end",
  between: "justify-between",
} as const;

const StackImpl = createComponentImplementation(
  entry("Stack"),
  function A2uiStack({ props, buildChild }) {
    const horizontal = props.direction === "horizontal";
    return (
      <div
        className={[
          "flex min-w-0",
          horizontal ? "flex-row flex-wrap" : "flex-col",
          GAP[props.gap as keyof typeof GAP] ?? GAP.medium,
          ALIGN[props.align as keyof typeof ALIGN] ?? (horizontal ? ALIGN.center : ALIGN.stretch),
          JUSTIFY[props.justify as keyof typeof JUSTIFY] ?? JUSTIFY.start,
        ].join(" ")}
      >
        {childList(props.children, buildChild)}
      </div>
    );
  },
);

const TextImpl = createComponentImplementation(entry("Text"), function A2uiText({ props }) {
  switch (props.variant) {
    case "title":
      return <h2 aria-level={Math.min(2 + MESSAGE_HEADING_LEVEL, 6)}>{props.text}</h2>;
    case "heading":
      return <h3 aria-level={Math.min(3 + MESSAGE_HEADING_LEVEL, 6)}>{props.text}</h3>;
    case "muted":
      return <p className="text-sm text-muted-foreground">{props.text}</p>;
    case "caption":
      return <p className="text-xs text-muted-foreground">{props.text}</p>;
    default:
      return <p className="text-sm">{props.text}</p>;
  }
});

function HighlightedCode({ code, language }: { code: string; language: string }) {
  const resolvedTheme = use(A2uiThemeContext);
  const themeName = resolveDiffThemeName(resolvedTheme);
  const plain = <pre className="chat-markdown-shiki">{code}</pre>;
  return (
    <MarkdownCodeBlock
      code={code}
      language={language}
      fenceTitle={null}
      theme={resolvedTheme}
      isStreaming={false}
    >
      <RenderErrorBoundary resetKeys={[code, language, themeName]} fallback={plain}>
        <Suspense fallback={plain}>
          <SuspenseShikiCodeBlock
            className={`language-${language}`}
            code={code}
            themeName={themeName}
            isStreaming={false}
          />
        </Suspense>
      </RenderErrorBoundary>
    </MarkdownCodeBlock>
  );
}

const CodeBlockImpl = createComponentImplementation(
  entry("CodeBlock"),
  function A2uiCodeBlock({ props }) {
    return <HighlightedCode code={props.code ?? ""} language={props.language || "text"} />;
  },
);

function FileChip({ path, label }: { path: string; label?: string | undefined }) {
  const resolvedTheme = use(A2uiThemeContext);
  return (
    <ContextChip
      kind={documentChipKindForFileName(path) ?? "mention"}
      dir="ltr"
      className="chat-markdown-file-link"
      title={path}
    >
      <PierreEntryIcon pathValue={path} kind="file" theme={resolvedTheme} />
      <ContextChipLabel>{label || path.split("/").at(-1) || path}</ContextChipLabel>
    </ContextChip>
  );
}

const FileImpl = createComponentImplementation(entry("File"), function A2uiFile({ props }) {
  return <FileChip path={props.path ?? ""} label={props.label} />;
});

function countPatchLines(patch: string) {
  let additions = 0;
  let deletions = 0;
  for (const line of patch.split("\n")) {
    if (line.startsWith("+") && !line.startsWith("+++")) additions += 1;
    else if (line.startsWith("-") && !line.startsWith("---")) deletions += 1;
  }
  return { additions, deletions };
}

const DiffImpl = createComponentImplementation(entry("Diff"), function A2uiDiff({ props }) {
  const patch = props.patch ?? "";
  const { additions, deletions } = countPatchLines(patch);
  return (
    <div className="flex min-w-0 flex-col gap-1.5">
      <div className="flex min-w-0 items-center justify-between gap-3 text-sm">
        {props.path ? <FileChip path={props.path} /> : <span />}
        <DiffStatLabel additions={additions} deletions={deletions} layout="inline" />
      </div>
      <HighlightedCode code={patch} language="diff" />
    </div>
  );
});

const CommandImpl = createComponentImplementation(
  entry("Command"),
  function A2uiCommand({ props }) {
    return <CommandBlock command={props.command ?? ""} />;
  },
);

const DiffStatImpl = createComponentImplementation(
  entry("DiffStat"),
  function A2uiDiffStat({ props }) {
    return (
      <DiffStatLabel
        additions={Number(props.additions) || 0}
        deletions={Number(props.deletions) || 0}
        layout="inline"
      />
    );
  },
);

const BADGE_TONES = {
  neutral: "secondary",
  info: "info",
  success: "success",
  warning: "warning",
  error: "error",
} as const;

const BadgeImpl = createComponentImplementation(entry("Badge"), function A2uiBadge({ props }) {
  return (
    <Badge variant={BADGE_TONES[props.tone as keyof typeof BADGE_TONES] ?? "secondary"}>
      {props.text}
    </Badge>
  );
});

const ALERT_TONES = {
  neutral: { variant: "default", Icon: InfoIcon },
  info: { variant: "info", Icon: InfoIcon },
  success: { variant: "success", Icon: CircleCheckIcon },
  warning: { variant: "warning", Icon: TriangleAlertIcon },
  error: { variant: "error", Icon: CircleAlertIcon },
} as const;

const AlertImpl = createComponentImplementation(entry("Alert"), function A2uiAlert({ props }) {
  const tone = ALERT_TONES[props.tone as keyof typeof ALERT_TONES] ?? ALERT_TONES.info;
  return (
    <Alert variant={tone.variant} controlAlignment="first-line">
      <tone.Icon aria-hidden />
      <AlertTitle>{props.title}</AlertTitle>
      {props.description ? <AlertDescription>{props.description}</AlertDescription> : null}
    </Alert>
  );
});

const KeysImpl = createComponentImplementation(entry("Keys"), function A2uiKeys({ props }) {
  return (
    <KbdGroup>
      {keyed(strings(props.keys), (key) => key).map(({ key, item }) => (
        <Kbd key={key}>{item}</Kbd>
      ))}
    </KbdGroup>
  );
});

interface ActivityItem {
  readonly label: string;
  readonly icon?: WorkEntryIconName;
  readonly detail?: string;
  readonly failed?: boolean;
}

function activityItems(items: unknown): ReadonlyArray<ActivityItem> {
  if (!Array.isArray(items)) return [];
  return items.flatMap((item) =>
    item && typeof item === "object" && "label" in item ? [item as ActivityItem] : [],
  );
}

const ActivityImpl = createComponentImplementation(
  entry("Activity"),
  function A2uiActivity({ props }) {
    return (
      <WorkLogList>
        {keyed(activityItems(props.items), (item) => item.label).map(({ key, item }) => (
          <WorkLogRow
            key={key}
            icon={
              <span
                className={
                  item.failed
                    ? `flex size-4 items-center justify-center ${failedToolIconClassName}`
                    : "flex size-4 items-center justify-center"
                }
              >
                <WorkEntryIcon
                  name={item.icon ?? "check"}
                  className="block size-4 shrink-0 stroke-2 opacity-70 light:brightness-60"
                />
              </span>
            }
            label={item.label}
            trailing={
              item.detail ? (
                <span className="shrink-0 text-xs text-muted-foreground tabular-nums">
                  {item.detail}
                </span>
              ) : undefined
            }
          />
        ))}
      </WorkLogList>
    );
  },
);

const TableImpl = createComponentImplementation(entry("Table"), function A2uiTable({ props }) {
  const columns = strings(props.columns);
  const rows: ReadonlyArray<ReadonlyArray<string>> = Array.isArray(props.rows)
    ? props.rows.map(strings)
    : [];
  return (
    <MarkdownTable>
      <thead>
        <tr>
          {keyed(columns, (column) => column).map(({ key, item }) => (
            <th key={key}>{item}</th>
          ))}
        </tr>
      </thead>
      <tbody>
        {keyed(rows, (row) => row.join("\u0000")).map(({ key, item: row }) => (
          <tr key={key}>
            {keyed(row, (cell) => cell).map(({ key: cellKey, item: cell }) => (
              <td key={cellKey}>{cell}</td>
            ))}
          </tr>
        ))}
      </tbody>
    </MarkdownTable>
  );
});

interface ChoiceOption {
  readonly label: string;
  readonly value: string;
}

function choiceOptions(options: unknown): ReadonlyArray<ChoiceOption> {
  if (!Array.isArray(options)) return [];
  return options.flatMap((option) =>
    option && typeof option === "object" && "value" in option
      ? [
          {
            label: String(("label" in option && option.label) || option.value),
            value: String(option.value),
          },
        ]
      : [],
  );
}

function Labeled({
  label,
  labelProps,
  children,
}: {
  label: string | undefined;
  labelProps: { readonly id?: string; readonly htmlFor?: string };
  children: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col items-start gap-2">
      {label ? <Label {...labelProps}>{label}</Label> : null}
      {children}
    </div>
  );
}

const ChoiceImpl = createComponentImplementation(entry("Choice"), function A2uiChoice({ props }) {
  const id = useId();
  const options = choiceOptions(props.options);
  const selected = strings(props.value);
  const select = (next: ReadonlyArray<string>) => props.setValue?.([...next]);
  let control: ReactNode;
  if (props.style !== "list") {
    control = (
      <ToggleGroup
        multiple={Boolean(props.multiple)}
        value={[...selected]}
        variant="outline"
        onValueChange={(next) => select(next)}
      >
        {options.map((option) => (
          <Toggle key={option.value} value={option.value}>
            {option.label}
          </Toggle>
        ))}
      </ToggleGroup>
    );
  } else if (props.multiple) {
    control = (
      <div className="flex flex-col gap-2">
        {options.map((option) => (
          <Label key={option.value}>
            <Checkbox
              checked={selected.includes(option.value)}
              onCheckedChange={(checked) =>
                select(
                  checked
                    ? [...selected, option.value]
                    : selected.filter((value) => value !== option.value),
                )
              }
            />
            {option.label}
          </Label>
        ))}
      </div>
    );
  } else {
    control = (
      <RadioGroup value={selected[0] ?? ""} onValueChange={(next) => select([String(next)])}>
        {options.map((option) => (
          <Label key={option.value}>
            <Radio value={option.value} />
            {option.label}
          </Label>
        ))}
      </RadioGroup>
    );
  }
  return (
    <div role="group" aria-labelledby={props.label ? id : undefined}>
      <Labeled label={props.label} labelProps={{ id }}>
        {control}
      </Labeled>
    </div>
  );
});

const SwitchImpl = createComponentImplementation(entry("Switch"), function A2uiSwitch({ props }) {
  const id = useId();
  return (
    <div className="flex min-w-0 items-center justify-between gap-4">
      <div className="flex min-w-0 flex-col gap-0.5">
        <Label htmlFor={id}>{props.label}</Label>
        {props.description ? (
          <p className="text-xs text-muted-foreground">{props.description}</p>
        ) : null}
      </div>
      <Switch
        id={id}
        checked={Boolean(props.value)}
        onCheckedChange={(checked) => props.setValue?.(checked)}
      />
    </div>
  );
});

const FieldImpl = createComponentImplementation(entry("Field"), function A2uiField({ props }) {
  const id = useId();
  const value = props.value ?? "";
  return (
    <Labeled label={props.label} labelProps={{ htmlFor: id }}>
      {props.multiline ? (
        <Textarea
          id={id}
          value={value}
          placeholder={props.placeholder}
          onChange={(event) => props.setValue?.(event.target.value)}
        />
      ) : (
        <Input
          id={id}
          value={value}
          placeholder={props.placeholder}
          onValueChange={(next) => props.setValue?.(next)}
        />
      )}
    </Labeled>
  );
});

const BUTTON_TONES = {
  primary: "default",
  secondary: "secondary",
  outline: "outline",
  ghost: "ghost",
  destructive: "destructive",
} as const;

const ButtonImpl = createComponentImplementation(entry("Button"), function A2uiButton({ props }) {
  return (
    <Button
      size="sm"
      variant={BUTTON_TONES[props.tone as keyof typeof BUTTON_TONES] ?? "outline"}
      onClick={() => void props.action?.()}
    >
      {props.label}
    </Button>
  );
});

const COMPONENTS: ReadonlyArray<ReactComponentImplementation> = [
  PanelImpl,
  StackImpl,
  TextImpl,
  CodeBlockImpl,
  DiffImpl,
  CommandImpl,
  FileImpl,
  DiffStatImpl,
  BadgeImpl,
  AlertImpl,
  KeysImpl,
  ActivityImpl,
  TableImpl,
  ChoiceImpl,
  SwitchImpl,
  FieldImpl,
  ButtonImpl,
];

/** Catalog the surface renders with; it carries the API catalog's id so surfaces match. */
export const a2uiRenderCatalog: Catalog<ReactComponentImplementation> = new Catalog(
  a2uiApiCatalog.id,
  a2uiApiCatalog.protocolVersion,
  COMPONENTS,
  [],
);
