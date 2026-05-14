import { Modal, Notice, App } from 'obsidian';
import { CardService } from '../../services/CardService';
import { validateDimension } from "../../utils/dimensionUtils";
import { ClipboardAdapter } from '../../adapters/ClipboardAdapter';
import type { CanvasNode, CanvasNodeData } from '../../types/canvas';

export class SingleCardPropertiesModal extends Modal {
    private card: CanvasNode;
    private cardService: CardService;
    private clipboardAdapter: ClipboardAdapter;
    private cardData: CanvasNodeData;
    private widthInput: HTMLInputElement | null = null;
    private heightInput: HTMLInputElement | null = null;

    constructor(app: App, card: CanvasNode, cardService: CardService, clipboardAdapter: ClipboardAdapter) {
        super(app);
        this.card = card;
        this.cardService = cardService;
        this.clipboardAdapter = clipboardAdapter;
        this.cardData = card.getData();
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("canvas-loom-single-card-properties-modal");
        contentEl.createEl("h2", { text: "卡片属性" });
        contentEl.createDiv({
          cls: "cl-subtitle",
          text: "查看并调整当前卡片的尺寸。"
        });

        this.createInfoSection(contentEl);

        if (this.cardData.text) {
            const previewSection = contentEl.createDiv({ cls: "cl-section" });
            const previewHeader = previewSection.createDiv({ cls: "cl-section-header" });
            previewHeader.createEl("h3", { cls: "cl-section-title", text: "内容预览" });
            const previewContent = previewSection.createDiv({ cls: "preview-box" });
            const previewText = this.cardData.text.length > 150
                ? this.cardData.text.substring(0, 150) + "..."
                : this.cardData.text;
            previewContent.textContent = previewText;
        }

        this.createDimensionEditor(contentEl);
        this.createCopySection(contentEl);

    }

    private createInfoSection(container: HTMLElement) {
        const statsSection = container.createDiv({ cls: "cl-section cl-summary cl-summary--two-column" });

        // 当前尺寸
        const sizeItem = statsSection.createDiv({ cls: "summary-item" });
        sizeItem.createDiv({ cls: "summary-label", text: "当前尺寸" });
        sizeItem.createDiv({ cls: "summary-value", text: `${this.cardData.width} × ${this.cardData.height} px` });
        sizeItem.lastElementChild?.setAttribute("id", "current-size");
        sizeItem.createDiv({ cls: "summary-note", text: "宽度 × 高度" });

        // 位置坐标
        const positionItem = statsSection.createDiv({ cls: "summary-item" });
        positionItem.createDiv({ cls: "summary-label", text: "位置坐标" });
        positionItem.createDiv({ cls: "summary-value", text: `X ${this.cardData.x}，Y ${this.cardData.y}` });
        positionItem.createDiv({ cls: "summary-note", text: "画布坐标" });
    }

