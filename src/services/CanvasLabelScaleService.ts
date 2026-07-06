import type { App } from "obsidian";

type CanvasViewLike = {
    canvas?: {
        wrapperEl?: HTMLElement;
    };
    containerEl?: HTMLElement;
};

type ZoomOverrideState = {
    observer: MutationObserver;
    /** Obsidian 设置的自然缩放值（插件干预前的最新值） */
    originalValue: string;
    originalPriority: string;
    /** 当前应用的补偿百分比 (0-100) */
    compensation: number;
};

const ZOOM_MULTIPLIER_PROPERTY = "--zoom-multiplier";

export class CanvasLabelScaleService {
    private readonly overrideStates = new Map<HTMLElement, ZoomOverrideState>();

    constructor(private app: Pick<App, "workspace">) {}

    /**
     * 同步所有打开的 Canvas 的标签缩放补偿。
     * @param compensation 补偿百分比 (0-100)。0 = 不补偿（跟随缩放），100 = 完全补偿（不跟随缩放）
     */
    syncCanvasWrappers(compensation: number): void {
        const leaves = this.app.workspace.getLeavesOfType("canvas");
        const activeWrappers = new Set<HTMLElement>();

        leaves.forEach((leaf) => {
            const view = leaf.view as CanvasViewLike | undefined;
            const wrapperEl = this.resolveCanvasWrapper(view);
            if (!wrapperEl) {
                return;
            }

            activeWrappers.add(wrapperEl);
            if (compensation === 0) {
                this.removeOverride(wrapperEl);
            } else {
                this.applyCompensation(wrapperEl, compensation);
            }
        });

        for (const wrapperEl of this.overrideStates.keys()) {
            if (!activeWrappers.has(wrapperEl)) {
                this.removeOverride(wrapperEl);
            }
        }
    }

    dispose(): void {
        for (const wrapperEl of this.overrideStates.keys()) {
            this.removeOverride(wrapperEl);
        }
    }

    // ============================================================
    // 补偿覆盖
    // ============================================================

    private applyCompensation(wrapperEl: HTMLElement, compensation: number): void {
        wrapperEl.dataset.canvasLabelZoomCompensation = String(compensation);

        const existingState = this.overrideStates.get(wrapperEl);
        if (existingState) {
            // 同一 wrapper 已有覆盖，更新补偿值并重新计算
            existingState.compensation = compensation;
            this.writeOverride(wrapperEl, existingState);
            return;
        }

        const state: ZoomOverrideState = {
            compensation,
            observer: new MutationObserver(() => {
                const currentValue = wrapperEl.style.getPropertyValue(ZOOM_MULTIPLIER_PROPERTY);
                const targetValue = this.computeTarget(state.originalValue, state.compensation);

                // 比较当前值与目标值：相同则说明是我们自己设置的，跳过
                // 不同则说明 Obsidian 修改了自然缩放值，更新原始值并重新计算
                if (currentValue !== targetValue) {
                    state.originalValue = currentValue;
                    state.originalPriority = wrapperEl.style.getPropertyPriority(ZOOM_MULTIPLIER_PROPERTY);
                    this.writeOverride(wrapperEl, state);
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

        // 首次应用补偿
        if (state.originalValue) {
            this.writeOverride(wrapperEl, state);
        }
    }

    // ============================================================
    // 移除覆盖
    // ============================================================

    private removeOverride(wrapperEl: HTMLElement): void {
        const state = this.overrideStates.get(wrapperEl);
        if (!state) {
            delete wrapperEl.dataset.canvasLabelZoomCompensation;
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

        delete wrapperEl.dataset.canvasLabelZoomCompensation;
        this.overrideStates.delete(wrapperEl);
    }

    // ============================================================
    // 写入覆盖值
    // ============================================================

    private writeOverride(wrapperEl: HTMLElement, state: ZoomOverrideState): void {
        const target = this.computeTarget(state.originalValue, state.compensation);
        wrapperEl.setCssProps({ [ZOOM_MULTIPLIER_PROPERTY]: target });
    }

    // ============================================================
    // 插值计算
    // ============================================================

    /**
     * 计算补偿后的目标缩放乘数。
     * 公式：target = naturalZoom + (1.0 - naturalZoom) * (compensation / 100)
     *
     * - compensation = 0   → target = naturalZoom（完全跟随缩放）
     * - compensation = 100 → target = 1.0（完全不跟随缩放）
     * - compensation = 50, naturalZoom = 2.0 → target = 1.5（部分补偿）
     */
    private computeTarget(naturalZoomStr: string, compensation: number): string {
        const naturalZoom = parseFloat(naturalZoomStr);
        if (isNaN(naturalZoom) || naturalZoom <= 0) {
            // 无有效缩放值，不做补偿
            return naturalZoomStr;
        }
        const target = naturalZoom + (1.0 - naturalZoom) * (compensation / 100);
        // 使用 toFixed(6) 控制精度，避免浮点比较误差
        return target.toFixed(6).replace(/0+$/, "").replace(/\.$/, "");
    }

    // ============================================================
    // 工具方法
    // ============================================================

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
