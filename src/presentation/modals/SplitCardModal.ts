import { App, Modal } from "obsidian";
import { HeadingSplitOption, ICardService } from "../../services/CardService";
import type { CanvasNode } from "../../types/canvas";
import { modalT } from "./modalI18n";

interface SplitActionOption {
    title: string;
    description: string;
    disabled?: boolean;
    onChoose: () => Promise<void>;
}

export class SplitCardModal extends Modal {
    private readonly node: CanvasNode;
    private readonly cardService: ICardService;
    private readonly delimiter: string;
    private readonly options: SplitActionOption[] = [];

    constructor(app: App, node: CanvasNode, cardService: ICardService, delimiter: string) {
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

        contentEl.createEl("h2", { text: this.t("modal.split.title") });

        const nodeText = this.node?.getData?.()?.text ?? "";
        const summary = contentEl.createDiv({ cls: "cca-split-summary" });
        summary.setText(this.t("modal.split.summary", { count: nodeText.length }));

        if (this.options.length === 0) {
            const emptyState = contentEl.createDiv({ cls: "cca-split-empty" });
            emptyState.setText(this.t("modal.split.empty"));

            const footer = contentEl.createDiv({ cls: "cca-action-footer" });
            const closeButton = footer.createEl("button", {
                text: this.t("modal.common.close"),
                cls: "cca-btn cca-btn-primary"
            });
            closeButton.addEventListener("click", () => this.close());

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
                button.addEventListener("click", () => {
                    this.close();
                    void option.onChoose();
                });
            }
        }

        const footer = contentEl.createDiv({ cls: "cca-action-footer" });
        const cancelButton = footer.createEl("button", {
            text: this.t("modal.common.cancel"),
            cls: "cca-btn cca-btn-secondary"
        });
        cancelButton.addEventListener("click", () => this.close());

    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }

    private buildOptions(): void {
        const text = this.node?.getData?.()?.text ?? "";
        const delimiterParts = this.getDelimiterPartCount(text);
        const delimiterText = this.delimiter.trim() || this.t("modal.split.unsetDelimiter");
        this.options.push({
            title: this.t("modal.split.byDelimiter.title"),
            description: delimiterParts > 1
                ? this.t("modal.split.byDelimiter.available", { delimiter: delimiterText, count: delimiterParts })
                : this.t("modal.split.byDelimiter.unavailable", { delimiter: delimiterText }),
            disabled: delimiterParts <= 1,
            onChoose: async () => this.cardService.splitCard(this.node, this.delimiter)
        });

        const blankLineParts = this.getBlankLinePartCount(text);
        this.options.push({
            title: this.t("modal.split.byBlankLine.title"),
            description: blankLineParts > 1
                ? this.t("modal.split.byBlankLine.available", { count: blankLineParts })
                : this.t("modal.split.byBlankLine.unavailable"),
            disabled: blankLineParts <= 1,
            onChoose: async () => this.cardService.splitCardByBlankLine(this.node, this.delimiter)
        });

        const headingOptions = this.cardService.getAvailableHeadingSplitOptions(this.node);
        if (headingOptions.length === 0) {
            this.options.push({
                title: this.t("modal.split.byHeading.title"),
                description: this.t("modal.split.byHeading.unavailable"),
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
            title: this.t("modal.split.byHeading.optionTitle", { levelLabel }),
            description: this.t("modal.split.byHeading.optionDescription", { count: option.cardCount }),
            onChoose: async () => this.cardService.splitCardByHeadingLevel(this.node, option.level)
        };
    }

    private getDelimiterPartCount(text: string): number {
        if (!text || !this.delimiter?.trim()) {
            return 0;
        }

        return this.cardService.countDelimitedParts(text, this.delimiter);
    }

    private getBlankLinePartCount(text: string): number {
        if (!text) {
            return 0;
        }

        return this.cardService.countBlankLineParts(text, this.delimiter);
    }

    private getHeadingLevelLabel(level: number): string {
        const labels = [
            "modal.split.headingLevel.one",
            "modal.split.headingLevel.two",
            "modal.split.headingLevel.three",
            "modal.split.headingLevel.four",
            "modal.split.headingLevel.five",
            "modal.split.headingLevel.six"
        ] as const;
        const key = labels[level - 1];
        return key ? this.t(key) : this.t("modal.split.headingLevel.fallback", { level });
    }

    private t(key: Parameters<typeof modalT>[1], params?: Parameters<typeof modalT>[2]): string {
        return modalT(this.app, key, params);
    }

}
