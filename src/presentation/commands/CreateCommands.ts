import { App } from "obsidian";
import { ICommand } from "./ICommand";
import { ICardService } from "../../services/CardService";
import { SplitCardModal } from "../modals/SplitCardModal";

export class SplitCardCommand implements ICommand {
    constructor(
        private cardService: ICardService,
        private node: any,
        private delimiter: string
    ) {}

    async execute(): Promise<void> {
        await this.cardService.splitCard(this.node, this.delimiter);
    }

    canExecute(): boolean {
        return !!this.node.text && this.node.text.includes(this.delimiter);
    }

    getDescription(): string {
        return "按分隔符拆分卡片";
    }
}

export class OpenSplitCardModalCommand implements ICommand {
    constructor(
        private app: App,
        private cardService: ICardService,
        private node: any,
        private delimiter: string
    ) {}

    async execute(): Promise<void> {
        new SplitCardModal(this.app, this.node, this.cardService, this.delimiter).open();
    }

    canExecute(): boolean {
        const text = this.node?.getData?.()?.text;
        return typeof text === "string" && text.trim().length > 0;
    }

    getDescription(): string {
        return "拆分卡片";
    }
}
