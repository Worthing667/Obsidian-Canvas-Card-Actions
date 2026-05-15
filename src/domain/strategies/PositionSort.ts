import { SortStrategy, SortableCard } from "./SortStrategy";

export type SortPriority = 'yx' | 'xy';

export class PositionSortStrategy implements SortStrategy<SortableCard> {
    constructor(
        private readonly priority: SortPriority = 'yx',
        private readonly tolerance: number = 10
    ) {}

    sort<T extends SortableCard>(cards: T[]): T[] {
        return [...cards].sort((a, b) => {
            if (this.priority === 'yx') {
                // 倒N排序：同一列从上到下，再移动到右侧列。
                if (Math.abs(a.x - b.x) > this.tolerance) {
                    return a.x - b.x;
                }
                return a.y - b.y;
            } else {
                // Z字排序：同一行从左到右，再移动到下方行。
                if (Math.abs(a.y - b.y) > this.tolerance) {
                    return a.y - b.y;
                }
                return a.x - b.x;
            }
        });
    }
}
