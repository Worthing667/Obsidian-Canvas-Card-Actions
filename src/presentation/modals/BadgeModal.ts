import { Modal } from 'obsidian';
import { BadgeData } from '../../domain/models/Badge';
import { IBadgeService } from '../../services/BadgeService';

export class BadgeModal extends Modal {
    private currentBadge: string;
    private node: any;
    private badgeService: IBadgeService;

    constructor(app: any, node: any, badgeService: IBadgeService, currentBadge: string = '') {
        super(app);
        this.node = node;
        this.badgeService = badgeService;
        this.currentBadge = currentBadge;
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();

        contentEl.createEl("h2", { text: "设置排序标记" });

        const inputContainer = contentEl.createDiv();
        inputContainer.createEl("label", { text: "排序标记（仅支持数字）：" });

        const input = inputContainer.createEl("input", {
            type: "text",
            value: this.currentBadge,
            placeholder: "例如：1、2.1、10.3.2"
        });
        input.style.width = "100%";
        input.style.marginTop = "10px";

        const hint = contentEl.createDiv();
        hint.style.fontSize = "0.9em";
        hint.style.color = "var(--text-muted)";
        hint.style.marginTop = "10px";
        hint.setText("提示：排序标记会自动保存在画布文件中");

        const validation = contentEl.createDiv();
        validation.style.fontSize = "0.9em";
        validation.style.marginTop = "8px";

        const buttonContainer = contentEl.createDiv();
        buttonContainer.style.marginTop = "20px";
        buttonContainer.style.display = "flex";
        buttonContainer.style.justifyContent = "flex-end";
        buttonContainer.style.gap = "10px";

        const removeButton = buttonContainer.createEl("button", { text: "移除标记" });
        removeButton.addEventListener("click", async () => {
            await this.setBadge("");
            this.close();
        });

        const cancelButton = buttonContainer.createEl("button", { text: "取消" });
        cancelButton.addEventListener("click", () => {
            this.close();
        });

        const confirmButton = buttonContainer.createEl("button", { text: "确定" });
        confirmButton.addClass("mod-cta");
        confirmButton.addEventListener("click", async () => {
            if (!this.validateInput(input.value, validation, confirmButton)) {
                return;
            }

            await this.setBadge(input.value.trim());
            this.close();
        });

        input.addEventListener("input", () => {
            this.validateInput(input.value, validation, confirmButton);
        });

        input.addEventListener("keypress", async (e) => {
            if (e.key === "Enter") {
                if (!this.validateInput(input.value, validation, confirmButton)) {
                    return;
                }

                await this.setBadge(input.value.trim());
                this.close();
            }
        });

        this.validateInput(input.value, validation, confirmButton);
        input.focus();
        input.select();
    }

    private validateInput(inputValue: string, validationEl: HTMLElement, confirmButton: HTMLButtonElement): boolean {
        const value = inputValue.trim();

        if (!value) {
            validationEl.style.color = "var(--text-muted)";
            validationEl.setText("留空可移除，或直接使用“移除标记”。");
            confirmButton.disabled = false;
            return true;
        }

        if (BadgeData.isValidContent(value)) {
            validationEl.style.color = "var(--text-muted)";
            validationEl.setText("支持层级序号，例如 1、2.1、10.3.2。");
            confirmButton.disabled = false;
            return true;
        }

        validationEl.style.color = "var(--text-error)";
        validationEl.setText("只支持数字序号，格式如 1、2、2.1。");
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
            console.error("设置标记时出错:", error);
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
