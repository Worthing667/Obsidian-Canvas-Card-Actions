import { ItemView, Notice, WorkspaceLeaf, setIcon } from "obsidian";
import { SortPriority } from "../../domain/strategies";
import { PreviewWorkbenchService } from "../../services/PreviewWorkbenchService";
import {
    CardSearchResult,
    ReplaceResult,
    SearchReplaceOptions,
    SearchReplaceScope,
    SearchReplaceService
} from "../../services/SearchReplaceService";
import { MergeOrder } from "../../services/ContentService";
import { t } from "../../i18n";
import type { TranslationKey, TranslationParams } from "../../i18n";
import type CanvasLoomSettings from "../../settings/ICanvasLoomSettings";
import type { WorkbenchState } from "../../types/WorkbenchState";
import { renderSearchMatchPreview, type SearchMatchPreviewRange } from "../../utils/SearchMatchPreview";

export const MERGE_PREVIEW_VIEW_TYPE = "canvas-loom-merge-preview";
const MERGE_PREVIEW_VIEW_ICON = "panel-right";

export type WorkbenchPanel = "sort" | "findReplace" | "preview";

export interface FindReplaceWorkbenchContext {
    service: SearchReplaceService;
    selectedNodeIds: Set<string>;
    selectedTextCardCount: number;
    selectedScopeLabel: string;
    defaultScope: SearchReplaceScope;
}

export interface MergeWorkbenchContext {
    state: WorkbenchState;
    sortPriority: SortPriority;
    findReplace?: FindReplaceWorkbenchContext;
    onCopy: (state: WorkbenchState) => Promise<void>;
    onCreateCard: (state: WorkbenchState) => Promise<void>;
    onCreateMarkdown: (state: WorkbenchState) => Promise<void>;
}

export interface SetWorkbenchContextOptions {
    panel?: WorkbenchPanel;
    focusFindInput?: boolean;
}

interface FlatSearchMatch {
    card: CardSearchResult;
    matchIndex: number;
    flatIndex: number;
}

export class MergeWorkbenchView extends ItemView {
    private readonly workbenchService = new PreviewWorkbenchService();
    private context: MergeWorkbenchContext = this.createEmptyContext();
    private activePanel: WorkbenchPanel = "sort";
    private draggedIndex: number | null = null;
    private previewTimer: number | null = null;

    private findQuery = "";
    private findReplacement = "";
    private findCaseSensitive = false;
    private findRegex = false;
    private findScope: SearchReplaceScope = "canvas";
    private findResults: CardSearchResult[] = [];
    private findTotalCards = 0;
    private findCurrentFlatIndex = 0;
    private findRefreshTimer: number | null = null;
    private focusFindInputOnRender = false;

    private findQueryInput: HTMLInputElement | null = null;
    private findStatusEl: HTMLElement | null = null;
    private findResultListEl: HTMLElement | null = null;
    private findReplaceCurrentButton: HTMLButtonElement | null = null;
    private findReplaceCardButton: HTMLButtonElement | null = null;
    private findReplaceAllButton: HTMLButtonElement | null = null;

    constructor(
        leaf: WorkspaceLeaf,
        private readonly getSettings?: () => Partial<CanvasLoomSettings>
    ) {
        super(leaf);
    }

    getViewType(): string {
        return MERGE_PREVIEW_VIEW_TYPE;
    }

    getDisplayText(): string {
        return this.translate("workbench.title");
    }

    getIcon(): string {
        return MERGE_PREVIEW_VIEW_ICON;
    }

    onOpen(): Promise<void> {
        this.render();
        return Promise.resolve();
    }

    onClose(): Promise<void> {
        this.clearPreviewTimer();
        this.clearFindRefreshTimer();
        this.context.findReplace?.service.clearHighlightedMatch();
        return Promise.resolve();
    }

    setWorkbenchContext(context: MergeWorkbenchContext, options: SetWorkbenchContextOptions = {}): void {
        this.context = context;

        if (options.panel) {
            this.activePanel = options.panel;
        } else if (this.activePanel === "findReplace" && !context.findReplace) {
            this.activePanel = "sort";
        }

        if (context.findReplace) {
            this.findScope = context.findReplace.defaultScope;
            if (this.findScope === "selection" && context.findReplace.selectedTextCardCount === 0) {
                this.findScope = "canvas";
            }
        }

        if (this.activePanel === "preview" && context.state.selectionSnapshot.length > 0) {
            this.context.state = this.workbenchService.setPreviewExpanded(this.context.state, true);
        }

        this.focusFindInputOnRender = !!options.focusFindInput;
        this.render();
    }

    getWorkbenchState(): WorkbenchState {
        return this.context.state;
    }

