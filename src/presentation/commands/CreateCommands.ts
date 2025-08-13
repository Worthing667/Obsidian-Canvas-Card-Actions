import { ICommand } from "./ICommand";
import { ICardService } from "../../services/CardService";

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

export class CreateCardFromContentCommand implements ICommand {
    constructor(
        private cardService: ICardService,
        private content: string,
        private position: { x: number, y: number }
    ) {}

    async execute(): Promise<void> {
        await this.cardService.createCardFromSortedContent(this.content, this.position);
    }

    canExecute(): boolean {
        return !!this.content.trim();
    }

    getDescription(): string {
        return "根据内容创建卡片";
    }
}