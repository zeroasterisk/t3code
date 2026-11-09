import { ExpressFormat, RendererState } from "@a2ui/agent";
import {
  type ActionPayload,
  type Catalog,
  type ComponentApi,
  MessageProcessor,
  type SurfaceModel,
} from "@a2ui/web_core";
import type { A2uiSurfaceState } from "@t3tools/shared/a2uiMessage";

const SURFACE_DIRECTIVE = /\bsurface\(\s*"([^"\\]+)"([^)]*)\)/;

/**
 * A block that creates a surface with `sendDataModel=true`, or updates one with `update=true`,
 * belongs to its thread's live canvas instead of standing alone as a one-action card.
 */
export function isCanvasSource(source: string): boolean {
  const args = SURFACE_DIRECTIVE.exec(source)?.[2] ?? "";
  return /\b(?:sendDataModel|update)\s*=\s*true\b/.test(args);
}

export type CanvasBlockResult =
  | { readonly kind: "surfaces"; readonly surfaceIds: ReadonlyArray<string> }
  | { readonly kind: "update"; readonly surfaceIds: ReadonlyArray<string> }
  | { readonly kind: "failed" };

interface CanvasBlock {
  readonly key: string;
  readonly order: string;
  readonly source: string;
}

function operationSurfaceId(message: object): string | undefined {
  for (const value of Object.values(message)) {
    if (value && typeof value === "object" && "surfaceId" in value) {
      return String(value.surfaceId);
    }
  }
  return undefined;
}

/**
 * One thread's canvases, built from its canvas blocks in message order through one renderer
 * state, as the A2UI SDK prescribes for canvas agents. Blocks can register in any order, since
 * the timeline mounts newer rows first; an out-of-order block rebuilds the state from scratch.
 */
export class ThreadCanvas<Component extends ComponentApi> {
  private blocks: Array<CanvasBlock> = [];
  private results = new Map<string, CanvasBlockResult>();
  private live = new Set<string>();
  private state!: RendererState;
  private processor!: MessageProcessor<Component>;
  private readonly dispatchers = new Map<string, (action: ActionPayload) => void>();
  private readonly listeners = new Set<() => void>();
  /** Bumps on every change; `generation` bumps only when surfaces are rebuilt from scratch. */
  version = 0;
  generation = 0;

  constructor(
    private readonly options: {
      readonly apiCatalog: ConstructorParameters<typeof ExpressFormat>[0][number];
      readonly renderCatalog: Catalog<Component>;
      readonly onShared: (state: A2uiSurfaceState) => void;
    },
  ) {
    this.reset();
  }

  register(key: string, order: string, source: string): CanvasBlockResult | undefined {
    if (!this.results.has(key) && !this.blocks.some((block) => block.key === key)) {
      const block = { key, order, source };
      const last = this.blocks.at(-1);
      this.blocks.push(block);
      if (last === undefined || last.order <= order) {
        this.apply(block);
      } else {
        this.blocks.sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0));
        this.rebuild();
      }
      this.version += 1;
      queueMicrotask(() => {
        for (const listener of this.listeners) listener();
      });
    }
    return this.results.get(key);
  }

  surface(surfaceId: string): SurfaceModel<Component> | undefined {
    return this.processor.getSurfaces().get(surfaceId);
  }

  title(surfaceId: string): string {
    const surface = this.surface(surfaceId);
    const title = surface?.componentsModel.get(surface.rootId)?.properties?.title;
    return typeof title === "string" && title ? title : surfaceId;
  }

  dataModel(surfaceId: string): unknown {
    return this.surface(surfaceId)?.dataModel.get("/");
  }

  /** The live canvases' current state, for the composer to send with a typed message. */
  snapshot(): ReadonlyArray<A2uiSurfaceState> {
    return [...this.live].flatMap((surfaceId) =>
      this.surface(surfaceId) ? [{ surfaceId, dataModel: this.dataModel(surfaceId) }] : [],
    );
  }

  route(surfaceId: string, dispatch: (action: ActionPayload) => void): () => void {
    this.dispatchers.set(surfaceId, dispatch);
    return () => {
      if (this.dispatchers.get(surfaceId) === dispatch) this.dispatchers.delete(surfaceId);
    };
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  private reset() {
    this.state = new RendererState([this.options.apiCatalog]);
    this.processor = new MessageProcessor<Component>([this.options.renderCatalog], (action) =>
      this.dispatchers.get(action.surfaceId)?.(action),
    );
    this.results = new Map();
    this.live = new Set();
  }

  private rebuild() {
    this.reset();
    this.generation += 1;
    for (const block of this.blocks) this.apply(block);
  }

  private apply(block: CanvasBlock) {
    this.results.set(block.key, this.compile(block.source));
  }

  private compile(source: string): CanvasBlockResult {
    try {
      const parts = new ExpressFormat([this.options.apiCatalog])
        .createParser()
        .parseResponse(source, { wrapped: false, state: this.state });
      const messages = parts.flatMap((part) => (part.type === "a2ui" ? part.a2ui : []));
      if (this.processor.processMessagesWithErrors(messages).length > 0) return { kind: "failed" };
      const created = messages.flatMap((message) =>
        "createSurface" in message ? [message.createSurface] : [],
      );
      for (const surface of created) {
        if (surface.sendDataModel) this.live.add(surface.surfaceId);
      }
      const touched = [
        ...new Set(messages.flatMap((message) => operationSurfaceId(message) ?? [])),
      ];
      for (const surfaceId of touched) {
        if (this.live.has(surfaceId)) {
          this.options.onShared({ surfaceId, dataModel: this.dataModel(surfaceId) });
        }
      }
      return created.length > 0
        ? { kind: "surfaces", surfaceIds: created.map((surface) => surface.surfaceId) }
        : { kind: "update", surfaceIds: touched };
    } catch {
      return { kind: "failed" };
    }
  }
}
