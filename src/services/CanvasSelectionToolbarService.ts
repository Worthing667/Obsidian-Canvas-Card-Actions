import { Notice, setIcon, View, type App } from "obsidian";
import {
    ArrangeSessionPreferenceStore,
    arrangeSelectedTextCardSpacing,
    type ArrangeDirection,
    shouldShowArrangementToolbarButton
} from "./CanvasArrangementService";
import {
    fitSelectedTextCardsToHeight,
    shouldShowAutoHeightToolbarButton
} from "./CanvasAutoFitService";
import type { Canvas } from "../types/canvas";

const BUTTON_CLASS = "canvas-loom-arrange-toolbar-button";
const AUTO_HEIGHT_BUTTON_CLASS = "canvas-loom-auto-height-toolbar-button";
const POPOVER_CLASS = "canvas-loom-arrange-popover";

export class CanvasSelectionToolbarService {
    private observer: MutationObserver | null = null;
    private pendingInjection = false;
    private readonly arrangePreferenceStore: ArrangeSessionPreferenceStore;

    constructor(
        private readonly app: App
    ) {
        this.arrangePreferenceStore = new ArrangeSessionPreferenceStore();
    }

    start(): void {
        this.stop();
        this.observer = new MutationObserver(() => this.scheduleInjection());
        this.observer.observe(activeDocument.body, {
            childList: true,
            attributes: true,
            attributeFilter: ["class"],
            subtree: true,
        });
        this.scheduleInjection();
    }

    stop(): void {
        this.observer?.disconnect();
        this.observer = null;
        activeDocument.querySelectorAll(`.${BUTTON_CLASS}, .${AUTO_HEIGHT_BUTTON_CLASS}, .${POPOVER_CLASS}`)
            .forEach((element) => element.remove());
    }

    private scheduleInjection(): void {
        if (this.pendingInjection) {
            return;
        }

        this.pendingInjection = true;
        window.requestAnimationFrame(() => {
            this.pendingInjection = false;
            this.injectIntoActiveCanvasMenu();
        });
    }

    private injectIntoActiveCanvasMenu(): void {
        const canvas = this.getActiveCanvas();
        if (!canvas) {
            return;
        }

        const menuEl = this.getCanvasMenuElement(canvas);
        if (!menuEl) {
            return;
        }

        const existingArrangeButton = menuEl.querySelector(`.${BUTTON_CLASS}`);
        const existingAutoHeightButton = menuEl.querySelector(`.${AUTO_HEIGHT_BUTTON_CLASS}`);
        const shouldShowAutoHeight = shouldShowAutoHeightToolbarButton(canvas.selection);
        const shouldShowArrangement = shouldShowArrangementToolbarButton(canvas.selection);

        if (!shouldShowAutoHeight) {
            existingAutoHeightButton?.remove();
        }

        if (!shouldShowArrangement) {
            existingArrangeButton?.remove();
            menuEl.querySelector(`.${POPOVER_CLASS}`)?.remove();
        }

        if (shouldShowArrangement && !existingArrangeButton) {
            menuEl.appendChild(this.createArrangeButton(canvas, menuEl));
        }

        if (shouldShowAutoHeight && !existingAutoHeightButton) {
            const arrangeButton = menuEl.querySelector(`.${BUTTON_CLASS}`);
            const autoHeightButton = this.createAutoHeightButton(canvas);
            if (arrangeButton) {
                menuEl.insertBefore(autoHeightButton, arrangeButton.nextSibling);
            } else {
                menuEl.appendChild(autoHeightButton);
            }
        }
    }

