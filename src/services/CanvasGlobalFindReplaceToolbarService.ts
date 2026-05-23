import { Notice, setIcon, View, type App } from "obsidian";
import { CanvasAdapter } from "../adapters/CanvasAdapter";
import type { CardSearchResult, SearchReplaceOptions, SearchReplaceScope } from "./SearchReplaceService";
import { SearchReplaceService } from "./SearchReplaceService";
import type { Canvas, CanvasNode } from "../types/canvas";
import type { CanvasDiagnostics } from "../adapters/CanvasAdapter";

const BUTTON_CLASS = "canvas-loom-global-fr-button";
const PANEL_CLASS = "canvas-loom-global-fr-panel";
const FALLBACK_CONTROL_CLASS = "canvas-loom-global-fr-fallback-control";
const PANEL_MARGIN = 8;
const PANEL_MIN_WIDTH = 220;
const PANEL_PREFERRED_WIDTH_WITH_REPLACE = 320;
const PANEL_PREFERRED_WIDTH = 300;

interface ActiveCanvasContext {
    canvas: Canvas;
    rootEl: HTMLElement;
}

interface FlatSearchMatch {
    card: CardSearchResult;
    matchIndex: number;
    flatIndex: number;
}

export class CanvasGlobalFindReplaceToolbarService {
    private observer: MutationObserver | null = null;
    private pendingInjection = false;
    private isOpen = false;
    private replaceExpanded = true;
    private query = "";
    private replacement = "";
    private caseSensitive = false;
    private regex = false;
    private results: CardSearchResult[] = [];
    private totalCards = 0;
    private error = "";
    private currentFlatIndex = -1;
    private refreshTimer: number | null = null;
    private focusQueryOnRender = false;
    private queryInput: HTMLInputElement | null = null;
    private replacementInput: HTMLInputElement | null = null;
    private countEl: HTMLElement | null = null;
    private statusEl: HTMLElement | null = null;
    private activeButtonEl: HTMLElement | null = null;
    private activeControlsEl: HTMLElement | null = null;
    private previousButton: HTMLButtonElement | null = null;
    private nextButton: HTMLButtonElement | null = null;
    private replaceCurrentButton: HTMLButtonElement | null = null;
    private replaceAllButton: HTMLButtonElement | null = null;

    constructor(
        private readonly app: App,
        private readonly diagnostics?: CanvasDiagnostics
    ) {}

    start(): void {
        this.stop();
        this.observer = new MutationObserver(() => this.scheduleInjection());
        this.observer.observe(activeDocument.body, {
            childList: true,
            subtree: true,
        });
        window.addEventListener("resize", this.onWindowResize);
        this.scheduleInjection();
    }

    stop(): void {
        this.observer?.disconnect();
        this.observer = null;
        window.removeEventListener("resize", this.onWindowResize);
        this.clearRefreshTimer();
        activeDocument
            .querySelectorAll(`.${BUTTON_CLASS}, .${PANEL_CLASS}, .${FALLBACK_CONTROL_CLASS}`)
            .forEach((element) => element.remove());
    }

    openForActiveCanvas(focusQuery = true): boolean {
        const context = this.getActiveCanvasContext();
        if (!context) {
            new Notice("请在打开画布文件时使用查找替换");
            return false;
        }

        const service = this.createSearchReplaceService(context.canvas);
        if (!service.hasTextCards()) {
            new Notice("当前画布没有可查找的文本卡片");
            return false;
        }

        this.isOpen = true;
        this.focusQueryOnRender = focusQuery;
        this.renderForContext(context);
        return true;
    }

    private onWindowResize = (): void => {
        this.positionPanel();
    };

    private scheduleInjection(): void {
        if (this.pendingInjection) {
            return;
        }

        this.pendingInjection = true;
        window.requestAnimationFrame(() => {
            this.pendingInjection = false;
            const context = this.getActiveCanvasContext();
            if (!context) {
                this.removeInjectedElements();
                return;
            }

            this.syncInjectedElements(context);
        });
    }

