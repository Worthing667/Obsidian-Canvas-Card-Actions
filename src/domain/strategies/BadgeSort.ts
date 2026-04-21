import { PositionSortStrategy, SortPriority } from "./PositionSort";
import { SortStrategy, BadgedCard } from "./SortStrategy";

export class BadgeSortStrategy implements SortStrategy<BadgedCard> {
    constructor(private readonly sortPriority: SortPriority = 'yx') {}

    sort(cards: BadgedCard[]): BadgedCard[] {
        const positionSorter = new PositionSortStrategy(this.sortPriority);
        const positionedCards = positionSorter.sort(cards as any) as BadgedCard[];

        return [...positionedCards].sort((a, b) => {
            const aBadge = (a.badge || "").trim();
            const bBadge = (b.badge || "").trim();

            if (!aBadge && !bBadge) {
                return 0;
            }

            if (!aBadge) {
                return 1;
            }

            if (!bBadge) {
                return -1;
            }

            return aBadge.localeCompare(bBadge, undefined, { numeric: true });
        });
    }
}
