export type MergeOrderSetting = 'position' | 'badge';
export type MergeCleanupMode = 'keep-source' | 'delete-source';

export const DEFAULT_SPLIT_CARDS_PER_ROW = 5;
export const MIN_SPLIT_CARDS_PER_ROW = 1;
export const MAX_SPLIT_CARDS_PER_ROW = 20;

export default interface CanvasLoomSettings {
	canvasCardDelimiter: string;
	insertDelimiterOnMerge: boolean;
	splitCardsPerRow: number;
	sortPriority: 'yx' | 'xy'; // yx表示倒N排序，xy表示Z字排序
	enableBadges: boolean; // 是否启用标记功能
	showEdgesAboveCards: boolean; // 是否将连线显示在卡片上方
	disableCanvasLabelFontSizeRelativeToZoom: boolean; // 连线标签和 Group 标题是否不跟随画布缩放
	defaultSortMode: MergeOrderSetting;
	mergeCleanupMode: MergeCleanupMode;
	enablePerformanceMode: boolean;
	enablePerformanceDiagnostics: boolean;
	largeCanvasNodeThreshold: number;
	badgeUpdateDebounceMs: number;
}

export function resolveMergeCardSeparator(
	settings: Pick<CanvasLoomSettings, "canvasCardDelimiter" | "insertDelimiterOnMerge">
): string | null {
	if (!settings.insertDelimiterOnMerge) {
		return null;
	}

	const delimiter = settings.canvasCardDelimiter.trim();
	return delimiter || null;
}