    private syncInjectedElements(context: ActiveCanvasContext): void {
        this.removeStaleInjectedElements(context.rootEl);
        this.injectControlButton(context);

        if (!this.isOpen) {
            this.removePanel();
            return;
        }

        if (!context.rootEl.querySelector(`.${PANEL_CLASS}`)) {
            this.renderForContext(context);
            return;
        }

        this.positionPanel();
    }

    private renderForContext(context: ActiveCanvasContext): void {
        this.removeStaleInjectedElements(context.rootEl);
        this.injectControlButton(context);

        if (!this.isOpen) {
            this.removePanel();
            return;
        }

        this.refreshResults(context.canvas);
        this.renderPanel(context);
    }

    private injectControlButton(context: ActiveCanvasContext): void {
        const controlsEl = this.getCanvasControlsElement(context.rootEl);
        const existingButton = context.rootEl.querySelector(`.${BUTTON_CLASS}`) as HTMLButtonElement | null;
        const targetEl = this.getButtonTargetElement(controlsEl);

        if (!targetEl) {
            this.injectFallbackControl(context);
            return;
        }

        context.rootEl.querySelector(`.${FALLBACK_CONTROL_CLASS}`)?.remove();
        const button = existingButton || this.createControlButton();
        button.toggleClass("is-active", this.isOpen);

        if (!targetEl.contains(button)) {
            targetEl.appendChild(button);
        }

        this.activeButtonEl = button;
        this.activeControlsEl = controlsEl;
    }

    private injectFallbackControl(context: ActiveCanvasContext): void {
        let host = context.rootEl.querySelector(`.${FALLBACK_CONTROL_CLASS}`) as HTMLElement | null;
        if (!host) {
            host = activeDocument.createElement("div");
            host.className = FALLBACK_CONTROL_CLASS;
            context.rootEl.appendChild(host);
        }

        let button = host.querySelector(`.${BUTTON_CLASS}`) as HTMLButtonElement | null;
        if (!button) {
            button = this.createControlButton();
            host.appendChild(button);
        }

        button.toggleClass("is-active", this.isOpen);
        this.activeButtonEl = button;
        this.activeControlsEl = host;
    }

