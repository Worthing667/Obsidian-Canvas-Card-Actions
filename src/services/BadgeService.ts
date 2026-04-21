import { Notice } from "obsidian";
import { ICanvasAdapter } from "../adapters/CanvasAdapter";
import { BadgeData } from "../domain/models/Badge";

export interface IBadgeService {
    getCurrentBadge(node: any): Promise<BadgeData | null>;
    setBadge(node: any, badgeText: string): Promise<void>;
    removeBadge(node: any): Promise<void>;
    applyBadgeToNode(node: any, badge: BadgeData): void;
    clearBadgeFromNode(node: any): void;
    clearCanvasBadgeDom(): void;
    loadCanvasBadges(): Promise<void>;
    isValidBadgeNode(node: any): boolean;
}

export class BadgeService implements IBadgeService {
    constructor(
        private canvasAdapter: ICanvasAdapter,
        private isBadgeDisplayEnabled: () => boolean = () => true
    ) {}

    async getCurrentBadge(node: any): Promise<BadgeData | null> {
        try {
            const canvasData = this.canvasAdapter.getData();
            const nodeData = canvasData.nodes.find(n => n.id === node.id);
            if (nodeData?.badge) {
                return BadgeData.create(nodeData.badge);
            }
        } catch (error) {
        }

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
            if (!badge.isValid()) {
                throw new Error("标记只支持数字序号，格式如 1、2、2.1");
            }

            if (this.isBadgeDisplayEnabled()) {
                this.applyBadgeToNode(node, badge);
            } else {
                this.clearBadgeFromNode(node);
            }

            await this.persistBadgeToCanvas(node, badge);
            new Notice(`标记已设置: ${badgeText}`);
        } catch (error) {
            console.error("设置标记时出错:", error);
            new Notice("设置标记失败，请查看控制台了解详情");
            throw error;
        }
    }

    async removeBadge(node: any): Promise<void> {
        try {
            this.clearBadgeFromNode(node);
            await this.persistBadgeToCanvas(node, null);
            new Notice("标记已移除");
        } catch (error) {
            console.error("移除标记时出错:", error);
            new Notice("移除标记失败，请查看控制台了解详情");
            throw error;
        }
    }

    applyBadgeToNode(node: any, badge: BadgeData): void {
        if (!this.isBadgeDisplayEnabled()) {
            this.clearBadgeFromNode(node);
            return;
        }

        this.getNodeElements(node).forEach(element => {
            element.setAttribute("data-badge", badge.content);
        });
    }

    clearBadgeFromNode(node: any): void {
        this.getNodeElements(node).forEach(element => {
            element.removeAttribute("data-badge");
            element.removeAttribute("data-badge-type");
        });
    }

    clearCanvasBadgeDom(): void {
        try {
            const canvasData = this.canvasAdapter.getData();
            canvasData.nodes.forEach((nodeData) => {
                const node = this.canvasAdapter.findNodeById(nodeData.id);
                if (node) {
                    this.clearBadgeFromNode(node);
                }
            });
        } catch (error) {
            console.error("清理 Canvas 标记显示时出错:", error);
        }
    }

    async loadCanvasBadges(): Promise<void> {
        if (!this.isBadgeDisplayEnabled()) {
            return;
        }

        try {
            const canvasData = this.canvasAdapter.getData();

            canvasData.nodes.forEach(nodeData => {
                if (!nodeData.badge) {
                    return;
                }

                const node = this.canvasAdapter.findNodeById(nodeData.id);
                if (node) {
                    this.applyBadgeToNode(node, BadgeData.create(nodeData.badge));
                }
            });
        } catch (error) {
            console.error("加载画布标记时出错:", error);
        }
    }

    isValidBadgeNode(node: any): boolean {
        const isTextCard = node.text !== undefined;
        const isMarkdownEmbed = node.nodeEl?.querySelector('.markdown-embed') !== null;
        return isTextCard || isMarkdownEmbed;
    }

    private getNodeElements(node: any): Element[] {
        return [
            node.nodeEl?.querySelector('.canvas-node-content'),
            node.nodeEl?.querySelector('.markdown-embed'),
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
        } else {
            delete nodeData.badge;
        }

        delete (nodeData as any).badgeType;

        await this.canvasAdapter.setData(canvasData);
        await this.canvasAdapter.requestSave();
    }
}
