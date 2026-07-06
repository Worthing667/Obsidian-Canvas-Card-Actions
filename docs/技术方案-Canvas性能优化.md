# Canvas 性能优化方案

本文档用于记录 Canvas-Loom 的 Canvas 性能优化边界、已落地实现和后续路线。重点不是重写 Obsidian Canvas，而是在当前插件架构内，用低风险方式减少额外开销，并在可控范围内提供可关闭的性能模式。

## 背景

Obsidian Canvas 在卡片数量增加后容易出现以下体感问题：

- 打开大型 Canvas 慢
- 平移和缩放时掉帧
- 选中多卡片后右键菜单响应变慢
- 卡片包含 embed、图片、Dataview 或其他插件渲染内容时更明显
- Canvas-Loom 的标记加载、卡片拆分、合并、批量属性操作可能触发额外刷新

Claude 给出的方向中，`视口剔除 + LOD 位图快照 + 父级单一 transform` 是图形白板类应用常见方案。但这些优化多数属于 Canvas 渲染器内部能力，而不是普通 Obsidian 插件天然能稳定接管的范围。

## 当前项目适配性结论

Canvas-Loom 当前适合做“辅助型性能优化”，不适合直接做 Heptabase、tldraw、Miro 级别的渲染架构重写。

原因：

- 当前插件主要通过 Canvas 运行时对象读写数据：`getData`、`setData`、`requestSave`、`nodes`、`selection`。
- 项目没有接管 Obsidian Canvas 的节点挂载、MarkdownRenderer 生命周期、pan/zoom transform、viewport culling。
- 标记功能会操作节点 DOM，但只是在已有节点上添加 `data-badge`，不是渲染管线的拥有者。
- Obsidian Canvas 内部 API 非公开，重度 monkey patch 容易在 Obsidian 更新后失效。

因此，第一阶段应该优先做：

1. 插件自身减少刷新和 DOM 扫描
2. 标记系统增量化和懒更新
3. 可关闭的轻量性能模式
4. 基础性能度量和回归观察

## 目标

### 必须达成

- 不破坏现有拆分、合并、复制、标记、属性管理功能。
- 不依赖不可恢复的私有 API 修改。
- 所有性能相关行为都能通过设置关闭。
- 大 Canvas 下 Canvas-Loom 自身不再成为明显卡顿来源。
- 对普通用户隐藏复杂度，默认策略保守。

### 尽量达成

- 36 到 100 张普通文本卡片场景下，插件操作响应更稳定。
- 带大量标记的 Canvas 打开时，标记加载不阻塞主要交互。
- 多卡片拆分、合并、删除源卡片时，减少 Canvas 全量 setData 次数。
- 缩放很小时可以降低 Canvas-Loom 附加显示的 DOM/CSS 成本。

### 暂不追求

- 完全替换 Obsidian Canvas 渲染器。
- 真正卸载屏外 Obsidian Canvas 节点。
- 重写 Markdown 渲染器或将 Markdown 渲染迁移到 Worker。
- 对 embed、Dataview、第三方插件渲染内容做强制缓存。

## 非目标和风险边界

以下方案不作为第一阶段目标：

| 方案 | 结论 | 原因 |
| --- | --- | --- |
| 父级单一 transform | 暂不做 | Obsidian Canvas 已控制 transform，插件强行接管风险高 |
| 销毁屏外节点 DOM | 暂不做 | 容易破坏选择、拖拽、编辑、连接线、保存状态 |
| html2canvas 位图快照 | 后期实验 | 截图成本高，内存占用大，主题和插件内容容易失真 |
| Web Worker 解析 Markdown | 暂不做 | 主瓶颈多在 DOM 和主线程渲染，插件不拥有最终挂载流程 |
| patch MarkdownRenderer | 暂不做 | 私有行为多，Obsidian 更新风险高 |

## 优化路线总览

推荐分四期推进：

1. **P0：度量和写入减负**
   先知道卡在哪里，并减少 Canvas-Loom 主动触发的刷新次数。

2. **P1：标记系统懒加载与增量更新**
   让 badge 渲染不再全量扫、不再重复扫、不阻塞打开 Canvas。

3. **P2：轻量性能模式**
   通过 CSS containment、低缩放 LOD、屏外弱化显示，降低插件附加 DOM 成本。

4. **P3：实验性快照缓存**
   只对纯文本静态卡片做可选实验，不默认开启。

## 当前落地状态

截至当前代码，已经落地的部分包括：

