# Expert Context Pack: 排列卡片功能入口选择

Generated at: 2026-05-13
Purpose: choose_approach
Target model: auto

## User Goal

为"一键排列卡片"功能选择最合适的触发入口。功能本身已完成（arrangeCards方法 + UI表单），现在需要决定它挂在哪里。

## Question for Expert

三个候选入口，请判断哪个最合理：

A. 独立的 ArrangeCardsModal + 右键菜单项（与"管理卡片属性"并列）
B. 独立的 ArrangeCardsModal + 仅通过 command palette 触发（Ctrl+P，类似现有 registerCanvasSelectionCommand 模式）
C. 保持塞在 CardPropertiesModal 里（当前实现）

主要考量点：
- CardPropertiesModal 已经包含：统计区、卡片列表、批量尺寸调整、现在又加了排列，概念不纯
- 项目现有模式：拆分/标记/排序都是独立模态框，各自从右键菜单进入
- 右键菜单也在膨胀：单节点/多选各有大量菜单项
- 排列是低频操作，不像拆分/标记那么常用

## Project Background

- TypeScript Obsidian Canvas 插件，分层架构
- 现有命令注册：右键菜单 (canvas:selection-menu) + 命令面板 (registerCanvasSelectionCommand) + 热键 (registerHotkeys)
- 现有模态框：SplitCardModal, BadgeModal, DragSortModal, CardPropertiesModal, SingleCardPropertiesModal
- 所有操作都是选中卡片后触发

## Relevant Patterns

registerCanvasSelectionCommand 示例（main.ts:457-488）：
- 注册到 Obsidian 命令面板
- 自动检查 Canvas 上下文、选中节点
- 已有：quick-copy, quick-merge, open-merge-workbench, merge-to-canvas-card 等 8 个命令走这个模式

右键菜单注册（addSelectionMenuCommands）：
- 单节点菜单：编辑标记、拆分卡片、复制、选中同色、管理属性
- 多选菜单：选中同色、一键复制、一键拼合、打开预览、管理属性

## Constraints

- 不改动 Canvas API 底层
- 保持中文 UI
- 与现有命令/菜单体系一致
