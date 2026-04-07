import { Modal, Notice, App } from 'obsidian';
import { CardService } from '../../services/CardService';
import { validateDimension } from "../../utils/dimensionUtils";
import { ClipboardAdapter } from '../../adapters/ClipboardAdapter';
import { ModalStyleManager } from '../styles/ModalStyles';

export class SingleCardPropertiesModal extends Modal {
    private card: any;
    private cardService: CardService;
    private clipboardAdapter: ClipboardAdapter;
    private cardData: any;

    constructor(app: App, card: any, cardService: CardService, clipboardAdapter: ClipboardAdapter) {
        super(app);
        this.card = card;
        this.cardService = cardService;
        this.clipboardAdapter = clipboardAdapter;
        this.cardData = card.getData();
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.createEl("h2", { text: "管理卡片属性" });

        this.createInfoSection(contentEl);
        this.createDimensionEditor(contentEl);
        
        // 只有当卡片有内容时才显示内容预览
        if (this.cardData.text) {
            const previewSection = contentEl.createDiv({ cls: "card-preview-section" });
            previewSection.createEl("h3", { cls: "card-section-title", text: "内容预览" });
            const previewContent = previewSection.createDiv({ cls: "card-preview-content" });
            const previewText = this.cardData.text.length > 150 
                ? this.cardData.text.substring(0, 150) + "..." 
                : this.cardData.text;
            previewContent.textContent = previewText;
        }
        
        this.createCopySection(contentEl);
        
        this.addStyles();
    }

    private createInfoSection(container: HTMLElement) {
        // 创建统计信息区域
        const statsSection = container.createDiv({ cls: "cca-stats-section" });
        const statsGrid = statsSection.createDiv({ cls: "cca-grid-cols-2" });

        // 当前尺寸统计
        const sizeItem = statsGrid.createDiv({ cls: "cca-stat-item" });
        sizeItem.innerHTML = `
            <div class="cca-stat-label">当前尺寸</div>
            <div class="cca-stat-value" id="current-size">${this.cardData.width} × ${this.cardData.height}</div>
            <div class="cca-stat-detail">像素</div>
        `;

        // 位置坐标统计
        const positionItem = statsGrid.createDiv({ cls: "cca-stat-item" });
        positionItem.innerHTML = `
            <div class="cca-stat-label">位置坐标</div>
            <div class="cca-stat-value">X: ${this.cardData.x}, Y: ${this.cardData.y}</div>
            <div class="cca-stat-detail">Canvas坐标</div>
        `;

    }

    private createDimensionEditor(container: HTMLElement) {
        const editorSection = container.createDiv({ cls: "cca-stats-section" });
        editorSection.createEl("h3", { cls: "cca-section-title", text: "尺寸调整" });

        // 尺寸控制区域
        const dimensionControls = editorSection.createDiv({ cls: "cca-grid-cols-2" });

        // 宽度控制
        const widthGroup = dimensionControls.createDiv({ cls: "cca-control-group" });
        widthGroup.createEl("label", { text: "宽度 (px)" });
        const widthInput = widthGroup.createEl("input", {
            type: "number",
            value: this.cardData.width.toString(),
            attr: { min: "50", max: "2000" }
        }) as HTMLInputElement;

        // 高度控制
        const heightGroup = dimensionControls.createDiv({ cls: "cca-control-group" });
        heightGroup.createEl("label", { text: "高度 (px)" });
        const heightInput = heightGroup.createEl("input", {
            type: "number",
            value: this.cardData.height.toString(),
            attr: { min: "50", max: "2000" }
        }) as HTMLInputElement;

        // 宽高比锁定
        const aspectToggleDiv = editorSection.createDiv({ cls: "card-aspect-ratio-toggle" });
        const aspectToggle = aspectToggleDiv.createEl("input", {
            type: "checkbox"
        }) as HTMLInputElement;
        aspectToggleDiv.createSpan({ text: "锁定宽高比" });

        // 实现宽高比锁定逻辑
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
            input.addEventListener("keypress", (e) => {
                if (e.key === "Enter") {
                    const width = parseInt(widthInput.value);
                    const height = parseInt(heightInput.value);
                    if (this.validateDimension(width) && this.validateDimension(height)) {
                        this.updateBothDimensions(width, height);
                    }
                }
            });
        });

        // 存储输入框引用以供后续使用
        (container as any)._widthInput = widthInput;
        (container as any)._heightInput = heightInput;
    }

    private createCopySection(container: HTMLElement) {
        const actionButtons = container.createDiv({ cls: "cca-action-footer" });

        const copySizeBtn = actionButtons.createEl("button", {
            text: "复制尺寸信息",
            cls: "cca-btn cca-btn-secondary"
        });
        copySizeBtn.addEventListener("click", async () => {
            const sizeInfo = `卡片尺寸: ${this.cardData.width} × ${this.cardData.height} px`;
            await this.clipboardAdapter.writeTextWithNotice(sizeInfo, "尺寸信息已复制到剪贴板");
        });

        const copyPosBtn = actionButtons.createEl("button", {
            text: "复制位置信息",
            cls: "cca-btn cca-btn-secondary"
        });
        copyPosBtn.addEventListener("click", async () => {
            const posInfo = `卡片位置: X: ${this.cardData.x}, Y: ${this.cardData.y}`;
            await this.clipboardAdapter.writeTextWithNotice(posInfo, "位置信息已复制到剪贴板");
        });

        const applyBtn = actionButtons.createEl("button", {
            text: "应用更改",
            cls: "cca-btn cca-btn-primary"
        });
        applyBtn.addEventListener("click", async () => {
            const widthInput = (container as any)._widthInput;
            const heightInput = (container as any)._heightInput;
            
            if (widthInput && heightInput) {
                const width = parseInt(widthInput.value);
                const height = parseInt(heightInput.value);
                
                if (this.validateDimension(width) && this.validateDimension(height)) {
                    await this.updateBothDimensions(width, height);
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
            new Notice("更新失败: " + error.message);
        }
    }

    private updateSizeDisplay() {
        const sizeEl = this.contentEl.querySelector("#current-size");
        if (sizeEl) {
            sizeEl.textContent = `${this.cardData.width} × ${this.cardData.height}`;
        }
    }

    private validateDimension(value: number): boolean {
        return validateDimension(value);
    }

    private addStyles() {
        ModalStyleManager.injectSharedStyles();
        
        // 此 Modal 独有的少量样式
        const style = document.createElement("style");
        style.textContent = `
            .card-aspect-ratio-toggle {
                display: flex;
                align-items: center;
                gap: 8px;
                font-size: 13px;
                color: var(--text-muted);
                margin-bottom: 16px;
            }

            .card-aspect-ratio-toggle input {
                cursor: pointer;
            }
        `;
        
        document.head.appendChild(style);
        
        // 在模态框关闭时清理样式
        this.scope.register([], "cleanup-style", () => {
            style.remove();
            ModalStyleManager.removeSharedStyles();
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}