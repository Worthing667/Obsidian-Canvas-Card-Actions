import { CanvasData, CanvasDataModel, CanvasNodeData } from "../domain/models/CanvasData";
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
            throw new Error("无法获取画布数据");
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
            throw new Error("无法设置画布数据");
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
            throw new Error("无法更新画布选区");
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

    async requestSave(): Promise<void> {
        const startedAt = performance.now();
        try {
            await this.canvas.requestSave();
            this.log("canvas.requestSave", {
                durationMs: this.getDurationMs(startedAt)
            });
        } catch (error) {
            console.error("Failed to request save:", error);
            throw new Error("保存画布失败");
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
