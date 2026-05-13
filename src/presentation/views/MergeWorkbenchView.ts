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

    onOpen(): Promise<void> {
        this.render();
        return Promise.resolve();
    }

    onClose(): Promise<void> {
        if (this.previewTimer) {
            activeWindow.clearTimeout(this.previewTimer);
            this.previewTimer = null;
        }

        return Promise.resolve();
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

        this.createModeButton(modeGroup, 'position', '位置');
        this.createModeButton(modeGroup, 'badge', '标记');

        const currentCards = this.workbenchService.getOrderedCards(this.context.state, this.context.sortPriority);
        meta.createEl('div', { text: `${this.context.state.canvasFileBasename} · ${this.context.state.scopeLabel} · 快照 ${this.context.state.selectionSnapshot.length} 张` });
        meta.createEl('div', { text: `当前顺序 ${this.getModeLabel(this.context.state.sortMode)} · 可输出 ${currentCards.length} 张` });
    }

    private renderList(container: HTMLElement): void {
        if (!this.context) {
            return;
        }

        const section = container.createDiv({ cls: 'canvas-loom-workbench-list-section' });
        section.createEl('h4', { text: this.getListTitle(this.context.state.sortMode) });

        const cards = this.workbenchService.getOrderedCards(this.context.state, this.context.sortPriority);
        const list = section.createDiv({ cls: 'canvas-loom-workbench-list' });

        if (cards.length === 0) {
            const empty = list.createDiv({ cls: 'canvas-loom-workbench-list-empty' });
            empty.setText('当前没有可处理的文本卡片。');
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
            activeWindow.clearTimeout(this.previewTimer);
        }

        this.previewTimer = activeWindow.setTimeout(() => {
            if (!this.context) {
                return;
            }

            const content = this.workbenchService.buildPreviewContent(this.context.state, this.context.sortPriority);
            this.context.state = this.workbenchService.setLastComputedContent(this.context.state, content);
            previewEl.setText(content || '没有可预览的内容');
        }, 200);
    }

    private createModeButton(container: HTMLElement, mode: MergeOrder, label: string): void {
        if (!this.context) {
            return;
        }

        const button = container.createEl('button', {
            text: label,
            cls: this.isModeButtonActive(mode) ? 'mod-cta' : ''
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

    private isModeButtonActive(mode: MergeOrder): boolean {
        if (!this.context) {
            return false;
        }

        if (mode === 'position') {
            return this.context.state.sortMode !== 'badge';
        }

        return this.context.state.sortMode === mode;
    }

    private createActionButton(container: HTMLElement, label: string, handler: () => Promise<void>, disabled: boolean): void {
        const button = container.createEl('button', {
            text: label,
            cls: label === '复制' ? 'mod-cta' : ''
        });

        button.disabled = disabled;
        button.addEventListener('click', () => {
            if (button.disabled) {
                new Notice('当前没有可输出的卡片');
                return;
            }

            void handler();
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

    private getListTitle(mode: MergeOrder): string {
        if (mode === 'badge') {
            return '按标记排序';
        }

        return '按位置排序';
    }

    private toPreviewText(text: string): string {
        return text.length > 60 ? `${text.slice(0, 60)}...` : text;
    }
}
