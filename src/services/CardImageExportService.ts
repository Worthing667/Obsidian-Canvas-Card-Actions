import { toBlob } from "html-to-image";
import type { TFile } from "obsidian";
import type { Canvas, CanvasEdge, CanvasNode } from "../types/canvas";
import { isCanvasNodeEditing } from "../utils/canvasEditingState";

export interface CardImageExportBounds {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
}

export interface CardImageExportLimits {
    maxDimension: number;
    maxPixels: number;
}

export interface CardImageExportTarget {
    nodes: CanvasNode[];
    edges: CanvasEdge[];
    bounds: CardImageExportBounds;
}

export interface CardImageRenderOptions {
    pixelRatio: number;
}

export interface ICardImageRenderer {
    render(
        canvas: CardImageExportCanvas,
        target: CardImageExportTarget,
        options: CardImageRenderOptions,
    ): Promise<ArrayBuffer>;
}

export interface ICardImageWriter {
    createCardImage(data: ArrayBuffer, canvasFile: TFile, nodeCount: number): Promise<TFile>;
}

export interface CardImageExportResult {
    file: TFile;
    nodeCount: number;
    pixelRatio: number;
}

export type CardImageExportErrorCode =
    | "no-text-cards"
    | "editing-card"
    | "missing-canvas-file"
    | "unsupported-canvas-runtime"
    | "unmounted-card";

export class CardImageExportError extends Error {
    constructor(public readonly code: CardImageExportErrorCode) {
        super(code);
        this.name = "CardImageExportError";
    }
}

export interface CardImageExportCanvas extends Canvas {
    canvasEl: HTMLElement;
    wrapperEl: HTMLElement;
    nodes: Map<string, CanvasNode>;
}

type HtmlToImageOptions = NonNullable<Parameters<typeof toBlob>[1]>;

type RenderToBlob = (
    node: HTMLElement,
    options: HtmlToImageOptions,
) => Promise<Blob | null>;

const EXPORT_CLASS = "canvas-loom-image-exporting";
const UNSUPPORTED_MEDIA_TAGS = new Set([
    "AUDIO",
    "EMBED",
    "IFRAME",
    "IMAGE",
    "IMG",
    "OBJECT",
    "SOURCE",
    "VIDEO",
]);
const NON_CONTENT_CLASSES = [
    "canvas-menu",
    "canvas-node-connection-point",
    "canvas-node-resizer",
    "canvas-selection",
];
const DEFAULT_PADDING = 24;
const DEFAULT_PIXEL_RATIO = 2;
const DEFAULT_EXPORT_LIMITS: CardImageExportLimits = {
    maxDimension: 12_000,
    maxPixels: 64_000_000,
};

export function selectExportableTextNodes(nodes: Iterable<CanvasNode>): CanvasNode[] {
    const selectedNodes: CanvasNode[] = [];
    const selectedIds = new Set<string>();

    for (const node of nodes) {
        if (selectedIds.has(node.id) || node.getData().type !== "text") {
            continue;
        }

        selectedIds.add(node.id);
        selectedNodes.push(node);
    }

    return selectedNodes;
}

export function selectInternalCanvasEdges(
    edges: Iterable<CanvasEdge>,
    selectedNodeIds: ReadonlySet<string>,
): CanvasEdge[] {
    return Array.from(edges).filter((edge) => {
        const data = edge.getData();
        return selectedNodeIds.has(data.fromNode) && selectedNodeIds.has(data.toNode);
    });
}

export function calculateCardImageExportBounds(
    nodes: readonly CanvasNode[],
    padding: number,
): CardImageExportBounds {
    if (nodes.length === 0) {
        throw new Error("Cannot calculate export bounds without nodes.");
    }

    const data = nodes.map((node) => node.getData());
    const minX = Math.min(...data.map((node) => node.x)) - padding;
    const minY = Math.min(...data.map((node) => node.y)) - padding;
    const maxX = Math.max(...data.map((node) => node.x + node.width)) + padding;
    const maxY = Math.max(...data.map((node) => node.y + node.height)) + padding;

    return {
        minX,
        minY,
        maxX,
        maxY,
        width: maxX - minX,
        height: maxY - minY,
    };
}

export function calculateCardImagePixelRatio(
    bounds: Pick<CardImageExportBounds, "width" | "height">,
    requestedRatio: number,
    limits: CardImageExportLimits,
): number {
    const dimensionRatio = limits.maxDimension / Math.max(bounds.width, bounds.height);
    const pixelRatio = Math.sqrt(limits.maxPixels / (bounds.width * bounds.height));

    return Math.min(requestedRatio, dimensionRatio, pixelRatio);
}

function getEdgeElements(edge: CanvasEdge): Element[] {
    return [
        edge.lineGroupEl,
        edge.lineEndGroupEl,
        edge.labelElement?.wrapperEl,
    ].filter((element): element is Element => !!element);
}

function replaceSelection(canvas: CardImageExportCanvas, nodes: Iterable<CanvasNode>): void {
    const applySelection = () => {
        canvas.selection = new Set(nodes);
    };

    if (canvas.updateSelection) {
        canvas.updateSelection(applySelection);
        return;
    }

    applySelection();
}

function isTargetReady(canvas: CardImageExportCanvas, target: CardImageExportTarget): boolean {
    return target.nodes.every((node) => {
        if (!node.nodeEl || node.initialized === false || node.isContentMounted === false) {
            return false;
        }

        return typeof canvas.canvasEl.contains !== "function"
            || canvas.canvasEl.contains(node.nodeEl);
    });
}

