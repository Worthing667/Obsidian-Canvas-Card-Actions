import { App, Notice, TFile, WorkspaceLeaf } from "obsidian";
import { CanvasAdapter, ICanvasAdapter } from "../adapters/CanvasAdapter";
import { IVaultAdapter } from "../adapters/VaultAdapter";
import { IContentService, MergeOrder, MergedContentResult } from "./ContentService";
import { SortPriority } from "../domain/strategies";
import { MergeWorkbenchView, MERGE_PREVIEW_VIEW_TYPE } from "../presentation/views";
import type { FindReplaceWorkbenchContext, MergeWorkbenchContext, WorkbenchPanel } from "../presentation/views";
import { PreviewWorkbenchService } from "./PreviewWorkbenchService";
import { PerformanceService } from "./PerformanceService";
import { SearchReplaceScope, SearchReplaceService } from "./SearchReplaceService";
import { t } from "../i18n";
import type { MergeCleanupMode } from "../settings/ICanvasLoomSettings";
import type { CardSnapshot, WorkbenchState } from "../types/WorkbenchState";
import type { CanvasNode, CanvasNodeData } from "../types/canvas";

export interface MergeExecutionOptions {
    order?: MergeOrder;
    sortPriority?: SortPriority;
    manualOrderIds?: string[];
    includeBadgePrefix?: boolean;
    cleanupMode?: MergeCleanupMode;
    cardSeparator?: string | null;
}

export interface OpenWorkbenchOptions {
    order?: MergeOrder;
    sortPriority?: SortPriority;
    panel?: WorkbenchPanel;
    previewExpanded?: boolean;
    scopeLabel?: string;
    cleanupMode?: MergeCleanupMode;
    cardSeparator?: string | null;
}