    private translate(key: TranslationKey, params?: TranslationParams): string {
        return t(key, params, { settings: this.getSettings?.(), app: this.app });
    }

    private render(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("canvas-loom-workbench");

        const container = contentEl.createDiv({ cls: "canvas-loom-workbench-container" });
        this.renderToolbar(container);
        this.renderPanelTabs(container);

        if (this.activePanel === "findReplace") {
            this.renderFindReplacePanel(container);
            return;
        }

        if (this.activePanel === "preview") {
            this.renderPreviewPanel(container);
            return;
        }

        this.renderSortPanel(container);
    }

    private renderToolbar(container: HTMLElement): void {
        const toolbar = container.createDiv({ cls: "canvas-loom-workbench-toolbar" });
        const heading = toolbar.createDiv({ cls: "canvas-loom-workbench-heading" });
        heading.createEl("h3", { text: this.translate("workbench.title") });
        heading.createDiv({
            cls: "canvas-loom-workbench-source",
            text: this.getToolbarSourceText()
        });

        const actions = toolbar.createDiv({ cls: "canvas-loom-workbench-toolbar-actions" });
        const count = actions.createDiv({ cls: "canvas-loom-workbench-count" });
        count.createEl("strong", { text: String(this.getToolbarCount()) });
        count.createEl("span", { text: this.getToolbarCountLabel() });

        const clearButton = actions.createEl("button", {
            cls: "canvas-loom-workbench-clear-button"
        });
        clearButton.setAttribute("type", "button");
        clearButton.setAttribute("aria-label", this.translate("workbench.button.clearWorkbench"));
        clearButton.setAttribute("title", this.translate("workbench.button.clearWorkbench"));
        setIcon(clearButton, "trash-2");
        clearButton.createSpan({ text: this.translate("workbench.button.clear") });
        clearButton.disabled = this.context.state.selectionSnapshot.length === 0;
        clearButton.addEventListener("click", () => this.clearWorkbench());
    }

    private renderPanelTabs(container: HTMLElement): void {
        const tabs = container.createDiv({ cls: "canvas-loom-workbench-panel-tabs" });
        this.createPanelButton(tabs, "preview", this.translate("workbench.tab.preview"));
        this.createPanelButton(tabs, "sort", this.translate("workbench.tab.sort"));
        this.createPanelButton(tabs, "findReplace", this.translate("workbench.tab.find"), !this.context.findReplace);
    }

    private createPanelButton(container: HTMLElement, panel: WorkbenchPanel, label: string, disabled = false): void {
        const button = container.createEl("button", {
            text: label,
            cls: this.activePanel === panel ? "is-active" : ""
        });
        button.setAttribute("type", "button");
        button.disabled = disabled;
        button.addEventListener("click", () => this.setActivePanel(panel));
    }

    private setActivePanel(panel: WorkbenchPanel): void {
        if (panel === "findReplace" && !this.context.findReplace) {
            return;
        }

        this.activePanel = panel;
        if (panel === "preview" && this.context.state.selectionSnapshot.length > 0) {
            this.context.state = this.workbenchService.setPreviewExpanded(this.context.state, true);
        }

        this.focusFindInputOnRender = panel === "findReplace";
        this.render();
    }

    private renderSortPanel(container: HTMLElement): void {
        const panel = container.createDiv({ cls: "canvas-loom-workbench-panel canvas-loom-workbench-sort-panel" });
        this.renderSortModeControls(panel);
        this.renderOrderSummary(panel);
        this.renderList(panel);
        this.renderPreviewAction(panel);
        this.renderOutputActions(panel);
    }

    private renderSortModeControls(container: HTMLElement): void {
        const modeGroup = container.createDiv({ cls: "canvas-loom-workbench-sort-modes" });
        this.createSortModeButton(modeGroup, "position", this.translate("workbench.sortMode.position"));
        this.createSortModeButton(modeGroup, "badge", this.translate("workbench.sortMode.badge"));
    }

    private renderPreviewPanel(container: HTMLElement): void {
        const panel = container.createDiv({ cls: "canvas-loom-workbench-panel canvas-loom-workbench-preview-panel" });
        this.renderPreviewSummary(panel);
        this.renderPreviewArea(panel);
        this.renderOutputActions(panel);
    }

    private renderPreviewSummary(container: HTMLElement): void {
        const orderedCards = this.workbenchService.getOrderedCards(this.context.state, this.context.sortPriority);
        const summary = container.createDiv({ cls: "canvas-loom-workbench-order-summary" });
        const text = summary.createDiv({ cls: "canvas-loom-workbench-order-text" });
        text.createEl("strong", { text: this.translate("workbench.panel.previewTitle") });
        const hint = text.createSpan({
            text: orderedCards.length === 0
                ? this.translate("workbench.panel.previewWaiting")
                : this.translate("workbench.panel.previewReady")
        });
        hint.addClass("canvas-loom-workbench-preview-hint");

        const snapshot = summary.createDiv({ cls: "canvas-loom-workbench-snapshot" });
        snapshot.createSpan({
            text: this.translate("workbench.panel.snapshot", { count: this.context.state.selectionSnapshot.length })
        });
        snapshot.createSpan({
            text: this.translate("workbench.panel.currentOrder", { order: this.getCurrentOrderLabel() })
        });
    }

