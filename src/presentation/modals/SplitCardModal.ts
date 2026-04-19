import { App, Modal } from "obsidian";
import { HeadingSplitOption, ICardService } from "../../services/CardService";
import { ModalStyleManager } from "../styles/ModalStyles";

interface SplitActionOption {
    title: string;
    description: string;
    disabled?: boolean;
    onChoose: () => Promise<void>;
}

export class SplitCardModal extends Modal {
    private readonly node: any;
    private readonly cardService: ICardService;
    private readonly delimiter: string;
    private readonly options: SplitActionOption[] = [];

    constructor(app: App, node: any, cardService: ICardService, delimiter: string) {
        super(app);
        this.node = node;
        this.cardService = cardService;
        this.delimiter = delimiter;
        this.buildOptions();
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("cca-split-modal");

        contentEl.createEl("h2", { text: "拆分卡片" });

        const nodeText = this.node?.getData?.()?.text ?? "";
        const summary = contentEl.createDiv({ cls: "cca-split-summary" });
        summary.setText(`为当前卡片选择一种拆分方式。内容长度 ${nodeText.length} 个字符。`);

        if (this.options.length === 0) {
            const emptyState = contentEl.createDiv({ cls: "cca-split-empty" });
            emptyState.setText("当前卡片没有可用的拆分方式。请先添加分隔符或 Markdown 标题。");

            const footer = contentEl.createDiv({ cls: "cca-action-footer" });
            const closeButton = footer.createEl("button", {
                text: "关闭",
                cls: "cca-btn cca-btn-primary"
            });
            closeButton.addEventListener("click", () => this.close());

            this.addStyles();
            return;
        }

        const list = contentEl.createDiv({ cls: "cca-split-option-list" });

        for (const option of this.options) {
            const button = list.createEl("button", {
                cls: "cca-split-option"
            });

            button.createDiv({ cls: "cca-split-option-title", text: option.title });
            button.createDiv({ cls: "cca-split-option-desc", text: option.description });

            if (option.disabled) {
                button.addClass("is-disabled");
                button.disabled = true;
            } else {
                button.addEventListener("click", async () => {
                    this.close();
                    await option.onChoose();
                });
            }
        }

        const footer = contentEl.createDiv({ cls: "cca-action-footer" });
        const cancelButton = footer.createEl("button", {
            text: "取消",
            cls: "cca-btn cca-btn-secondary"
        });
        cancelButton.addEventListener("click", () => this.close());

        this.addStyles();
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
        document.getElementById("cca-split-modal-styles")?.remove();
        ModalStyleManager.removeSharedStyles();
    }

    private buildOptions(): void {
        const text = this.node?.getData?.()?.text ?? "";
        const delimiterParts = this.getDelimiterPartCount(text);
        const delimiterText = this.delimiter.trim() || "(未设置)";
        this.options.push({
            title: "按分隔符拆分",
            description: delimiterParts > 1
                ? `使用分隔符“${delimiterText}”拆成 ${delimiterParts} 张卡片。`
                : `当前未检测到可用分隔符“${delimiterText}”。`,
            disabled: delimiterParts <= 1,
            onChoose: async () => this.cardService.splitCard(this.node, this.delimiter)
        });

        const headingOptions = this.cardService.getAvailableHeadingSplitOptions(this.node);
        if (headingOptions.length === 0) {
            this.options.push({
                title: "按标题拆分",
                description: "当前未检测到可用于拆分的 Markdown 标题层级。",
                disabled: true,
                onChoose: async () => Promise.resolve()
            });
            return;
        }

        for (const option of headingOptions) {
            this.options.push(this.createHeadingOption(option));
        }
    }

    private createHeadingOption(option: HeadingSplitOption): SplitActionOption {
        const levelLabel = this.getHeadingLevelLabel(option.level);
        return {
            title: `按${levelLabel}标题拆分`,
            description: `拆成 ${option.cardCount} 张卡片，更深层标题会保留在所属卡片中。`,
            onChoose: async () => this.cardService.splitCardByHeadingLevel(this.node, option.level)
        };
    }

    private getDelimiterPartCount(text: string): number {
        if (!text || !this.delimiter?.trim()) {
            return 0;
        }

        return this.cardService.countDelimitedParts(text, this.delimiter);
    }

    private getHeadingLevelLabel(level: number): string {
        const labels = ["一级", "二级", "三级", "四级", "五级", "六级"];
        return labels[level - 1] ?? `${level}级`;
    }

    private addStyles(): void {
        ModalStyleManager.injectSharedStyles();

        const existingStyle = document.getElementById("cca-split-modal-styles");
        if (existingStyle) {
            existingStyle.remove();
        }

        const style = document.createElement("style");
        style.id = "cca-split-modal-styles";
        style.textContent = `
            .cca-split-modal {
                padding: 0;
            }

            .cca-split-summary {
                color: var(--text-muted);
                margin-bottom: 16px;
                font-size: 13px;
            }

            .cca-split-empty {
                background: var(--background-secondary-alt);
                border: 1px solid var(--background-modifier-border);
                border-radius: 8px;
                padding: 16px;
                margin-bottom: 20px;
                color: var(--text-muted);
                line-height: 1.5;
            }

            .cca-split-option-list {
                display: flex;
                flex-direction: column;
                gap: 10px;
                margin-bottom: 20px;
            }

            .cca-split-option {
                width: 100%;
                border: 1px solid var(--background-modifier-border);
                background: var(--background-secondary-alt);
                border-radius: 8px;
                padding: 14px 16px;
                text-align: left;
                cursor: pointer;
                transition: border-color 0.2s, transform 0.2s, background 0.2s;
            }

            .cca-split-option:hover {
                border-color: var(--interactive-accent);
                background: var(--background-secondary);
                transform: translateY(-1px);
            }

            .cca-split-option.is-disabled {
                cursor: not-allowed;
                opacity: 0.6;
                transform: none;
            }

            .cca-split-option.is-disabled:hover {
                border-color: var(--background-modifier-border);
                background: var(--background-secondary-alt);
                transform: none;
            }

            .cca-split-option-title {
                font-size: 15px;
                font-weight: 600;
                color: var(--text-normal);
                margin-bottom: 4px;
            }

            .cca-split-option-desc {
                font-size: 13px;
                line-height: 1.5;
                color: var(--text-muted);
            }
        `;

        document.head.appendChild(style);
    }
}
