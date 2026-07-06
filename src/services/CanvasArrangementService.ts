import type { Canvas, CanvasNode, CanvasNodeData } from "../types/canvas";
import { t } from "../i18n";
import { hasCanvasEditingNode, isCanvasNodeEditing } from "../utils/canvasEditingState";
import { collectTextNodeIds, isTextNodeData } from "../utils/canvasNodeUtils";

export type ArrangeDirection = "horizontal" | "vertical";
export type ArrangeAxisAnchor = "start" | "end";

export interface ArrangeSelectedTextCardsOptions {
    direction: ArrangeDirection;
    spacing: number;
    anchor?: ArrangeAxisAnchor;
}

interface ArrangeSelectedTextCardsResult {
    count: number;
}

interface ArrangeSpacingPreference {
    direction: ArrangeDirection;
    horizontalSpacing: number;
    verticalSpacing: number;
    horizontalAnchor: ArrangeAxisAnchor;
    verticalAnchor: ArrangeAxisAnchor;
}

interface ArrangeSelectedTextCardSpacingOptions {
    horizontalSpacing?: number;
    verticalSpacing?: number;
    horizontalAnchor?: ArrangeAxisAnchor;
    verticalAnchor?: ArrangeAxisAnchor;
}

export const DEFAULT_ARRANGE_SPACING = 0;

export class ArrangeSessionPreferenceStore {
    private preference: ArrangeSpacingPreference | null = null;

    constructor(
        private readonly defaultSpacing: number = DEFAULT_ARRANGE_SPACING
    ) {}

    get(): ArrangeSpacingPreference {
        if (this.preference) {
            return { ...this.preference };
        }

        return {
            direction: "horizontal",
            horizontalSpacing: this.defaultSpacing,
            verticalSpacing: this.defaultSpacing,
            horizontalAnchor: "start",
            verticalAnchor: "start",
        };
    }

    remember(preference: ArrangeSpacingPreference): void {
        this.preference = { ...preference };
    }
}

interface ArrangementCard {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
}

export function shouldShowArrangementToolbarButton(selection?: Set<CanvasNode> | null): boolean {
    if (!selection || selection.size < 2) {
        return false;
    }

    if (Array.from(selection).some((node) => isCanvasNodeEditing(node))) {
        return false;
    }

    let textCardCount = 0;
    selection.forEach((node) => {
        if (isTextNodeData(node?.getData?.())) {
            textCardCount += 1;
        }
    });

    return textCardCount >= 2;
}

export async function arrangeSelectedTextCards(
    canvas: Canvas,
    options: ArrangeSelectedTextCardsOptions
): Promise<ArrangeSelectedTextCardsResult> {
    const { canvasData, cardInfos } = getArrangementContext(canvas);

    const sortedInfos = sortCardsByDirection(cardInfos, options.direction);
    const newPositions = calculateArrangementPositions(
        sortedInfos,
        options.direction,
        options.spacing,
        options.anchor ?? "start"
    );

    await applyArrangementPositions(canvas, canvasData, newPositions);

    return { count: sortedInfos.length };
}

export async function arrangeSelectedTextCardSpacing(
    canvas: Canvas,
    options: ArrangeSelectedTextCardSpacingOptions
): Promise<ArrangeSelectedTextCardsResult> {
    if (options.horizontalSpacing !== undefined) {
        validateSpacing(options.horizontalSpacing, t("toolbar.arrange.horizontalSpacing"));
    }
    if (options.verticalSpacing !== undefined) {
        validateSpacing(options.verticalSpacing, t("toolbar.arrange.verticalSpacing"));
    }

    const { canvasData, cardInfos } = getArrangementContext(canvas);
    const shouldArrangeHorizontal = options.horizontalSpacing !== undefined;
    const shouldArrangeVertical = options.verticalSpacing !== undefined;

    if (!shouldArrangeHorizontal && !shouldArrangeVertical) {
        return { count: cardInfos.length };
    }

    const newPositions = new Map<string, { x: number; y: number }>();

    cardInfos.forEach((card) => {
        newPositions.set(card.id, { x: card.x, y: card.y });
    });

    if (shouldArrangeHorizontal) {
        const horizontalPositions = calculateArrangementPositions(
            sortCardsByDirection(cardInfos, "horizontal"),
            "horizontal",
            options.horizontalSpacing!,
            options.horizontalAnchor ?? "start"
        );
        horizontalPositions.forEach((position, id) => {
            const current = newPositions.get(id);
            if (current) {
                current.x = position.x;
            }
        });
    }

    if (shouldArrangeVertical) {
        const verticalPositions = calculateArrangementPositions(
            sortCardsByDirection(cardInfos, "vertical"),
            "vertical",
            options.verticalSpacing!,
            options.verticalAnchor ?? "start"
        );
        verticalPositions.forEach((position, id) => {
            const current = newPositions.get(id);
            if (current) {
                current.y = position.y;
            }
        });
    }

    await applyArrangementPositions(canvas, canvasData, newPositions);

    return { count: cardInfos.length };
}