    private renderOrderSummary(container: HTMLElement): void {
        const summary = container.createDiv({ cls: "canvas-loom-workbench-order-summary" });
        const text = summary.createDiv({ cls: "canvas-loom-workbench-order-text" });
        text.createEl("strong", { text: this.getListTitle() });
        text.createSpan({
            text: this.translate("workbench.panel.orderDescription", { description: this.getSortDescription() })
        });

        const snapshot = summary.createDiv({ cls: "canvas-loom-workbench-snapshot" });
        snapshot.createSpan({
            text: this.translate("workbench.panel.snapshot", { count: this.context.state.selectionSnapshot.length })
        });
        snapshot.createSpan({
            text: this.translate("workbench.panel.currentOrder", { order: this.getCurrentOrderLabel() })
        });
    }

    private renderList(container: HTMLElement): void {
        const section = container.createDiv({ cls: "canvas-loom-workbench-list-section" });
        const cards = this.workbenchService.getOrderedCards(this.context.state, this.context.sortPriority);
        const list = section.createDiv({ cls: "canvas-loom-workbench-list" });

        if (cards.length === 0) {
            const empty = list.createDiv({ cls: "canvas-loom-workbench-list-empty" });
            empty.setText(this.translate("workbench.panel.emptyList"));
            return;
        }

        cards.forEach((card, index) => {
            const row = list.createDiv({ cls: "canvas-loom-workbench-row" });
            row.dataset.index = index.toString();
            row.setAttribute("draggable", "true");
            row.style.setProperty("--canvas-loom-row-accent", this.resolveCardAccent(card.color));

            row.addEventListener("dragstart", (event) => this.onDragStart(event, index));
            row.addEventListener("dragover", (event) => this.onDragOver(event));
            row.addEventListener("dragleave", () => row.classList.remove("is-drop-target"));
            row.addEventListener("drop", (event) => this.onDrop(event, index));
            row.addEventListener("dragend", () => this.onDragEnd());

            const indexEl = row.createDiv({ cls: "canvas-loom-workbench-index" });
            indexEl.setText(String(index + 1).padStart(2, "0"));

            const body = row.createDiv({ cls: "canvas-loom-workbench-card-body" });
            const textEl = body.createDiv({ cls: "canvas-loom-workbench-text" });
            textEl.setText(this.toPreviewText(card.text));
            textEl.title = card.text;

            const meta = body.createDiv({ cls: "canvas-loom-workbench-card-meta" });
            if (card.badge) {
                const badgeEl = meta.createSpan({ cls: "canvas-loom-workbench-badge" });
                badgeEl.setText(card.badge);
            }
            meta.createSpan({
                cls: "canvas-loom-workbench-coordinate",
                text: `x ${Math.round(card.x)} / y ${Math.round(card.y)}`
            });

            const handle = row.createDiv({ cls: "canvas-loom-workbench-handle" });
            handle.setAttribute("aria-label", this.translate("workbench.aria.dragHandle"));
            handle.setAttribute("title", this.translate("workbench.aria.dragHandle"));
        });
    }

    private renderPreviewArea(container: HTMLElement): void {
        const section = container.createDiv({ cls: "canvas-loom-workbench-preview-section" });

        const preview = section.createEl("pre", { cls: "canvas-loom-workbench-preview-content" });
        if (this.context.state.lastComputedContent) {
            preview.setText(this.context.state.lastComputedContent);
            return;
        }

        preview.setText(this.translate("workbench.panel.renderingPreview"));
        this.schedulePreviewRender(preview);

    }

    private renderPreviewAction(container: HTMLElement): void {
        const orderedCards = this.workbenchService.getOrderedCards(this.context.state, this.context.sortPriority);
        const action = container.createDiv({ cls: "canvas-loom-workbench-render-action" });
        const button = action.createEl("button");
        const label = this.translate("workbench.button.viewPreview");
        button.setAttribute("type", "button");
        button.setAttribute("aria-label", label);
        button.setAttribute("title", label);
        button.disabled = orderedCards.length === 0;
        setIcon(button, "eye");
        button.createSpan({ text: label });
        button.addEventListener("click", () => this.renderSortPreview());
    }

