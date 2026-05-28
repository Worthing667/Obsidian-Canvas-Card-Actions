import { CardData, Position } from "../domain/models/Card";
import { CanvasNodeData } from "../domain/models/CanvasData";
import { ICanvasAdapter } from "../adapters/CanvasAdapter";
import { t } from "../i18n";
import { Notice } from "obsidian";
import { PerformanceService } from "./PerformanceService";
import { arrangeSelectedTextCards } from "./CanvasArrangementService";
import type { CanvasNode } from "../types/canvas";
import {
    DEFAULT_SPLIT_CARDS_PER_ROW,
    MAX_SPLIT_CARDS_PER_ROW,
    MIN_SPLIT_CARDS_PER_ROW
} from "../settings/ICanvasLoomSettings";

export interface HeadingSplitOption {
    level: number;
    cardCount: number;
}

export interface ICardService {
    splitCard(node: CanvasNode, delimiter: string): Promise<void>;
    splitCardByBlankLine(node: CanvasNode, delimiter?: string): Promise<void>;
    splitCardByHeadingLevel(node: CanvasNode, level: number): Promise<void>;
    getAvailableHeadingSplitOptions(node: CanvasNode): HeadingSplitOption[];
    countDelimitedParts(text: string, delimiter: string): number;
    countBlankLineParts(text: string, delimiter?: string): number;
    createCardsFromContent(contents: string[], basePosition: Position): CanvasNodeData[];
    generateUniqueId(): string;
    calculateNewCardPosition(baseCard: CardData, index: number, cardSpacing?: number): Position;
    unifyCardSizes(nodes: CanvasNode[], targetSize: 'min' | 'max' | { width: number, height: number }): Promise<void>;
    unifyCardWidth(nodes: CanvasNode[], targetWidth: number): Promise<void>;
    unifyCardHeight(nodes: CanvasNode[], targetHeight: number): Promise<void>;
    arrangeCards(nodes: CanvasNode[], options: { direction: 'horizontal' | 'vertical'; spacing: number }): Promise<void>;
    readonly defaultCardSpacing: number;
}

export class CardService implements ICardService {
    constructor(
        private canvasAdapter: ICanvasAdapter,
        private readonly cardSpacing: number = 20,
        private readonly defaultCardWidth: number = 400,
        private readonly defaultCardHeight: number = 400,
        private performanceService?: PerformanceService,
        private readonly getSplitCardsPerRow: () => number = () => DEFAULT_SPLIT_CARDS_PER_ROW
    ) {}

    get defaultCardSpacing(): number { return this.cardSpacing; }

    async splitCard(node: CanvasNode, delimiter: string): Promise<void> {
        await this.measure("card.split.delimiter", { nodeId: node.id }, async () => {
            const nodeData = node.getData();
            const text = nodeData.text;

            if (!text || !delimiter?.trim()) {
                new Notice(t("notice.splitDelimiterNotFound"));
                return;
            }

            const parts = this.getDelimitedParts(text, delimiter);
            this.performanceService?.log("card.split.delimiter.parts", {
                nodeId: node.id,
                textLength: text.length,
                partCount: parts.length
            });

            if (parts.length <= 1) {
                new Notice(t("notice.splitNoContent"));
                return;
            }

            await this.applySplit(nodeData, parts, t("notice.splitByDelimiterSuccess", { count: parts.length }));
        });
    }

    async splitCardByBlankLine(node: CanvasNode, delimiter?: string): Promise<void> {
        await this.measure("card.split.blank-line", { nodeId: node.id }, async () => {
            const nodeData = node.getData();
            const text = nodeData.text;

            if (!text) {
                new Notice(t("notice.splitBlankLineNoContent"));
                return;
            }

            const parts = this.getBlankLineParts(text, delimiter);
            this.performanceService?.log("card.split.blank-line.parts", {
                nodeId: node.id,
                textLength: text.length,
                partCount: parts.length
            });

            if (parts.length <= 1) {
                new Notice(t("notice.splitBlankLineCannotSplit"));
                return;
            }

            await this.applySplit(nodeData, parts, t("notice.splitByBlankLineSuccess", { count: parts.length }));
        });
    }

