import type { CanvasNodeData } from "../../types/canvas";

export interface Position {
    x: number;
    y: number;
}

interface CardDimensions {
    width: number;
    height: number;
}

export class CardData {
    constructor(
        public readonly id: string,
        public readonly text: string,
        public readonly position: Position,
        public readonly dimensions: CardDimensions,
        public readonly color?: string,
        public readonly badge?: string
    ) {}

    static fromCanvasNodeData(nodeData: CanvasNodeData): CardData {
        return new CardData(
            nodeData.id,
            nodeData.text || '',
            { x: nodeData.x, y: nodeData.y },
            { width: nodeData.width, height: nodeData.height },
            nodeData.color,
            nodeData.badge
        );
    }
}