export interface IMergeService {
    mergeToCanvasCard(selection: CanvasNode[], options?: MergeExecutionOptions): Promise<boolean>;
    mergeToSidebar(selection: CanvasNode[], canvasFile: TFile | null, options?: MergeExecutionOptions): Promise<boolean>;
    mergeToMarkdown(selection: CanvasNode[], canvasFile: TFile | null, options?: MergeExecutionOptions): Promise<boolean>;
    openWorkbench(selection: CanvasNode[], canvasFile: TFile | null, options?: OpenWorkbenchOptions): Promise<boolean>;
    openFindReplaceWorkbench(selection: CanvasNode[], canvasFile: TFile | null, options?: OpenWorkbenchOptions): Promise<boolean>;
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
        private searchReplaceService?: SearchReplaceService,
        private performanceService?: PerformanceService,
        private getMergeCleanupMode?: () => MergeCleanupMode,
        private getMergeCardSeparator?: () => string | null
    ) {}

    async mergeToCanvasCard(selection: CanvasNode[], options?: MergeExecutionOptions): Promise<boolean> {
        const result = await this.buildMergeContent("canvas-card", { selection }, options);
        if (!result) {
            return false;
        }

        const snapshots = await this.measure("merge.createSelectionSnapshot", {
            target: "canvas-card",
            selectionCount: selection.length
        }, () => this.contentService.createSelectionSnapshot(selection));
        const orderedSnapshots = await this.getOrderedSnapshots(snapshots, options);
        const nodeData = this.createMergedNodeData(result.content, orderedSnapshots);
        const cleanupMode = this.resolveCleanupMode(options?.cleanupMode);

        await this.insertMergedNode(
            this.canvasAdapter,
            nodeData,
            selection.map(n => n.id),
            selection.length,
            cleanupMode
        );
        await this.canvasAdapter.requestSave();
        new Notice(t("notice.mergedToCanvasCard", { count: result.count }));
        return true;
    }

    async mergeToSidebar(selection: CanvasNode[], canvasFile: TFile | null, options?: MergeExecutionOptions): Promise<boolean> {
        return this.openWorkbench(selection, canvasFile, {
            order: options?.order || 'position',
            sortPriority: options?.sortPriority || 'yx',
            panel: 'preview',
            previewExpanded: true,
            cleanupMode: options?.cleanupMode,
            cardSeparator: options?.cardSeparator
        });
    }

    async mergeToMarkdown(selection: CanvasNode[], canvasFile: TFile | null, options?: MergeExecutionOptions): Promise<boolean> {
        const result = await this.buildMergeContent("markdown", { selection }, options);
        if (!result) {
            return false;
        }

        if (!canvasFile || canvasFile.extension !== 'canvas') {
            new Notice(t("notice.useWithOpenCanvasFile"));
            return false;
        }

        const baseName = `${canvasFile.basename}-${t("workbench.fileName.mergedCards")}`;
        const file = await this.measure("merge.createMarkdownFile", {
            sourceCount: result.count,
            canvasFilePath: canvasFile.path
        }, () => this.vaultAdapter.createMergedDocument(result.content, canvasFile, baseName));
        new Notice(t("notice.mergedDocumentCreated", { filePath: file.path }));
        return true;
    }

    async openWorkbench(selection: CanvasNode[], canvasFile: TFile | null, options?: OpenWorkbenchOptions): Promise<boolean> {
        const snapshots = await this.measure("workbench.createSelectionSnapshot", {
            selectionCount: selection.length
        }, () => this.contentService.createSelectionSnapshot(selection));
        return this.openWorkbenchFromSnapshots(snapshots, canvasFile, options);
    }

    async openFindReplaceWorkbench(selection: CanvasNode[], canvasFile: TFile | null, options?: OpenWorkbenchOptions): Promise<boolean> {
        if (!this.searchReplaceService) {
            new Notice(t("notice.searchReplaceUnavailable"));
            return false;
        }

        if (!this.searchReplaceService.hasTextCards()) {
            new Notice(t("notice.noSearchableTextCards"));
            return false;
        }

        const selectedNodeIds = this.getSelectedTextNodeIds(selection);
        const selectedSnapshots = selectedNodeIds.size > 0
            ? this.searchReplaceService.getTextCardSnapshots(selectedNodeIds)
            : [];
        const selectedTextCardCount = selectedSnapshots.length;
        const defaultScope = selectedTextCardCount > 0 ? 'selection' : 'canvas';
        const selectedScopeLabel = t("workbench.scope.selection");
        const view = await this.measure("workbench.activateFindReplaceView", {
            selectedTextCardCount,
            scope: defaultScope
        }, () => this.activateMergePreviewView());
        const sortPriority = options?.sortPriority || 'yx';
        const canvasFilePath = canvasFile?.path || null;
        const existingState = view.getWorkbenchState();
        const shouldPreserveExistingState = selectedSnapshots.length === 0
            && canvasFilePath
            && existingState.canvasFilePath === canvasFilePath
            && existingState.selectionSnapshot.length > 0;
        const state = shouldPreserveExistingState
            ? existingState
            : this.workbenchService.createState({
                canvasFilePath,
                canvasFileBasename: canvasFile?.basename || t("workbench.scope.canvas"),
                scopeLabel: selectedSnapshots.length > 0 ? selectedScopeLabel : t("workbench.scope.canvas"),
                selectionSnapshot: selectedSnapshots,
                defaultSortMode: options?.order || 'position',
                sortPriority,
                previewExpanded: options?.previewExpanded ?? false,
                cardSeparator: options?.cardSeparator
            });
        const findReplace: FindReplaceWorkbenchContext = {
            service: this.searchReplaceService,
            selectedNodeIds,
            selectedTextCardCount,
            selectedScopeLabel,
            defaultScope
        };

        view.setWorkbenchContext(
            this.createWorkbenchContext(state, sortPriority, options, findReplace),
            { panel: 'findReplace', focusFindInput: true }
        );

        return true;
    }

    async openWorkbenchFromSnapshots(snapshots: CardSnapshot[], canvasFile: TFile | null, options?: OpenWorkbenchOptions): Promise<boolean> {
        if (snapshots.length === 0) {
            new Notice(t("notice.noPreviewTextCards"));
            return false;
        }

        const view = await this.measure("workbench.activateView", {
            snapshotCount: snapshots.length
        }, () => this.activateMergePreviewView());
        const sortPriority = options?.sortPriority || 'yx';
        const canvasFilePath = canvasFile?.path || null;
        const existingState = view.getWorkbenchState();

        const findReplace = this.buildFindReplaceContextFromSnapshots(snapshots);

        if (canvasFilePath && existingState.canvasFilePath === canvasFilePath && existingState.selectionSnapshot.length > 0) {
            const appendResult = this.workbenchService.appendSnapshots(existingState, snapshots, sortPriority);
            view.setWorkbenchContext(
                this.createWorkbenchContext(appendResult.state, sortPriority, options, findReplace),
                { panel: options?.panel || 'sort' }
            );

            if (appendResult.addedCount > 0) {
                new Notice(t("notice.workbenchCardsAdded", {
                    addedCount: appendResult.addedCount,
                    totalCount: appendResult.state.selectionSnapshot.length
                }));
            } else {
                new Notice(t("notice.workbenchCardsRefreshed", {
                    updatedCount: appendResult.updatedCount
                }));
            }

            return true;
        }

        const state = this.workbenchService.createState({
            canvasFilePath,
            canvasFileBasename: canvasFile?.basename || t("workbench.scope.canvas"),
            scopeLabel: options?.scopeLabel || t("workbench.scope.selection"),
            selectionSnapshot: snapshots,
            defaultSortMode: options?.order || 'position',
            sortPriority,
            previewExpanded: options?.previewExpanded ?? false,
            cardSeparator: options?.cardSeparator
        });

        view.setWorkbenchContext(
            this.createWorkbenchContext(state, sortPriority, options, findReplace),
            { panel: options?.panel || 'sort' }
        );

        new Notice(t("notice.workbenchLoaded", {
            scopeLabel: state.scopeLabel,
            count: snapshots.length
        }));
        return true;
    }

    private createWorkbenchContext(
        state: WorkbenchState,
        sortPriority: SortPriority,
        options?: OpenWorkbenchOptions,
        findReplace?: FindReplaceWorkbenchContext
    ): MergeWorkbenchContext {
        const contextState = {
            ...state,
            cardSeparator: options?.cardSeparator ?? state.cardSeparator ?? null
        };

        return {
            state: contextState,
            sortPriority,
            findReplace,
            onCopy: async (currentState: WorkbenchState) => {
                const order = currentState.isManualAdjusted ? 'manual' : currentState.sortMode;
                await this.contentService.copyMergedContent({
                    snapshots: currentState.selectionSnapshot,
                    order,
                    sortPriority,
                    manualOrderIds: currentState.manualOrderIds,
                    includeBadgePrefix: currentState.sortMode === 'badge',
                    cardSeparator: this.resolveCardSeparator(currentState.cardSeparator)
                }, t("notice.workbenchCurrentOrderCopied"));
            },
            onCreateCard: async (currentState: WorkbenchState) => {
                const order = currentState.isManualAdjusted ? 'manual' : currentState.sortMode;
                await this.mergeSnapshotsToCanvasCard(currentState.selectionSnapshot, currentState.canvasFilePath, {
                    order,
                    sortPriority,
                    manualOrderIds: currentState.manualOrderIds,
                    cleanupMode: this.resolveCleanupMode(options?.cleanupMode, true),
                    includeBadgePrefix: currentState.sortMode === 'badge',
                    cardSeparator: this.resolveCardSeparator(currentState.cardSeparator)
                });
            },
            onCreateMarkdown: async (currentState: WorkbenchState) => {
                const order = currentState.isManualAdjusted ? 'manual' : currentState.sortMode;
                await this.mergeSnapshotsToMarkdown(currentState.selectionSnapshot, currentState.canvasFilePath, {
                    order,
                    sortPriority,
                    manualOrderIds: currentState.manualOrderIds,
                    includeBadgePrefix: currentState.sortMode === 'badge',
                    cardSeparator: this.resolveCardSeparator(currentState.cardSeparator)
                });
            }
        };
    }

    private buildFindReplaceContextFromSnapshots(snapshots: CardSnapshot[]): FindReplaceWorkbenchContext | undefined {
        if (!this.searchReplaceService) {
            return undefined;
        }

        const selectedNodeIds = new Set(snapshots.map((s) => s.id));
        const selectedTextCardCount = snapshots.length;
        const defaultScope: SearchReplaceScope = selectedTextCardCount > 0 ? 'selection' : 'canvas';

        return {
            service: this.searchReplaceService,
            selectedNodeIds,
            selectedTextCardCount,
            selectedScopeLabel: t("workbench.scope.selection"),
            defaultScope
        };
    }

    private getSelectedTextNodeIds(selection: CanvasNode[]): Set<string> {
        const ids = new Set<string>();

        selection.forEach((node) => {
            try {
                const nodeData = node.getData?.();
                if (nodeData?.type === 'text' && typeof nodeData.text === 'string') {
                    ids.add(nodeData.id);
                }
            } catch (error) {
                console.warn("Failed to read selected card data:", error);
            }
        });

        return ids;
    }

    async mergeSnapshotsToCanvasCard(snapshots: CardSnapshot[], canvasFilePath: string | null, options?: MergeExecutionOptions): Promise<boolean> {
        const result = await this.buildMergeContent("canvas-card", { snapshots }, options);
        if (!result) {
            return false;
        }

        const orderedSnapshots = await this.getOrderedSnapshots(snapshots, options);
        const nodeData = this.createMergedNodeData(result.content, orderedSnapshots);
        const adapter = canvasFilePath
            ? await this.resolveCanvasAdapterByPath(canvasFilePath)
            : this.canvasAdapter;

        if (!adapter) {
            new Notice(t("notice.cannotLocateOriginalCanvas"));
            return false;
        }

        const cleanupMode = this.resolveCleanupMode(options?.cleanupMode);

        await this.insertMergedNode(
            adapter,
            nodeData,
            snapshots.map(s => s.id),
            snapshots.length,
            cleanupMode,
            { canvasFilePath: canvasFilePath || 'active' }
        );
        await adapter.requestSave();
        new Notice(t("notice.mergedToCanvasCard", { count: result.count }));
        return true;
    }

    async mergeSnapshotsToMarkdown(snapshots: CardSnapshot[], canvasFilePath: string | null, options?: MergeExecutionOptions): Promise<boolean> {
        const result = await this.buildMergeContent("markdown", { snapshots }, options);
        if (!result) {
            return false;
        }

        const canvasFile = this.resolveCanvasFile(canvasFilePath);
        if (!canvasFile) {
            new Notice(t("notice.originalCanvasFileNotFound"));
            return false;
        }

        const baseName = `${canvasFile.basename}-${t("workbench.fileName.mergedCards")}`;
        const file = await this.measure("merge.createMarkdownFile", {
            sourceCount: result.count,
            canvasFilePath: canvasFile.path
        }, () => this.vaultAdapter.createMergedDocument(result.content, canvasFile, baseName));
        new Notice(t("notice.mergedDocumentCreated", { filePath: file.path }));
        return true;
    }

    private async buildMergeContent(
        target: "canvas-card" | "markdown",
        source: { selection: CanvasNode[] } | { snapshots: CardSnapshot[] },
        options?: MergeExecutionOptions
    ): Promise<MergedContentResult | null> {
        const sourceDetails = "selection" in source
            ? { selectionCount: source.selection.length }
            : { snapshotCount: source.snapshots.length };
        const result = await this.measure("merge.buildContent", {
            target,
            ...sourceDetails,
            order: options?.order || 'position'
        }, () => this.contentService.buildMergedContent({
            ...source,
            order: options?.order || 'position',
            sortPriority: options?.sortPriority || 'yx',
            manualOrderIds: options?.manualOrderIds,
            includeBadgePrefix: options?.includeBadgePrefix,
            cardSeparator: options?.cardSeparator
        }));

        if (!result.content || result.count === 0) {
            new Notice(t("notice.noMergeableTextCards"));
            return null;
        }

        return result;
    }

    private createMergedNodeData(content: string, snapshots: CardSnapshot[]): CanvasNodeData {
        const anchor = this.resolveAnchorCard(snapshots);

        return {
            id: `${Math.random().toString(36).slice(2, 11)}`,
            type: 'text',
            text: content,
            x: anchor.x,
            y: anchor.y,
            width: anchor.width,
            height: anchor.height
        };
    }

    private async insertMergedNode(
        adapter: ICanvasAdapter,
        nodeData: CanvasNodeData,
        sourceIds: string[],
        sourceCount: number,
        cleanupMode: MergeCleanupMode,
        details: Record<string, unknown> = {}
    ): Promise<void> {
        await this.measure("merge.mutateCanvasCard", {
            sourceCount,
            cleanupMode,
            ...details
        }, () => adapter.mutateData((canvasData) => {
            const ids = cleanupMode === 'delete-source'
                ? new Set(sourceIds)
                : null;

            canvasData.nodes = ids
                ? canvasData.nodes.filter(node => !ids.has(node.id))
                : canvasData.nodes;
            canvasData.edges = ids
                ? canvasData.edges.filter(edge => !ids.has(edge.fromNode) && !ids.has(edge.toNode))
                : canvasData.edges;
            canvasData.nodes.push(nodeData);
        }));
    }

    private async getOrderedSnapshots(snapshots: CardSnapshot[], options?: MergeExecutionOptions): Promise<CardSnapshot[]> {
        return this.contentService.getOrderedCards({
            snapshots,
            order: options?.order || 'position',
            sortPriority: options?.sortPriority || 'yx',
            manualOrderIds: options?.manualOrderIds,
            includeBadgePrefix: options?.includeBadgePrefix,
            cardSeparator: options?.cardSeparator
        });
    }

    private resolveAnchorCard(snapshots: CardSnapshot[]): { x: number; y: number; width: number; height: number } {
        const fallback = { x: 0, y: 0, width: 400, height: 400 };
        if (!Array.isArray(snapshots) || snapshots.length === 0) {
            return fallback;
        }

        const first = snapshots[0];
        const totalHeight = snapshots.reduce((sum, snapshot) => {
            const height = snapshot.height > 0 ? snapshot.height : fallback.height;
            return sum + height;
        }, 0);

        return {
            x: first.x,
            y: first.y,
            width: first.width || fallback.width,
            height: totalHeight || fallback.height
        };
    }

    private resolveCleanupMode(fallback?: MergeCleanupMode, preferProvider = false): MergeCleanupMode {
        if (!preferProvider && fallback) {
            return fallback;
        }

        try {
            return this.getMergeCleanupMode?.() || fallback || 'keep-source';
        } catch (error) {
            console.error("Failed to read merge cleanup mode:", error);
            return fallback || 'keep-source';
        }
    }

    private resolveCardSeparator(fallback: string | null): string | null {
        if (!this.getMergeCardSeparator) {
            return fallback;
        }

        try {
            return this.getMergeCardSeparator();
        } catch (error) {
            console.error("Failed to read merge card separator:", error);
            return fallback;
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
            throw new Error(t("errors.createSidebarViewFailed"));
        }

        leaves
            .filter((candidate) => candidate !== leaf)
            .forEach((candidate) => candidate.detach());

        await leaf.setViewState({ type: MERGE_PREVIEW_VIEW_TYPE, active: true });
        if (!(leaf.view instanceof MergeWorkbenchView)) {
            throw new Error(t("errors.workbenchViewInitFailed"));
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
