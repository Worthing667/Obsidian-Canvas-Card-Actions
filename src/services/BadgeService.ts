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
    setBadges(nodes: CanvasNode[], badgeTexts: string[]): Promise<number>;
    removeBadges(nodes: CanvasNode[]): Promise<number>;
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

    async setBadges(nodes: CanvasNode[], badgeTexts: string[]): Promise<number> {
        try {
            if (nodes.length !== badgeTexts.length) {
                throw new Error("批量标记数量与卡片数量不一致");
            }

            const badgeTextByNodeId = new Map<string, string>();
            nodes.forEach((node, index) => {
                if (node?.id && !badgeTextByNodeId.has(node.id)) {
                    badgeTextByNodeId.set(node.id, badgeTexts[index] || "");
                }
            });

            const assignments = this.getValidUniqueNodes(nodes).map((node) => {
                return {
                    node,
                    badge: BadgeData.create(badgeTextByNodeId.get(node.id) || "")
                };
            });

            assignments.forEach(({ badge }) => {
                if (!badge.isValid()) {
                    throw new Error("标记只支持数字序号，格式如 1、2、2.1");
                }
            });

            if (assignments.length === 0) {
                new Notice("未找到可标记的文本卡片");
                return 0;
            }

            const canvasData = this.canvasAdapter.getData();
            const nodeDataById = new Map(canvasData.nodes.map((nodeData) => [nodeData.id, nodeData]));
            let updatedCount = 0;

            assignments.forEach(({ node, badge }) => {
                const nodeData = nodeDataById.get(node.id);
                if (!nodeData) {
                    return;
                }

                if (this.isBadgeDisplayEnabled()) {
                    this.applyBadgeToNode(node, badge);
                } else {
                    this.clearBadgeFromNode(node);
                }

                nodeData.badge = badge.content;
                delete nodeData.badgeType;
                updatedCount += 1;
            });

            if (updatedCount === 0) {
                throw new Error("在画布数据中找不到可标记节点");
            }

            await this.canvasAdapter.setData(canvasData);
            await this.canvasAdapter.requestSave();
            this.refreshBadgeDomSoon();
            new Notice(`已为 ${updatedCount} 张卡片添加标记`);
            return updatedCount;
        } catch (error) {
            console.error("批量设置标记时出错:", error);
            new Notice("批量设置标记失败，请查看控制台了解详情");
            throw error;
        }
    }

    async removeBadges(nodes: CanvasNode[]): Promise<number> {
        try {
            const targetNodes = this.getValidUniqueNodes(nodes);

            if (targetNodes.length === 0) {
                new Notice("未找到可移除标记的文本卡片");
                return 0;
            }

            const canvasData = this.canvasAdapter.getData();
            const nodeDataById = new Map(canvasData.nodes.map((nodeData) => [nodeData.id, nodeData]));
            let updatedCount = 0;

            targetNodes.forEach((node) => {
                const nodeData = nodeDataById.get(node.id);
                if (!nodeData) {
                    return;
                }

                this.clearBadgeFromNode(node);
                delete nodeData.badge;
                delete nodeData.badgeType;
                updatedCount += 1;
            });

            if (updatedCount === 0) {
                throw new Error("在画布数据中找不到可移除标记节点");
            }

            await this.canvasAdapter.setData(canvasData);
            await this.canvasAdapter.requestSave();
            this.refreshBadgeDomSoon();
            new Notice(`已移除 ${updatedCount} 张卡片的标记`);
            return updatedCount;
        } catch (error) {
            console.error("批量移除标记时出错:", error);
            new Notice("批量移除标记失败，请查看控制台了解详情");
            throw error;
        }
    }

    applyBadgeToNode(node: CanvasNode, badge: BadgeData): void {
        if (!this.isBadgeDisplayEnabled()) {
            this.clearBadgeFromNode(node);
            return;
        }

        const elements = this.getNodeElements(node);
        if (elements.length === 0) {
            this.appliedBadgesByNodeId.delete(node.id);
            return;
        }

        const currentBadge = this.appliedBadgesByNodeId.get(node.id);
        const isAlreadyRendered = elements.every((element) => {
            return element.getAttribute("data-badge") === badge.content;
        });
        if (currentBadge === badge.content && isAlreadyRendered) {
            return;
        }

        elements.forEach(element => {
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
        const nodeData = node.getData?.();
        const isTextCard = node.text !== undefined || nodeData?.type === "text";
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

    private getValidUniqueNodes(nodes: CanvasNode[]): CanvasNode[] {
        const seenNodeIds = new Set<string>();

        return nodes.filter((node) => {
            if (!node?.id || seenNodeIds.has(node.id) || !this.isValidBadgeNode(node)) {
                return false;
            }

            seenNodeIds.add(node.id);
            return true;
        });
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
        this.refreshBadgeDomSoon();
    }

    private refreshBadgeDomSoon(): void {
        if (!this.isBadgeDisplayEnabled()) {
            return;
        }

        const render = () => {
            void this.loadCanvasBadges();
        };

        if (typeof window === "undefined") {
            render();
            return;
        }

        window.requestAnimationFrame(() => {
            render();
            window.setTimeout(render, 50);
            window.setTimeout(render, 250);
            window.setTimeout(render, 700);
        });
    }
}
