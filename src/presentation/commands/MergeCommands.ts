import { TFile } from "obsidian";
import { ICommand } from "./ICommand";
import { IMergeService } from "../../services/MergeService";
import CanvasLoomSettings from "../../settings/ICanvasLoomSettings";
import { DragSortModal } from "../modals/DragSortModal";

export class MergeToCanvasCardCommand implements ICommand {
    constructor(
        private mergeService: IMergeService,
        private selection: any[],
        private settings: CanvasLoomSettings
    ) {}

    async execute(): Promise<void> {
        const order = this.settings.defaultSortMode === 'badge' ? 'badge' : 'position';
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
        private canvasFile: TFile | null,
        private settings: CanvasLoomSettings
    ) {}

    async execute(): Promise<void> {
        const order = this.settings.defaultSortMode === 'badge' ? 'badge' : 'position';
        await this.mergeService.mergeToSidebar(this.selection, this.canvasFile, {
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
        private app: any,
        private mergeService: IMergeService,
        private selection: any[],
        private canvasFile: TFile | null
    ) {}

    async execute(): Promise<void> {
        new DragSortModal(this.app, this.selection, {
            title: "手动排序拼合",
            description: (count) => `拖拽卡片调整拼合顺序（共 ${count} 张卡片）`,
            actions: [
                {
                    text: "新建卡片",
                    cls: "drag-sort-btn drag-sort-btn-primary",
                    onClick: async ({ nodes, modal }) => {
                        const success = await this.mergeService.mergeToCanvasCard(nodes, { order: 'manual' });
                        if (success) {
                            modal.close();
                        }
                    }
                },
                {
                    text: "侧边栏预览",
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
    }

    canExecute(): boolean {
        return this.selection.length > 1;
    }

    getDescription(): string {
        return '手动排序拼合';
    }
}
