export interface Position {
    x: number;
    y: number;
}

export interface CardDimensions {
    width: number;
    height: number;
}

export interface Card {
    id: string;
    text: string;
    position: Position;
    dimensions: CardDimensions;
    color?: string;
    badge?: string;
    badgeType?: 'number' | 'text' | 'emoji';
}

export class CardData {
    constructor(
        public readonly id: string,
        public readonly text: string,
        public readonly position: Position,
        public readonly dimensions: CardDimensions,
        public readonly color?: string,
        public readonly badge?: string,
        public readonly badgeType?: 'number' | 'text' | 'emoji'
    ) {}

    static fromCanvasNodeData(nodeData: any): CardData {
        return new CardData(
            nodeData.id,
            nodeData.text || '',
            { x: nodeData.x, y: nodeData.y },
            { width: nodeData.width, height: nodeData.height },
            nodeData.color,
            nodeData.badge,
            nodeData.badgeType
        );
    }
}