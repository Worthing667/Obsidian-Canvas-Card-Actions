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

export class OpenSequenceToolsCommand implements ICommand {
    constructor(
        private openTools: () => void,
        private selection: CanvasNode[],
        private canEditSelection: (nodes: CanvasNode[]) => boolean,
        private settings?: Partial<CanvasLoomSettings>
    ) {}

    execute(): Promise<void> {
        this.openTools();
        return Promise.resolve();
    }

    canExecute(): boolean {
        return this.canEditSelection(this.selection);
    }

    getDescription(): string {
        return t("commands.openSequenceTools", undefined, { settings: this.settings });
    }
}
