import { App, Modal } from 'obsidian';
import { BadgeData } from '../../domain/models/Badge';
import { PositionSortStrategy } from '../../domain/strategies';
import type { SortPriority } from '../../domain/strategies';
import { IBadgeService } from '../../services/BadgeService';
import type { CanvasNode } from '../../types/canvas';

export class BatchBadgeModal extends Modal {
    private orderedNodes: CanvasNode[];

    constructor(
        app: App,
        selection: CanvasNode[],
        private badgeService: IBadgeService,
        sortPriority: SortPriority
    ) {
        super(app);
        this.orderedNodes = this.getOrderedBadgeNodes(selection, sortPriority);
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl("h2", { text: "批量设置排序标记" });

        const summary = contentEl.createDiv({ cls: "canvas-loom-badge-hint" });
        summary.setText(`将按画布位置顺序为 ${this.orderedNodes.length} 张卡片连续编号。`);

        const inputContainer = contentEl.createDiv();
        inputContainer.addClass("canvas-loom-badge-input-container");
        inputContainer.createEl("label", { text: "起始标记：" });

        const input = inputContainer.createEl("input", {
            type: "text",
            value: "1",
            placeholder: "例如：1、2.1、10.3.2"
        });
        input.addClass("canvas-loom-badge-input");

        const validation = contentEl.createDiv({ cls: "canvas-loom-badge-validation" });
        const preview = contentEl.createDiv({ cls: "canvas-loom-badge-hint" });

        const buttonContainer = contentEl.createDiv({ cls: "canvas-loom-badge-actions" });

        const removeButton = buttonContainer.createEl("button", { text: "移除所选标记" });
        removeButton.addEventListener("click", () => {
            void this.removeBadges().then(() => {
                this.close();
            });
        });

        const cancelButton = buttonContainer.createEl("button", { text: "取消" });
        cancelButton.addEventListener("click", () => {
            this.close();
        });

        const confirmButton = buttonContainer.createEl("button", { text: "添加标记" });
        confirmButton.addClass("mod-cta");
        confirmButton.addEventListener("click", () => {
            const sequence = this.validateInput(input.value, validation, preview, confirmButton);
            if (!sequence) {
                return;
            }

            void this.setBadges(sequence).then(() => {
                this.close();
            });
        });

        input.addEventListener("input", () => {
            this.validateInput(input.value, validation, preview, confirmButton);
        });

        input.addEventListener("keypress", (e) => {
            if (e.key !== "Enter") {
                return;
            }

            const sequence = this.validateInput(input.value, validation, preview, confirmButton);
            if (!sequence) {
                return;
            }

            void this.setBadges(sequence).then(() => {
                this.close();
            });
        });

        this.validateInput(input.value, validation, preview, confirmButton);
        input.focus();
        input.select();
    }

    private validateInput(
        inputValue: string,
        validationEl: HTMLElement,
        previewEl: HTMLElement,
        confirmButton: HTMLButtonElement
    ): string[] | null {
        const value = inputValue.trim();
        validationEl.removeClass("is-error");
        validationEl.removeClass("is-muted");
        previewEl.setText("");

        if (this.orderedNodes.length === 0) {
            validationEl.addClass("is-error");
            validationEl.setText("当前选区没有可标记的文本卡片。");
            confirmButton.disabled = true;
            return null;
        }

        if (!BadgeData.isValidContent(value)) {
            validationEl.addClass("is-error");
            validationEl.setText("只支持数字序号，格式如 1、2、2.1。");
            confirmButton.disabled = true;
            return null;
        }

        const sequence = this.createBadgeSequence(value, this.orderedNodes.length);
        validationEl.addClass("is-muted");
        validationEl.setText("层级标记会递增最后一段，例如 2.1、2.2、2.3。");
        previewEl.setText(`预览：${this.formatPreview(sequence)}`);
        confirmButton.disabled = false;
        return sequence;
    }

    private async setBadges(sequence: string[]): Promise<void> {
        try {
            await this.badgeService.setBadges(this.orderedNodes, sequence);
        } catch (error) {
            console.error("批量设置标记时出错:", error);
        }
    }

    private async removeBadges(): Promise<void> {
        try {
            await this.badgeService.removeBadges(this.orderedNodes);
        } catch (error) {
            console.error("批量移除标记时出错:", error);
        }
    }

    private getOrderedBadgeNodes(selection: CanvasNode[], sortPriority: SortPriority): CanvasNode[] {
        const nodes = selection.filter((node) => this.badgeService.isValidBadgeNode(node));
        const sorter = new PositionSortStrategy(sortPriority);

        return sorter.sort(nodes.map((node) => {
            const data = node.getData();
            return {
                node,
                text: data.text || "",
                x: data.x,
                y: data.y
            };
        })).map((item) => item.node);
    }

    private createBadgeSequence(startBadge: string, count: number): string[] {
        const parts = BadgeData.normalize(startBadge).split(".");
        const lastPart = Number(parts[parts.length - 1]);
        const prefix = parts.slice(0, -1);

        return Array.from({ length: count }, (_, index) => {
            return [...prefix, String(lastPart + index)].join(".");
        });
    }

    private formatPreview(sequence: string[]): string {
        const visibleItems = sequence.slice(0, 5);
        const suffix = sequence.length > visibleItems.length ? " ..." : "";
        return `${visibleItems.join("、")}${suffix}`;
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
