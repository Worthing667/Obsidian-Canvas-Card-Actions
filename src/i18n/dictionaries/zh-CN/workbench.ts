import enWorkbench from "../en/workbench";
import type { WidenTranslationValues } from "../../types";

const workbench: WidenTranslationValues<typeof enWorkbench> = {
	title: "Loom工作台",
	scope: {
		selection: "当前选区",
		canvas: "当前画布",
		waiting: "等待卡片组"
	},
	colorGroup: {
		sameColor: "同色卡片分组",
		noColor: "无颜色卡片",
		multipleColors: "同色卡片分组（{count} 类）"
	},
	fileName: {
		mergedCards: "卡片合并"
	},
	tab: {
		preview: "预览",
		sort: "排序",
		find: "查找"
	},
	button: {
		clear: "清空",
		clearWorkbench: "清空工作台",
		render: "渲染",
		rerenderPreview: "重新生成预览",
		copy: "复制",
		addAsCard: "添加为新卡片",
		newDocument: "新建文稿",
		replaceCurrent: "替换当前",
		replaceCard: "替换当前卡片",
		replaceAll: "全部替换"
	},
	count: {
		textCards: "文本卡片",
		workbenchCards: "工作台卡片"
	},
	panel: {
		previewTitle: "卡片组预览",
		previewWaiting: "等待卡片渲染进工作台。",
		previewReady: "当前内容由工作台顺序生成，输出按钮使用同一份结果。",
		snapshot: "快照 {count} 张",
		currentOrder: "当前顺序 {order}",
		orderDescription: "，{description}",
		emptyList: "选择多张文本卡片后，使用右键菜单“预览卡片组”载入当前选区。",
		renderingPreview: "正在生成预览...",
		emptyPreview: "没有可预览的内容",
		findUnavailable: "在 Canvas 中打开工作台后，才能使用查找替换。"
	},
	sortMode: {
		position: "位置",
		badge: "标记"
	},
	find: {
		label: {
			query: "查找",
			replacement: "替换为",
			caseSensitive: "区分大小写",
			regex: "正则"
		},
		placeholder: {
			query: "输入要查找的文字",
			replacement: "留空表示替换为空"
		},
		status: {
			promptSelection: "输入内容后在{scope}中查找。",
			promptCanvas: "输入内容后在当前画布中查找。",
			noMatches: "没有匹配内容。范围内共有 {totalCards} 张文本卡片。",
			matches: "找到 {totalMatches} 处命中，分布在 {matchedCards} / {totalCards} 张文本卡片中。当前 {currentLabel}。"
		},
		result: {
			waiting: "等待输入查找内容。",
			noCards: "没有匹配的卡片。"
		},
		subtitle: {
			selection: "在{scope}中查找。",
			canvas: "在当前画布中查找。",
			canvasNoSelection: "当前没有选中的文本卡片，将在整个画布中查找。"
		}
	},
	source: {
		findReplace: "查找替换"
	},
	order: {
		manualSuffix: "{label} + 手动调整",
		position: "位置",
		badge: "标记",
		badgeManualTitle: "按标记排序并手动调整",
		badgeTitle: "按标记排序",
		positionManualTitle: "按位置排序并手动调整",
		positionTitle: "按位置排序"
	},
	sortDescription: {
		empty: "工作台会在收到卡片快照后生成输出内容",
		manual: "拖拽后的顺序会直接用于复制、添加为新卡片和新建文稿",
		badge: "相同标记内继续按画布位置排列",
		xy: "Z字排序，从左至右、从上到下",
		yx: "倒N排序，从上到下、从左至右"
	},
	aria: {
		dragHandle: "拖拽调整顺序"
	}
};

export default workbench;
