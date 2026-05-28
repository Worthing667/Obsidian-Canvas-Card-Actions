import type { App } from "obsidian";
import { TFile } from "obsidian";
import { ICommand } from "./ICommand";
import { IMergeService } from "../../services/MergeService";
import CanvasLoomSettings, { resolveMergeCardSeparator } from "../../settings/ICanvasLoomSettings";
import { DragSortModal } from "../modals/DragSortModal";
import type { CanvasNode } from "../../types/canvas";
import { t } from "../../i18n";

export class MergeToCanvasCardCommand implements ICommand {
    constructor(
        private mergeService: IMergeService,
        private selection: CanvasNode[],
        private settings: CanvasLoomSettings
    ) {}

    async execute(): Promise<void> {
        const order = this.settings.defaultSortMode === 'badge' ? 'badge' : 'position';
        await this.mergeService.mergeToCanvasCard(this.selection, {
            order,
            sortPriority: this.settings.sortPriority,
            cleanupMode: this.settings.mergeCleanupMode,
            cardSeparator: resolveMergeCardSeparator(this.settings)
        });
    }

    canExecute(): boolean {
        return this.selection.length > 0;
    }

    getDescription(): string {
        return t("commands.mergeToCanvasCard", undefined, { settings: this.settings });
    }
}

export class MergeToSidebarPreviewCommand implements ICommand {
    constructor(
        private mergeService: IMergeService,
        private selection: CanvasNode[],
        private canvasFile: TFile | null,
        private settings: CanvasLoomSettings
    ) {}

    async execute(): Promise<void> {
        await this.mergeService.mergeToSidebar(this.selection, this.canvasFile, {
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
        return t("commands.mergeToSidebarPreview", undefined, { settings: this.settings });
    }
}

export class MergeToMarkdownCommand implements ICommand {
    constructor(
        private mergeService: IMergeService,
        private selection: CanvasNode[],
        private canvasFile: TFile | null,
        private settings: CanvasLoomSettings
    ) {}

    async execute(): Promise<void> {
        const order = this.settings.defaultSortMode === 'badge' ? 'badge' : 'position';
        await this.mergeService.mergeToMarkdown(this.selection, this.canvasFile, {
            order,
            sortPriority: this.settings.sortPriority,
            cardSeparator: resolveMergeCardSeparator(this.settings)
        });
    }

    canExecute(): boolean {
        return this.selection.length > 0;
    }

    getDescription(): string {
        return t("commands.mergeToMarkdown", undefined, { settings: this.settings });
    }
}

export class ManualMergeCommand implements ICommand {
    constructor(
        private app: App,
        private mergeService: IMergeService,
        private selection: CanvasNode[],
        private canvasFile: TFile | null,
        private settings: CanvasLoomSettings
    ) {}

    execute(): Promise<void> {
        new DragSortModal(this.app, this.selection, {
            mode: "merge",
            sortPriority: this.settings.sortPriority,
            actions: [
                {
                    textKey: "modal.dragSort.addAsCard",
                    cls: "drag-sort-btn drag-sort-btn-primary",
                    onClick: async ({ nodes, modal }) => {
                        const success = await this.mergeService.mergeToCanvasCard(nodes, {
                            order: 'manual',
                            cleanupMode: this.settings.mergeCleanupMode,
                            cardSeparator: resolveMergeCardSeparator(this.settings)
                        });
                        if (success) {
                            modal.close();
                        }
                    }
                },
                {
                    textKey: "modal.dragSort.previewGroup",
                    cls: "drag-sort-btn drag-sort-btn-secondary",
                    onClick: async ({ nodes, modal }) => {
                        const success = await this.mergeService.mergeToSidebar(nodes, this.canvasFile, {
                            order: 'manual',
                            cardSeparator: resolveMergeCardSeparator(this.settings)
                        });
                        if (success) {
                            modal.close();
                        }
                    }
                },
                {
                    textKey: "modal.dragSort.newDocument",
                    cls: "drag-sort-btn drag-sort-btn-secondary",
                    onClick: async ({ nodes, modal }) => {
                        const success = await this.mergeService.mergeToMarkdown(nodes, this.canvasFile, {
                            order: 'manual',
                            cardSeparator: resolveMergeCardSeparator(this.settings)
                        });
                        if (success) {
                            modal.close();
                        }
                    }
                }
            ]
        }).open();
        return Promise.resolve();
    }

    canExecute(): boolean {
        return this.selection.length > 1;
    }

    getDescription(): string {
        return t("commands.manualMerge", undefined, { settings: this.settings });
    }
}
