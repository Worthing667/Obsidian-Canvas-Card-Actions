import { CanvasData, CanvasDataModel, CanvasNodeData } from "../domain/models/CanvasData";
import { t } from "../i18n";
import type { Canvas, CanvasNode } from "../types/canvas";

export interface CanvasDiagnostics {
    log(operation: string, details: Record<string, unknown>): void;
}

export interface ICanvasAdapter {
    getData(): CanvasData;
    setData(data: CanvasData): Promise<void>;
    getSelectedNodes(): CanvasNode[];
    replaceSelection(nodes: CanvasNode[]): void;
    findNodeById(id: string): CanvasNode | null;
    requestSave(): Promise<void>;
    mutateData(mutator: (data: CanvasData) => void): Promise<CanvasData>;
    updateNode(nodeData: CanvasNodeData): Promise<void>;
    addNode(nodeData: CanvasNodeData): Promise<void>;
    addNodes(nodes: CanvasNodeData[]): Promise<void>;
    removeNodes(ids: Set<string>): Promise<void>;
}

interface LocateNodeOptions {
    padding?: number;
}

export class CanvasAdapter implements ICanvasAdapter {
    constructor(
        private canvas: Canvas,
        private diagnostics?: CanvasDiagnostics
    ) {
        if (!canvas) {
            throw new Error("Canvas instance is required");
        }
    }

    getData(): CanvasData {
        try {
            const data = this.canvas.getData();
            return data || { nodes: [], edges: [] };
        } catch (error) {
            console.error("Failed to get canvas data:", error);
            throw new Error(t("errors.canvasGetDataFailed"));
        }
    }

    async setData(data: CanvasData): Promise<void> {
        const startedAt = performance.now();
        try {
            await this.canvas.setData(data);
            this.log("canvas.setData", {
                nodeCount: data.nodes?.length || 0,
                edgeCount: data.edges?.length || 0,
                durationMs: this.getDurationMs(startedAt)
            });
        } catch (error) {
            console.error("Failed to set canvas data:", error);
            throw new Error(t("errors.canvasSetDataFailed"));
        }
    }

    getSelectedNodes(): CanvasNode[] {
        try {
            if (this.canvas.selection && this.canvas.selection.size > 0) {
                return Array.from(this.canvas.selection);
            }
            return [];
        } catch (error) {
            console.error("Failed to get selected nodes:", error);
            return [];
        }
    }

    replaceSelection(nodes: CanvasNode[]): void {
        try {
            const nextSelection = new Set(nodes);
            const applySelection = () => {
                this.canvas.selection = nextSelection;
            };

            if (typeof this.canvas.updateSelection === "function") {
                this.canvas.updateSelection(applySelection);
                return;
            }

            applySelection();
        } catch (error) {
            console.error("Failed to replace selection:", error);
            throw new Error(t("errors.canvasSelectionUpdateFailed"));
        }
    }

    findNodeById(id: string): CanvasNode | null {
        try {
            return this.canvas.nodes?.get(id) || null;
        } catch (error) {
            console.error("Failed to find node by id:", error);
            return null;
        }
    }

    locateNode(id: string, options: LocateNodeOptions = {}): boolean {
        const node = this.findNodeById(id);
        if (!node) {
            return false;
        }

        const data = node.getData();
        const padding = Math.max(0, options.padding ?? 120);
        const bbox = {
            minX: (data.x ?? 0) - padding,
            minY: (data.y ?? 0) - padding,
            maxX: (data.x ?? 0) + (data.width ?? 0) + padding,
            maxY: (data.y ?? 0) + (data.height ?? 0) + padding,
        };

        try {
            if (typeof this.canvas.zoomToBbox === "function") {
                this.canvas.zoomToBbox(bbox);
                this.canvas.requestFrame?.();
                return true;
            }

            if (typeof this.canvas.zoomToSelection === "function") {
                this.canvas.zoomToSelection();
                this.canvas.requestFrame?.();
                return true;
            }

            return this.locateNodeWithViewport(data.x ?? 0, data.y ?? 0, data.width ?? 0, data.height ?? 0);
        } catch (error) {
            console.warn("Failed to locate canvas node:", error);
            return false;
        }
    }

    async requestSave(): Promise<void> {
        const startedAt = performance.now();
        try {
            await this.canvas.requestSave();
            this.log("canvas.requestSave", {
                durationMs: this.getDurationMs(startedAt)
            });
        } catch (error) {
            console.error("Failed to request save:", error);
            throw new Error(t("errors.canvasSaveFailed"));
        }
    }

    async mutateData(mutator: (data: CanvasData) => void): Promise<CanvasData> {
        const currentData = this.getData();
        const beforeNodeCount = currentData.nodes?.length || 0;
        const beforeEdgeCount = currentData.edges?.length || 0;
        const nextData: CanvasData = {
            ...currentData,
            nodes: [...(currentData.nodes || [])],
            edges: [...(currentData.edges || [])]
        };

        mutator(nextData);
        this.log("canvas.mutateData", {
            beforeNodeCount,
            afterNodeCount: nextData.nodes.length,
            nodeDelta: nextData.nodes.length - beforeNodeCount,
            beforeEdgeCount,
            afterEdgeCount: nextData.edges.length,
            edgeDelta: nextData.edges.length - beforeEdgeCount
        });
        await this.setData(nextData);
        return nextData;
    }

    private log(operation: string, details: Record<string, unknown>): void {
        this.diagnostics?.log(operation, details);
    }

    private locateNodeWithViewport(x: number, y: number, width: number, height: number): boolean {
        if (typeof this.canvas.setViewport !== "function") {
            return false;
        }

        const viewportRect = this.getViewportRect();
        if (!viewportRect) {
            return false;
        }

        const zoom = this.canvas.tZoom || this.canvas.zoom || 1;
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        const tx = viewportRect.width / 2 - centerX * zoom;
        const ty = viewportRect.height / 2 - centerY * zoom;

        this.canvas.setViewport(tx, ty, zoom);
        this.canvas.requestFrame?.();
        return true;
    }

    private getViewportRect(): DOMRect | null {
        if (this.canvas.canvasRect) {
            return this.canvas.canvasRect;
        }

        if (this.canvas.wrapperEl) {
            return this.canvas.wrapperEl.getBoundingClientRect();
        }

        return null;
    }

    private getDurationMs(startedAt: number): number {
        return Math.round((performance.now() - startedAt) * 100) / 100;
    }

    getDataModel(): CanvasDataModel {
        const data = this.getData();
        return CanvasDataModel.fromRawData(data);
    }

    async setDataModel(model: CanvasDataModel): Promise<void> {
        const data = model.toRawData();
        await this.setData(data);
    }

    async updateNode(nodeData: CanvasNodeData): Promise<void> {
        await this.mutateData((data) => {
            data.nodes = data.nodes.map(node =>
                node.id === nodeData.id ? nodeData : node
            );
        });
    }

    async addNode(nodeData: CanvasNodeData): Promise<void> {
        await this.mutateData((data) => {
            data.nodes = [...data.nodes, nodeData];
        });
    }

    async addNodes(nodes: CanvasNodeData[]): Promise<void> {
        await this.mutateData((data) => {
            data.nodes = [...data.nodes, ...nodes];
        });
    }

    async removeNodes(ids: Set<string>): Promise<void> {
        await this.mutateData((data) => {
            data.nodes = data.nodes.filter(node => !ids.has(node.id));
            data.edges = data.edges.filter(edge => !ids.has(edge.fromNode) && !ids.has(edge.toNode));
        });
    }
}
