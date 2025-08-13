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

    toCanvasNodeData(): any {
        return {
            id: this.id,
            text: this.text,
            x: this.position.x,
            y: this.position.y,
            width: this.dimensions.width,
            height: this.dimensions.height,
            color: this.color,
            badge: this.badge,
            badgeType: this.badgeType,
            type: 'text'
        };
    }

    withBadge(badge: string, badgeType: 'number' | 'text' | 'emoji'): CardData {
        return new CardData(
            this.id,
            this.text,
            this.position,
            this.dimensions,
            this.color,
            badge,
            badgeType
        );
    }

    withoutBadge(): CardData {
        return new CardData(
            this.id,
            this.text,
            this.position,
            this.dimensions,
            this.color,
            undefined,
            undefined
        );
    }

    withPosition(position: Position): CardData {
        return new CardData(
            this.id,
            this.text,
            position,
            this.dimensions,
            this.color,
            this.badge,
            this.badgeType
        );
    }

    withText(text: string): CardData {
        return new CardData(
            this.id,
            text,
            this.position,
            this.dimensions,
            this.color,
            this.badge,
            this.badgeType
        );
    }

    hasBadge(): boolean {
        return !!this.badge;
    }

    isEmpty(): boolean {
        return !this.text || this.text.trim().length === 0;
    }
}