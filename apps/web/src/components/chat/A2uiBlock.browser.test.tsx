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

  it("blocks components outside the catalog without rendering them", async () => {
    await using screen = await render(
      <A2uiBlock source={'root = Iframe(url="https://evil.example")'} onSendMessage={undefined} />,
    );

    await expect.element(screen.getByText("Interactive reply blocked")).toBeVisible();
    expect(document.querySelector("iframe")).toBeNull();
  });
});
