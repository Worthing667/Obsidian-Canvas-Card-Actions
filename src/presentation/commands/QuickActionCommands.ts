import { TFile } from "obsidian";
import { ICommand } from "./ICommand";
import { IContentService } from "../../services/ContentService";
import { IMergeService } from "../../services/MergeService";
import CanvasCardActionsSettings from "../../settings/ICanvasCardActionsSettings";

export class QuickCopyCommand implements ICommand {
    constructor(
        private contentService: IContentService,
        private selection: any[],
        private settings: CanvasCardActionsSettings
    ) {}

    async execute(): Promise<void> {
        const order = this.settings.defaultSortMode;
        await this.contentService.copyMergedContent({
            selection: this.selection,
            order,
            sortPriority: this.settings.sortPriority,
            includeBadgePrefix: order === 'badge'
        }, '已执行一键复制');
    }

    canExecute(): boolean {
        return this.selection.length > 0;
    }

    getDescription(): string {
        return '一键复制';
    }
}

export class QuickMergeCommand implements ICommand {
    constructor(
        private mergeService: IMergeService,
        private selection: any[],
        private settings: CanvasCardActionsSettings
    ) {}

    async execute(): Promise<void> {
        await this.mergeService.mergeToCanvasCard(this.selection, {
            order: this.settings.defaultSortMode,
            sortPriority: this.settings.sortPriority
        });
    }

    canExecute(): boolean {
        return this.selection.length > 0;
    }

    getDescription(): string {
        return '一键拼合';
    }
}

export class OpenPreviewWorkbenchCommand implements ICommand {
    constructor(
        private mergeService: IMergeService,
        private selection: any[],
        private canvasFile: TFile | null,
        private settings: CanvasCardActionsSettings
    ) {}

    async execute(): Promise<void> {
        await this.mergeService.openWorkbench(this.selection, this.canvasFile, {
            order: this.settings.defaultSortMode,
            sortPriority: this.settings.sortPriority
        });
    }

    canExecute(): boolean {
        return this.selection.length > 0;
    }

    getDescription(): string {
        return '打开预览工作台';
    }
}
