import type { App } from "obsidian";

type CanvasViewLike = {
    canvas?: {
        wrapperEl?: HTMLElement;
    };
    containerEl?: HTMLElement;
};

export class CanvasLabelScaleService {
    constructor(private app: Pick<App, "workspace">) {}

    syncCanvasWrappers(disableFontSizeRelativeToZoom: boolean): void {
        const leaves = this.app.workspace.getLeavesOfType("canvas");

        leaves.forEach((leaf) => {
            const view = leaf.view as CanvasViewLike | undefined;
            const wrapperEl = this.resolveCanvasWrapper(view);
            if (!wrapperEl) {
                return;
            }

            wrapperEl.dataset.disableFontSizeRelativeToZoom = disableFontSizeRelativeToZoom ? "true" : "false";
        });
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
}
