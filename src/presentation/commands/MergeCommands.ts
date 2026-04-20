import { TFile } from "obsidian";
import { ICommand } from "./ICommand";
import { IMergeService } from "../../services/MergeService";
import CanvasCardActionsSettings from "../../settings/ICanvasCardActionsSettings";

export class MergeToCanvasCardCommand implements ICommand {
    constructor(
        private mergeService: IMergeService,
        private selection: any[],
        private settings: CanvasCardActionsSettings
    ) {}

    async execute(): Promise<void> {
        const order = this.settings.mergeDefaultOrder === 'badge' ? 'badge' : 'position';
        await this.mergeService.mergeToCanvasCard(this.selection, {
            order,
            sortPriority: this.settings.sortPriority
        });
    }

    canExecute(): boolean {
        return this.selection.length > 0;
    }

    getDescription(): string {
        return '合并 → 新建卡片';
    }
}

export class MergeToSidebarPreviewCommand implements ICommand {
    constructor(
        private mergeService: IMergeService,
        private selection: any[],
        private settings: CanvasCardActionsSettings
    ) {}

    async execute(): Promise<void> {
        const order = this.settings.mergeDefaultOrder === 'badge' ? 'badge' : 'position';
        await this.mergeService.mergeToSidebar(this.selection, {
            order,
            sortPriority: this.settings.sortPriority
        });
    }

    canExecute(): boolean {
        return this.selection.length > 0;
    }

    getDescription(): string {
        return '合并 → 侧边栏预览';
    }
}

export class MergeToMarkdownCommand implements ICommand {
    constructor(
        private mergeService: IMergeService,
        private selection: any[],
        private canvasFile: TFile | null,
        private settings: CanvasCardActionsSettings
    ) {}

    async execute(): Promise<void> {
        const order = this.settings.mergeDefaultOrder === 'badge' ? 'badge' : 'position';
        await this.mergeService.mergeToMarkdown(this.selection, this.canvasFile, {
            order,
            sortPriority: this.settings.sortPriority
        });
    }

    canExecute(): boolean {
        return this.selection.length > 0;
    }

    getDescription(): string {
        return '合并 → 新建文稿';
    }
}
