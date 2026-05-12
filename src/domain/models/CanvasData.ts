import type { CanvasData as RuntimeCanvasData, CanvasEdgeData, CanvasNodeData } from "../../types/canvas";

export type CanvasData = RuntimeCanvasData;
export type { CanvasEdgeData, CanvasNodeData };

export class CanvasDataModel {
    constructor(
        public readonly nodes: CanvasNodeData[],
        public readonly edges: CanvasEdgeData[]
    ) {}

    static fromRawData(data: CanvasData | null | undefined): CanvasDataModel {
        return new CanvasDataModel(
            data?.nodes || [],
            data?.edges || []
        );
    }

    findNodeById(id: string): CanvasNodeData | null {
        return this.nodes.find(node => node.id === id) || null;
    }

    updateNode(nodeData: CanvasNodeData): CanvasDataModel {
        const newNodes = this.nodes.map(node => 
            node.id === nodeData.id ? nodeData : node
        );
        return new CanvasDataModel(newNodes, this.edges);
    }

    addNode(nodeData: CanvasNodeData): CanvasDataModel {
        const newNodes = [...this.nodes, nodeData];
        return new CanvasDataModel(newNodes, this.edges);
    }

    addNodes(nodes: CanvasNodeData[]): CanvasDataModel {
        const newNodes = [...this.nodes, ...nodes];
        return new CanvasDataModel(newNodes, this.edges);
    }

    removeNodes(ids: Set<string>): CanvasDataModel {
        const newNodes = this.nodes.filter(node => !ids.has(node.id));
        return new CanvasDataModel(newNodes, this.edges);
    }

    toRawData(): CanvasData {
        return {
            nodes: this.nodes,
            edges: this.edges
        };
    }
}
