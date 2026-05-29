import type { CanvasNode, CanvasNodeData } from "../types/canvas";

export function isTextNodeData(nodeData: Pick<CanvasNodeData, "type"> | null | undefined): nodeData is CanvasNodeData {
    return nodeData?.type === "text";
}

export function hasTextNodeContent(
    nodeData: Pick<CanvasNodeData, "type" | "text"> | null | undefined
): nodeData is CanvasNodeData & { text: string } {
    return isTextNodeData(nodeData) && typeof nodeData.text === "string" && nodeData.text.trim().length > 0;
}

export function resolveCanvasNodeSelection(
    selection: CanvasNode[],
    getSelectedNodes: () => CanvasNode[]
): CanvasNode[] {
    if (Array.isArray(selection) && selection.length > 0) {
        return selection;
    }

    return getSelectedNodes();
}

export function collectTextNodeIds(nodes: Iterable<CanvasNode | null | undefined>): Set<string> {
    const ids = new Set<string>();

    for (const node of nodes) {
        if (node && isTextNodeData(node.getData?.())) {
            ids.add(node.id);
        }
    }

    return ids;
}
