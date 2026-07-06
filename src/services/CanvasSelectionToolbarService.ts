import { Notice, setIcon, View, type App, type EventRef } from "obsidian";
import {
    ArrangeSessionPreferenceStore,
    arrangeSelectedTextCardSpacing,
    type ArrangeAxisAnchor,
    type ArrangeDirection,
    shouldShowArrangementToolbarButton
} from "./CanvasArrangementService";
import {
    fitSelectedTextCardsToHeight,
    shouldShowAutoHeightToolbarButton
} from "./CanvasAutoFitService";
import { t } from "../i18n";
import { extractErrorMessage } from "../utils/errorUtils";
import { hasCanvasEditingNode, isCanvasNodeEditing } from "../utils/canvasEditingState";
import type { TranslationKey, TranslationParams } from "../i18n";
import type CanvasLoomSettings from "../settings/ICanvasLoomSettings";
import type { Canvas, CanvasNode } from "../types/canvas";

const BUTTON_CLASS = "canvas-loom-arrange-toolbar-button";
const AUTO_HEIGHT_BUTTON_CLASS = "canvas-loom-auto-height-toolbar-button";
const POPOVER_CLASS = "canvas-loom-arrange-popover";
const SEQUENCE_BUTTON_CLASS = "canvas-loom-sequence-toolbar-button";
const SEQUENCE_POPOVER_CLASS = "canvas-loom-sequence-popover";

interface SequenceToolsActions {
    openNumbering(canvas: Canvas, nodes: CanvasNode[]): void;
    removeBadges(canvas: Canvas, nodes: CanvasNode[]): Promise<number>;
}

export interface SequenceToolsSelectionState {
    mode: "single" | "multiple";
    nodes: CanvasNode[];
    badgeCount: number;
    currentBadge: string | null;
}

function isSequenceToolNode(node: CanvasNode): boolean {
    const nodeData = node.getData?.();
    const isTextCard = node.text !== undefined || nodeData?.type === "text";
    const isMarkdownEmbed = !!node.nodeEl?.querySelector(".markdown-embed");
    return isTextCard || isMarkdownEmbed;
}

function getUniqueSequenceToolNodes(selection?: Set<CanvasNode>): CanvasNode[] {
    const seenIds = new Set<string>();

    return Array.from(selection || []).filter((node) => {
        if (!node?.id || seenIds.has(node.id) || !isSequenceToolNode(node)) {
            return false;
        }

        seenIds.add(node.id);
        return true;
    });
}

export function shouldShowSequenceToolsToolbarButton(selection?: Set<CanvasNode>): boolean {
    const nodes = getUniqueSequenceToolNodes(selection);
    return nodes.length > 0 && !nodes.some((node) => isCanvasNodeEditing(node));
}

export function countSelectedBadges(selection?: Set<CanvasNode>): number {
    return getUniqueSequenceToolNodes(selection).filter((node) => {
        const badge = node.getData?.()?.badge;
        return typeof badge === "string" && badge.trim().length > 0;
    }).length;
}

export function getSequenceToolsSelectionState(
    selection?: Set<CanvasNode>
): SequenceToolsSelectionState {
    const nodes = getUniqueSequenceToolNodes(selection);
    const badges = nodes.map((node) => {
        const badge = node.getData?.()?.badge;
        return typeof badge === "string" && badge.trim().length > 0 ? badge.trim() : null;
    });

    return {
        mode: nodes.length === 1 ? "single" : "multiple",
        nodes,
        badgeCount: badges.filter((badge): badge is string => badge !== null).length,
        currentBadge: nodes.length === 1 ? badges[0] : null
    };
}

export class CanvasSelectionToolbarService {
    private observer: MutationObserver | null = null;
    private observedRootEl: HTMLElement | null = null;
    private pendingInjection = false;
    private injectedMenuEl: HTMLElement | null = null;
    private workspaceEventRefs: EventRef[] = [];
    private readonly arrangePreferenceStore: ArrangeSessionPreferenceStore;

    constructor(
        private readonly app: App,
        private readonly getSettings?: () => Partial<CanvasLoomSettings>,
        private readonly sequenceToolsActions?: SequenceToolsActions
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
        this.removeInjectedElements(this.injectedMenuEl);
        this.injectedMenuEl = null;
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
            this.removeInjectedElements(this.injectedMenuEl);
            this.injectedMenuEl = null;
            return;
        }

