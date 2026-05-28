import { App, Modal, Notice } from "obsidian";
import { ClipboardAdapter } from "../../adapters/ClipboardAdapter";
import { PositionSortStrategy, SortPriority } from "../../domain/strategies/PositionSort";
import type { CanvasNode } from "../../types/canvas";
import { modalT } from "./modalI18n";

interface DragSortCardItem {
    node: CanvasNode;
    id: string;
    text: string;
    previewText: string;
    hasBadge: boolean;
    badgeContent?: string;
}

interface DragSortActionContext {
    nodes: CanvasNode[];
    items: DragSortCardItem[];
    modal: DragSortModal;
}

interface DragSortAction {
    text: string;
    cls: string;
    onClick: (context: DragSortActionContext) => Promise<void>;
}

interface DragSortModalOptions {
    title?: string;
    description?: (count: number) => string;
    actions?: DragSortAction[];
    sortPriority?: SortPriority;
}

export class DragSortModal extends Modal {
    private cards: CanvasNode[];
    private cardItems: DragSortCardItem[] = [];
    private listContainer: HTMLElement;
    private draggedIndex: number | null = null;
    private readonly title?: string;
    private readonly descriptionBuilder?: (count: number) => string;
    private readonly actions: DragSortAction[];
    private readonly sortPriority: SortPriority;

    constructor(app: App, cards: CanvasNode[], options: DragSortModalOptions = {}) {
        super(app);
        this.cards = cards;
        this.title = options.title;
        this.descriptionBuilder = options.description;
        this.sortPriority = options.sortPriority || 'yx';
        this.actions = options.actions || [
            {
                text: this.t("modal.dragSort.copy"),
                cls: "drag-sort-btn drag-sort-btn-primary",
                onClick: async ({ items, modal }) => {
                    const content = items.map((item) => item.text).join("\n\n");
                    const clipboardAdapter = new ClipboardAdapter();
                    await clipboardAdapter.writeTextWithNotice(
                        content,
                        this.t("modal.dragSort.copied", { count: items.length })
                    );
                    modal.close();
                }
            }
        ];
        this.processCards();
    }

    private processCards(): void {
        // 提取卡片数据并按位置排序作为初始顺序
        const rawItems: Array<DragSortCardItem & { x: number; y: number }> = [];

        for (const node of this.cards) {
            const data = node.getData();
            if (data.type === "text" && data.text && data.text.trim()) {
                rawItems.push({
                    node,
                    id: data.id,
                    text: data.text.trim(),
                    previewText:
                        data.text.trim().length > 50
                            ? data.text.trim().substring(0, 50) + "..."
                            : data.text.trim(),
                    hasBadge: !!data.badge,
                    badgeContent: data.badge,
                    x: data.x,
                    y: data.y,
                });
            }
        }

        const sorter = new PositionSortStrategy(this.sortPriority, 10);
        this.cardItems = sorter.sort(rawItems);
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("drag-sort-modal");

        // 标题
        contentEl.createEl("h2", { text: this.getTitle() });

        // 说明文字
        const desc = contentEl.createDiv({ cls: "drag-sort-desc" });
        desc.setText(this.getDescription(this.cardItems.length));

        // 可拖拽列表
        this.listContainer = contentEl.createDiv({ cls: "drag-sort-list" });
        this.renderList();

        // 底部按钮
        const footer = contentEl.createDiv({ cls: "drag-sort-footer" });

        const resetBtn = footer.createEl("button", {
            text: this.t("modal.dragSort.reset"),
            cls: "drag-sort-btn drag-sort-btn-secondary",
        });
        resetBtn.addEventListener("click", () => {
            this.processCards();
            this.renderList();
            new Notice(this.t("modal.dragSort.resetDone"));
        });

        this.actions.forEach((action) => {
            const actionBtn = footer.createEl("button", {
                text: this.getActionText(action.text),
                cls: action.cls,
            });
            actionBtn.addEventListener("click", () => {
                void action.onClick({
                    nodes: this.cardItems.map((item) => item.node),
                    items: [...this.cardItems],
                    modal: this
                });
            });
        });
    }

