import { Modal, Notice } from "obsidian";
import { CardService } from "../../services/CardService";

interface CardInfo {
  id: string;
  width: number;
  height: number;
  x: number;
  y: number;
  text: string;
  hasBadge: boolean;
  badgeContent?: string;
}

export class CardPropertiesModal extends Modal {
  private cards: any[];
  private cardService: CardService;
  private cardInfos: CardInfo[] = [];

  constructor(app: any, cards: any[], cardService: CardService) {
    super(app);
    this.cards = cards;
    this.cardService = cardService;
    this.processCardData();
  }

  private processCardData(): void {
    this.cardInfos = this.cards.map(card => {
      const data = card.getData();
      const textPreview = data.text ? 
        (data.text.length > 50 ? data.text.substring(0, 50) + "..." : data.text) : "";
      
      return {
        id: data.id,
        width: data.width,
        height: data.height,
        x: data.x,
        y: data.y,
        text: textPreview,
        hasBadge: !!data.badge,
        badgeContent: data.badge
      };
    });

    // 按位置排序（从上到下，从左到右）
    this.cardInfos.sort((a, b) => {
      if (Math.abs(a.y - b.y) > 10) {
        return a.y - b.y;
      }
      return a.x - b.x;
    });
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    
    // 标题
    contentEl.createEl("h2", { text: "批量卡片属性管理" });
    
    // 统计信息
    const statsDiv = contentEl.createDiv({ cls: "card-properties-stats" });
    this.createStatisticsSection(statsDiv);
    
    // 分隔线
    contentEl.createEl("hr");
    
    // 卡片列表
    const listDiv = contentEl.createDiv({ cls: "card-properties-list" });
    this.createCardList(listDiv);
    
    // 批量操作区域 - 只有在多卡片时才显示
    if (this.cardInfos.length > 1) {
      contentEl.createEl("hr");
      const actionsDiv = contentEl.createDiv({ cls: "card-properties-actions" });
      this.createBatchActions(actionsDiv);
    }
    
    // 复制功能区域
    contentEl.createEl("hr");
    const copyDiv = contentEl.createDiv({ cls: "card-properties-copy" });
    this.createCopySection(copyDiv);
    
    // 添加自定义样式
    this.addStyles();
  }

  private createStatisticsSection(container: HTMLElement): void {
    const stats = this.calculateStatistics();
    
    const statsContent = container.createDiv({ cls: "stats-content" });
    statsContent.innerHTML = `
      <div class="stat-item">
        <span class="stat-label">选中卡片数量：</span>
        <span class="stat-value">${stats.count}</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">尺寸范围：</span>
        <span class="stat-value">
          宽 ${stats.minWidth} - ${stats.maxWidth} px, 
          高 ${stats.minHeight} - ${stats.maxHeight} px
        </span>
      </div>
      <div class="stat-item">
        <span class="stat-label">平均尺寸：</span>
        <span class="stat-value">${stats.avgWidth} × ${stats.avgHeight} px</span>
      </div>
      <div class="stat-item">
        <span class="stat-label">位置范围：</span>
        <span class="stat-value">
          X: ${stats.minX} - ${stats.maxX}, 
          Y: ${stats.minY} - ${stats.maxY}
        </span>
      </div>
    `;
  }

  private createCardList(container: HTMLElement): void {
    const listContainer = container.createDiv({ cls: "cards-list-container" });
    
    // 创建表头
    const header = listContainer.createDiv({ cls: "card-item card-header" });
    header.innerHTML = `
      <span class="card-index">#</span>
      <span class="card-preview">预览</span>
      <span class="card-size">尺寸 (W×H)</span>
      <span class="card-position">位置 (X, Y)</span>
      <span class="card-badge">徽章</span>
    `;
    
    // 创建卡片项
    this.cardInfos.forEach((info, index) => {
      const item = listContainer.createDiv({ cls: "card-item" });
      
      // 索引
      const indexEl = item.createSpan({ cls: "card-index" });
      indexEl.setText(`${index + 1}`);
      
      // 文本预览
      const previewEl = item.createSpan({ cls: "card-preview" });
      previewEl.setText(info.text || "[空卡片]");
      previewEl.setAttribute("title", info.text || "空卡片");
      
      // 尺寸
      const sizeEl = item.createSpan({ cls: "card-size" });
      sizeEl.setText(`${info.width} × ${info.height}`);
      
      // 位置
      const posEl = item.createSpan({ cls: "card-position" });
      posEl.setText(`${info.x}, ${info.y}`);
      
      // 徽章
      const badgeEl = item.createSpan({ cls: "card-badge" });
      if (info.hasBadge) {
        badgeEl.setText(info.badgeContent || "");
        badgeEl.addClass("has-badge");
      } else {
        badgeEl.setText("-");
      }
    });
  }

