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

    /**
     * 统一卡片尺寸 - 核心功能，简单高效
     * 重点：批量操作，事务性，可恢复
     */
    async unifyCardSizes(nodes: any[], targetSize: 'min' | 'max' | { width: number, height: number }): Promise<void> {
        const textNodes = nodes.filter(node => node.getData().type === "text");
        
        if (textNodes.length === 0) {
            throw new Error("没有找到可调整的文本卡片");
        }

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

        // 验证尺寸合理性
        if (targetWidth < 50 || targetHeight < 50 || targetWidth > 2000 || targetHeight > 2000) {
            throw new Error("尺寸超出合理范围(50-2000像素)");
        }

        try {
            // 保存原始状态用于撤销 - 这比统计信息重要100倍！
            const originalStates = textNodes.map(node => {
                const data = node.getData();
                return { 
                    id: data.id, 
                    width: data.width, 
                    height: data.height 
                };
            });

            // 批量更新 - 关键：一次性获取所有数据，批量修改，一次性提交
            const canvasData = this.canvasAdapter.getData();
            
            // 在内存中批量修改所有节点
            textNodes.forEach(node => {
                const nodeData = canvasData.nodes.find(n => n.id === node.id);
                if (nodeData) {
                    nodeData.width = targetWidth;
                    nodeData.height = targetHeight;
                }
            });

            // 一次性提交所有更改
            await this.canvasAdapter.setData(canvasData);
            await this.canvasAdapter.requestSave();

            // 存储撤销信息 - 简单但实用的撤销机制
            this.lastSizeOperation = {
                type: 'unify',
                originalStates,
                timestamp: Date.now()
            };

            new Notice(`已统一 ${textNodes.length} 个卡片尺寸为 ${targetWidth}×${targetHeight}`);

        } catch (error) {
            // 实用的错误处理 - 给用户可操作的信息
            console.error("统一尺寸操作失败:", error);
            
            if (error.message.includes("Canvas")) {
                throw new Error("Canvas操作失败，请刷新页面后重试");
            } else if (error.message.includes("save")) {
                throw new Error("保存失败，请检查文件权限");
            } else {
                throw new Error(`操作失败：${error.message}`);
            }
        }
    }

    /**
     * 撤销上一次尺寸操作 - 比复杂的预览更有用
     */
    async undoLastSizeOperation(): Promise<void> {
        if (!this.lastSizeOperation || Date.now() - this.lastSizeOperation.timestamp > 300000) {
            throw new Error("没有可撤销的操作或操作已过期(5分钟内有效)");
        }

        try {
            const canvasData = this.canvasAdapter.getData();
            
            // 恢复原始尺寸
            this.lastSizeOperation.originalStates.forEach(state => {
                const nodeData = canvasData.nodes.find(n => n.id === state.id);
                if (nodeData) {
                    nodeData.width = state.width;
                    nodeData.height = state.height;
                }
            });

            await this.canvasAdapter.setData(canvasData);
            await this.canvasAdapter.requestSave();

            new Notice(`已撤销尺寸操作，恢复 ${this.lastSizeOperation.originalStates.length} 个卡片`);
            this.lastSizeOperation = null;

        } catch (error) {
            console.error("撤销操作失败:", error);
            throw new Error("撤销失败，请手动调整");
        }
    }

    /**
     * 快速检查是否需要统一尺寸
     * 这个方法只在菜单显示时调用，避免不必要的计算
     */
    canUnifyCardSizes(nodes: any[]): { canUnify: boolean, suggestion: string } {
        try {
            const analysis = this.analyzeCardSizes(nodes);
            
            if (!analysis.hasVariedSizes) {
                return { canUnify: false, suggestion: "卡片尺寸已统一" };
            }

            if (analysis.cardCount === 1) {
                return { canUnify: false, suggestion: "需要选择多个卡片" };
            }

            return { 
                canUnify: true, 
                suggestion: `统一 ${analysis.cardCount} 个卡片的尺寸` 
            };
        } catch (error) {
            return { canUnify: false, suggestion: "无法分析卡片尺寸" };
        }
    }

    /**
     * 获取常用尺寸预设 - 简单实用的快捷选项
     */
    getCommonSizes(): Array<{ name: string, width: number, height: number }> {
        return [
            { name: "小卡片", width: 250, height: 200 },
            { name: "标准卡片", width: 400, height: 300 },
            { name: "大卡片", width: 500, height: 400 }
        ];
    }

    /**
     * 只统一卡片宽度 - 新增功能
     */
    async unifyCardWidth(nodes: any[], targetWidth: number): Promise<void> {
        const textNodes = nodes.filter(node => node.getData().type === "text");
        
        if (textNodes.length === 0) {
            throw new Error("没有找到可调整的文本卡片");
        }

        // 验证宽度合理性
        if (targetWidth < 50 || targetWidth > 2000) {
            throw new Error("宽度超出合理范围(50-2000像素)");
        }

        try {
            // 保存原始状态用于撤销
            const originalStates = textNodes.map(node => {
                const data = node.getData();
                return { 
                    id: data.id, 
                    width: data.width, 
                    height: data.height 
                };
            });

            // 批量更新 - 只修改宽度，保持高度不变
            const canvasData = this.canvasAdapter.getData();
            
            // 在内存中批量修改所有节点的宽度
            textNodes.forEach(node => {
                const nodeData = canvasData.nodes.find(n => n.id === node.id);
                if (nodeData) {
                    nodeData.width = targetWidth;
                }
            });

            // 一次性提交所有更改
            await this.canvasAdapter.setData(canvasData);
            await this.canvasAdapter.requestSave();

            // 存储撤销信息
            this.lastSizeOperation = {
                type: 'unifyWidth',
                originalStates,
                timestamp: Date.now()
            };

            new Notice(`已统一 ${textNodes.length} 个卡片宽度为 ${targetWidth}px，高度保持不变`);

        } catch (error) {
            console.error("统一宽度操作失败:", error);
            
            if (error.message.includes("Canvas")) {
                throw new Error("Canvas操作失败，请刷新页面后重试");
            } else if (error.message.includes("save")) {
                throw new Error("保存失败，请检查文件权限");
            } else {
                throw new Error(`操作失败：${error.message}`);
            }
        }
    }

    /**
     * 只统一卡片高度 - 新增功能
     */
    async unifyCardHeight(nodes: any[], targetHeight: number): Promise<void> {
        const textNodes = nodes.filter(node => node.getData().type === "text");
        
        if (textNodes.length === 0) {
            throw new Error("没有找到可调整的文本卡片");
        }

        // 验证高度合理性
        if (targetHeight < 50 || targetHeight > 2000) {
            throw new Error("高度超出合理范围(50-2000像素)");
        }

        try {
            // 保存原始状态用于撤销
            const originalStates = textNodes.map(node => {
                const data = node.getData();
                return { 
                    id: data.id, 
                    width: data.width, 
                    height: data.height 
                };
            });

            // 批量更新 - 只修改高度，保持宽度不变
            const canvasData = this.canvasAdapter.getData();
            
            // 在内存中批量修改所有节点的高度
            textNodes.forEach(node => {
                const nodeData = canvasData.nodes.find(n => n.id === node.id);
                if (nodeData) {
                    nodeData.height = targetHeight;
                }
            });

            // 一次性提交所有更改
            await this.canvasAdapter.setData(canvasData);
            await this.canvasAdapter.requestSave();

            // 存储撤销信息
            this.lastSizeOperation = {
                type: 'unifyHeight',
                originalStates,
                timestamp: Date.now()
            };

            new Notice(`已统一 ${textNodes.length} 个卡片高度为 ${targetHeight}px，宽度保持不变`);

        } catch (error) {
            console.error("统一高度操作失败:", error);
            
            if (error.message.includes("Canvas")) {
                throw new Error("Canvas操作失败，请刷新页面后重试");
            } else if (error.message.includes("save")) {
                throw new Error("保存失败，请检查文件权限");
            } else {
                throw new Error(`操作失败：${error.message}`);
            }
        }
    }
}