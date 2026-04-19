import { Notice, TFile, WorkspaceLeaf } from "obsidian";
import { ICanvasAdapter } from "../adapters/CanvasAdapter";
import { IVaultAdapter } from "../adapters/VaultAdapter";
import { IContentService, MergeOrder } from "./ContentService";
import { SortPriority } from "../domain/strategies";
import { MergePreviewView, MERGE_PREVIEW_VIEW_TYPE } from "../presentation/views";
import CanvasCardActionsSettings from "../settings/ICanvasCardActionsSettings";

export interface IMergeService {
    mergeByDefault(selection: any[], settings: CanvasCardActionsSettings): Promise<void>;
    mergeToCanvasCard(selection: any[], options?: { order?: MergeOrder; sortPriority?: SortPriority }): Promise<void>;
    mergeToSidebar(selection: any[], options?: { order?: MergeOrder; sortPriority?: SortPriority }): Promise<void>;
    mergeToMarkdown(selection: any[], canvasFile: TFile | null, options?: { order?: MergeOrder; sortPriority?: SortPriority }): Promise<void>;
}

export class MergeService implements IMergeService {
    constructor(
        private app: any,
        private canvasAdapter: ICanvasAdapter,
        private contentService: IContentService,
        private vaultAdapter: IVaultAdapter
    ) {}

    async mergeByDefault(selection: any[], settings: CanvasCardActionsSettings): Promise<void> {
        const order = settings.mergeDefaultOrder === 'badge' ? 'badge' : 'position';
        const output = settings.mergeDefaultOutput;

        if (output === 'sidebar-preview') {
            await this.mergeToSidebar(selection, { order, sortPriority: settings.sortPriority });
            return;
        }

        if (output === 'markdown-file') {
            const file = this.app.workspace.getActiveFile();
            await this.mergeToMarkdown(selection, file, { order, sortPriority: settings.sortPriority });
            return;
        }

        await this.mergeToCanvasCard(selection, { order, sortPriority: settings.sortPriority });
    }

    async mergeToCanvasCard(selection: any[], options?: { order?: MergeOrder; sortPriority?: SortPriority }): Promise<void> {
        const result = await this.contentService.buildMergedContent({
            selection,
            order: options?.order || 'position',
            sortPriority: options?.sortPriority || 'yx',
            includeBadgePrefix: true
        });

        if (!result.content || result.count === 0) {
            new Notice('没有可合并的文本卡片');
            return;
        }

        const anchor = this.resolveAnchorCard(selection);
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
    }

    async mergeToSidebar(selection: any[], options?: { order?: MergeOrder; sortPriority?: SortPriority }): Promise<void> {
        const order = options?.order || 'position';
        const result = await this.contentService.buildMergedContent({
            selection,
            order,
            sortPriority: options?.sortPriority || 'yx',
            includeBadgePrefix: true
        });

        if (!result.content || result.count === 0) {
            new Notice('没有可合并的文本卡片');
            return;
        }

        const view = await this.activateMergePreviewView();
        view.setContent({
            content: result.content,
            count: result.count,
            order
        });
        new Notice(`已在侧边栏预览 ${result.count} 张卡片的合并结果`);
    }

    async mergeToMarkdown(selection: any[], canvasFile: TFile | null, options?: { order?: MergeOrder; sortPriority?: SortPriority }): Promise<void> {
        const order = options?.order || 'position';
        const result = await this.contentService.buildMergedContent({
            selection,
            order,
            sortPriority: options?.sortPriority || 'yx',
            includeBadgePrefix: true
        });

        if (!result.content || result.count === 0) {
            new Notice('没有可合并的文本卡片');
            return;
        }

        if (!canvasFile || canvasFile.extension !== 'canvas') {
            new Notice('请在打开 Canvas 文件时使用该功能');
            return;
        }

        const baseName = `${canvasFile.basename}-卡片合并`;
        const file = await this.vaultAdapter.createMergedDocument(result.content, canvasFile, baseName);
        new Notice(`已创建文稿：${file.path}`);
    }

    private resolveAnchorCard(selection: any[]): { x: number; y: number; width: number; height: number } {
        const fallback = { x: 0, y: 0, width: 400, height: 400 };
        if (!Array.isArray(selection) || selection.length === 0) {
            return fallback;
        }

        const textNodes = selection
            .map(node => node?.getData?.())
            .filter((nodeData: any) => nodeData && nodeData.type === 'text');

        if (textNodes.length === 0) {
            return fallback;
        }

        textNodes.sort((a: any, b: any) => {
            if (Math.abs(a.y - b.y) > 10) {
                return a.y - b.y;
            }
            return a.x - b.x;
        });

        const first = textNodes[0];
        return {
            x: first.x,
            y: first.y,
            width: first.width || fallback.width,
            height: first.height || fallback.height
        };
    }

    private async activateMergePreviewView(): Promise<MergePreviewView> {
        const leaves = this.app.workspace.getLeavesOfType(MERGE_PREVIEW_VIEW_TYPE);
        const existingLeaf = leaves.length > 0 ? leaves[0] : null;
        const fallbackLeaf = this.app.workspace.getRightLeaf(false);
        const leaf: WorkspaceLeaf | null = existingLeaf || fallbackLeaf;

        if (!leaf) {
            throw new Error('无法创建侧边栏视图');
        }

        await leaf.setViewState({ type: MERGE_PREVIEW_VIEW_TYPE, active: true });
        this.app.workspace.revealLeaf(leaf);
        return leaf.view as MergePreviewView;
    }
}
