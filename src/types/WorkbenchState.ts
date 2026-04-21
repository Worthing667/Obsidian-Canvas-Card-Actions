import type { MergeOrder } from "../services/ContentService";

export interface CardSnapshot {
    id: string;
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    badge?: string;
}

export interface WorkbenchState {
    canvasFilePath: string | null;
    canvasFileBasename: string;
    selectionSnapshot: CardSnapshot[];
    sortMode: MergeOrder;
    manualOrderIds: string[];
    previewExpanded: boolean;
    lastComputedContent: string;
}