- 设置项：`enablePerformanceMode`、`enablePerformanceDiagnostics`、`largeCanvasNodeThreshold`、`badgeUpdateDebounceMs`
- `PerformanceService`：统计 Canvas 节点结构、判断大 Canvas、输出诊断日志、包裹操作耗时
- `CanvasPerformanceModeService`：在性能模式开启时同步 Canvas wrapper 的渲染降级状态，根据缩放和大 Canvas 阈值切换 badge 显示密度
- `CanvasAdapter.mutateData`：集中完成一次 Canvas 数据修改，减少重复 `setData`
- 拆分卡片：更新原卡片和追加新卡片合并为一次 `setData`
- 拼合并删除源卡片：删除源节点、删除相关边、追加合并卡片合并为一次 `setData`
- `BadgeRenderScheduler`：对标记加载做防抖，并在大 Canvas 中按 `requestAnimationFrame` 分帧写 DOM
- 插件生命周期：关闭标记或卸载插件时取消 pending timer / RAF，并清理 DOM 上的标记显示
- 性能模式 class：通过 `body.canvas-loom-performance-mode` 控制，具体 CSS 规则放在根目录 `styles.css`
- 性能模式 CSS 降载：Canvas 节点使用 `contain: layout paint`，节点内容使用 `backface-visibility: visible`，badge 关闭动画和阴影
- zoom-aware badge 降级：性能模式下低缩放时 badge 从文字胶囊降级为小圆点；普通 Canvas 在 `zoom <= 0.6` 触发，大 Canvas 在 `zoom <= 0.8` 触发

尚未落地或仍保持实验边界的部分：

- `content-visibility` 单独实验开关
- 更激进的缩放级别 LOD
- 屏外弱化显示
- 位图或文本快照缓存

## P0：度量和写入减负

### 0.1 增加性能设置项

当前已经新增设置：

- `enablePerformanceMode`
  是否开启 Canvas 性能模式，默认关闭。
- `enablePerformanceDiagnostics`
  是否在控制台输出性能诊断，默认关闭。
- `badgeUpdateDebounceMs`
  标记 DOM 更新防抖时间，默认 `100` 到 `200` ms。
- `largeCanvasNodeThreshold`
  大 Canvas 判定阈值，当前默认 `80`。当前用于标记分批加载，并让大 Canvas 更早进入 badge compact 显示。

相关文件：

- `src/settings/ICanvasLoomSettings.ts`
- `src/settings/CanvasLoomSettingTab.ts`
- `src/adapters/StorageAdapter.ts`

### 0.2 增加 PerformanceService

新增服务：

- `src/services/PerformanceService.ts`

职责：

- 统计当前 Canvas 的节点数、边数、文本卡片数、文件卡片数、带 badge 卡片数。
- 记录 Canvas-Loom 操作耗时。
- 为其他服务提供 `isLargeCanvas(canvasData)` 判断。
- 在诊断模式下使用 `console.debug` 输出结构化日志。

当前接口：

```ts
export interface CanvasPerformanceStats {
    nodeCount: number;
    edgeCount: number;
    textNodeCount: number;
    fileNodeCount: number;
    badgeNodeCount: number;
    isLargeCanvas: boolean;
}
```

日志示例：

```ts
console.debug("[Canvas Loom][perf]", {
    operation: "loadBadges",
    durationMs,
    nodeCount,
    badgeNodeCount
});
```

### 0.3 合并 Canvas 数据写入

当前部分操作会多次调用 `setData`，可能导致多次 Canvas 重建或刷新。

优先优化点：

- 拆分卡片：
  - 当前流程：更新原卡片，再添加新卡片。
  - 目标流程：一次读取 CanvasData，在内存里更新原卡片并追加新卡片，然后一次 `setData`，一次 `requestSave`。
  - 相关文件：`src/services/CardService.ts`

- 合并到 Canvas 卡片并删除源卡片：
  - 当前流程：先添加新卡片，再按 cleanupMode 删除源卡片。
  - 目标流程：一次事务中完成添加和删除。
  - 相关文件：`src/services/MergeService.ts`

- 批量尺寸调整和排列：
  - 当前已经基本是一次读取、一次写入。
  - 后续只需要确认没有额外 requestSave。

当前已经在 `CanvasAdapter` 增加事务式方法：

```ts
async mutateData(mutator: (data: CanvasData) => void): Promise<CanvasData>
```

注意点：

- 不要直接丢失未知字段。
- 当前 `mutateData` 会保留 Canvas 顶层未知字段，并复制 `nodes` / `edges` 后再交给 mutator 修改。
- 批量 mutation 后统一 `requestSave`。

