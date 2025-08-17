// Type definitions for Obsidian Canvas Plugin

export interface Canvas {
    data: any;
    nodes: Set<any>;
    edges: Set<any>;
    [key: string]: any;
}