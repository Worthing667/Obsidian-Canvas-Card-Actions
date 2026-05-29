import { Notice, setIcon, View, type App, type EventRef } from "obsidian";
import { CanvasAdapter } from "../adapters/CanvasAdapter";
import type { CardSearchResult, SearchReplaceOptions, SearchReplaceScope } from "./SearchReplaceService";
import { SearchReplaceService } from "./SearchReplaceService";
import type { Canvas } from "../types/canvas";
import type { CanvasDiagnostics } from "../adapters/CanvasAdapter";
import { renderSearchMatchPreview } from "../utils/SearchMatchPreview";
import { findNthTextMatchIndex } from "../utils/TextMatchLocator";
import { t } from "../i18n";

const BUTTON_CLASS = "canvas-loom-global-fr-button";
const PANEL_CLASS = "canvas-loom-global-fr-panel";
const FALLBACK_CONTROL_CLASS = "canvas-loom-global-fr-fallback-control";
const ACTIVE_CARD_CLASS = "canvas-loom-find-active-card";
const ACTIVE_CARD_PULSE_CLASS = "canvas-loom-find-pulse";
const ACTIVE_MATCH_CLASS = "canvas-loom-find-active-match";
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

/**
 * 面板生命周期状态机：
 *
 *   closed: isOpen=false, pinnedContext=null
 *     → 无 panel DOM，按钮无 is-active
 *
 *   open(ctx): isOpen=true, pinnedContext=ctx (非 null)
 *     → panel 渲染在 document.body 内（position:fixed 避免受祖先 CSS transform 影响），按钮为 is-active
 *
 * 不变量：
 *   1. isOpen === (pinnedContext !== null)
 *   2. 打开后始终绑定 pinnedContext；active view 暂时为空时不关闭/不移除/不重挂
 *   3. 切换 canvas 标签时，面板保留在原画布；只有用户主动点击另一个 canvas
 *      的查找按钮（进入 openForContext）才覆盖 pinnedContext
 *   4. button.is-active 仅对 pinnedContext.rootEl 内的按钮为 true；
 *      非 pinned canvas 上的按钮不显示 active 状态
 *   5. positionPanel 仅在 isOpen 且 body 内 panel 与按钮都可解析时执行，否则安静 return
 *
 * 关闭触发条件（穷举）：
 *   a. 用户点击关闭按钮 → close()
 *   b. stop() / unload
 *   c. pinnedContext.rootEl 已不在 DOM 中 → scheduleInjection 检测后 close()
 *   d. 切到另一个 Canvas 并主动打开其查找面板 → openForContext 覆盖
 *
 * 注入同步触发路径：
 *   1. layout-ready → 初始布局就绪
 *   2. active-leaf-change → 切换标签页
 *   3. layout-change → 布局变更（分屏等）
 *   4. canvas rootEl 内 DOM 变化（窄范围 MutationObserver，仅监听当前 canvas 容器）
 */
export class CanvasGlobalFindReplaceToolbarService {
    private workspaceEventRefs: EventRef[] = [];
    private controlsObserver: MutationObserver | null = null;
    private observedRootEl: HTMLElement | null = null;
    private resizeObserver: ResizeObserver | null = null;
    private resizeObservedRootEl: HTMLElement | null = null;
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
    private currentPreviewEl: HTMLElement | null = null;
    private statusEl: HTMLElement | null = null;
    private activeButtonEl: HTMLElement | null = null;
    private pinnedContext: ActiveCanvasContext | null = null;
    private highlightedNodeId: string | null = null;
    private activeMatchMarkEl: HTMLElement | null = null;
    private highlightPulseTimer: number | null = null;
    private previousButton: HTMLButtonElement | null = null;
    private nextButton: HTMLButtonElement | null = null;
    private replaceCurrentButton: HTMLButtonElement | null = null;
    private replaceAllButton: HTMLButtonElement | null = null;
    private searchReplaceServicesByCanvas = new WeakMap<Canvas, SearchReplaceService>();

    constructor(
        private readonly app: App,
        private readonly diagnostics?: CanvasDiagnostics
    ) {}

