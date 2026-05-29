import type CanvasLoomSettings from "../settings/ICanvasLoomSettings";
import type { CanvasData } from "../types/canvas";

interface CanvasPerformanceStats {
    nodeCount: number;
    edgeCount: number;
    textNodeCount: number;
    fileNodeCount: number;
    badgeNodeCount: number;
    isLargeCanvas: boolean;
}

export class PerformanceService {
    constructor(private getSettings: () => CanvasLoomSettings) {}

    getStats(data: CanvasData): CanvasPerformanceStats {
        const settings = this.getSettings();
        const nodes = data.nodes || [];
        const edgeCount = data.edges?.length || 0;
        const nodeCount = nodes.length;
        const textNodeCount = nodes.filter((node) => node.type === "text").length;
        const fileNodeCount = nodes.filter((node) => node.type === "file").length;
        const badgeNodeCount = nodes.filter((node) => typeof node.badge === "string" && node.badge.trim()).length;

        return {
            nodeCount,
            edgeCount,
            textNodeCount,
            fileNodeCount,
            badgeNodeCount,
            isLargeCanvas: nodeCount >= settings.largeCanvasNodeThreshold
        };
    }

    log(operation: string, details: Record<string, unknown>): void {
        if (!this.getSettings().enablePerformanceDiagnostics) {
            return;
        }

        console.debug("[Canvas Loom][perf]", {
            operation,
            ...details
        });
    }

    async measure<T>(
        operation: string,
        action: () => Promise<T>,
        details: Record<string, unknown> = {}
    ): Promise<T> {
        const startedAt = performance.now();

        try {
            return await action();
        } finally {
            this.log(operation, {
                ...details,
                durationMs: Math.round((performance.now() - startedAt) * 100) / 100
            });
        }
    }
}