  private createBatchActions(container: HTMLElement): void {
    const actionsTitle = container.createEl("h3", { text: "批量操作" });
    
    const buttonGroup = container.createDiv({ cls: "button-group" });
    
    // 统一为最小尺寸
    const minSizeBtn = buttonGroup.createEl("button", { text: "统一为最小尺寸" });
    minSizeBtn.addEventListener("click", async () => {
      await this.unifyToSize("min");
    });
    
    // 统一为最大尺寸
    const maxSizeBtn = buttonGroup.createEl("button", { text: "统一为最大尺寸" });
    maxSizeBtn.addEventListener("click", async () => {
      await this.unifyToSize("max");
    });
    
    // 统一为平均尺寸
    const avgSizeBtn = buttonGroup.createEl("button", { text: "统一为平均尺寸" });
    avgSizeBtn.addEventListener("click", async () => {
      const stats = this.calculateStatistics();
      await this.unifyToCustomSize(stats.avgWidth, stats.avgHeight);
    });
    
    // 自定义尺寸输入
    const customSizeDiv = container.createDiv({ cls: "custom-size-input" });
    customSizeDiv.createEl("h4", { text: "自定义尺寸" });
    
    const inputGroup = customSizeDiv.createDiv({ cls: "input-group" });
    
    const widthInput = inputGroup.createEl("input", {
      type: "number",
      placeholder: "宽度",
      attr: { min: "50", max: "2000" }
    });
    widthInput.style.width = "80px";
    
    inputGroup.createSpan({ text: " × " });
    
    const heightInput = inputGroup.createEl("input", {
      type: "number",
      placeholder: "高度",
      attr: { min: "50", max: "2000" }
    });
    heightInput.style.width = "80px";
    
    const applyCustomBtn = inputGroup.createEl("button", { 
      text: "应用",
      cls: "mod-cta"
    });
    
    applyCustomBtn.addEventListener("click", async () => {
      const width = parseInt(widthInput.value);
      const height = parseInt(heightInput.value);
      
      if (width && height) {
        await this.unifyToCustomSize(width, height);
      } else {
        new Notice("请输入有效的宽度和高度");
      }
    });
  }

  private createCopySection(container: HTMLElement): void {
    const copyDiv = container.createDiv({ cls: "copy-section" });
    copyDiv.createEl("h3", { text: "批量复制" });
    
    const copyButtons = copyDiv.createDiv({ cls: "copy-buttons" });
    
    // 复制所有卡片的尺寸信息
    const copyAllSizesBtn = copyButtons.createEl("button", {
      text: "复制所有卡片尺寸",
      cls: "copy-btn"
    });
    
    copyAllSizesBtn.addEventListener("click", async () => {
      const sizeList = this.cardInfos.map((card, index) => 
        `${index + 1}. ${card.width} × ${card.height} px`
      ).join('\n');
      
      const sizeInfo = `批量卡片尺寸 (${this.cardInfos.length}张):\n${sizeList}`;
      try {
        await navigator.clipboard.writeText(sizeInfo);
        new Notice("所有卡片尺寸已复制到剪贴板");
      } catch (error) {
        console.error("复制失败:", error);
        new Notice("复制失败，请重试");
      }
    });

    // 复制统计信息
    const copyStatsBtn = copyButtons.createEl("button", {
      text: "复制统计信息",
      cls: "copy-btn mod-cta"
    });
    
    copyStatsBtn.addEventListener("click", async () => {
      const stats = this.calculateStatistics();
      const statsInfo = `卡片统计信息:
数量: ${stats.count}张
尺寸范围: 宽 ${stats.minWidth}-${stats.maxWidth}px, 高 ${stats.minHeight}-${stats.maxHeight}px  
平均尺寸: ${stats.avgWidth} × ${stats.avgHeight}px
位置范围: X: ${stats.minX}-${stats.maxX}, Y: ${stats.minY}-${stats.maxY}`;

      try {
        await navigator.clipboard.writeText(statsInfo);
        new Notice("统计信息已复制到剪贴板");
      } catch (error) {
        console.error("复制失败:", error);
        new Notice("复制失败，请重试");
      }
    });
  }

