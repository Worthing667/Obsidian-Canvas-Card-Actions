import type { CanvasNode } from "../../types/canvas";
import { t } from "../../i18n";
import type CanvasLoomSettings from "../../settings/ICanvasLoomSettings";
import { ICommand } from "./ICommand";

export class OpenBadgeModalCommand implements ICommand {
    constructor(
        private openModal: (node: CanvasNode) => Promise<void>,
        private node: CanvasNode,
        private settings?: Partial<CanvasLoomSettings>
    ) {}

    async execute(): Promise<void> {
        await this.openModal(this.node);
    }

    canExecute(): boolean {
        return true; // 模态框本身会处理验证
    }

    getDescription(): string {
        return t("commands.editBadge", undefined, { settings: this.settings });
    }
}

export class OpenBatchBadgeModalCommand implements ICommand {
    constructor(
        private openModal: (nodes: CanvasNode[]) => Promise<void>,
        private selection: CanvasNode[],
        private canEditSelection: (nodes: CanvasNode[]) => boolean,
        private settings?: Partial<CanvasLoomSettings>
    ) {}

    async execute(): Promise<void> {
        await this.openModal(this.selection);
    }

    canExecute(): boolean {
        return this.canEditSelection(this.selection);
    }

    getDescription(): string {
        return t("commands.batchEditBadge", undefined, { settings: this.settings });
    }
}
