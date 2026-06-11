import type { Canvas, CanvasNode } from "../types/canvas";

const EDITOR_FOCUS_SELECTOR = [
    ".cm-focused",
    "textarea:focus",
    "[contenteditable='true']:focus",
].join(", ");

export function isCanvasNodeEditing(node?: CanvasNode | null): boolean {
    if (!node) {
        return false;
    }

    if (node.isEditing === true) {
        return true;
    }

    const nodeEl = node.nodeEl;
    if (!nodeEl) {
        return false;
    }

    if (nodeEl.classList?.contains("is-editing")) {
        return true;
    }

    return Boolean(nodeEl.querySelector?.(EDITOR_FOCUS_SELECTOR));
}

export function getCanvasEditingNodes(canvas?: Canvas | null): CanvasNode[] {
    if (!canvas) {
        return [];
    }

    const nodes = canvas.nodes instanceof Map
        ? Array.from(canvas.nodes.values())
        : Array.from(canvas.selection || []);

    return nodes.filter((node) => isCanvasNodeEditing(node));
}

export function hasCanvasEditingNode(canvas?: Canvas | null): boolean {
    return getCanvasEditingNodes(canvas).length > 0;
}
