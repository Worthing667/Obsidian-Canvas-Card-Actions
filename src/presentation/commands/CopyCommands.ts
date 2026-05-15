import type { App } from "obsidian";
import { ICommand } from "./ICommand";
import { IContentService } from "../../services/ContentService";
import { SortPriority } from "../../domain/strategies";
import { DragSortModal } from "../modals/DragSortModal";
import type { CanvasNode } from "../../types/canvas";

export class CopySingleCardCommand implements ICommand {
    constructor(
        private contentService: IContentService,
        private node: CanvasNode
    ) {}

    async execute(): Promise<void> {
        await this.contentService.copySingleCardContent(this.node);
    }

    canExecute(): boolean {
        return !!this.node.text;
    }

    getDescription(): string {
        return "复制卡片内容";
    }
}

export class CopyByPositionCommand implements ICommand {
    constructor(
        private contentService: IContentService,
        private selection: CanvasNode[],
        private sortPriority: SortPriority = 'yx'
    ) {}

    async execute(): Promise<void> {
        await this.contentService.copyContentByPosition(this.selection, this.sortPriority);
    }

    canExecute(): boolean {
        return this.selection.length > 0;
    }

    getDescription(): string {
        return "按位置复制内容";
    }
}

export class CopyByBadgeOrderCommand implements ICommand {
    constructor(
        private contentService: IContentService,
        private selection: CanvasNode[],
        private sortPriority: SortPriority = 'yx'
    ) {}

    async execute(): Promise<void> {
        await this.contentService.copyContentByBadgeOrder(this.selection, this.sortPriority);
    }

    canExecute(): boolean {
        return this.selection.length > 0;
    }

    getDescription(): string {
        return "按标记顺序复制内容";
    }
}

export class CopyByManualOrderCommand implements ICommand {
    constructor(
        private app: App,
        private selection: CanvasNode[],
        private sortPriority: SortPriority = 'yx'
    ) {}

    execute(): Promise<void> {
        new DragSortModal(this.app, this.selection, { sortPriority: this.sortPriority }).open();
        return Promise.resolve();
    }

    canExecute(): boolean {
        return this.selection.length > 1;
    }

    getDescription(): string {
        return "手动排序复制";
    }
}
