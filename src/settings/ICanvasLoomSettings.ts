type MergeOrderSetting = 'position' | 'badge';
export type MergeCleanupMode = 'keep-source' | 'delete-source';
export type CanvasLoomLanguageSetting = 'auto' | 'en' | 'zh-CN';

export const DEFAULT_SPLIT_CARDS_PER_ROW = 5;
export const MIN_SPLIT_CARDS_PER_ROW = 1;
export const MAX_SPLIT_CARDS_PER_ROW = 20;
export const DEFAULT_LANGUAGE: CanvasLoomLanguageSetting = 'auto';
export const DEFAULT_CANVAS_LABEL_ZOOM_COMPENSATION = 100;
export const MIN_CANVAS_LABEL_ZOOM_COMPENSATION = 0;
export const MAX_CANVAS_LABEL_ZOOM_COMPENSATION = 100;

export default interface CanvasLoomSettings {
	language?: CanvasLoomLanguageSetting;
	canvasCardDelimiter: string;
	insertDelimiterOnMerge: boolean;
	splitCardsPerRow: number;
	sortPriority: 'yx' | 'xy'; // yx表示倒N排序，xy表示Z字排序
	enableBadges: boolean; // 是否启用标记功能
	showEdgesAboveCards: boolean; // 是否将连线显示在卡片上方
	canvasLabelZoomCompensation: number; // 连线标签和Group标题的可读性补偿百分比(0=跟随缩放,100=尽量保持默认可读大小)
	defaultSortMode: MergeOrderSetting;
	mergeCleanupMode: MergeCleanupMode;
	enablePerformanceMode: boolean;
	enablePerformanceDiagnostics: boolean;
	largeCanvasNodeThreshold: number;
	badgeUpdateDebounceMs: number;
	enableZoomControl: boolean; // 是否在画布内显示缩放倍率控件
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
