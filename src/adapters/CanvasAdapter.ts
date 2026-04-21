import { CanvasData, CanvasDataModel, CanvasNodeData } from "../domain/models/CanvasData";
import { CardData } from "../domain/models/Card";

export interface ICanvasAdapter {
    getData(): CanvasData;
    setData(data: CanvasData): Promise<void>;
    getSelectedNodes(): any[];
    findNodeById(id: string): any | null;
    requestSave(): Promise<void>;
    updateNode(nodeData: CanvasNodeData): Promise<void>;
    addNode(nodeData: CanvasNodeData): Promise<void>;
    addNodes(nodes: CanvasNodeData[]): Promise<void>;
}

export class CanvasAdapter implements ICanvasAdapter {
    constructor(private canvas: any) {
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
        try {
            await this.canvas.setData(data);
        } catch (error) {
            console.error("Failed to set canvas data:", error);
            throw new Error("无法设置画布数据");
        }
    }

    getSelectedNodes(): any[] {
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

    findNodeById(id: string): any | null {
        try {
            return this.canvas.nodes?.get(id) || null;
        } catch (error) {
            console.error("Failed to find node by id:", error);
            return null;
        }
    }

    async requestSave(): Promise<void> {
        try {
            await this.canvas.requestSave();
        } catch (error) {
            console.error("Failed to request save:", error);
            throw new Error("保存画布失败");
        }
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
        const model = this.getDataModel();
        const updatedModel = model.updateNode(nodeData);
        await this.setDataModel(updatedModel);
    }

    async addNode(nodeData: CanvasNodeData): Promise<void> {
        const model = this.getDataModel();
        const updatedModel = model.addNode(nodeData);
        await this.setDataModel(updatedModel);
    }

    async addNodes(nodes: CanvasNodeData[]): Promise<void> {
        const model = this.getDataModel();
        const updatedModel = model.addNodes(nodes);
        await this.setDataModel(updatedModel);
    }
}
