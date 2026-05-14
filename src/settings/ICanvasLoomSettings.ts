export type MergeOrderSetting = 'position' | 'badge';
export type MergeCleanupMode = 'keep-source' | 'delete-source';

export default interface CanvasLoomSettings {
	canvasCardDelimiter: string;
	sortPriority: 'yx' | 'xy'; // yx表示优先按y坐标排序，xy表示优先按x坐标排序
	enableBadges: boolean; // 是否启用标记功能
	defaultSortMode: MergeOrderSetting;
	mergeCleanupMode: MergeCleanupMode;
	enablePerformanceMode: boolean;
	enablePerformanceDiagnostics: boolean;
	largeCanvasNodeThreshold: number;
	badgeUpdateDebounceMs: number;
}
