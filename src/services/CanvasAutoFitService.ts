import type { Canvas, CanvasNode } from "../types/canvas";
import { t } from "../i18n";
import { isCanvasNodeEditing } from "../utils/canvasEditingState";

export interface FitSelectedTextCardsResult {
    count: number;
}

export function shouldShowAutoHeightToolbarButton(selection?: Set<CanvasNode> | null): boolean {
    if (selection && Array.from(selection).some((node) => isCanvasNodeEditing(node))) {
        return false;
    }

    return getResizableAutoHeightNodes(selection).length > 0;
}

export async function fitSelectedTextCardsToHeight(canvas: Canvas): Promise<FitSelectedTextCardsResult> {
    if (canvas.selection && Array.from(canvas.selection).some((node) => isCanvasNodeEditing(node))) {
        throw new Error(t("errors.autoHeightEditing"));
    }

    const result = fitTextCardsToHeight(getSelectedAutoHeightNodes(canvas.selection));
    await canvas.requestSave();
    return result;
}

export function fitTextCardsToHeight(nodes: CanvasNode[]): FitSelectedTextCardsResult {
    const autoHeightNodes = nodes.filter((node) => isAutoHeightNode(node) && !isCanvasNodeEditing(node));
    if (autoHeightNodes.length === 0) {
        throw new Error(t("errors.autoHeightNoCards"));
    }

    const resizeEvent = createSyntheticResizeDblclickEvent();
    let fittedCount = 0;

    for (const node of autoHeightNodes) {
        if (typeof node.onResizeDblclick !== "function") {
            continue;
        }

        node.onResizeDblclick(resizeEvent, "bottom");
        fittedCount += 1;
    }

    if (fittedCount === 0) {
        throw new Error(t("errors.autoHeightUnsupported"));
    }

    return { count: fittedCount };
}

function getResizableAutoHeightNodes(selection?: Set<CanvasNode> | null): CanvasNode[] {
    return getSelectedAutoHeightNodes(selection).filter((node) => typeof node.onResizeDblclick === "function");
}

function getSelectedAutoHeightNodes(selection?: Set<CanvasNode> | null): CanvasNode[] {
    if (!selection || selection.size === 0) {
        return [];
    }

    return Array.from(selection).filter((node) => isAutoHeightNode(node) && !isCanvasNodeEditing(node));
}

function isAutoHeightNode(node?: CanvasNode | null): boolean {
    const type = node?.getData?.()?.type;
    return type === "text" || type === "file";
}

function createSyntheticResizeDblclickEvent(): MouseEvent {
    if (typeof MouseEvent !== "undefined") {
        return new MouseEvent("dblclick", {
            bubbles: true,
            cancelable: true,
            view: typeof activeWindow !== "undefined" ? activeWindow : null,
        });
    }

    return {
        preventDefault: () => undefined,
    } as MouseEvent;
}
