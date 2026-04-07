import { CardData } from "./Card";

export interface CanvasNodeData {
    id: string;
    type: string;
    text?: string;
    file?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color?: string;
    badge?: string;
    badgeType?: 'number' | 'text' | 'emoji';
}

export interface CanvasEdgeData {
    id: string;
    fromNode: string;
    toNode: string;
    fromSide: string;
    toSide: string;
}

export interface CanvasData {
    nodes: CanvasNodeData[];
    edges: CanvasEdgeData[];
}

export class CanvasDataModel {
    constructor(
        public readonly nodes: CanvasNodeData[],
        public readonly edges: CanvasEdgeData[]
    ) {}

    static fromRawData(data: any): CanvasDataModel {
        return new CanvasDataModel(
            data.nodes || [],
            data.edges || []
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

    toRawData(): CanvasData {
        return {
            nodes: this.nodes,
            edges: this.edges
        };
    }
}