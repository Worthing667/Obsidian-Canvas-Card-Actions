import { Notice, setIcon, View, type App } from "obsidian";
import {
    ArrangeSessionPreferenceStore,
    arrangeSelectedTextCardSpacing,
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

        if (!shouldShowAutoHeight) {
            return;
        }

        if (shouldShowArrangement && !existingArrangeButton) {
            menuEl.appendChild(this.createArrangeButton(canvas, menuEl));
        }

        if (!existingAutoHeightButton) {
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
            button.textContent = "整理";
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

        popover.appendChild(this.createSpacingRow("水平间距", horizontalInput));
        popover.appendChild(this.createSpacingRow("垂直间距", verticalInput));

        const submitButton = activeDocument.createElement("button");
        submitButton.type = "button";
        submitButton.className = "mod-cta canvas-loom-arrange-submit";
        submitButton.textContent = "整理";
        submitButton.addEventListener("click", () => {
            void this.applyArrangement(canvas, horizontalInput, verticalInput, popover);
        });
        popover.appendChild(submitButton);

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

    private createSpacingRow(labelText: string, input: HTMLInputElement): HTMLElement {
        const label = activeDocument.createElement("label");
        label.className = "canvas-loom-arrange-spacing";
        label.appendChild(activeDocument.createTextNode(labelText));
        label.appendChild(input);
        label.appendChild(activeDocument.createTextNode("px"));

        return label;
    }

    private async applyArrangement(
        canvas: Canvas,
        horizontalInput: HTMLInputElement,
        verticalInput: HTMLInputElement,
        popover: HTMLElement
    ): Promise<void> {
        const horizontalSpacing = this.parseSpacing(horizontalInput);
        const verticalSpacing = this.parseSpacing(verticalInput);
        if (!this.isValidSpacing(horizontalSpacing) || !this.isValidSpacing(verticalSpacing)) {
            new Notice("间距值必须在 0-500 像素范围内");
            return;
        }

        const arrangedAxes = this.describeArrangedAxes(horizontalSpacing, verticalSpacing);
        if (!arrangedAxes) {
            new Notice("间距为 0 时不会更改，请至少输入一个大于 0 的间距");
            return;
        }

        try {
            const result = await arrangeSelectedTextCardSpacing(canvas, {
                horizontalSpacing,
                verticalSpacing,
            });
            this.arrangePreferenceStore.remember({
                horizontalSpacing,
                verticalSpacing,
            });
            new Notice(`已整理 ${result.count} 张卡片（${arrangedAxes}）`);
            popover.remove();
        } catch (error) {
            console.error("整理卡片间距失败:", error);
            const message = error instanceof Error ? error.message : String(error);
            new Notice("整理间距失败: " + message);
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

    private describeArrangedAxes(horizontalSpacing: number, verticalSpacing: number): string | null {
        const parts: string[] = [];
        if (horizontalSpacing > 0) {
            parts.push(`水平 ${horizontalSpacing} px`);
        }
        if (verticalSpacing > 0) {
            parts.push(`垂直 ${verticalSpacing} px`);
        }

        return parts.length > 0 ? parts.join("，") : null;
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