### 0.4 验收标准

- 拆分一次卡片只触发一次 `setData`。
- 合并并删除源卡片只触发一次 `setData`。
- 诊断模式能输出节点统计和操作耗时。
- 关闭诊断时不产生额外控制台噪音。

## P1：标记系统懒加载与增量更新

标记功能是当前项目里最接近 Canvas DOM 的模块，也是第一阶段最值得优化的点。

### 1.1 当前问题

`BadgeService.loadCanvasBadges()` 会读取 CanvasData，然后遍历所有带 badge 的节点并查找运行时节点 DOM。

潜在问题：

- Canvas 打开时立即执行，可能和 Obsidian 自身渲染竞争。
- 多个 Canvas leaf 打开时可能重复加载。
- `file-open` 后固定 `100ms` 延迟，不保证 Canvas 节点已经稳定。
- 后续 layout-change 只确保样式存在，没有统一的调度策略。

### 1.2 新增 BadgeRenderScheduler

新增：

- `src/services/BadgeRenderScheduler.ts`

职责：

- debounce badge 更新请求。
- 使用 `requestAnimationFrame` 分帧处理 DOM 写入。
- 避免同一 Canvas/filePath 在短时间内重复加载。
- 在插件卸载时取消 pending timer 和 RAF。

建议行为：

- 小 Canvas：一次 RAF 内处理完成。
- 大 Canvas：每帧处理固定数量，例如 20 到 50 个 badge 节点。
- 如果节点 DOM 暂未出现，最多重试 3 次，每次间隔 100 到 200 ms。

### 1.3 Badge DOM 缓存

为每个 Canvas 维护轻量缓存：

```ts
type BadgeDomState = Map<string, string>;
```

含义：

- key：node id
- value：当前已应用到 DOM 的 badge content

更新策略：

- badge 未变化：跳过 DOM 写入。
- badge 新增或变化：更新 `data-badge`。
- badge 被移除：清理 `data-badge`。
- CanvasData 中不存在的节点：从缓存移除。

### 1.4 降低 DOM 查询成本

当前每次对节点都会查询：

- `.canvas-node-content`
- `.markdown-embed`
- `node.nodeEl`

优化方向：

- 优先只给 `node.nodeEl` 设置 `data-badge`。
- CSS 通过父节点属性选择器控制显示。
- 只有兼容旧 DOM 结构失败时，才 fallback 到内部元素。

这样可以减少每个节点 2 到 3 次 `querySelector`。

### 1.5 与设置联动

关闭 `enableBadges` 时：

- 取消 scheduler pending 任务。
- 清理已知缓存中的 DOM。
- 不再响应 badge 加载任务。

打开 `enableBadges` 时：

- 注入或确保样式存在。
- 通过 scheduler 延迟加载当前打开 Canvas。

### 1.6 验收标准

- 打开带 100 个 badge 的 Canvas 时，主线程不出现明显连续阻塞。
- 重复 `file-open` 或 layout 切换不会重复全量写 DOM。
- 设置关闭标记后，DOM 中残留 `data-badge` 被清理。
- 标记新增、修改、删除后，显示和 `.canvas` 数据一致。

## P2：轻量性能模式

P2 的目标是降低 Canvas-Loom 附加 UI 在大 Canvas 下的成本，不强行替代 Obsidian Canvas 渲染器。

### 2.1 CSS containment

在性能模式下，对 Canvas 节点增加较保守的 containment，并降低 Canvas Loom badge 自身的绘制成本：

```css
.canvas-loom-performance-mode .canvas-node {
    contain: layout paint;
}

.canvas-loom-performance-mode .canvas-node .canvas-node-content {
    backface-visibility: visible;
}

.canvas-loom-performance-mode .canvas-node .canvas-node-content[data-badge]::after {
    animation: none;
    box-shadow: none;
}
```

需要谨慎验证：

- 连接线锚点是否正常。
- 节点阴影、菜单、badge 是否被裁剪。
- 拖拽、框选、编辑状态是否异常。

不建议第一版使用：

```css
contain: strict;
```

`strict` 包含 size containment，容易影响 Canvas 节点尺寸测量。

### 2.2 zoom-aware badge 降级

`CanvasPerformanceModeService` 在性能模式开启时低频同步 Canvas wrapper 的 `data-canvas-loom-badge-mode`：

- `full`：保持完整数字 badge。
- `compact`：badge 降级为 8px 小圆点，减少低缩放和大 Canvas 浏览时的文本绘制成本。

触发阈值：

