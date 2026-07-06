# 功能：Canvas 卡片查找替换

## 用途

为当前 Canvas 的文本卡片提供画布范围和选区范围的查找替换。

Obsidian 原生能力已经覆盖两类场景：

- 全库搜索：Search 核心插件可以搜索 notes 和 canvases。
- 单卡片编辑：进入单张卡片编辑状态后，Obsidian/编辑器自己的查找替换可继续工作。

Canvas Loom 补的是中间缺口：

- 当前画布内所有文本卡片
- 当前选中的文本卡片

相关代码：

- `src/services/SearchReplaceService.ts`
- `src/presentation/views/MergeWorkbenchView.ts`
- `src/presentation/commands/FindReplaceCommands.ts`
- `src/services/MergeService.ts`

## 入口

- 命令面板：`Canvas Loom: 查找替换当前画布卡片`
- 插件不设置默认热键，避免与 Obsidian 或其他插件的快捷键冲突
- 用户可在 `Settings -> Hotkeys` 中自行配置

Obsidian 自带 `在当前笔记中查找` 和 `在当前笔记中查找并替换` 已经围绕 `Cmd/Ctrl+F` 建立了用户预期。Canvas Loom 不预设任何组合，避免在热键页产生冲突，也避免让用户误以为插件替代了 Obsidian 的原生命令。

## 为什么 Obsidian 占用查找快捷键，但不做画布卡片查找

调查结论：

1. Obsidian 的 Search 核心插件是全库搜索能力。官方文档说明 Search 可搜索 notes 和 canvases，并且默认快捷键是 `Ctrl+Shift+F` / `Command+Shift+F`，这不是当前视图内查找替换。
2. `Cmd/Ctrl+F` 对应的是 Obsidian 命令系统里的当前笔记查找/替换习惯。Hotkeys 文档说明热键是绑定到命令的可配置快捷键，而命令面板也用于运行任意命令。
3. Canvas 是一个独立的核心插件视图。官方 Canvas 文档说明 Canvas 数据保存为 `.canvas` 文件，使用 JSON Canvas 格式；文本卡片是 Canvas 数据的一部分，而不是一个连续的 Markdown 编辑器缓冲区。
4. 因此，`Cmd/Ctrl+F` 能被 Obsidian 当前笔记查找命令占用，是因为它是全局命令热键；但该命令在 Canvas 视觉视图中没有实现“遍历所有文本卡片并替换”的语义。

换句话说，这不是快捷键层面的问题，而是能力边界问题：Obsidian 有全库 Search，也有编辑器内 find/replace，但没有当前 Canvas/当前选区的批量卡片 find/replace。

参考：

- Obsidian Search 文档：`https://obsidian.md/help/plugins/search`
- Obsidian Hotkeys 文档：`https://obsidian.md/help/hotkeys`
- Obsidian Command palette 文档：`https://obsidian.md/help/plugins/command-palette`
- Obsidian Canvas 文档：`https://obsidian.md/help/plugins/canvas`

## 工作台结构

查找替换不再使用居中弹窗，而是复用右侧 `Loom工作台`。

工作台现在有三个一级功能：

- `预览`：按当前工作台顺序生成合并内容，并输出到剪贴板、新卡片或 Markdown 文稿。
- `排序`：保留位置排序、序号排序和手动拖拽调整。
- `查找`：当前画布/当前选区内查找替换，并可通过结果定位到卡片。

使用侧栏的原因：

- 查找结果定位到卡片时不会被弹窗遮挡。
- 查找替换、排序、预览都围绕同一批 Canvas 卡片和快照工作，但交互层级需要分开。
- 用户配置的命令热键可以直接打开工作台并切到 `查找替换` 面板。

## 范围规则

工作台打开查找替换时会捕获当前选区：

- 如果当前有选中文本卡片，默认范围为 `当前选区`
- 如果没有选中文本卡片，默认范围为 `当前画布`
- 查找替换面板直接使用入口决定的范围，不再提供范围切换按钮
- 选区范围是打开工作台时的快照；后续画布选区变化不会改变本次查找范围

首版只处理 Canvas 内嵌文本卡片：

- 包含 `type: "text"` 且 `text` 为字符串的节点
- 不处理文件卡片指向的 Markdown 文件内容
- 不处理图片、PDF、网页等非文本节点

## 替换行为

替换时会重新读取当前 Canvas 数据，再按查询条件计算命中：

- 替换当前命中
- 替换当前卡片
- 替换全部命中

写入通过 `CanvasAdapter.mutateData()` 完成：

- 只修改目标文本节点的 `text`
- 保留节点尺寸、位置、颜色、标记和其它字段
- 保留 edges
- 一次数据变更后调用 `requestSave()`

当任意 Canvas 卡片处于编辑状态时，查找替换会暂停并禁用替换操作。退出卡片编辑状态后自动恢复，避免整份 Canvas 数据写回时覆盖编辑器内尚未提交的内容。

## 结果预览与定位

查找替换面板会显示匹配结果片段：

- 每条结果显示画布坐标和命中文本附近的内容
- 命中词会在结果片段中高亮
- 点击结果会通过 `CanvasAdapter.replaceSelection()` 选中对应卡片
- `上一个` / `下一个` 会切换当前命中并选中对应卡片
- 插件会尝试把 Canvas 视口定位到当前命中所在卡片

工作台查找不再额外对 Canvas 卡片添加临时高亮，避免用户需要手动取消高亮。定位依赖 Obsidian Canvas 运行时的内部方法；如果当前版本或布局下无法调用定位方法，插件会退回到只选中目标卡片。

## 匹配模式

支持：

- 普通文本匹配
- 区分大小写
- 正则表达式

普通文本替换按字面值处理，即替换内容里的 `$1` 不会被当成正则捕获组。只有开启正则模式时，替换内容才使用 JavaScript `String.replace()` 的正则替换语义。

## UI 约束

- 工作台结构使用 `createEl` / `createDiv`
- 不直接使用 `innerHTML`
- 查找面板结果片段通过临时 DOM 渲染命中高亮，不写入 Canvas 数据
- 工作台只负责选中并定位命中卡片，不向 Canvas DOM 注入临时高亮
- 浮动查找面板仍可对当前命中的渲染文本做临时高亮；高亮只包裹当前渲染 DOM，不写入 `.canvas` 数据

## 后续可选项

- 为选区浮动工具栏增加搜索图标入口
- 增加只查找不替换的轻量模式
- 增加“替换前确认”批量预览
- 扩展到所有 `.canvas` 文件的批量替换，但这会和 Obsidian 全库搜索能力重叠，需要单独设计确认和撤销策略
