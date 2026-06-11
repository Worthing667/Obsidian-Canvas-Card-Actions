import type { App } from "obsidian";

type CanvasViewLike = {
    canvas?: {
        wrapperEl?: HTMLElement;
    };
    containerEl?: HTMLElement;
};

type ZoomOverrideState = {
    observer: MutationObserver;
    originalValue: string;
    originalPriority: string;
};

const ZOOM_MULTIPLIER_PROPERTY = "--zoom-multiplier";

export class CanvasLabelScaleService {
    private readonly overrideStates = new Map<HTMLElement, ZoomOverrideState>();

    constructor(private app: Pick<App, "workspace">) {}

    syncCanvasWrappers(disableFontSizeRelativeToZoom: boolean): void {
        const leaves = this.app.workspace.getLeavesOfType("canvas");
        const activeWrappers = new Set<HTMLElement>();

        leaves.forEach((leaf) => {
            const view = leaf.view as CanvasViewLike | undefined;
            const wrapperEl = this.resolveCanvasWrapper(view);
            if (!wrapperEl) {
                return;
            }

            activeWrappers.add(wrapperEl);
            if (disableFontSizeRelativeToZoom) {
                this.enableOverride(wrapperEl);
            } else {
                this.disableOverride(wrapperEl);
            }
        });

        for (const wrapperEl of this.overrideStates.keys()) {
            if (!activeWrappers.has(wrapperEl)) {
                this.disableOverride(wrapperEl);
            }
        }
    }

    dispose(): void {
        for (const wrapperEl of this.overrideStates.keys()) {
            this.disableOverride(wrapperEl);
        }
    }

    private enableOverride(wrapperEl: HTMLElement): void {
        wrapperEl.dataset.disableFontSizeRelativeToZoom = "true";
        if (this.overrideStates.has(wrapperEl)) {
            this.applyOverride(wrapperEl);
            return;
        }

        const state: ZoomOverrideState = {
            observer: new MutationObserver(() => {
                const currentValue = wrapperEl.style.getPropertyValue(ZOOM_MULTIPLIER_PROPERTY);
                if (currentValue !== "1") {
                    state.originalValue = currentValue;
                    state.originalPriority = wrapperEl.style.getPropertyPriority(ZOOM_MULTIPLIER_PROPERTY);
                    this.applyOverride(wrapperEl);
                }
            }),
            originalValue: wrapperEl.style.getPropertyValue(ZOOM_MULTIPLIER_PROPERTY),
            originalPriority: wrapperEl.style.getPropertyPriority(ZOOM_MULTIPLIER_PROPERTY),
        };

        this.overrideStates.set(wrapperEl, state);
        state.observer.observe(wrapperEl, {
            attributes: true,
            attributeFilter: ["style"],
        });
        this.applyOverride(wrapperEl);
    }

    private disableOverride(wrapperEl: HTMLElement): void {
        const state = this.overrideStates.get(wrapperEl);
        if (!state) {
            delete wrapperEl.dataset.disableFontSizeRelativeToZoom;
            return;
        }

        state.observer.disconnect();
        if (state.originalValue) {
            wrapperEl.style.setProperty(
                ZOOM_MULTIPLIER_PROPERTY,
                state.originalValue,
                state.originalPriority
            );
        } else {
            wrapperEl.style.removeProperty(ZOOM_MULTIPLIER_PROPERTY);
        }

        delete wrapperEl.dataset.disableFontSizeRelativeToZoom;
        this.overrideStates.delete(wrapperEl);
    }

    private applyOverride(wrapperEl: HTMLElement): void {
        wrapperEl.setCssProps({ [ZOOM_MULTIPLIER_PROPERTY]: "1" });
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
}
