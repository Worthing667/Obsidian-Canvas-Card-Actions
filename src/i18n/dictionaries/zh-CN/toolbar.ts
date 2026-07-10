import enToolbar from "../en/toolbar";
import type { WidenTranslationValues } from "../../types";

const toolbar: WidenTranslationValues<typeof enToolbar> = {
	autoHeight: {
		label: "自适应高度",
		fallbackText: "高"
	},
	arrange: {
		label: "整理间距",
		fallbackText: "间距",
		horizontalSpacing: "水平间距",
		verticalSpacing: "垂直间距",
		adjust: "调整",
		spacing: "间距",
		apply: "应用",
		direction: {
			horizontal: "水平",
			vertical: "垂直"
		},
		anchor: {
			label: "固定边",
			left: "固定左侧",
			right: "固定右侧",
			top: "固定上方",
			bottom: "固定下方"
		}
	},
	sequenceTools: {
		label: "序号工具",
		fallbackText: "序",
		single: {
			summaryWithBadge: "当前卡片标记：{badge}",
			summaryWithoutBadge: "当前卡片未设置标记",
			setNumber: "设置序号...",
			remove: "移除标记"
		},
		multiple: {
			summary: "已选 {selectedCount} 张，其中 {badgeCount} 张有标记",
			batchNumber: "批量编号...",
			remove: "移除 {count} 个标记"
		}
	},
	zoomControl: {
		decrease: "缩小",
		increase: "放大",
		percentage: "缩放百分比"
	}
};

export default toolbar;
