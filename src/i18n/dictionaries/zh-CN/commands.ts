import enCommands from "../en/commands";
import type { WidenTranslationValues } from "../../types";

const commands: WidenTranslationValues<typeof enCommands> = {
	findReplaceCanvasCards: "查找替换当前画布卡片",
	openCardProperties: "管理卡片属性",
	copyCardDimensions: "复制选中卡片的尺寸",
	quickCopySelectedCards: "将当前选区一键复制",
	quickMergeSelectedCards: "将当前选区一键拼合",
	openMergeWorkbench: "预览选中卡片组",
	findReplaceSelectedCanvasCards: "在工作台查找替换当前选区",
	batchEditSelectedCardBadges: "批量编辑选中卡片标记",
	previewSameColorCardGroup: "预览同色卡片分组",
	mergeSelectedCardsToCanvasCard: "合并选区为新卡片",
	previewSelectedCardsInWorkbenchExpanded: "预览选中卡片组（展开结果）",
	mergeSelectedCardsToMarkdown: "合并选区为新文稿",
	manualMergeSelectedCards: "手动排序拼合选区",
	editBadge: "编辑标记",
	batchEditBadge: "批量编辑标记",
	copyCardContent: "复制卡片内容",
	copyContentByPosition: "按位置复制内容",
	copyContentByBadgeOrder: "按标记顺序复制内容",
	copyByManualOrder: "手动排序复制",
	splitCardByDelimiter: "按分隔符拆分卡片",
	splitCard: "拆分卡片",
	selectSameColorCards: "选中同色卡片",
	previewSameColorGroup: "预览同色卡片分组",
	quickCopy: "一键复制",
	quickMerge: "一键拼合",
	previewCardGroup: "预览卡片组",
	mergeToCanvasCard: "合并 -> 新建卡片",
	mergeToSidebarPreview: "预览选中卡片组（展开结果）",
	mergeToMarkdown: "合并 -> 新建文稿",
	manualMerge: "手动排序拼合",
	viewCardProperties: "查看卡片属性",
	cardDimensionsUniform: "统一尺寸: {dimensions}",
	cardDimensionsList: "尺寸列表:\n{dimensions}"
};

export default commands;