    private renderOutputActions(container: HTMLElement): void {
        const orderedCards = this.workbenchService.getOrderedCards(this.context.state, this.context.sortPriority);
        const actions = container.createDiv({ cls: "canvas-loom-workbench-actions canvas-loom-workbench-footer-actions" });
        const hasCards = orderedCards.length > 0;
        this.createActionButton(actions, this.translate("workbench.button.copy"), async () => {
            await this.context.onCopy(this.context.state);
        }, !hasCards);
        this.createActionButton(actions, this.translate("workbench.button.addAsCard"), async () => {
            await this.context.onCreateCard(this.context.state);
        }, !hasCards);
        this.createActionButton(actions, this.translate("workbench.button.newDocument"), async () => {
            await this.context.onCreateMarkdown(this.context.state);
        }, !hasCards);
    }

    private renderFindReplacePanel(container: HTMLElement): void {
        const panel = container.createDiv({ cls: "canvas-loom-workbench-panel canvas-loom-fr-panel" });
        const findContext = this.context.findReplace;

        if (!findContext) {
            panel.createDiv({
                cls: "canvas-loom-workbench-list-empty",
                text: this.translate("workbench.panel.findUnavailable")
            });
            return;
        }

        panel.createDiv({
            cls: "canvas-loom-fr-subtitle",
            text: this.getFindScopeSubtitle(findContext)
        });

        this.createFindControls(panel);
        this.createFindResultSection(panel);
        this.createFindFooter(panel);
        this.renderFindResults();

        if (this.focusFindInputOnRender) {
            this.focusFindInputOnRender = false;
            window.setTimeout(() => {
                this.findQueryInput?.focus();
                this.findQueryInput?.select();
            }, 0);
        }
    }

    private createFindControls(container: HTMLElement): void {
        const controls = container.createDiv({ cls: "canvas-loom-fr-controls" });

        const queryField = controls.createDiv({ cls: "canvas-loom-fr-field" });
        queryField.createEl("label", { text: this.translate("workbench.find.label.query") });
        this.findQueryInput = queryField.createEl("input", {
            type: "text",
            placeholder: this.translate("workbench.find.placeholder.query")
        });
        this.findQueryInput.value = this.findQuery;

        const replaceField = controls.createDiv({ cls: "canvas-loom-fr-field" });
        replaceField.createEl("label", { text: this.translate("workbench.find.label.replacement") });
        const replacementInput = replaceField.createEl("input", {
            type: "text",
            placeholder: this.translate("workbench.find.placeholder.replacement")
        });
        replacementInput.value = this.findReplacement;

        const optionRow = container.createDiv({ cls: "canvas-loom-fr-options" });
        const caseSensitiveInput = this.createFindCheckbox(
            optionRow,
            this.translate("workbench.find.label.caseSensitive")
        );
        caseSensitiveInput.checked = this.findCaseSensitive;
        const regexInput = this.createFindCheckbox(optionRow, this.translate("workbench.find.label.regex"));
        regexInput.checked = this.findRegex;

        this.findQueryInput.addEventListener("input", () => {
            this.findQuery = this.findQueryInput?.value || "";
            this.scheduleFindRefresh();
        });
        this.findQueryInput.addEventListener("keydown", (event) => {
            if (event.key !== "Enter") {
                return;
            }

            event.preventDefault();
            if (event.shiftKey) {
                this.selectPreviousFindMatch();
            } else {
                this.selectNextFindMatch();
            }
        });
        replacementInput.addEventListener("input", () => {
            this.findReplacement = replacementInput.value;
        });
        caseSensitiveInput.addEventListener("change", () => {
            this.findCaseSensitive = caseSensitiveInput.checked;
            this.refreshFindFromInputChange();
        });
        regexInput.addEventListener("change", () => {
            this.findRegex = regexInput.checked;
            this.refreshFindFromInputChange();
        });
    }

    private createFindResultSection(container: HTMLElement): void {
        const section = container.createDiv({ cls: "canvas-loom-fr-results-section" });
        this.findStatusEl = section.createDiv({ cls: "canvas-loom-fr-status" });
        this.findResultListEl = section.createDiv({ cls: "canvas-loom-fr-results" });
    }

    private createFindFooter(container: HTMLElement): void {
        const footer = container.createDiv({ cls: "canvas-loom-fr-footer" });
        this.findReplaceCurrentButton = footer.createEl("button", {
            text: this.translate("workbench.button.replaceCurrent")
        });
        this.findReplaceCardButton = footer.createEl("button", {
            text: this.translate("workbench.button.replaceCard")
        });
        this.findReplaceAllButton = footer.createEl("button", {
            text: this.translate("workbench.button.replaceAll")
        });
        this.findReplaceAllButton.addClass("mod-cta");

        [
            this.findReplaceCurrentButton,
            this.findReplaceCardButton,
            this.findReplaceAllButton
        ].forEach((button) => button.setAttribute("type", "button"));

        this.findReplaceCurrentButton.addEventListener("click", () => {
            void this.replaceCurrentFindMatch();
        });
        this.findReplaceCardButton.addEventListener("click", () => {
            void this.replaceCurrentFindCard();
        });
        this.findReplaceAllButton.addEventListener("click", () => {
            void this.replaceAllFindMatches();
        });
    }