function validateSpacing(spacing: number, label: string): void {
    if (!Number.isFinite(spacing) || !Number.isInteger(spacing) || spacing < 0 || spacing > 500) {
        throw new Error(t("errors.spacingOutOfRange", { label }));
    }
}

function getArrangementContext(canvas: Canvas): { canvasData: ReturnType<Canvas["getData"]>; cardInfos: ArrangementCard[] } {
    if (hasCanvasEditingNode(canvas)) {
        throw new Error(t("errors.canvasEditingConflict"));
    }

    const selectedNodeIds = getSelectedTextNodeIds(canvas);
    if (selectedNodeIds.size < 2) {
        throw new Error(t("errors.arrangementNeedTwoTextCards"));
    }

    const canvasData = canvas.getData();
    const cardInfos = getArrangementCards(canvasData.nodes, selectedNodeIds);
    if (cardInfos.length < 2) {
        throw new Error(t("errors.arrangementInsufficientCards"));
    }

    for (const card of cardInfos) {
        if (card.width <= 0 || card.height <= 0) {
            throw new Error(t("errors.invalidCardSize", {
                width: card.width,
                height: card.height
            }));
        }
    }

    return { canvasData, cardInfos };
}

async function applyArrangementPositions(
    canvas: Canvas,
    canvasData: ReturnType<Canvas["getData"]>,
    newPositions: Map<string, { x: number; y: number }>
): Promise<void> {
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
}

function getSelectedTextNodeIds(canvas: Canvas): Set<string> {
    const ids = collectTextNodeIds(canvas.selection ?? []);

    const selectionData = canvas.getSelectionData?.();
    if (selectionData?.nodes) {
        selectionData.nodes.forEach((nodeData) => {
            if (isTextNodeData(nodeData)) {
                ids.add(nodeData.id);
            }
        });
    }

    return ids;
}

function getArrangementCards(nodes: CanvasNodeData[], selectedNodeIds: Set<string>): ArrangementCard[] {
    return nodes
        .filter((node) => selectedNodeIds.has(node.id) && isTextNodeData(node))
        .map((node) => ({
            id: node.id,
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
    spacing: number,
    anchor: ArrangeAxisAnchor = "start"
): Map<string, { x: number; y: number }> {
    const arrangedCards = anchor === "start" ? cards : [...cards].reverse();
    const anchorCard = arrangedCards[0];
    const newPositions = new Map<string, { x: number; y: number }>();
    newPositions.set(anchorCard.id, { x: anchorCard.x, y: anchorCard.y });

    let previous = anchorCard;
    for (let index = 1; index < arrangedCards.length; index += 1) {
        const current = arrangedCards[index];
        const position = getNextArrangementPosition(previous, current, direction, spacing, anchor);

        newPositions.set(current.id, position);
        previous = { ...current, ...position };
    }

    return newPositions;
}

function getNextArrangementPosition(
    previous: ArrangementCard,
    current: ArrangementCard,
    direction: ArrangeDirection,
    spacing: number,
    anchor: ArrangeAxisAnchor
): { x: number; y: number } {
    if (direction === "horizontal") {
        return anchor === "start"
            ? { x: previous.x + previous.width + spacing, y: current.y }
            : { x: previous.x - current.width - spacing, y: current.y };
    }

    return anchor === "start"
        ? { x: current.x, y: previous.y + previous.height + spacing }
        : { x: current.x, y: previous.y - current.height - spacing };
}
