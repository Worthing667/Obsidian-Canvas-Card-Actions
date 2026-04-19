import { ItemView, WorkspaceLeaf } from "obsidian";
import { MergeOrder } from "../../services/ContentService";

export const MERGE_PREVIEW_VIEW_TYPE = 'canvas-card-actions-merge-preview';

export class MergePreviewView extends ItemView {
    private contentElRef: HTMLElement | null = null;
    private metaElRef: HTMLElement | null = null;

    constructor(leaf: WorkspaceLeaf) {
        super(leaf);
    }

    getViewType(): string {
        return MERGE_PREVIEW_VIEW_TYPE;
    }

    getDisplayText(): string {
        return '卡片合并预览';
    }

    async onOpen(): Promise<void> {
        const { contentEl } = this;
        contentEl.empty();

        const container = contentEl.createDiv({ cls: 'canvas-card-actions-merge-preview' });
        this.metaElRef = container.createDiv({ cls: 'canvas-card-actions-merge-preview-meta' });
        this.contentElRef = container.createEl('pre', { cls: 'canvas-card-actions-merge-preview-content' });
        this.metaElRef.setText('暂无合并结果');
        this.contentElRef.setText('请在 Canvas 里选中卡片后执行“合并并侧边栏预览”。');
    }

    async onClose(): Promise<void> {
        this.contentElRef = null;
        this.metaElRef = null;
    }

    setContent(payload: { content: string; count: number; order: MergeOrder }): void {
        if (!this.contentElRef || !this.metaElRef) {
            return;
        }

        const orderText = payload.order === 'badge' ? '按徽章' : '按位置';
        this.metaElRef.setText(`已合并 ${payload.count} 张卡片（${orderText}）`);
        this.contentElRef.setText(payload.content || '没有可预览的内容');
    }
}
