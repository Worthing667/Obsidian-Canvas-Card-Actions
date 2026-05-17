import type { Canvas, CanvasNode } from "../types/canvas";

export interface FitSelectedTextCardsResult {
    count: number;
}

export function shouldShowAutoHeightToolbarButton(selection?: Set<CanvasNode> | null): boolean {
    return getSelectedTextNodes(selection).length > 0;
}

export async function fitSelectedTextCardsToHeight(canvas: Canvas): Promise<FitSelectedTextCardsResult> {
    const textNodes = getSelectedTextNodes(canvas.selection);
    if (textNodes.length === 0) {
        throw new Error("请选择至少一张文本卡片");
    }

    const resizeEvent = createSyntheticResizeDblclickEvent();
    let fittedCount = 0;

    for (const node of textNodes) {
        if (typeof node.onResizeDblclick !== "function") {
            continue;
        }

        node.onResizeDblclick(resizeEvent, "bottom");
        fittedCount += 1;
    }

    if (fittedCount === 0) {
        throw new Error("当前 Obsidian 版本不支持批量自适应高度");
    }

    await canvas.requestSave();
    return { count: fittedCount };
}

function getSelectedTextNodes(selection?: Set<CanvasNode> | null): CanvasNode[] {
    if (!selection || selection.size === 0) {
        return [];
    }

    return Array.from(selection).filter((node) => node?.getData?.()?.type === "text");
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
