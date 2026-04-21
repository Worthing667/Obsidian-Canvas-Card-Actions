import { BadgeSortStrategy, PositionSortStrategy, SortPriority } from "../domain/strategies";
import type { MergeOrder } from "./ContentService";
import type { CardSnapshot, WorkbenchState } from "../types/WorkbenchState";

export interface CreateWorkbenchStateOptions {
    canvasFilePath: string | null;
    canvasFileBasename: string;
    selectionSnapshot: CardSnapshot[];
    defaultSortMode: MergeOrder;
    previewExpanded?: boolean;
}

export class PreviewWorkbenchService {
    readonly previewCollapseThreshold = 30;

    createState(options: CreateWorkbenchStateOptions): WorkbenchState {
        return {
            canvasFilePath: options.canvasFilePath,
            canvasFileBasename: options.canvasFileBasename,
            selectionSnapshot: [...options.selectionSnapshot],
            sortMode: options.defaultSortMode,
            manualOrderIds: [],
            previewExpanded: options.previewExpanded ?? false,
            lastComputedContent: '',
        };
    }

    setSortMode(state: WorkbenchState, sortMode: MergeOrder, sortPriority: SortPriority): WorkbenchState {
        if (state.sortMode === sortMode) {
            return state;
        }

        if (sortMode === 'manual') {
            const currentCards = this.getOrderedCards(state, sortPriority);
            return {
                ...state,
                sortMode,
                manualOrderIds: currentCards.map(card => card.id),
            };
        }

        return {
            ...state,
            sortMode,
        };
    }

    setPreviewExpanded(state: WorkbenchState, previewExpanded: boolean): WorkbenchState {
        return {
            ...state,
            previewExpanded,
        };
    }

    setLastComputedContent(state: WorkbenchState, lastComputedContent: string): WorkbenchState {
        return {
            ...state,
            lastComputedContent,
        };
    }

    reorderManual(state: WorkbenchState, fromIndex: number, toIndex: number, sortPriority: SortPriority): WorkbenchState {
        const cards = this.getOrderedCards(state, sortPriority);
        if (fromIndex < 0 || toIndex < 0 || fromIndex >= cards.length || toIndex >= cards.length) {
            return state;
        }

        const ids = cards.map(card => card.id);
        const [movedId] = ids.splice(fromIndex, 1);
        ids.splice(toIndex, 0, movedId);

        return {
            ...state,
            sortMode: 'manual',
            manualOrderIds: ids,
        };
    }

    getOrderedCards(state: WorkbenchState, sortPriority: SortPriority): CardSnapshot[] {
        const cards = this.getTextCards(state.selectionSnapshot);

        if (state.sortMode === 'badge') {
            const sorter = new BadgeSortStrategy(sortPriority);
            return sorter.sort(cards as any) as CardSnapshot[];
        }

        if (state.sortMode === 'manual') {
            return this.sortByManualOrder(cards, state.manualOrderIds);
        }

        const sorter = new PositionSortStrategy(sortPriority);
        return sorter.sort(cards as any) as CardSnapshot[];
    }

    buildPreviewContent(state: WorkbenchState, sortPriority: SortPriority): string {
        const cards = this.getOrderedCards(state, sortPriority);
        const includeBadgePrefix = state.sortMode === 'badge';
        return cards
            .map((card) => includeBadgePrefix && card.badge ? `[${card.badge}] ${card.text}` : card.text)
            .join('\n\n');
    }

    private getTextCards(cards: CardSnapshot[]): CardSnapshot[] {
        return cards.filter(card => !!card.text?.trim()).map(card => ({
            ...card,
            text: card.text.trim(),
        }));
    }

    private sortByManualOrder(cards: CardSnapshot[], manualOrderIds: string[]): CardSnapshot[] {
        if (manualOrderIds.length === 0) {
            return cards;
        }

        const cardById = new Map(cards.map(card => [card.id, card]));
        const orderedCards: CardSnapshot[] = [];

        manualOrderIds.forEach((id) => {
            const card = cardById.get(id);
            if (card) {
                orderedCards.push(card);
                cardById.delete(id);
            }
        });

        cardById.forEach((card) => orderedCards.push(card));
        return orderedCards;
    }
}
