import { ItemView, Notice, WorkspaceLeaf } from "obsidian";
import { SortPriority } from "../../domain/strategies";
import { PreviewWorkbenchService } from "../../services/PreviewWorkbenchService";
import { MergeOrder } from "../../services/ContentService";
import type { WorkbenchState } from "../../types/WorkbenchState";

export const MERGE_PREVIEW_VIEW_TYPE = 'canvas-loom-merge-preview';

export interface MergeWorkbenchContext {
    state: WorkbenchState;
    sortPriority: SortPriority;
    onCopy: (state: WorkbenchState) => Promise<void>;
    onCreateCard: (state: WorkbenchState) => Promise<void>;
    onCreateMarkdown: (state: WorkbenchState) => Promise<void>;
}

export class MergeWorkbenchView extends ItemView {
    private readonly workbenchService = new PreviewWorkbenchService();
    private context: MergeWorkbenchContext | null = null;
    private draggedIndex: number | null = null;
    private previewTimer: number | null = null;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType(): string {
        return MERGE_PREVIEW_VIEW_TYPE;
    }

    getDisplayText(): string {
        return '卡片预览工作台';
    }

    async onOpen(): Promise<void> {
        this.ensureStyles();
        this.render();
    }

    async onClose(): Promise<void> {
        if (this.previewTimer) {
            window.clearTimeout(this.previewTimer);
            this.previewTimer = null;
        }
    }

    setWorkbenchContext(context: MergeWorkbenchContext): void {
        this.context = context;
        this.render();
    }

    private render(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass('canvas-loom-workbench');

        if (!this.context) {
        const emptyState = contentEl.createDiv({ cls: 'canvas-loom-workbench-empty' });
            emptyState.createEl('h3', { text: '暂无工作台内容' });
            emptyState.createEl('p', { text: '请先在画布中多选卡片，再执行“打开预览...”或相关命令。' });
            return;
        }

        const container = contentEl.createDiv({ cls: 'canvas-loom-workbench-container' });
        this.renderToolbar(container);
        this.renderList(container);
        this.renderPreviewArea(container);
    }

    private renderToolbar(container: HTMLElement): void {
        if (!this.context) {
            return;
        }

        const toolbar = container.createDiv({ cls: 'canvas-loom-workbench-toolbar' });
        const modeGroup = toolbar.createDiv({ cls: 'canvas-loom-workbench-modes' });
        const meta = toolbar.createDiv({ cls: 'canvas-loom-workbench-meta' });

        this.createPositionModeButton(modeGroup);
        this.createModeButton(modeGroup, 'badge', '标记');

        const currentCards = this.workbenchService.getOrderedCards(this.context.state, this.context.sortPriority);
        meta.createEl('div', { text: `${this.context.state.canvasFileBasename} · 快照 ${this.context.state.selectionSnapshot.length} 张` });
        meta.createEl('div', { text: `当前模式 ${this.getModeLabel(this.context.state.sortMode)} · 可输出 ${currentCards.length} 张` });
    }

    private renderList(container: HTMLElement): void {
        if (!this.context) {
            return;
        }

        const section = container.createDiv({ cls: 'canvas-loom-workbench-list-section' });
        section.createEl('h4', { text: this.context.state.sortMode === 'badge' ? '按标记排序' : '按位置排序' });

        const cards = this.workbenchService.getOrderedCards(this.context.state, this.context.sortPriority);
        const list = section.createDiv({ cls: 'canvas-loom-workbench-list' });

        if (cards.length === 0) {
        const empty = list.createDiv({ cls: 'canvas-loom-workbench-list-empty' });
            empty.setText(this.context.state.sortMode === 'badge' ? '当前没有可按标记排序的卡片。' : '当前没有可处理的文本卡片。');
            return;
        }

        cards.forEach((card, index) => {
            const row = list.createDiv({ cls: 'canvas-loom-workbench-row' });
            row.dataset.index = index.toString();
            row.setAttribute('draggable', String(this.isPositionModeActive()));

            if (this.isPositionModeActive()) {
                row.addEventListener('dragstart', (event) => this.onDragStart(event, index));
                row.addEventListener('dragover', (event) => this.onDragOver(event));
                row.addEventListener('dragleave', () => row.classList.remove('is-drop-target'));
                row.addEventListener('drop', (event) => this.onDrop(event, index));
                row.addEventListener('dragend', () => this.onDragEnd());
            }

            const indexEl = row.createDiv({ cls: 'canvas-loom-workbench-index' });
            indexEl.setText(String(index + 1));

            const textEl = row.createDiv({ cls: 'canvas-loom-workbench-text' });
            textEl.setText(this.toPreviewText(card.text));
            textEl.title = card.text;

            if (card.badge) {
            const badgeEl = row.createDiv({ cls: 'canvas-loom-workbench-badge' });
                badgeEl.setText(card.badge);
            }

            if (this.isPositionModeActive()) {
            const handle = row.createDiv({ cls: 'canvas-loom-workbench-handle' });
                handle.setText('⠿');
            }
        });
    }

