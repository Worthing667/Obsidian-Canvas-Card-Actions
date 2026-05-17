import { ItemView, Notice, WorkspaceLeaf, setIcon } from "obsidian";
import { SortPriority } from "../../domain/strategies";
import { PreviewWorkbenchService } from "../../services/PreviewWorkbenchService";
import { MergeOrder } from "../../services/ContentService";
import type { WorkbenchState } from "../../types/WorkbenchState";

export const MERGE_PREVIEW_VIEW_TYPE = 'canvas-loom-merge-preview';
const MERGE_PREVIEW_VIEW_ICON = 'panel-right';
const EMPTY_WORKBENCH_CARD_NOTICE = '当前没有可输出的卡片';
const CLEAR_WORKBENCH_NOTICE = '已清空 Loom工作台';

export interface MergeWorkbenchContext {
    state: WorkbenchState;
    sortPriority: SortPriority;
    onCopy: (state: WorkbenchState) => Promise<void>;
    onCreateCard: (state: WorkbenchState) => Promise<void>;
    onCreateMarkdown: (state: WorkbenchState) => Promise<void>;
}

export class MergeWorkbenchView extends ItemView {
    private readonly workbenchService = new PreviewWorkbenchService();
    private context: MergeWorkbenchContext = this.createEmptyContext();
    private draggedIndex: number | null = null;
    private previewTimer: number | null = null;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType(): string {
        return MERGE_PREVIEW_VIEW_TYPE;
    }

    getDisplayText(): string {
        return 'Loom工作台';
    }

    getIcon(): string {
        return MERGE_PREVIEW_VIEW_ICON;
    }

    onOpen(): Promise<void> {
        this.render();
        return Promise.resolve();
    }

    onClose(): Promise<void> {
        if (this.previewTimer) {
            window.clearTimeout(this.previewTimer);
            this.previewTimer = null;
        }

        return Promise.resolve();
    }

    setWorkbenchContext(context: MergeWorkbenchContext): void {
        this.context = context;
        this.render();
    }

    getWorkbenchState(): WorkbenchState {
        return this.context.state;
    }

    private render(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('canvas-loom-workbench');

        const container = contentEl.createDiv({ cls: 'canvas-loom-workbench-container' });
        this.renderToolbar(container);
        this.renderOrderSummary(container);
        this.renderList(container);
        this.renderPreviewArea(container);
    }

    private renderToolbar(container: HTMLElement): void {
        const currentCards = this.workbenchService.getOrderedCards(this.context.state, this.context.sortPriority);

        const toolbar = container.createDiv({ cls: 'canvas-loom-workbench-toolbar' });
        const heading = toolbar.createDiv({ cls: 'canvas-loom-workbench-heading' });
        heading.createEl('h3', { text: 'Loom工作台' });
        heading.createDiv({
            cls: 'canvas-loom-workbench-source',
            text: `${this.context.state.canvasFileBasename} / ${this.context.state.scopeLabel}`
        });

        const actions = toolbar.createDiv({ cls: 'canvas-loom-workbench-toolbar-actions' });
        const count = actions.createDiv({ cls: 'canvas-loom-workbench-count' });
        count.createEl('strong', { text: String(currentCards.length) });
        count.createEl('span', { text: '可输出卡片' });

        const clearButton = actions.createEl('button', {
            cls: 'canvas-loom-workbench-clear-button'
        });
        clearButton.setAttribute('type', 'button');
        clearButton.setAttribute('aria-label', '清空工作台');
        clearButton.setAttribute('title', '清空工作台');
        setIcon(clearButton, 'trash-2');
        clearButton.createSpan({ text: '清空' });
        clearButton.disabled = currentCards.length === 0;
        clearButton.addEventListener('click', () => this.clearWorkbench());

        const modeGroup = container.createDiv({ cls: 'canvas-loom-workbench-modes' });
        this.createModeButton(modeGroup, 'position', '位置');
        this.createModeButton(modeGroup, 'badge', '标记');
    }

    private renderOrderSummary(container: HTMLElement): void {
        const summary = container.createDiv({ cls: 'canvas-loom-workbench-order-summary' });
        const text = summary.createDiv({ cls: 'canvas-loom-workbench-order-text' });
        text.createEl('strong', { text: this.getListTitle() });
        text.createSpan({ text: `，${this.getSortDescription()}` });

        const snapshot = summary.createDiv({ cls: 'canvas-loom-workbench-snapshot' });
        snapshot.createSpan({ text: `快照 ${this.context.state.selectionSnapshot.length} 张` });
        snapshot.createSpan({ text: `当前顺序 ${this.getCurrentOrderLabel()}` });
    }

