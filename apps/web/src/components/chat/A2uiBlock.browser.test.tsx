import { parseScopedThreadKey } from "@t3tools/client-runtime/environment";
import { describe, expect, it, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";

import "~/index.css";
import { render } from "../../../test/render";
import { a2uiSurface, useRightPanelStore } from "../../rightPanelStore";
import A2uiBlock from "./A2uiBlock";
import A2uiPanel from "./A2uiPanel";
import A2uiThreadSync from "./A2uiThreadSync";

const FORM = `
pick = ChoicePicker(options=[{label: "Retry", value: "retry"}, {label: "Revert", value: "revert"}], value=$/choice, variant="mutuallyExclusive")
go = Button(Text("Apply"), variant="primary", action=Event("apply", {choice: $/choice}))
root = Column([pick, go])
$/choice = ["retry"]
`;

describe("A2uiBlock", () => {
  it("opens a surface in the right panel and keeps one live copy there", async () => {
    const threadKey = "env-1:thread-panel-test";
    const blocks = [{ key: "m1:0", source: `surface("p")\nroot = Text("panel draft")` }];
    function Harness() {
      const surfaces = useRightPanelStore((state) => state.byThreadKey[threadKey]?.surfaces);
      return (
        <div>
          <A2uiThreadSync threadKey={threadKey} blocks={blocks} onSendMessage={undefined} />
          <A2uiBlock
            source={blocks[0]!.source}
            onSendMessage={undefined}
            thread={{ threadKey, blockKey: "m1:0" }}
          />
          <aside data-testid="panel">
            {(surfaces ?? []).map((surface) =>
              surface.kind === "a2ui" ? (
                <A2uiPanel
                  key={surface.id}
                  threadKey={surface.threadKey}
                  surfaceId={surface.surfaceId}
                />
              ) : null,
            )}
          </aside>
        </div>
      );
    }
    await using screen = await render(<Harness />);
    await expect.element(screen.getByText("panel draft")).toBeVisible();
    await screen.getByRole("button", { name: "Open in panel" }).click();
    await expect.element(screen.getByText("Interactive reply open in panel")).toBeVisible();
    await expect.element(screen.getByTestId("panel").getByText("panel draft")).toBeVisible();
    expect(document.body.textContent?.split("panel draft").length).toBe(2);
  });
  it("keeps a panel edit when the panel closes and sends the same action from the panel", async () => {
    const threadKey = "env-1:thread-panel-action";
    const ref = parseScopedThreadKey(threadKey)!;
    const blocks = [{ key: "m1:0", source: `surface("f")\n${FORM}` }];
    const onSendMessage = vi.fn(async (_text: string) => {});
    function Harness() {
      const surfaces = useRightPanelStore((state) => state.byThreadKey[threadKey]?.surfaces);
      return (
        <div>
          <div data-testid="timeline">
            <A2uiThreadSync threadKey={threadKey} blocks={blocks} onSendMessage={onSendMessage} />
            <A2uiBlock
              source={blocks[0]!.source}
              onSendMessage={onSendMessage}
              thread={{ threadKey, blockKey: "m1:0" }}
            />
          </div>
          <aside data-testid="panel">
            {(surfaces ?? []).map((surface) =>
              surface.kind === "a2ui" ? (
                <A2uiPanel
                  key={surface.id}
                  threadKey={surface.threadKey}
                  surfaceId={surface.surfaceId}
                />
              ) : null,
            )}
          </aside>
        </div>
      );
    }
    await using screen = await render(<Harness />);
    const panel = screen.getByTestId("panel");
    const timeline = screen.getByTestId("timeline");
    await screen.getByRole("button", { name: "Open in panel" }).click();
    await userEvent.click(panel.getByText("Revert"));
    await vi.waitFor(() =>
      expect(panel.getByText("Revert").element().closest("[data-pressed]")).not.toBeNull(),
    );

    // Close the panel: the timeline gets the surface back, with the panel's edit.
    useRightPanelStore.getState().closeSurface(ref, a2uiSurface(threadKey, "f").id);
    await expect.element(timeline.getByText("Revert")).toBeVisible();
    expect(timeline.getByText("Revert").element().closest("[data-pressed]")).not.toBeNull();

    // Open it again and act from the panel: the agent gets the edited value.
    await screen.getByRole("button", { name: "Open in panel" }).click();
    await userEvent.click(panel.getByRole("button", { name: "Apply" }));
    await vi.waitFor(() => expect(onSendMessage).toHaveBeenCalledOnce());
    const text = onSendMessage.mock.calls[0]![0];
    expect(text.split("\n")[0]).toBe("Apply");
    expect(text).toContain('"surfaceId":"f"');
    expect(text).toContain('"context":{"choice":["revert"]}');
    await expect.element(panel.getByText("Sent to the agent")).toBeVisible();
  });
  it("shows one live copy when a later reply updates the surface", async () => {
    const blocks = [
      { key: "m1:0", source: `surface("t")\nroot = Text("first draft")` },
      { key: "m2:0", source: `surface("t", update=true)\nroot = Text("second draft")` },
    ];
    await using screen = await render(
      <div>
        <A2uiThreadSync threadKey="thread-update-test" blocks={blocks} onSendMessage={undefined} />
        {blocks.map((block) => (
          <A2uiBlock
            key={block.key}
            source={block.source}
            onSendMessage={undefined}
            thread={{ threadKey: "thread-update-test", blockKey: block.key }}
          />
        ))}
      </div>,
    );
    await expect.element(screen.getByText("second draft")).toBeVisible();
    await expect.element(screen.getByText("Interactive reply updated below")).toBeVisible();
    expect(document.body.textContent).not.toContain("first draft");
  });
  it("shows the panel's surface when no timeline row is mounted", async () => {
    const threadKey = "env-1:thread-panel-alone";
    const ref = parseScopedThreadKey(threadKey)!;
    const blocks = [{ key: "m1:0", source: `surface("q")\nroot = Text("panel only")` }];
    useRightPanelStore.getState().openA2uiSurface(ref, threadKey, "q");
    // The row that drew it is virtualized away: only the timeline-level sync and the panel mount.
    await using screen = await render(
      <div>
        <A2uiThreadSync threadKey={threadKey} blocks={blocks} onSendMessage={undefined} />
        <A2uiPanel threadKey={threadKey} surfaceId="q" />
      </div>,
    );
    await expect.element(screen.getByText("panel only")).toBeVisible();
    expect(document.querySelector("[data-a2ui-panel-missing]")).toBeNull();
  });
  it("hides Show while the panel shows the surface, and offers it once another tab is active", async () => {
    const threadKey = "env-1:thread-panel-show";
    const ref = parseScopedThreadKey(threadKey)!;
    const blocks = [{ key: "m1:0", source: `surface("s")\nroot = Text("show draft")` }];
    await using screen = await render(
      <div>
        <A2uiThreadSync threadKey={threadKey} blocks={blocks} onSendMessage={undefined} />
        <A2uiBlock
          source={blocks[0]!.source}
          onSendMessage={undefined}
          thread={{ threadKey, blockKey: "m1:0" }}
        />
      </div>,
    );
    await screen.getByRole("button", { name: "Open in panel" }).click();
    await expect.element(screen.getByText("Interactive reply open in panel")).toBeVisible();
    expect(screen.getByRole("button", { name: "Show" }).query()).toBeNull();
    useRightPanelStore.getState().openA2uiSurface(ref, threadKey, "other");
    await expect.element(screen.getByRole("button", { name: "Show" })).toBeVisible();
  });
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

  it("keeps long words and segmented choices inside a narrow column at 1.5x text", async () => {
    await page.viewport(360, 800);
    const style = document.createElement("style");
    style.textContent = "html { font-size: 150%; }";
    document.head.append(style);
    try {
      const source = `
title = Text("Run b7f3c1e9d2a4f6081357924680acebdf1234567890abcdef failed")
pick = ChoicePicker(options=[{label: "Retry", value: "retry"}, {label: "Revert", value: "revert"}, {label: "Quarantine", value: "quarantine"}], value=$/choice, variant="mutuallyExclusive")
root = Column([title, pick])
$/choice = ["retry"]
`;
      await using _screen = await render(<A2uiBlock source={source} onSendMessage={undefined} />);
      const surface = document.querySelector("[data-a2ui-surface]") as HTMLElement;
      for (const node of [surface, ...surface.querySelectorAll<HTMLElement>("*")]) {
        expect(node.scrollWidth, node.textContent ?? "").toBeLessThanOrEqual(node.clientWidth + 1);
      }
      expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(360);
    } finally {
      style.remove();
      await page.viewport(1280, 800);
    }
  });

  it("blocks components outside the catalog without rendering them", async () => {
    await using screen = await render(
      <A2uiBlock source={'root = Iframe(url="https://evil.example")'} onSendMessage={undefined} />,
    );

    await expect.element(screen.getByText("Interactive reply blocked")).toBeVisible();
    expect(document.querySelector("iframe")).toBeNull();
  });
});
