# 命令层

**职责：** 所有用户触发的操作（菜单、快捷键、命令面板）→ 通过 CommandRegistry 注册的 ICommand 实现。

## 命令映射

| 文件 | 命令 | 触发器 |
|------|------|--------|
| `CopyCommands.ts` | CopySingleCardCommand, QuickCopyCommand | 节点菜单（单选）、选区菜单（多选） |
| `CreateCommands.ts` | MergeToCanvasCardCommand, MergeToMarkdownCommand | 选区快捷键 |
| `BadgeCommands.ts` | OpenBadgeModalCommand | 节点菜单 |
| `ColorGroupCommands.ts` | SelectSameColorCardsCommand, OpenSameColorGroupWorkbenchCommand | 节点菜单（单选）、选区菜单（多选） |
| `MergeCommands.ts` | OpenPreviewWorkbenchCommand, MergeToSidebarPreviewCommand, ManualMergeCommand, QuickMergeCommand | 选区菜单、快捷键 |
| `QuickActionCommands.ts` | 复制/合并的快捷变体 | 选区快捷键 |
| `PropertiesCommands.ts` | OpenCardPropertiesCommand, CopyCardDimensionsCommand | 节点菜单（单选）、选区菜单（多选）、快捷键 |
| `CommandRegistry.ts` | 注册表类 | 在 main.ts 中串联 |

## 命令模式

```
ICommand (接口)
  execute(): Promise<void> | void
  canExecute?(): boolean   ← 可选守卫（在 registerCanvasSelectionCommand 中使用）
```

- **注册流程**：main.ts 创建命令实例 → registry.register('id', cmd) → registry.addCommandToMenu(menu, 'id', label, icon)
- **canExecute 守卫**：在命令面板显示前检查；返回 false 则隐藏命令
- **异步执行**：所有 execute() 调用在事件处理器中使用 `void` 实现即发即弃 — 错误在内部捕获或冒泡到 Obsidian
- **选区管理**：命令从 main.ts 处理器接收已解析的选区数组；命令不直接查询 Canvas

## 菜单事件映射

```
canvas:node-menu        → addNodeMenuCommands(menu, node)         → 单卡片命令
canvas:selection-menu   → addSelectionMenuCommands(menu, selection, file) → 多卡片命令
registerCanvasSelectionCommand()                                  → 快捷键/命令面板命令
```

## 备注

- 菜单标签使用中文（如"拆分卡片..."、"一键复制"）
- 图标使用 Obsidian Lucide 图标名（split, copy, tag, palette, settings, file-plus, panel-right）
- PropertiesCommands.ts 最大（139 行）— 同时处理单卡片和多卡片属性管理
