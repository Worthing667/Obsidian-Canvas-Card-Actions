import { Notice, TFile } from "obsidian";
import { ICommand } from "./ICommand";
import CanvasLoomSettings, { resolveMergeCardSeparator } from "../../settings/ICanvasLoomSettings";
import type { CanvasNode } from "../../types/canvas";
import { IColorGroupService } from "../../services/ColorGroupService";
import { IMergeService } from "../../services/MergeService";
import { t } from "../../i18n";

export class SelectSameColorCardsCommand implements ICommand {
    constructor(
        private colorGroupService: IColorGroupService,
        private selection: CanvasNode[],
        private settings?: Partial<CanvasLoomSettings>
    ) {}

    execute(): Promise<void> {
        const group = this.colorGroupService.selectColorGroup(this.selection);
        if (group.matchedNodes.length === 0) {
            new Notice(t("notice.noMatchingColorTextCards", undefined, { settings: this.settings }));
            return Promise.resolve();
        }

        new Notice(t("notice.sameColorCardsSelected", { count: group.matchedNodes.length }, { settings: this.settings }));
        return Promise.resolve();
    }

    canExecute(): boolean {
        return this.colorGroupService.hasTextCardSelection(this.selection);
    }

    getDescription(): string {
        return t("commands.selectSameColorCards", undefined, { settings: this.settings });
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
            cleanupMode: this.settings.mergeCleanupMode,
            cardSeparator: resolveMergeCardSeparator(this.settings),
        });
    }

    canExecute(): boolean {
        return this.colorGroupService.hasTextCardSelection(this.selection);
    }

    getDescription(): string {
        return t("commands.previewSameColorGroup", undefined, { settings: this.settings });
    }
}
