import type { App } from "obsidian";
import { TFile } from "obsidian";
import { ICommand } from "./ICommand";
import { IMergeService } from "../../services/MergeService";
import CanvasLoomSettings from "../../settings/ICanvasLoomSettings";
import { DragSortModal } from "../modals/DragSortModal";
import type { CanvasNode } from "../../types/canvas";

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
            cleanupMode: this.settings.mergeCleanupMode
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
        private selection: CanvasNode[],
        private canvasFile: TFile | null,
        private settings: CanvasLoomSettings
    ) {}

    async execute(): Promise<void> {
        await this.mergeService.mergeToSidebar(this.selection, this.canvasFile, {
            order: this.settings.defaultSortMode,
            sortPriority: this.settings.sortPriority,
            cleanupMode: this.settings.mergeCleanupMode
        });
    }

    canExecute(): boolean {
        return this.selection.length > 0;
    }

    getDescription(): string {
        return '预览选中卡片组（展开结果）';
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
            title: "手动排序拼合",
            description: (count) => `拖拽卡片调整拼合顺序（共 ${count} 张卡片）`,
            sortPriority: this.settings.sortPriority,
            actions: [
                {
                    text: "添加为新卡片",
                    cls: "drag-sort-btn drag-sort-btn-primary",
                    onClick: async ({ nodes, modal }) => {
                        const success = await this.mergeService.mergeToCanvasCard(nodes, {
                            order: 'manual',
                            cleanupMode: this.settings.mergeCleanupMode
                        });
                        if (success) {
                            modal.close();
                        }
                    }
                },
                {
                    text: "预览卡片组",
                    cls: "drag-sort-btn drag-sort-btn-secondary",
                    onClick: async ({ nodes, modal }) => {
                        const success = await this.mergeService.mergeToSidebar(nodes, this.canvasFile, { order: 'manual' });
                        if (success) {
                            modal.close();
                        }
                    }
                },
                {
                    text: "新建文稿",
                    cls: "drag-sort-btn drag-sort-btn-secondary",
                    onClick: async ({ nodes, modal }) => {
                        const success = await this.mergeService.mergeToMarkdown(nodes, this.canvasFile, { order: 'manual' });
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
        return '手动排序拼合';
    }
}
