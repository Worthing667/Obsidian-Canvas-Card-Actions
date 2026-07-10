import type { App } from "obsidian";
import type { Canvas } from "../types/canvas";

type CanvasViewLike = {
    canvas?: Canvas;
    containerEl?: HTMLElement;
};

type BadgeRenderMode = "full" | "compact";

const COMPACT_BADGE_ZOOM_THRESHOLD = 0.6;
const LARGE_CANVAS_COMPACT_BADGE_ZOOM_THRESHOLD = 0.8;
const ZOOM_SYNC_INTERVAL_MS = 120;
const DEFAULT_LARGE_CANVAS_NODE_THRESHOLD = 80;

export class CanvasPerformanceModeService {
    private refreshTimerId: number | null = null;
    private badgeModeByWrapper = new WeakMap<HTMLElement, BadgeRenderMode>();

    constructor(
        private app: Pick<App, "workspace">,
        private getLargeCanvasNodeThreshold: () => number = () => DEFAULT_LARGE_CANVAS_NODE_THRESHOLD
    ) {}

    start(): void {
        if (this.refreshTimerId !== null) {
            return;
        }

        this.scheduleNextRefresh();
    }

    stop(): void {
        if (this.refreshTimerId !== null) {
            window.clearTimeout(this.refreshTimerId);
            this.refreshTimerId = null;
        }

        this.syncCanvasWrappers(false);
    }

    syncCanvasWrappers(enablePerformanceMode: boolean): void {
        const leaves = this.app.workspace.getLeavesOfType("canvas");

        leaves.forEach((leaf) => {
            const view = leaf.view as CanvasViewLike | undefined;
            const wrapperEl = this.resolveCanvasWrapper(view);
            if (!wrapperEl) {
                return;
            }

            if (!enablePerformanceMode) {
                delete wrapperEl.dataset.canvasLoomBadgeMode;
                this.badgeModeByWrapper.delete(wrapperEl);
                return;
            }

            const badgeMode = this.resolveBadgeRenderMode(view?.canvas);
            if (this.badgeModeByWrapper.get(wrapperEl) === badgeMode) {
                return;
            }

            wrapperEl.dataset.canvasLoomBadgeMode = badgeMode;
            this.badgeModeByWrapper.set(wrapperEl, badgeMode);
        });
    }

    private scheduleNextRefresh(): void {
        this.refreshTimerId = window.setTimeout(() => {
            this.refreshTimerId = null;
            this.syncCanvasWrappers(true);
            this.scheduleNextRefresh();
        }, ZOOM_SYNC_INTERVAL_MS);
    }

    private resolveCanvasWrapper(view: CanvasViewLike | undefined): HTMLElement | null {
        if (!view) {
            return null;
        }

        const wrapperEl = view.canvas?.wrapperEl;
        if (wrapperEl?.instanceOf(HTMLElement)) {
            return wrapperEl;
        }

        return view.containerEl?.querySelector(".canvas-wrapper") || null;
    }

    private resolveBadgeRenderMode(canvas: Canvas | undefined): BadgeRenderMode {
        const zoom = this.resolveZoom(canvas);
        const threshold = this.isLargeCanvas(canvas)
            ? LARGE_CANVAS_COMPACT_BADGE_ZOOM_THRESHOLD
            : COMPACT_BADGE_ZOOM_THRESHOLD;
        return zoom <= threshold ? "compact" : "full";
    }

    private resolveZoom(canvas: Canvas | undefined): number {
        const canvasScale = canvas?.scale;
        if (
            typeof canvasScale === "number"
            && Number.isFinite(canvasScale)
            && canvasScale > 0
        ) {
            return canvasScale;
        }

        const internalZoom = canvas?.tZoom ?? canvas?.zoom;
        if (typeof internalZoom !== "number" || !Number.isFinite(internalZoom)) {
            return 1;
        }

        const scale = 2 ** internalZoom;
        return Number.isFinite(scale) && scale > 0 ? scale : 1;
    }

    private isLargeCanvas(canvas: Canvas | undefined): boolean {
        if (!canvas) {
            return false;
        }

        return this.resolveNodeCount(canvas) >= this.resolveLargeCanvasNodeThreshold();
    }

    private resolveNodeCount(canvas: Canvas): number {
        if (canvas.nodes instanceof Map) {
            return canvas.nodes.size;
        }

        try {
            return canvas.getData?.().nodes?.length ?? 0;
        } catch {
            return 0;
        }
    }

    private resolveLargeCanvasNodeThreshold(): number {
        const threshold = this.getLargeCanvasNodeThreshold();
        return Number.isFinite(threshold) && threshold > 0
            ? Math.round(threshold)
            : DEFAULT_LARGE_CANVAS_NODE_THRESHOLD;
    }
}
