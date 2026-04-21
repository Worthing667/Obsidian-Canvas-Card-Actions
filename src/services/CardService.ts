import { CardData, Position } from "../domain/models/Card";
import { CanvasNodeData } from "../domain/models/CanvasData";
import { ICanvasAdapter } from "../adapters/CanvasAdapter";
import { Notice } from "obsidian";

export interface HeadingSplitOption {
    level: number;
    cardCount: number;
}

export interface ICardService {
    splitCard(node: any, delimiter: string): Promise<void>;
    splitCardByHeadingLevel(node: any, level: number): Promise<void>;
    getAvailableHeadingSplitOptions(node: any): HeadingSplitOption[];
    countDelimitedParts(text: string, delimiter: string): number;
    createCardsFromContent(contents: string[], basePosition: Position): CanvasNodeData[];
    generateUniqueId(): string;
    calculateNewCardPosition(baseCard: CardData, index: number, cardSpacing?: number): Position;
    unifyCardSizes(nodes: any[], targetSize: 'min' | 'max' | { width: number, height: number }): Promise<void>;
    unifyCardWidth(nodes: any[], targetWidth: number): Promise<void>;
    unifyCardHeight(nodes: any[], targetHeight: number): Promise<void>;
}

export class CardService implements ICardService {
    constructor(
        private canvasAdapter: ICanvasAdapter,
        private readonly cardSpacing: number = 20,
        private readonly defaultCardWidth: number = 400,
        private readonly defaultCardHeight: number = 400
    ) {}

    async splitCard(node: any, delimiter: string): Promise<void> {
        const nodeData = node.getData();
        const text = nodeData.text;

        if (!text || !delimiter?.trim()) {
            new Notice("卡片中未找到分隔符。");
            return;
        }

        const parts = this.getDelimitedParts(text, delimiter);
        if (parts.length <= 1) {
            new Notice("没有可拆分的内容。");
            return;
        }

        await this.applySplit(nodeData, parts, `卡片已拆分为 ${parts.length} 张卡片`);
    }

    async splitCardByHeadingLevel(node: any, level: number): Promise<void> {
        const nodeData = node.getData();
        const text = nodeData.text;

        if (!text || level < 1 || level > 6) {
            new Notice("当前卡片没有可用于按标题拆分的内容。");
            return;
        }

        const parts = this.getHeadingSplitParts(text, level);
        if (parts.length <= 1) {
            new Notice(`当前卡片无法按 ${level} 级标题拆分。`);
            return;
        }

        await this.applySplit(nodeData, parts, `卡片已按 ${level} 级标题拆分为 ${parts.length} 张卡片`);
    }

    getAvailableHeadingSplitOptions(node: any): HeadingSplitOption[] {
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

    private async applySplit(nodeData: any, parts: string[], successMessage: string): Promise<void> {
        try {
            // 更新原始卡片
            const updatedNodeData = { ...nodeData, text: parts[0] };
            await this.canvasAdapter.updateNode(updatedNodeData);

            // 创建新卡片
            const newCards = this.createCardsFromContent(
                parts.slice(1),
                { x: nodeData.x, y: nodeData.y }
            );

            // 调整新卡片的位置
            const adjustedCards = newCards.map((card, index) => ({
                ...card,
                x: nodeData.x + (nodeData.width + this.cardSpacing) * (index + 1),
                y: nodeData.y,
                width: nodeData.width,
                height: nodeData.height
            }));

            // 添加新卡片到画布
            await this.canvasAdapter.addNodes(adjustedCards);
            await this.canvasAdapter.requestSave();

            new Notice(successMessage);
        } catch (error) {
            console.error("拆分卡片失败:", error);
            new Notice("拆分卡片失败，请查看控制台了解详情");
        }
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
        return `${Math.random().toString(36).substr(2, 9)}`;
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
    private analyzeCardSizes(nodes: any[]): {
        minSize: { width: number, height: number },
        maxSize: { width: number, height: number },
        hasVariedSizes: boolean,
        cardCount: number
    } {
        const textNodes = nodes.filter(node => node.getData().type === "text");
        
        if (textNodes.length === 0) {
            throw new Error("没有选中文本卡片");
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

    private async applyDimensionChange(nodes: any[], targetWidth?: number, targetHeight?: number, successMessage?: string): Promise<void> {
        const textNodes = nodes.filter(node => node.getData().type === "text");
        
        if (textNodes.length === 0) {
            throw new Error("没有找到可调整的文本卡片");
        }

        // 验证尺寸合理性
        if (targetWidth !== undefined && (targetWidth < 50 || targetWidth > 2000)) {
            throw new Error("宽度超出合理范围(50-2000像素)");
        }
        if (targetHeight !== undefined && (targetHeight < 50 || targetHeight > 2000)) {
            throw new Error("高度超出合理范围(50-2000像素)");
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

            if (successMessage) {
                new Notice(successMessage);
            }

        } catch (error) {
            console.error("尺寸调整操作失败:", error);
            
            if (error.message.includes("Canvas")) {
                throw new Error("画布操作失败，请刷新页面后重试");
            } else if (error.message.includes("save")) {
                throw new Error("保存失败，请检查文件权限");
            } else {
                throw new Error(`操作失败：${error.message}`);
            }
        }
    }

    /**
     * 统一卡片尺寸 - 核心功能，简单高效
     */
    async unifyCardSizes(nodes: any[], targetSize: 'min' | 'max' | { width: number, height: number }): Promise<void> {

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

        const msg = `已统一 ${nodes.filter(n => n.getData().type === "text").length} 个卡片尺寸为 ${targetWidth}×${targetHeight}`;
        await this.applyDimensionChange(nodes, targetWidth, targetHeight, msg);
    }

    /**
     * 只统一卡片宽度
     */
    async unifyCardWidth(nodes: any[], targetWidth: number): Promise<void> {
        const count = nodes.filter(n => n.getData().type === "text").length;
        const msg = `已统一 ${count} 个卡片宽度为 ${targetWidth}px，高度保持不变`;
        await this.applyDimensionChange(nodes, targetWidth, undefined, msg);
    }

    /**
     * 只统一卡片高度
     */
    async unifyCardHeight(nodes: any[], targetHeight: number): Promise<void> {
        const count = nodes.filter(n => n.getData().type === "text").length;
        const msg = `已统一 ${count} 个卡片高度为 ${targetHeight}px，宽度保持不变`;
        await this.applyDimensionChange(nodes, undefined, targetHeight, msg);
    }
}
