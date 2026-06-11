import { TFile } from "obsidian";
import { ICommand } from "./ICommand";
import { IContentService } from "../../services/ContentService";
import { IMergeService } from "../../services/MergeService";
import CanvasLoomSettings, { resolveMergeCardSeparator } from "../../settings/ICanvasLoomSettings";
import type { CanvasNode } from "../../types/canvas";
import { t } from "../../i18n";

export class QuickCopyCommand implements ICommand {
    constructor(
        private contentService: IContentService,
        private selection: CanvasNode[],
        private settings: CanvasLoomSettings
    ) {}

    async execute(): Promise<void> {
        const order = this.settings.defaultSortMode;
        await this.contentService.copyMergedContent({
            selection: this.selection,
            order,
            sortPriority: this.settings.sortPriority,
            cardSeparator: resolveMergeCardSeparator(this.settings)
        }, t("notice.quickCopyExecuted", undefined, { settings: this.settings }));
    }

    canExecute(): boolean {
        return this.selection.length > 0;
    }

    getDescription(): string {
        return t("commands.quickCopy", undefined, { settings: this.settings });
    }
}

export class QuickMergeCommand implements ICommand {
    constructor(
        private mergeService: IMergeService,
        private selection: CanvasNode[],
        private settings: CanvasLoomSettings
    ) {}

    async execute(): Promise<void> {
        await this.mergeService.mergeToCanvasCard(this.selection, {
            order: this.settings.defaultSortMode,
            sortPriority: this.settings.sortPriority,
            cleanupMode: this.settings.mergeCleanupMode,
            cardSeparator: resolveMergeCardSeparator(this.settings)
        });
    }

    canExecute(): boolean {
        return this.selection.length > 0;
    }

    getDescription(): string {
        return t("commands.quickMerge", undefined, { settings: this.settings });
    }
}

export class OpenPreviewWorkbenchCommand implements ICommand {
    constructor(
        private mergeService: IMergeService,
        private selection: CanvasNode[],
        private canvasFile: TFile | null,
        private settings: CanvasLoomSettings
    ) {}

    async execute(): Promise<void> {
        await this.mergeService.openWorkbench(this.selection, this.canvasFile, {
            order: this.settings.defaultSortMode,
            sortPriority: this.settings.sortPriority,
            cleanupMode: this.settings.mergeCleanupMode,
            cardSeparator: resolveMergeCardSeparator(this.settings)
        });
    }

    canExecute(): boolean {
        return this.selection.length > 0;
    }

    getDescription(): string {
        return t("commands.previewCardGroup", undefined, { settings: this.settings });
    }
}
