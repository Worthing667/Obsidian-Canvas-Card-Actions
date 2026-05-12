# 项目知识库

**生成时间：** 2026-05-11
**提交：** `65ae680`
**分支：** `main`

## 概述

Obsidian Canvas 插件，支持卡片拆分、合并、内容复制、标记和颜色分组。TypeScript，约 4.7k 行代码，分层架构（适配器 → 领域 → 服务 → 表现层）。

## 目录结构

```
./
├── src/
│   ├── adapters/        # 外部系统封装（Canvas API、剪贴板、存储、仓库）
│   ├── domain/          # 业务模型（Card、Badge、CanvasData）+ 排序策略
│   ├── services/        # 核心逻辑（卡片、标记、内容、合并、预览、颜色分组）
│   ├── presentation/    # UI 层：命令、模态框、样式、视图
│   ├── settings/        # 插件设置接口 + 设置面板
│   ├── types/           # Canvas API 类型补充
│   └── utils/           # 工具函数
├── Demo/                # README 截图
├── docs/                # 功能和技术文档
├── build/               # esbuild 输出目录
├── .sisyphus/           # Sisyphus 编排文件
└── main.ts              # 插件入口（在 src/ 中）
```

## 查找指南

| 任务 | 位置 | 说明 |
|------|------|------|
| 插件生命周期、菜单、快捷键 | `src/main.ts` | 入口，串联所有模块 |
| Canvas 读写 | `src/adapters/CanvasAdapter.ts` | 每个 Canvas 一个适配器实例 |
| 卡片拆分逻辑 | `src/services/CardService.ts` | 节点拆分 + 尺寸操作 |
| 标记 CRUD + DOM | `src/services/BadgeService.ts` | 标记管理 |
| 内容提取 | `src/services/ContentService.ts` | 文本提取、剪贴板 |
| 合并逻辑 | `src/services/MergeService.ts` | 多卡片合并管道 |
| 颜色分组 | `src/services/ColorGroupService.ts` | 选中同色节点 |
| 预览工作台 | `src/services/PreviewWorkbenchService.ts` | 侧边栏状态管理 |
| 命令类 | `src/presentation/commands/` | ICommand 模式 |
| 模态框 | `src/presentation/modals/` | 拆分、标记、属性、拖拽排序 |
| 视图（工作台） | `src/presentation/views/MergeWorkbenchView.ts` | 侧边栏预览视图 |
| 样式 | `src/presentation/styles/` | 标记 CSS 注入、模态框样式 |
| 设置 | `src/settings/` | 设置接口 + UI 面板 |
| Canvas API 类型 | `src/types/canvas.ts` | CanvasNode、Canvas、CanvasData |

## 约定

- **依赖注入**：通过 `setupCanvasServices()` 在每个 Canvas 下创建服务实例
- **命令模式**：所有菜单操作均为 ICommand 实现，通过 CommandRegistry 注册
- **单例**：ClipboardAdapter、StorageAdapter、VaultAdapter 在 `initializeServices()` 中一次性创建
- **Index 文件**：每个子目录都有 `index.ts` 重新导出所有公共成员
- **类型增强**：Obsidian Canvas API 类型定义在 `src/types/canvas.ts` 中（因为官方未公开导出类型）
- **异步**：标记加载、Canvas 数据修改均为异步；菜单回调使用 `void` 实现即发即弃

## 反模式（本项目特有）

- `main.ts` 中对 `canvas:node-menu` / `canvas:selection-menu` 事件使用了 `@ts-ignore`（Obsidian API 限制）
- 全局禁用了 `@typescript-eslint/ban-ts-comment`（eslint 配置）
- 未配置单元测试或测试框架
- 标记加载延迟使用了 `activeWindow.setTimeout`（打开文件时的时序 hack）

## 命令

```bash
npm run dev       # esbuild 监听模式
npm run build     # tsc 类型检查 + esbuild 生产构建
npm run version   # 同步更新 manifest.json 和 versions.json 版本号
```

## 备注

- esbuild 输出到 `build/main.js`；生产构建时通过 `.env` 的 `PLUGIN_DEST_PATH` 复制到 vault
- 标记数据直接存储在 Canvas JSON 中（节点上的 `badge` / `badgeType` 字段）
- 标记通过运行时注入的 CSS `::after` 伪元素渲染
- 合并流程：提取内容 → 排序（位置/标记）→ 合并 → 输出（剪贴板/画布卡片/Markdown）
- 插件要求 Obsidian ≥ 0.15.0，非仅桌面端
- 使用中文回复