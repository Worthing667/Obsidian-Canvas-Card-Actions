import type { MergeOrder } from "../services/ContentService";

export type SnapshotBadgeType = 'number' | 'text' | 'emoji';

export interface CardSnapshot {
    id: string;
    text: string;
    x: number;
    y: number;
    width: number;
    height: number;
    badge?: string;
    badgeType?: SnapshotBadgeType;
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
