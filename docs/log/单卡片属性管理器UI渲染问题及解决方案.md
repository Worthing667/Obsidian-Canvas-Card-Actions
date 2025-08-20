## 问题分析

当前实现存在以下主要问题：

1. **CSS语法错误** - 使用了嵌套语法，浏览器无法正确解析
2. **样式选择器不匹配** - HTML结构与CSS类名不对应
3. **视觉层次不够清晰** - 缺少背景色分组和适当的间距
4. **布局结构需要优化** - 统计信息展示方式过于简单

## 完整修复方案

以下是经过完全重写的`SingleCardPropertiesModal`类，实现了我们之前讨论的优化设计：

```typescript
import { Modal, Notice, App } from 'obsidian';
import { CardService } from '../../services';
import { ClipboardAdapter } from '../../adapters';

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
        contentEl.createEl("hr");
        this.createDimensionEditor(contentEl);
        contentEl.createEl("hr");
        this.createCopySection(contentEl);
        
        this.addStyles();
    }

    private createInfoSection(container: HTMLElement) {
        // 创建统计信息区域
        const statsSection = container.createDiv({ cls: "card-stats-section" });
        const statsGrid = statsSection.createDiv({ cls: "card-stats-grid" });

        // 当前尺寸统计
        const sizeItem = statsGrid.createDiv({ cls: "card-stat-item" });
        sizeItem.innerHTML = `
            <div class="card-stat-label">当前尺寸</div>
            <div class="card-stat-value" id="current-size">${this.cardData.width} × ${this.cardData.height}</div>
            <div class="card-stat-detail">像素</div>
        `;

        // 位置坐标统计
        const positionItem = statsGrid.createDiv({ cls: "card-stat-item" });
        positionItem.innerHTML = `
            <div class="card-stat-label">位置坐标</div>
            <div class="card-stat-value">X: ${this.cardData.x}, Y: ${this.cardData.y}</div>
            <div class="card-stat-detail">Canvas坐标</div>
        `;

        // 内容预览区域（如果有内容）
        if (this.cardData.text) {
            const previewSection = container.createDiv({ cls: "card-preview-section" });
            previewSection.createEl("h3", { cls: "card-section-title", text: "内容预览" });
            const previewContent = previewSection.createDiv({ cls: "card-preview-content" });
            const previewText = this.cardData.text.length > 150 
                ? this.cardData.text.substring(0, 150) + "..." 
                : this.cardData.text;
            previewContent.textContent = previewText;
        }
    }

    private createDimensionEditor(container: HTMLElement) {
        const editorSection = container.createDiv({ cls: "card-operations-section" });
        editorSection.createEl("h3", { cls: "card-operation-title", text: "尺寸调整" });

        // 尺寸控制区域
        const dimensionControls = editorSection.createDiv({ cls: "card-dimension-controls" });

        // 宽度控制
        const widthGroup = dimensionControls.createDiv({ cls: "card-control-group" });
        widthGroup.createEl("label", { text: "宽度 (px)" });
        const widthInput = widthGroup.createEl("input", {
            type: "number",
            value: this.cardData.width.toString(),
            attr: { min: "50", max: "2000" }
        }) as HTMLInputElement;

        // 高度控制
        const heightGroup = dimensionControls.createDiv({ cls: "card-control-group" });
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
        const actionButtons = container.createDiv({ cls: "card-action-buttons" });

        const copySizeBtn = actionButtons.createEl("button", {
            text: "复制尺寸信息",
            cls: "card-btn card-btn-secondary"
        });
        copySizeBtn.addEventListener("click", async () => {
            const sizeInfo = `卡片尺寸: ${this.cardData.width} × ${this.cardData.height} px`;
            await this.clipboardAdapter.writeTextWithNotice(sizeInfo, "尺寸信息已复制到剪贴板");
        });

        const copyPosBtn = actionButtons.createEl("button", {
            text: "复制位置信息",
            cls: "card-btn card-btn-secondary"
        });
        copyPosBtn.addEventListener("click", async () => {
            const posInfo = `卡片位置: X: ${this.cardData.x}, Y: ${this.cardData.y}`;
            await this.clipboardAdapter.writeTextWithNotice(posInfo, "位置信息已复制到剪贴板");
        });

        const applyBtn = actionButtons.createEl("button", {
            text: "应用更改",
            cls: "card-btn card-btn-primary"
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
        return !isNaN(value) && value >= 50 && value <= 2000;
    }

    private addStyles() {
        const style = document.createElement("style");
        style.textContent = `
            /* 统计信息区域 */
            .card-stats-section {
                background: var(--background-secondary-alt);
                border-radius: 6px;
                padding: 20px;
                margin-bottom: 24px;
                border: 1px solid var(--background-modifier-border);
            }

            .card-stats-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 20px;
            }

            .card-stat-item {
                text-align: center;
            }

            .card-stat-label {
                font-size: 12px;
                color: var(--text-muted);
                margin-bottom: 4px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .card-stat-value {
                font-size: 18px;
                font-weight: 600;
                color: var(--text-normal);
                margin-bottom: 2px;
            }

            .card-stat-detail {
                font-size: 13px;
                color: var(--text-faint);
            }

            /* 内容预览区域 */
            .card-preview-section {
                background: var(--background-secondary-alt);
                border-radius: 6px;
                padding: 16px;
                margin-bottom: 24px;
                border: 1px solid var(--background-modifier-border);
                min-height: 100px;
            }

            .card-section-title {
                font-size: 14px;
                color: var(--text-muted);
                margin-bottom: 12px;
                font-weight: 500;
            }

            .card-preview-content {
                color: var(--text-faint);
                font-size: 13px;
                line-height: 1.5;
            }

            /* 操作区域 */
            .card-operations-section {
                background: var(--background-secondary-alt);
                border-radius: 6px;
                padding: 20px;
                margin-bottom: 24px;
                border: 1px solid var(--background-modifier-border);
            }

            .card-operation-title {
                font-size: 13px;
                color: var(--text-muted);
                text-transform: uppercase;
                letter-spacing: 0.5px;
                margin-bottom: 16px;
                font-weight: 500;
            }

            .card-dimension-controls {
                display: grid;
                grid-template-columns: 1fr 1fr;
                gap: 16px;
                margin-bottom: 16px;
            }

            .card-control-group {
                display: flex;
                flex-direction: column;
            }

            .card-control-group label {
                font-size: 13px;
                color: var(--text-muted);
                margin-bottom: 6px;
            }

            .card-control-group input {
                background: var(--background-primary);
                border: 1px solid var(--background-modifier-border);
                color: var(--text-normal);
                padding: 10px 12px;
                border-radius: 4px;
                font-size: 14px;
            }

            .card-control-group input:focus {
                outline: none;
                border-color: var(--interactive-accent);
            }

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

            /* 操作按钮 */
            .card-action-buttons {
                display: flex;
                gap: 12px;
                padding-top: 20px;
                border-top: 1px solid var(--background-modifier-border);
            }

            .card-btn {
                flex: 1;
                padding: 12px 16px;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            }

            .card-btn-primary {
                background: var(--interactive-accent);
                color: var(--text-on-accent);
            }

            .card-btn-primary:hover {
                background: var(--interactive-accent-hover);
            }

            .card-btn-secondary {
                background: var(--background-secondary);
                color: var(--text-muted);
            }

            .card-btn-secondary:hover {
                background: var(--background-modifier-hover);
                color: var(--text-normal);
            }

            /* 响应式调整 */
            @media (max-width: 640px) {
                .card-stats-grid {
                    grid-template-columns: 1fr;
                    gap: 16px;
                }
                
                .card-dimension-controls {
                    grid-template-columns: 1fr;
                }
            }
        `;
        
        document.head.appendChild(style);
        
        // 在模态框关闭时清理样式
        this.scope.register([], "cleanup-style", () => {
            style.remove();
        });
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
```

## 主要改进点

1. **完全重写的CSS样式** - 使用标准CSS语法，确保浏览器能够正确解析和应用
2. **优化的视觉层次** - 通过背景色分组、间距和字体大小创建清晰的信息层次
3. **统一的命名规范** - 所有CSS类名使用`card-`前缀，避免与其他样式冲突
4. **改进的布局结构** - 使用CSS Grid实现响应式布局，在小屏幕上自动调整
5. **增强的交互体验** - 改进的按钮样式、悬停效果和输入框焦点状态

这个实现将为您提供与设计预览相匹配的现代化界面，同时保持所有现有功能的完整性。界面将具有更好的视觉分组、清晰的信息层次和专业的外观。