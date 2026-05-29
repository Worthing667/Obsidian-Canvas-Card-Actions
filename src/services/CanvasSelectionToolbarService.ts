import { Notice, setIcon, View, type App, type EventRef } from "obsidian";
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
import { t } from "../i18n";
import { extractErrorMessage } from "../utils/errorUtils";
import type { TranslationKey, TranslationParams } from "../i18n";
import type CanvasLoomSettings from "../settings/ICanvasLoomSettings";
import type { Canvas } from "../types/canvas";

const BUTTON_CLASS = "canvas-loom-arrange-toolbar-button";
const AUTO_HEIGHT_BUTTON_CLASS = "canvas-loom-auto-height-toolbar-button";
const POPOVER_CLASS = "canvas-loom-arrange-popover";

export class CanvasSelectionToolbarService {
    private observer: MutationObserver | null = null;
    private observedRootEl: HTMLElement | null = null;
    private pendingInjection = false;
    private workspaceEventRefs: EventRef[] = [];
    private readonly arrangePreferenceStore: ArrangeSessionPreferenceStore;

    constructor(
        private readonly app: App,
        private readonly getSettings?: () => Partial<CanvasLoomSettings>
    ) {
        this.arrangePreferenceStore = new ArrangeSessionPreferenceStore();
    }

    private translate(key: TranslationKey, params?: TranslationParams): string {
        return t(key, params, {
            settings: this.getSettings?.(),
            app: this.app
        });
    }

    start(): void {
        this.stop();
        const workspace = this.app.workspace as App["workspace"] & {
            on?: (name: string, callback: () => void) => EventRef;
            offref?: (ref: EventRef) => void;
        };
        workspace.onLayoutReady?.(() => this.scheduleInjection());
        this.workspaceEventRefs = [
            workspace.on?.("active-leaf-change", () => this.scheduleInjection()),
            workspace.on?.("layout-change", () => this.scheduleInjection()),
        ].filter((ref): ref is EventRef => Boolean(ref));
        this.scheduleInjection();
    }