async function waitForCanvasTarget(
    canvas: CardImageExportCanvas,
    target: CardImageExportTarget,
): Promise<void> {
    const view = canvas.canvasEl.ownerDocument?.defaultView;
    if (!view?.requestAnimationFrame) {
        return;
    }

    for (let frame = 0; frame < 12; frame += 1) {
        await new Promise<void>((resolve) => {
            view.requestAnimationFrame(() => resolve());
        });

        if (frame >= 1 && isTargetReady(canvas, target)) {
            return;
        }

        canvas.virtualize?.();
        canvas.requestFrame?.();
    }

    throw new CardImageExportError("unmounted-card");
}

function getCanvasBackground(canvas: CardImageExportCanvas): string | undefined {
    const view = canvas.canvasEl.ownerDocument?.defaultView;
    if (!view) {
        return undefined;
    }

    const styles = view.getComputedStyle(canvas.wrapperEl);
    const canvasBackground = styles.getPropertyValue("--canvas-background").trim();
    return canvasBackground || styles.backgroundColor || undefined;
}

function createExportFilter(
    canvas: CardImageExportCanvas,
    target: CardImageExportTarget,
): (node: HTMLElement) => boolean {
    const targetNodeElements = new Set(
        target.nodes
            .map((node) => node.nodeEl)
            .filter((element): element is HTMLElement => !!element),
    );
    const allNodeElements = new Set(
        Array.from(canvas.nodes?.values() ?? [])
            .map((node) => node.nodeEl)
            .filter((element): element is HTMLElement => !!element),
    );
    const targetEdgeElements = new Set(target.edges.flatMap(getEdgeElements));
    const allEdgeElements = new Set(
        Array.from(canvas.edges?.values() ?? []).flatMap(getEdgeElements),
    );

    return (node) => {
        if (UNSUPPORTED_MEDIA_TAGS.has(node.tagName)) {
            return false;
        }

        if (NON_CONTENT_CLASSES.some((className) => node.classList.contains(className))) {
            return false;
        }

        if (allNodeElements.has(node)) {
            return targetNodeElements.has(node);
        }

        if (allEdgeElements.has(node)) {
            return targetEdgeElements.has(node);
        }

        return true;
    };
}

export class HtmlToImageCardRenderer implements ICardImageRenderer {
    constructor(private renderToBlob: RenderToBlob = toBlob) {}

    async render(
        canvas: CardImageExportCanvas,
        target: CardImageExportTarget,
        options: CardImageRenderOptions,
    ): Promise<ArrayBuffer> {
        const originalSelection = new Set(canvas.selection ?? []);
        const originalScreenshotting = canvas.screenshotting;
        const hadExportClass = canvas.wrapperEl.classList.contains(EXPORT_CLASS);

        try {
            replaceSelection(canvas, []);
            canvas.screenshotting = true;
            canvas.wrapperEl.classList.add(EXPORT_CLASS);
            canvas.virtualize?.();
            canvas.requestFrame?.();
            await waitForCanvasTarget(canvas, target);

            const blob = await this.renderToBlob(canvas.canvasEl, {
                width: target.bounds.width,
                height: target.bounds.height,
                pixelRatio: options.pixelRatio,
                backgroundColor: getCanvasBackground(canvas),
                filter: createExportFilter(canvas, target),
                skipFonts: true,
                cacheBust: false,
                skipAutoScale: false,
                style: {
                    transform: `translate(${-target.bounds.minX}px, ${-target.bounds.minY}px)`,
                    transformOrigin: "top left",
                },
            });

            if (!blob) {
                throw new Error("Image renderer returned no data.");
            }

            return blob.arrayBuffer();
        } finally {
            canvas.screenshotting = originalScreenshotting;
            replaceSelection(canvas, originalSelection);
            if (!hadExportClass) {
                canvas.wrapperEl.classList.remove(EXPORT_CLASS);
            }
            canvas.virtualize?.();
            canvas.requestFrame?.();
        }
    }
}

function isCardImageExportCanvas(canvas: Canvas): canvas is CardImageExportCanvas {
    return !!canvas.canvasEl
        && !!canvas.wrapperEl
        && !!canvas.nodes
        && typeof canvas.nodes.values === "function";
}

export class CardImageExportService {
    constructor(
        private canvas: Canvas,
        private renderer: ICardImageRenderer,
        private writer: ICardImageWriter,
    ) {}

    async exportSelection(
        selection: Iterable<CanvasNode>,
        canvasFile: TFile | null,
    ): Promise<CardImageExportResult> {
        const nodes = selectExportableTextNodes(selection);
        if (nodes.length === 0) {
            throw new CardImageExportError("no-text-cards");
        }
        if (nodes.some((node) => isCanvasNodeEditing(node))) {
            throw new CardImageExportError("editing-card");
        }
        if (!canvasFile || canvasFile.extension !== "canvas") {
            throw new CardImageExportError("missing-canvas-file");
        }
        if (!isCardImageExportCanvas(this.canvas)) {
            throw new CardImageExportError("unsupported-canvas-runtime");
        }
        if (nodes.some((node) => !node.nodeEl)) {
            throw new CardImageExportError("unmounted-card");
        }

        const selectedNodeIds = new Set(nodes.map((node) => node.id));
        const edges = selectInternalCanvasEdges(
            this.canvas.edges?.values() ?? [],
            selectedNodeIds,
        );
        const bounds = calculateCardImageExportBounds(nodes, DEFAULT_PADDING);
        const pixelRatio = calculateCardImagePixelRatio(
            bounds,
            DEFAULT_PIXEL_RATIO,
            DEFAULT_EXPORT_LIMITS,
        );
        const imageData = await this.renderer.render(
            this.canvas,
            { nodes, edges, bounds },
            { pixelRatio },
        );
        const file = await this.writer.createCardImage(imageData, canvasFile, nodes.length);

        return {
            file,
            nodeCount: nodes.length,
            pixelRatio,
        };
    }
}
