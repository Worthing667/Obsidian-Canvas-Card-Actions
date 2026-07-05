import enSettings from "../en/settings";
import type { WidenTranslationValues } from "../../types";

const settings: WidenTranslationValues<typeof enSettings> = {
	language: {
		name: "语言",
		desc: "选择 Canvas-Loom 的界面语言。",
		option: {
			auto: "自动",
			en: "English",
			zhCN: "简体中文"
		}
	},
	canvasCardDelimiter: {
		name: "设置画布卡片分隔符",
		desc: "输入用于拆分单张画布卡片的分隔符，也可在拼合时作为卡片分隔线"
	},
	insertDelimiterOnMerge: {
		name: "拼合时插入分隔线",
		desc: "开启后，一键复制、拼合、新建文稿和工作台输出会在相邻卡片之间插入当前分隔符"
	},
	splitCardsPerRow: {
		name: "拆分后每行卡片数",
		desc: "控制单张卡片拆分后每行最多排列多少张卡片，包含原卡片。超过数量后会自动换到下一行，并按卡片高度和间距下移。请输入 {min}-{max} 的整数。"
	},
	sortPriority: {
		name: "设置卡片排序优先级",
		desc: "选择多张卡片按位置排序时的阅读走向",
		option: {
			yx: "倒 N 排序（从上到下，再从左到右）",
			xy: "Z 字排序（从左到右，再从上到下）"
		}
	},
	enableBadges: {
		name: "启用标记显示",
		desc: "在画布卡片右上角显示数字标记，关闭后不会删除已有标记"
	},
	showEdgesAboveCards: {
		name: "连线显示在卡片上方",
		desc: "空闲时让 Canvas 连线显示在普通卡片上方；选中或编辑卡片时会临时让卡片压过连线，避免影响文字编辑。不修改 Canvas 文件"
	},
	disableCanvasLabelFontSizeRelativeToZoom: {
		name: "连线标签和 Group 标题不跟随画布缩放",
		desc: "开启后使用 Advanced Canvas 同款缩放补偿，让连线标签和 Group 标题在缩放时保持可读大小"
	},
	defaultSortMode: {
		name: "一键排序方式",
		desc: "设置一键复制、一键拼合默认按位置还是按序号处理",
		option: {
			position: "按位置顺序",
			badge: "按序号顺序"
		}
	},
	mergeCleanupMode: {
		name: "拼合后处理方式",
		desc: "设置一键拼合后是否保留原卡片",
		option: {
			keepSource: "拼合后新建卡片（保留原卡片）",
			deleteSource: "拼合后新建并删除原卡片"
		}
	},
	enablePerformanceMode: {
		name: "启用 Canvas 性能模式",
		desc: "减少 Canvas-Loom 在大型 Canvas 中的附加渲染开销，并在低缩放时简化标记显示"
	},
	enablePerformanceDiagnostics: {
		name: "启用性能诊断日志",
		desc: "在开发者控制台输出 Canvas-Loom 操作耗时和节点统计"
	},
	largeCanvasNodeThreshold: {
		name: "大 Canvas 判定数量",
		desc: "节点数达到该值后，标记加载会分批处理，性能模式下也会更早简化标记显示"
	},
	badgeUpdateDebounceMs: {
		name: "标记刷新延迟",
		desc: "控制标记显示刷新的等待时间，单位毫秒"
	},
	enableZoomControl: {
		name: "在画布内显示缩放控件",
		desc: "在画布底部显示缩放倍率控制条，包含预设倍率按钮（50%、75%、100%、125%、150%）和微调按钮。"
	}
};

export default settings;
