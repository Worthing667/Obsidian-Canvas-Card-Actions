import type { MergeOrder } from "../services/ContentService";

export interface CardSnapshot {
    id: string;
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color?: string;
    badge?: string;
}

export interface WorkbenchState {
    canvasFilePath: string | null;
    canvasFileBasename: string;
    scopeLabel: string;
    selectionSnapshot: CardSnapshot[];
    sortMode: MergeOrder;
    manualOrderIds: string[];
    isManualAdjusted: boolean;
    previewExpanded: boolean;
    lastComputedContent: string;
    cardSeparator: string | null;
}
