import { Notice, setIcon, View, type App } from "obsidian";
import {
    ArrangeSessionPreferenceStore,
    arrangeSelectedTextCards,
    shouldShowArrangementToolbarButton,
    type ArrangeDirection
} from "./CanvasArrangementService";
import {
    fitSelectedTextCardsToHeight,
    shouldShowAutoHeightToolbarButton
} from "./CanvasAutoFitService";
import type { SortPriority } from "../domain/strategies";
import type { Canvas } from "../types/canvas";

const BUTTON_CLASS = "canvas-loom-arrange-toolbar-button";
const AUTO_HEIGHT_BUTTON_CLASS = "canvas-loom-auto-height-toolbar-button";
const POPOVER_CLASS = "canvas-loom-arrange-popover";

export class CanvasSelectionToolbarService {
    private observer: MutationObserver | null = null;
    private pendingInjection = false;
    private readonly arrangePreferenceStore: ArrangeSessionPreferenceStore;

    constructor(
        private readonly app: App,
        private readonly getSortPriority: () => SortPriority
    ) {
        this.arrangePreferenceStore = new ArrangeSessionPreferenceStore(getSortPriority);
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
        button.setAttribute("aria-label", "排列卡片");
        button.setAttribute("title", "排列卡片");

        try {
            setIcon(button, "rows-3");
        } catch {
            button.textContent = "排列";
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
        let direction: ArrangeDirection = preference.direction;
        let sortPriority: SortPriority = preference.sortPriority;
        const popover = activeDocument.createElement("div");
        popover.className = POPOVER_CLASS;
        popover.addEventListener("click", (event) => event.stopPropagation());

        const directionGroup = activeDocument.createElement("div");
        directionGroup.className = "canvas-loom-arrange-segments";

        const horizontalButton = this.createDirectionButton("水平", direction === "horizontal", () => {
            direction = "horizontal";
            horizontalButton.classList.add("is-active");
            verticalButton.classList.remove("is-active");
        });
        const verticalButton = this.createDirectionButton("垂直", direction === "vertical", () => {
            direction = "vertical";
            verticalButton.classList.add("is-active");
            horizontalButton.classList.remove("is-active");
        });

        directionGroup.append(horizontalButton, verticalButton);
        popover.appendChild(directionGroup);

        const sortOrderRow = activeDocument.createElement("label");
        sortOrderRow.className = "canvas-loom-arrange-order";
        sortOrderRow.appendChild(activeDocument.createTextNode("顺序"));

        const sortOrderSelect = activeDocument.createElement("select");
        this.addSortPriorityOption(sortOrderSelect, "yx", "倒N排序");
        this.addSortPriorityOption(sortOrderSelect, "xy", "Z字排序");
        sortOrderSelect.value = sortPriority;
        sortOrderSelect.addEventListener("change", () => {
            sortPriority = sortOrderSelect.value as SortPriority;
        });
        sortOrderRow.appendChild(sortOrderSelect);
        popover.appendChild(sortOrderRow);

        const spacingRow = activeDocument.createElement("label");
        spacingRow.className = "canvas-loom-arrange-spacing";
        spacingRow.appendChild(activeDocument.createTextNode("间距"));

        const spacingInput = activeDocument.createElement("input");
        spacingInput.type = "number";
        spacingInput.min = "0";
        spacingInput.max = "500";
        spacingInput.step = "1";
        spacingInput.value = String(preference.spacing);
        spacingRow.appendChild(spacingInput);
        spacingRow.appendChild(activeDocument.createTextNode("px"));
        popover.appendChild(spacingRow);

        const submitButton = activeDocument.createElement("button");
        submitButton.type = "button";
        submitButton.className = "mod-cta canvas-loom-arrange-submit";
        submitButton.textContent = "排列";
        submitButton.addEventListener("click", () => {
            void this.applyArrangement(canvas, direction, sortPriority, spacingInput, popover);
        });
        popover.appendChild(submitButton);

        return popover;
    }

    private createDirectionButton(label: string, isActive: boolean, onClick: () => void): HTMLButtonElement {
        const button = activeDocument.createElement("button");
        button.type = "button";
        button.textContent = label;
        button.className = isActive ? "is-active" : "";
        button.addEventListener("click", onClick);
        return button;
    }

    private addSortPriorityOption(select: HTMLSelectElement, value: SortPriority, text: string): void {
        const option = activeDocument.createElement("option");
        option.value = value;
        option.textContent = text;
        select.appendChild(option);
    }

    private async applyArrangement(
        canvas: Canvas,
        direction: ArrangeDirection,
        sortPriority: SortPriority,
        spacingInput: HTMLInputElement,
        popover: HTMLElement
    ): Promise<void> {
        const spacing = Number.parseInt(spacingInput.value, 10);
        if (!Number.isFinite(spacing) || spacing < 0 || spacing > 500) {
            new Notice("间距值必须在 0-500 像素范围内");
            return;
        }

        try {
            const result = await arrangeSelectedTextCards(canvas, {
                direction,
                spacing,
                sortPriority,
            });
            this.arrangePreferenceStore.remember({
                direction,
                spacing,
                sortPriority,
            });
            const directionLabel = direction === "horizontal" ? "水平" : "垂直";
            new Notice(`已排列 ${result.count} 张卡片（${directionLabel}，间距 ${spacing} px）`);
            popover.remove();
        } catch (error) {
            console.error("排列卡片失败:", error);
            const message = error instanceof Error ? error.message : String(error);
            new Notice("排列卡片失败: " + message);
        }
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