    private createFindCheckbox(container: HTMLElement, labelText: string): HTMLInputElement {
        const label = container.createEl("label", { cls: "canvas-loom-fr-checkbox" });
        const input = label.createEl("input", { type: "checkbox" });
        label.createSpan({ text: labelText });
        return input;
    }

    private scheduleFindRefresh(): void {
        this.clearFindRefreshTimer();
        this.findRefreshTimer = window.setTimeout(() => {
            this.findRefreshTimer = null;
            this.refreshFindFromInputChange();
        }, 120);
    }

    private refreshFindFromInputChange(): void {
        this.findCurrentFlatIndex = 0;
        this.renderFindResults();
    }

    private renderFindResults(): void {
        const result = this.refreshFindResults();
        if (!this.findStatusEl || !this.findResultListEl) {
            return;
        }

        if (result.error) {
            this.findStatusEl.setText(result.error);
            this.findStatusEl.addClass("is-error");
            this.findResultListEl.empty();
            this.updateFindActionButtons();
            return;
        }

        this.findStatusEl.removeClass("is-error");

        const flatMatches = this.getFlatFindMatches();
        if (this.findCurrentFlatIndex >= flatMatches.length) {
            this.findCurrentFlatIndex = Math.max(0, flatMatches.length - 1);
        }

        this.updateFindStatus(result.totalMatches, result.cards.length, result.totalCards);
        this.renderFindResultList(flatMatches);
        this.updateFindActionButtons();
    }

    private refreshFindResults(): { cards: CardSearchResult[]; totalCards: number; totalMatches: number; error?: string } {
        const findContext = this.context.findReplace;
        if (!findContext) {
            this.findResults = [];
            this.findTotalCards = 0;
            return {
                cards: [],
                totalCards: 0,
                totalMatches: 0
            };
        }

        const result = findContext.service.findMatches(this.getFindQueryOptions());
        this.findResults = result.cards;
        this.findTotalCards = result.totalCards;
        return result;
    }

    private updateFindStatus(totalMatches: number, matchedCards: number, totalCards: number): void {
        if (!this.findStatusEl) {
            return;
        }

        if (!this.findQuery) {
            this.findStatusEl.setText(this.findScope === "selection"
                ? this.translate("workbench.find.status.promptSelection", {
                    scope: this.context.findReplace?.selectedScopeLabel || this.translate("workbench.scope.selection")
                })
                : this.translate("workbench.find.status.promptCanvas"));
            return;
        }

        if (totalMatches === 0) {
            this.findStatusEl.setText(this.translate("workbench.find.status.noMatches", { totalCards }));
            return;
        }

        const currentLabel = `${Math.min(this.findCurrentFlatIndex + 1, totalMatches)} / ${totalMatches}`;
        this.findStatusEl.setText(this.translate("workbench.find.status.matches", {
            totalMatches,
            matchedCards,
            totalCards,
            currentLabel
        }));
    }

    private renderFindResultList(flatMatches: FlatSearchMatch[]): void {
        if (!this.findResultListEl) {
            return;
        }

        this.findResultListEl.empty();

        if (!this.findQuery) {
            this.findResultListEl.createDiv({
                cls: "canvas-loom-fr-empty",
                text: this.translate("workbench.find.result.waiting")
            });
            return;
        }

        if (flatMatches.length === 0) {
            this.findResultListEl.createDiv({
                cls: "canvas-loom-fr-empty",
                text: this.translate("workbench.find.result.noCards")
            });
            return;
        }

        flatMatches.forEach((item) => {
            const row = this.findResultListEl?.createDiv({
                cls: item.flatIndex === this.findCurrentFlatIndex
                    ? "canvas-loom-fr-result is-active"
                    : "canvas-loom-fr-result"
            });
            if (!row) {
                return;
            }

            row.dataset.index = String(item.flatIndex);
            row.addEventListener("click", () => this.setCurrentFindMatch(item.flatIndex, true));
            if (item.flatIndex === this.findCurrentFlatIndex) {
                row.scrollIntoView({ block: "nearest" });
            }

            const index = row.createDiv({ cls: "canvas-loom-fr-result-index" });
            index.setText(String(item.flatIndex + 1));

            const body = row.createDiv({ cls: "canvas-loom-fr-result-body" });
            const meta = body.createDiv({ cls: "canvas-loom-fr-result-meta" });
            meta.createSpan({ text: `x ${Math.round(item.card.x)} / y ${Math.round(item.card.y)}` });
            if (item.card.badge) {
                meta.createSpan({ cls: "canvas-loom-fr-result-badge", text: item.card.badge });
            }

            this.renderFindPreview(body, item.card.text, item.card.ranges[item.matchIndex]);
        });
    }