- 普通 Canvas：`zoom <= 0.6`
- 大 Canvas：`zoom <= 0.8`

大 Canvas 判定复用 `largeCanvasNodeThreshold`。服务优先读取运行时 `canvas.nodes.size`，只有缺失时才兜底读取 `canvas.getData().nodes.length`，避免为持续缩放同步引入额外 Canvas 数据读取成本。

### 2.3 content-visibility 实验

可实验：

```css
.canvas-loom-performance-mode .canvas-node-content {
    content-visibility: auto;
}
```

风险：

- Canvas 使用 transform 和自定义坐标系，浏览器对可见性判断未必符合预期。
- 可能影响节点高度测量或内部滚动。

因此建议：

- 默认关闭。
- 仅在高级设置里作为实验项。
- 明确标注可能导致显示异常。

### 2.3 缩放级别 LOD

插件可以尝试读取 Canvas 缩放状态，但这很可能是私有字段。Obsidian Canvas 中 `scale` 才是实际倍率；`zoom` / `tZoom` 是内部对数值，语义为 `log2(scale)`。建议采用渐进策略：

1. 优先观察 DOM 上是否已有缩放相关 class 或 style。
2. 如果 Canvas runtime 暴露 `scale`，优先通过类型守卫读取。
3. 如果只能读取 `zoom` / `tZoom`，先用 `2 ** zoom` 转换为实际倍率。
4. 如果无法稳定读取，不做 LOD。

LOD 分级建议：

- scale >= 0.7：完整显示。
- 0.3 <= scale < 0.7：保留 badge 和卡片外观，减少 Canvas-Loom 自定义装饰。
- scale < 0.3：只保留 badge 或极简标记，隐藏非必要阴影和动画。

注意：

- 不隐藏 Obsidian 原生 Markdown 内容，除非用户明确启用实验模式。
- 不影响选中节点、悬停节点、正在编辑节点。

### 2.4 屏外弱化显示

不建议销毁屏外节点，但可以做轻量 class 标记：

- 通过节点坐标和当前视口估算是否离屏。
- 离屏时只降低 Canvas-Loom 自定义附加效果。
- 回到视口时恢复。

实现前提：

- 能稳定读取 Canvas viewport、pan、zoom。
- 如果无法读取，跳过该优化。

### 2.5 验收标准

- 性能模式关闭时，Canvas 行为完全回到旧逻辑。
- 开启性能模式后，基础操作不出现显示错误。
- 大 Canvas 平移缩放时，Canvas-Loom 自定义 badge 和装饰不造成明显额外卡顿。
- 如果无法读取缩放或视口状态，插件安静降级，不报错。

## P3：实验性快照缓存

快照缓存不是第一阶段方案，只适合后期作为实验开关。

### 3.1 适用范围

只考虑纯文本静态卡片：

- `type === "text"`
- 不包含 embed 语法 `![[...]]`
- 不包含 Dataview 代码块
- 不处于编辑态
- 不在选中、拖拽、悬停状态

### 3.2 实现方向

可选方案：

1. DOM to bitmap
   - 使用 `html2canvas` 类方案。
   - 缺点是依赖重、截图慢、主题兼容复杂。

2. Text preview cache
   - 不截图，只生成纯文本预览 DOM。
   - 低缩放时替代复杂 Markdown 显示。
   - 对插件更可控，但不是真正视觉快照。

更推荐第二种，因为它不需要引入重依赖，也更容易关闭和回退。

### 3.3 风险

- 可能和 Obsidian 原生编辑态冲突。
- 可能和其他 Canvas 插件冲突。
- 图片、embed、callout、代码块主题无法完整复现。
- 快照失效策略复杂。

### 3.4 验收标准

- 默认关闭。
- 开启后只影响符合条件的纯文本卡片。
- 编辑、选中、悬停时立即恢复原生显示。
- 出错时移除快照 class，不影响原始卡片。

## 设置设计

当前设置页直接新增以下性能相关项：

- `启用 Canvas 性能模式`
  - 描述：减少 Canvas-Loom 在大型 Canvas 中的附加渲染开销。
- `启用性能诊断日志`
  - 描述：在开发者控制台输出 Canvas-Loom 操作耗时和节点统计。
- `大 Canvas 阈值`
  - 描述：超过该节点数后启用更保守的延迟和分帧策略。
- `标记更新防抖时间`
  - 描述：控制标记 DOM 更新的延迟，数值越大越不容易阻塞交互。
`实验：content-visibility` 暂未加入设置页，仍属于后续实验项。

默认值建议：

