# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository. Codex and other code agents should prefer `AGENTS.md` in the repository root.

**生成时间：** 2026-05-28
**提交：** `acbc8ae`
**分支：** `main`

## 概述

Obsidian Canvas 插件，支持卡片拆分、合并、内容复制、标记、颜色分组、查找替换。TypeScript，分层架构（适配器 → 领域 → 服务 → 表现层）。支持中英文国际化，自动跟随 Obsidian 语言设置。

## 命令

```bash
npm run dev       # esbuild 监听模式，自动复制 manifest.json/styles.css 到 build/
npm run build     # tsc 类型检查 + esbuild 生产构建，通过 .env 的 PLUGIN_DEST_PATH 复制到 vault
npm run version   # 同步更新 manifest.json 和 versions.json 版本号
```

### 运行测试

```bash
node --import tsx --test --test-reporter spec tests/*.test.ts
```

测试使用 Node.js 原生 test runner (`node:assert/strict`)，无额外测试框架依赖。`tests/stubs/obsidian.ts` 提供 Obsidian API 的类型替身。所有测试文件为纯 TypeScript，通过 `tsx` 即时编译。

## 目录结构

```
./
├── src/
│   ├── adapters/        # 外部系统封装（Canvas API、剪贴板、存储、仓库）
│   ├── domain/          # 业务模型（Card、Badge、CanvasData）+ 排序策略
│   ├── services/        # 核心逻辑（卡片、标记、内容、合并、预览、颜色分组、查找替换）
│   ├── presentation/    # UI 层：命令、模态框、样式、视图
│   ├── settings/        # 插件设置接口 + 设置面板
│   ├── types/           # Canvas API 类型补充
│   ├── i18n/            # 国际化：翻译函数 t()、语言解析、中英文字典
│   └── utils/           # 工具函数
├── tests/               # Node.js 原生测试，stubs/ 下有 Obsidian API 替身
├── build/               # esbuild 输出目录
└── .github/workflows/   # CI：tag 推送时自动构建 + GitHub Release
```

## 查找指南

| 任务 | 位置 | 说明 |
|------|------|------|
| 插件生命周期、菜单、快捷键 | `src/main.ts` | 入口，串联所有模块 |
| Canvas 读写 | `src/adapters/CanvasAdapter.ts` | 每个 Canvas 一个适配器实例 |
| 卡片拆分逻辑 | `src/services/CardService.ts` | 节点拆分 + 尺寸操作 |
| 标记 CRUD + DOM | `src/services/BadgeService.ts` | 标记管理，CSS ::after 渲染 |
| 内容提取 | `src/services/ContentService.ts` | 文本提取、剪贴板 |
| 合并逻辑 | `src/services/MergeService.ts` | 多卡片合并管道 |
| 查找替换 | `src/services/SearchReplaceService.ts` | 画布级文本搜索替换 |
| 颜色分组 | `src/services/ColorGroupService.ts` | 选中同色节点 |
| 预览工作台 | `src/services/PreviewWorkbenchService.ts` | 侧边栏状态管理 |
| 标签缩放 | `src/services/CanvasLabelScaleService.ts` | Group 标题和连线标签不跟随画布缩放 |
| 性能服务 | `src/services/PerformanceService.ts` | 性能日志和诊断 |
| 命令类 | `src/presentation/commands/` | ICommand 模式 |
| 模态框 | `src/presentation/modals/` | 拆分、标记、属性、拖拽排序 |
| 视图（工作台） | `src/presentation/views/MergeWorkbenchView.ts` | 侧边栏三面板（预览/排序/查找替换） |
| 样式 | `src/presentation/styles/` | 标记 CSS 注入、模态框样式 |
| 设置 | `src/settings/` | 设置接口 + UI 面板 |
| Canvas API 类型 | `src/types/canvas.ts` | CanvasNode、Canvas、CanvasData |
| 国际化翻译 | `src/i18n/index.ts` | t() 函数、configureTranslationRuntimeContext() |
| 翻译字典 | `src/i18n/dictionaries/` | en.ts / zh-CN.ts，TranslationKey 从 en 字典自动推导 |

## 国际化 (i18n)

所有用户可见文本通过 `t(key, params?)` 函数获取。`TranslationKey` 类型从 `en.ts` 字典结构自动推导（点分隔路径），确保 key 始终有效。

```ts
// 使用方式
import { t } from "./i18n";
t("menu.splitCard")                    // 简单 key
t("modal.splitCardsPerRow", { n: 5 })  // 带参数插值 {n}

// 在 main.ts 中通过 runtime context 自动获取语言设置
configureTranslationRuntimeContext({ getSettings, getApp });

// 测试中直接传参
t("menu.splitCard", undefined, { settings: mockSettings, app: mockApp });
```

支持语言：`en`（默认/回退）、`zh-CN`。语言解析逻辑在 `src/i18n/language.ts`。

## 约定

- **依赖注入**：通过 `setupCanvasServices()` 在每个 Canvas 下创建服务实例
- **命令模式**：所有菜单操作均为 ICommand 实现，通过 CommandRegistry 注册
- **单例**：ClipboardAdapter、StorageAdapter、VaultAdapter 在 `initializeServices()` 中一次性创建
- **Index 文件**：每个子目录都有 `index.ts` 重新导出所有公共成员
- **类型增强**：Obsidian Canvas API 类型定义在 `src/types/canvas.ts` 中（因为官方未公开导出类型）
- **异步**：标记加载、Canvas 数据修改均为异步；菜单回调使用 `void` 实现即发即弃
- **测试**：使用 Node.js 原生 `node:assert/strict`，无需额外测试框架。测试替身在 `tests/stubs/`

## 反模式（本项目特有）

- `main.ts` 中对 `canvas:node-menu` / `canvas:selection-menu` 事件使用了 `@ts-ignore`（Obsidian API 限制）
- 全局禁用了 `@typescript-eslint/ban-ts-comment`（eslint 配置）
- 标记加载延迟使用了 `activeWindow.setTimeout`（打开文件时的时序 hack）

## 关键实现细节

- 标记数据直接存储在 Canvas JSON 中（节点上的 `badge` / `badgeType` 字段），通过运行时注入的 CSS `::after` 伪元素渲染
- 合并流程：提取内容 → 排序（位置/标记）→ 合并 → 输出（剪贴板/画布卡片/Markdown）
- 查找替换同时支持：浮动面板（`Ctrl+F` / 画布右上角按钮）和工作台内嵌面板
- 性能模式（`enablePerformanceMode`）通过 body class 控制 CSS，减少大画布的渲染开销
- CI 通过 GitHub Actions：tag 推送时自动 `npm ci` → `npm run build` → 创建 Release
- 插件要求 Obsidian ≥ 0.16.0，非仅桌面端（`isDesktopOnly: false`）
- 使用中文回复
