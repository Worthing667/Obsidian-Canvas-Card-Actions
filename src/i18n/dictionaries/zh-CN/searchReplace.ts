import enSearchReplace from "../en/searchReplace";
import type { WidenTranslationValues } from "../../types";

const searchReplace: WidenTranslationValues<typeof enSearchReplace> = {
	openInCanvasNotice: "请在打开画布文件时使用查找替换",
	button: {
		open: "查找替换当前画布",
		fallbackText: "查",
		previous: "上一个",
		next: "下一个",
		replace: "替换",
		close: "关闭",
		replaceCurrent: "替换当前",
		replaceAll: "全部替换",
		caseSensitive: "区分大小写",
		regex: "正则表达式"
	},
	input: {
		queryPlaceholder: "查找当前画布",
		replacementPlaceholder: "替换为"
	},
	status: {
		editingPaused: "卡片正在编辑，查找替换已暂停。",
		prompt: "输入内容后在当前画布中查找。范围内共有 {totalCards} 张文本卡片。",
		noMatches: "没有匹配内容。范围内共有 {totalCards} 张文本卡片。",
		matches: "找到 {totalMatches} 处命中，分布在 {matchedCards} / {totalCards} 张文本卡片中。"
	}
};

export default searchReplace;
