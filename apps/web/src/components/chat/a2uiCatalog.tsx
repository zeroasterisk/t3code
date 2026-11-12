// A2UI basic catalog (v1.0) drawn with T3 Code's own `components/ui`. The component APIs
// (names, props, validation) come from the published catalog JSON; only the look is ours.
import { createComponentImplementation, type ReactCatalogComponent } from "@a2ui/react";
import {
  Catalog,
  sanitizeMediaUrl,
  type ComponentApi,
  type ResolvedChildRef,
} from "@a2ui/web_core";
// Only the pure component APIs, functions and theme schema: `basicCatalog` itself carries the
// Lit elements, so importing it would pull lit into this chunk.
import {
  BASIC_COMPONENTS,
  BASIC_FUNCTIONS,
  BasicCatalogThemeSchema,
} from "@a2ui/web_core/catalogs/basic/v1";
import type { ReactNode } from "react";

import { cn } from "~/lib/utils";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Checkbox } from "../ui/checkbox";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Radio, RadioGroup } from "../ui/radio-group";
import { Separator } from "../ui/separator";
import { Textarea } from "../ui/textarea";
import { Toggle, ToggleGroup } from "../ui/toggle-group";

// Resolved props are typed from the catalog JSON at runtime, so renderers read them loosely.
type Props = Record<string, unknown> & {
  setValue?: (value: unknown) => void;
  action?: () => Promise<void>;
  isValid?: boolean;
  validationErrors?: string[];
};
type Build = (id: string, basePath?: string) => ReactNode;

function api(name: string): ComponentApi {
  const entry = BASIC_COMPONENTS.find((candidate) => candidate.name === name);
  if (!entry) throw new Error(`A2UI basic catalog has no ${name}`);
  return entry;
}

function component(
  name: string,
  render: (props: Props, buildChild: Build) => ReactNode,
): ReactCatalogComponent {
  return createComponentImplementation(api(name), ({ props, buildChild }) =>
    render(props as Props, buildChild),
  );
}

const str = (value: unknown) => (typeof value === "string" ? value : "");

function children(props: Props, buildChild: Build): ReactNode[] {
  const list = Array.isArray(props.children)
    ? (props.children as (string | ResolvedChildRef)[])
    : [];
  return list.map((child) =>
    typeof child === "string" ? (
      <div key={child}>{buildChild(child)}</div>
    ) : (
      <div key={`${child.id}@${child.basePath}`}>{buildChild(child.id, child.basePath)}</div>
    ),
  );
}

const JUSTIFY: Record<string, string> = {
  center: "justify-center",
  end: "justify-end",
  spaceBetween: "justify-between",
  spaceAround: "justify-around",
  spaceEvenly: "justify-evenly",
  stretch: "justify-stretch",
};
const ALIGN: Record<string, string> = {
  start: "items-start",
  center: "items-center",
  end: "items-end",
  stretch: "items-stretch",
};

function FieldError({ props }: { props: Props }) {
  if (props.isValid !== false || !props.validationErrors?.length) return null;
  return <p className="text-xs text-destructive-foreground">{props.validationErrors[0]}</p>;
}

