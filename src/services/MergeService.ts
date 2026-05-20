import { App, Notice, TFile, WorkspaceLeaf } from "obsidian";
import { CanvasAdapter, ICanvasAdapter } from "../adapters/CanvasAdapter";
import { IVaultAdapter } from "../adapters/VaultAdapter";
import { IContentService, MergeOrder } from "./ContentService";
import { SortPriority } from "../domain/strategies";
import { MergeWorkbenchView, MERGE_PREVIEW_VIEW_TYPE } from "../presentation/views";
import type { MergeWorkbenchContext } from "../presentation/views";
import { PreviewWorkbenchService } from "./PreviewWorkbenchService";
import { PerformanceService } from "./PerformanceService";
import type { MergeCleanupMode } from "../settings/ICanvasLoomSettings";
import type { CardSnapshot, WorkbenchState } from "../types/WorkbenchState";
import type { CanvasNode, CanvasNodeData } from "../types/canvas";

export interface MergeExecutionOptions {
    order?: MergeOrder;
    sortPriority?: SortPriority;
    manualOrderIds?: string[];
    includeBadgePrefix?: boolean;
    cleanupMode?: MergeCleanupMode;
}

export interface OpenWorkbenchOptions {
    order?: MergeOrder;
    sortPriority?: SortPriority;
    previewExpanded?: boolean;
    scopeLabel?: string;
    cleanupMode?: MergeCleanupMode;
}

export interface IMergeService {
    mergeToCanvasCard(selection: CanvasNode[], options?: MergeExecutionOptions): Promise<boolean>;
    mergeToSidebar(selection: CanvasNode[], canvasFile: TFile | null, options?: MergeExecutionOptions): Promise<boolean>;
    mergeToMarkdown(selection: CanvasNode[], canvasFile: TFile | null, options?: MergeExecutionOptions): Promise<boolean>;
    openWorkbench(selection: CanvasNode[], canvasFile: TFile | null, options?: OpenWorkbenchOptions): Promise<boolean>;
    openWorkbenchFromSnapshots(snapshots: CardSnapshot[], canvasFile: TFile | null, options?: OpenWorkbenchOptions): Promise<boolean>;
    mergeSnapshotsToCanvasCard(snapshots: CardSnapshot[], canvasFilePath: string | null, options?: MergeExecutionOptions): Promise<boolean>;
    mergeSnapshotsToMarkdown(snapshots: CardSnapshot[], canvasFilePath: string | null, options?: MergeExecutionOptions): Promise<boolean>;
}

export class MergeService implements IMergeService {
    private readonly workbenchService = new PreviewWorkbenchService();

    constructor(
        private app: App,
        private canvasAdapter: ICanvasAdapter,
        private contentService: IContentService,
        private vaultAdapter: IVaultAdapter,
        private performanceService?: PerformanceService,
        private getMergeCleanupMode?: () => MergeCleanupMode
    ) {}

    async mergeToCanvasCard(selection: CanvasNode[], options?: MergeExecutionOptions): Promise<boolean> {
        const result = await this.measure("merge.buildContent", {
            target: "canvas-card",
            selectionCount: selection.length,
            order: options?.order || 'position'
        }, () => this.contentService.buildMergedContent({
            selection,
            order: options?.order || 'position',
            sortPriority: options?.sortPriority || 'yx',
            manualOrderIds: options?.manualOrderIds,
            includeBadgePrefix: options?.includeBadgePrefix ?? true
        }));

        if (!result.content || result.count === 0) {
            new Notice('没有可合并的文本卡片');
            return false;
        }

        const snapshots = await this.measure("merge.createSelectionSnapshot", {
            target: "canvas-card",
            selectionCount: selection.length
        }, () => this.contentService.createSelectionSnapshot(selection));
        const orderedSnapshots = await this.getOrderedSnapshots(snapshots, options);
        const anchor = this.resolveAnchorCard(orderedSnapshots);
        const nodeData: CanvasNodeData = {
            id: `${Math.random().toString(36).slice(2, 11)}`,
            type: 'text',
            text: result.content,
            x: anchor.x,
            y: anchor.y,
            width: anchor.width,
            height: anchor.height
        };

        const cleanupMode = this.resolveCleanupMode(options?.cleanupMode);

        await this.measure("merge.mutateCanvasCard", {
            sourceCount: selection.length,
            cleanupMode
        }, () => this.canvasAdapter.mutateData((canvasData) => {
            const ids = cleanupMode === 'delete-source'
                ? new Set(selection.map(n => n.id))
                : null;

            canvasData.nodes = ids
                ? canvasData.nodes.filter(node => !ids.has(node.id))
                : canvasData.nodes;
            canvasData.edges = ids
                ? canvasData.edges.filter(edge => !ids.has(edge.fromNode) && !ids.has(edge.toNode))
                : canvasData.edges;
            canvasData.nodes.push(nodeData);
        }));

        await this.canvasAdapter.requestSave();
        new Notice(`已合并 ${result.count} 张卡片并创建新卡片`);
        return true;
    }

