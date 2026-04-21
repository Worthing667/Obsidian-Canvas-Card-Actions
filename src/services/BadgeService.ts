import { BadgeData, BadgeType } from "../domain/models/Badge";
import { ICanvasAdapter } from "../adapters/CanvasAdapter";
import { Notice } from "obsidian";

export interface IBadgeService {
    getCurrentBadge(node: any): Promise<BadgeData | null>;
    setBadge(node: any, badgeText: string): Promise<void>;
    removeBadge(node: any): Promise<void>;
    applyBadgeToNode(node: any, badge: BadgeData): void;
    loadCanvasBadges(): Promise<void>;
    isValidBadgeNode(node: any): boolean;
}

export class BadgeService implements IBadgeService {
    constructor(private canvasAdapter: ICanvasAdapter) {}

    async getCurrentBadge(node: any): Promise<BadgeData | null> {
        try {
            // 首先尝试从画布数据中获取
            const canvasData = this.canvasAdapter.getData();
            const nodeData = canvasData.nodes.find(n => n.id === node.id);
            if (nodeData && nodeData.badge) {
                return BadgeData.create(nodeData.badge);
            }
        } catch (error) {
        }

        // 降级方案：从 DOM 获取
        for (const element of this.getNodeElements(node)) {
            const badge = element.getAttribute("data-badge");
            if (badge) {
                return BadgeData.create(badge);
            }
        }

        return null;
    }

    async setBadge(node: any, badgeText: string): Promise<void> {
        try {
            const badge = BadgeData.create(badgeText);
            
            // 第一步：更新 DOM（立即显示效果）
            this.applyBadgeToNode(node, badge);
            
            // 第二步：持久化到画布文件
            await this.persistBadgeToCanvas(node, badge);
            
            new Notice(`徽章已设置: ${badgeText}`);
        } catch (error) {
            console.error("设置徽章时出错:", error);
            new Notice("设置徽章失败，请查看控制台了解详情");
            throw error;
        }
    }

    async removeBadge(node: any): Promise<void> {
        try {
            // 第一步：更新 DOM
            this.removeBadgeFromNode(node);
            
            // 第二步：从画布文件移除
            await this.persistBadgeToCanvas(node, null);
            
            new Notice("徽章已移除");
        } catch (error) {
            console.error("移除徽章时出错:", error);
            new Notice("移除徽章失败，请查看控制台了解详情");
            throw error;
        }
    }

    applyBadgeToNode(node: any, badge: BadgeData): void {
        this.getNodeElements(node).forEach(element => {
            element.setAttribute("data-badge", badge.content);
            element.setAttribute("data-badge-type", badge.type);
        });
    }

    private removeBadgeFromNode(node: any): void {
        this.getNodeElements(node).forEach(element => {
            element.removeAttribute("data-badge");
            element.removeAttribute("data-badge-type");
        });
    }

    private getNodeElements(node: any): Element[] {
        return [
            node.nodeEl?.querySelector('.canvas-node-content'),
            node.nodeEl?.querySelector('.canvas-node-container'),
            node.nodeEl
        ].filter(Boolean);
    }

    private async persistBadgeToCanvas(node: any, badge: BadgeData | null): Promise<void> {
        const canvasData = this.canvasAdapter.getData();
        const nodeData = canvasData.nodes.find(n => n.id === node.id);
        
        if (!nodeData) {
            throw new Error("在画布数据中找不到节点");
        }

        if (badge && !badge.isEmpty()) {
            nodeData.badge = badge.content;
            nodeData.badgeType = badge.type;
        } else {
            delete nodeData.badge;
            delete nodeData.badgeType;
        }

        await this.canvasAdapter.setData(canvasData);
        await this.canvasAdapter.requestSave();
    }

    async loadCanvasBadges(): Promise<void> {
        try {
            const canvasData = this.canvasAdapter.getData();
            
            canvasData.nodes.forEach(nodeData => {
                if (nodeData.badge) {
                    const node = this.canvasAdapter.findNodeById(nodeData.id);
                    if (node) {
                        const badge = BadgeData.create(nodeData.badge);
                        this.applyBadgeToNode(node, badge);
                    }
                }
            });
            
        } catch (error) {
            console.error("加载画布徽章时出错:", error);
        }
    }

    isValidBadgeNode(node: any): boolean {
        const isTextCard = node.text !== undefined;
        const isMarkdownEmbed = node.nodeEl?.querySelector('.markdown-embed') !== null;
        return isTextCard || isMarkdownEmbed;
    }
}
