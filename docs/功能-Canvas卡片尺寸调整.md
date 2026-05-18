# 功能：Canvas 卡片尺寸与排列调整

本文档记录当前版本仍在使用的尺寸和排列规则，覆盖拆分、拼合、属性管理和选区浮动工具栏入口。

## 拆分卡片后的尺寸

拆分单张文本卡片时：

- 第一段内容保留在原卡片，原卡片位置和尺寸不变
- 新卡片继承原卡片的 `width` 和 `height`
- 新卡片排在原卡片右侧
- 横向间距使用 `CardService.defaultCardSpacing`，当前默认 `20 px`
- 拆分过程通过 `CanvasAdapter.mutateData` 一次性更新原卡片并追加新卡片

这样可以避免旧方案中动态高度带来的重叠问题，也避免依赖 Canvas 运行时节点创建后再二次 resize。

## 拼合卡片后的尺寸

多卡片拼合为新 Canvas 卡片时：

- 先按当前输出顺序找到锚点卡片
- 新卡片继承锚点卡片的 `x`、`y`、`width`、`height`
- 新卡片内容为合并后的文本
- 若设置为 `拼合后新建并删除原卡片`，源卡片和相关边会在同一次数据变更中移除

工作台里的 `添加为新卡片` 也使用同一规则。即使原 Canvas 已经不是当前激活页，插件也会优先根据保存的源文件路径恢复对应 Canvas 后再写入。

## 属性管理中的尺寸调整

多卡片属性管理器支持：

- `最小尺寸`、`最大尺寸`、`平均尺寸` 预设
- 自定义宽度和高度
- 只输入宽度时，仅统一宽度
- 只输入高度时，仅统一高度
- 勾选锁定比例时，根据当前输入或选区平均宽高比推导另一维度

尺寸有效范围：

```text
50–2000 px
```

所有尺寸调整都会保留卡片内容、位置、颜色和标记，只修改目标维度。

## 一键排列

选中 2 张以上文本卡片时，Canvas 选区浮动工具栏提供一键排列：

- 方向：水平或垂直
- 间距：`0–500 px`
- 排序优先级：浮层内可选择，默认使用插件设置中的 `sortPriority`
- 方向、间距和排序优先级会在当前插件会话内记住上一次成功排列时的选择

排列前会先按位置排序选中文本卡片。排序后的第一张卡片作为锚点，位置不变；其余卡片按方向和间距依次移动。

水平排列时：

```text
next.x = prev.x + prev.width + spacing
next.y 保持不变
```

垂直排列时：

```text
next.x 保持不变
next.y = prev.y + prev.height + spacing
```

水平排列只修改 `x`，垂直排列只修改 `y`，不会修改另一轴上的对齐关系、尺寸、内容、颜色、标记或边。

## 相关代码

- `src/services/CardService.ts`
- `src/services/CanvasArrangementService.ts`
- `src/services/CanvasSelectionToolbarService.ts`
- `src/adapters/CanvasAdapter.ts`
- `src/presentation/modals/SingleCardPropertiesModal.ts`
- `src/services/MergeService.ts`
