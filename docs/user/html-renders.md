# Visual replies

Agents can answer with a page instead of only text: a chart, table, diagram, image collage, or mockup. Ask for one ("show this as a chart", "make a collage of these screenshots") and the agent builds a self-contained HTML page, which appears in the thread above its written reply. It works with every provider, on web, desktop, and mobile.

Pages use your current theme, including custom themes, and follow light and dark mode as you switch. Scripts run inside the page, but it is sandboxed away from T3 Code and your session. Links you click in a page open in your browser. Use the expand button to open a page full screen. On web and desktop, use the zoom controls to see more detail.

Agents can place local images in a page by file path. T3 Code embeds them when the page is published, so the page keeps working after the original files move or are deleted. Deleting the thread deletes its pages.

Before publishing, agents check their work with screenshots from a small headless browser that T3 Code keeps for itself; it never uses a browser you installed. The first preview on a machine downloads it once (about 120 MB) into T3 Code's data folder, so that preview can take a minute. Browser tabs on a remote environment use the same browser, so whichever comes first downloads it. Some Linux hosts need [setup](remote-access.md#browser-host-setup) before it can start. Pages publish without it.

Previews can load public resources such as CDN scripts, but nothing on your local network. The machine running the environment looks up each name, and previews block names that resolve to private or reserved addresses. Clash or Mihomo in fake-IP DNS mode can return these addresses, so external resources can fail there. The preview's console messages can identify affected hostnames. Inline the resource, add its host to `fake-ip-filter`, or switch that machine's proxy DNS to `redir-host`.

## MCP apps

Some MCP servers return an interactive app with their tool results, following the [MCP Apps](https://github.com/modelcontextprotocol/ext-apps) standard. When an agent calls one of those tools, the app appears in the thread in place of the tool call, on web, desktop, and mobile. Codex and Claude support this today, for any MCP server you have configured for them. Claude needs Claude Code 2.1.301 or newer; older versions and other providers show these calls as ordinary tool calls.

Apps follow your theme. An app can call tools on its own server and post a message to the thread; T3 Code asks first unless the server marks the tool as read-only, and it asks before every message. On mobile, an app also asks before opening a link, and T3 Code asks before saving a file an app offers. An app stays viewable after its agent stops, but using it needs the agent of the thread that created it running, so send a message in that thread first if the app says it is unavailable. An app that navigates away from its own page is stopped.

An app can open full screen right after you tap or click in it. On web and desktop, a tap in the app within five seconds of a click or key press elsewhere in T3 Code doesn't count, so tap it again after that. Use the button in its top corner, or press Escape outside the app, to return it to the thread. Anything else that needs your attention, such as an approval, also returns it to the thread. On mobile, full screen opens the app again in its own screen, so anything the app does not save itself starts over. An app can also keep the agent informed of what you did in it, such as a filter you picked; T3 Code sends the latest note from each app with your next message.

## Interactive replies (A2UI)

An agent can answer with an interactive card built from T3 Code's own components: a diff with its file chip and line counts, a highlighted code block, a command, a tool activity list, a table, an alert, and inputs such as chips, checkboxes, switches, and text fields. It writes the card in A2UI Express format, either as an `a2ui` code block or between `<a2ui>` and `</a2ui>` tags, and T3 Code draws it right in the message, so a card from any agent, local or remote, looks like the rest of the app. The full list is Panel, Stack, Text, CodeBlock, Diff, Command, File, DiffStat, Badge, Alert, Keys, Activity, Table, Choice, Switch, Field, and Button.

Agents write better cards when they know the components. Agents running in T3 Code can call the `a2ui_guide` tool to get them. For other agents, or to make it a habit, install the optional [t3code-cards skill](skills/t3code-cards/SKILL.md) the way your agent installs skills.

Clicking a button sends your choice back as a new message in the thread, along with anything you typed or ticked in the card. The message shows the action name and its values in a code block, and the agent reads it like any other message. It queues behind the current turn if the agent is still working.

Cards are drawn in your theme and can't run scripts or load pages. If a card is invalid, uses a component T3 Code doesn't provide, or is very large, you see the plain code block instead. A card also stays a code block while the agent is still writing it, wherever replies can't be sent back, and in the mobile app for now.

Each card belongs to the message that contains it and sends one choice; after that it dims and stops taking input. When the agent sends a card with the same name later, it appears as a new card.
