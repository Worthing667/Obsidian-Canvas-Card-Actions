import { ICommand } from "./ICommand";

export class OpenBadgeModalCommand implements ICommand {
    constructor(
        private openModal: (node: any) => Promise<void>,
        private node: any
    ) {}

    async execute(): Promise<void> {
        await this.openModal(this.node);
    }

    canExecute(): boolean {
        return true; // 模态框本身会处理验证
    }

    getDescription(): string {
        return "打开徽章设置";
    }
}