    async mergeToSidebar(selection: CanvasNode[], canvasFile: TFile | null, options?: MergeExecutionOptions): Promise<boolean> {
        return this.openWorkbench(selection, canvasFile, {
            order: options?.order || 'position',
            sortPriority: options?.sortPriority || 'yx',
            previewExpanded: true
        });
    }

    async mergeToMarkdown(selection: CanvasNode[], canvasFile: TFile | null, options?: MergeExecutionOptions): Promise<boolean> {
        const result = await this.measure("merge.buildContent", {
            target: "markdown",
            selectionCount: selection.length,
            order: options?.order || 'position'
        }, () => this.contentService.buildMergedContent({
            selection,
            order: options?.order || 'position',
            sortPriority: options?.sortPriority || 'yx',
            manualOrderIds: options?.manualOrderIds,
            includeBadgePrefix: options?.includeBadgePrefix ?? true
        }));

        if (!result.content || result.count === 0) {
            new Notice('没有可合并的文本卡片');
            return false;
        }

        if (!canvasFile || canvasFile.extension !== 'canvas') {
            new Notice('请在打开画布文件时使用该功能');
            return false;
        }

        const baseName = `${canvasFile.basename}-卡片合并`;
        const file = await this.measure("merge.createMarkdownFile", {
            sourceCount: result.count,
            canvasFilePath: canvasFile.path
        }, () => this.vaultAdapter.createMergedDocument(result.content, canvasFile, baseName));
        new Notice(`已创建文稿：${file.path}`);
        return true;
    }

    async openWorkbench(selection: CanvasNode[], canvasFile: TFile | null, options?: OpenWorkbenchOptions): Promise<boolean> {
        const snapshots = await this.measure("workbench.createSelectionSnapshot", {
            selectionCount: selection.length
        }, () => this.contentService.createSelectionSnapshot(selection));
        return this.openWorkbenchFromSnapshots(snapshots, canvasFile, options);
    }

    async openWorkbenchFromSnapshots(snapshots: CardSnapshot[], canvasFile: TFile | null, options?: OpenWorkbenchOptions): Promise<boolean> {
        if (snapshots.length === 0) {
            new Notice('没有可预览的文本卡片');
            return false;
        }

        const view = await this.measure("workbench.activateView", {
            snapshotCount: snapshots.length
        }, () => this.activateMergePreviewView());
        const sortPriority = options?.sortPriority || 'yx';
        const canvasFilePath = canvasFile?.path || null;
        const existingState = view.getWorkbenchState();

        if (canvasFilePath && existingState.canvasFilePath === canvasFilePath && existingState.selectionSnapshot.length > 0) {
            const appendResult = this.workbenchService.appendSnapshots(existingState, snapshots, sortPriority);
            view.setWorkbenchContext(this.createWorkbenchContext(appendResult.state, sortPriority, options));

            if (appendResult.addedCount > 0) {
                new Notice(`已向 Loom工作台添加 ${appendResult.addedCount} 张卡片（共 ${appendResult.state.selectionSnapshot.length} 张）`);
            } else {
                new Notice(`选中卡片已在 Loom工作台中，已刷新 ${appendResult.updatedCount} 张卡片快照`);
            }

            return true;
        }

        const state = this.workbenchService.createState({
            canvasFilePath,
            canvasFileBasename: canvasFile?.basename || '当前画布',
            scopeLabel: options?.scopeLabel || '当前选区',
            selectionSnapshot: snapshots,
            defaultSortMode: options?.order || 'position',
            sortPriority,
            previewExpanded: options?.previewExpanded ?? false
        });

        view.setWorkbenchContext(this.createWorkbenchContext(state, sortPriority, options));

        new Notice(`已在 Loom工作台载入卡片组（${state.scopeLabel}，${snapshots.length} 张卡片）`);
        return true;
    }

