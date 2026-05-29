import type { App } from "obsidian";
import type { Canvas } from "../types/canvas";

type CanvasViewLike = {
    canvas?: Canvas;
    containerEl?: HTMLElement;
};

type BadgeRenderMode = "full" | "compact";

const COMPACT_BADGE_ZOOM_THRESHOLD = 0.6;
const ZOOM_SYNC_INTERVAL_MS = 120;

export class CanvasPerformanceModeService {
    private refreshTimerId: number | null = null;
    private badgeModeByWrapper = new WeakMap<HTMLElement, BadgeRenderMode>();

    constructor(private app: Pick<App, "workspace">) {}

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

        if (view.canvas?.wrapperEl instanceof HTMLElement) {
            return view.canvas.wrapperEl;
        }

        return view.containerEl?.querySelector(".canvas-wrapper") || null;
    }

    private resolveBadgeRenderMode(canvas: Canvas | undefined): BadgeRenderMode {
        const zoom = this.resolveZoom(canvas);
        return zoom <= COMPACT_BADGE_ZOOM_THRESHOLD ? "compact" : "full";
    }

    private resolveZoom(canvas: Canvas | undefined): number {
        const zoom = canvas?.tZoom ?? canvas?.zoom ?? 1;
        return Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
    }
}
