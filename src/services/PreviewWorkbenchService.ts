import { PositionSortStrategy, SequenceSortStrategy, SortPriority } from "../domain/strategies";
import { formatMergedCardsContent } from "./MergedContentFormatter";
import { t } from "../i18n";
import type { MergeOrder } from "./ContentService";
import type { CardSnapshot, WorkbenchState } from "../types/WorkbenchState";

interface CreateWorkbenchStateOptions {
    canvasFilePath: string | null;
    canvasFileBasename: string;
    scopeLabel?: string;
    selectionSnapshot: CardSnapshot[];
    defaultSortMode: MergeOrder;
    sortPriority?: SortPriority;
    previewExpanded?: boolean;
    cardSeparator?: string | null;
}

interface AppendWorkbenchSnapshotsResult {
    state: WorkbenchState;
    addedCount: number;
    updatedCount: number;
}

export class PreviewWorkbenchService {
    createState(options: CreateWorkbenchStateOptions): WorkbenchState {
        const initialSortMode = options.defaultSortMode === 'badge' ? 'badge' : 'position';
        const isManualAdjusted = options.defaultSortMode === 'manual';
        const initialCards = isManualAdjusted
            ? this.getTextCards(options.selectionSnapshot)
            : [];

        return {
            canvasFilePath: options.canvasFilePath,
            canvasFileBasename: options.canvasFileBasename,
            scopeLabel: options.scopeLabel || t("workbench.scope.selection"),
            selectionSnapshot: [...options.selectionSnapshot],
            sortMode: initialSortMode,
            manualOrderIds: initialCards.map(card => card.id),
            isManualAdjusted,
            previewExpanded: options.previewExpanded ?? false,
            lastComputedContent: '',
            cardSeparator: options.cardSeparator ?? null,
        };
    }

    setSortMode(state: WorkbenchState, sortMode: MergeOrder): WorkbenchState {
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
            lastComputedContent: '',
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

    clearState(state: WorkbenchState): WorkbenchState {
        return {
            ...state,
            selectionSnapshot: [],
            manualOrderIds: [],
            isManualAdjusted: false,
            previewExpanded: false,
            lastComputedContent: '',
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
            lastComputedContent: '',
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
        return formatMergedCardsContent(
            cards.map(card => ({ text: card.text, badge: card.badge })),
            {
                includeBadgePrefix: false,
                cardSeparator: state.cardSeparator
            }
        );
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
            const sorter = new SequenceSortStrategy(sortPriority);
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