    private renderFindPreview(container: HTMLElement, text: string, range: SearchMatchPreviewRange): void {
        const preview = container.createDiv({ cls: "canvas-loom-fr-preview" });
        renderSearchMatchPreview(preview, text, range);
    }

    private setCurrentFindMatch(index: number, selectCard: boolean): void {
        this.findCurrentFlatIndex = index;
        const current = this.getCurrentFindMatch();
        if (selectCard && current) {
            const service = this.context.findReplace?.service;
            if (service?.selectNode(current.card.nodeId)) {
                service.locateNode(current.card.nodeId);
                service.highlightSearchMatch(current);
            }
        }

        this.renderFindResults();
    }

    private selectPreviousFindMatch(): void {
        const matches = this.getFlatFindMatches();
        if (matches.length === 0) {
            return;
        }

        const nextIndex = this.findCurrentFlatIndex <= 0
            ? matches.length - 1
            : this.findCurrentFlatIndex - 1;
        this.setCurrentFindMatch(nextIndex, true);
    }

    private selectNextFindMatch(): void {
        const matches = this.getFlatFindMatches();
        if (matches.length === 0) {
            return;
        }

        const nextIndex = this.findCurrentFlatIndex >= matches.length - 1
            ? 0
            : this.findCurrentFlatIndex + 1;
        this.setCurrentFindMatch(nextIndex, true);
    }

    private async replaceCurrentFindMatch(): Promise<void> {
        const current = this.getCurrentFindMatch();
        const service = this.context.findReplace?.service;
        if (!current || !service) {
            return;
        }

        const result = await service.replaceCurrent(this.getFindReplaceOptions(), {
            nodeId: current.card.nodeId,
            matchIndex: current.matchIndex
        });
        this.handleFindReplaceResult(result);
    }

    private async replaceCurrentFindCard(): Promise<void> {
        const current = this.getCurrentFindMatch();
        const service = this.context.findReplace?.service;
        if (!current || !service) {
            return;
        }

        const result = await service.replaceInCard(this.getFindReplaceOptions(), current.card.nodeId);
        this.handleFindReplaceResult(result);
    }

    private async replaceAllFindMatches(): Promise<void> {
        const service = this.context.findReplace?.service;
        if (!service) {
            return;
        }

        const result = await service.replaceAll(this.getFindReplaceOptions());
        this.handleFindReplaceResult(result);
    }

    private handleFindReplaceResult(result: ReplaceResult): void {
        if (result.error) {
            new Notice(result.error);
            this.renderFindResults();
            return;
        }

        if (result.matchedCount === 0) {
            new Notice(this.translate("notice.findReplaceNoReplacement"));
            this.renderFindResults();
            return;
        }

        if (result.changedCount === 0) {
            new Notice(this.translate("notice.findReplaceNoChange"));
            this.renderFindResults();
            return;
        }

        this.refreshWorkbenchSnapshotsFromCanvas();
        new Notice(this.translate("notice.findReplaceAllReplaced", {
            changedCount: result.changedCount,
            changedNodeCount: result.changedNodeCount
        }));
        this.renderFindResults();
    }

    private refreshWorkbenchSnapshotsFromCanvas(): void {
        const service = this.context.findReplace?.service;
        const snapshots = this.context.state.selectionSnapshot;
        if (!service || snapshots.length === 0) {
            return;
        }

        const ids = new Set(snapshots.map((snapshot) => snapshot.id));
        const latestById = new Map(service.getTextCardSnapshots(ids).map((snapshot) => [snapshot.id, snapshot]));
        this.context.state = {
            ...this.context.state,
            selectionSnapshot: snapshots.map((snapshot) => latestById.get(snapshot.id) || snapshot),
            lastComputedContent: ""
        };
    }

    private updateFindActionButtons(): void {
        const hasMatches = this.getFlatFindMatches().length > 0;
        [
            this.findReplaceCurrentButton,
            this.findReplaceCardButton,
            this.findReplaceAllButton
        ].forEach((button) => {
            if (button) {
                button.disabled = !hasMatches;
            }
        });
    }

    private getCurrentFindMatch(): FlatSearchMatch | null {
        return this.getFlatFindMatches()[this.findCurrentFlatIndex] || null;
    }