    async splitCardByHeadingLevel(node: CanvasNode, level: number): Promise<void> {
        await this.measure("card.split.heading", { nodeId: node.id, level }, async () => {
            const nodeData = node.getData();
            const text = nodeData.text;

            if (!text || level < 1 || level > 6) {
                new Notice(t("notice.splitHeadingNoContent"));
                return;
            }

            const parts = this.getHeadingSplitParts(text, level);
            this.performanceService?.log("card.split.heading.parts", {
                nodeId: node.id,
                level,
                textLength: text.length,
                partCount: parts.length
            });

            if (parts.length <= 1) {
                new Notice(t("notice.splitHeadingCannotSplit", { level }));
                return;
            }

            await this.applySplit(nodeData, parts, t("notice.splitByHeadingSuccess", { level, count: parts.length }));
        });
    }

    getAvailableHeadingSplitOptions(node: CanvasNode): HeadingSplitOption[] {
        const text = node?.getData?.()?.text;
        if (!text || typeof text !== "string") {
            return [];
        }

        const options: HeadingSplitOption[] = [];
        for (let level = 1; level <= 6; level++) {
            const cardCount = this.getHeadingSplitParts(text, level).length;
            if (cardCount > 1) {
                options.push({ level, cardCount });
            }
        }

        return options;
    }

    countDelimitedParts(text: string, delimiter: string): number {
        return this.getDelimitedParts(text, delimiter).length;
    }

    countBlankLineParts(text: string, delimiter?: string): number {
        return this.getBlankLineParts(text, delimiter).length;
    }

    private async applySplit(nodeData: CanvasNodeData, parts: string[], successMessage: string): Promise<void> {
        try {
            const newCards = this.createCardsFromContent(
                parts.slice(1),
                { x: nodeData.x, y: nodeData.y }
            );

            const adjustedCards = newCards.map((card, index) => ({
                ...card,
                ...this.calculateSplitCardPosition(nodeData, index + 1),
                width: nodeData.width,
                height: nodeData.height
            }));

            await this.canvasAdapter.mutateData((canvasData) => {
                canvasData.nodes = canvasData.nodes.map((node) =>
                    node.id === nodeData.id ? { ...nodeData, text: parts[0] } : node
                );
                canvasData.nodes.push(...adjustedCards);
            });
            await this.canvasAdapter.requestSave();

            new Notice(successMessage);
        } catch (error) {
            console.error("Failed to split card:", error);
            new Notice(t("notice.splitFailed"));
        }
    }

    private async measure(operation: string, details: Record<string, unknown>, action: () => Promise<void>): Promise<void> {
        if (!this.performanceService) {
            await action();
            return;
        }

        await this.performanceService.measure(operation, action, details);
    }

    private getDelimitedParts(text: string, delimiter: string): string[] {
        if (!delimiter?.trim()) {
            return [];
        }

        const normalizedDelimiter = delimiter.trim();
        const lines = text.split(/\r?\n/);
        const parts: string[] = [];
        let currentLines: string[] = [];

        for (const line of lines) {
            if (this.isDelimiterLine(line, normalizedDelimiter)) {
                const part = currentLines.join("\n").trim();
                if (part) {
                    parts.push(part);
                }
                currentLines = [];
                continue;
            }

            currentLines.push(line);
        }

        const finalPart = currentLines.join("\n").trim();
        if (finalPart) {
            parts.push(finalPart);
        }

        return parts;
    }

    private getBlankLineParts(text: string, delimiter?: string): string[] {
        const normalizedDelimiter = delimiter?.trim();

        return text
            .split(/\r?\n[ \t]*\r?\n(?:[ \t]*\r?\n)*/)
            .map((part) => part.trim())
            .filter((part) => !!part && part !== normalizedDelimiter);
    }

