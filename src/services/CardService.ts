import { CardData, Position } from "../domain/models/Card";
import { CanvasNodeData } from "../domain/models/CanvasData";
import { ICanvasAdapter } from "../adapters/CanvasAdapter";
import { Notice } from "obsidian";

export interface ICardService {
    splitCard(node: any, delimiter: string): Promise<void>;
    createCardsFromContent(contents: string[], basePosition: Position): CanvasNodeData[];
    generateUniqueId(): string;
    calculateNewCardPosition(baseCard: CardData, index: number, cardSpacing?: number): Position;
    createCardFromSortedContent(content: string, position: Position): Promise<CanvasNodeData>;
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

        if (!text || !text.includes(delimiter)) {
            new Notice("卡片中未找到分隔符。");
            return;
        }

        const parts = text.split(delimiter).map((p: string) => p.trim()).filter((p: string) => p);
        if (parts.length <= 1) {
            new Notice("没有可拆分的内容。");
            return;
        }

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

            new Notice(`卡片已拆分为 ${parts.length} 张卡片`);
        } catch (error) {
            console.error("拆分卡片失败:", error);
            new Notice("拆分卡片失败，请查看控制台了解详情");
        }
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

    async createCardFromSortedContent(content: string, position: Position): Promise<CanvasNodeData> {
        const nodeData: CanvasNodeData = {
            id: this.generateUniqueId(),
            type: 'text',
            text: content,
            x: position.x,
            y: position.y,
            width: this.defaultCardWidth,
            height: this.defaultCardHeight
        };

        try {
            await this.canvasAdapter.addNode(nodeData);
            await this.canvasAdapter.requestSave();
            return nodeData;
        } catch (error) {
            console.error("创建卡片失败:", error);
            throw new Error("创建卡片失败");
        }
    }
}