    private renderList(container: HTMLElement): void {
        const section = container.createDiv({ cls: 'canvas-loom-workbench-list-section' });
        const cards = this.workbenchService.getOrderedCards(this.context.state, this.context.sortPriority);
        const list = section.createDiv({ cls: 'canvas-loom-workbench-list' });

        if (cards.length === 0) {
            const empty = list.createDiv({ cls: 'canvas-loom-workbench-list-empty' });
            empty.setText('选择多张文本卡片后，使用右键菜单“预览卡片组”载入当前选区。');
            return;
        }

        cards.forEach((card, index) => {
            const row = list.createDiv({ cls: 'canvas-loom-workbench-row' });
            row.dataset.index = index.toString();
            row.setAttribute('draggable', 'true');
            row.style.setProperty('--canvas-loom-row-accent', this.resolveCardAccent(card.color));

            row.addEventListener('dragstart', (event) => this.onDragStart(event, index));
            row.addEventListener('dragover', (event) => this.onDragOver(event));
            row.addEventListener('dragleave', () => row.classList.remove('is-drop-target'));
            row.addEventListener('drop', (event) => this.onDrop(event, index));
            row.addEventListener('dragend', () => this.onDragEnd());

            const indexEl = row.createDiv({ cls: 'canvas-loom-workbench-index' });
            indexEl.setText(String(index + 1).padStart(2, '0'));

            const body = row.createDiv({ cls: 'canvas-loom-workbench-card-body' });
            const textEl = body.createDiv({ cls: 'canvas-loom-workbench-text' });
            textEl.setText(this.toPreviewText(card.text));
            textEl.title = card.text;

            const meta = body.createDiv({ cls: 'canvas-loom-workbench-card-meta' });
            if (card.badge) {
                const badgeEl = meta.createSpan({ cls: 'canvas-loom-workbench-badge' });
                badgeEl.setText(card.badge);
            }
            meta.createSpan({
                cls: 'canvas-loom-workbench-coordinate',
                text: `x ${Math.round(card.x)} / y ${Math.round(card.y)}`
            });

            const handle = row.createDiv({ cls: 'canvas-loom-workbench-handle' });
            handle.setAttribute('aria-label', '拖拽调整顺序');
            handle.setAttribute('title', '拖拽调整顺序');
        });
    }

    private renderPreviewArea(container: HTMLElement): void {
        const orderedCards = this.workbenchService.getOrderedCards(this.context.state, this.context.sortPriority);
        const section = container.createDiv({ cls: 'canvas-loom-workbench-preview-section' });
        if (this.context.state.previewExpanded) {
            section.addClass('is-expanded');
        }

        const toggle = section.createEl('button', {
            cls: 'canvas-loom-workbench-preview-toggle'
        });
        toggle.setAttribute('type', 'button');
        const toggleText = toggle.createSpan();
        toggleText.createEl('strong', { text: '卡片组预览' });
        const toggleHint = toggleText.createSpan({
            text: orderedCards.length === 0
                ? '等待卡片渲染进工作台。'
                : this.context.state.previewExpanded
                ? '当前内容由工作台顺序生成，输出按钮使用同一份结果。'
                : orderedCards.length >= this.workbenchService.previewCollapseThreshold
                    ? '内容较多，展开后再渲染合并文本。'
                    : '已折叠，展开后生成当前顺序的合并文本。'
        });
        toggleHint.addClass('canvas-loom-workbench-preview-hint');
        toggle.createSpan({ cls: 'canvas-loom-workbench-chevron' });

        toggle.addEventListener('click', () => {
            this.context.state = this.workbenchService.setPreviewExpanded(
                this.context.state,
                !this.context.state.previewExpanded
            );
            this.render();
        });

        const preview = section.createEl('pre', { cls: 'canvas-loom-workbench-preview-content' });
        if (this.context.state.previewExpanded) {
            preview.setText(this.context.state.lastComputedContent || '正在生成预览...');
            this.schedulePreviewRender(preview);
        } else {
            preview.addClass('is-collapsed');
            preview.setText('');
        }

        const actions = section.createDiv({ cls: 'canvas-loom-workbench-actions' });
        const hasCards = orderedCards.length > 0;
        this.createActionButton(actions, '复制', async () => {
            if (this.context) {
                await this.context.onCopy(this.context.state);
            }
        }, !hasCards);
        this.createActionButton(actions, '添加为新卡片', async () => {
            if (this.context) {
                await this.context.onCreateCard(this.context.state);
            }
        }, !hasCards);
        this.createActionButton(actions, '新建文稿', async () => {
            if (this.context) {
                await this.context.onCreateMarkdown(this.context.state);
            }
        }, !hasCards);
    }

