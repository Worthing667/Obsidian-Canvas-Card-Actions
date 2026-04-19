import { BadgeSortStrategy, PositionSortStrategy, SortPriority } from "../domain/strategies";
import { ICanvasAdapter } from "../adapters/CanvasAdapter";
import { IClipboardAdapter } from "../adapters/ClipboardAdapter";
import { IBadgeService } from "./BadgeService";
import { Notice } from "obsidian";

export type MergeOrder = 'position' | 'badge';

export interface BuildMergedContentOptions {
    selection?: any[];
    order: MergeOrder;
    sortPriority?: SortPriority;
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
    buildMergedContent(options: BuildMergedContentOptions): Promise<MergedContentResult>;
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
            const selectedNodes = this.resolveSelection(selection);
            if (selectedNodes.length === 0) {
                new Notice("请先选择要复制的卡片");
                return;
            }

            const result = await this.buildMergedContent({
                selection: selectedNodes,
                order: 'position',
                sortPriority
            });

            if (result.count === 0) {
                new Notice("没有选中任何文本卡片");
                return;
            }

            const success = await this.clipboardAdapter.writeTextWithNotice(
                result.content,
                `已按位置顺序复制 ${result.count} 张卡片的内容`
            );

            if (!success) {
                throw new Error("复制到剪贴板失败");
            }

        } catch (error) {
            console.error("按位置复制失败:", error);
            new Notice("复制失败，请查看控制台了解详情");
        }
    }

    async copyContentByBadgeOrder(selection: any[]): Promise<void> {
        try {
            const selectedNodes = this.resolveSelection(selection);
            if (selectedNodes.length === 0) {
                new Notice("请先选择要复制的卡片");
                return;
            }

            const result = await this.buildMergedContent({
                selection: selectedNodes,
                order: 'badge',
                includeBadgePrefix: true
            });

            if (result.count === 0) {
                new Notice("选中的卡片中没有找到带徽章的卡片");
                return;
            }

            const success = await this.clipboardAdapter.writeTextWithNotice(
                result.content,
                `已按徽章顺序复制 ${result.count} 张卡片的内容`
            );

            if (!success) {
                throw new Error("复制到剪贴板失败");
            }

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

    async buildMergedContent(options: BuildMergedContentOptions): Promise<MergedContentResult> {
        const selectedNodes = this.resolveSelection(options.selection || []);
        if (selectedNodes.length === 0) {
            return { content: '', count: 0 };
        }

        if (options.order === 'badge') {
            const badgedCards = await this.collectBadgedCards(selectedNodes);
            if (badgedCards.length === 0) {
                return { content: '', count: 0 };
            }

            const badgeSorter = new BadgeSortStrategy();
            const sortedCards = badgeSorter.sort(badgedCards);
            const includeBadgePrefix = options.includeBadgePrefix !== false;
            const content = includeBadgePrefix
                ? this.formatBadgedCardsContent(sortedCards)
                : sortedCards.map(card => card.text).join('\n\n');

            return {
                content,
                count: sortedCards.length
            };
        }

        const positionCards = this.collectPositionCards(selectedNodes);
        if (positionCards.length === 0) {
            return { content: '', count: 0 };
        }

        const positionSorter = new PositionSortStrategy(options.sortPriority || 'yx');
        const sortedCards = positionSorter.sort(positionCards);

        return {
            content: sortedCards.map(card => card.text).join('\n\n'),
            count: sortedCards.length
        };
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

    private collectPositionCards(selectedNodes: any[]): Array<{text: string, x: number, y: number}> {
        const cards: Array<{text: string, x: number, y: number}> = [];

        selectedNodes.forEach((node: any) => {
            const nodeData = node.getData();
            if (nodeData.type === 'text' && nodeData.text && nodeData.text.trim()) {
                cards.push({
                    text: nodeData.text.trim(),
                    x: nodeData.x,
                    y: nodeData.y
                });
            }
        });

        return cards;
    }

    private async collectBadgedCards(selectedNodes: any[]): Promise<Array<{text: string, badge: string, badgeType: 'number' | 'text' | 'emoji'}>> {
        const badgedCards: Array<{text: string, badge: string, badgeType: 'number' | 'text' | 'emoji'}> = [];

        for (const node of selectedNodes) {
            const nodeData = node.getData();
            if (nodeData.type === 'text' && nodeData.text && nodeData.text.trim()) {
                const badge = await this.badgeService.getCurrentBadge(node);
                if (badge && !badge.isEmpty()) {
                    badgedCards.push({
                        text: nodeData.text.trim(),
                        badge: badge.content,
                        badgeType: badge.type
                    });
                }
            }
        }

        return badgedCards;
    }
}
