export interface SortStrategy<T> {
    sort(items: T[]): T[];
}

export interface SortableCard {
    text: string;
    x: number;
    y: number;
}

export interface BadgedCard {
    text: string;
    x: number;
    y: number;
    badge?: string;
}