    private getFlatFindMatches(): FlatSearchMatch[] {
        const items: FlatSearchMatch[] = [];

        this.findResults.forEach((card) => {
            card.ranges.forEach((_, matchIndex) => {
                items.push({
                    card,
                    matchIndex,
                    flatIndex: items.length
                });
            });
        });

        return items;
    }

    private getFindQueryOptions(): Omit<SearchReplaceOptions, "replacement"> {
        return {
            query: this.findQuery,
            scope: this.findScope,
            selectedNodeIds: this.context.findReplace?.selectedNodeIds || new Set<string>(),
            caseSensitive: this.findCaseSensitive,
            regex: this.findRegex
        };
    }

    private getFindReplaceOptions(): SearchReplaceOptions {
        return {
            ...this.getFindQueryOptions(),
            replacement: this.findReplacement
        };
    }

    private schedulePreviewRender(previewEl: HTMLElement): void {
        this.clearPreviewTimer();
        this.previewTimer = window.setTimeout(() => {
            this.previewTimer = null;
            const content = this.renderPreviewContentNow();
            previewEl.setText(content || this.translate("workbench.panel.emptyPreview"));
        }, 200);
    }

    private renderPreviewContentNow(): string {
        const content = this.workbenchService.buildPreviewContent(this.context.state, this.context.sortPriority);
        this.context.state = this.workbenchService.setLastComputedContent(this.context.state, content);
        return content;
    }

    private renderSortPreview(): void {
        const orderedCards = this.workbenchService.getOrderedCards(this.context.state, this.context.sortPriority);
        if (orderedCards.length === 0) {
            new Notice(this.translate("notice.noPreviewTextCards"));
            return;
        }

        this.clearPreviewTimer();
        this.renderPreviewContentNow();
        this.context.state = this.workbenchService.setPreviewExpanded(this.context.state, true);
        this.activePanel = "preview";
        this.render();
    }

    private createSortModeButton(container: HTMLElement, mode: MergeOrder, label: string): void {
        const button = container.createEl("button", {
            text: label,
            cls: this.isModeButtonActive(mode) ? "is-active" : ""
        });
        button.setAttribute("type", "button");

        button.addEventListener("click", () => {
            this.context.state = this.workbenchService.setSortMode(
                this.context.state,
                mode
            );
            this.render();
        });
    }

    private isModeButtonActive(mode: MergeOrder): boolean {
        return this.context.state.sortMode === mode;
    }

    private createActionButton(container: HTMLElement, label: string, handler: () => Promise<void>, disabled: boolean): void {
        const button = container.createEl("button", {
            text: label
        });
        button.setAttribute("type", "button");

        button.disabled = disabled;
        button.addEventListener("click", () => {
            if (button.disabled) {
                new Notice(this.translate("notice.noPreviewTextCards"));
                return;
            }

            void handler();
        });
    }

    private clearWorkbench(): void {
        const currentCards = this.workbenchService.getOrderedCards(this.context.state, this.context.sortPriority);
        if (currentCards.length === 0) {
            return;
        }

        this.clearPreviewTimer();
        this.context.state = this.workbenchService.clearState(this.context.state);
        new Notice(this.translate("notice.workbenchCleared"));
        this.render();
    }