```ts
{
    enablePerformanceMode: false,
    enablePerformanceDiagnostics: false,
    largeCanvasNodeThreshold: 80,
    badgeUpdateDebounceMs: 150
}
```

## 代码结构

当前新增或调整文件：

```text
src/services/PerformanceService.ts
src/services/BadgeRenderScheduler.ts
src/services/index.ts
src/settings/ICanvasLoomSettings.ts
src/settings/CanvasLoomSettingTab.ts
src/adapters/CanvasAdapter.ts
src/main.ts
styles.css
```

模块职责：

- `PerformanceService`
  负责统计、耗时、阈值判断。

- `BadgeRenderScheduler`
  负责 badge DOM 更新调度、分帧和缓存。

- `CanvasAdapter`
  增加事务式数据更新，减少重复 setData。

- `main.ts`
  负责把性能服务和 badge scheduler 接入插件生命周期。

- `styles.css`
  放置性能模式 class，不运行时创建 style。

## 兼容性策略

由于 Canvas 运行时 API 非公开，所有私有字段访问都要满足：

- 使用类型守卫。
- 失败时静默跳过该优化。
- 不在主链路依赖私有字段返回值。
- 不修改 Obsidian 原生方法原型。
- 不覆盖 Canvas 自己的事件处理器。

示例：

```ts
function getCanvasZoom(canvas: unknown): number | null {
    if (!canvas || typeof canvas !== "object") {
        return null;
    }

    const candidate = canvas as { scale?: unknown; tZoom?: unknown; zoom?: unknown };
    if (typeof candidate.scale === "number" && candidate.scale > 0) {
        return candidate.scale;
    }

    const internalZoom = typeof candidate.tZoom === "number"
        ? candidate.tZoom
        : candidate.zoom;
    return typeof internalZoom === "number" ? 2 ** internalZoom : null;
}
```

## 测试计划

### 手动测试 Canvas

准备至少四类测试文件：

- 36 张普通文本卡片
- 100 张普通文本卡片
- 100 张带 badge 文本卡片
- 混合文本、文件节点、图片、embed 的 Canvas

### 核心回归

每轮都检查：

- 拆分卡片
- 一键复制
- 一键拼合
- 拼合后删除源卡片
- 打开预览工作台
- 添加、编辑、删除标记
- 关闭标记显示
- 单卡片和多卡片属性管理
- 排列和批量尺寸调整

### 性能观察

使用 Chrome/Electron DevTools：

- Performance 面板观察长任务。
- Console 查看 `[Canvas Loom][perf]` 日志。
- Elements 检查 `data-badge` 是否重复写入。
- Memory 简单观察是否有 scheduler 缓存泄露。

### 验收指标

第一阶段建议使用相对指标，不承诺绝对 FPS：

- badge 加载耗时可观测。
- 大 Canvas 中 badge 更新被分帧处理。
- 拆分和合并操作的 `setData` 次数下降。
- 性能模式关闭时行为与旧版一致。
- 开启性能模式后无明显显示破坏。

## 实施顺序

建议按以下顺序实现：

1. 新增设置项和 PerformanceService。
2. 给 CanvasAdapter 增加事务式数据更新。
3. 优化拆分卡片：一次 setData。
4. 优化合并并删除源卡片：一次 setData。
5. 新增 BadgeRenderScheduler。
6. 将 `loadCanvasBadges` 改为调度式、分帧式。
7. 增加 badge DOM 缓存，跳过无变化写入。
8. 增加性能模式 CSS class。
9. 实验 containment。
10. 评估是否需要 content-visibility 或 LOD。

## 最小可交付版本

如果只做一版最小但有效的优化，范围建议控制为：

- 新增性能诊断日志。
- 拆分卡片一次 setData。
- 合并并删除源卡片一次 setData。
- badge 加载 debounce + requestAnimationFrame。
- badge DOM 更新在同一次服务实例内跳过无变化节点。
- 设置页提供性能诊断开关和 badge 防抖时间。

这一版不触碰 Canvas transform、不做屏外卸载、不做位图快照，风险最低。

## 后续决策点

完成 P0 和 P1 后，再根据真实测试结果决定是否进入 P2/P3：

- 如果主要卡顿来自 Canvas-Loom 自身操作，继续优化插件即可。
- 如果关闭 Canvas-Loom 后 Obsidian Canvas 仍明显卡顿，则瓶颈在 Obsidian 原生渲染或其他插件。
- 如果用户强烈需要 Heptabase 级别体验，应考虑独立 Canvas 替代视图，而不是在当前插件内继续 monkey patch。
