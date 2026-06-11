import { PositionSortStrategy, SortPriority } from "./PositionSort";
import { SortStrategy, BadgedCard } from "./SortStrategy";

type SequenceNumber = number[];

export class SequenceSortStrategy implements SortStrategy<BadgedCard> {
    constructor(private readonly sortPriority: SortPriority = 'yx') {}

    sort<T extends BadgedCard>(cards: T[]): T[] {
        const positionSorter = new PositionSortStrategy(this.sortPriority);
        const positionedCards = positionSorter.sort(cards);

        return positionedCards
            .map(card => ({
                card,
                sequence: this.getCardSequence(card)
            }))
            .sort((a, b) => {
                if (!a.sequence && !b.sequence) {
                    return 0;
                }

                if (!a.sequence) {
                    return 1;
                }

                if (!b.sequence) {
                    return -1;
                }

                return this.compareSequences(a.sequence, b.sequence);
            })
            .map(({ card }) => card);
    }

    private getCardSequence(card: BadgedCard): SequenceNumber | null {
        return this.extractFirstLineSequence(card.text)
            || this.parseSequence((card.badge || "").trim());
    }

    private extractFirstLineSequence(text: string): SequenceNumber | null {
        const firstLine = (text || "").split(/\r?\n/, 1)[0].trim();
        const headingText = firstLine.replace(/^#{1,6}\s+/, "");
        const punctuated = headingText.match(/^(\d+(?:\.\d+)*)(?:[)）、]|\.(?=\s|$))/);
        if (punctuated) {
            return this.parseSequence(punctuated[1]);
        }

        const hierarchical = headingText.match(/^(\d+(?:\.\d+)+)(?:\s+|$)/);
        return hierarchical ? this.parseSequence(hierarchical[1]) : null;
    }

    private parseSequence(value: string): SequenceNumber | null {
        if (!/^\d+(?:\.\d+)*$/.test(value)) {
            return null;
        }

        return value.split(".").map(part => Number(part));
    }

    private compareSequences(a: SequenceNumber, b: SequenceNumber): number {
        const sharedLength = Math.min(a.length, b.length);
        for (let index = 0; index < sharedLength; index += 1) {
            if (a[index] !== b[index]) {
                return a[index] - b[index];
            }
        }

        return a.length - b.length;
    }
}

export { SequenceSortStrategy as BadgeSortStrategy };
