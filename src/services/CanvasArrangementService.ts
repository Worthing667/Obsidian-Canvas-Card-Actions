import type { Canvas, CanvasNode, CanvasNodeData } from "../types/canvas";

export type ArrangeDirection = "horizontal" | "vertical";

export interface ArrangeSelectedTextCardsOptions {
    direction: ArrangeDirection;
    spacing: number;
}

export interface ArrangeSelectedTextCardsResult {
    count: number;
}

export interface ArrangeSessionPreference extends ArrangeSelectedTextCardsOptions {}

export const DEFAULT_ARRANGE_SPACING = 20;

export class ArrangeSessionPreferenceStore {
    private preference: ArrangeSessionPreference | null = null;

    constructor(
        private readonly defaultSpacing: number = DEFAULT_ARRANGE_SPACING
    ) {}

    get(): ArrangeSessionPreference {
        if (this.preference) {
            return { ...this.preference };
        }

        return {
            direction: "horizontal",
            spacing: this.defaultSpacing,
        };
    }

    remember(preference: ArrangeSessionPreference): void {
        this.preference = { ...preference };
    }
}

interface ArrangementCard {
    id: string;
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

export function shouldShowArrangementToolbarButton(selection?: Set<CanvasNode> | null): boolean {
    if (!selection || selection.size < 2) {
        return false;
    }

    let textCardCount = 0;
    selection.forEach((node) => {
        if (node?.getData?.()?.type === "text") {
            textCardCount += 1;
        }
    });

    return textCardCount >= 2;
}

export async function arrangeSelectedTextCards(
    canvas: Canvas,
    options: ArrangeSelectedTextCardsOptions
): Promise<ArrangeSelectedTextCardsResult> {
    const selectedNodeIds = getSelectedTextNodeIds(canvas);
    if (selectedNodeIds.size < 2) {
        throw new Error("至少需要两张文本卡片才能整理间距");
    }

    const canvasData = canvas.getData();
    const cardInfos = getArrangementCards(canvasData.nodes, selectedNodeIds);
    if (cardInfos.length < 2) {
        throw new Error("在画布数据中未找到足够的卡片信息");
    }

    for (const card of cardInfos) {
        if (card.width <= 0 || card.height <= 0) {
            throw new Error(`卡片尺寸无效（宽:${card.width}, 高:${card.height}），无法整理间距`);
        }
    }

    const sortedInfos = sortCardsByDirection(cardInfos, options.direction);
    const newPositions = calculateArrangementPositions(sortedInfos, options.direction, options.spacing);

    canvasData.nodes.forEach((nodeData) => {
        const position = newPositions.get(nodeData.id);
        if (!position) {
            return;
        }

        nodeData.x = position.x;
        nodeData.y = position.y;
    });

    await canvas.setData(canvasData);
    await canvas.requestSave();

    return { count: sortedInfos.length };
}

function getSelectedTextNodeIds(canvas: Canvas): Set<string> {
    const ids = new Set<string>();
    const selection = canvas.selection;

    if (selection) {
        selection.forEach((node) => {
            if (node?.getData?.()?.type === "text") {
                ids.add(node.id);
            }
        });
    }

    const selectionData = canvas.getSelectionData?.();
    if (selectionData?.nodes) {
        selectionData.nodes.forEach((nodeData) => {
            if (nodeData.type === "text") {
                ids.add(nodeData.id);
            }
        });
    }

    return ids;
}

function getArrangementCards(nodes: CanvasNodeData[], selectedNodeIds: Set<string>): ArrangementCard[] {
    return nodes
        .filter((node) => selectedNodeIds.has(node.id) && node.type === "text")
        .map((node) => ({
            id: node.id,
            text: node.text || "",
            x: node.x,
            y: node.y,
            width: node.width,
            height: node.height,
        }));
}

function sortCardsByDirection(cards: ArrangementCard[], direction: ArrangeDirection): ArrangementCard[] {
    return [...cards].sort((a, b) => {
        if (direction === "horizontal") {
            return a.x - b.x || a.y - b.y;
        }

        return a.y - b.y || a.x - b.x;
    });
}

function calculateArrangementPositions(
    cards: ArrangementCard[],
    direction: ArrangeDirection,
    spacing: number
): Map<string, { x: number; y: number }> {
    const anchor = cards[0];
    const newPositions = new Map<string, { x: number; y: number }>();
    newPositions.set(anchor.id, { x: anchor.x, y: anchor.y });

    let previous = anchor;
    for (let index = 1; index < cards.length; index += 1) {
        const current = cards[index];
        const position = direction === "horizontal"
            ? { x: previous.x + previous.width + spacing, y: current.y }
            : { x: current.x, y: previous.y + previous.height + spacing };

        newPositions.set(current.id, position);
        previous = { ...current, ...position };
    }

    return newPositions;
}
