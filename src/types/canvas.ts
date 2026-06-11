export type CanvasResizeHandle =
    | "top"
    | "right"
    | "bottom"
    | "left"
    | "topright"
    | "bottomright"
    | "bottomleft"
    | "topleft";

export interface CanvasNodeData {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color?: string;
    type: string;
    text?: string;
    file?: string;
    badge?: string;
    badgeType?: string;
    [key: string]: unknown;
}

export interface CanvasEdgeData {
    id: string;
    fromNode: string;
    fromSide: string;
    toNode: string;
    toSide: string;
    color?: string;
    label?: string;
    [key: string]: unknown;
}

export interface CanvasData {
    nodes: CanvasNodeData[];
    edges: CanvasEdgeData[];
    [key: string]: unknown;
}

export interface CanvasNode {
    id: string;
    text?: string;
    isEditing?: boolean;
    nodeEl?: HTMLElement | null;
    canvas?: Canvas;
    getData(): CanvasNodeData;
    onResizeDblclick?(event: MouseEvent, resizeHandle: CanvasResizeHandle): void;
}

export interface Canvas {
    selection?: Set<CanvasNode>;
    nodes?: Map<string, CanvasNode>;
    tx?: number;
    ty?: number;
    tZoom?: number;
    zoom?: number;
    wrapperEl?: HTMLElement;
    canvasRect?: DOMRect;
    menu?: {
        menuEl?: HTMLElement;
    };
    getSelectionData?(): CanvasData;
    getData(): CanvasData;
    setData(data: CanvasData): Promise<void> | void;
    requestSave(): Promise<void> | void;
    updateSelection?(selectionUpdater: () => void): void;
    requestFrame?(): void;
    setViewport?(tx: number, ty: number, tZoom: number): void;
    zoomToBbox?(bbox: { minX: number; maxX: number; minY: number; maxY: number }): void;
    zoomToSelection?(): void;
}

export interface DimensionStats {
    count: number;
    minWidth: number;
    maxWidth: number;
    avgWidth: number;
    minHeight: number;
    maxHeight: number;
    avgHeight: number;
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
}
