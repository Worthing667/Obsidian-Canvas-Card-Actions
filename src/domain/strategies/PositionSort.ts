import { SortStrategy, SortableCard } from "./SortStrategy";

export type SortPriority = 'yx' | 'xy';

export class PositionSortStrategy implements SortStrategy<SortableCard> {
    constructor(
        private readonly priority: SortPriority = 'yx',
        private readonly tolerance: number = 10
    ) {}

    sort(cards: SortableCard[]): SortableCard[] {
        return [...cards].sort((a, b) => {
            if (this.priority === 'yx') {
                // 优先按y坐标排序（从上到下），然后按x坐标排序（从左到右）
                if (Math.abs(a.y - b.y) > this.tolerance) {
                    return a.y - b.y;
                }
                return a.x - b.x;
            } else {
                // 优先按x坐标排序（从左到右），然后按y坐标排序（从上到下）
                if (Math.abs(a.x - b.x) > this.tolerance) {
                    return a.x - b.x;
                }
                return a.y - b.y;
            }
        });
    }
}