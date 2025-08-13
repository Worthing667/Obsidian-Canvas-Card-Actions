import { CardData } from "../models/Card";
import { BadgeData } from "../models/Badge";

export interface SortStrategy<T> {
    sort(items: T[]): T[];
}

export interface CardWithBadge {
    card: CardData;
    badge: BadgeData;
}

export interface SortableCard {
    text: string;
    x: number;
    y: number;
}

export interface BadgedCard {
    text: string;
    badge: string;
    badgeType: 'number' | 'text' | 'emoji';
}