        const menuEl = this.getCanvasMenuElement(canvas);
        if (!menuEl) {
            this.removeInjectedElements(this.injectedMenuEl);
            this.injectedMenuEl = null;
            return;
        }
        if (this.injectedMenuEl && this.injectedMenuEl !== menuEl) {
            this.removeInjectedElements(this.injectedMenuEl);
        }
        this.injectedMenuEl = menuEl;

        if (hasCanvasEditingNode(canvas)) {
            this.removeInjectedElements(menuEl);
            return;
        }

        const existingArrangeButton = menuEl.querySelector(`.${BUTTON_CLASS}`);
        const existingAutoHeightButton = menuEl.querySelector(`.${AUTO_HEIGHT_BUTTON_CLASS}`);
        const existingSequenceButton = menuEl.querySelector(`.${SEQUENCE_BUTTON_CLASS}`);
        const shouldShowAutoHeight = shouldShowAutoHeightToolbarButton(canvas.selection);
        const shouldShowArrangement = shouldShowArrangementToolbarButton(canvas.selection);
        const shouldShowSequenceTools = shouldShowSequenceToolsToolbarButton(canvas.selection);

        if (!shouldShowAutoHeight) {
            existingAutoHeightButton?.remove();
        }

        if (!shouldShowArrangement) {
            existingArrangeButton?.remove();
            menuEl.querySelector(`.${POPOVER_CLASS}`)?.remove();
        }

        if (!shouldShowSequenceTools) {
            existingSequenceButton?.remove();
            menuEl.querySelector(`.${SEQUENCE_POPOVER_CLASS}`)?.remove();
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

        if (shouldShowSequenceTools && !existingSequenceButton) {
            menuEl.appendChild(this.createSequenceToolsButton(canvas, menuEl));
        }
    }

    openSequenceTools(canvas: Canvas | null = this.getActiveCanvas()): boolean {
        if (!canvas || hasCanvasEditingNode(canvas) || !shouldShowSequenceToolsToolbarButton(canvas.selection)) {
            return false;
        }

        const menuEl = this.getCanvasMenuElement(canvas);
        if (!menuEl) {
            return false;
        }

        let button = menuEl.querySelector<HTMLButtonElement>(`.${SEQUENCE_BUTTON_CLASS}`);
        if (!button) {
            button = this.createSequenceToolsButton(canvas, menuEl);
            menuEl.appendChild(button);
        }

        this.showSequenceToolsPopover(canvas, menuEl);
        return true;
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

    private createSequenceToolsButton(canvas: Canvas, menuEl: HTMLElement): HTMLButtonElement {
        const button = activeDocument.createElement("button");
        button.type = "button";
        button.className = `clickable-icon ${SEQUENCE_BUTTON_CLASS}`;
        button.setAttribute("aria-label", this.translate("toolbar.sequenceTools.label"));
        button.setAttribute("title", this.translate("toolbar.sequenceTools.label"));

        try {
            setIcon(button, "tag");
        } catch {
            button.textContent = this.translate("toolbar.sequenceTools.fallbackText");
        }

        button.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();
            const existing = menuEl.querySelector(`.${SEQUENCE_POPOVER_CLASS}`);
            if (existing) {
                existing.remove();
                return;
            }

            this.showSequenceToolsPopover(canvas, menuEl);
        });

