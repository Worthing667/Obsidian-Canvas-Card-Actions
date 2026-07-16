import enErrors from "../en/errors";
import type { WidenTranslationValues } from "../../types";

const errors: WidenTranslationValues<typeof enErrors> = {
	saveSettingsFailed: "保存设置失败",
	canvasGetDataFailed: "无法获取画布数据",
	canvasSetDataFailed: "无法设置画布数据",
	canvasEditingConflict: "请先退出卡片编辑状态，再修改画布",
	canvasSelectionUpdateFailed: "无法更新画布选区",
	canvasSaveFailed: "保存画布失败",
	noSelectedTextCards: "没有选中文本卡片",
	noResizableTextCards: "没有找到可调整的文本卡片",
	widthOutOfRange: "宽度必须在 50-2000 px 范围内",
	heightOutOfRange: "高度必须在 50-2000 px 范围内",
	canvasOperationFailed: "画布操作失败，请刷新页面后重试",
	saveFailedCheckPermissions: "保存失败，请检查文件权限",
	operationFailedWithMessage: "操作失败：{message}",
	invalidBadgeFormat: "标记只支持数字序号，格式如 1、2、2.1",
	batchBadgeCountMismatch: "批量标记数量与卡片数量不一致",
	badgeNodeNotFound: "在画布数据中找不到可标记节点",
	badgeRemovalNodeNotFound: "在画布数据中找不到可移除标记节点",
	nodeNotFoundInCanvasData: "在画布数据中找不到节点",
	createSidebarViewFailed: "无法创建侧边栏视图",
	workbenchViewInitFailed: "Loom工作台视图未成功初始化",
	regexCannotMatchEmpty: "查找条件不能匹配空字符串",
	regexInvalid: "正则表达式无效：{message}",
	autoHeightEditing: "请先退出卡片编辑状态，再使用自适应高度",
	autoHeightNoCards: "请选择至少一张可自适应高度的卡片",
	autoHeightUnsupported: "当前 Obsidian 版本不支持批量自适应高度",
	spacingOutOfRange: "{label}必须在 0-500 px 范围内",
	arrangementNeedTwoTextCards: "至少需要两张文本卡片才能整理间距",
	arrangementInsufficientCards: "在画布数据中未找到足够的卡片信息",
	invalidCardSize: "卡片尺寸无效（宽:{width}, 高:{height}），无法整理间距",
	cardImageExportNoTextCards: "请至少选择一张文本卡片再导出",
	cardImageExportEditing: "请先退出卡片编辑状态，再导出图片",
	cardImageExportMissingCanvasFile: "请在打开 Canvas 文件时使用图片导出",
	cardImageExportUnsupported: "当前 Obsidian 版本不支持卡片图片导出",
	cardImageExportUnmountedCard: "部分选中卡片尚未完成渲染，请等待卡片显示后重试",
	cardImageExportFailed: "导出卡片图片失败，请查看控制台了解详情"
};

export default errors;
