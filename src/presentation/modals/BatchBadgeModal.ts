import { App, Modal } from 'obsidian';
import { BadgeData } from '../../domain/models/Badge';
import { PositionSortStrategy } from '../../domain/strategies';
import type { SortPriority } from '../../domain/strategies';
import { IBadgeService } from '../../services/BadgeService';
import type { CanvasNode } from '../../types/canvas';
import { modalT } from './modalI18n';

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

        contentEl.createEl("h2", { text: this.t("modal.batchBadge.title") });

        const summary = contentEl.createDiv({ cls: "canvas-loom-badge-hint" });
        summary.setText(this.t("modal.batchBadge.summary", { count: this.orderedNodes.length }));

        const inputContainer = contentEl.createDiv();
        inputContainer.addClass("canvas-loom-badge-input-container");
        inputContainer.createEl("label", { text: this.t("modal.batchBadge.startLabel") });

        const input = inputContainer.createEl("input", {
            type: "text",
            value: "1",
            placeholder: this.t("modal.badge.placeholder")
        });
        input.addClass("canvas-loom-badge-input");

        const validation = contentEl.createDiv({ cls: "canvas-loom-badge-validation" });
        const preview = contentEl.createDiv({ cls: "canvas-loom-badge-hint" });

        const buttonContainer = contentEl.createDiv({ cls: "canvas-loom-badge-actions" });

        const removeButton = buttonContainer.createEl("button", { text: this.t("modal.batchBadge.removeSelected") });
        removeButton.addEventListener("click", () => {
            void this.removeBadges().then(() => {
                this.close();
            });
        });

        const cancelButton = buttonContainer.createEl("button", { text: this.t("modal.common.cancel") });
        cancelButton.addEventListener("click", () => {
            this.close();
        });

        const confirmButton = buttonContainer.createEl("button", { text: this.t("modal.batchBadge.add") });
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
            validationEl.setText(this.t("modal.batchBadge.validation.noCards"));
            confirmButton.disabled = true;
            return null;
        }

        if (!BadgeData.isValidContent(value)) {
            validationEl.addClass("is-error");
            validationEl.setText(this.t("modal.batchBadge.validation.invalid"));
            confirmButton.disabled = true;
            return null;
        }

        const sequence = this.createBadgeSequence(value, this.orderedNodes.length);
        validationEl.addClass("is-muted");
        validationEl.setText(this.t("modal.batchBadge.validation.valid"));
        previewEl.setText(this.t("modal.batchBadge.preview", { preview: this.formatPreview(sequence) }));
        confirmButton.disabled = false;
        return sequence;
    }

    private async setBadges(sequence: string[]): Promise<void> {
        try {
            await this.badgeService.setBadges(this.orderedNodes, sequence);
        } catch (error) {
            console.error("Failed to set badges in batch:", error);
        }
    }

    private async removeBadges(): Promise<void> {
        try {
            await this.badgeService.removeBadges(this.orderedNodes);
        } catch (error) {
            console.error("Failed to remove badges in batch:", error);
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
        return `${visibleItems.join(this.t("modal.common.listSeparator"))}${suffix}`;
    }

    private t(key: Parameters<typeof modalT>[1], params?: Parameters<typeof modalT>[2]): string {
        return modalT(this.app, key, params);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
