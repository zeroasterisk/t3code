import { describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import "~/index.css";
import { render } from "../../../test/render";
import A2uiBlock from "./A2uiBlock";

const FORM = `
pick = ChoicePicker(options=[{label: "Retry", value: "retry"}, {label: "Revert", value: "revert"}], value=$/choice, variant="mutuallyExclusive")
go = Button(Text("Apply"), variant="primary", action=Event("apply", {choice: $/choice}))
root = Column([pick, go])
$/choice = ["retry"]
`;

describe("A2uiBlock", () => {
  it("sends the user's choice back as a visible message", async () => {
    const onSendMessage = vi.fn(async (_text: string) => {});
    await using screen = await render(<A2uiBlock source={FORM} onSendMessage={onSendMessage} />);

    await userEvent.click(screen.getByText("Revert"));
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));

    await vi.waitFor(() => expect(onSendMessage).toHaveBeenCalledOnce());
    const text = onSendMessage.mock.calls[0]![0];
    expect(text.split("\n")[0]).toBe("Apply");
    expect(text).toContain('"context":{"choice":["revert"]}');
    await expect.element(screen.getByText("Sent to the agent")).toBeVisible();
  });

  it("draws a few short exclusive choices as a segmented control", async () => {
    await using screen = await render(
      <A2uiBlock source={FORM} onSendMessage={vi.fn(async (_text: string) => {})} />,
    );

    const group = document.querySelector('[data-a2ui-surface] [data-slot="toggle-group"]');
    expect(group).not.toBeNull();
    expect(group?.querySelectorAll('[data-slot="toggle"]')).toHaveLength(2);
    expect(document.querySelector('[data-a2ui-surface] [role="radio"]')).toBeNull();
    await userEvent.click(screen.getByText("Revert"));
    await vi.waitFor(() =>
      expect(screen.getByText("Revert").element().closest("[data-pressed]")).not.toBeNull(),
    );
    // Pressing the selected option again keeps it selected, as a radio group would.
    await userEvent.click(screen.getByText("Revert"));
    expect(screen.getByText("Revert").element().closest("[data-pressed]")).not.toBeNull();
  });

  it("keeps the submitted values visible and locks every control after sending", async () => {
    const onSendMessage = vi.fn(async (_text: string) => {});
    const source = `
note = TextField("Note", value=$/note)
notify = CheckBox("Notify", value=$/notify)
go = Button(Text("Apply"), variant="primary", action=Event("apply", {note: $/note, notify: $/notify}))
root = Column([note, notify, go])
$/note = ""
$/notify = false
`;
    await using screen = await render(<A2uiBlock source={source} onSendMessage={onSendMessage} />);

    await userEvent.fill(screen.getByRole("textbox"), "ship it");
    await userEvent.click(screen.getByText("Notify"));
    await userEvent.click(screen.getByRole("button", { name: "Apply" }));

    await expect.element(screen.getByText("Sent to the agent")).toBeVisible();
    expect(onSendMessage.mock.calls[0]![0]).toContain('"note":"ship it"');
    const input = document.querySelector("[data-a2ui-surface] input") as HTMLInputElement;
    expect(input.value).toBe("ship it");
    const locked = document.querySelector("[data-a2ui-locked]") as HTMLElement;
    expect(locked.inert).toBe(true);
    // The lock must be visible too: opacity on a `display: contents` box paints nothing.
    expect(locked.getBoundingClientRect().height).toBeGreaterThan(0);
    expect(Number(getComputedStyle(locked).opacity)).toBeLessThan(1);
    expect(locked.querySelector('[role="checkbox"]')?.getAttribute("aria-checked")).toBe("true");
  });

  it("blocks components outside the catalog without rendering them", async () => {
    await using screen = await render(
      <A2uiBlock source={'root = Iframe(url="https://evil.example")'} onSendMessage={undefined} />,
    );

    await expect.element(screen.getByText("Interactive reply blocked")).toBeVisible();
    expect(document.querySelector("iframe")).toBeNull();
  });
});
