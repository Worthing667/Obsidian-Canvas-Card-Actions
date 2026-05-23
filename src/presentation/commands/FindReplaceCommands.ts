import { TFile } from "obsidian";
import { ICommand } from "./ICommand";
import { IMergeService } from "../../services/MergeService";
import CanvasLoomSettings, { resolveMergeCardSeparator } from "../../settings/ICanvasLoomSettings";
import type { CanvasNode } from "../../types/canvas";

export class OpenFindReplaceWorkbenchCommand implements ICommand {
    constructor(
        private mergeService: IMergeService,
        private selection: CanvasNode[],
        private canvasFile: TFile | null,
        private settings: CanvasLoomSettings
    ) {}

    async execute(): Promise<void> {
        await this.mergeService.openFindReplaceWorkbench(this.selection, this.canvasFile, {
            order: this.settings.defaultSortMode,
            sortPriority: this.settings.sortPriority,
            cleanupMode: this.settings.mergeCleanupMode,
            cardSeparator: resolveMergeCardSeparator(this.settings)
        });
    }

    canExecute(): boolean {
        return true;
    }

    getDescription(): string {
        return "查找替换 Canvas 卡片";
    }
}
