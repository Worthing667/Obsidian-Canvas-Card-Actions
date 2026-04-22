import { Notice, TFile } from "obsidian";
import { ICommand } from "./ICommand";
import CanvasLoomSettings from "../../settings/ICanvasLoomSettings";
import type { CanvasNode } from "../../types/canvas";
import { IColorGroupService } from "../../services/ColorGroupService";
import { IMergeService } from "../../services/MergeService";

export class SelectSameColorCardsCommand implements ICommand {
    constructor(
        private colorGroupService: IColorGroupService,
        private selection: CanvasNode[]
    ) {}

    execute(): Promise<void> {
        const group = this.colorGroupService.selectColorGroup(this.selection);
        if (group.matchedNodes.length === 0) {
            new Notice("没有找到匹配颜色的文本卡片");
            return Promise.resolve();
        }

        new Notice(`已选中 ${group.matchedNodes.length} 张匹配颜色的卡片`);
        return Promise.resolve();
    }

    canExecute(): boolean {
        return this.colorGroupService.hasTextCardSelection(this.selection);
    }

    getDescription(): string {
        return "选中同色卡片";
    }
}

export class OpenSameColorGroupWorkbenchCommand implements ICommand {
    constructor(
        private colorGroupService: IColorGroupService,
        private mergeService: IMergeService,
        private selection: CanvasNode[],
        private canvasFile: TFile | null,
        private settings: CanvasLoomSettings
    ) {}

    async execute(): Promise<void> {
        const group = this.colorGroupService.getColorGroupFromSelection(this.selection);
        await this.mergeService.openWorkbench(group.matchedNodes, this.canvasFile, {
            order: this.settings.defaultSortMode,
            sortPriority: this.settings.sortPriority,
            previewExpanded: true,
            scopeLabel: group.scopeLabel,
        });
    }

    canExecute(): boolean {
        return this.colorGroupService.hasTextCardSelection(this.selection);
    }

    getDescription(): string {
        return "预览同色卡片分组";
    }
}