    start(): void {
        this.stop();

        this.app.workspace.onLayoutReady(() => this.scheduleInjection());
        this.workspaceEventRefs = [
            this.app.workspace.on("active-leaf-change", () => this.scheduleInjection()),
            this.app.workspace.on("layout-change", () => this.scheduleInjection()),
        ];

        window.addEventListener("resize", this.onWindowResize);
        this.scheduleInjection();
    }

    stop(): void {
        for (const ref of this.workspaceEventRefs) {
            this.app.workspace.offref(ref);
        }
        this.workspaceEventRefs = [];

        this.disconnectControlsObserver();
        this.disconnectResizeObserver();
        window.removeEventListener("resize", this.onWindowResize);
        this.clearRefreshTimer();
        this.clearActiveMatchHighlight();
        this.isOpen = false;
        this.pinnedContext = null;

        for (const rootEl of this.getKnownCanvasRoots()) {
            rootEl.querySelectorAll(`.${BUTTON_CLASS}, .${FALLBACK_CONTROL_CLASS}`)
                .forEach((element) => element.remove());
        }
        this.removePanel();
    }

    openForActiveCanvas(focusQuery = true): boolean {
        return this.openForContext(this.getActiveCanvasContext(), focusQuery);
    }

    private openForControlButton(button: HTMLElement, focusQuery = true): boolean {
        return this.openForContext(
            this.getCanvasContextForElement(button) || this.getActiveCanvasContext(),
            focusQuery
        );
    }