    private schedulePreviewRender(previewEl: HTMLElement): void {
        if (this.previewTimer) {
            window.clearTimeout(this.previewTimer);
        }

        this.previewTimer = window.setTimeout(() => {
            const content = this.workbenchService.buildPreviewContent(this.context.state, this.context.sortPriority);
            this.context.state = this.workbenchService.setLastComputedContent(this.context.state, content);
            previewEl.setText(content || '没有可预览的内容');
        }, 200);
    }

    private createModeButton(container: HTMLElement, mode: MergeOrder, label: string): void {
        const button = container.createEl('button', {
            text: label,
            cls: this.isModeButtonActive(mode) ? 'is-active' : ''
        });
        button.setAttribute('type', 'button');

        button.addEventListener('click', () => {
            this.context.state = this.workbenchService.setSortMode(
                this.context.state,
                mode,
                this.context.sortPriority
            );
            this.render();
        });
    }

    private isModeButtonActive(mode: MergeOrder): boolean {
        return this.context.state.sortMode === mode;
    }

    private createActionButton(container: HTMLElement, label: string, handler: () => Promise<void>, disabled: boolean): void {
        const button = container.createEl('button', {
            text: label
        });
        button.setAttribute('type', 'button');

        button.disabled = disabled;
        button.addEventListener('click', () => {
            if (button.disabled) {
                new Notice(EMPTY_WORKBENCH_CARD_NOTICE);
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

        if (this.previewTimer) {
            window.clearTimeout(this.previewTimer);
            this.previewTimer = null;
        }

        this.context.state = this.workbenchService.clearState(this.context.state);
        new Notice(CLEAR_WORKBENCH_NOTICE);
        this.render();
    }

    private onDragStart(event: DragEvent, index: number): void {
        this.draggedIndex = index;
        const target = event.currentTarget as HTMLElement | null;
        target?.classList.add('is-dragging');

        if (event.dataTransfer) {
            event.dataTransfer.effectAllowed = 'move';
            event.dataTransfer.setData('text/plain', String(index));
        }
    }

    private onDragOver(event: DragEvent): void {
        event.preventDefault();
        const target = event.currentTarget as HTMLElement | null;
        target?.classList.add('is-drop-target');
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
        this.contentEl.querySelectorAll('.canvas-loom-workbench-row').forEach((row) => {
            row.classList.remove('is-dragging');
            row.classList.remove('is-drop-target');
        });
    }

    private getCurrentOrderLabel(): string {
        const baseLabel = this.getModeLabel(this.context.state.sortMode);
        return this.context.state.isManualAdjusted
            ? `${baseLabel} + 手动调整`
            : baseLabel;
    }

    private getModeLabel(mode: MergeOrder): string {
        if (mode === 'badge') {
            return '标记';
        }

        return '位置';
    }

    private getListTitle(): string {
        if (this.context.state.sortMode === 'badge') {
            return this.context.state.isManualAdjusted
                ? '按标记排序并手动调整'
                : '按标记排序';
        }

        return this.context.state.isManualAdjusted
            ? '按位置排序并手动调整'
            : '按位置排序';
    }

    private getSortDescription(): string {
        const cards = this.workbenchService.getOrderedCards(this.context.state, this.context.sortPriority);

        if (cards.length === 0) {
            return '工作台会在收到卡片快照后生成输出内容';
        }

        if (this.context.state.isManualAdjusted) {
            return '拖拽后的顺序会直接用于复制、添加为新卡片和新建文稿';
        }

        if (this.context.state.sortMode === 'badge') {
            return '相同标记内继续按画布位置排列';
        }

        return this.context.sortPriority === 'xy'
            ? 'Z字排序，从左至右、从上到下'
            : '倒N排序，从上到下、从左至右';
    }

    private toPreviewText(text: string): string {
        return text.length > 60 ? `${text.slice(0, 60)}...` : text;
    }

    private createEmptyContext(): MergeWorkbenchContext {
        const state = this.workbenchService.createState({
            canvasFilePath: null,
            canvasFileBasename: 'Loom工作台',
            scopeLabel: '等待卡片组',
            selectionSnapshot: [],
            defaultSortMode: 'position',
            sortPriority: 'yx',
            previewExpanded: false
        });

        return {
            state,
            sortPriority: 'yx',
            onCopy: () => this.notifyEmptyWorkbench(),
            onCreateCard: () => this.notifyEmptyWorkbench(),
            onCreateMarkdown: () => this.notifyEmptyWorkbench(),
        };
    }

    private notifyEmptyWorkbench(): Promise<void> {
        new Notice(EMPTY_WORKBENCH_CARD_NOTICE);
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
