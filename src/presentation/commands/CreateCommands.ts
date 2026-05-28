import { App } from "obsidian";
import { ICommand } from "./ICommand";
import { ICardService } from "../../services/CardService";
import { SplitCardModal } from "../modals/SplitCardModal";
import type { CanvasNode } from "../../types/canvas";
import { t } from "../../i18n";
import type CanvasLoomSettings from "../../settings/ICanvasLoomSettings";

export class SplitCardCommand implements ICommand {
    constructor(
        private cardService: ICardService,
        private node: CanvasNode,
        private delimiter: string,
        private settings?: Partial<CanvasLoomSettings>
    ) {}

    async execute(): Promise<void> {
        await this.cardService.splitCard(this.node, this.delimiter);
    }

    canExecute(): boolean {
        return !!this.node.text && this.node.text.includes(this.delimiter);
    }

    getDescription(): string {
        return t("commands.splitCardByDelimiter", undefined, { settings: this.settings });
    }
}

export class OpenSplitCardModalCommand implements ICommand {
    constructor(
        private app: App,
        private cardService: ICardService,
        private node: CanvasNode,
        private delimiter: string,
        private settings?: Partial<CanvasLoomSettings>
    ) {}

    execute(): Promise<void> {
        new SplitCardModal(this.app, this.node, this.cardService, this.delimiter).open();
        return Promise.resolve();
    }

    canExecute(): boolean {
        const text = this.node?.getData?.()?.text;
        return typeof text === "string" && text.trim().length > 0;
    }

    getDescription(): string {
        return t("commands.splitCard", undefined, { settings: this.settings });
    }
}
