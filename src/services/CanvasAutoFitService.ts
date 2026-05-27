import type { Canvas, CanvasNode } from "../types/canvas";

export interface FitSelectedTextCardsResult {
    count: number;
}

export function shouldShowAutoHeightToolbarButton(selection?: Set<CanvasNode> | null): boolean {
    if (hasEditingNode(selection)) {
        return false;
    }

    return getResizableAutoHeightNodes(selection).length > 0;
}

export async function fitSelectedTextCardsToHeight(canvas: Canvas): Promise<FitSelectedTextCardsResult> {
    if (hasEditingNode(canvas.selection)) {
        throw new Error("请先退出卡片编辑状态，再使用自适应高度");
    }

    const autoHeightNodes = getSelectedAutoHeightNodes(canvas.selection);
    if (autoHeightNodes.length === 0) {
        throw new Error("请选择至少一张可自适应高度的卡片");
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
        throw new Error("当前 Obsidian 版本不支持批量自适应高度");
    }

    await canvas.requestSave();
    return { count: fittedCount };
}

function getResizableAutoHeightNodes(selection?: Set<CanvasNode> | null): CanvasNode[] {
    return getSelectedAutoHeightNodes(selection).filter((node) => typeof node.onResizeDblclick === "function");
}

function hasEditingNode(selection?: Set<CanvasNode> | null): boolean {
    if (!selection || selection.size === 0) {
        return false;
    }

    return Array.from(selection).some((node) => isEditingNode(node));
}

function getSelectedAutoHeightNodes(selection?: Set<CanvasNode> | null): CanvasNode[] {
    if (!selection || selection.size === 0) {
        return [];
    }

    return Array.from(selection).filter((node) => isAutoHeightNode(node) && !isEditingNode(node));
}

function isAutoHeightNode(node?: CanvasNode | null): boolean {
    const type = node?.getData?.()?.type;
    return type === "text" || type === "file";
}

function isEditingNode(node: CanvasNode): boolean {
    const nodeEl = node.nodeEl;
    if (!nodeEl) {
        return false;
    }

    if (nodeEl.classList?.contains("is-editing")) {
        return true;
    }

    return Boolean(nodeEl.querySelector?.(
        ".cm-focused, textarea:focus, [contenteditable='true']:focus"
    ));
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
