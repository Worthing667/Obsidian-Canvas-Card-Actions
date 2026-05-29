import { Modal, Notice, App } from 'obsidian';
import { CardService } from '../../services/CardService';
import { validateDimension } from "../../utils/dimensionUtils";
import { extractErrorMessage } from "../../utils/errorUtils";
import { ClipboardAdapter } from '../../adapters/ClipboardAdapter';
import type { CanvasNode, CanvasNodeData } from '../../types/canvas';
import { modalT } from './modalI18n';

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
        contentEl.createEl("h2", { text: this.t("modal.singleProperties.title") });
        contentEl.createDiv({
          cls: "cl-subtitle",
          text: this.t("modal.singleProperties.subtitle")
        });

        this.createInfoSection(contentEl);

        if (this.cardData.text) {
            const previewSection = contentEl.createDiv({ cls: "cl-section" });
            const previewHeader = previewSection.createDiv({ cls: "cl-section-header" });
            previewHeader.createEl("h3", { cls: "cl-section-title", text: this.t("modal.singleProperties.previewTitle") });
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
        sizeItem.createDiv({ cls: "summary-label", text: this.t("modal.singleProperties.currentSize") });
        sizeItem.createDiv({ cls: "summary-value", text: `${this.cardData.width} × ${this.cardData.height} px` });
        sizeItem.lastElementChild?.setAttribute("id", "current-size");
        sizeItem.createDiv({ cls: "summary-note", text: this.t("modal.singleProperties.widthByHeight") });

        // 位置坐标
        const positionItem = statsSection.createDiv({ cls: "summary-item" });
        positionItem.createDiv({ cls: "summary-label", text: this.t("modal.singleProperties.positionCoordinates") });
        positionItem.createDiv({ cls: "summary-value", text: `X ${this.cardData.x}，Y ${this.cardData.y}` });
        positionItem.createDiv({ cls: "summary-note", text: this.t("modal.singleProperties.canvasCoordinates") });
    }

    private createDimensionEditor(container: HTMLElement) {
        const editorSection = container.createDiv({ cls: "cl-section" });

        const sectionHeader = editorSection.createDiv({ cls: "cl-section-header" });
        sectionHeader.createEl("h3", { cls: "cl-section-title", text: this.t("modal.singleProperties.resizeTitle") });

        const dimensionRow = editorSection.createDiv({ cls: "dimension-row" });

        // 宽度
        const widthField = dimensionRow.createDiv({ cls: "field" });
        widthField.createEl("label", { text: this.t("modal.common.width") });
        const widthInputWrap = widthField.createDiv({ cls: "input-with-unit" });
        this.widthInput = widthInputWrap.createEl("input", {
            type: "number",
            value: this.cardData.width.toString(),
            attr: { min: "50", max: "2000" }
        });
        widthInputWrap.createSpan({ cls: "unit", text: "px" });

        // 高度
        const heightField = dimensionRow.createDiv({ cls: "field" });
        heightField.createEl("label", { text: this.t("modal.common.height") });
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
        aspectToggleLabel.createSpan({ text: this.t("modal.common.aspectRatio") });

        // Hint
        editorSection.createDiv({
            cls: "editor-hint",
            text: this.t("modal.singleProperties.hint")
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
            text: this.t("modal.singleProperties.copySize"),
            cls: "cl-btn cl-btn-secondary"
        });
        copySizeBtn.addEventListener("click", () => {
            const sizeInfo = this.t("modal.singleProperties.clipboardSize", {
                width: this.cardData.width,
                height: this.cardData.height
            });
            void this.clipboardAdapter.writeTextWithNotice(sizeInfo, this.t("modal.singleProperties.notice.sizeCopied"));
        });

        const copyPosBtn = footerLeft.createEl("button", {
            text: this.t("modal.singleProperties.copyPosition"),
            cls: "cl-btn cl-btn-secondary"
        });
        copyPosBtn.addEventListener("click", () => {
            const posInfo = this.t("modal.singleProperties.clipboardPosition", {
                x: this.cardData.x,
                y: this.cardData.y
            });
            void this.clipboardAdapter.writeTextWithNotice(posInfo, this.t("modal.singleProperties.notice.positionCopied"));
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
            new Notice(this.t("modal.singleProperties.notice.sizeUpdated", { width, height }));
            this.close();
        } catch (error) {
            console.error("Failed to update card size:", error);
            const message = extractErrorMessage(error);
            new Notice(this.t("modal.singleProperties.notice.updateFailed", { message }));
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

    private t(key: Parameters<typeof modalT>[1], params?: Parameters<typeof modalT>[2]): string {
        return modalT(this.app, key, params);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
