import { expect, it } from "@effect/vitest";
import {
  EnvironmentId,
  ProviderInstanceId,
  RunId,
  ThreadId,
  type OrchestrationV2ThreadShell,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { McpSchema, McpServer } from "effect/ai";

import * as ThreadManagement from "../../../orchestration-v2/ThreadManagementService.ts";
import * as McpHttpServer from "../../McpHttpServer.ts";
import * as McpInvocationContext from "../../McpInvocationContext.ts";

const threadId = ThreadId.make("a2ui-mcp-thread");
const scope: McpInvocationContext.McpInvocationScope = {
  environmentId: EnvironmentId.make("a2ui-mcp-environment"),
  requestNamespace: "a2ui-mcp-session",
  thread: {
    threadId,
    providerSessionId: "a2ui-mcp-session",
    providerInstanceId: ProviderInstanceId.make("codex"),
  },
  client: undefined,
  issuedAt: 0,
  capabilities: new Set(["orchestration"]),
};
const client = McpSchema.McpServerClient.of({
  clientId: 1,
  protocolVersion: "2025-06-18",
  clientCapabilities: {},
  clientInfo: { name: "a2ui-mcp", version: "1" },
  initializePayload: {
    protocolVersion: "2025-06-18",
    capabilities: {},
    clientInfo: { name: "a2ui-mcp", version: "1" },
  },
  getClient: Effect.die("unused"),
});

const FORM = [
  "<a2ui>",
  'surface("triage")',
  'root = Column([Text("Which?"), Button(Text("Go"), action=Event("go", {}))])',
  "</a2ui>",
].join("\n");
const UPDATE = [
  "Updated.",
  "<a2ui>",
  'surface("triage", update=true)',
  'root = Column([Text("Done")])',
  "</a2ui>",
].join("\n");

type Row = { id: string; role: "user" | "assistant"; text: string };
const message = (row: Row) => ({ ...row, threadId, attachments: [], streaming: false });

/** The thread store mocked with these rows; it honours the `messageRoles` filter like SQL does. */
const layerFor = (rows: ReadonlyArray<Row>, filters: Array<unknown>) =>
  McpHttpServer.layerA2uiToolkit.pipe(
    Layer.provideMerge(McpHttpServer.layerInProcessMcpServer),
    Layer.provide(
      Layer.mock(ThreadManagement.ThreadManagementService)({
        getThreadShell: () =>
          Effect.succeed({
            id: threadId,
            deletedAt: null,
            archivedAt: null,
            activeRunId: RunId.make("a2ui-mcp-run"),
            providerInstanceId: ProviderInstanceId.make("codex"),
          } as OrchestrationV2ThreadShell),
        getThreadRecords: ((_id: ThreadId, _fields: ReadonlyArray<string>, filter?: any) => {
          filters.push(filter);
          const roles: ReadonlyArray<string> | undefined = filter?.messageRoles;
          return Effect.succeed({
            messages: rows
              .filter((row) => roles === undefined || roles.includes(row.role))
              .map(message),
          });
        }) as any,
      }),
    ),
  );

const call = (name: string, args: object) =>
  Effect.gen(function* () {
    const server = yield* McpServer.McpServer;
    return yield* server
      .callTool({ name, arguments: args })
      .pipe(
        Effect.provideService(McpInvocationContext.McpInvocationContext, scope),
        Effect.provideService(McpSchema.McpServerClient, client),
      );
  });

it.effect("advertises both A2UI tools and returns the rules", () => {
  const filters: Array<unknown> = [];
  return Effect.gen(function* () {
    const server = yield* McpServer.McpServer;
    const names = server.tools.map(({ tool }) => tool.name);
    expect(names).toEqual(expect.arrayContaining(["a2ui_rules", "a2ui_check"]));
    const result = yield* call("a2ui_rules", {});
    expect(result.isError).not.toBe(true);
    const rules = (result.structuredContent as { rules: string }).rules;
    expect(rules.length).toBeGreaterThan(4_096);
    expect(rules).toContain("update=true");
  }).pipe(Effect.provide(layerFor([], filters)));
});

it.effect("a user's <a2ui> text claims no surface; an assistant's form can be updated", () => {
  const filters: Array<unknown> = [];
  return Effect.gen(function* () {
    // The user pasted a form: the web draws it as prose, so the agent may still create "triage".
    const create = yield* call("a2ui_check", { reply: `Here.\n${FORM}` });
    expect(create.structuredContent).toEqual({ ok: true });
    // ...and may not update a surface nobody drew.
    const orphan = yield* call("a2ui_check", { reply: UPDATE });
    expect((orphan.structuredContent as { ok: boolean }).ok).toBe(false);
    expect(filters.every((filter) => (filter as any)?.messageRoles?.join() === "assistant")).toBe(
      true,
    );
  }).pipe(Effect.provide(layerFor([{ id: "m1", role: "user", text: FORM }], filters)));
});

it.effect("an assistant's earlier form is updatable and cannot be drawn again", () => {
  const filters: Array<unknown> = [];
  return Effect.gen(function* () {
    expect((yield* call("a2ui_check", { reply: UPDATE })).structuredContent).toEqual({ ok: true });
    const again = (yield* call("a2ui_check", { reply: `Again.\n${FORM}` })).structuredContent as {
      ok: boolean;
      error?: string;
    };
    expect(again.ok).toBe(false);
    expect(again.error).toBeTruthy();
    const plain = (yield* call("a2ui_check", { reply: "No form here." })).structuredContent as {
      ok: boolean;
    };
    expect(plain.ok).toBe(false);
  }).pipe(
    Effect.provide(
      layerFor(
        [
          { id: "m1", role: "user", text: "Triage this." },
          { id: "m2", role: "assistant", text: `Pick.\n${FORM}` },
        ],
        filters,
      ),
    ),
  );
});
