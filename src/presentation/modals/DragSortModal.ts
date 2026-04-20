import { Modal, Notice } from "obsidian";
import { ClipboardAdapter } from "../../adapters/ClipboardAdapter";
import { ModalStyleManager } from "../styles/ModalStyles";
import { PositionSortStrategy } from "../../domain/strategies/PositionSort";

interface DragSortCardItem {
    node: any;
    id: string;
    text: string;
    previewText: string;
    hasBadge: boolean;
    badgeContent?: string;
}

interface DragSortActionContext {
    nodes: any[];
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
}

export class DragSortModal extends Modal {
    private cards: any[];
    private cardItems: DragSortCardItem[] = [];
    private listContainer: HTMLElement;
    private draggedIndex: number | null = null;
    private readonly title: string;
    private readonly descriptionBuilder: (count: number) => string;
    private readonly actions: DragSortAction[];

    constructor(app: any, cards: any[], options: DragSortModalOptions = {}) {
        super(app);
        this.cards = cards;
        this.title = options.title || "手动排序复制";
        this.descriptionBuilder = options.description || ((count) => `拖拽卡片调整复制顺序（共 ${count} 张卡片）`);
        this.actions = options.actions || [
            {
                text: "复制",
                cls: "drag-sort-btn drag-sort-btn-primary",
                onClick: async ({ items, modal }) => {
                    const content = items.map((item) => item.text).join("\n\n");
                    const clipboardAdapter = new ClipboardAdapter();
                    await clipboardAdapter.writeTextWithNotice(content, `已按手动排序复制 ${items.length} 张卡片的内容`);
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

        // 按位置排序：从上到下，从左到右
        const sorter = new PositionSortStrategy('yx', 10);
        this.cardItems = sorter.sort(rawItems as unknown as any[]) as unknown as DragSortCardItem[];
    }

    onOpen(): void {
        const { contentEl } = this;
        contentEl.empty();
        contentEl.addClass("drag-sort-modal");

        // 标题
        contentEl.createEl("h2", { text: this.title });

        // 说明文字
        const desc = contentEl.createDiv({ cls: "drag-sort-desc" });
        desc.setText(this.descriptionBuilder(this.cardItems.length));

        // 可拖拽列表
        this.listContainer = contentEl.createDiv({ cls: "drag-sort-list" });
        this.renderList();

        // 底部按钮
        const footer = contentEl.createDiv({ cls: "drag-sort-footer" });

        const resetBtn = footer.createEl("button", {
            text: "重置排序",
            cls: "drag-sort-btn drag-sort-btn-secondary",
        });
        resetBtn.addEventListener("click", () => {
            this.processCards();
            this.renderList();
            new Notice("已重置排序");
        });

        this.actions.forEach((action) => {
            const actionBtn = footer.createEl("button", {
                text: action.text,
                cls: action.cls,
            });
            actionBtn.addEventListener("click", async () => {
                await action.onClick({
                    nodes: this.cardItems.map((item) => item.node),
                    items: [...this.cardItems],
                    modal: this
                });
            });
        });

        // 注入样式
        ModalStyleManager.injectSharedStyles();
        this.addStyles();
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

            // 徽章
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

    private addStyles(): void {
        const style = document.createElement("style");
        style.id = "drag-sort-modal-styles";

        // 避免重复注入
        if (document.getElementById("drag-sort-modal-styles")) {
            document.getElementById("drag-sort-modal-styles")?.remove();
        }

        style.textContent = `
            .drag-sort-modal {
                padding: 0;
            }

            .drag-sort-desc {
                color: var(--text-muted);
                margin-bottom: 16px;
                font-size: 13px;
            }

            .drag-sort-list {
                background: var(--background-secondary-alt);
                border-radius: 6px;
                border: 1px solid var(--background-modifier-border);
                overflow: hidden;
                margin-bottom: 20px;
                max-height: 400px;
                overflow-y: auto;
            }

            .drag-sort-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 12px 14px;
                border-bottom: 1px solid rgba(var(--mono-rgb-100), 0.05);
                cursor: grab;
                transition: background 0.15s ease, opacity 0.15s ease, transform 0.15s ease;
                user-select: none;
            }

            .drag-sort-item:last-child {
                border-bottom: none;
            }

            .drag-sort-item:hover {
                background: var(--background-modifier-hover);
            }

            .drag-sort-item.dragging {
                opacity: 0.4;
                background: var(--background-modifier-active-hover);
            }

            .drag-sort-item.drag-over {
                border-top: 2px solid #7c6adb;
                padding-top: 10px;
                background: rgba(124, 106, 219, 0.06);
            }

            .drag-sort-handle {
                color: var(--text-faint);
                font-size: 16px;
                cursor: grab;
                flex-shrink: 0;
                width: 18px;
                text-align: center;
                line-height: 1;
                transition: color 0.15s;
            }

            .drag-sort-item:hover .drag-sort-handle {
                color: var(--text-muted);
            }

            .drag-sort-index {
                color: var(--text-faint);
                font-size: 12px;
                min-width: 20px;
                text-align: center;
                flex-shrink: 0;
                font-variant-numeric: tabular-nums;
            }

            .drag-sort-preview {
                flex: 1;
                overflow: hidden;
                text-overflow: ellipsis;
                white-space: nowrap;
                color: var(--text-normal);
                font-size: 13px;
            }

            .drag-sort-badge {
                display: inline-block;
                background: var(--background-modifier-accent);
                color: #ff9756;
                padding: 2px 6px;
                border-radius: 3px;
                font-weight: 500;
                font-size: 12px;
                flex-shrink: 0;
            }

            .drag-sort-footer {
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
                padding-top: 16px;
                border-top: 1px solid var(--background-modifier-border);
            }

            .drag-sort-btn {
                flex: 1 1 140px;
                padding: 10px 16px;
                border: none;
                border-radius: 6px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
                font-size: 13px;
            }

            .drag-sort-btn-primary {
                background: #7c6adb;
                color: var(--text-on-accent);
            }

            .drag-sort-btn-primary:hover {
                background: #6b59d3;
            }

            .drag-sort-btn-secondary {
                background: var(--background-secondary);
                color: var(--text-muted);
            }

            .drag-sort-btn-secondary:hover {
                background: var(--background-modifier-hover);
                color: var(--text-normal);
            }

            /* 滚动条样式 */
            .drag-sort-list::-webkit-scrollbar {
                width: 6px;
            }

            .drag-sort-list::-webkit-scrollbar-track {
                background: transparent;
            }

            .drag-sort-list::-webkit-scrollbar-thumb {
                background: var(--background-modifier-border);
                border-radius: 3px;
            }

            .drag-sort-list::-webkit-scrollbar-thumb:hover {
                background: var(--background-modifier-border-hover);
            }
        `;

        document.head.appendChild(style);
    }

    onClose(): void {
        const { contentEl } = this;
        contentEl.empty();

        // 清理样式
        document.getElementById("drag-sort-modal-styles")?.remove();
        ModalStyleManager.removeSharedStyles();
    }
}