    private renderList(): void {
        this.listContainer.empty();

        this.cardItems.forEach((item, index) => {
            const row = this.listContainer.createDiv({ cls: "drag-sort-item" });
            row.setAttribute("draggable", "true");
            row.dataset.index = index.toString();

            // 拖拽把手
            const handle = row.createDiv({ cls: "drag-sort-handle" });
            handle.setText("⠿");

            // 序号
            const indexEl = row.createDiv({ cls: "drag-sort-index" });
            indexEl.setText((index + 1).toString());

            // 文本预览
            const preview = row.createDiv({ cls: "drag-sort-preview" });
            preview.setText(item.previewText);
            preview.setAttribute("title", item.text);

            // 标记
            if (item.hasBadge && item.badgeContent) {
                const badge = row.createDiv({ cls: "drag-sort-badge" });
                badge.setText(item.badgeContent);
            }

            // 拖拽事件
            row.addEventListener("dragstart", (e) => this.onDragStart(e, index));
            row.addEventListener("dragover", (e) => this.onDragOver(e, index));
            row.addEventListener("dragenter", (e) => this.onDragEnter(e, row));
            row.addEventListener("dragleave", (e) => this.onDragLeave(e, row));
            row.addEventListener("drop", (e) => this.onDrop(e, index));
            row.addEventListener("dragend", () => this.onDragEnd());
        });
    }

    private onDragStart(e: DragEvent, index: number): void {
        this.draggedIndex = index;
        const target = e.currentTarget as HTMLElement;
        target.classList.add("dragging");

        if (e.dataTransfer) {
            e.dataTransfer.effectAllowed = "move";
            e.dataTransfer.setData("text/plain", index.toString());
        }
    }

    private onDragOver(e: DragEvent, index: number): void {
        e.preventDefault();
        if (e.dataTransfer) {
            e.dataTransfer.dropEffect = "move";
        }
    }

    private onDragEnter(e: DragEvent, row: HTMLElement): void {
        e.preventDefault();
        if (this.draggedIndex === null) return;

        const targetIndex = parseInt(row.dataset.index || "0");
        if (targetIndex === this.draggedIndex) return;

        row.classList.add("drag-over");
    }

    private onDragLeave(e: DragEvent, row: HTMLElement): void {
        // 只有当真正离开元素时才移除高亮
        const relatedTarget = e.relatedTarget as HTMLElement;
        if (row.contains(relatedTarget)) return;
        row.classList.remove("drag-over");
    }

    private onDrop(e: DragEvent, targetIndex: number): void {
        e.preventDefault();

        if (this.draggedIndex === null || this.draggedIndex === targetIndex) {
            this.clearDragStates();
            return;
        }

        // 移动元素
        const [movedItem] = this.cardItems.splice(this.draggedIndex, 1);
        this.cardItems.splice(targetIndex, 0, movedItem);

        this.clearDragStates();
        this.renderList();
    }

    private onDragEnd(): void {
        this.clearDragStates();
    }

    private clearDragStates(): void {
        this.draggedIndex = null;
        const items = this.listContainer.querySelectorAll(".drag-sort-item");
        items.forEach((item) => {
            item.classList.remove("dragging", "drag-over");
        });
    }

    private getTitle(): string {
        if (!this.title || this.title === "\u624b\u52a8\u6392\u5e8f\u590d\u5236") {
            return this.t("modal.dragSort.defaultTitle");
        }

        if (this.title === "\u624b\u52a8\u6392\u5e8f\u62fc\u5408") {
            return this.t("modal.dragSort.manualMergeTitle");
        }

        return this.title;
    }

    private getDescription(count: number): string {
        if (!this.descriptionBuilder) {
            return this.t("modal.dragSort.defaultDescription", { count });
        }

        if (this.title === "\u624b\u52a8\u6392\u5e8f\u62fc\u5408") {
            return this.t("modal.dragSort.manualMergeDescription", { count });
        }

        return this.descriptionBuilder(count);
    }

    private getActionText(text: string): string {
        switch (text) {
            case "\u590d\u5236":
                return this.t("modal.dragSort.copy");
            case "\u6dfb\u52a0\u4e3a\u65b0\u5361\u7247":
                return this.t("modal.dragSort.addAsCard");
            case "\u9884\u89c8\u5361\u7247\u7ec4":
                return this.t("modal.dragSort.previewGroup");
            case "\u65b0\u5efa\u6587\u7a3f":
                return this.t("modal.dragSort.newDocument");
            default:
                return text;
        }
    }

    private t(key: Parameters<typeof modalT>[1], params?: Parameters<typeof modalT>[2]): string {
        return modalT(this.app, key, params);
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();
    }
}
