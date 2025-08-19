import { Modal, Notice } from "obsidian";
import { CardService } from "../../services/CardService";
import { ClipboardAdapter } from "../../adapters/ClipboardAdapter";

export class SingleCardPropertiesModal extends Modal {
  private card: any;
  private cardService: CardService;
  private clipboardAdapter: ClipboardAdapter;
  private cardData: any;

  constructor(app: any, card: any, cardService: CardService, clipboardAdapter: ClipboardAdapter) {
    super(app);
    this.card = card;
    this.cardService = cardService;
    this.clipboardAdapter = clipboardAdapter;
    this.cardData = card.getData();
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    
    // 简洁的标题
    contentEl.createEl("h2", { text: "卡片属性" });
    
    // 当前信息显示
    this.createInfoSection(contentEl);
    
    contentEl.createEl("hr");

    // 尺寸编辑区域
    this.createDimensionEditor(contentEl);
    
    contentEl.createEl("hr");
    
    // 复制功能区域
    this.createCopySection(contentEl);
    
    this.addStyles();
  }

  private createInfoSection(container: HTMLElement): void {
    const infoDiv = container.createDiv({ cls: "card-info-section" });
    
    const basicInfo = infoDiv.createDiv({ cls: "basic-info" });
    basicInfo.innerHTML = `
      <div class="info-row">
        <span class="info-label">尺寸：</span>
        <span class="info-value" id="current-size">${this.cardData.width} × ${this.cardData.height} px</span>
      </div>
      <div class="info-row">
        <span class="info-label">位置：</span>
        <span class="info-value">X: ${this.cardData.x}, Y: ${this.cardData.y}</span>
      </div>
    `;

    if (this.cardData.badge) {
      const badgeInfo = basicInfo.createDiv({ cls: "info-row" });
      badgeInfo.innerHTML = `
        <span class="info-label">徽章：</span>
        <span class="info-value badge-display">${this.cardData.badge}</span>
      `;
    }

    if (this.cardData.text) {
      const previewDiv = infoDiv.createDiv({ cls: "content-preview" });
      const previewText = this.cardData.text.length > 150 
        ? this.cardData.text.substring(0, 150) + "..." 
        : this.cardData.text;
      previewDiv.innerHTML = `
        <div class="preview-label">内容预览：</div>
        <div class="preview-text">${previewText}</div>
      `;
    }
  }

