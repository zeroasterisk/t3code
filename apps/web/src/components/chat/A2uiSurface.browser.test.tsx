import { a2uiActionMessage } from "@t3tools/shared/a2uiMessage";
import { describe, expect, it, vi } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";

import "~/index.css";
import { render } from "../../../test/render";
import { A2uiCardScope, MarkdownA2uiBlock } from "./MarkdownA2uiBlock";

// The lazy chunk's cold load would otherwise land inside the first test's time budget.
await import("./A2uiSurface");

const TRIAGE = `surface("triage")
$/note = ""
note = Field("Note", $/note)
apply = Button("Apply fix", Event("apply", {note: $/note}), tone="primary")
skip = Button("Skip", Event("skip"))
root = Panel([note, Stack([apply, skip], direction="horizontal")], title="3 failing tests")`;

const PLAIN = <pre data-testid="plain-fallback">raw source</pre>;

describe("A2uiSurface", () => {
  it("sends the clicked action once, with entered values, through the latest callback", async () => {
    const staleSend = vi.fn(async (_text: string) => {});
    const onSendAppMessage = vi.fn(async (_text: string) => {});
    await using screen = await render(
      <MarkdownA2uiBlock source={TRIAGE} theme="light" onSendMessage={staleSend}>
        {PLAIN}
      </MarkdownA2uiBlock>,
      { router: false }, // Nothing here navigates.
    );
    await expect.element(screen.getByText("3 failing tests")).toBeVisible();
    await screen.rerender(
      <MarkdownA2uiBlock source={TRIAGE} theme="light" onSendMessage={onSendAppMessage}>
        {PLAIN}
      </MarkdownA2uiBlock>,
    );
    await userEvent.fill(screen.getByRole("textbox"), "ship it");
    await userEvent.dblClick(screen.getByRole("button", { name: "Apply fix" }));
    await vi.waitFor(() => expect(onSendAppMessage).toHaveBeenCalledTimes(1));
    expect(staleSend).not.toHaveBeenCalled();
    expect(onSendAppMessage).toHaveBeenCalledWith(
      a2uiActionMessage({
        surfaceId: "triage",
        name: "apply",
        sourceComponentId: "apply",
        context: { note: "ship it" },
      }),
    );
    expect(screen.container.querySelector("[data-testid=plain-fallback]")).toBeNull();
  });

  it("keeps a sent card's values and sent state when its message re-mounts", async () => {
    const onSendAppMessage = vi.fn(async (_text: string) => {});
    const card = () => (
      <A2uiCardScope value="message-1">
        <MarkdownA2uiBlock source={TRIAGE} theme="light" onSendMessage={onSendAppMessage}>
          {PLAIN}
        </MarkdownA2uiBlock>
      </A2uiCardScope>
    );
    await using screen = await render(card(), { router: false }); // Nothing here navigates.
    await userEvent.fill(screen.getByRole("textbox"), "ship it");
    await userEvent.click(screen.getByRole("button", { name: "Apply fix" }));
    await vi.waitFor(() => expect(onSendAppMessage).toHaveBeenCalledTimes(1));
    await screen.rerender(<div />);
    await screen.rerender(card());
    await expect.element(screen.getByTestId("a2ui-surface")).toHaveAttribute("inert");
    expect(screen.container.querySelector("input")?.value).toBe("ship it");
  });

  it.each([
    ["an unknown component", 'root = Image("https://example.com/x.png")'],
    ["a syntax error", "root = Card("],
    ["no root", 'title = Text("orphan")'],
    ["a basic-catalog component", 'root = Card(Text("hi"))'],
    ["an oversized payload", `root = Text("${"x".repeat(20_000)}")`],
  ])("falls back to the plain block for %s", async (_name, source) => {
    const onSendAppMessage = vi.fn(async (_text: string) => {});
    await using screen = await render(
      <MarkdownA2uiBlock source={source} theme="light" onSendMessage={onSendAppMessage}>
        {PLAIN}
      </MarkdownA2uiBlock>,
      { router: false }, // Nothing here navigates.
    );
    await expect.element(screen.getByTestId("plain-fallback")).toBeVisible();
    expect(screen.container.querySelector("[data-testid=a2ui-surface]")).toBeNull();
    expect(onSendAppMessage).not.toHaveBeenCalled();
  });
});
