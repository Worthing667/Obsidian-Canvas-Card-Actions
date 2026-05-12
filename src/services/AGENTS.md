# 服务层

**职责：** 核心业务逻辑 — 卡片操作、内容提取、合并、标记管理、颜色分组。

## 服务映射

| 文件 | 行数 | 用途 | 主要消费者 |
|------|------|------|-----------|
| `CardService.ts` | 355 | 按分隔符/标题拆分节点，计算尺寸统计，调整大小 | SplitCardModal, PropertiesCommands |
| `ContentService.ts` | 218 | 从节点提取纯文本，写入剪贴板 | CopyCommands, MergeService |
| `MergeService.ts` | 319 | 多卡片合并管道：提取 → 排序 → 合并 → 输出（剪贴板/卡片/Markdown/文件） | MergeCommands, QuickActionCommands |
| `BadgeService.ts` | 168 | Canvas JSON 上的标记 CRUD，通过 CSS ::after 渲染 DOM | BadgeCommands, BadgeModal |
| `ColorGroupService.ts` | 110 | 从参考选选中选择所有同色卡片 | ColorGroupCommands |
| `PreviewWorkbenchService.ts` | 131 | 侧边栏工作台状态管理（排序模式、预览内容） | MergeWorkbenchView |

## 关键模式

- **Canvas 作用域实例**：服务通过 `setupCanvasServices(canvas)` 在每个 Canvas 下重新创建 — 绝非单例（单例只在适配器中）
- **适配器依赖**：每个服务都接收 CanvasAdapter（或 app 引用）— 不直接调用 Obsidian API
- **返回 vs 执行分离**：ContentService 提取并返回数据；MergeService 执行副作用（写文件、剪贴板）。为预览工作流保持分离。
- **可插拔排序**：MergeService 使用领域层的 SortStrategy 接口 — PositionSort 和 BadgeSort 可通过设置互换

## 依赖关系

```
Service → Adapters (CanvasAdapter, ClipboardAdapter, VaultAdapter)
Service → Domain Models (Card, Badge, CanvasData)
Service → Domain Strategies (SortStrategy, PositionSort, BadgeSort)
MergeService → ContentService (组合)
```

## 反模式

- 合并失败时无错误恢复 — 向上冒泡到命令，由 Obsidian 处理
- BadgeService 直接操作 DOM（nodeEl）— 与 Canvas 渲染器耦合
