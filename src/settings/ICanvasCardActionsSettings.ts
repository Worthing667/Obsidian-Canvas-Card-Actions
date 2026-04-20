export type MergeOrderSetting = 'position' | 'badge';

export default interface CanvasCardActionsSettings {
	canvasCardDelimiter: string;
	sortPriority: 'yx' | 'xy'; // yx表示优先按y坐标排序，xy表示优先按x坐标排序
	enableBadges: boolean; // 是否启用徽章功能
	defaultSortMode: MergeOrderSetting;
}
