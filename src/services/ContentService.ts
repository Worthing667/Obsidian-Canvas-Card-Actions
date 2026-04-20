import { BadgeSortStrategy, PositionSortStrategy, SortPriority } from "../domain/strategies";
import { ICanvasAdapter } from "../adapters/CanvasAdapter";
import { IClipboardAdapter } from "../adapters/ClipboardAdapter";
import { IBadgeService } from "./BadgeService";
import { Notice } from "obsidian";
import type { CardSnapshot } from "../types/WorkbenchState";

export type MergeOrder = 'position' | 'badge' | 'manual';

export interface BuildMergedContentOptions {
    selection?: any[];
    snapshots?: CardSnapshot[];
    order: MergeOrder;
    sortPriority?: SortPriority;
    manualOrderIds?: string[];
    includeBadgePrefix?: boolean;
}

export interface MergedContentResult {
    content: string;
    count: number;
}

export interface IContentService {
    copyContentByPosition(selection: any[], sortPriority: SortPriority): Promise<void>;
    copyContentByBadgeOrder(selection: any[]): Promise<void>;
    copySingleCardContent(node: any): Promise<void>;
    copyMergedContent(options: BuildMergedContentOptions, successNotice: string): Promise<boolean>;
    buildMergedContent(options: BuildMergedContentOptions): Promise<MergedContentResult>;
    createSelectionSnapshot(selection: any[]): Promise<CardSnapshot[]>;
    getOrderedCards(options: BuildMergedContentOptions): Promise<CardSnapshot[]>;
    formatBadgedCardsContent(cards: Array<{text: string, badge: string}>): string;
}

export class ContentService implements IContentService {
    constructor(
        private canvasAdapter: ICanvasAdapter,
        private clipboardAdapter: IClipboardAdapter,
        private badgeService: IBadgeService
    ) {}

    async copyContentByPosition(selection: any[], sortPriority: SortPriority = 'yx'): Promise<void> {
        try {
            await this.copyMergedContent({
                selection,
                order: 'position',
                sortPriority
            }, '已按位置顺序复制卡片内容');
        } catch (error) {
            console.error("按位置复制失败:", error);
            new Notice("复制失败，请查看控制台了解详情");
        }
    }

    async copyContentByBadgeOrder(selection: any[]): Promise<void> {
        try {
            await this.copyMergedContent({
                selection,
                order: 'badge',
                includeBadgePrefix: true
            }, '已按徽章顺序复制卡片内容');
        } catch (error) {
            console.error("按徽章顺序复制失败:", error);
            new Notice("复制失败，请查看控制台了解详情");
        }
    }

    async copySingleCardContent(node: any): Promise<void> {
        try {
            const nodeData = node.getData();
            if (!nodeData.text) {
                new Notice("卡片内容为空");
                return;
            }

            const success = await this.clipboardAdapter.writeTextWithNotice(
                nodeData.text,
                "卡片内容已复制到剪贴板"
            );

            if (!success) {
                throw new Error("复制到剪贴板失败");
            }

        } catch (error) {
            console.error("复制单卡内容失败:", error);
            new Notice("复制失败，请查看控制台了解详情");
        }
    }

    async copyMergedContent(options: BuildMergedContentOptions, successNotice: string): Promise<boolean> {
        const result = await this.buildMergedContent(options);

        if (result.count === 0) {
            const emptyMessage = options.order === 'badge'
                ? "选中的卡片中没有找到带徽章的卡片"
                : "没有选中任何文本卡片";
            new Notice(emptyMessage);
            return false;
        }

        return this.clipboardAdapter.writeTextWithNotice(
            result.content,
            `${successNotice}（共 ${result.count} 张卡片）`
        );
    }

    async buildMergedContent(options: BuildMergedContentOptions): Promise<MergedContentResult> {
        const orderedCards = await this.getOrderedCards(options);
        if (orderedCards.length === 0) {
            return { content: '', count: 0 };
        }

        const includeBadgePrefix = options.order === 'badge' && options.includeBadgePrefix !== false;
        const content = includeBadgePrefix
            ? this.formatBadgedCardsContent(
                orderedCards
                    .filter(card => !!card.badge)
                    .map(card => ({ text: card.text, badge: card.badge || '' }))
            )
            : orderedCards.map(card => card.text).join('\n\n');

        return {
            content,
            count: orderedCards.length
        };
    }

    async createSelectionSnapshot(selection: any[]): Promise<CardSnapshot[]> {
        const selectedNodes = this.resolveSelection(selection);
        const snapshots: CardSnapshot[] = [];

        for (const node of selectedNodes) {
            const nodeData = node?.getData?.();
            if (nodeData?.type !== 'text' || !nodeData.text || !nodeData.text.trim()) {
                continue;
            }

            const existingBadge = nodeData.badge
                ? { content: nodeData.badge, type: nodeData.badgeType }
                : await this.badgeService.getCurrentBadge(node);

            snapshots.push({
                id: nodeData.id,
                text: nodeData.text.trim(),
                x: nodeData.x ?? 0,
                y: nodeData.y ?? 0,
                width: nodeData.width ?? 400,
                height: nodeData.height ?? 400,
                badge: existingBadge?.content,
                badgeType: existingBadge?.type,
            });
        }

        return snapshots;
    }

    async getOrderedCards(options: BuildMergedContentOptions): Promise<CardSnapshot[]> {
        const snapshots = options.snapshots && options.snapshots.length > 0
            ? this.normalizeSnapshots(options.snapshots)
            : await this.createSelectionSnapshot(options.selection || []);

        if (snapshots.length === 0) {
            return [];
        }

        if (options.order === 'badge') {
            const badgedCards = snapshots.filter(card => !!card.badge);
            const badgeSorter = new BadgeSortStrategy();
            return badgeSorter.sort(badgedCards as any) as CardSnapshot[];
        }

        if (options.order === 'manual') {
            return this.sortManualSnapshots(snapshots, options.manualOrderIds || []);
        }

        const positionSorter = new PositionSortStrategy(options.sortPriority || 'yx');
        return positionSorter.sort(snapshots as any) as CardSnapshot[];
    }

    formatBadgedCardsContent(cards: Array<{text: string, badge: string}>): string {
        return cards.map(card => `[${card.badge}] ${card.text}`).join('\n\n');
    }

    private resolveSelection(selection: any[]): any[] {
        if (Array.isArray(selection) && selection.length > 0) {
            return selection;
        }
        return this.canvasAdapter.getSelectedNodes();
    }

    private normalizeSnapshots(snapshots: CardSnapshot[]): CardSnapshot[] {
        return snapshots
            .filter(snapshot => !!snapshot.text?.trim())
            .map(snapshot => ({
                ...snapshot,
                text: snapshot.text.trim()
            }));
    }

    private sortManualSnapshots(snapshots: CardSnapshot[], manualOrderIds: string[]): CardSnapshot[] {
        if (manualOrderIds.length === 0) {
            return [...snapshots];
        }

        const snapshotById = new Map(snapshots.map(snapshot => [snapshot.id, snapshot]));
        const orderedSnapshots: CardSnapshot[] = [];

        manualOrderIds.forEach((id) => {
            const snapshot = snapshotById.get(id);
            if (snapshot) {
                orderedSnapshots.push(snapshot);
                snapshotById.delete(id);
            }
        });

        snapshotById.forEach((snapshot) => orderedSnapshots.push(snapshot));
        return orderedSnapshots;
    }
}
