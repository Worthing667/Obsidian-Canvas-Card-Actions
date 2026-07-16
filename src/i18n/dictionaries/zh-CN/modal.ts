import enModal from "../en/modal";
import type { WidenTranslationValues } from "../../types";

const modal: WidenTranslationValues<typeof enModal> = {
	common: {
		cancel: "取消",
		close: "关闭",
		confirm: "确定",
		applyChanges: "应用更改",
		width: "宽度",
		height: "高度",
		aspectRatio: "锁定比例",
		listSeparator: "、",
		emptyCard: "[空]",
		emptyCardTitle: "空卡片"
	},
	folderPicker: {
		placeholder: "选择导出文件夹",
		empty: "没有匹配的文件夹",
		root: "仓库根目录"
	},
	badge: {
		title: "设置序号",
		label: "序号（仅支持数字）：",
		placeholder: "例如：1、2.1、10.3.2",
		hint: "序号会作为独立标记保存在画布文件中",
		remove: "移除标记",
		validation: {
			empty: "留空可移除，或直接使用“移除标记”。",
			valid: "支持层级序号，例如 1、2.1、10.3.2。",
			invalid: "只支持数字序号，格式如 1、2、2.1。"
		}
	},
	batchBadge: {
		title: "批量编号",
		summary: "按画布位置排列的 {count} 张卡片：已有标记 {existingCount} 张，未标记 {missingCount} 张。",
		scopeLabel: "编号范围：",
		scope: {
			missing: "仅编号未标记卡片",
			all: "重新编号全部选中卡片"
		},
		startLabel: "起始标记：",
		add: "为 {count} 张卡片编号",
		validation: {
			noCards: "当前选区没有可标记的文本卡片。",
			noTargets: "当前编号范围内没有需要处理的卡片。",
			invalid: "只支持数字序号，格式如 1、2、2.1。",
			valid: "层级标记会递增最后一段，例如 2.1、2.2、2.3。"
		},
		preview: "预览：\n{preview}"
	},
	split: {
		title: "拆分卡片",
		summary: "为当前卡片选择一种拆分方式。内容长度 {count} 个字符。",
		empty: "当前卡片没有可用的拆分方式。请先添加分隔符或 Markdown 标题。",
		unsetDelimiter: "(未设置)",
		byDelimiter: {
			title: "按分隔符拆分",
			available: "使用分隔符“{delimiter}”拆成 {count} 张卡片。",
			unavailable: "当前未检测到可用分隔符“{delimiter}”。"
		},
		byBlankLine: {
			title: "按空行拆分",
			available: "按段落之间的空行拆成 {count} 张卡片。",
			unavailable: "当前未检测到可用于拆分的空行。"
		},
		byHeading: {
			title: "按标题拆分",
			unavailable: "当前未检测到可用于拆分的 Markdown 标题层级。",
			optionTitle: "按{levelLabel}标题拆分",
			optionDescription: "拆成 {count} 张卡片，更深层标题会保留在所属卡片中。"
		},
		headingLevel: {
			one: "一级",
			two: "二级",
			three: "三级",
			four: "四级",
			five: "五级",
			six: "六级",
			fallback: "{level}级"
		}
	},
	dragSort: {
		defaultTitle: "手动排序复制",
		defaultDescription: "拖拽卡片调整复制顺序（共 {count} 张卡片）",
		copy: "复制",
		copied: "已按手动排序复制 {count} 张卡片的内容",
		reset: "重置排序",
		resetDone: "已重置排序",
		manualMergeTitle: "手动排序拼合",
		manualMergeDescription: "拖拽卡片调整拼合顺序（共 {count} 张卡片）",
		addAsCard: "添加为新卡片",
		previewGroup: "预览卡片组",
		newDocument: "新建文稿"
	},
	singleProperties: {
		title: "卡片属性",
		subtitle: "查看并调整当前卡片的尺寸。",
		previewTitle: "内容预览",
		currentSize: "当前尺寸",
		widthByHeight: "宽度 × 高度",
		positionCoordinates: "位置坐标",
		canvasCoordinates: "画布坐标",
		resizeTitle: "尺寸调整",
		hint: "调整后点击「应用更改」写入 Canvas。",
		copySize: "复制尺寸",
		copyPosition: "复制位置",
		clipboardSize: "卡片尺寸: {width} × {height} px",
		clipboardPosition: "卡片位置: X: {x}, Y: {y}",
		notice: {
			sizeCopied: "尺寸信息已复制到剪贴板",
			positionCopied: "位置信息已复制到剪贴板",
			sizeUpdated: "卡片尺寸已更新为 {width}×{height}px",
			updateFailed: "更新失败: {message}"
		}
	},
	properties: {
		title: "卡片属性",
		subtitle: "已选中 {count} 张卡片，可批量查看与调整尺寸。",
		summary: {
			selected: "已选中",
			selectedValue: "{count} 张卡片",
			sortedByPosition: "按位置排序",
			size: "尺寸",
			widthRange: "宽 {min}–{max} px",
			heightAverage: "高 {min}–{max}，平均 {avgWidth} × {avgHeight}",
			position: "位置"
		},
		list: {
			title: "卡片列表",
			meta: "{count} items",
			preview: "预览",
			size: "尺寸",
			position: "位置",
			badge: "标记"
		},
		batch: {
			title: "批量调整",
			meta: "预设会填入下方尺寸",
			presets: "尺寸预设",
			minSize: "最小尺寸",
			maxSize: "最大尺寸",
			avgSize: "平均尺寸",
			customSize: "自定义尺寸",
			noChange: "不修改",
			hint: "留空表示不修改该维度。有效范围：50–2000 px。"
		},
		copy: {
			size: "复制尺寸",
			summary: "复制摘要",
			sizeHeader: "批量卡片尺寸 ({count}张):",
			statsHeader: "卡片统计信息:",
			statsCount: "数量: {count}张",
			statsSizeRange: "尺寸范围: 宽 {minWidth}-{maxWidth}px, 高 {minHeight}-{maxHeight}px",
			statsAverage: "平均尺寸: {avgWidth} × {avgHeight}px",
			statsPositionRange: "位置范围: X: {minX}-{maxX}, Y: {minY}-{maxY}"
		},
		notice: {
			sizesCopied: "所有卡片尺寸已复制到剪贴板",
			statsCopied: "统计信息已复制到剪贴板",
			unifyFailed: "统一尺寸失败: {message}",
			unified: "已将所有卡片统一为 {width}×{height}",
			requireWidthOrHeight: "请至少输入宽度或高度中的一个值",
			calculatedOutOfRange: "计算得出的尺寸值超出有效范围（50-2000像素）",
			sizeOutOfRange: "尺寸值必须在 50-2000 像素范围内",
			widthOutOfRange: "宽度值必须在 50-2000 像素范围内",
			heightOutOfRange: "高度值必须在 50-2000 像素范围内",
			enterSize: "请输入要调整的宽度和/或高度",
			widthFailed: "统一宽度失败: {message}",
			heightFailed: "统一高度失败: {message}"
		}
	}
};

export default modal;
