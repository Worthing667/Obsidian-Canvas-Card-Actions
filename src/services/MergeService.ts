import { Notice, TFile, WorkspaceLeaf } from "obsidian";
import { CanvasAdapter, ICanvasAdapter } from "../adapters/CanvasAdapter";
import { IVaultAdapter } from "../adapters/VaultAdapter";
import { IContentService, MergeOrder } from "./ContentService";
import { SortPriority } from "../domain/strategies";
import { MergeWorkbenchView, MERGE_PREVIEW_VIEW_TYPE } from "../presentation/views";
import { PreviewWorkbenchService } from "./PreviewWorkbenchService";
import type { CardSnapshot, WorkbenchState } from "../types/WorkbenchState";

export interface MergeExecutionOptions {
    order?: MergeOrder;
    sortPriority?: SortPriority;
    manualOrderIds?: string[];
}

export interface IMergeService {
    mergeToCanvasCard(selection: any[], options?: MergeExecutionOptions): Promise<boolean>;
    mergeToSidebar(selection: any[], canvasFile: TFile | null, options?: MergeExecutionOptions): Promise<boolean>;
    mergeToMarkdown(selection: any[], canvasFile: TFile | null, options?: MergeExecutionOptions): Promise<boolean>;
    openWorkbench(selection: any[], canvasFile: TFile | null, options?: { order?: MergeOrder; sortPriority?: SortPriority; previewExpanded?: boolean }): Promise<boolean>;
    mergeSnapshotsToCanvasCard(snapshots: CardSnapshot[], canvasFilePath: string | null, options?: MergeExecutionOptions): Promise<boolean>;
    mergeSnapshotsToMarkdown(snapshots: CardSnapshot[], canvasFilePath: string | null, options?: MergeExecutionOptions): Promise<boolean>;
}

export class MergeService implements IMergeService {
    private readonly workbenchService = new PreviewWorkbenchService();

    constructor(
        private app: any,
        private canvasAdapter: ICanvasAdapter,
        private contentService: IContentService,
        private vaultAdapter: IVaultAdapter
    ) {}

    async mergeToCanvasCard(selection: any[], options?: MergeExecutionOptions): Promise<boolean> {
        const result = await this.contentService.buildMergedContent({
            selection,
            order: options?.order || 'position',
            sortPriority: options?.sortPriority || 'yx',
            manualOrderIds: options?.manualOrderIds,
            includeBadgePrefix: true
        });

        if (!result.content || result.count === 0) {
            new Notice('没有可合并的文本卡片');
            return false;
        }

        const snapshots = await this.contentService.createSelectionSnapshot(selection);
        const anchor = this.resolveAnchorCard(snapshots);
        const nodeData = {
            id: `${Math.random().toString(36).slice(2, 11)}`,
            type: 'text',
            text: result.content,
            x: anchor.x + anchor.width + 40,
            y: anchor.y,
            width: anchor.width,
            height: anchor.height
        };

        await this.canvasAdapter.addNode(nodeData);
        await this.canvasAdapter.requestSave();
        new Notice(`已合并 ${result.count} 张卡片并创建新卡片`);
        return true;
    }

    async mergeToSidebar(selection: any[], canvasFile: TFile | null, options?: MergeExecutionOptions): Promise<boolean> {
        return this.openWorkbench(selection, canvasFile, {
            order: options?.order || 'position',
            sortPriority: options?.sortPriority || 'yx',
            previewExpanded: true
        });
    }

    async mergeToMarkdown(selection: any[], canvasFile: TFile | null, options?: MergeExecutionOptions): Promise<boolean> {
        const result = await this.contentService.buildMergedContent({
            selection,
            order: options?.order || 'position',
            sortPriority: options?.sortPriority || 'yx',
            manualOrderIds: options?.manualOrderIds,
            includeBadgePrefix: true
        });

        if (!result.content || result.count === 0) {
            new Notice('没有可合并的文本卡片');
            return false;
        }

        if (!canvasFile || canvasFile.extension !== 'canvas') {
            new Notice('请在打开 Canvas 文件时使用该功能');
            return false;
        }

        const baseName = `${canvasFile.basename}-卡片合并`;
        const file = await this.vaultAdapter.createMergedDocument(result.content, canvasFile, baseName);
        new Notice(`已创建文稿：${file.path}`);
        return true;
    }

    async openWorkbench(selection: any[], canvasFile: TFile | null, options?: { order?: MergeOrder; sortPriority?: SortPriority; previewExpanded?: boolean }): Promise<boolean> {
        const snapshots = await this.contentService.createSelectionSnapshot(selection);
        if (snapshots.length === 0) {
            new Notice('没有可预览的文本卡片');
            return false;
        }

        const view = await this.activateMergePreviewView();
        const sortPriority = options?.sortPriority || 'yx';
        const state = this.workbenchService.createState({
            canvasFilePath: canvasFile?.path || null,
            canvasFileBasename: canvasFile?.basename || '当前 Canvas',
            selectionSnapshot: snapshots,
            defaultSortMode: options?.order || 'position',
            previewExpanded: options?.previewExpanded ?? false
        });

        view.setWorkbenchContext({
            state,
            sortPriority,
            onCopy: async (currentState: WorkbenchState) => {
                await this.contentService.copyMergedContent({
                    snapshots: currentState.selectionSnapshot,
                    order: currentState.sortMode,
                    sortPriority,
                    manualOrderIds: currentState.manualOrderIds,
                    includeBadgePrefix: currentState.sortMode === 'badge'
                }, '已复制工作台当前顺序的内容');
            },
            onCreateCard: async (currentState: WorkbenchState) => {
                await this.mergeSnapshotsToCanvasCard(currentState.selectionSnapshot, currentState.canvasFilePath, {
                    order: currentState.sortMode,
                    sortPriority,
                    manualOrderIds: currentState.manualOrderIds
                });
            },
            onCreateMarkdown: async (currentState: WorkbenchState) => {
                await this.mergeSnapshotsToMarkdown(currentState.selectionSnapshot, currentState.canvasFilePath, {
                    order: currentState.sortMode,
                    sortPriority,
                    manualOrderIds: currentState.manualOrderIds
                });
            }
        });

        new Notice(`已打开预览工作台（${snapshots.length} 张卡片）`);
        return true;
    }