    private onDragStart(event: DragEvent, index: number): void {
        this.draggedIndex = index;
        const target = event.currentTarget as HTMLElement | null;
        target?.classList.add("is-dragging");

        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = "move";
            event.dataTransfer.setData("text/plain", String(index));
        }
    }

    private onDragOver(event: DragEvent): void {
        event.preventDefault();
        const target = event.currentTarget as HTMLElement | null;
        target?.classList.add("is-drop-target");
    }

    private onDrop(event: DragEvent, targetIndex: number): void {
        event.preventDefault();

        if (this.draggedIndex === null || this.draggedIndex === targetIndex) {
            this.onDragEnd();
            return;
        }

        this.context.state = this.workbenchService.reorderManual(
            this.context.state,
            this.draggedIndex,
            targetIndex,
            this.context.sortPriority
        );
        this.onDragEnd();
        this.render();
    }

    private onDragEnd(): void {
        this.draggedIndex = null;
        this.contentEl.querySelectorAll(".canvas-loom-workbench-row").forEach((row) => {
            row.classList.remove("is-dragging");
            row.classList.remove("is-drop-target");
        });
    }

    private getToolbarCount(): number {
        if (this.activePanel === "findReplace") {
            return this.getFindScopeTextCardCount();
        }

        return this.workbenchService.getOrderedCards(this.context.state, this.context.sortPriority).length;
    }

    private getToolbarCountLabel(): string {
        return this.activePanel === "findReplace"
            ? this.translate("workbench.count.textCards")
            : this.translate("workbench.count.workbenchCards");
    }

    private getToolbarSourceText(): string {
        if (this.activePanel === "findReplace") {
            const scopeLabel = this.findScope === "selection"
                ? this.context.findReplace?.selectedScopeLabel || this.translate("workbench.scope.selection")
                : this.translate("workbench.scope.canvas");
            return `${this.context.state.canvasFileBasename} / ${this.translate("workbench.source.findReplace")} / ${scopeLabel}`;
        }

        return `${this.context.state.canvasFileBasename} / ${this.context.state.scopeLabel}`;
    }

    private getFindScopeTextCardCount(): number {
        const findContext = this.context.findReplace;
        if (!findContext) {
            return 0;
        }

        const result = findContext.service.findMatches({
            ...this.getFindQueryOptions(),
            query: ""
        });
        return result.totalCards || this.findTotalCards;
    }

    private getFindScopeSubtitle(findContext: FindReplaceWorkbenchContext): string {
        if (this.findScope === "selection") {
            return this.translate("workbench.find.subtitle.selection", { scope: findContext.selectedScopeLabel });
        }

        return findContext.selectedTextCardCount > 0
            ? this.translate("workbench.find.subtitle.canvas")
            : this.translate("workbench.find.subtitle.canvasNoSelection");
    }

    private getCurrentOrderLabel(): string {
        const baseLabel = this.getModeLabel(this.context.state.sortMode);
        return this.context.state.isManualAdjusted
            ? this.translate("workbench.order.manualSuffix", { label: baseLabel })
            : baseLabel;
    }

    private getModeLabel(mode: MergeOrder): string {
        if (mode === "badge") {
            return this.translate("workbench.order.badge");
        }

        return this.translate("workbench.order.position");
    }

    private getListTitle(): string {
        if (this.context.state.sortMode === "badge") {
            return this.context.state.isManualAdjusted
                ? this.translate("workbench.order.badgeManualTitle")
                : this.translate("workbench.order.badgeTitle");
        }

        return this.context.state.isManualAdjusted
            ? this.translate("workbench.order.positionManualTitle")
            : this.translate("workbench.order.positionTitle");
    }

    private getSortDescription(): string {
        const cards = this.workbenchService.getOrderedCards(this.context.state, this.context.sortPriority);

        if (cards.length === 0) {
            return this.translate("workbench.sortDescription.empty");
        }

        if (this.context.state.isManualAdjusted) {
            return this.translate("workbench.sortDescription.manual");
        }

        if (this.context.state.sortMode === "badge") {
            return this.translate("workbench.sortDescription.badge");
        }

        return this.context.sortPriority === "xy"
            ? this.translate("workbench.sortDescription.xy")
            : this.translate("workbench.sortDescription.yx");
    }

    private toPreviewText(text: string): string {
        return text.length > 60 ? `${text.slice(0, 60)}...` : text;
    }

    private clearPreviewTimer(): void {
        if (this.previewTimer) {
            window.clearTimeout(this.previewTimer);
            this.previewTimer = null;
        }
    }

    private clearFindRefreshTimer(): void {
        if (this.findRefreshTimer !== null) {
            window.clearTimeout(this.findRefreshTimer);
            this.findRefreshTimer = null;
        }
    }

    private createEmptyContext(): MergeWorkbenchContext {
        const state = this.workbenchService.createState({
            canvasFilePath: null,
            canvasFileBasename: this.translate("workbench.title"),
            scopeLabel: this.translate("workbench.scope.waiting"),
            selectionSnapshot: [],
            defaultSortMode: "position",
            sortPriority: "yx",
            previewExpanded: false
        });

        return {
            state,
            sortPriority: "yx",
            onCopy: () => this.notifyEmptyWorkbench(),
            onCreateCard: () => this.notifyEmptyWorkbench(),
            onCreateMarkdown: () => this.notifyEmptyWorkbench(),
        };
    }

    private notifyEmptyWorkbench(): Promise<void> {
        new Notice(this.translate("notice.noPreviewTextCards"));
        return Promise.resolve();
    }

    private resolveCardAccent(color?: string): string {
        const palette: Record<string, string> = {
            "1": "var(--color-red, #d65d5d)",
            "2": "var(--color-orange, #d98b3a)",
            "3": "var(--color-yellow, #c59f33)",
            "4": "var(--color-green, #4f9f69)",
            "5": "var(--color-cyan, #3c9aa3)",
            "6": "var(--color-purple, #8d6fd1)",
            red: "var(--color-red, #d65d5d)",
            orange: "var(--color-orange, #d98b3a)",
            yellow: "var(--color-yellow, #c59f33)",
            green: "var(--color-green, #4f9f69)",
            cyan: "var(--color-cyan, #3c9aa3)",
            purple: "var(--color-purple, #8d6fd1)",
        };

        return color ? palette[color] || "var(--interactive-accent)" : "var(--background-modifier-border)";
    }
}
