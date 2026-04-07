import { CardData } from "../domain/models/Card";
import { BadgeData } from "../domain/models/Badge";
import { PositionSortStrategy, BadgeSortStrategy, SortPriority } from "../domain/strategies";
import { ICanvasAdapter } from "../adapters/CanvasAdapter";
import { IClipboardAdapter } from "../adapters/ClipboardAdapter";
import { IBadgeService } from "./BadgeService";
import { Notice } from "obsidian";

export interface IContentService {
    copyContentByPosition(selection: any[], sortPriority: SortPriority): Promise<void>;
    copyContentByBadgeOrder(selection: any[]): Promise<void>;
    copySingleCardContent(node: any): Promise<void>;
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
            const selectedNodes = this.canvasAdapter.getSelectedNodes();
            
            if (selectedNodes.length === 0) {
                new Notice("请先选择要复制的卡片");
                return;
            }

            // 提取文本卡片数据
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

            if (cards.length === 0) {
                new Notice("没有选中任何文本卡片");
                return;
            }

            // 使用位置排序策略
            const positionSorter = new PositionSortStrategy(sortPriority);
            const sortedCards = positionSorter.sort(cards);

            // 拼接内容并复制
            const content = sortedCards.map(card => card.text).join('\n\n');
            
            const success = await this.clipboardAdapter.writeTextWithNotice(
                content,
                `已按位置顺序复制 ${sortedCards.length} 张卡片的内容`
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
            const selectedNodes = this.canvasAdapter.getSelectedNodes();
            
            if (selectedNodes.length === 0) {
                new Notice("请先选择要复制的卡片");
                return;
            }

            // 查找带徽章的卡片
            const badgedCards = [];

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

            if (badgedCards.length === 0) {
                new Notice("选中的卡片中没有找到带徽章的卡片");
                return;
            }

            // 使用徽章排序策略
            const badgeSorter = new BadgeSortStrategy();
            const sortedCards = badgeSorter.sort(badgedCards);

            // 拼接内容并复制
            const content = this.formatBadgedCardsContent(sortedCards);
            
            const success = await this.clipboardAdapter.writeTextWithNotice(
                content,
                `已按徽章顺序复制 ${sortedCards.length} 张卡片的内容`
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

    formatBadgedCardsContent(cards: Array<{text: string, badge: string}>): string {
        return cards.map(card => `[${card.badge}] ${card.text}`).join('\n\n');
    }
}
