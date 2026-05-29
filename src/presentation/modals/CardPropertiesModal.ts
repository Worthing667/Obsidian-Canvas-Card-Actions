import { App, Modal, Notice } from "obsidian";
import { CardService } from "../../services/CardService";
import { ClipboardAdapter } from "../../adapters/ClipboardAdapter";
import { PositionSortStrategy } from "../../domain/strategies/PositionSort";
import { validateDimension } from "../../utils/dimensionUtils";
import { extractErrorMessage } from "../../utils/errorUtils";
import type { CanvasNode, DimensionStats } from "../../types/canvas";
import { modalT } from "./modalI18n";

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
  private cards: CanvasNode[];
  private cardService: CardService;
  private cardInfos: CardInfo[] = [];
  private widthInput: HTMLInputElement;
  private heightInput: HTMLInputElement;
  private aspectToggle: HTMLInputElement;

  constructor(app: App, cards: CanvasNode[], cardService: CardService) {
    super(app);
    this.cards = cards;
    this.cardService = cardService;
    this.processCardData();
  }

  private processCardData(): void {
    this.cardInfos = this.cards.map(card => {
      const data = card.getData();
      const textPreview = data.text ? 
        (data.text.length > 40 ? data.text.substring(0, 40) + "..." : data.text) : "";
      
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
    const sorter = new PositionSortStrategy('yx', 10);
    this.cardInfos = sorter.sort(this.cardInfos);
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass("canvas-loom-card-properties-modal");
    
    // 标题
    contentEl.createEl("h2", { text: this.t("modal.properties.title") });
    contentEl.createDiv({
      cls: "cl-subtitle",
      text: this.t("modal.properties.subtitle", { count: this.cardInfos.length })
    });

    // 统计信息
    this.createStatisticsSection(contentEl);
    
    // 卡片列表 - 删除了"预览"标题
    this.createCardList(contentEl);
    
    // 批量操作区域 - 只有在多卡片时才显示
    if (this.cardInfos.length > 1) {
      this.createBatchActions(contentEl);
    }

    // 复制功能区域
    this.createCopySection(contentEl);
    
  }

  private createStatisticsSection(container: HTMLElement): void {
    const stats = this.calculateStatistics();

    const statsSection = container.createDiv({ cls: "cl-section cl-summary" });

    // 已选中
    const countItem = statsSection.createDiv({ cls: "summary-item" });
    countItem.createDiv({ cls: "summary-label", text: this.t("modal.properties.summary.selected") });
    countItem.createDiv({ cls: "summary-value", text: this.t("modal.properties.summary.selectedValue", { count: stats.count }) });
    countItem.createDiv({ cls: "summary-note", text: this.t("modal.properties.summary.sortedByPosition") });

    // 尺寸
    const sizeItem = statsSection.createDiv({ cls: "summary-item" });
    sizeItem.createDiv({ cls: "summary-label", text: this.t("modal.properties.summary.size") });
    sizeItem.createDiv({
      cls: "summary-value",
      text: this.t("modal.properties.summary.widthRange", { min: stats.minWidth, max: stats.maxWidth })
    });
    sizeItem.createDiv({
      cls: "summary-note",
      text: this.t("modal.properties.summary.heightAverage", {
        min: stats.minHeight,
        max: stats.maxHeight,
        avgWidth: stats.avgWidth,
        avgHeight: stats.avgHeight
      })
    });

    // 位置
    const positionItem = statsSection.createDiv({ cls: "summary-item" });
    positionItem.createDiv({ cls: "summary-label", text: this.t("modal.properties.summary.position") });
    positionItem.createDiv({ cls: "summary-value", text: `X ${stats.minX}–${stats.maxX}` });
    positionItem.createDiv({ cls: "summary-note", text: `Y ${stats.minY}–${stats.maxY}` });
  }

  private createCardList(container: HTMLElement): void {
    const tableContainer = container.createDiv({ cls: "cl-section cl-table-wrap" });

    // Section header
    const sectionHeader = tableContainer.createDiv({ cls: "cl-section-header" });
    sectionHeader.createEl("h3", { cls: "cl-section-title", text: this.t("modal.properties.list.title") });
    sectionHeader.createDiv({ cls: "cl-section-meta", text: this.t("modal.properties.list.meta", { count: this.cardInfos.length }) });
    
    // 创建表格
    const table = tableContainer.createEl("table");
    
    // 创建表头
    const thead = table.createEl("thead");
    const headerRow = thead.createEl("tr");
    
    headerRow.createEl("th", { text: "#", cls: "col-index" });
    headerRow.createEl("th", { text: this.t("modal.properties.list.preview"), cls: "col-preview" });
    headerRow.createEl("th", { text: this.t("modal.properties.list.size"), cls: "col-size" });
    headerRow.createEl("th", { text: this.t("modal.properties.list.position"), cls: "col-position" });
    headerRow.createEl("th", { text: this.t("modal.properties.list.badge"), cls: "col-badge" });
    
    // 创建表体
    const tbody = table.createEl("tbody");
    
    // 创建卡片项
    this.cardInfos.forEach((info, index) => {
      const row = tbody.createEl("tr");
      
      // 索引
      row.createEl("td", { text: (index + 1).toString(), cls: "col-index" });
      
      // 文本预览
      const previewCell = row.createEl("td", { cls: "col-preview" });
      const previewSpan = previewCell.createEl("span", { 
        cls: "preview-text",
        text: info.text || this.t("modal.common.emptyCard")
      });
      previewSpan.setAttribute("title", info.text || this.t("modal.common.emptyCardTitle"));
      
      // 尺寸
      row.createEl("td", { text: `${info.width}×${info.height}`, cls: "col-size" });
      
      // 位置
      row.createEl("td", { text: `${info.x},${info.y}`, cls: "col-position" });
      
      // 标记
      const badgeCell = row.createEl("td", { cls: "col-badge" });
      if (info.hasBadge) {
        badgeCell.createEl("span", { 
          cls: "badge",
          text: info.badgeContent || ""
        });
      } else {
        badgeCell.createEl("span", { cls: "empty-text", text: "—" });
      }
    });
  }

  private createBatchActions(container: HTMLElement): void {
    const operationsSection = container.createDiv({ cls: "cl-section" });

    // Section header
    const sectionHeader = operationsSection.createDiv({ cls: "cl-section-header" });
    sectionHeader.createEl("h3", { cls: "cl-section-title", text: this.t("modal.properties.batch.title") });
    sectionHeader.createDiv({ cls: "cl-section-meta", text: this.t("modal.properties.batch.meta") });

    // 尺寸预设
    operationsSection.createDiv({ cls: "editor-label", text: this.t("modal.properties.batch.presets") });
    const presetRow = operationsSection.createDiv({ cls: "preset-row" });

    const minSizeBtn = presetRow.createEl("button", { text: this.t("modal.properties.batch.minSize"), cls: "preset-btn" });
    const maxSizeBtn = presetRow.createEl("button", { text: this.t("modal.properties.batch.maxSize"), cls: "preset-btn" });
    const avgSizeBtn = presetRow.createEl("button", { text: this.t("modal.properties.batch.avgSize"), cls: "preset-btn" });

    // 自定义尺寸
    operationsSection.createDiv({ cls: "editor-label", text: this.t("modal.properties.batch.customSize") });
    const dimensionRow = operationsSection.createDiv({ cls: "dimension-row" });

    // 宽度
    const widthField = dimensionRow.createDiv({ cls: "field" });
    widthField.createEl("label", { text: this.t("modal.common.width") });
    const widthInputWrap = widthField.createDiv({ cls: "input-with-unit" });
    this.widthInput = widthInputWrap.createEl("input", {
      type: "number",
      value: "",
      attr: { min: "50", max: "2000", placeholder: this.t("modal.properties.batch.noChange") }
    });
    widthInputWrap.createSpan({ cls: "unit", text: "px" });

    // 高度
    const heightField = dimensionRow.createDiv({ cls: "field" });
    heightField.createEl("label", { text: this.t("modal.common.height") });
    const heightInputWrap = heightField.createDiv({ cls: "input-with-unit" });
    this.heightInput = heightInputWrap.createEl("input", {
      type: "number",
      value: "",
      attr: { min: "50", max: "2000", placeholder: this.t("modal.properties.batch.noChange") }
    });
    heightInputWrap.createSpan({ cls: "unit", text: "px" });

    // 锁定比例（与宽高同行）
    const aspectToggleLabel = dimensionRow.createEl("label", { cls: "ratio-toggle" });
    this.aspectToggle = aspectToggleLabel.createEl("input", { type: "checkbox" });
    aspectToggleLabel.createSpan({ cls: "ratio-icon", text: "🔗" });
    aspectToggleLabel.createSpan({ text: this.t("modal.common.aspectRatio") });

    // Hint
    operationsSection.createDiv({
      cls: "editor-hint",
      text: this.t("modal.properties.batch.hint")
    });

    // 预设按钮：只填输入框，不立即执行
    const fillInputs = (width: number, height: number) => {
      this.widthInput.value = width.toString();
      this.heightInput.value = height.toString();
    };

    minSizeBtn.addEventListener("click", () => {
      const stats = this.calculateStatistics();
      fillInputs(stats.minWidth, stats.minHeight);
    });

    maxSizeBtn.addEventListener("click", () => {
      const stats = this.calculateStatistics();
      fillInputs(stats.maxWidth, stats.maxHeight);
    });

    avgSizeBtn.addEventListener("click", () => {
      const stats = this.calculateStatistics();
      fillInputs(stats.avgWidth, stats.avgHeight);
    });

    // 宽高比逻辑
    const stats = this.calculateStatistics();
    const aspectRatio = stats.avgWidth / stats.avgHeight;
    this.setupAspectRatioLogic(aspectRatio);

    // 回车键支持
    [this.widthInput, this.heightInput].forEach((input) => {
      input.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
          void this.applyCustomSize();
        }
      });
    });
  }

  private setupAspectRatioLogic(initialAspectRatio: number): void {
    let aspectRatio = initialAspectRatio;

    // 宽高比锁定逻辑
    this.aspectToggle.addEventListener("change", () => {
      if (this.aspectToggle.checked) {
        const width = this.widthInput.value ? parseInt(this.widthInput.value) : null;
        const height = this.heightInput.value ? parseInt(this.heightInput.value) : null;
        
        if (width && height && height !== 0) {
          aspectRatio = width / height;
        } else if (!width && !height) {
          // 如果两个都为空，使用平均宽高比
          const stats = this.calculateStatistics();
          aspectRatio = stats.avgWidth / stats.avgHeight;
        }
      }
    });

    // 宽度输入监听器
    this.widthInput.addEventListener("input", () => {
      if (this.aspectToggle.checked) {
        const width = parseInt(this.widthInput.value);
        if (!isNaN(width) && width > 0) {
          const newHeight = Math.round(width / aspectRatio);
          this.heightInput.value = newHeight.toString();
        } else if (this.widthInput.value === "") {
          // 如果宽度被清空，也清空高度
          this.heightInput.value = "";
        }
      }
    });

    // 高度输入监听器
    this.heightInput.addEventListener("input", () => {
      if (this.aspectToggle.checked) {
        const height = parseInt(this.heightInput.value);
        if (!isNaN(height) && height > 0) {
          const newWidth = Math.round(height * aspectRatio);
          this.widthInput.value = newWidth.toString();
        } else if (this.heightInput.value === "") {
          // 如果高度被清空，也清空宽度
          this.widthInput.value = "";
        }
      }
    });
  }
  
  private createCopySection(container: HTMLElement): void {
    const actionFooter = container.createDiv({ cls: "cl-footer" });

    const footerLeft = actionFooter.createDiv({ cls: "footer-left" });

    const copyAllSizesBtn = footerLeft.createEl("button", {
      text: this.t("modal.properties.copy.size"),
      cls: "cl-btn cl-btn-secondary"
    });
    copyAllSizesBtn.addEventListener("click", () => {
      const sizeList = this.cardInfos.map((card, index) =>
        `${index + 1}. ${card.width} × ${card.height} px`
      ).join('\n');
      const sizeInfo = `${this.t("modal.properties.copy.sizeHeader", { count: this.cardInfos.length })}\n${sizeList}`;
      const clipboardAdapter = new ClipboardAdapter();
      void clipboardAdapter.writeTextWithNotice(sizeInfo, this.t("modal.properties.notice.sizesCopied"));
    });

    const copyStatsBtn = footerLeft.createEl("button", {
      text: this.t("modal.properties.copy.summary"),
      cls: "cl-btn cl-btn-secondary"
    });
    copyStatsBtn.addEventListener("click", () => {
      const stats = this.calculateStatistics();
      const statsInfo = [
        this.t("modal.properties.copy.statsHeader"),
        this.t("modal.properties.copy.statsCount", { count: stats.count }),
        this.t("modal.properties.copy.statsSizeRange", {
          minWidth: stats.minWidth,
          maxWidth: stats.maxWidth,
          minHeight: stats.minHeight,
          maxHeight: stats.maxHeight
        }),
        this.t("modal.properties.copy.statsAverage", {
          avgWidth: stats.avgWidth,
          avgHeight: stats.avgHeight
        }),
        this.t("modal.properties.copy.statsPositionRange", {
          minX: stats.minX,
          maxX: stats.maxX,
          minY: stats.minY,
          maxY: stats.maxY
        })
      ].join("\n");
      const clipboardAdapter = new ClipboardAdapter();
      void clipboardAdapter.writeTextWithNotice(statsInfo, this.t("modal.properties.notice.statsCopied"));
    });

    const footerRight = actionFooter.createDiv({ cls: "footer-right" });

    const cancelBtn = footerRight.createEl("button", {
      text: this.t("modal.common.cancel"),
      cls: "cl-btn cl-btn-ghost"
    });
    cancelBtn.addEventListener("click", () => this.close());

    const applyBtn = footerRight.createEl("button", {
      text: this.t("modal.common.applyChanges"),
      cls: "cl-btn cl-btn-primary"
    });
    applyBtn.addEventListener("click", () => {
      void this.applyCustomSize();
    });
  }

  private calculateStatistics(): DimensionStats {
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

  private async unifyToCustomSize(width: number, height: number): Promise<void> {
    try {
      await this.cardService.unifyCardSizes(this.cards, { width, height });
      new Notice(this.t("modal.properties.notice.unified", { width, height }));
      this.close();
    } catch (error) {
      console.error("Failed to resize cards:", error);
      const message = extractErrorMessage(error);
      new Notice(this.t("modal.properties.notice.unifyFailed", { message }));
    }
  }

  private async applyCustomSize(): Promise<void> {
    const widthValue = this.widthInput.value.trim();
    const heightValue = this.heightInput.value.trim();
    
    let width = widthValue ? parseInt(widthValue) : null;
    let height = heightValue ? parseInt(heightValue) : null;
    
    // 如果锁定宽高比，使用等比例调整逻辑
    if (this.aspectToggle.checked) {
      let aspectRatio: number;
      
      // 如果两个值都有，使用当前比例
      if (width && height) {
        aspectRatio = width / height;
      } else {
        // 否则使用选中卡片的平均宽高比
        const stats = this.calculateStatistics();
        aspectRatio = stats.avgWidth / stats.avgHeight;
      }
      
      if (width && !height) {
        // 只输入了宽度，计算高度
        height = Math.round(width / aspectRatio);
        this.heightInput.value = height.toString();
      } else if (height && !width) {
        // 只输入了高度，计算宽度
        width = Math.round(height * aspectRatio);
        this.widthInput.value = width.toString();
      } else if (!width && !height) {
        new Notice(this.t("modal.properties.notice.requireWidthOrHeight"));
        return;
      }
      
      // 验证计算后的值
      if (!width || !height || !this.validateDimension(width) || !this.validateDimension(height)) {
        new Notice(this.t("modal.properties.notice.calculatedOutOfRange"));
        return;
      }
      
      // 等比例调整所有卡片
      await this.unifyToCustomSize(width, height);
    } else {
      // 未锁定宽高比，支持单维度调整
      if (width && height) {
        // 同时输入宽度和高度：统一所有尺寸
        if (this.validateDimension(width) && this.validateDimension(height)) {
          await this.unifyToCustomSize(width, height);
        } else {
          new Notice(this.t("modal.properties.notice.sizeOutOfRange"));
        }
      } else if (width && !height) {
        // 只输入宽度：统一宽度，保持各自高度
        if (this.validateDimension(width)) {
          await this.unifyWidthOnly(width);
        } else {
          new Notice(this.t("modal.properties.notice.widthOutOfRange"));
        }
      } else if (!width && height) {
        // 只输入高度：统一高度，保持各自宽度
        if (this.validateDimension(height)) {
          await this.unifyHeightOnly(height);
        } else {
          new Notice(this.t("modal.properties.notice.heightOutOfRange"));
        }
      } else {
        // 都没输入
        new Notice(this.t("modal.properties.notice.enterSize"));
      }
    }
  }

  // 新增：只统一宽度的方法
  private async unifyWidthOnly(width: number): Promise<void> {
    try {
      await this.cardService.unifyCardWidth(this.cards, width);
      this.close();
    } catch (error) {
      console.error("Failed to update card widths:", error);
      const message = extractErrorMessage(error);
      new Notice(this.t("modal.properties.notice.widthFailed", { message }));
    }
  }

  // 新增：只统一高度的方法
  private async unifyHeightOnly(height: number): Promise<void> {
    try {
      await this.cardService.unifyCardHeight(this.cards, height);
      this.close();
    } catch (error) {
      console.error("Failed to update card heights:", error);
      const message = extractErrorMessage(error);
      new Notice(this.t("modal.properties.notice.heightFailed", { message }));
    }
  }

  private validateDimension(value: number): boolean {
    return validateDimension(value);
  }

  private t(key: Parameters<typeof modalT>[1], params?: Parameters<typeof modalT>[2]): string {
    return modalT(this.app, key, params);
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