    private getHeadingSplitParts(text: string, level: number): string[] {
        const lines = text.split(/\r?\n/);
        const sections: string[] = [];
        const introLines: string[] = [];
        let currentLines: string[] | null = null;

        for (const line of lines) {
            if (this.isHeadingOfLevel(line, level)) {
                if (currentLines) {
                    const section = currentLines.join("\n").trim();
                    if (section) {
                        sections.push(section);
                    }
                }

                currentLines = introLines.length > 0
                    ? [...introLines, "", line]
                    : [line];
                introLines.length = 0;
                continue;
            }

            if (currentLines) {
                currentLines.push(line);
            } else {
                introLines.push(line);
            }
        }

        if (currentLines) {
            const section = currentLines.join("\n").trim();
            if (section) {
                sections.push(section);
            }
        }

        return sections;
    }

    private isHeadingOfLevel(line: string, level: number): boolean {
        const match = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
        return !!match && match[1].length === level;
    }

    private isDelimiterLine(line: string, delimiter: string): boolean {
        return line.trim() === delimiter;
    }

    private calculateSplitCardPosition(baseCard: CanvasNodeData, cardIndex: number): Position {
        const cardsPerRow = this.getValidSplitCardsPerRow();
        const column = cardIndex % cardsPerRow;
        const row = Math.floor(cardIndex / cardsPerRow);

        return {
            x: baseCard.x + (baseCard.width + this.cardSpacing) * column,
            y: baseCard.y + (baseCard.height + this.cardSpacing) * row
        };
    }

    private getValidSplitCardsPerRow(): number {
        const value = this.getSplitCardsPerRow();
        if (!Number.isInteger(value) || value < MIN_SPLIT_CARDS_PER_ROW || value > MAX_SPLIT_CARDS_PER_ROW) {
            return DEFAULT_SPLIT_CARDS_PER_ROW;
        }

        return value;
    }

    createCardsFromContent(contents: string[], basePosition: Position): CanvasNodeData[] {
        return contents.map((content, index) => ({
            id: this.generateUniqueId(),
            type: 'text',
            text: content,
            x: basePosition.x + (this.defaultCardWidth + this.cardSpacing) * (index + 1),
            y: basePosition.y,
            width: this.defaultCardWidth,
            height: this.defaultCardHeight
        }));
    }

    generateUniqueId(): string {
        return `${Math.random().toString(36).slice(2, 11)}`;
    }

    calculateNewCardPosition(baseCard: CardData, index: number, cardSpacing?: number): Position {
        const spacing = cardSpacing || this.cardSpacing;
        return {
            x: baseCard.position.x + (baseCard.dimensions.width + spacing) * index,
            y: baseCard.position.y
        };
    }

    private lastSizeOperation: {
        type: string;
        originalStates: Array<{id: string, width: number, height: number}>;
        timestamp: number;
    } | null = null;

    /**
     * 分析选中卡片的尺寸，返回统一选项
     * 重点：只返回用户真正需要的信息
     */
    private analyzeCardSizes(nodes: CanvasNode[]): {
        minSize: { width: number, height: number },
        maxSize: { width: number, height: number },
        hasVariedSizes: boolean,
        cardCount: number
    } {
        const textNodes = nodes.filter(node => node.getData().type === "text");
        
        if (textNodes.length === 0) {
            throw new Error(t("errors.noSelectedTextCards"));
        }

        const sizes = textNodes.map(node => {
            const data = node.getData();
            return { width: data.width, height: data.height };
        });

        const minWidth = Math.min(...sizes.map(s => s.width));
        const maxWidth = Math.max(...sizes.map(s => s.width));
        const minHeight = Math.min(...sizes.map(s => s.height));
        const maxHeight = Math.max(...sizes.map(s => s.height));

        return {
            minSize: { width: minWidth, height: minHeight },
            maxSize: { width: maxWidth, height: maxHeight },
            hasVariedSizes: minWidth !== maxWidth || minHeight !== maxHeight,
            cardCount: textNodes.length
        };
    }

