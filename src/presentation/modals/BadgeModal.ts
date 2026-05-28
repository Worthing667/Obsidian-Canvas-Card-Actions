import { App, Modal } from 'obsidian';
import { BadgeData } from '../../domain/models/Badge';
import { IBadgeService } from '../../services/BadgeService';
import type { CanvasNode } from '../../types/canvas';
import { modalT } from './modalI18n';

export class BadgeModal extends Modal {
    private currentBadge: string;
    private node: CanvasNode;
    private badgeService: IBadgeService;

    constructor(app: App, node: CanvasNode, badgeService: IBadgeService, currentBadge = '') {
        super(app);
        this.node = node;
        this.badgeService = badgeService;
        this.currentBadge = currentBadge;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl("h2", { text: this.t("modal.badge.title") });

        const inputContainer = contentEl.createDiv();
        inputContainer.addClass("canvas-loom-badge-input-container");
        inputContainer.createEl("label", { text: this.t("modal.badge.label") });

        const input = inputContainer.createEl("input", {
            type: "text",
            value: this.currentBadge,
            placeholder: this.t("modal.badge.placeholder")
        });
        input.addClass("canvas-loom-badge-input");

        const hint = contentEl.createDiv({ cls: "canvas-loom-badge-hint" });
        hint.setText(this.t("modal.badge.hint"));

        const validation = contentEl.createDiv({ cls: "canvas-loom-badge-validation" });

        const buttonContainer = contentEl.createDiv({ cls: "canvas-loom-badge-actions" });

        const removeButton = buttonContainer.createEl("button", { text: this.t("modal.badge.remove") });
        removeButton.addEventListener("click", () => {
            void this.setBadge("").then(() => {
                this.close();
            });
        });

        const cancelButton = buttonContainer.createEl("button", { text: this.t("modal.common.cancel") });
        cancelButton.addEventListener("click", () => {
            this.close();
        });

        const confirmButton = buttonContainer.createEl("button", { text: this.t("modal.common.confirm") });
        confirmButton.addClass("mod-cta");
        confirmButton.addEventListener("click", () => {
            if (!this.validateInput(input.value, validation, confirmButton)) {
                return;
            }

            void this.setBadge(input.value.trim()).then(() => {
                this.close();
            });
        });

        input.addEventListener("input", () => {
            this.validateInput(input.value, validation, confirmButton);
        });

        input.addEventListener("keypress", (e) => {
            if (e.key === "Enter") {
                if (!this.validateInput(input.value, validation, confirmButton)) {
                    return;
                }

                void this.setBadge(input.value.trim()).then(() => {
                    this.close();
                });
            }
        });

        this.validateInput(input.value, validation, confirmButton);
        input.focus();
        input.select();
    }

    private validateInput(inputValue: string, validationEl: HTMLElement, confirmButton: HTMLButtonElement): boolean {
        const value = inputValue.trim();
        validationEl.removeClass("is-error");
        validationEl.removeClass("is-muted");

        if (!value) {
            validationEl.addClass("is-muted");
            validationEl.setText(this.t("modal.badge.validation.empty"));
            confirmButton.disabled = false;
            return true;
        }

        if (BadgeData.isValidContent(value)) {
            validationEl.addClass("is-muted");
            validationEl.setText(this.t("modal.badge.validation.valid"));
            confirmButton.disabled = false;
            return true;
        }

        validationEl.addClass("is-error");
        validationEl.setText(this.t("modal.badge.validation.invalid"));
        confirmButton.disabled = true;
        return false;
    }

    private async setBadge(badgeText: string): Promise<void> {
        try {
            if (badgeText) {
                await this.badgeService.setBadge(this.node, badgeText);
            } else {
                await this.badgeService.removeBadge(this.node);
            }
        } catch (error) {
            console.error("Failed to set badge:", error);
        }
    }

    private t(key: Parameters<typeof modalT>[1], params?: Parameters<typeof modalT>[2]): string {
        return modalT(this.app, key, params);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
