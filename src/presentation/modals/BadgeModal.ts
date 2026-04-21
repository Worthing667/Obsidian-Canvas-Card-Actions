import { Modal } from 'obsidian';
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
        
        contentEl.createEl("h2", { text: "设置卡片徽章" });
        
        const inputContainer = contentEl.createDiv();
        inputContainer.createEl("label", { text: "徽章内容（数字、文字或表情）：" });
        
        const input = inputContainer.createEl("input", {
            type: "text",
            value: this.currentBadge,
            placeholder: "例如：1、完成、✅"
        });
        input.style.width = "100%";
        input.style.marginTop = "10px";
        
        const hint = contentEl.createDiv();
        hint.style.fontSize = "0.9em";
        hint.style.color = "var(--text-muted)";
        hint.style.marginTop = "10px";
        hint.setText("提示：徽章会自动保存在画布文件中");
        
        const buttonContainer = contentEl.createDiv();
        buttonContainer.style.marginTop = "20px";
        buttonContainer.style.display = "flex";
        buttonContainer.style.justifyContent = "flex-end";
        buttonContainer.style.gap = "10px";
        
        const removeButton = buttonContainer.createEl("button", { text: "移除徽章" });
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
            await this.setBadge(input.value.trim());
            this.close();
        });
        
        input.addEventListener("keypress", async (e) => {
            if (e.key === "Enter") {
                await this.setBadge(input.value.trim());
                this.close();
            }
        });
        
        input.focus();
        input.select();
    }

    private async setBadge(badgeText: string): Promise<void> {
        try {
            if (badgeText) {
                await this.badgeService.setBadge(this.node, badgeText);
            } else {
                await this.badgeService.removeBadge(this.node);
            }
        } catch (error) {
            console.error("设置徽章时出错:", error);
        }
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}
