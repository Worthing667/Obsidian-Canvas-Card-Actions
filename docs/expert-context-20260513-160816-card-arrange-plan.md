# Expert Context Pack: 一键排列卡片功能方案审查

Generated at: 2026-05-13
Purpose: review_plan
Target model: auto

## User Goal

在 Canvas 插件的卡片属性管理器（CardPropertiesModal）中增加「一键排列卡片」功能：选中多张卡片后，按指定方向、间距、顺序自动重新排列卡片在画布上的位置。

## Question for Expert

请审视这个方案是否合理，是否有遗漏，是否有更优设计。重点关注：
1. 架构设计：arrangeCards 放在 CardService 是否合适？UI 放在 CardPropertiesModal 是否合适？
2. 参数设计：direction/spacing/sortPriority 三个参数是否足够？是否有边界情况遗漏？
3. 与现有代码模式的一致性：是否很好地复用了 PositionSortStrategy 和 getData/setData 模式？

## Project Background

- TypeScript Obsidian Canvas 插件，约 4.7k 行
- 分层架构：适配器 → 领域 → 服务 → 表现层
- Canvas 数据读写走 CanvasAdapter：getData() → 内存修改 → setData() → requestSave()
- 排序策略：PositionSortStrategy（yx / xy + 容差）
- 已有设置：sortPriority (yx|xy) 控制全局排序偏好

## Plan Summary

### CardService 新增方法

```typescript
arrangeCards(nodes: CanvasNode[], options: {
    direction: 'horizontal' | 'vertical';
    spacing: number;
    sortPriority: 'yx' | 'xy';
}): Promise<void>
```

逻辑：PositionSortStrategy 排序 → 以第一张为锚点 → 按方向逐张计算新坐标 → getData/setData 写回

### CardPropertiesModal 新增 UI

在"批量调整"section 下方新增"一键排列"section：
- 排列方向：下拉（水平/垂直）
- 卡片间距：number input，0-500，默认20px
- 排列顺序：下拉 yx/xy，默认取 settings.sortPriority
- "排列卡片"按钮
- 仅 ≥2 张卡片时显示

## Key Code Context

### 现有的数据写回模式 (CardService.ts:265-310)
```typescript
const canvasData = this.canvasAdapter.getData();
textNodes.forEach(node => {
    const nodeData = canvasData.nodes.find(n => n.id === node.id);
    if (nodeData) {
        if (targetWidth !== undefined) nodeData.width = targetWidth;
        if (targetHeight !== undefined) nodeData.height = targetHeight;
    }
});
await this.canvasAdapter.setData(canvasData);
await this.canvasAdapter.requestSave();
```

### PositionSortStrategy (domain/strategies/PositionSort.ts)
yx: 优先按y排序(容差10px)，再按x
xy: 优先按x排序(容差10px)，再按y

### CardPropertiesModal 现有结构
- 标题 + 统计区 + 卡片列表表格 + 批量调整区(尺寸预设/自定义尺寸) + 底部操作区
- 批量调整区只在 cardInfos.length > 1 时显示
- 所有 button 用 addEventListener 绑定事件

### CardService 接口 (ICardService)
已有：splitCard, createCardsFromContent, unifyCardSizes, unifyCardWidth, unifyCardHeight

### 设置接口 (ICanvasLoomSettings)
已有 sortPriority 字段用作全局默认排序偏好

## Constraints

- 不改动 Canvas API 底层
- 不新增依赖
- 保持中文 UI 文案风格
- 尺寸调整逻辑不变
- 与现有 section 样式体系一致

## Security Check

已确认没有包含 API key、token、cookie、密码、私钥、数据库连接串、.env 内容或用户隐私数据。
