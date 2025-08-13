import { ICommand } from "./ICommand";
import { IBadgeService } from "../../services/BadgeService";

export class SetBadgeCommand implements ICommand {
    constructor(
        private badgeService: IBadgeService,
        private node: any,
        private badgeText: string
    ) {}

    async execute(): Promise<void> {
        await this.badgeService.setBadge(this.node, this.badgeText);
    }

    canExecute(): boolean {
        return this.badgeService.isValidBadgeNode(this.node);
    }

    getDescription(): string {
        return "设置卡片徽章";
    }
}

export class RemoveBadgeCommand implements ICommand {
    constructor(
        private badgeService: IBadgeService,
        private node: any
    ) {}

    async execute(): Promise<void> {
        await this.badgeService.removeBadge(this.node);
    }

    canExecute(): boolean {
        return this.badgeService.isValidBadgeNode(this.node);
    }

    getDescription(): string {
        return "移除卡片徽章";
    }
}

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