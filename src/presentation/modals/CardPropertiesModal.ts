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
    contentEl.createEl("h2", { text: "卡片属性查看器" });
    
    // 统计信息
    const statsDiv = contentEl.createDiv({ cls: "card-properties-stats" });
    this.createStatisticsSection(statsDiv);
    
    // 分隔线
    contentEl.createEl("hr");
    
    // 卡片列表
    const listDiv = contentEl.createDiv({ cls: "card-properties-list" });
    this.createCardList(listDiv);
    
    // 批量操作区域
    if (this.cardInfos.length >= 1) {
      contentEl.createEl("hr");
      const actionsDiv = contentEl.createDiv({ cls: "card-properties-actions" });
      this.createBatchActions(actionsDiv);
    }
    
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
      <span class="card-actions">操作</span>
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
      
      // 操作按钮 - 使用占位符替代原有的应用尺寸按钮
      const actionsEl = item.createSpan({ cls: "card-actions" });
      actionsEl.setText("-");
    });
  }

  private createBatchActions(container: HTMLElement): void {
    if (this.cardInfos.length === 1) {
      // 单卡片编辑模式
      this.createSingleCardEditor(container);
    } else {
      // 多卡片批量操作模式  
      this.createMultiCardBatchActions(container);
    }
  }

  private createSingleCardEditor(container: HTMLElement): void {
    const actionsTitle = container.createEl("h3", { text: "编辑卡片尺寸" });
    
    const currentCard = this.cardInfos[0];
    
    // 当前尺寸显示
    const currentSizeDiv = container.createDiv({ cls: "current-size-display" });
    currentSizeDiv.innerHTML = `
      <div class="size-info">
        <span class="size-label">当前尺寸：</span>
        <span class="size-value">${currentCard.width} × ${currentCard.height} px</span>
      </div>
    `;
    
    // 删除常用尺寸部分，直接进入自定义尺寸编辑
    
    // 自定义尺寸编辑 - 支持单独修改宽度或高度
    const customSizeDiv = container.createDiv({ cls: "custom-size-editor" });
    customSizeDiv.createEl("h4", { text: "自定义尺寸" });
    
    // 宽度编辑区域
    const widthSection = customSizeDiv.createDiv({ cls: "dimension-section" });
    widthSection.createEl("label", { text: "宽度 (px):" });
    
    const widthInputGroup = widthSection.createDiv({ cls: "input-group" });
    const widthInput = widthInputGroup.createEl("input", {
      type: "number",
      placeholder: `当前: ${currentCard.width}`,
      attr: { min: "50", max: "2000", step: "10" }
    });
    widthInput.style.width = "120px";
    
    const applyWidthBtn = widthInputGroup.createEl("button", {
      text: "应用宽度",
      cls: "mod-small"
    });
    
    const resetWidthBtn = widthInputGroup.createEl("button", {
      text: "重置",
      cls: "mod-small"
    });
    
    // 高度编辑区域
    const heightSection = customSizeDiv.createDiv({ cls: "dimension-section" });
    heightSection.createEl("label", { text: "高度 (px):" });
    
    const heightInputGroup = heightSection.createDiv({ cls: "input-group" });
    const heightInput = heightInputGroup.createEl("input", {
      type: "number",
      placeholder: `当前: ${currentCard.height}`,
      attr: { min: "50", max: "2000", step: "10" }
    });
    heightInput.style.width = "120px";
    
    const applyHeightBtn = heightInputGroup.createEl("button", {
      text: "应用高度",
      cls: "mod-small"
    });
    
    const resetHeightBtn = heightInputGroup.createEl("button", {
      text: "重置", 
      cls: "mod-small"
    });
    
    // 同时应用两个尺寸
    const bothDimensionsSection = customSizeDiv.createDiv({ cls: "both-dimensions-section" });
    const applyBothBtn = bothDimensionsSection.createEl("button", {
      text: "同时应用宽度和高度",
      cls: "mod-cta"
    });
    
    // 事件处理器
    applyWidthBtn.addEventListener("click", async () => {
      const width = parseInt(widthInput.value);
      if (this.validateDimension(width)) {
        await this.applySingleDimension("width", width);
      } else {
        new Notice("宽度值无效，请输入50-2000之间的数值");
      }
    });
    
    applyHeightBtn.addEventListener("click", async () => {
      const height = parseInt(heightInput.value);
      if (this.validateDimension(height)) {
        await this.applySingleDimension("height", height);
      } else {
        new Notice("高度值无效，请输入50-2000之间的数值");
      }
    });
    
    applyBothBtn.addEventListener("click", async () => {
      const width = widthInput.value ? parseInt(widthInput.value) : currentCard.width;
      const height = heightInput.value ? parseInt(heightInput.value) : currentCard.height;
      
      if (this.validateDimension(width) && this.validateDimension(height)) {
        await this.applySingleCardSize(width, height);
      } else {
        new Notice("尺寸值无效，请检查输入");
      }
    });
    
    resetWidthBtn.addEventListener("click", () => {
      widthInput.value = "";
      widthInput.placeholder = `当前: ${currentCard.width}`;
    });
    
    resetHeightBtn.addEventListener("click", () => {
      heightInput.value = "";
      heightInput.placeholder = `当前: ${currentCard.height}`;
    });
    
    // 键盘支持
    widthInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        applyWidthBtn.click();
      }
    });
    
    heightInput.addEventListener("keypress", (e) => {
      if (e.key === "Enter") {
        applyHeightBtn.click();
      }
    });
    
    // 实时验证输入
    widthInput.addEventListener("input", () => {
      const width = parseInt(widthInput.value);
      applyWidthBtn.disabled = !this.validateDimension(width);
      
      // 如果两个字段都有值，启用同时应用按钮
      const height = heightInput.value ? parseInt(heightInput.value) : currentCard.height;
      applyBothBtn.disabled = !(this.validateDimension(width) && this.validateDimension(height));
    });
    
    heightInput.addEventListener("input", () => {
      const height = parseInt(heightInput.value);
      applyHeightBtn.disabled = !this.validateDimension(height);
      
      // 如果两个字段都有值，启用同时应用按钮
      const width = widthInput.value ? parseInt(widthInput.value) : currentCard.width;
      applyBothBtn.disabled = !(this.validateDimension(width) && this.validateDimension(height));
    });
  }

  private createMultiCardBatchActions(container: HTMLElement): void {
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

  private async applyCardSize(width: number, height: number, sourceIndex: number): Promise<void> {
    try {
      // 获取除了源卡片外的其他卡片
      const targetCards = this.cards.filter((_, index) => index !== sourceIndex);
      
      if (targetCards.length === 0) {
        new Notice("没有其他卡片可以应用此尺寸");
        return;
      }
      
      await this.cardService.unifyCardSizes(targetCards, { width, height });
      new Notice(`已将 ${targetCards.length} 个卡片调整为 ${width}×${height}`);
      this.close();
    } catch (error) {
      console.error("应用尺寸失败:", error);
      new Notice("应用尺寸失败: " + error.message);
    }
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

  // 新增方法：应用单个维度的尺寸
  private async applySingleDimension(dimension: string, value: number): Promise<void> {
    try {
      const currentCard = this.cardInfos[0];
      const targetCard = this.cards[0];
      
      let newWidth: number, newHeight: number;
      
      if (dimension === "width") {
        newWidth = value;
        newHeight = currentCard.height; // 保持原有高度
      } else {
        newWidth = currentCard.width; // 保持原有宽度
        newHeight = value;
      }
      
      await this.cardService.unifyCardSizes([targetCard], { width: newWidth, height: newHeight });
      
      new Notice(`卡片${dimension === "width" ? "宽度" : "高度"}已更新为 ${value}px`);
      
      // 更新当前显示的信息
      this.updateCurrentCardInfo(newWidth, newHeight);
      
    } catch (error) {
      console.error("更新卡片尺寸失败:", error);
      new Notice("更新尺寸失败: " + error.message);
    }
  }

  // 更新当前卡片信息显示
  private updateCurrentCardInfo(newWidth: number, newHeight: number): void {
    this.cardInfos[0].width = newWidth;
    this.cardInfos[0].height = newHeight;
    
    // 更新当前尺寸显示
    const sizeValueEl = this.contentEl.querySelector(".size-value");
    if (sizeValueEl) {
      sizeValueEl.textContent = `${newWidth} × ${newHeight} px`;
    }
    
    // 更新输入框的占位符
    const widthInput = this.contentEl.querySelector('input[placeholder^="当前:"]') as HTMLInputElement;
    const heightInputs = this.contentEl.querySelectorAll('input[placeholder^="当前:"]');
    const heightInput = heightInputs.length > 1 ? heightInputs[1] as HTMLInputElement : null;
    
    if (widthInput) {
      widthInput.placeholder = `当前: ${newWidth}`;
    }
    if (heightInput) {
      heightInput.placeholder = `当前: ${newHeight}`;
    }
  }

  // 修改原有方法：支持部分尺寸应用
  private async applySingleCardSize(width: number, height: number): Promise<void> {
    try {
      if (!this.validateDimension(width) || !this.validateDimension(height)) {
        new Notice("尺寸值无效，请输入50-2000之间的数值");
        return;
      }
      
      const targetCard = this.cards[0];
      await this.cardService.unifyCardSizes([targetCard], { width, height });
      
      new Notice(`卡片尺寸已更新为 ${width}×${height}px`);
      this.close();
      
    } catch (error) {
      console.error("更新卡片尺寸失败:", error);
      new Notice("更新尺寸失败: " + error.message);
    }
  }

  // 新增方法：单个维度验证
  private validateDimension(value: number): boolean {
    return !isNaN(value) && value >= 50 && value <= 2000;
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
        grid-template-columns: 30px 2fr 120px 120px 80px 100px;
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
      
      /* 新增的单卡片编辑样式 */
      .current-size-display {
        margin-bottom: 20px;
        padding: 10px;
        background-color: var(--background-secondary);
        border-radius: 5px;
      }
      
      .size-info {
        display: flex;
        justify-content: space-between;
      }
      
      .size-label {
        color: var(--text-muted);
      }
      
      .size-value {
        font-weight: bold;
        color: var(--text-accent);
      }
      
      .dimension-section {
        margin-bottom: 15px;
      }
      
      .dimension-section label {
        display: block;
        margin-bottom: 5px;
        font-weight: bold;
      }
      
      .both-dimensions-section {
        margin-top: 20px;
        padding-top: 15px;
        border-top: 1px solid var(--background-modifier-border);
      }
      
      .custom-size-editor {
        margin-top: 20px;
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