const components: ReactCatalogComponent[] = [
  component("Text", (props) => (
    // Inherit color so a Button's label follows the button variant.
    <p className={cn("text-sm", props.variant === "caption" && "text-xs text-muted-foreground")}>
      {str(props.text)}
    </p>
  )),
  component("Image", (props) => (
    <img
      src={sanitizeMediaUrl(props.url)}
      alt={str(props.description)}
      className={cn(
        "max-w-full rounded-lg",
        props.variant === "icon" && "size-6",
        props.variant === "avatar" && "size-8 rounded-full",
      )}
    />
  )),
  component("Icon", (props) => (
    <Badge variant="outline" size="sm">
      {typeof props.name === "string" ? props.name : "•"}
    </Badge>
  )),
  component("Row", (props, buildChild) => (
    <div
      className={cn(
        "flex flex-wrap gap-2",
        JUSTIFY[str(props.justify)],
        ALIGN[str(props.align) || "center"],
      )}
    >
      {children(props, buildChild)}
    </div>
  )),
  component("Column", (props, buildChild) => (
    <div
      className={cn("flex flex-col gap-3", JUSTIFY[str(props.justify)], ALIGN[str(props.align)])}
    >
      {children(props, buildChild)}
    </div>
  )),
  component("List", (props, buildChild) => (
    <div
      className={cn(
        "flex gap-2",
        props.direction === "horizontal" ? "flex-row overflow-x-auto" : "flex-col",
      )}
    >
      {children(props, buildChild)}
    </div>
  )),
  component("Card", (props, buildChild) => (
    <div className="rounded-xl border border-border/80 bg-card/70 p-3">
      {typeof props.child === "string" ? buildChild(props.child) : null}
    </div>
  )),
  component("Divider", (props) => (
    <Separator orientation={props.axis === "vertical" ? "vertical" : "horizontal"} />
  )),
  component("Button", (props, buildChild) => (
    <Button
      size="sm"
      variant={
        props.variant === "primary"
          ? "default"
          : props.variant === "borderless"
            ? "ghost"
            : "outline"
      }
      disabled={props.isValid === false}
      onClick={() => void props.action?.()}
    >
      {typeof props.child === "string" ? buildChild(props.child) : null}
    </Button>
  )),
  component("TextField", (props) => {
    const Field = props.variant === "longText" ? Textarea : Input;
    return (
      <div className="flex flex-col gap-1.5">
        {str(props.label) ? <Label>{str(props.label)}</Label> : null}
        <Field
          size="sm"
          type={
            props.variant === "obscured"
              ? "password"
              : props.variant === "number"
                ? "number"
                : "text"
          }
          placeholder={str(props.placeholder)}
          value={str(props.value)}
          aria-invalid={props.isValid === false || undefined}
          onChange={(event: { target: { value: string } }) => props.setValue?.(event.target.value)}
        />
        <FieldError props={props} />
      </div>
    );
  }),
  component("CheckBox", (props) => (
    <label className="flex cursor-pointer items-center gap-2 text-sm">
      <Checkbox
        checked={props.value === true}
        onCheckedChange={(checked) => props.setValue?.(checked === true)}
      />
      {str(props.label)}
    </label>
  )),
  component("ChoicePicker", (props) => {
    const options = Array.isArray(props.options)
      ? (props.options as { label?: unknown; value?: unknown }[])
      : [];
    const selected = Array.isArray(props.value) ? (props.value as string[]) : [];
    const multi = props.variant === "multipleSelection";
    return (
      <div className="flex flex-col gap-1.5">
        {str(props.label) ? <Label>{str(props.label)}</Label> : null}
        {multi ? (
          options.map((option) => {
            const value = str(option.value);
            return (
              <label key={value} className="flex cursor-pointer items-center gap-2 text-sm">
                <Checkbox
                  checked={selected.includes(value)}
                  onCheckedChange={(checked) =>
                    props.setValue?.(
                      checked ? [...selected, value] : selected.filter((v) => v !== value),
                    )
                  }
                />
                {str(option.label) || value}
              </label>
            );
          })
        ) : options.length <= 4 &&
          options.every((option) => (str(option.label) || str(option.value)).length <= 16) ? (
          // A few short exclusive options read best as the host's segmented control.
          <ToggleGroup
            aria-label={str(props.label) || undefined}
            className="w-full *:flex-1"
            value={selected.slice(0, 1)}
            onValueChange={(next) => {
              if (next[0] !== undefined) props.setValue?.([String(next[0])]);
            }}
          >
            {options.map((option) => {
              const value = str(option.value);
              return (
                <Toggle key={value} value={value}>
                  {str(option.label) || value}
                </Toggle>
              );
            })}
          </ToggleGroup>
        ) : (
          <RadioGroup
            value={selected[0] ?? ""}
            onValueChange={(value) => props.setValue?.([String(value)])}
          >
            {options.map((option) => {
              const value = str(option.value);
              return (
                <label key={value} className="flex cursor-pointer items-center gap-2 text-sm">
                  <Radio value={value} />
                  {str(option.label) || value}
                </label>
              );
            })}
          </RadioGroup>
        )}
      </div>
    );
  }),
  component("Slider", (props) => (
    <label className="flex flex-col gap-1 text-sm">
      <span className="flex justify-between">
        {str(props.label)}
        <span className="text-muted-foreground tabular-nums">{String(props.value ?? "")}</span>
      </span>
      <input
        type="range"
        className="accent-primary"
        min={typeof props.min === "number" ? props.min : 0}
        max={typeof props.max === "number" ? props.max : 100}
        value={typeof props.value === "number" ? props.value : 0}
        onChange={(event) => props.setValue?.(Number(event.target.value))}
      />
    </label>
  )),
];

/** Same id, components and functions as the basic catalog, so Express output validates as-is. */
export const t3BasicCatalog = new Catalog<ReactCatalogComponent>(
  "https://a2ui.org/specification/v1_0/catalogs/basic/catalog.json",
  "1.0",
  components,
  BASIC_FUNCTIONS,
  BasicCatalogThemeSchema,
);
