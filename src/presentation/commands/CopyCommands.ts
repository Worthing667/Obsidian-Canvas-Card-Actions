import type { App } from "obsidian";
import { ICommand } from "./ICommand";
import { IContentService } from "../../services/ContentService";
import { SortPriority } from "../../domain/strategies";
import { DragSortModal } from "../modals/DragSortModal";
import type { CanvasNode } from "../../types/canvas";
import { t } from "../../i18n";
import type CanvasLoomSettings from "../../settings/ICanvasLoomSettings";

export class CopySingleCardCommand implements ICommand {
    constructor(
        private contentService: IContentService,
        private node: CanvasNode,
        private settings?: Partial<CanvasLoomSettings>
    ) {}

    async execute(): Promise<void> {
        await this.contentService.copySingleCardContent(this.node);
    }

    canExecute(): boolean {
        return !!this.node.text;
    }

    getDescription(): string {
        return t("commands.copyCardContent", undefined, { settings: this.settings });
    }
}

export class CopyByPositionCommand implements ICommand {
    constructor(
        private contentService: IContentService,
        private selection: CanvasNode[],
        private sortPriority: SortPriority = 'yx',
        private settings?: Partial<CanvasLoomSettings>
    ) {}

    async execute(): Promise<void> {
        await this.contentService.copyContentByPosition(this.selection, this.sortPriority);
    }

    canExecute(): boolean {
        return this.selection.length > 0;
    }

    getDescription(): string {
        return t("commands.copyContentByPosition", undefined, { settings: this.settings });
    }
}

export class CopyByBadgeOrderCommand implements ICommand {
    constructor(
        private contentService: IContentService,
        private selection: CanvasNode[],
        private sortPriority: SortPriority = 'yx',
        private settings?: Partial<CanvasLoomSettings>
    ) {}

    async execute(): Promise<void> {
        await this.contentService.copyContentByBadgeOrder(this.selection, this.sortPriority);
    }

    canExecute(): boolean {
        return this.selection.length > 0;
    }

    getDescription(): string {
        return t("commands.copyContentByBadgeOrder", undefined, { settings: this.settings });
    }
}

export class CopyByManualOrderCommand implements ICommand {
    constructor(
        private app: App,
        private selection: CanvasNode[],
        private sortPriority: SortPriority = 'yx',
        private settings?: Partial<CanvasLoomSettings>
    ) {}

    execute(): Promise<void> {
        new DragSortModal(this.app, this.selection, { sortPriority: this.sortPriority }).open();
        return Promise.resolve();
    }

    canExecute(): boolean {
        return this.selection.length > 1;
    }

    getDescription(): string {
        return t("commands.copyByManualOrder", undefined, { settings: this.settings });
    }
}
