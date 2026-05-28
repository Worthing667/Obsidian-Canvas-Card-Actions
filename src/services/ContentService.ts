import { BadgeSortStrategy, PositionSortStrategy, SortPriority } from "../domain/strategies";
import { ICanvasAdapter } from "../adapters/CanvasAdapter";
import { IClipboardAdapter } from "../adapters/ClipboardAdapter";
import { BadgeData } from "../domain/models/Badge";
import { IBadgeService } from "./BadgeService";
import { formatMergedCardsContent } from "./MergedContentFormatter";
import { t } from "../i18n";
import { Notice } from "obsidian";
import type { CardSnapshot } from "../types/WorkbenchState";
import type { CanvasNode } from "../types/canvas";

export type MergeOrder = 'position' | 'badge' | 'manual';

export interface BuildMergedContentOptions {
    selection?: CanvasNode[];
    snapshots?: CardSnapshot[];
    order: MergeOrder;
    sortPriority?: SortPriority;
    manualOrderIds?: string[];
    includeBadgePrefix?: boolean;
    cardSeparator?: string | null;
}

export interface MergedContentResult {
    content: string;
    count: number;
}

export interface IContentService {
    copyContentByPosition(selection: CanvasNode[], sortPriority: SortPriority): Promise<void>;
    copyContentByBadgeOrder(selection: CanvasNode[], sortPriority?: SortPriority): Promise<void>;
    copySingleCardContent(node: CanvasNode): Promise<void>;
    copyMergedContent(options: BuildMergedContentOptions, successNotice: string): Promise<boolean>;
    buildMergedContent(options: BuildMergedContentOptions): Promise<MergedContentResult>;
    createSelectionSnapshot(selection: CanvasNode[]): Promise<CardSnapshot[]>;
    getOrderedCards(options: BuildMergedContentOptions): Promise<CardSnapshot[]>;
    formatBadgedCardsContent(cards: Array<{text: string, badge?: string}>): string;
}

export class ContentService implements IContentService {
    constructor(
        private canvasAdapter: ICanvasAdapter,
        private clipboardAdapter: IClipboardAdapter,
        private badgeService: IBadgeService
    ) {}

    async copyContentByPosition(selection: CanvasNode[], sortPriority: SortPriority = 'yx'): Promise<void> {
        try {
            await this.copyMergedContent({
                selection,
                order: 'position',
                sortPriority
            }, t("notice.copyByPositionSuccess"));
        } catch (error) {
            console.error("Failed to copy content by position:", error);
            new Notice(t("notice.copyGenericFailed"));
        }
    }

    async copyContentByBadgeOrder(selection: CanvasNode[], sortPriority?: SortPriority): Promise<void> {
        try {
            await this.copyMergedContent({
                selection,
                order: 'badge',
                sortPriority,
                includeBadgePrefix: true
            }, t("notice.copyByBadgeSuccess"));
        } catch (error) {
            console.error("Failed to copy content by badge order:", error);
            new Notice(t("notice.copyGenericFailed"));
        }
    }

    async copySingleCardContent(node: CanvasNode): Promise<void> {
        try {
            const nodeData = node.getData();
            if (!nodeData.text) {
                new Notice(t("notice.singleCardEmpty"));
                return;
            }

            const success = await this.clipboardAdapter.writeTextWithNotice(
                nodeData.text,
                t("notice.singleCardCopied")
            );

            if (!success) {
                throw new Error(t("notice.clipboardCopyFailed"));
            }

        } catch (error) {
            console.error("Failed to copy single card content:", error);
            new Notice(t("notice.copyGenericFailed"));
        }
    }

    async copyMergedContent(options: BuildMergedContentOptions, successNotice: string): Promise<boolean> {
        const result = await this.buildMergedContent(options);

        if (result.count === 0) {
            new Notice(t("notice.copyNoSelectedTextCards"));
            return false;
        }

        return this.clipboardAdapter.writeTextWithNotice(
            result.content,
            t("notice.copyMergedSuccessWithCount", {
                message: successNotice,
                count: result.count
            })
        );
    }

    async buildMergedContent(options: BuildMergedContentOptions): Promise<MergedContentResult> {
        const orderedCards = await this.getOrderedCards(options);
        if (orderedCards.length === 0) {
            return { content: '', count: 0 };
        }

        const includeBadgePrefix = options.includeBadgePrefix ?? options.order === 'badge';
        const content = formatMergedCardsContent(
            orderedCards.map(card => ({ text: card.text, badge: card.badge })),
            {
                includeBadgePrefix,
                cardSeparator: options.cardSeparator
            }
        );

        return {
            content,
            count: orderedCards.length
        };
    }

    async createSelectionSnapshot(selection: CanvasNode[]): Promise<CardSnapshot[]> {
        const selectedNodes = this.resolveSelection(selection);
        const snapshots: CardSnapshot[] = [];

        for (const node of selectedNodes) {
            const nodeData = node?.getData?.();
            if (nodeData?.type !== 'text' || !nodeData.text || !nodeData.text.trim()) {
                continue;
            }

            const existingBadge = nodeData.badge
                ? BadgeData.create(nodeData.badge)
                : await this.badgeService.getCurrentBadge(node);

            snapshots.push({
                id: nodeData.id,
                text: nodeData.text.trim(),
                x: nodeData.x ?? 0,
                y: nodeData.y ?? 0,
                width: nodeData.width ?? 400,
                height: nodeData.height ?? 400,
                color: typeof nodeData.color === "string" ? nodeData.color.trim() || undefined : undefined,
                badge: existingBadge?.content,
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
            const badgeSorter = new BadgeSortStrategy(options.sortPriority || 'yx');
            return badgeSorter.sort(snapshots);
        }

        if (options.order === 'manual') {
            return this.sortManualSnapshots(snapshots, options.manualOrderIds || []);
        }

        const positionSorter = new PositionSortStrategy(options.sortPriority || 'yx');
        return positionSorter.sort(snapshots);
    }

    formatBadgedCardsContent(cards: Array<{text: string, badge?: string}>): string {
        return formatMergedCardsContent(cards, { includeBadgePrefix: true });
    }

    private resolveSelection(selection: CanvasNode[]): CanvasNode[] {
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