    private createWorkbenchContext(
        state: WorkbenchState,
        sortPriority: SortPriority,
        options?: OpenWorkbenchOptions
    ): MergeWorkbenchContext {
        return {
            state,
            sortPriority,
            onCopy: async (currentState: WorkbenchState) => {
                const order = currentState.isManualAdjusted ? 'manual' : currentState.sortMode;
                await this.contentService.copyMergedContent({
                    snapshots: currentState.selectionSnapshot,
                    order,
                    sortPriority,
                    manualOrderIds: currentState.manualOrderIds,
                    includeBadgePrefix: currentState.sortMode === 'badge'
                }, '已复制工作台当前顺序的内容');
            },
            onCreateCard: async (currentState: WorkbenchState) => {
                const order = currentState.isManualAdjusted ? 'manual' : currentState.sortMode;
                await this.mergeSnapshotsToCanvasCard(currentState.selectionSnapshot, currentState.canvasFilePath, {
                    order,
                    sortPriority,
                    manualOrderIds: currentState.manualOrderIds,
                    cleanupMode: this.resolveCleanupMode(options?.cleanupMode, true),
                    includeBadgePrefix: currentState.sortMode === 'badge'
                });
            },
            onCreateMarkdown: async (currentState: WorkbenchState) => {
                const order = currentState.isManualAdjusted ? 'manual' : currentState.sortMode;
                await this.mergeSnapshotsToMarkdown(currentState.selectionSnapshot, currentState.canvasFilePath, {
                    order,
                    sortPriority,
                    manualOrderIds: currentState.manualOrderIds,
                    includeBadgePrefix: currentState.sortMode === 'badge'
                });
            }
        };
    }

    async mergeSnapshotsToCanvasCard(snapshots: CardSnapshot[], canvasFilePath: string | null, options?: MergeExecutionOptions): Promise<boolean> {
        const result = await this.measure("merge.buildContent", {
            target: "canvas-card",
            snapshotCount: snapshots.length,
            order: options?.order || 'position'
        }, () => this.contentService.buildMergedContent({
            snapshots,
            order: options?.order || 'position',
            sortPriority: options?.sortPriority || 'yx',
            manualOrderIds: options?.manualOrderIds,
            includeBadgePrefix: options?.includeBadgePrefix ?? true
        }));

        if (!result.content || result.count === 0) {
            new Notice('没有可合并的文本卡片');
            return false;
        }

        const orderedSnapshots = await this.getOrderedSnapshots(snapshots, options);
        const anchor = this.resolveAnchorCard(orderedSnapshots);
        const nodeData: CanvasNodeData = {
            id: `${Math.random().toString(36).slice(2, 11)}`,
            type: 'text',
            text: result.content,
            x: anchor.x,
            y: anchor.y,
            width: anchor.width,
            height: anchor.height
        };

        const adapter = canvasFilePath
            ? await this.resolveCanvasAdapterByPath(canvasFilePath)
            : this.canvasAdapter;

        if (!adapter) {
            new Notice('无法定位原始画布，未能创建新卡片');
            return false;
        }

        const cleanupMode = this.resolveCleanupMode(options?.cleanupMode);

        await this.measure("merge.mutateCanvasCard", {
            sourceCount: snapshots.length,
            cleanupMode,
            canvasFilePath: canvasFilePath || 'active'
        }, () => adapter.mutateData((canvasData) => {
            const ids = cleanupMode === 'delete-source'
                ? new Set(snapshots.map(s => s.id))
                : null;

            canvasData.nodes = ids
                ? canvasData.nodes.filter(node => !ids.has(node.id))
                : canvasData.nodes;
            canvasData.edges = ids
                ? canvasData.edges.filter(edge => !ids.has(edge.fromNode) && !ids.has(edge.toNode))
                : canvasData.edges;
            canvasData.nodes.push(nodeData);
        }));

        await adapter.requestSave();
        new Notice(`已合并 ${result.count} 张卡片并创建新卡片`);
        return true;
    }

    async mergeSnapshotsToMarkdown(snapshots: CardSnapshot[], canvasFilePath: string | null, options?: MergeExecutionOptions): Promise<boolean> {
        const result = await this.measure("merge.buildContent", {
            target: "markdown",
            snapshotCount: snapshots.length,
            order: options?.order || 'position'
        }, () => this.contentService.buildMergedContent({
            snapshots,
            order: options?.order || 'position',
            sortPriority: options?.sortPriority || 'yx',
            manualOrderIds: options?.manualOrderIds,
            includeBadgePrefix: options?.includeBadgePrefix ?? true
        }));

        if (!result.content || result.count === 0) {
            new Notice('没有可合并的文本卡片');
            return false;
        }

        const canvasFile = this.resolveCanvasFile(canvasFilePath);
        if (!canvasFile) {
            new Notice('找不到原始画布文件，无法创建文稿');
            return false;
        }

        const baseName = `${canvasFile.basename}-卡片合并`;
        const file = await this.measure("merge.createMarkdownFile", {
            sourceCount: result.count,
            canvasFilePath: canvasFile.path
        }, () => this.vaultAdapter.createMergedDocument(result.content, canvasFile, baseName));
        new Notice(`已创建文稿：${file.path}`);
        return true;
    }