    private async applyDimensionChange(nodes: CanvasNode[], targetWidth?: number, targetHeight?: number, successMessage?: string): Promise<void> {
        const textNodes = nodes.filter(node => node.getData().type === "text");
        const startedAt = performance.now();
        
        if (textNodes.length === 0) {
            throw new Error(t("errors.noResizableTextCards"));
        }

        // 验证尺寸合理性
        if (targetWidth !== undefined && (targetWidth < 50 || targetWidth > 2000)) {
            throw new Error(t("errors.widthOutOfRange"));
        }
        if (targetHeight !== undefined && (targetHeight < 50 || targetHeight > 2000)) {
            throw new Error(t("errors.heightOutOfRange"));
        }

        try {
            const canvasData = this.canvasAdapter.getData();
            
            textNodes.forEach(node => {
                const nodeData = canvasData.nodes.find(n => n.id === node.id);
                if (nodeData) {
                    if (targetWidth !== undefined) nodeData.width = targetWidth;
                    if (targetHeight !== undefined) nodeData.height = targetHeight;
                }
            });

            await this.canvasAdapter.setData(canvasData);
            await this.canvasAdapter.requestSave();

            this.performanceService?.log("card.dimensionChange", {
                nodeCount: textNodes.length,
                targetWidth: targetWidth ?? "unchanged",
                targetHeight: targetHeight ?? "unchanged",
                durationMs: Math.round((performance.now() - startedAt) * 100) / 100
            });

            if (successMessage) {
                new Notice(successMessage);
            }

        } catch (error) {
            console.error("Failed to resize card:", error);
            
            const message = error instanceof Error ? error.message : String(error);
            if (message.includes("Canvas")) {
                throw new Error(t("errors.canvasOperationFailed"));
            } else if (message.includes("save")) {
                throw new Error(t("errors.saveFailedCheckPermissions"));
            } else {
                throw new Error(t("errors.operationFailedWithMessage", { message }));
            }
        }
    }

    /**
     * 统一卡片尺寸 - 核心功能，简单高效
     */
    async unifyCardSizes(nodes: CanvasNode[], targetSize: 'min' | 'max' | { width: number, height: number }): Promise<void> {

        // 分析当前尺寸
        const analysis = this.analyzeCardSizes(nodes);
        
        // 确定目标尺寸
        let targetWidth: number, targetHeight: number;
        
        if (targetSize === 'min') {
            targetWidth = analysis.minSize.width;
            targetHeight = analysis.minSize.height;
        } else if (targetSize === 'max') {
            targetWidth = analysis.maxSize.width;
            targetHeight = analysis.maxSize.height;
        } else {
            targetWidth = targetSize.width;
            targetHeight = targetSize.height;
        }

        const msg = t("notice.unifiedCardSize", {
            count: nodes.filter(n => n.getData().type === "text").length,
            width: targetWidth,
            height: targetHeight
        });
        await this.applyDimensionChange(nodes, targetWidth, targetHeight, msg);
    }

    /**
     * 只统一卡片宽度
     */
    async unifyCardWidth(nodes: CanvasNode[], targetWidth: number): Promise<void> {
        const count = nodes.filter(n => n.getData().type === "text").length;
        const msg = t("notice.unifiedCardWidth", { count, width: targetWidth });
        await this.applyDimensionChange(nodes, targetWidth, undefined, msg);
    }

    /**
     * 只统一卡片高度
     */
    async unifyCardHeight(nodes: CanvasNode[], targetHeight: number): Promise<void> {
        const count = nodes.filter(n => n.getData().type === "text").length;
        const msg = t("notice.unifiedCardHeight", { count, height: targetHeight });
        await this.applyDimensionChange(nodes, undefined, targetHeight, msg);
    }

    async arrangeCards(nodes: CanvasNode[], options: {
        direction: 'horizontal' | 'vertical';
        spacing: number;
    }): Promise<void> {
        const startedAt = performance.now();
        const result = await arrangeSelectedTextCards({
            selection: new Set(nodes),
            getData: () => this.canvasAdapter.getData(),
            setData: (data) => this.canvasAdapter.setData(data),
            requestSave: () => this.canvasAdapter.requestSave(),
        }, options);

        this.performanceService?.log("card.arrange", {
            nodeCount: result.count,
            direction: options.direction,
            spacing: options.spacing,
            durationMs: Math.round((performance.now() - startedAt) * 100) / 100
        });

        const direction = t(options.direction === 'horizontal'
            ? "toolbar.arrange.direction.horizontal"
            : "toolbar.arrange.direction.vertical");
        new Notice(t("notice.arrangedCards", {
            count: result.count,
            direction,
            spacing: options.spacing
        }));
    }
}