        return button;
    }

    private showSequenceToolsPopover(canvas: Canvas, menuEl: HTMLElement): void {
        menuEl.querySelectorAll(`.${POPOVER_CLASS}, .${SEQUENCE_POPOVER_CLASS}`)
            .forEach((element) => element.remove());
        menuEl.appendChild(this.createSequenceToolsPopover(canvas));
    }

    private createSequenceToolsPopover(canvas: Canvas): HTMLElement {
        const state = getSequenceToolsSelectionState(canvas.selection);
        const popover = activeDocument.createElement("div");
        popover.className = SEQUENCE_POPOVER_CLASS;
        popover.addEventListener("click", (event) => event.stopPropagation());

        const summary = activeDocument.createElement("div");
        summary.className = "canvas-loom-sequence-summary";
        summary.textContent = state.mode === "single"
            ? state.currentBadge
                ? this.translate("toolbar.sequenceTools.single.summaryWithBadge", {
                    badge: state.currentBadge
                })
                : this.translate("toolbar.sequenceTools.single.summaryWithoutBadge")
            : this.translate("toolbar.sequenceTools.multiple.summary", {
                selectedCount: state.nodes.length,
                badgeCount: state.badgeCount
            });
        popover.appendChild(summary);

        const numberButton = activeDocument.createElement("button");
        numberButton.type = "button";
        numberButton.textContent = this.translate(
            state.mode === "single"
                ? "toolbar.sequenceTools.single.setNumber"
                : "toolbar.sequenceTools.multiple.batchNumber"
        );
        numberButton.disabled = !this.sequenceToolsActions;
        numberButton.addEventListener("click", () => {
            popover.remove();
            this.sequenceToolsActions?.openNumbering(canvas, state.nodes);
        });
        popover.appendChild(numberButton);

        const removeButton = activeDocument.createElement("button");
        removeButton.type = "button";
        removeButton.className = "mod-warning";
        removeButton.textContent = state.mode === "single"
            ? this.translate("toolbar.sequenceTools.single.remove")
            : this.translate("toolbar.sequenceTools.multiple.remove", {
                count: state.badgeCount
            });
        removeButton.disabled = state.badgeCount === 0 || !this.sequenceToolsActions;
        removeButton.addEventListener("click", () => {
            if (removeButton.disabled || !this.sequenceToolsActions) {
                return;
            }

            removeButton.disabled = true;
            void this.sequenceToolsActions.removeBadges(canvas, state.nodes).finally(() => {
                popover.remove();
                this.scheduleInjection();
            });
        });
        popover.appendChild(removeButton);

        return popover;
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
        let selectedDirection = preference.direction;
        const draftPreference = { ...preference };

        const popover = activeDocument.createElement("div");
        popover.className = POPOVER_CLASS;
        popover.addEventListener("click", (event) => event.stopPropagation());

        const title = activeDocument.createElement("div");
        title.className = "canvas-loom-arrange-title";
        title.textContent = this.translate("toolbar.arrange.label");
        popover.appendChild(title);

        const directionButtons = new Map<ArrangeDirection, HTMLButtonElement>();
        const directionGroup = this.createSegmentedControl();
        (["horizontal", "vertical"] as ArrangeDirection[]).forEach((direction) => {
            const button = this.createSegmentButton(this.getDirectionLabel(direction));
            button.addEventListener("click", () => {
                this.setPreferenceSpacing(draftPreference, selectedDirection, this.parseSpacing(spacingInput));
                selectedDirection = direction;
                draftPreference.direction = direction;
                updateControls();
            });
            directionButtons.set(direction, button);
            directionGroup.appendChild(button);
        });
        popover.appendChild(directionGroup);

        const formRow = activeDocument.createElement("div");
        formRow.className = "canvas-loom-arrange-form";

        const spacingField = activeDocument.createElement("label");
        spacingField.className = "canvas-loom-arrange-field";
        const spacingLabel = activeDocument.createElement("span");
        spacingLabel.textContent = this.translate("toolbar.arrange.spacing");
        const spacingInput = this.createSpacingInput(this.getPreferenceSpacing(draftPreference, selectedDirection));
        spacingInput.setAttribute("aria-label", this.translate("toolbar.arrange.spacing"));
        spacingField.appendChild(spacingLabel);
        spacingField.appendChild(spacingInput);

        const spacingUnit = activeDocument.createElement("span");
        spacingUnit.className = "canvas-loom-arrange-unit";
        spacingUnit.textContent = "px";
        spacingField.appendChild(spacingUnit);

        const anchorField = activeDocument.createElement("div");
        anchorField.className = "canvas-loom-arrange-field";
        const anchorLabel = activeDocument.createElement("span");
        anchorLabel.textContent = this.translate("toolbar.arrange.anchor.label");
        anchorField.appendChild(anchorLabel);

        const anchorButtons = new Map<ArrangeAxisAnchor, HTMLButtonElement>();
        const anchorGroup = this.createSegmentedControl();
        (["start", "end"] as ArrangeAxisAnchor[]).forEach((anchor) => {
            const button = this.createSegmentButton("");
            button.addEventListener("click", () => {
                this.setPreferenceSpacing(draftPreference, selectedDirection, this.parseSpacing(spacingInput));
                this.setPreferenceAnchor(draftPreference, selectedDirection, anchor);
                updateControls();
            });
            anchorButtons.set(anchor, button);
            anchorGroup.appendChild(button);
        });
        anchorField.appendChild(anchorGroup);

        formRow.appendChild(spacingField);
        formRow.appendChild(anchorField);
        popover.appendChild(formRow);

        const preview = this.createArrangePreview();
        popover.appendChild(preview);

        const applyButton = activeDocument.createElement("button");
        applyButton.type = "button";
        applyButton.className = "mod-cta canvas-loom-arrange-apply-button";
        applyButton.textContent = this.translate("toolbar.arrange.apply");
        applyButton.addEventListener("click", (event) => {
            event.preventDefault();
            const anchor = this.getPreferenceAnchor(draftPreference, selectedDirection);
            void this.applyArrangement(canvas, spacingInput, anchor, selectedDirection, applyButton);
        });
        spacingInput.addEventListener("keydown", (event) => {
            if (event.key === "Enter") {
                event.preventDefault();
                const anchor = this.getPreferenceAnchor(draftPreference, selectedDirection);
                void this.applyArrangement(canvas, spacingInput, anchor, selectedDirection, applyButton);
            }
        });
        popover.appendChild(applyButton);

        const updateControls = () => {
            directionButtons.forEach((button, direction) => {
                const isSelected = direction === selectedDirection;
                button.toggleClass("is-selected", isSelected);
                button.setAttribute("aria-pressed", String(isSelected));
            });

            spacingInput.value = this.formatSpacingInput(this.getPreferenceSpacing(draftPreference, selectedDirection));

            const selectedAnchor = this.getPreferenceAnchor(draftPreference, selectedDirection);
            anchorButtons.forEach((button, anchor) => {
                const isSelected = anchor === selectedAnchor;
                button.textContent = this.getAnchorLabel(selectedDirection, anchor);
                button.toggleClass("is-selected", isSelected);
                button.setAttribute("aria-pressed", String(isSelected));
            });

            preview.classList.toggle("is-vertical", selectedDirection === "vertical");
            preview.dataset.anchor = selectedAnchor;
        };

        updateControls();

        return popover;
    }

    private createSpacingInput(value: number): HTMLInputElement {
        const input = activeDocument.createElement("input");
        input.type = "number";
        input.min = "0";
        input.max = "500";
        input.step = "1";
        input.placeholder = "0";
        input.value = this.formatSpacingInput(value);
        input.addEventListener("focus", () => input.select());
        return input;
    }

    private createSegmentedControl(): HTMLElement {
        const group = activeDocument.createElement("div");
        group.className = "canvas-loom-arrange-segmented";
        return group;
    }

    private createSegmentButton(label: string): HTMLButtonElement {
        const button = activeDocument.createElement("button");
        button.type = "button";
        button.className = "canvas-loom-arrange-segment";
        button.textContent = label;
        return button;
    }

    private createArrangePreview(): HTMLElement {
        const preview = activeDocument.createElement("div");
        preview.className = "canvas-loom-arrange-preview";
        preview.setAttribute("aria-hidden", "true");

        for (let index = 0; index < 3; index += 1) {
            const card = activeDocument.createElement("span");
            card.className = "canvas-loom-arrange-preview-card";
            preview.appendChild(card);
        }

        return preview;
    }

    private async applyArrangement(
        canvas: Canvas,
        input: HTMLInputElement,
        anchor: ArrangeAxisAnchor,
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

        button.disabled = true;
        const label = `${this.getDirectionLabel(direction)} ${this.getAnchorLabel(direction, anchor)}`;
        const preference = this.arrangePreferenceStore.get();
        const spacingOptions: {
            horizontalSpacing?: number;
            verticalSpacing?: number;
            horizontalAnchor?: ArrangeAxisAnchor;
            verticalAnchor?: ArrangeAxisAnchor;
        } =
            direction === "horizontal"
                ? { horizontalSpacing: spacing, horizontalAnchor: anchor }
                : { verticalSpacing: spacing, verticalAnchor: anchor };

        try {
            const result = await arrangeSelectedTextCardSpacing(canvas, spacingOptions);
            this.arrangePreferenceStore.remember({
                ...preference,
                direction,
                ...(direction === "horizontal"
                    ? { horizontalSpacing: spacing, horizontalAnchor: anchor }
                    : { verticalSpacing: spacing, verticalAnchor: anchor }),
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

    private formatSpacingInput(value: number): string {
        return value > 0 ? String(value) : "";
    }

    private getPreferenceSpacing(
        preference: ReturnType<ArrangeSessionPreferenceStore["get"]>,
        direction: ArrangeDirection
    ): number {
        return direction === "horizontal"
            ? preference.horizontalSpacing
            : preference.verticalSpacing;
    }

    private setPreferenceSpacing(
        preference: ReturnType<ArrangeSessionPreferenceStore["get"]>,
        direction: ArrangeDirection,
        spacing: number
    ): void {
        if (!this.isValidSpacing(spacing)) {
            return;
        }

        if (direction === "horizontal") {
            preference.horizontalSpacing = spacing;
            return;
        }

        preference.verticalSpacing = spacing;
    }

    private getPreferenceAnchor(
        preference: ReturnType<ArrangeSessionPreferenceStore["get"]>,
        direction: ArrangeDirection
    ): ArrangeAxisAnchor {
        return direction === "horizontal"
            ? preference.horizontalAnchor
            : preference.verticalAnchor;
    }

    private setPreferenceAnchor(
        preference: ReturnType<ArrangeSessionPreferenceStore["get"]>,
        direction: ArrangeDirection,
        anchor: ArrangeAxisAnchor
    ): void {
        if (direction === "horizontal") {
            preference.horizontalAnchor = anchor;
            return;
        }

        preference.verticalAnchor = anchor;
    }

    private getDirectionLabel(direction: ArrangeDirection): string {
        return this.translate(direction === "horizontal"
            ? "toolbar.arrange.direction.horizontal"
            : "toolbar.arrange.direction.vertical");
    }

    private getAnchorLabel(direction: ArrangeDirection, anchor: ArrangeAxisAnchor): string {
        if (direction === "horizontal") {
            return this.translate(anchor === "start"
                ? "toolbar.arrange.anchor.left"
                : "toolbar.arrange.anchor.right");
        }

        return this.translate(anchor === "start"
            ? "toolbar.arrange.anchor.top"
            : "toolbar.arrange.anchor.bottom");
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

        const wrapperEl = canvas.wrapperEl;
        if (wrapperEl?.instanceOf(HTMLElement)) {
            return wrapperEl;
        }

        if (activeView.containerEl?.instanceOf(HTMLElement)) {
            return activeView.containerEl;
        }

        const menuEl = this.getCanvasMenuElement(canvas);
        return menuEl?.instanceOf(HTMLElement) ? menuEl : null;
    }

    private getCanvasMenuElement(canvas: Canvas): HTMLElement | null {
        const internalMenuEl = canvas.menu?.menuEl;
        if (internalMenuEl?.instanceOf(HTMLElement)) {
            return internalMenuEl;
        }

        const wrapperEl = canvas.wrapperEl;
        if (wrapperEl?.instanceOf(HTMLElement)) {
            const menuEl = wrapperEl.querySelector<HTMLElement>(".canvas-menu");
            if (menuEl) {
                return menuEl;
            }
        }

        return this.getActiveCanvasView()?.containerEl?.querySelector<HTMLElement>(".canvas-menu") || null;
    }

    private removeInjectedElements(menuEl?: HTMLElement | null): void {
        menuEl?.querySelectorAll(
            `.${BUTTON_CLASS}, .${AUTO_HEIGHT_BUTTON_CLASS}, .${POPOVER_CLASS}, .${SEQUENCE_BUTTON_CLASS}, .${SEQUENCE_POPOVER_CLASS}`
        )
            .forEach((element) => element.remove());
    }
}
