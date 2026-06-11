import { App, Modal } from 'obsidian';
import { BadgeData } from '../../domain/models/Badge';
import { PositionSortStrategy } from '../../domain/strategies';
import type { SortPriority } from '../../domain/strategies';
import { IBadgeService } from '../../services/BadgeService';
import {
    createBadgeSequence,
    resolveDefaultBatchBadgeMode,
    type BatchBadgeApplyMode
} from '../../services/BatchBadgePlan';
import type { CanvasNode } from '../../types/canvas';
import { modalT } from './modalI18n';

export class BatchBadgeModal extends Modal {
    private orderedNodes: CanvasNode[];
    private applyMode: BatchBadgeApplyMode;

    constructor(
        app: App,
        selection: CanvasNode[],
        private badgeService: IBadgeService,
        sortPriority: SortPriority
    ) {
        super(app);
        this.orderedNodes = this.getOrderedBadgeNodes(selection, sortPriority);
        this.applyMode = resolveDefaultBatchBadgeMode(
            this.orderedNodes.length,
            this.getExistingBadgeCount()
        );
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl("h2", { text: this.t("modal.batchBadge.title") });

        const existingCount = this.getExistingBadgeCount();
        const missingCount = this.orderedNodes.length - existingCount;
        const summary = contentEl.createDiv({ cls: "canvas-loom-badge-hint" });
        summary.setText(this.t("modal.batchBadge.summary", {
            count: this.orderedNodes.length,
            existingCount,
            missingCount
        }));

        let modeSelect: HTMLSelectElement | null = null;
        if (existingCount > 0 && missingCount > 0) {
            const modeContainer = contentEl.createDiv({ cls: "canvas-loom-badge-input-container" });
            modeContainer.createEl("label", { text: this.t("modal.batchBadge.scopeLabel") });
            modeSelect = modeContainer.createEl("select");
            const missingOption = activeDocument.createElement("option");
            missingOption.value = "missing";
            missingOption.text = this.t("modal.batchBadge.scope.missing");
            modeSelect.add(missingOption);
            const allOption = activeDocument.createElement("option");
            allOption.value = "all";
            allOption.text = this.t("modal.batchBadge.scope.all");
            modeSelect.add(allOption);
            modeSelect.value = this.applyMode;
        }

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

        const cancelButton = buttonContainer.createEl("button", { text: this.t("modal.common.cancel") });
        cancelButton.addEventListener("click", () => {
            this.close();
        });

        const confirmButton = buttonContainer.createEl("button", { text: this.t("modal.batchBadge.add", { count: 0 }) });
        confirmButton.addClass("mod-cta");
        confirmButton.addEventListener("click", () => {
            const plan = this.validateInput(input.value, validation, preview, confirmButton);
            if (!plan) {
                return;
            }

            void this.setBadges(plan.nodes, plan.sequence).then(() => {
                this.close();
            });
        });

        input.addEventListener("input", () => {
            this.validateInput(input.value, validation, preview, confirmButton);
        });
        modeSelect?.addEventListener("change", () => {
            this.applyMode = modeSelect?.value === "all" ? "all" : "missing";
            this.validateInput(input.value, validation, preview, confirmButton);
        });

        input.addEventListener("keypress", (e) => {
            if (e.key !== "Enter") {
                return;
            }

            const plan = this.validateInput(input.value, validation, preview, confirmButton);
            if (!plan) {
                return;
            }

            void this.setBadges(plan.nodes, plan.sequence).then(() => {
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
    ): { nodes: CanvasNode[]; sequence: string[] } | null {
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

        const targetNodes = this.getTargetNodes();
        if (targetNodes.length === 0) {
            validationEl.addClass("is-error");
            validationEl.setText(this.t("modal.batchBadge.validation.noTargets"));
            confirmButton.disabled = true;
            confirmButton.setText(this.t("modal.batchBadge.add", { count: 0 }));
            return null;
        }

        const sequence = createBadgeSequence(value, targetNodes.length);
        validationEl.addClass("is-muted");
        validationEl.setText(this.t("modal.batchBadge.validation.valid"));
        previewEl.setText(this.t("modal.batchBadge.preview", {
            preview: this.formatPreview(targetNodes, sequence)
        }));
        confirmButton.disabled = false;
        confirmButton.setText(this.t("modal.batchBadge.add", { count: targetNodes.length }));
        return { nodes: targetNodes, sequence };
    }

    private async setBadges(nodes: CanvasNode[], sequence: string[]): Promise<void> {
        try {
            await this.badgeService.setBadges(nodes, sequence);
        } catch (error) {
            console.error("Failed to set badges in batch:", error);
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

    private getExistingBadgeCount(): number {
        return this.orderedNodes.filter((node) => this.hasBadge(node)).length;
    }

    private getTargetNodes(): CanvasNode[] {
        return this.applyMode === "missing"
            ? this.orderedNodes.filter((node) => !this.hasBadge(node))
            : this.orderedNodes;
    }

    private hasBadge(node: CanvasNode): boolean {
        const badge = node.getData?.()?.badge;
        return typeof badge === "string" && badge.trim().length > 0;
    }

    private formatPreview(nodes: CanvasNode[], sequence: string[]): string {
        const visibleItems = nodes.slice(0, 5).map((node, index) => {
            const firstLine = (node.getData?.()?.text || "").split(/\r?\n/, 1)[0].trim();
            const text = firstLine || this.t("modal.common.emptyCard");
            const previewText = text.length > 24 ? `${text.slice(0, 24)}...` : text;
            return `${sequence[index]} → ${previewText}`;
        });
        const suffix = nodes.length > visibleItems.length ? "\n..." : "";
        return `${visibleItems.join("\n")}${suffix}`;
    }

    private t(key: Parameters<typeof modalT>[1], params?: Parameters<typeof modalT>[2]): string {
        return modalT(this.app, key, params);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
