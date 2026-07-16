import { toBlob } from "html-to-image";
import type { TFile } from "obsidian";

type HtmlToImageOptions = NonNullable<Parameters<typeof toBlob>[1]>;

type RenderToBlob = (
    node: HTMLElement,
    options: HtmlToImageOptions,
) => Promise<Blob | null>;

export interface IWorkbenchImageRenderer {
    render(previewElement: HTMLElement): Promise<ArrayBuffer>;
}

export interface IWorkbenchImageExportService {
    exportPreview(
        previewElement: HTMLElement,
        canvasFile: TFile,
        nodeCount: number,
    ): Promise<TFile>;
}

export interface IWorkbenchImageWriter {
    createWorkbenchPreviewImage(data: ArrayBuffer, canvasFile: TFile, nodeCount: number): Promise<TFile>;
}

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

function shouldIncludePreviewNode(node: HTMLElement): boolean {
    if (node.nodeType !== 1) {
        return true;
    }

    return !UNSUPPORTED_MEDIA_TAGS.has(node.tagName);
}

function getPreviewBackgroundColor(previewElement: HTMLElement): string | undefined {
    const view = previewElement.ownerDocument?.defaultView;
    if (!view) {
        return undefined;
    }

    return view.getComputedStyle(previewElement).backgroundColor || undefined;
}

function parsePixelValue(value: string | undefined): number {
    const parsed = Number.parseFloat(value || "0");
    return Number.isFinite(parsed) ? parsed : 0;
}

function getFullPreviewSize(previewElement: HTMLElement): { width: number; height: number } {
    const view = previewElement.ownerDocument?.defaultView;
    const style = view?.getComputedStyle(previewElement);
    const horizontalBorder = parsePixelValue(style?.borderLeftWidth)
        + parsePixelValue(style?.borderRightWidth);
    const verticalBorder = parsePixelValue(style?.borderTopWidth)
        + parsePixelValue(style?.borderBottomWidth);

    return {
        width: Math.max(previewElement.clientWidth, previewElement.scrollWidth) + horizontalBorder,
        height: Math.max(previewElement.clientHeight, previewElement.scrollHeight) + verticalBorder,
    };
}

export class HtmlToImageWorkbenchRenderer implements IWorkbenchImageRenderer {
    constructor(private renderToBlob: RenderToBlob = toBlob) {}

    async render(previewElement: HTMLElement): Promise<ArrayBuffer> {
        const { width, height } = getFullPreviewSize(previewElement);
        const blob = await this.renderToBlob(previewElement, {
            backgroundColor: getPreviewBackgroundColor(previewElement),
            filter: shouldIncludePreviewNode,
            width,
            height,
            style: {
                flex: "none",
                maxHeight: "none",
                overflow: "visible",
            },
            pixelRatio: 2,
            skipFonts: true,
            cacheBust: false,
            skipAutoScale: false,
        });

        if (!blob) {
            throw new Error("Image renderer returned no data.");
        }

        return blob.arrayBuffer();
    }
}

export class WorkbenchImageExportService implements IWorkbenchImageExportService {
    constructor(
        private renderer: IWorkbenchImageRenderer,
        private writer: IWorkbenchImageWriter,
    ) {}

    async exportPreview(
        previewElement: HTMLElement,
        canvasFile: TFile,
        nodeCount: number,
    ): Promise<TFile> {
        const imageData = await this.renderer.render(previewElement);
        return this.writer.createWorkbenchPreviewImage(imageData, canvasFile, nodeCount);
    }
}