    async mergeSnapshotsToCanvasCard(snapshots: CardSnapshot[], canvasFilePath: string | null, options?: MergeExecutionOptions): Promise<boolean> {
        const result = await this.contentService.buildMergedContent({
            snapshots,
            order: options?.order || 'position',
            sortPriority: options?.sortPriority || 'yx',
            manualOrderIds: options?.manualOrderIds,
            includeBadgePrefix: true
        });

        if (!result.content || result.count === 0) {
            new Notice('没有可合并的文本卡片');
            return false;
        }

        const anchor = this.resolveAnchorCard(snapshots);
        const nodeData = {
            id: `${Math.random().toString(36).slice(2, 11)}`,
            type: 'text',
            text: result.content,
            x: anchor.x + anchor.width + 40,
            y: anchor.y,
            width: anchor.width,
            height: anchor.height
        };

        const adapter = canvasFilePath
            ? await this.resolveCanvasAdapterByPath(canvasFilePath)
            : this.canvasAdapter;

        if (!adapter) {
            new Notice('无法定位原始 Canvas，未能创建新卡片');
            return false;
        }

        await adapter.addNode(nodeData);
        await adapter.requestSave();
        new Notice(`已合并 ${result.count} 张卡片并创建新卡片`);
        return true;
    }

    async mergeSnapshotsToMarkdown(snapshots: CardSnapshot[], canvasFilePath: string | null, options?: MergeExecutionOptions): Promise<boolean> {
        const result = await this.contentService.buildMergedContent({
            snapshots,
            order: options?.order || 'position',
            sortPriority: options?.sortPriority || 'yx',
            manualOrderIds: options?.manualOrderIds,
            includeBadgePrefix: true
        });

        if (!result.content || result.count === 0) {
            new Notice('没有可合并的文本卡片');
            return false;
        }

        const canvasFile = this.resolveCanvasFile(canvasFilePath);
        if (!canvasFile) {
            new Notice('找不到原始 Canvas 文件，无法创建文稿');
            return false;
        }

        const baseName = `${canvasFile.basename}-卡片合并`;
        const file = await this.vaultAdapter.createMergedDocument(result.content, canvasFile, baseName);
        new Notice(`已创建文稿：${file.path}`);
        return true;
    }

    private resolveAnchorCard(snapshots: CardSnapshot[]): { x: number; y: number; width: number; height: number } {
        const fallback = { x: 0, y: 0, width: 400, height: 400 };
        if (!Array.isArray(snapshots) || snapshots.length === 0) {
            return fallback;
        }

        const sortedSnapshots = [...snapshots].sort((a, b) => {
            if (Math.abs(a.y - b.y) > 10) {
                return a.y - b.y;
            }
            return a.x - b.x;
        });

        const first = sortedSnapshots[0];
        return {
            x: first.x,
            y: first.y,
            width: first.width || fallback.width,
            height: first.height || fallback.height
        };
    }

    private resolveCanvasFile(canvasFilePath: string | null): TFile | null {
        if (!canvasFilePath) {
            return null;
        }

        const abstractFile = this.app.vault.getAbstractFileByPath(canvasFilePath);
        if (!abstractFile || !(abstractFile instanceof TFile) || abstractFile.extension !== 'canvas') {
            return null;
        }

        return abstractFile;
    }

    private async resolveCanvasAdapterByPath(canvasFilePath: string): Promise<ICanvasAdapter | null> {
        const existingLeaf = this.findCanvasLeafByPath(canvasFilePath);
        if (existingLeaf?.view?.canvas) {
            return new CanvasAdapter(existingLeaf.view.canvas);
        }

        const canvasFile = this.resolveCanvasFile(canvasFilePath);
        if (!canvasFile) {
            return null;
        }

        const leaf = this.app.workspace.getLeaf(false);
        if (!leaf) {
            return null;
        }

        await leaf.openFile(canvasFile, { active: false });
        const canvasLeaf = this.findCanvasLeafByPath(canvasFilePath) || leaf;
        const view = canvasLeaf.view as any;

        if (!view?.canvas) {
            return null;
        }

        return new CanvasAdapter(view.canvas);
    }

    private findCanvasLeafByPath(canvasFilePath: string): WorkspaceLeaf | null {
        const leaves = this.app.workspace.getLeavesOfType("canvas");
        const matchedLeaf = leaves.find((leaf: WorkspaceLeaf) => {
            const view = leaf.view as any;
            return view?.file?.path === canvasFilePath;
        });

        return matchedLeaf || null;
    }

    private async activateMergePreviewView(): Promise<MergeWorkbenchView> {
        const leaves = this.app.workspace.getLeavesOfType(MERGE_PREVIEW_VIEW_TYPE);
        const existingLeaf = leaves.length > 0 ? leaves[0] : null;
        const fallbackLeaf = this.app.workspace.getRightLeaf(false);
        const leaf: WorkspaceLeaf | null = existingLeaf || fallbackLeaf;

        if (!leaf) {
            throw new Error('无法创建侧边栏视图');
        }

        await leaf.setViewState({ type: MERGE_PREVIEW_VIEW_TYPE, active: true });
        this.app.workspace.revealLeaf(leaf);
        return leaf.view as MergeWorkbenchView;
    }
}
