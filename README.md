# Canvas Loom

[中文说明](./README-ZH.md)

`Canvas Loom` is an Obsidian Canvas plugin for organizing text cards more efficiently. It focuses on common Canvas workflows:

- Splitting a long text card into smaller cards
- Copying, merging, and previewing content from multiple cards
- Adding visible badges to cards
- Inspecting, resizing, and arranging card properties
- Selecting cards by color and previewing color-based groups

Current version: `1.5.3`

## Feature Overview

- `Split card...`
  Split one text card by a custom delimiter or by Markdown heading level.
- `Copy card content`
  Copy the plain text content of a selected text card.
- `Quick copy` / `Quick merge`
  Process multiple selected cards with the default sorting mode from settings.
- `Preview card group`
  Load the selected text cards into the Loom workspace; when the workspace stays open, run the action again to add more cards, then change sorting, drag-adjust the current order, preview merged output, and export it.
- `Add/Edit badge`
  Add numeric outline-style badges such as `1`, `2.1`, or `10.3.2`.
- `Manage card properties`
  Inspect one card or batch-adjust selected card dimensions, width, height, aspect ratio, and layout.
- `Select same color cards`
  Select text cards with the same Canvas color and open them in the preview workflow.

## Screenshots

### 1. Split Text Cards

<p align="center">
  <img src="Demo/按标题_拆分卡片_选择器.png" alt="Split card mode selector" width="48%" />
  <img src="Demo/按标题_拆分卡片.png" alt="Canvas cards after splitting by heading level" width="48%" />
</p>

A long text card can be split by choosing a split mode, then using either a delimiter or Markdown heading level.

### 2. Organize and Export Multiple Cards

<p align="center">
  <img src="Demo/一键拼合卡片.png" alt="Quick merge selected Canvas cards" width="48%" />
  <img src="Demo/侧边栏工作台.png" alt="Workspace preview and export panel" width="48%" />
</p>

After selecting multiple cards, you can merge them immediately or load the card group into the Loom workspace to adjust sorting, preview the result, and export it.

### 3. Context Menu Actions

<p align="center">
  <img src="Demo/单卡片右键菜单.png" alt="Single card context menu" width="31%" />
  <img src="Demo/多卡片右键菜单.png" alt="Multiple card context menu" width="31%" />
  <img src="Demo/一键统一卡片尺寸_3后.png" alt="Cards after batch size adjustment" width="31%" />
</p>

Canvas Loom provides different context menu actions for single-card and multi-card selections.

### 4. Card Property Management

<p align="center">
  <img src="Demo/单卡片属性管理.png" alt="Single card property panel" width="48%" />
  <img src="Demo/多卡片属性管理.png" alt="Multiple card property panel" width="48%" />
</p>

The property panel shows card size and position, supports copying position data, and can batch-adjust selected cards to minimum, maximum, or average dimensions.

## Settings

- `Canvas card delimiter`: controls the delimiter used when splitting cards.
- `Card sorting priority`: controls whether position-based sorting prioritizes vertical or horizontal order.
- `Quick action sorting mode`: controls the default sorting mode for quick copy and quick merge.
- `Enable badges`: controls whether card badges are shown.
- `Merge cleanup mode`: controls whether source cards are kept or deleted after creating a merged card.
- `Canvas performance mode`: reduces Canvas Loom's additional rendering cost on large canvases.
- `Performance diagnostics`: logs Canvas Loom operation timing and Canvas statistics to the developer console.

## Privacy

- No account required
- No paid service integration
- No ads, telemetry, or uploaded user content
- No proactive network access
- Reads Canvas or Markdown content only when the user runs a command
- Creates or modifies files in the current vault only when the user explicitly exports, merges, or creates a note
- Supports copying selected card content to the system clipboard

## Installation

### Install from GitHub Releases

1. Open the repository [Releases page](https://github.com/woxin667/Canvas-Loom/releases).
2. Download `main.js`, `manifest.json`, and `styles.css`.
3. Put the three files in `.obsidian/plugins/canvas-loom/`.
4. Enable the plugin in Obsidian.

### Build Locally

```bash
npm install
npm run build
```

## Development

- `npm run dev`: development build
- `npm run build`: production build
- `npm run version`: sync version metadata

## Documentation

The documentation index is available at [docs/README.md](./docs/README.md).

Suggested reading:

- `docs/功能-拆分Canvas卡片.md`
- `docs/功能-卡片内容复制与排序.md`
- `docs/功能-卡片标记.md`
- `docs/功能-查看和编辑卡片属性.md`
- `docs/技术实现细节.md`
- `docs/技术实现-Obsidian官方上架与发布流程.md`

## Credits

Early development referenced **joshuakto**'s open-source project [obsidian-cardify](https://github.com/joshuakto/obsidian-cardify).