  private calculateStatistics(): any {
    const widths = this.cardInfos.map(c => c.width);
    const heights = this.cardInfos.map(c => c.height);
    const xPositions = this.cardInfos.map(c => c.x);
    const yPositions = this.cardInfos.map(c => c.y);
    
    return {
      count: this.cardInfos.length,
      minWidth: Math.min(...widths),
      maxWidth: Math.max(...widths),
      avgWidth: Math.round(widths.reduce((a, b) => a + b, 0) / widths.length),
      minHeight: Math.min(...heights),
      maxHeight: Math.max(...heights),
      avgHeight: Math.round(heights.reduce((a, b) => a + b, 0) / heights.length),
      minX: Math.min(...xPositions),
      maxX: Math.max(...xPositions),
      minY: Math.min(...yPositions),
      maxY: Math.max(...yPositions)
    };
  }

  private async unifyToSize(size: "min" | "max"): Promise<void> {
    try {
      await this.cardService.unifyCardSizes(this.cards, size);
      this.close();
    } catch (error) {
      console.error("统一尺寸失败:", error);
      new Notice("统一尺寸失败: " + error.message);
    }
  }

  private async unifyToCustomSize(width: number, height: number): Promise<void> {
    try {
      await this.cardService.unifyCardSizes(this.cards, { width, height });
      new Notice(`已将所有卡片统一为 ${width}×${height}`);
      this.close();
    } catch (error) {
      console.error("统一尺寸失败:", error);
      new Notice("统一尺寸失败: " + error.message);
    }
  }

  // 原有的尺寸验证方法保留，用于兼容多卡片场景
  private validateSize(width: number, height: number): boolean {
    return width >= 50 && width <= 2000 && 
           height >= 50 && height <= 2000 && 
           !isNaN(width) && !isNaN(height);
  }

  private addStyles(): void {
    const style = document.createElement("style");
    style.textContent = `
      .card-properties-stats {
        margin-bottom: 20px;
        padding: 15px;
        background-color: var(--background-secondary);
        border-radius: 5px;
      }
      
      .stats-content {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 10px;
      }
      
      .stat-item {
        display: flex;
        justify-content: space-between;
      }
      
      .stat-label {
        color: var(--text-muted);
      }
      
      .stat-value {
        font-weight: bold;
      }
      
      .cards-list-container {
        max-height: 300px;
        overflow-y: auto;
        border: 1px solid var(--background-modifier-border);
        border-radius: 5px;
      }
      
      .card-item {
        display: grid;
        grid-template-columns: 30px 2fr 120px 120px 80px;
        gap: 10px;
        padding: 8px 12px;
        border-bottom: 1px solid var(--background-modifier-border);
        align-items: center;
      }
      
      .card-item:last-child {
        border-bottom: none;
      }
      
      .card-header {
        font-weight: bold;
        background-color: var(--background-secondary);
        position: sticky;
        top: 0;
      }
      
      .card-preview {
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      
      .card-badge.has-badge {
        color: var(--text-accent);
        font-weight: bold;
      }
      
      .button-group {
        display: flex;
        gap: 10px;
        margin: 15px 0;
      }
      
      .custom-size-input {
        margin-top: 20px;
      }
      
      .input-group {
        display: flex;
        align-items: center;
        gap: 10px;
        margin-top: 10px;
      }
      
      .mod-small {
        padding: 2px 8px;
        font-size: 12px;
      }
      
      .copy-section {
        padding: 15px 0;
      }
      
      .copy-section h3 {
        margin-bottom: 15px;
        font-size: 1.1em;
      }
      
      .copy-buttons {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      
      .copy-btn {
        padding: 8px 16px;
        text-align: left;
        border: 1px solid var(--background-modifier-border);
        border-radius: 4px;
        background-color: var(--background-primary);
        cursor: pointer;
        transition: background-color 0.2s;
      }
      
      .copy-btn:hover {
        background-color: var(--background-secondary);
      }
      
      .copy-btn.mod-cta {
        background-color: var(--interactive-accent);
        color: var(--text-on-accent);
        border-color: var(--interactive-accent);
      }
      
      .copy-btn.mod-cta:hover {
        background-color: var(--interactive-accent-hover);
      }
    `;
    
    document.head.appendChild(style);
    
    // 清理样式
    this.scope.register([], "cleanup-style", () => {
      style.remove();
    });
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}