    private createControlButton(): HTMLButtonElement {
        const button = activeDocument.createElement("button");
        button.type = "button";
        button.className = `clickable-icon ${BUTTON_CLASS}`;
        button.setAttribute("aria-label", "查找替换当前画布");
        button.setAttribute("title", "查找替换当前画布");

        try {
            setIcon(button, "search");
        } catch {
            button.textContent = "查";
        }

        button.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();

            if (this.isOpen) {
                this.close();
                return;
            }

            this.openForActiveCanvas(true);
        });

        return button;
    }

    private renderPanel(context: ActiveCanvasContext): void {
        let panel = context.rootEl.querySelector(`.${PANEL_CLASS}`) as HTMLElement | null;
        if (!panel) {
            panel = activeDocument.createElement("div");
            panel.className = PANEL_CLASS;
            panel.addEventListener("mousedown", (event) => event.stopPropagation());
            panel.addEventListener("click", (event) => event.stopPropagation());
            panel.addEventListener("keydown", (event) => {
                event.stopPropagation();
                if (event.key === "Escape") {
                    event.preventDefault();
                    this.close();
                }
            });
            context.rootEl.appendChild(panel);
        }

        panel.empty();
        panel.toggleClass("is-replace-expanded", this.replaceExpanded);

        const queryRow = panel.createDiv({ cls: "canvas-loom-global-fr-row canvas-loom-global-fr-query-row" });
        const queryWrap = queryRow.createDiv({ cls: "canvas-loom-global-fr-query" });
        this.queryInput = queryWrap.createEl("input", {
            type: "text",
            placeholder: "查找当前画布"
        });
        this.queryInput.value = this.query;
        this.queryInput.addEventListener("input", () => {
            this.query = this.queryInput?.value || "";
            this.currentFlatIndex = -1;
            this.scheduleRefresh(context.canvas);
        });
        this.queryInput.addEventListener("focus", () => this.queryInput?.select());
        this.queryInput.addEventListener("keydown", (event) => {
            if (event.key !== "Enter") {
                return;
            }

            event.preventDefault();
            if (event.shiftKey) {
                this.selectPreviousMatch(context.canvas);
            } else {
                this.selectNextMatch(context.canvas);
            }
        });

        const navRow = panel.createDiv({ cls: "canvas-loom-global-fr-row canvas-loom-global-fr-nav-row" });
        this.countEl = navRow.createDiv({ cls: "canvas-loom-global-fr-count" });

        this.previousButton = this.createIconButton(navRow, "arrow-up", "上一个", () => {
            this.selectPreviousMatch(context.canvas);
        });
        this.nextButton = this.createIconButton(navRow, "arrow-down", "下一个", () => {
            this.selectNextMatch(context.canvas);
        });
        const replaceToggle = this.createIconButton(navRow, "replace", "替换", () => {
            this.replaceExpanded = !this.replaceExpanded;
            this.renderForContext(context);
            if (this.replaceExpanded) {
                window.setTimeout(() => this.replacementInput?.focus(), 0);
            }
        });
        replaceToggle.toggleClass("is-active", this.replaceExpanded);
        this.createIconButton(navRow, "x", "关闭", () => this.close());

        if (this.replaceExpanded) {
            const replaceInputRow = panel.createDiv({ cls: "canvas-loom-global-fr-row canvas-loom-global-fr-replace-input-row" });
            this.replacementInput = replaceInputRow.createEl("input", {
                type: "text",
                placeholder: "替换为"
            });
            this.replacementInput.value = this.replacement;
            this.replacementInput.addEventListener("input", () => {
                this.replacement = this.replacementInput?.value || "";
            });
            this.replacementInput.addEventListener("keydown", (event) => {
                if (event.key === "Enter") {
                    event.preventDefault();
                    void this.replaceCurrentMatch(context.canvas);
                }
            });

            const replaceActionRow = panel.createDiv({ cls: "canvas-loom-global-fr-row canvas-loom-global-fr-replace-action-row" });

            this.replaceCurrentButton = replaceActionRow.createEl("button", { text: "替换当前" });
            this.replaceCurrentButton.type = "button";
            this.replaceCurrentButton.addEventListener("click", () => {
                void this.replaceCurrentMatch(context.canvas);
            });

            this.replaceAllButton = replaceActionRow.createEl("button", { text: "全部替换" });
            this.replaceAllButton.type = "button";
            this.replaceAllButton.addClass("mod-cta");
            this.replaceAllButton.addEventListener("click", () => {
                void this.replaceAllMatches(context.canvas);
            });

            const caseButton = this.createTextToggleButton(replaceActionRow, "Aa", "区分大小写", this.caseSensitive, () => {
                this.caseSensitive = !this.caseSensitive;
                this.currentFlatIndex = -1;
                this.renderForContext(context);
            });
            caseButton.setAttribute("aria-pressed", String(this.caseSensitive));

            const regexButton = this.createTextToggleButton(replaceActionRow, ".*", "正则表达式", this.regex, () => {
                this.regex = !this.regex;
                this.currentFlatIndex = -1;
                this.renderForContext(context);
            });
            regexButton.setAttribute("aria-pressed", String(this.regex));
        }

        this.statusEl = panel.createDiv({ cls: "canvas-loom-global-fr-status" });
        this.updateStatus();
        this.updateActionButtons();
        this.positionPanel();

        if (this.focusQueryOnRender) {
            this.focusQueryOnRender = false;
            window.setTimeout(() => {
                this.queryInput?.focus();
                this.queryInput?.select();
            }, 0);
        }
    }

    private createIconButton(
        container: HTMLElement,
        icon: string,
        label: string,
        onClick: () => void
    ): HTMLButtonElement {
        const button = container.createEl("button", { cls: "clickable-icon" });
        button.type = "button";
        button.setAttribute("aria-label", label);
        button.setAttribute("title", label);

        try {
            setIcon(button, icon);
        } catch {
            button.textContent = label.slice(0, 1);
        }

        button.addEventListener("click", (event) => {
            event.preventDefault();
            onClick();
        });

        return button;
    }

    private createTextToggleButton(
        container: HTMLElement,
        text: string,
        label: string,
        active: boolean,
        onClick: () => void
    ): HTMLButtonElement {
        const button = container.createEl("button", {
            text,
            cls: active ? "canvas-loom-global-fr-toggle is-active" : "canvas-loom-global-fr-toggle"
        });
        button.type = "button";
        button.setAttribute("aria-label", label);
        button.setAttribute("title", label);
        button.addEventListener("click", (event) => {
            event.preventDefault();
            onClick();
        });
        return button;
    }

    private scheduleRefresh(canvas: Canvas): void {
        this.clearRefreshTimer();
        this.refreshTimer = window.setTimeout(() => {
            this.refreshTimer = null;
            this.refreshResults(canvas);
            this.updateStatus();
            this.updateActionButtons();
        }, 120);
    }

    private refreshResults(canvas: Canvas): void {
        const service = this.createSearchReplaceService(canvas);
        const result = service.findMatches(this.getQueryOptions());
        this.error = result.error || "";
        this.results = result.cards;
        this.totalCards = result.totalCards;

        const matches = this.getFlatMatches();
        if (this.currentFlatIndex >= matches.length) {
            this.currentFlatIndex = Math.max(0, matches.length - 1);
        }
    }

    private updateStatus(): void {
        const totalMatches = this.getFlatMatches().length;
        if (this.countEl) {
            const current = totalMatches > 0 && this.currentFlatIndex >= 0
                ? this.currentFlatIndex + 1
                : 0;
            this.countEl.setText(totalMatches > 0 ? `${current}/${totalMatches}` : "0/0");
        }

        if (!this.statusEl) {
            return;
        }

        this.statusEl.removeClass("is-error");

        if (this.error) {
            this.statusEl.addClass("is-error");
            this.statusEl.setText(this.error);
            return;
        }

        if (!this.query) {
            this.statusEl.setText(`输入内容后在当前画布中查找。范围内共有 ${this.totalCards} 张文本卡片。`);
            return;
        }

        if (totalMatches === 0) {
            this.statusEl.setText(`没有匹配内容。范围内共有 ${this.totalCards} 张文本卡片。`);
            return;
        }

        this.statusEl.setText(`找到 ${totalMatches} 处命中，分布在 ${this.results.length} / ${this.totalCards} 张文本卡片中。`);
    }

    private updateActionButtons(): void {
        const hasMatches = this.getFlatMatches().length > 0 && !this.error;
        const hasCurrentMatch = hasMatches && this.currentFlatIndex >= 0;
        [
            this.previousButton,
            this.nextButton,
        ].forEach((button) => {
            if (button) {
                button.disabled = !hasMatches;
            }
        });
        if (this.replaceCurrentButton) {
            this.replaceCurrentButton.disabled = !hasCurrentMatch;
        }
        if (this.replaceAllButton) {
            this.replaceAllButton.disabled = !hasMatches;
        }
    }

    private selectPreviousMatch(canvas: Canvas): void {
        const matches = this.getFlatMatches();
        if (matches.length === 0) {
            return;
        }

        this.currentFlatIndex = this.currentFlatIndex <= 0
            ? matches.length - 1
            : this.currentFlatIndex - 1;
        this.selectCurrentMatch(canvas);
    }

    private selectNextMatch(canvas: Canvas): void {
        const matches = this.getFlatMatches();
        if (matches.length === 0) {
            return;
        }

        this.currentFlatIndex = this.currentFlatIndex >= matches.length - 1
            ? 0
            : this.currentFlatIndex + 1;
        this.selectCurrentMatch(canvas);
    }

    private selectCurrentMatch(canvas: Canvas): void {
        const match = this.getCurrentMatch();
        if (!match) {
            return;
        }

        const service = this.createSearchReplaceService(canvas);
        if (service.selectNode(match.card.nodeId)) {
            this.focusNode(canvas, match.card.nodeId);
        }

        this.updateStatus();
    }

    private async replaceCurrentMatch(canvas: Canvas): Promise<void> {
        const current = this.getCurrentMatch();
        if (!current) {
            return;
        }

        const service = this.createSearchReplaceService(canvas);
        const result = await service.replaceCurrent(this.getReplaceOptions(), {
            nodeId: current.card.nodeId,
            matchIndex: current.matchIndex
        });

        if (result.error) {
            new Notice(result.error);
            return;
        }

        if (result.changedCount === 0) {
            new Notice("没有找到可替换的内容");
        } else {
            new Notice("已替换当前命中");
        }

        this.refreshResults(canvas);
        this.selectCurrentMatch(canvas);
        this.updateStatus();
        this.updateActionButtons();
    }

    private async replaceAllMatches(canvas: Canvas): Promise<void> {
        const service = this.createSearchReplaceService(canvas);
        const result = await service.replaceAll(this.getReplaceOptions());

        if (result.error) {
            new Notice(result.error);
            return;
        }

        if (result.changedCount === 0) {
            new Notice("没有找到可替换的内容");
        } else {
            new Notice(`已替换 ${result.changedCount} 处，更新 ${result.changedNodeCount} 张卡片`);
        }

        this.currentFlatIndex = -1;
        this.refreshResults(canvas);
        this.updateStatus();
        this.updateActionButtons();
    }

    private getQueryOptions(): Omit<SearchReplaceOptions, "replacement"> {
        return {
            query: this.query,
            scope: "canvas" as SearchReplaceScope,
            caseSensitive: this.caseSensitive,
            regex: this.regex
        };
    }

    private getReplaceOptions(): SearchReplaceOptions {
        return {
            ...this.getQueryOptions(),
            replacement: this.replacement
        };
    }

    private getCurrentMatch(): FlatSearchMatch | null {
        return this.getFlatMatches()[this.currentFlatIndex] || null;
    }

    private getFlatMatches(): FlatSearchMatch[] {
        const matches: FlatSearchMatch[] = [];
        this.results.forEach((card) => {
            card.ranges.forEach((_range, matchIndex) => {
                matches.push({
                    card,
                    matchIndex,
                    flatIndex: matches.length
                });
            });
        });
        return matches;
    }

    private focusNode(canvas: Canvas, nodeId: string): void {
        const node = canvas.nodes?.get(nodeId) || null;
        const internalCanvas = canvas as Canvas & {
            zoomToSelection?: () => void;
            centerOnNode?: (node: CanvasNode) => void;
            requestFrame?: () => void;
        };

        try {
            if (node && typeof internalCanvas.centerOnNode === "function") {
                internalCanvas.centerOnNode(node);
            } else if (typeof internalCanvas.zoomToSelection === "function") {
                internalCanvas.zoomToSelection();
            }

            internalCanvas.requestFrame?.();
        } catch (error) {
            console.warn("定位查找结果失败:", error);
        }
    }

    private createSearchReplaceService(canvas: Canvas): SearchReplaceService {
        return new SearchReplaceService(new CanvasAdapter(canvas, this.diagnostics));
    }

    private getActiveCanvasContext(): ActiveCanvasContext | null {
        const activeView = this.app.workspace.getActiveViewOfType(View);
        if (!activeView || activeView.getViewType?.() !== "canvas" || !activeView.canvas) {
            return null;
        }

        const rootEl = (activeView as View & { containerEl?: HTMLElement }).containerEl || activeDocument.body;
        return {
            canvas: activeView.canvas,
            rootEl
        };
    }

    private getCanvasControlsElement(rootEl: HTMLElement): HTMLElement | null {
        const controls = rootEl.querySelector(".canvas-controls");
        return controls instanceof HTMLElement ? controls : null;
    }

    private getButtonTargetElement(controlsEl: HTMLElement | null): HTMLElement | null {
        if (!controlsEl) {
            return null;
        }

        const firstGroup = controlsEl.querySelector(".canvas-control-group");
        if (firstGroup instanceof HTMLElement) {
            return firstGroup;
        }

        return controlsEl;
    }

    private positionPanel(): void {
        const activeContext = this.getActiveCanvasContext();
        const activeRootEl = activeContext?.rootEl || null;
        const panel = (
            activeRootEl?.querySelector(`.${PANEL_CLASS}`)
            || activeDocument.querySelector(`.${PANEL_CLASS}`)
        ) as HTMLElement | null;
        const rootEl = activeRootEl || panel?.parentElement || null;
        const button = (
            (this.activeButtonEl && rootEl?.contains(this.activeButtonEl) ? this.activeButtonEl : null)
            || rootEl?.querySelector(`.${BUTTON_CLASS}`)
            || activeDocument.querySelector(`.${BUTTON_CLASS}`)
        ) as HTMLElement | null;
        if (!panel || !button) {
            return;
        }

        const viewportRect = rootEl ? this.getCanvasViewportRect(rootEl) : null;
        const buttonRect = button.getBoundingClientRect();
        const panelHeight = panel.offsetHeight || 100;
        const viewportLeft = Math.max(viewportRect?.left ?? 0, 0);
        const viewportRight = Math.min(viewportRect?.right ?? window.innerWidth, window.innerWidth);
        const viewportTop = Math.max(viewportRect?.top ?? 0, 0);
        const viewportBottom = Math.min(viewportRect?.bottom ?? window.innerHeight, window.innerHeight);
        const safeLeft = viewportLeft + PANEL_MARGIN;
        const safeRight = Math.max(safeLeft, viewportRight - PANEL_MARGIN);
        const safeTop = viewportTop + PANEL_MARGIN;
        const safeBottom = Math.max(safeTop, viewportBottom - PANEL_MARGIN);
        const safeWidth = Math.max(0, safeRight - safeLeft);
        const preferredWidth = this.replaceExpanded
            ? PANEL_PREFERRED_WIDTH_WITH_REPLACE
            : PANEL_PREFERRED_WIDTH;
        const width = safeWidth >= PANEL_MIN_WIDTH
            ? Math.max(PANEL_MIN_WIDTH, Math.min(preferredWidth, safeWidth))
            : safeWidth;
        const maxTop = Math.max(safeTop, safeBottom - panelHeight);
        const top = this.clamp(buttonRect.top, safeTop, maxTop);
        const leftSide = buttonRect.left - PANEL_MARGIN - width;
        const rightSide = buttonRect.right + PANEL_MARGIN;
        const preferredLeft = leftSide >= safeLeft
            ? leftSide
            : rightSide + width <= safeRight
                ? rightSide
                : buttonRect.left - PANEL_MARGIN - width;
        const left = this.clamp(
            preferredLeft,
            safeLeft,
            Math.max(safeLeft, safeRight - width)
        );

        panel.style.top = `${top}px`;
        panel.style.left = `${left}px`;
        panel.style.right = "auto";
        panel.style.width = `${width}px`;
        panel.style.maxWidth = `${width}px`;
    }

    private clamp(value: number, min: number, max: number): number {
        return Math.min(Math.max(value, min), max);
    }

    private getCanvasViewportRect(rootEl: HTMLElement): DOMRect | null {
        const rootRect = rootEl.getBoundingClientRect();
        if (rootRect.width <= 0 || rootRect.height <= 0) {
            return null;
        }

        return rootRect;
    }

    private close(): void {
        this.isOpen = false;
        this.removePanel();
        activeDocument
            .querySelectorAll(`.${BUTTON_CLASS}`)
            .forEach((button) => button.removeClass("is-active"));
    }

    private removePanel(): void {
        activeDocument.querySelectorAll(`.${PANEL_CLASS}`).forEach((element) => element.remove());
    }

    private removeInjectedElements(): void {
        activeDocument
            .querySelectorAll(`.${BUTTON_CLASS}, .${PANEL_CLASS}, .${FALLBACK_CONTROL_CLASS}`)
            .forEach((element) => element.remove());
    }

    private removeStaleInjectedElements(rootEl: HTMLElement): void {
        activeDocument
            .querySelectorAll(`.${BUTTON_CLASS}, .${PANEL_CLASS}, .${FALLBACK_CONTROL_CLASS}`)
            .forEach((element) => {
                if (!rootEl.contains(element)) {
                    element.remove();
                }
            });
    }

    private clearRefreshTimer(): void {
        if (this.refreshTimer !== null) {
            window.clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }
    }
}