    private createAutoHeightButton(canvas: Canvas): HTMLButtonElement {
        const button = activeDocument.createElement("button");
        button.type = "button";
        button.className = `clickable-icon ${AUTO_HEIGHT_BUTTON_CLASS}`;
        button.setAttribute("aria-label", "自适应高度");
        button.setAttribute("title", "自适应高度");

        try {
            setIcon(button, "move-vertical");
        } catch {
            button.textContent = "高";
        }

        button.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            void this.applyAutoHeight(canvas, button);
        });

        return button;
    }

    private async applyAutoHeight(canvas: Canvas, button: HTMLButtonElement): Promise<void> {
        button.disabled = true;

        try {
            const result = await fitSelectedTextCardsToHeight(canvas);
            new Notice(`已自适应 ${result.count} 张卡片高度`);
        } catch (error) {
            console.error("自适应卡片高度失败:", error);
            const message = error instanceof Error ? error.message : String(error);
            new Notice("自适应高度失败: " + message);
        } finally {
            button.disabled = false;
        }
    }

    private createArrangeButton(canvas: Canvas, menuEl: HTMLElement): HTMLButtonElement {
        const button = activeDocument.createElement("button");
        button.type = "button";
        button.className = `clickable-icon ${BUTTON_CLASS}`;
        button.setAttribute("aria-label", "整理间距");
        button.setAttribute("title", "整理间距");

        try {
            setIcon(button, "rows-3");
        } catch {
            button.textContent = "间距";
        }

        button.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            this.toggleArrangePopover(canvas, menuEl);
        });

        return button;
    }

    private toggleArrangePopover(canvas: Canvas, menuEl: HTMLElement): void {
        const existing = menuEl.querySelector(`.${POPOVER_CLASS}`);
        if (existing) {
            existing.remove();
            return;
        }

        menuEl.querySelectorAll(`.${POPOVER_CLASS}`).forEach((element) => element.remove());
        menuEl.appendChild(this.createArrangePopover(canvas));
    }

    private createArrangePopover(canvas: Canvas): HTMLElement {
        const preference = this.arrangePreferenceStore.get();
        const popover = activeDocument.createElement("div");
        popover.className = POPOVER_CLASS;
        popover.addEventListener("click", (event) => event.stopPropagation());

        const horizontalInput = this.createSpacingInput(preference.horizontalSpacing);
        const verticalInput = this.createSpacingInput(preference.verticalSpacing);

        popover.appendChild(this.createSpacingRow("水平间距", horizontalInput, "horizontal", canvas));
        popover.appendChild(this.createSpacingRow("垂直间距", verticalInput, "vertical", canvas));

        return popover;
    }

    private createSpacingInput(value: number): HTMLInputElement {
        const input = activeDocument.createElement("input");
        input.type = "number";
        input.min = "0";
        input.max = "500";
        input.step = "1";
        input.placeholder = "0";
        input.value = value > 0 ? String(value) : "";
        input.addEventListener("focus", () => input.select());
        return input;
    }

    private createSpacingRow(
        labelText: string,
        input: HTMLInputElement,
        direction: ArrangeDirection,
        canvas: Canvas
    ): HTMLElement {
        const row = activeDocument.createElement("div");
        row.className = "canvas-loom-arrange-spacing";
        input.setAttribute("aria-label", labelText);

        const button = activeDocument.createElement("button");
        button.type = "button";
        button.className = "mod-cta canvas-loom-arrange-axis-button";
        button.textContent = "调整";
        button.addEventListener("click", (event) => {
            event.preventDefault();
            void this.applyArrangement(canvas, input, direction, button);
        });
        input.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                void this.applyArrangement(canvas, input, direction, button);
            }
        });

        row.appendChild(activeDocument.createTextNode(labelText));
        row.appendChild(input);
        row.appendChild(activeDocument.createTextNode("px"));
        row.appendChild(button);

        return row;
    }

    private async applyArrangement(
        canvas: Canvas,
        input: HTMLInputElement,
        direction: ArrangeDirection,
        button: HTMLButtonElement
    ): Promise<void> {
        if (button.disabled) {
            return;
        }

        const spacing = this.parseSpacing(input);
        if (!this.isValidSpacing(spacing)) {
            new Notice("间距值必须在 0-500 像素范围内");
            return;
        }

        if (spacing === 0) {
            new Notice("间距为 0 时不会更改，请输入一个大于 0 的间距");
            return;
        }

        button.disabled = true;
        const label = this.getDirectionLabel(direction);
        const preference = this.arrangePreferenceStore.get();
        const horizontalSpacing = direction === "horizontal" ? spacing : 0;
        const verticalSpacing = direction === "vertical" ? spacing : 0;

        try {
            const result = await arrangeSelectedTextCardSpacing(canvas, {
                horizontalSpacing,
                verticalSpacing,
            });
            this.arrangePreferenceStore.remember({
                ...preference,
                ...(direction === "horizontal"
                    ? { horizontalSpacing: spacing }
                    : { verticalSpacing: spacing }),
            });
            new Notice(`已调整 ${result.count} 张卡片（${label} ${spacing} px）`);
        } catch (error) {
            console.error("调整卡片间距失败:", error);
            const message = error instanceof Error ? error.message : String(error);
            new Notice("整理间距失败: " + message);
        } finally {
            button.disabled = false;
        }
    }

    private isValidSpacing(spacing: number): boolean {
        return Number.isFinite(spacing) && Number.isInteger(spacing) && spacing >= 0 && spacing <= 500;
    }

    private parseSpacing(input: HTMLInputElement): number {
        const rawValue = input.value.trim();
        if (!rawValue) {
            return 0;
        }

        return Number(rawValue);
    }

    private getDirectionLabel(direction: ArrangeDirection): string {
        return direction === "horizontal" ? "水平" : "垂直";
    }

    private getActiveCanvas(): Canvas | null {
        const activeView = this.app.workspace.getActiveViewOfType(View);
        if (!activeView || activeView.getViewType?.() !== "canvas") {
            return null;
        }

        return activeView.canvas || null;
    }

    private getCanvasMenuElement(canvas: Canvas): HTMLElement | null {
        const internalMenuEl = (canvas as Canvas & { menu?: { menuEl?: HTMLElement } }).menu?.menuEl;
        if (internalMenuEl instanceof HTMLElement) {
            return internalMenuEl;
        }

        return activeDocument.querySelector(".canvas-menu");
    }
}