    private renderPreviewArea(container: HTMLElement): void {
        if (!this.context) {
            return;
        }

        const section = container.createDiv({ cls: 'canvas-loom-workbench-preview-section' });
        const header = section.createDiv({ cls: 'canvas-loom-workbench-preview-header' });
        const toggle = header.createEl('button', {
            text: this.context.state.previewExpanded ? '收起结果预览' : '展开结果预览',
            cls: 'mod-cta'
        });

        toggle.addEventListener('click', () => {
            if (!this.context) {
                return;
            }

            this.context.state = this.workbenchService.setPreviewExpanded(
                this.context.state,
                !this.context.state.previewExpanded
            );
            this.render();
        });

        const orderedCards = this.workbenchService.getOrderedCards(this.context.state, this.context.sortPriority);
        const hint = header.createDiv({ cls: 'canvas-loom-workbench-preview-hint' });

        if (!this.context.state.previewExpanded) {
            hint.setText(
                orderedCards.length >= this.workbenchService.previewCollapseThreshold
                    ? '内容较多，展开后再渲染预览。'
                    : '预览默认折叠，展开后生成合并结果。'
            );
        }

        const preview = section.createEl('pre', { cls: 'canvas-loom-workbench-preview-content' });
        if (this.context.state.previewExpanded) {
            preview.setText(this.context.state.lastComputedContent || '正在生成预览...');
            this.schedulePreviewRender(preview);
        } else {
            preview.addClass('is-collapsed');
            preview.setText('预览已折叠。');
        }

        const actions = section.createDiv({ cls: 'canvas-loom-workbench-actions' });
        const hasCards = orderedCards.length > 0;
        this.createActionButton(actions, '复制', async () => {
            if (this.context) {
                await this.context.onCopy(this.context.state);
            }
        }, !hasCards);
        this.createActionButton(actions, '新建卡片', async () => {
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
        if (!this.context) {
            return;
        }

        if (this.previewTimer) {
            window.clearTimeout(this.previewTimer);
        }

        this.previewTimer = window.setTimeout(() => {
            if (!this.context) {
                return;
            }

            const content = this.workbenchService.buildPreviewContent(this.context.state, this.context.sortPriority);
            this.context.state = this.workbenchService.setLastComputedContent(this.context.state, content);
            previewEl.setText(content || '没有可预览的内容');
        }, 200);
    }

    private createPositionModeButton(container: HTMLElement): void {
        if (!this.context) {
            return;
        }

        const button = container.createEl('button', {
            text: '位置',
            cls: this.isPositionModeActive() ? 'mod-cta' : ''
        });

        button.addEventListener('click', () => {
            if (!this.context) {
                return;
            }

            this.context.state = this.workbenchService.setSortMode(
                this.context.state,
                'position',
                this.context.sortPriority
            );
            this.render();
        });
    }

    private createModeButton(container: HTMLElement, mode: MergeOrder, label: string): void {
        if (!this.context) {
            return;
        }

        const button = container.createEl('button', {
            text: label,
            cls: this.context.state.sortMode === mode ? 'mod-cta' : ''
        });

        button.addEventListener('click', () => {
            if (!this.context) {
                return;
            }

            this.context.state = this.workbenchService.setSortMode(
                this.context.state,
                mode,
                this.context.sortPriority
            );
            this.render();
        });
    }

    private isPositionModeActive(): boolean {
        return !!this.context && this.context.state.sortMode !== 'badge';
    }

    private createActionButton(container: HTMLElement, label: string, handler: () => Promise<void>, disabled: boolean): void {
        const button = container.createEl('button', {
            text: label,
            cls: label === '复制' ? 'mod-cta' : ''
        });

        button.disabled = disabled;
        button.addEventListener('click', async () => {
            if (button.disabled) {
                new Notice('当前没有可输出的卡片');
                return;
            }

            await handler();
        });
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

        if (!this.context || this.draggedIndex === null || this.draggedIndex === targetIndex) {
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

    private getModeLabel(mode: MergeOrder): string {
        if (mode === 'badge') {
            return '标记';
        }

        return '位置';
    }

    private toPreviewText(text: string): string {
        return text.length > 60 ? `${text.slice(0, 60)}...` : text;
    }

    private ensureStyles(): void {
        if (document.getElementById('canvas-loom-workbench-style')) {
            return;
        }

        const style = document.createElement('style');
        style.id = 'canvas-loom-workbench-style';
        style.textContent = `
        .canvas-loom-workbench-container {
                display: flex;
                flex-direction: column;
                gap: 16px;
                padding: 12px;
            }

        .canvas-loom-workbench-empty {
                padding: 20px;
                color: var(--text-muted);
            }

        .canvas-loom-workbench-toolbar {
                display: flex;
                justify-content: space-between;
                gap: 12px;
                align-items: flex-start;
                flex-wrap: wrap;
            }

        .canvas-loom-workbench-modes,
        .canvas-loom-workbench-actions {
                display: flex;
                gap: 8px;
                flex-wrap: wrap;
            }

        .canvas-loom-workbench-meta {
                color: var(--text-muted);
                font-size: 12px;
                display: flex;
                flex-direction: column;
                gap: 4px;
            }

        .canvas-loom-workbench-list {
                border: 1px solid var(--background-modifier-border);
                border-radius: 8px;
                overflow: hidden;
                background: var(--background-secondary);
            }

        .canvas-loom-workbench-row {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 10px 12px;
                border-bottom: 1px solid var(--background-modifier-border);
                user-select: none;
            }

        .canvas-loom-workbench-row:last-child {
                border-bottom: none;
            }

        .canvas-loom-workbench-row[draggable="true"] {
                cursor: grab;
            }

        .canvas-loom-workbench-row.is-dragging {
                opacity: 0.45;
            }

        .canvas-loom-workbench-row.is-drop-target {
                background: var(--background-modifier-hover);
            }

        .canvas-loom-workbench-index {
                min-width: 24px;
                color: var(--text-faint);
                font-variant-numeric: tabular-nums;
            }

        .canvas-loom-workbench-text {
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
            }

        .canvas-loom-workbench-badge {
                padding: 2px 8px;
                border-radius: 999px;
                background: var(--background-modifier-hover);
                color: var(--text-accent);
                font-size: 12px;
            }

        .canvas-loom-workbench-handle {
                color: var(--text-faint);
                font-size: 16px;
            }

        .canvas-loom-workbench-list-empty {
                padding: 16px 12px;
                color: var(--text-muted);
            }

        .canvas-loom-workbench-preview-section {
                border-top: 1px solid var(--background-modifier-border);
                padding-top: 12px;
                display: flex;
                flex-direction: column;
                gap: 12px;
            }

        .canvas-loom-workbench-preview-header {
                display: flex;
                justify-content: space-between;
                gap: 12px;
                align-items: center;
                flex-wrap: wrap;
            }

        .canvas-loom-workbench-preview-hint {
                color: var(--text-muted);
                font-size: 12px;
            }

        .canvas-loom-workbench-preview-content {
                margin: 0;
                padding: 12px;
                background: var(--background-secondary);
                border: 1px solid var(--background-modifier-border);
                border-radius: 8px;
                white-space: pre-wrap;
                max-height: 260px;
                overflow: auto;
            }

        .canvas-loom-workbench-preview-content.is-collapsed {
                color: var(--text-muted);
            }
        `;

        document.head.appendChild(style);
    }
}