    private async getOrderedSnapshots(snapshots: CardSnapshot[], options?: MergeExecutionOptions): Promise<CardSnapshot[]> {
        return this.contentService.getOrderedCards({
            snapshots,
            order: options?.order || 'position',
            sortPriority: options?.sortPriority || 'yx',
            manualOrderIds: options?.manualOrderIds,
            includeBadgePrefix: options?.includeBadgePrefix
        });
    }

    private resolveAnchorCard(snapshots: CardSnapshot[]): { x: number; y: number; width: number; height: number } {
        const fallback = { x: 0, y: 0, width: 400, height: 400 };
        if (!Array.isArray(snapshots) || snapshots.length === 0) {
            return fallback;
        }

        const first = snapshots[0];
        return {
            x: first.x,
            y: first.y,
            width: first.width || fallback.width,
            height: first.height || fallback.height
        };
    }

    private resolveCleanupMode(fallback?: MergeCleanupMode, preferProvider = false): MergeCleanupMode {
        if (!preferProvider && fallback) {
            return fallback;
        }

        try {
            return this.getMergeCleanupMode?.() || fallback || 'keep-source';
        } catch (error) {
            console.error("读取拼合后处理方式失败:", error);
            return fallback || 'keep-source';
        }
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
            return new CanvasAdapter(existingLeaf.view.canvas, this.performanceService);
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
        const adapter = await this.waitForCanvasAdapter(canvasFilePath, leaf);
        if (!adapter) {
            return null;
        }

        return adapter;
    }

    private findCanvasLeafByPath(canvasFilePath: string): WorkspaceLeaf | null {
        const leaves = this.app.workspace.getLeavesOfType("canvas");
        const matchedLeaf = leaves.find((leaf: WorkspaceLeaf) => {
            const view = leaf.view;
            return view?.file?.path === canvasFilePath;
        });

        return matchedLeaf || null;
    }

    private async waitForCanvasAdapter(canvasFilePath: string, fallbackLeaf: WorkspaceLeaf): Promise<ICanvasAdapter | null> {
        for (let attempt = 0; attempt < 10; attempt += 1) {
            const canvasLeaf = this.findCanvasLeafByPath(canvasFilePath) || fallbackLeaf;
            const view = canvasLeaf.view;

            if (view?.canvas) {
                return new CanvasAdapter(view.canvas, this.performanceService);
            }

            await new Promise(resolve => window.setTimeout(resolve, 50));
        }

        return null;
    }

    private async activateMergePreviewView(): Promise<MergeWorkbenchView> {
        const leaves = this.findMergePreviewLeaves();
        const existingLeaf = leaves.find((leaf) => leaf.view instanceof MergeWorkbenchView) || leaves[0] || null;
        const leaf: WorkspaceLeaf | null = existingLeaf || this.app.workspace.getRightLeaf(false);

        if (!leaf) {
            throw new Error('无法创建侧边栏视图');
        }

        leaves
            .filter((candidate) => candidate !== leaf)
            .forEach((candidate) => candidate.detach());

        await leaf.setViewState({ type: MERGE_PREVIEW_VIEW_TYPE, active: true });
        if (!(leaf.view instanceof MergeWorkbenchView)) {
            throw new Error("Loom工作台视图未成功初始化");
        }

        return leaf.view;
    }

    private findMergePreviewLeaves(): WorkspaceLeaf[] {
        const leaves: WorkspaceLeaf[] = [];

        this.app.workspace.iterateAllLeaves((leaf: WorkspaceLeaf) => {
            const stateType = leaf.getViewState().type;
            const viewType = leaf.view?.getViewType?.();

            if (stateType === MERGE_PREVIEW_VIEW_TYPE || viewType === MERGE_PREVIEW_VIEW_TYPE) {
                leaves.push(leaf);
            }
        });

        return leaves;
    }

    private async measure<T>(
        operation: string,
        details: Record<string, unknown>,
        action: () => Promise<T>
    ): Promise<T> {
        if (!this.performanceService) {
            return action();
        }

        return this.performanceService.measure(operation, action, details);
    }
}
