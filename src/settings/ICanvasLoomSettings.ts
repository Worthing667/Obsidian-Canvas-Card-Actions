export type MergeOrderSetting = 'position' | 'badge';
export type MergeCleanupMode = 'keep-source' | 'delete-source';

export const DEFAULT_SPLIT_CARDS_PER_ROW = 5;
export const MIN_SPLIT_CARDS_PER_ROW = 1;
export const MAX_SPLIT_CARDS_PER_ROW = 20;

export default interface CanvasLoomSettings {
	canvasCardDelimiter: string;
	splitCardsPerRow: number;
	sortPriority: 'yx' | 'xy'; // yx表示倒N排序，xy表示Z字排序
	enableBadges: boolean; // 是否启用标记功能
	defaultSortMode: MergeOrderSetting;
	mergeCleanupMode: MergeCleanupMode;
	enablePerformanceMode: boolean;
	enablePerformanceDiagnostics: boolean;
	largeCanvasNodeThreshold: number;
	badgeUpdateDebounceMs: number;
}