  private createDimensionEditor(container: HTMLElement): void {
    const editorDiv = container.createDiv({ cls: "dimension-editor" });
    
    // 宽度编辑
    const widthSection = editorDiv.createDiv({ cls: "dimension-section" });
    const widthLabel = widthSection.createEl("label", { text: "宽度 (px)" });
    
    const widthControls = widthSection.createDiv({ cls: "dimension-controls" });
    const widthInput = widthControls.createEl("input", {
      type: "number",
      value: this.cardData.width.toString(),
      attr: { min: "50", max: "2000", step: "10" }
    });
    
    const widthButtons = widthControls.createDiv({ cls: "dimension-buttons" });
    const applyWidthBtn = widthButtons.createEl("button", { text: "应用", cls: "mod-cta mod-small" });
    const resetWidthBtn = widthButtons.createEl("button", { text: "重置", cls: "mod-small" });
    
    // 高度编辑
    const heightSection = editorDiv.createDiv({ cls: "dimension-section" });
    const heightLabel = heightSection.createEl("label", { text: "高度 (px)" });
    
    const heightControls = heightSection.createDiv({ cls: "dimension-controls" });
    const heightInput = heightControls.createEl("input", {
      type: "number", 
      value: this.cardData.height.toString(),
      attr: { min: "50", max: "2000", step: "10" }
    });
    
    const heightButtons = heightControls.createDiv({ cls: "dimension-buttons" });
    const applyHeightBtn = heightButtons.createEl("button", { text: "应用", cls: "mod-cta mod-small" });
    const resetHeightBtn = heightButtons.createEl("button", { text: "重置", cls: "mod-small" });
    
    // 同时应用按钮
    const applyBothDiv = editorDiv.createDiv({ cls: "apply-both-section" });
    const applyBothBtn = applyBothDiv.createEl("button", {
      text: "应用宽度和高度",
      cls: "mod-cta apply-both-btn"
    });

    // 事件处理
    applyWidthBtn.addEventListener("click", async () => {
      const width = parseInt(widthInput.value);
      if (this.validateDimension(width)) {
        await this.updateDimension("width", width);
      }
    });

    applyHeightBtn.addEventListener("click", async () => {
      const height = parseInt(heightInput.value);
      if (this.validateDimension(height)) {
        await this.updateDimension("height", height);
      }
    });

    applyBothBtn.addEventListener("click", async () => {
      const width = parseInt(widthInput.value);
      const height = parseInt(heightInput.value);
      if (this.validateDimension(width) && this.validateDimension(height)) {
        await this.updateBothDimensions(width, height);
      }
    });

    resetWidthBtn.addEventListener("click", () => {
      widthInput.value = this.cardData.width.toString();
    });

    resetHeightBtn.addEventListener("click", () => {
      heightInput.value = this.cardData.height.toString();
    });

    // 键盘支持
    [widthInput, heightInput].forEach(input => {
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          applyBothBtn.click();
        }
      });
    });
  }

  private async updateDimension(dimension: string, value: number): Promise<void> {
    try {
      const newWidth = dimension === "width" ? value : this.cardData.width;
      const newHeight = dimension === "height" ? value : this.cardData.height;
      
      await this.cardService.unifyCardSizes([this.card], { width: newWidth, height: newHeight });
      
      // 更新本地数据和显示
      this.cardData.width = newWidth;
      this.cardData.height = newHeight;
      this.updateSizeDisplay();
      
      new Notice(`卡片${dimension === "width" ? "宽度" : "高度"}已更新为 ${value}px`);
      
    } catch (error) {
      console.error("更新尺寸失败:", error);
      new Notice("更新失败: " + error.message);
    }
  }

  private async updateBothDimensions(width: number, height: number): Promise<void> {
    try {
      await this.cardService.unifyCardSizes([this.card], { width, height });
      
      this.cardData.width = width;
      this.cardData.height = height;
      this.updateSizeDisplay();
      
      new Notice(`卡片尺寸已更新为 ${width}×${height}px`);
      this.close();
      
    } catch (error) {
      console.error("更新尺寸失败:", error);
      new Notice("更新失败: " + error.message);
    }
  }

  private updateSizeDisplay(): void {
    const sizeEl = this.contentEl.querySelector("#current-size");
    if (sizeEl) {
      sizeEl.textContent = `${this.cardData.width} × ${this.cardData.height} px`;
    }
  }

  private validateDimension(value: number): boolean {
    return !isNaN(value) && value >= 50 && value <= 2000;
  }

  private createCopySection(container: HTMLElement): void {
    const copyDiv = container.createDiv({ cls: "copy-section" });
    copyDiv.createEl("h3", { text: "复制选项" });
    
    const copyButtons = copyDiv.createDiv({ cls: "copy-buttons" });
    
    // 复制尺寸信息
    const copySizeBtn = copyButtons.createEl("button", {
      text: "复制尺寸信息",
      cls: "copy-btn"
    });
    
    copySizeBtn.addEventListener("click", async () => {
      const sizeInfo = `卡片尺寸: ${this.cardData.width} × ${this.cardData.height} px`;
      try {
        await navigator.clipboard.writeText(sizeInfo);
        new Notice("尺寸信息已复制到剪贴板");
      } catch (error) {
        console.error("复制失败:", error);
        new Notice("复制失败，请重试");
      }
    });

    // 复制位置信息
    const copyPosBtn = copyButtons.createEl("button", {
      text: "复制位置信息", 
      cls: "copy-btn"
    });
    
    copyPosBtn.addEventListener("click", async () => {
      const posInfo = `卡片位置: X: ${this.cardData.x}, Y: ${this.cardData.y}`;
      try {
        await navigator.clipboard.writeText(posInfo);
        new Notice("位置信息已复制到剪贴板");
      } catch (error) {
        console.error("复制失败:", error);
        new Notice("复制失败，请重试");
      }
    });

    // 复制完整属性
    const copyAllBtn = copyButtons.createEl("button", {
      text: "复制完整属性",
      cls: "copy-btn mod-cta"
    });
    
    copyAllBtn.addEventListener("click", async () => {
      let fullInfo = `卡片属性:
尺寸: ${this.cardData.width} × ${this.cardData.height} px
位置: X: ${this.cardData.x}, Y: ${this.cardData.y}`;

      if (this.cardData.badge) {
        fullInfo += `\n徽章: ${this.cardData.badge}`;
      }

      if (this.cardData.text) {
        fullInfo += `\n内容: ${this.cardData.text.substring(0, 100)}${this.cardData.text.length > 100 ? "..." : ""}`;
      }

      try {
        await navigator.clipboard.writeText(fullInfo);
        new Notice("完整属性信息已复制到剪贴板");
      } catch (error) {
        console.error("复制失败:", error);
        new Notice("复制失败，请重试");
      }
    });
  }

  private addStyles(): void {
    const style = document.createElement("style");
    style.textContent = `
      .card-info-section {
        background-color: var(--background-secondary);
        padding: 15px;
        border-radius: 5px;
        margin-bottom: 15px;
      }
      
      .basic-info {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }
      
      .info-row {
        display: flex;
        justify-content: space-between;
        align-items: center;
      }
      
      .info-label {
        color: var(--text-muted);
        font-size: 0.9em;
        min-width: 60px;
      }
      
      .info-value {
        font-weight: 500;
        text-align: right;
      }
      
      .badge-display {
        color: var(--text-accent);
        background-color: var(--background-modifier-accent);
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 0.85em;
      }
      
      .content-preview {
        margin-top: 15px;
        padding-top: 15px;
        border-top: 1px solid var(--background-modifier-border);
      }
      
      .preview-label {
        font-size: 0.9em;
        color: var(--text-muted);
        margin-bottom: 8px;
      }
      
      .preview-text {
        font-size: 0.95em;
        line-height: 1.4;
        color: var(--text-normal);
      }
      
      .dimension-editor {
        display: flex;
        flex-direction: column;
        gap: 20px;
      }
      
      .dimension-section {
        padding: 15px;
        border: 1px solid var(--background-modifier-border);
        border-radius: 5px;
      }
      
      .dimension-section label {
        display: block;
        margin-bottom: 10px;
        font-weight: 500;
      }
      
      .dimension-controls {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      
      .dimension-controls input {
        width: 120px;
        padding: 5px 8px;
      }
      
      .dimension-buttons {
        display: flex;
        gap: 5px;
      }
      
      .apply-both-section {
        text-align: center;
        padding-top: 15px;
        border-top: 1px solid var(--background-modifier-border);
      }
      
      .apply-both-btn {
        padding: 10px 30px;
        font-size: 1em;
      }
      
      .mod-small {
        padding: 4px 12px;
        font-size: 0.9em;
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
    
    this.scope.register([], "cleanup-style", () => {
      style.remove();
    });
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}