    private createDimensionEditor(container: HTMLElement) {
        const editorSection = container.createDiv({ cls: "cl-section" });

        const sectionHeader = editorSection.createDiv({ cls: "cl-section-header" });
        sectionHeader.createEl("h3", { cls: "cl-section-title", text: "尺寸调整" });

        const dimensionRow = editorSection.createDiv({ cls: "dimension-row" });

        // 宽度
        const widthField = dimensionRow.createDiv({ cls: "field" });
        widthField.createEl("label", { text: "宽度" });
        const widthInputWrap = widthField.createDiv({ cls: "input-with-unit" });
        this.widthInput = widthInputWrap.createEl("input", {
            type: "number",
            value: this.cardData.width.toString(),
            attr: { min: "50", max: "2000" }
        });
        widthInputWrap.createSpan({ cls: "unit", text: "px" });

        // 高度
        const heightField = dimensionRow.createDiv({ cls: "field" });
        heightField.createEl("label", { text: "高度" });
        const heightInputWrap = heightField.createDiv({ cls: "input-with-unit" });
        this.heightInput = heightInputWrap.createEl("input", {
            type: "number",
            value: this.cardData.height.toString(),
            attr: { min: "50", max: "2000" }
        });
        heightInputWrap.createSpan({ cls: "unit", text: "px" });

        // 锁定比例
        const aspectToggleLabel = dimensionRow.createEl("label", { cls: "ratio-toggle" });
        const aspectToggle = aspectToggleLabel.createEl("input", { type: "checkbox" });
        aspectToggleLabel.createSpan({ cls: "ratio-icon", text: "🔗" });
        aspectToggleLabel.createSpan({ text: "锁定比例" });

        // Hint
        editorSection.createDiv({
            cls: "editor-hint",
            text: "调整后点击「应用更改」写入 Canvas。"
        });

        const widthInput = this.widthInput;
        const heightInput = this.heightInput;
        if (!widthInput || !heightInput) {
            return;
        }

        let aspectRatio = this.cardData.width / this.cardData.height;

        aspectToggle.addEventListener("change", () => {
            if (aspectToggle.checked) {
                const width = parseInt(widthInput.value);
                const height = parseInt(heightInput.value);
                if (!isNaN(width) && !isNaN(height) && height !== 0) {
                    aspectRatio = width / height;
                }
            }
        });

        widthInput.addEventListener("input", () => {
            if (aspectToggle.checked) {
                const width = parseInt(widthInput.value);
                if (!isNaN(width)) {
                    const newHeight = Math.round(width / aspectRatio);
                    heightInput.value = newHeight.toString();
                }
            }
        });

        heightInput.addEventListener("input", () => {
            if (aspectToggle.checked) {
                const height = parseInt(heightInput.value);
                if (!isNaN(height) && height !== 0) {
                    const newWidth = Math.round(height * aspectRatio);
                    widthInput.value = newWidth.toString();
                }
            }
        });

        // 回车键应用更改
        [widthInput, heightInput].forEach((input) => {
            input.addEventListener("keypress", (e: KeyboardEvent) => {
                if (e.key === "Enter") {
                    const width = parseInt(widthInput.value);
                    const height = parseInt(heightInput.value);
                    if (this.validateDimension(width) && this.validateDimension(height)) {
                        void this.updateBothDimensions(width, height);
                    }
                }
            });
        });
    }

    private createCopySection(container: HTMLElement) {
        const actionFooter = container.createDiv({ cls: "cl-footer" });

        const footerLeft = actionFooter.createDiv({ cls: "footer-left" });

        const copySizeBtn = footerLeft.createEl("button", {
            text: "复制尺寸",
            cls: "cl-btn cl-btn-secondary"
        });
        copySizeBtn.addEventListener("click", () => {
            const sizeInfo = `卡片尺寸: ${this.cardData.width} × ${this.cardData.height} px`;
            void this.clipboardAdapter.writeTextWithNotice(sizeInfo, "尺寸信息已复制到剪贴板");
        });

        const copyPosBtn = footerLeft.createEl("button", {
            text: "复制位置",
            cls: "cl-btn cl-btn-secondary"
        });
        copyPosBtn.addEventListener("click", () => {
            const posInfo = `卡片位置: X: ${this.cardData.x}, Y: ${this.cardData.y}`;
            void this.clipboardAdapter.writeTextWithNotice(posInfo, "位置信息已复制到剪贴板");
        });

        const footerRight = actionFooter.createDiv({ cls: "footer-right" });

        const cancelBtn = footerRight.createEl("button", {
            text: "取消",
            cls: "cl-btn cl-btn-ghost"
        });
        cancelBtn.addEventListener("click", () => this.close());

        const applyBtn = footerRight.createEl("button", {
            text: "应用更改",
            cls: "cl-btn cl-btn-primary"
        });
        applyBtn.addEventListener("click", () => {
            const widthInput = this.widthInput;
            const heightInput = this.heightInput;

            if (widthInput && heightInput) {
                const width = parseInt(widthInput.value);
                const height = parseInt(heightInput.value);

                if (this.validateDimension(width) && this.validateDimension(height)) {
                    void this.updateBothDimensions(width, height);
                }
            }
        });
    }

    private async updateBothDimensions(width: number, height: number) {
        try {
            await this.cardService.unifyCardSizes([this.card], { width, height });
            this.cardData.width = width;
            this.cardData.height = height;
            this.updateSizeDisplay();
            new Notice(`卡片尺寸已更新为 ${width}×${height}px`);
            this.close();
        } catch (error) {
            console.error("更新尺寸失败:", error);
            const message = error instanceof Error ? error.message : String(error);
            new Notice("更新失败: " + message);
        }
    }

    private updateSizeDisplay() {
        const sizeEl = this.contentEl.querySelector("#current-size");
        if (sizeEl) {
            sizeEl.textContent = `${this.cardData.width} × ${this.cardData.height} px`;
        }
    }

    private validateDimension(value: number): boolean {
        return validateDimension(value);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
