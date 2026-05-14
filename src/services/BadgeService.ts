import { Notice } from "obsidian";
import { ICanvasAdapter } from "../adapters/CanvasAdapter";
import { BadgeData } from "../domain/models/Badge";
import type { CanvasNode } from "../types/canvas";

export interface BadgeRenderEntry {
    id: string;
    badge: string;
}

export interface IBadgeService {
    getCurrentBadge(node: CanvasNode): Promise<BadgeData | null>;
    setBadge(node: CanvasNode, badgeText: string): Promise<void>;
    removeBadge(node: CanvasNode): Promise<void>;
    applyBadgeToNode(node: CanvasNode, badge: BadgeData): void;
    clearBadgeFromNode(node: CanvasNode): void;
    clearCanvasBadgeDom(): void;
    loadCanvasBadges(): Promise<void>;
    getBadgeRenderEntries(): BadgeRenderEntry[];
    applyBadgeByNodeId(nodeId: string, badgeText: string): boolean;
    clearStaleBadgeDom(activeBadgeNodeIds: Set<string>): void;
    isValidBadgeNode(node: CanvasNode): boolean;
}

export class BadgeService implements IBadgeService {
    private appliedBadgesByNodeId = new Map<string, string>();

    constructor(
        private canvasAdapter: ICanvasAdapter,
        private isBadgeDisplayEnabled: () => boolean = () => true
    ) {}

    getCurrentBadge(node: CanvasNode): Promise<BadgeData | null> {
        try {
            const canvasData = this.canvasAdapter.getData();
            const nodeData = canvasData.nodes.find(n => n.id === node.id);
            if (nodeData?.badge) {
                return Promise.resolve(BadgeData.create(nodeData.badge));
            }
        } catch (error) {
            console.debug("读取画布标记失败，改为尝试读取 DOM 标记。", error);
        }

        for (const element of this.getNodeElements(node)) {
            const badge = element.getAttribute("data-badge");
            if (badge) {
                return Promise.resolve(BadgeData.create(badge));
            }
        }

        return Promise.resolve(null);
    }

    async setBadge(node: CanvasNode, badgeText: string): Promise<void> {
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

    async removeBadge(node: CanvasNode): Promise<void> {
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

    applyBadgeToNode(node: CanvasNode, badge: BadgeData): void {
        if (!this.isBadgeDisplayEnabled()) {
            this.clearBadgeFromNode(node);
            return;
        }

        const currentBadge = this.appliedBadgesByNodeId.get(node.id);
        if (currentBadge === badge.content) {
            return;
        }

        this.getNodeElements(node).forEach(element => {
            element.setAttribute("data-badge", badge.content);
        });
        this.appliedBadgesByNodeId.set(node.id, badge.content);
    }

    clearBadgeFromNode(node: CanvasNode): void {
        this.getNodeElements(node).forEach(element => {
            element.removeAttribute("data-badge");
            element.removeAttribute("data-badge-type");
        });
        this.appliedBadgesByNodeId.delete(node.id);
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
            this.appliedBadgesByNodeId.clear();
        } catch (error) {
            console.error("清理 Canvas 标记显示时出错:", error);
        }
    }

    loadCanvasBadges(): Promise<void> {
        if (!this.isBadgeDisplayEnabled()) {
            return Promise.resolve();
        }

        try {
            const entries = this.getBadgeRenderEntries();
            entries.forEach((entry) => this.applyBadgeByNodeId(entry.id, entry.badge));
            this.clearStaleBadgeDom(new Set(entries.map((entry) => entry.id)));
        } catch (error) {
            console.error("加载画布标记时出错:", error);
        }

        return Promise.resolve();
    }

    getBadgeRenderEntries(): BadgeRenderEntry[] {
        const canvasData = this.canvasAdapter.getData();

        return canvasData.nodes
            .filter((nodeData) => typeof nodeData.badge === "string" && nodeData.badge.trim())
            .map((nodeData) => ({
                id: nodeData.id,
                badge: String(nodeData.badge)
            }));
    }

    applyBadgeByNodeId(nodeId: string, badgeText: string): boolean {
        const node = this.canvasAdapter.findNodeById(nodeId);
        if (!node) {
            return false;
        }

        this.applyBadgeToNode(node, BadgeData.create(badgeText));
        return true;
    }

    clearStaleBadgeDom(activeBadgeNodeIds: Set<string>): void {
        Array.from(this.appliedBadgesByNodeId.keys()).forEach((nodeId) => {
            if (activeBadgeNodeIds.has(nodeId)) {
                return;
            }

            const node = this.canvasAdapter.findNodeById(nodeId);
            if (node) {
                this.clearBadgeFromNode(node);
                return;
            }

            this.appliedBadgesByNodeId.delete(nodeId);
        });
    }

    isValidBadgeNode(node: CanvasNode): boolean {
        const isTextCard = node.text !== undefined;
        const isMarkdownEmbed = node.nodeEl?.querySelector('.markdown-embed') !== null;
        return isTextCard || isMarkdownEmbed;
    }

    private getNodeElements(node: CanvasNode): Element[] {
        const contentElement = node.nodeEl?.querySelector('.canvas-node-content');
        if (contentElement instanceof Element) {
            return [contentElement];
        }

        const embedElement = node.nodeEl?.querySelector('.markdown-embed');
        if (embedElement instanceof Element) {
            return [embedElement];
        }

        return [];
    }

    private async persistBadgeToCanvas(node: CanvasNode, badge: BadgeData | null): Promise<void> {
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

        delete nodeData.badgeType;

        await this.canvasAdapter.setData(canvasData);
        await this.canvasAdapter.requestSave();
    }
}
