import { BadgeSortStrategy, PositionSortStrategy, SortPriority } from "../domain/strategies";
import type { MergeOrder } from "./ContentService";
import type { CardSnapshot, WorkbenchState } from "../types/WorkbenchState";

export interface CreateWorkbenchStateOptions {
    canvasFilePath: string | null;
    canvasFileBasename: string;
    scopeLabel?: string;
    selectionSnapshot: CardSnapshot[];
    defaultSortMode: MergeOrder;
    sortPriority?: SortPriority;
    previewExpanded?: boolean;
}

export interface AppendWorkbenchSnapshotsResult {
    state: WorkbenchState;
    addedCount: number;
    updatedCount: number;
}

export class PreviewWorkbenchService {
    readonly previewCollapseThreshold = 30;

    createState(options: CreateWorkbenchStateOptions): WorkbenchState {
        const initialSortMode = options.defaultSortMode === 'badge' ? 'badge' : 'position';
        const isManualAdjusted = options.defaultSortMode === 'manual';
        const initialCards = isManualAdjusted
            ? this.getTextCards(options.selectionSnapshot)
            : [];

        return {
            canvasFilePath: options.canvasFilePath,
            canvasFileBasename: options.canvasFileBasename,
            scopeLabel: options.scopeLabel || "当前选区",
            selectionSnapshot: [...options.selectionSnapshot],
            sortMode: initialSortMode,
            manualOrderIds: initialCards.map(card => card.id),
            isManualAdjusted,
            previewExpanded: options.previewExpanded ?? false,
            lastComputedContent: '',
        };
    }

    setSortMode(state: WorkbenchState, sortMode: MergeOrder, sortPriority: SortPriority): WorkbenchState {
        if (sortMode === 'manual') {
            return state;
        }

        if (state.sortMode === sortMode && !state.isManualAdjusted) {
            return state;
        }

        return {
            ...state,
            sortMode,
            manualOrderIds: [],
            isManualAdjusted: false,
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

    appendSnapshots(state: WorkbenchState, snapshots: CardSnapshot[], sortPriority: SortPriority): AppendWorkbenchSnapshotsResult {
        const incomingCards = this.getTextCards(snapshots);
        if (incomingCards.length === 0) {
            return { state, addedCount: 0, updatedCount: 0 };
        }

        const incomingById = new Map(incomingCards.map(card => [card.id, card]));
        let updatedCount = 0;
        const refreshedSnapshots = state.selectionSnapshot.map((snapshot) => {
            const incoming = incomingById.get(snapshot.id);
            if (!incoming) {
                return snapshot;
            }

            incomingById.delete(snapshot.id);
            updatedCount += 1;
            return incoming;
        });

        const addedCards = Array.from(incomingById.values());
        const selectionSnapshot = [...refreshedSnapshots, ...addedCards];
        const orderedCards = state.isManualAdjusted
            ? [
                ...this.getOrderedCards({ ...state, selectionSnapshot: refreshedSnapshots }, sortPriority),
                ...addedCards
            ]
            : [];

        return {
            state: {
                ...state,
                selectionSnapshot,
                manualOrderIds: orderedCards.map(card => card.id),
                lastComputedContent: ''
            },
            addedCount: addedCards.length,
            updatedCount
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
            manualOrderIds: ids,
            isManualAdjusted: true,
        };
    }

    getOrderedCards(state: WorkbenchState, sortPriority: SortPriority): CardSnapshot[] {
        const baseCards = this.getAutoSortedCards(state.selectionSnapshot, state.sortMode, sortPriority);
        return state.isManualAdjusted
            ? this.sortByManualOrder(baseCards, state.manualOrderIds)
            : baseCards;
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

    private getAutoSortedCards(cards: CardSnapshot[], sortMode: MergeOrder, sortPriority: SortPriority): CardSnapshot[] {
        const textCards = this.getTextCards(cards);

        if (sortMode === 'badge') {
            const sorter = new BadgeSortStrategy(sortPriority);
            return sorter.sort(textCards);
        }

        const sorter = new PositionSortStrategy(sortPriority);
        return sorter.sort(textCards);
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