    stop(): void {
        this.observer?.disconnect();
        this.observer = null;
        this.observedRootEl = null;
        const workspace = this.app.workspace as App["workspace"] & {
            offref?: (ref: EventRef) => void;
        };
        for (const ref of this.workspaceEventRefs) {
            workspace.offref?.(ref);
        }
        this.workspaceEventRefs = [];
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
            this.syncObserverRoot();
            this.injectIntoActiveCanvasMenu();
        });
    }

    private syncObserverRoot(): void {
        const rootEl = this.getActiveCanvasObserverRoot();
        if (this.observedRootEl === rootEl) {
            return;
        }

        this.observer?.disconnect();
        this.observer = null;
        this.observedRootEl = rootEl;

        if (!rootEl) {
            return;
        }

        this.observer = new MutationObserver(() => this.scheduleInjection());
        this.observer.observe(rootEl, {
            childList: true,
            attributes: true,
            attributeFilter: ["class"],
            subtree: true,
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
        button.setAttribute("aria-label", this.translate("toolbar.autoHeight.label"));
        button.setAttribute("title", this.translate("toolbar.autoHeight.label"));

        try {
            setIcon(button, "move-vertical");
        } catch {
            button.textContent = this.translate("toolbar.autoHeight.fallbackText");
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
            new Notice(this.translate("notice.autoHeightDone", { count: result.count }));
        } catch (error) {
            console.error("Auto height failed:", error);
            new Notice(this.translate("notice.autoHeightFailed", {
                message: this.localizeAutoHeightError(error)
            }));
        } finally {
            button.disabled = false;
        }
    }

    private createArrangeButton(canvas: Canvas, menuEl: HTMLElement): HTMLButtonElement {
        const button = activeDocument.createElement("button");
        button.type = "button";
        button.className = `clickable-icon ${BUTTON_CLASS}`;
        button.setAttribute("aria-label", this.translate("toolbar.arrange.label"));
        button.setAttribute("title", this.translate("toolbar.arrange.label"));

        try {
            setIcon(button, "rows-3");
        } catch {
            button.textContent = this.translate("toolbar.arrange.fallbackText");
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

        popover.appendChild(this.createSpacingRow(this.translate("toolbar.arrange.horizontalSpacing"), horizontalInput, "horizontal", canvas));
        popover.appendChild(this.createSpacingRow(this.translate("toolbar.arrange.verticalSpacing"), verticalInput, "vertical", canvas));

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
        button.textContent = this.translate("toolbar.arrange.adjust");
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
            new Notice(this.translate("notice.spacingInvalid"));
            return;
        }

        if (spacing === 0) {
            new Notice(this.translate("notice.spacingZero"));
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
            new Notice(this.translate("notice.spacingArranged", {
                count: result.count,
                direction: label,
                spacing
            }));
        } catch (error) {
            console.error("Spacing arrangement failed:", error);
            new Notice(this.translate("notice.spacingFailed", {
                message: this.localizeArrangementError(error)
            }));
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
        return this.translate(direction === "horizontal"
            ? "toolbar.arrange.direction.horizontal"
            : "toolbar.arrange.direction.vertical");
    }

    private localizeAutoHeightError(error: unknown): string {
        const message = extractErrorMessage(error);

        if (this.isTranslatedMessage(message, "errors.autoHeightEditing")) {
            return this.translate("errors.autoHeightEditing");
        }

        if (this.isTranslatedMessage(message, "errors.autoHeightNoCards")) {
            return this.translate("errors.autoHeightNoCards");
        }

        if (this.isTranslatedMessage(message, "errors.autoHeightUnsupported")) {
            return this.translate("errors.autoHeightUnsupported");
        }

        return this.translate("errors.canvasOperationFailed");
    }

    private localizeArrangementError(error: unknown): string {
        const message = extractErrorMessage(error);

        if (this.isTranslatedMessage(message, "errors.arrangementNeedTwoTextCards")) {
            return this.translate("errors.arrangementNeedTwoTextCards");
        }

        if (this.isTranslatedMessage(message, "errors.arrangementInsufficientCards")) {
            return this.translate("errors.arrangementInsufficientCards");
        }

        if (this.isSpacingOutOfRangeMessage(message)) {
            return this.translate("notice.spacingInvalid");
        }

        if (this.isInvalidCardSizeMessage(message)) {
            return this.translate("errors.canvasOperationFailed");
        }

        return this.translate("errors.canvasOperationFailed");
    }

    private isTranslatedMessage(message: string, key: TranslationKey, params?: TranslationParams): boolean {
        return [
            this.translate(key, params),
            t(key, params, { settings: { language: "en" } }),
            t(key, params, { settings: { language: "zh-CN" } })
        ].includes(message);
    }

    private isSpacingOutOfRangeMessage(message: string): boolean {
        const labels = [
            this.translate("toolbar.arrange.horizontalSpacing"),
            this.translate("toolbar.arrange.verticalSpacing"),
            t("toolbar.arrange.horizontalSpacing", undefined, { settings: { language: "en" } }),
            t("toolbar.arrange.verticalSpacing", undefined, { settings: { language: "en" } }),
            t("toolbar.arrange.horizontalSpacing", undefined, { settings: { language: "zh-CN" } }),
            t("toolbar.arrange.verticalSpacing", undefined, { settings: { language: "zh-CN" } })
        ];

        return labels.some((label) => this.isTranslatedMessage(message, "errors.spacingOutOfRange", { label }));
    }

    private isInvalidCardSizeMessage(message: string): boolean {
        const templates = [
            this.translate("errors.invalidCardSize", { width: "__WIDTH__", height: "__HEIGHT__" }),
            t("errors.invalidCardSize", { width: "__WIDTH__", height: "__HEIGHT__" }, { settings: { language: "en" } }),
            t("errors.invalidCardSize", { width: "__WIDTH__", height: "__HEIGHT__" }, { settings: { language: "zh-CN" } })
        ];

        return templates.some((template) => this.matchesInvalidCardSizeTemplate(message, template));
    }

    private matchesInvalidCardSizeTemplate(message: string, template: string): boolean {
        const pattern = `^${this.escapeRegExp(template)
            .replace(/__WIDTH__|__HEIGHT__/g, "[-+]?\\d+(?:\\.\\d+)?")}$`;

        return new RegExp(pattern).test(message);
    }

    private escapeRegExp(value: string): string {
        return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }

    private getActiveCanvas(): Canvas | null {
        return this.getActiveCanvasView()?.canvas || null;
    }

    private getActiveCanvasView(): (View & { canvas?: Canvas; containerEl?: HTMLElement }) | null {
        const activeView = this.app.workspace.getActiveViewOfType(View);
        if (!activeView || activeView.getViewType?.() !== "canvas") {
            return null;
        }

        return activeView;
    }

    private getActiveCanvasObserverRoot(): HTMLElement | null {
        const activeView = this.getActiveCanvasView();
        const canvas = activeView?.canvas;
        if (!canvas) {
            return null;
        }

        if (canvas.wrapperEl instanceof HTMLElement) {
            return canvas.wrapperEl;
        }

        if (activeView.containerEl instanceof HTMLElement) {
            return activeView.containerEl;
        }

        const menuEl = this.getCanvasMenuElement(canvas);
        return menuEl instanceof HTMLElement ? menuEl : null;
    }

    private getCanvasMenuElement(canvas: Canvas): HTMLElement | null {
        const internalMenuEl = (canvas as Canvas & { menu?: { menuEl?: HTMLElement } }).menu?.menuEl;
        if (internalMenuEl instanceof HTMLElement) {
            return internalMenuEl;
        }

        return activeDocument.querySelector(".canvas-menu");
    }
}