    private openForContext(context: ActiveCanvasContext | null, focusQuery: boolean): boolean {
        if (!context) {
            new Notice(t("searchReplace.openInCanvasNotice"));
            return false;
        }

        const service = this.createSearchReplaceService(context.canvas);
        if (!service.hasTextCards()) {
            new Notice(t("notice.noSearchableTextCards"));
            return false;
        }

        if (this.pinnedContext?.rootEl !== context.rootEl) {
            this.clearActiveMatchHighlight();
        }

        this.pinnedContext = context;
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

            // 面板打开但 pinned canvas 的 DOM 已被移除 → 关闭
            if (this.isOpen && this.pinnedContext && !this.pinnedContext.rootEl.isConnected) {
                this.close();
                return;
            }

            this.performInjection();
        });
    }

    private performInjection(): void {
        const context = this.getActiveCanvasContext();

        if (!context) {
            // 无 active canvas view
            if (this.isOpen && this.pinnedContext) {
                // 面板打开 → 使用 pinnedContext，保持局部 observer 监听其 DOM 变化
                this.syncInjectedElements(this.pinnedContext);
            } else if (!this.isOpen) {
                // 面板关闭 → 清理残留注入元素，停止 observer
                this.removeInjectedElements();
                this.disconnectControlsObserver();
            }
            return;
        }

        // 面板打开且 pinnedContext 仍有效 → 保持面板在原画布，不迁移
        // 只有用户主动点击另一个 canvas 的按钮（进入 openForContext）才切换 pinnedContext
        if (this.isOpen && this.pinnedContext?.rootEl.isConnected) {
            this.syncInjectedElements(this.pinnedContext);
            this.ensureButtonInContext(context);
            this.observeCanvasControls(this.pinnedContext.rootEl);
            return;
        }

        // 面板关闭 → 正常同步到 active canvas
        this.pinnedContext = context;
        this.observeCanvasControls(context.rootEl);
        this.syncInjectedElements(context);
    }

    private ensureButtonInContext(context: ActiveCanvasContext): void {
        this.removeStaleInjectedElements(context.rootEl);
        this.injectControlButton(context);
    }

    private isContextPinned(context: ActiveCanvasContext): boolean {
        return this.isOpen && this.pinnedContext?.rootEl === context.rootEl;
    }

    private observeCanvasControls(rootEl: HTMLElement): void {
        if (this.observedRootEl === rootEl) {
            return;
        }
        this.disconnectControlsObserver();

        this.controlsObserver = new MutationObserver(() => {
            this.scheduleInjection();
        });
        this.controlsObserver.observe(rootEl, {
            childList: true,
            subtree: true,
        });
        this.observedRootEl = rootEl;
    }

    private disconnectControlsObserver(): void {
        this.controlsObserver?.disconnect();
        this.controlsObserver = null;
        this.observedRootEl = null;
    }

    private observeCanvasResize(rootEl: HTMLElement): void {
        if (this.resizeObservedRootEl === rootEl) {
            return;
        }
        this.disconnectResizeObserver();

        this.resizeObserver = new ResizeObserver(() => {
            if (this.isOpen) {
                this.positionPanel();
            }
        });
        this.resizeObserver.observe(rootEl);
        this.resizeObservedRootEl = rootEl;
    }

    private disconnectResizeObserver(): void {
        this.resizeObserver?.disconnect();
        this.resizeObserver = null;
        this.resizeObservedRootEl = null;
    }

    private syncInjectedElements(context: ActiveCanvasContext): void {
        this.removeStaleInjectedElements(context.rootEl);
        this.injectControlButton(context);

        if (!this.isOpen) {
            this.removePanel();
            return;
        }

        if (!activeDocument.body.querySelector(`.${PANEL_CLASS}`)) {
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
        button.toggleClass("is-active", this.isContextPinned(context));

        if (!targetEl.contains(button)) {
            targetEl.appendChild(button);
        }

        if (this.isContextPinned(context)) {
            this.activeButtonEl = button;
        }
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

        button.toggleClass("is-active", this.isContextPinned(context));
        if (this.isContextPinned(context)) {
            this.activeButtonEl = button;
        }
    }

    private createControlButton(): HTMLButtonElement {
        const button = activeDocument.createElement("button");
        button.type = "button";
        button.className = `clickable-icon ${BUTTON_CLASS}`;
        button.setAttribute("aria-label", t("searchReplace.button.open"));
        button.setAttribute("title", t("searchReplace.button.open"));

        try {
            setIcon(button, "search");
        } catch {
            button.textContent = t("searchReplace.button.fallbackText");
        }

        button.addEventListener("click", (event) => {
            event.preventDefault();
            event.stopPropagation();

            if (this.isOpen) {
                const buttonContext = this.getCanvasContextForElement(button);
                if (!buttonContext || this.pinnedContext?.rootEl === buttonContext.rootEl) {
                    this.close();
                    return;
                }
            }

            this.openForControlButton(button, true);
        });

        return button;
    }

    private renderPanel(context: ActiveCanvasContext): void {
        let panel = activeDocument.body.querySelector(`.${PANEL_CLASS}`) as HTMLElement | null;
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
            activeDocument.body.appendChild(panel);
        }

        panel.empty();
        panel.toggleClass("is-replace-expanded", this.replaceExpanded);

        const queryRow = panel.createDiv({ cls: "canvas-loom-global-fr-row canvas-loom-global-fr-query-row" });
        const queryWrap = queryRow.createDiv({ cls: "canvas-loom-global-fr-query" });
        this.queryInput = queryWrap.createEl("input", {
            type: "text",
            placeholder: t("searchReplace.input.queryPlaceholder")
        });
        this.queryInput.value = this.query;
        this.queryInput.addEventListener("input", () => {
            this.query = this.queryInput?.value || "";
            this.currentFlatIndex = -1;
            this.clearActiveMatchHighlight();
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

        this.previousButton = this.createIconButton(navRow, "arrow-up", t("searchReplace.button.previous"), () => {
            this.selectPreviousMatch(context.canvas);
        });
        this.nextButton = this.createIconButton(navRow, "arrow-down", t("searchReplace.button.next"), () => {
            this.selectNextMatch(context.canvas);
        });
        const replaceToggle = this.createIconButton(navRow, "replace", t("searchReplace.button.replace"), () => {
            this.replaceExpanded = !this.replaceExpanded;
            this.renderForContext(context);
            if (this.replaceExpanded) {
                window.setTimeout(() => this.replacementInput?.focus(), 0);
            }
        });
        replaceToggle.toggleClass("is-active", this.replaceExpanded);
        this.createIconButton(navRow, "x", t("searchReplace.button.close"), () => this.close());

        if (this.replaceExpanded) {
            const replaceInputRow = panel.createDiv({ cls: "canvas-loom-global-fr-row canvas-loom-global-fr-replace-input-row" });
            this.replacementInput = replaceInputRow.createEl("input", {
                type: "text",
                placeholder: t("searchReplace.input.replacementPlaceholder")
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

            this.replaceCurrentButton = replaceActionRow.createEl("button", { text: t("searchReplace.button.replaceCurrent") });
            this.replaceCurrentButton.type = "button";
            this.replaceCurrentButton.addEventListener("click", () => {
                void this.replaceCurrentMatch(context.canvas);
            });

            this.replaceAllButton = replaceActionRow.createEl("button", { text: t("searchReplace.button.replaceAll") });
            this.replaceAllButton.type = "button";
            this.replaceAllButton.addClass("mod-cta");
            this.replaceAllButton.addEventListener("click", () => {
                void this.replaceAllMatches(context.canvas);
            });

            const caseButton = this.createTextToggleButton(replaceActionRow, "Aa", t("searchReplace.button.caseSensitive"), this.caseSensitive, () => {
                this.caseSensitive = !this.caseSensitive;
                this.currentFlatIndex = -1;
                this.clearActiveMatchHighlight();
                this.renderForContext(context);
            });
            caseButton.setAttribute("aria-pressed", String(this.caseSensitive));

            const regexButton = this.createTextToggleButton(replaceActionRow, ".*", t("searchReplace.button.regex"), this.regex, () => {
                this.regex = !this.regex;
                this.currentFlatIndex = -1;
                this.clearActiveMatchHighlight();
                this.renderForContext(context);
            });
            regexButton.setAttribute("aria-pressed", String(this.regex));
        }

        this.currentPreviewEl = panel.createDiv({ cls: "canvas-loom-global-fr-current-preview is-empty" });
        this.statusEl = panel.createDiv({ cls: "canvas-loom-global-fr-status" });
        this.updateStatus();
        this.updateCurrentPreview();
        this.updateActionButtons();
        this.observeCanvasResize(context.rootEl);
        requestAnimationFrame(() => this.positionPanel());

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
            this.updateCurrentPreview();
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

        if (matches.length === 0) {
            this.clearActiveMatchHighlight();
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
            this.statusEl.setText(t("searchReplace.status.prompt", { totalCards: this.totalCards }));
            return;
        }

        if (totalMatches === 0) {
            this.statusEl.setText(t("searchReplace.status.noMatches", { totalCards: this.totalCards }));
            return;
        }

        this.statusEl.setText(t("searchReplace.status.matches", {
            totalMatches,
            matchedCards: this.results.length,
            totalCards: this.totalCards
        }));
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
            service.locateNode(match.card.nodeId);
            this.applyActiveMatchHighlight(canvas, match);
        }

        this.updateStatus();
        this.updateCurrentPreview();
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
            new Notice(t("notice.findReplaceNoReplacement"));
        } else {
            new Notice(t("notice.findReplaceCurrentReplaced"));
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
            new Notice(t("notice.findReplaceNoReplacement"));
        } else {
            new Notice(t("notice.findReplaceAllReplaced", {
                changedCount: result.changedCount,
                changedNodeCount: result.changedNodeCount
            }));
        }

        this.currentFlatIndex = -1;
        this.clearActiveMatchHighlight();
        this.refreshResults(canvas);
        this.updateStatus();
        this.updateCurrentPreview();
        this.updateActionButtons();
    }

    private updateCurrentPreview(): void {
        if (!this.currentPreviewEl) {
            return;
        }

        this.currentPreviewEl.empty();
        const current = this.getCurrentMatch();
        if (!current || this.error || !this.query) {
            this.currentPreviewEl.addClass("is-empty");
            return;
        }

        const range = current.card.ranges[current.matchIndex];
        if (!range) {
            this.currentPreviewEl.addClass("is-empty");
            return;
        }

        this.currentPreviewEl.removeClass("is-empty");
        renderSearchMatchPreview(this.currentPreviewEl, current.card.text, range, {
            before: 28,
            after: 36
        });
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

    private applyActiveMatchHighlight(canvas: Canvas, match: FlatSearchMatch): void {
        const nodeId = match.card.nodeId;
        const node = canvas.nodes?.get(nodeId) || null;
        const nodeEl = node?.nodeEl || null;
        if (!nodeEl) {
            this.clearActiveMatchHighlight();
            return;
        }

        this.clearActiveRenderedMatch();
        this.clearHighlightedCardIfChanged(canvas, nodeId);

        nodeEl.addClass(ACTIVE_CARD_CLASS);
        nodeEl.removeClass(ACTIVE_CARD_PULSE_CLASS);
        void nodeEl.offsetWidth;
        nodeEl.addClass(ACTIVE_CARD_PULSE_CLASS);
        this.highlightedNodeId = nodeId;
        this.applyRenderedMatchHighlight(nodeEl, match);

        if (this.highlightPulseTimer !== null) {
            window.clearTimeout(this.highlightPulseTimer);
        }
        this.highlightPulseTimer = window.setTimeout(() => {
            this.highlightPulseTimer = null;
            nodeEl.removeClass(ACTIVE_CARD_PULSE_CLASS);
        }, 480);
    }

    private clearActiveMatchHighlight(): void {
        if (this.highlightPulseTimer !== null) {
            window.clearTimeout(this.highlightPulseTimer);
            this.highlightPulseTimer = null;
        }

        this.clearActiveRenderedMatch();
        if (!this.highlightedNodeId || !this.pinnedContext) {
            this.highlightedNodeId = null;
            return;
        }

        this.clearNodeHighlight(this.pinnedContext.canvas, this.highlightedNodeId);
        this.highlightedNodeId = null;
    }

    private clearNodeHighlight(canvas: Canvas, nodeId: string): void {
        const node = canvas.nodes?.get(nodeId) || null;
        node?.nodeEl?.removeClass(ACTIVE_CARD_CLASS);
        node?.nodeEl?.removeClass(ACTIVE_CARD_PULSE_CLASS);
    }

    private clearHighlightedCardIfChanged(canvas: Canvas, nodeId: string): void {
        if (!this.highlightedNodeId || this.highlightedNodeId === nodeId) {
            return;
        }

        this.clearNodeHighlight(canvas, this.highlightedNodeId);
    }

    private applyRenderedMatchHighlight(nodeEl: HTMLElement, match: FlatSearchMatch): void {
        const range = match.card.ranges[match.matchIndex];
        if (!range?.value) {
            return;
        }

        const contentEl = this.getNodeTextContentElement(nodeEl);
        if (!contentEl) {
            return;
        }

        const visibleText = contentEl.textContent || "";
        const sameValueOccurrence = match.card.ranges
            .slice(0, match.matchIndex)
            .filter((item) => item.value === range.value)
            .length;
        const visibleStart = findNthTextMatchIndex(visibleText, range.value, sameValueOccurrence);
        if (visibleStart === -1) {
            return;
        }

        const domRange = this.createDomRangeForTextSpan(contentEl, visibleStart, visibleStart + range.value.length);
        if (!domRange) {
            return;
        }

        const mark = contentEl.ownerDocument.createElement("mark");
        mark.className = ACTIVE_MATCH_CLASS;
        mark.appendChild(domRange.extractContents());
        domRange.insertNode(mark);
        this.activeMatchMarkEl = mark;
        mark.scrollIntoView({ block: "nearest", inline: "nearest" });
    }

    private getNodeTextContentElement(nodeEl: HTMLElement): HTMLElement | null {
        const contentEl = nodeEl.querySelector(".canvas-node-content");
        if (contentEl instanceof HTMLElement) {
            return contentEl;
        }

        return nodeEl;
    }

    private createDomRangeForTextSpan(rootEl: HTMLElement, start: number, end: number): Range | null {
        const doc = rootEl.ownerDocument;
        const walker = doc.createTreeWalker(rootEl, NodeFilter.SHOW_TEXT);
        let currentOffset = 0;
        let startNode: Text | null = null;
        let endNode: Text | null = null;
        let startOffset = 0;
        let endOffset = 0;

        while (walker.nextNode()) {
            const node = walker.currentNode as Text;
            const nodeTextLength = node.data.length;
            const nodeStart = currentOffset;
            const nodeEnd = currentOffset + nodeTextLength;

            if (!startNode && start >= nodeStart && start <= nodeEnd) {
                startNode = node;
                startOffset = start - nodeStart;
            }

            if (!endNode && end >= nodeStart && end <= nodeEnd) {
                endNode = node;
                endOffset = end - nodeStart;
                break;
            }

            currentOffset = nodeEnd;
        }

        if (!startNode || !endNode) {
            return null;
        }

        const range = doc.createRange();
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);
        return range;
    }

    private clearActiveRenderedMatch(): void {
        const mark = this.activeMatchMarkEl;
        if (!mark) {
            return;
        }

        const parent = mark.parentNode;
        if (parent) {
            while (mark.firstChild) {
                parent.insertBefore(mark.firstChild, mark);
            }
            parent.removeChild(mark);
            parent.normalize();
        }

        this.activeMatchMarkEl = null;
    }

    private createSearchReplaceService(canvas: Canvas): SearchReplaceService {
        const existingService = this.searchReplaceServicesByCanvas.get(canvas);
        if (existingService) {
            return existingService;
        }

        const service = new SearchReplaceService(new CanvasAdapter(canvas, this.diagnostics));
        this.searchReplaceServicesByCanvas.set(canvas, service);
        return service;
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

    private getCanvasContextForElement(element: HTMLElement): ActiveCanvasContext | null {
        const leaves = this.app.workspace.getLeavesOfType?.("canvas") || [];
        for (const leaf of leaves) {
            const view = leaf.view as View & { canvas?: Canvas; containerEl?: HTMLElement };
            const rootEl = view.containerEl;
            if (view.canvas && rootEl?.contains(element)) {
                return {
                    canvas: view.canvas,
                    rootEl
                };
            }
        }

        return null;
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
        if (!this.isOpen || !this.pinnedContext) {
            return;
        }

        const rootEl = this.pinnedContext.rootEl;
        const panel = activeDocument.body.querySelector(`.${PANEL_CLASS}`) as HTMLElement | null;
        const button =
            (this.activeButtonEl && rootEl.contains(this.activeButtonEl)
                ? this.activeButtonEl
                : rootEl.querySelector(`.${BUTTON_CLASS}`)) as HTMLElement | null;

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
        this.clearActiveMatchHighlight();
        this.pinnedContext = null;
        this.activeButtonEl = null;
        this.disconnectControlsObserver();
        this.disconnectResizeObserver();
        this.removePanel();
        for (const rootEl of this.getKnownCanvasRoots()) {
            rootEl.querySelectorAll(`.${BUTTON_CLASS}`)
                .forEach((button) => button.removeClass("is-active"));
        }
    }

    private removePanel(): void {
        activeDocument.body.querySelectorAll(`.${PANEL_CLASS}`)
            .forEach((element) => element.remove());
    }

    private removeInjectedElements(): void {
        for (const rootEl of this.getKnownCanvasRoots()) {
            rootEl.querySelectorAll(`.${BUTTON_CLASS}, .${FALLBACK_CONTROL_CLASS}`)
                .forEach((element) => element.remove());
        }
        this.removePanel();
    }

    private removeStaleInjectedElements(rootEl: HTMLElement): void {
        const buttons = rootEl.querySelectorAll(`.${BUTTON_CLASS}`);
        const controlsEl = this.getCanvasControlsElement(rootEl);
        const targetEl = this.getButtonTargetElement(controlsEl);

        buttons.forEach((btn) => {
            const isInFallback = btn.closest(`.${FALLBACK_CONTROL_CLASS}`);
            if (targetEl && !isInFallback && !targetEl.contains(btn)) {
                btn.remove();
            }
        });
    }

    private getKnownCanvasRoots(): HTMLElement[] {
        const roots: HTMLElement[] = [];
        const leaves = this.app.workspace.getLeavesOfType?.("canvas") || [];
        for (const leaf of leaves) {
            const view = leaf.view as View & { containerEl?: HTMLElement };
            if (view.containerEl) {
                roots.push(view.containerEl);
            }
        }
        return roots;
    }

    private clearRefreshTimer(): void {
        if (this.refreshTimer !== null) {
            window.clearTimeout(this.refreshTimer);
            this.refreshTimer = null;
        }
    }
}
