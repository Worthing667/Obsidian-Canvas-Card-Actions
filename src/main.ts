import { Plugin, TFile } from 'obsidian';
import CanvasCardActionsSettings from "./settings/ICanvasCardActionsSettings";
import CanvasCardActionsSettingTab from "./settings/CanvasCardActionsSettingTab";

import { CanvasAdapter, ClipboardAdapter, StorageAdapter, VaultAdapter } from './adapters';
import { CardService, BadgeService, ContentService, MergeService } from './services';
import {
    CommandRegistry,
    CopySingleCardCommand,
    OpenSplitCardModalCommand,
    OpenBadgeModalCommand,
    MergeToCanvasCardCommand,
    MergeToSidebarPreviewCommand,
    MergeToMarkdownCommand,
    ManualMergeCommand,
    OpenPreviewWorkbenchCommand,
    QuickCopyCommand,
    QuickMergeCommand,
    ICommand
} from './presentation/commands';
import { BadgeModal } from './presentation/modals';
import { BadgeStyleManager } from './presentation/styles';
import { MergeWorkbenchView, MERGE_PREVIEW_VIEW_TYPE } from './presentation/views';
import { OpenCardPropertiesCommand, CopyCardDimensionsCommand } from "./presentation/commands/PropertiesCommands";

const DEFAULT_SETTINGS: CanvasCardActionsSettings = {
    canvasCardDelimiter: '---',
    sortPriority: 'yx',
    enableBadges: true,
    defaultSortMode: 'position',
};

export default class CanvasCardActionsPlugin extends Plugin {
    settings: CanvasCardActionsSettings;

    private clipboardAdapter: ClipboardAdapter;
    private storageAdapter: StorageAdapter;
    private cardService: CardService;
    private badgeService: BadgeService;
    private contentService: ContentService;
    private mergeService: MergeService;
    private commandRegistry: CommandRegistry;
    private badgeStyleManager: BadgeStyleManager;
    private vaultAdapter: VaultAdapter;

    async onload() {
        await this.initializeServices();
        this.registerSettingTab();
        this.setupUI();
        this.registerEventHandlers();
        this.initializeBadges();
        this.registerHotkeys();
        this.registerSelectionCommands();
    }

    private async initializeServices(): Promise<void> {
        this.clipboardAdapter = new ClipboardAdapter();
        this.storageAdapter = new StorageAdapter(this, DEFAULT_SETTINGS);
        this.vaultAdapter = new VaultAdapter(this.app);

        await this.loadSettings();

        this.commandRegistry = new CommandRegistry();
        this.badgeStyleManager = new BadgeStyleManager();
    }

    private registerSettingTab(): void {
        this.addSettingTab(new CanvasCardActionsSettingTab(this.app, this));
    }

    private setupUI(): void {
        this.badgeStyleManager.injectStyles();
        this.registerMergePreviewView();
    }

    private registerMergePreviewView(): void {
        this.registerView(MERGE_PREVIEW_VIEW_TYPE, (leaf) => new MergeWorkbenchView(leaf));
    }

    private registerEventHandlers(): void {
        this.registerCanvasMenus();
        this.registerCanvasEvents();
    }

    private initializeBadges(): void {
        this.app.workspace.onLayoutReady(() => {
            this.loadAllCanvasBadges();
        });
    }

    registerCanvasMenus() {
        // @ts-ignore
        this.registerEvent(this.app.workspace.on("canvas:node-menu", (menu: any, node: any) => {
            this.setupCanvasServices(node.canvas);
            this.addNodeMenuCommands(menu, node);
        }));

        // @ts-ignore
        this.registerEvent(this.app.workspace.on("canvas:selection-menu", (menu: any, canvas: any) => {
            const selection = canvas.selection;
            if (!selection || selection.size === 0) {
                return;
            }

            this.setupCanvasServices(canvas);
            this.addSelectionMenuCommands(menu, selection, this.resolveCanvasFileForCanvas(canvas));
        }));
    }

    private setupCanvasServices(canvas: any): void {
        if (!canvas) {
            return;
        }

        const canvasAdapter = new CanvasAdapter(canvas);
        this.cardService = new CardService(canvasAdapter);
        this.badgeService = new BadgeService(canvasAdapter);
        this.contentService = new ContentService(canvasAdapter, this.clipboardAdapter, this.badgeService);
        this.mergeService = new MergeService(this.app, canvasAdapter, this.contentService, this.vaultAdapter);
    }

    private addNodeMenuCommands(menu: any, node: any): void {
        if (this.badgeService && this.badgeService.isValidBadgeNode(node)) {
            const badgeCommand = new OpenBadgeModalCommand(
                async (targetNode) => {
                    const currentBadge = await this.badgeService.getCurrentBadge(targetNode);
                    new BadgeModal(this.app, targetNode, this.badgeService, currentBadge?.content || '').open();
                },
                node
            );
            this.commandRegistry.registerCommand('open-badge-modal', badgeCommand);
            this.commandRegistry.addCommandToMenu(menu, 'open-badge-modal', '添加/编辑徽章', 'tag');
        }

        const nodeText = node?.getData?.()?.text;
        if (typeof nodeText === "string" && nodeText.trim() && this.cardService) {
            const splitCommand = new OpenSplitCardModalCommand(
                this.app,
                this.cardService,
                node,
                this.settings.canvasCardDelimiter
            );
            this.commandRegistry.registerCommand('split-card', splitCommand);
            this.commandRegistry.addCommandToMenu(menu, 'split-card', '拆分卡片...', 'split');
        }

        if (node.text && this.contentService) {
            const copyCommand = new CopySingleCardCommand(this.contentService, node);
            this.commandRegistry.registerCommand('copy-single-card', copyCommand);
            this.commandRegistry.addCommandToMenu(menu, 'copy-single-card', '复制卡片内容', 'copy');
        }

        if (node.getData && node.getData().type === "text") {
            menu.addSeparator();

            const propertiesCommand = new OpenCardPropertiesCommand(
                this.app,
                this.cardService,
                [node],
                this.clipboardAdapter
            );

            this.commandRegistry.registerCommand("open-single-card-properties", propertiesCommand);
            this.commandRegistry.addCommandToMenu(menu, "open-single-card-properties", "管理卡片属性", "settings");
        }
    }

    private addSelectionMenuCommands(menu: any, selection: any, canvasFile: TFile | null): void {
        if (!this.contentService || !this.mergeService) {
            return;
        }

        const selectionArray = Array.from(selection);
        if (selectionArray.length === 0) {
            return;
        }

        const quickCopyCommand = new QuickCopyCommand(this.contentService, selectionArray, this.settings);
        this.commandRegistry.registerCommand("quick-copy", quickCopyCommand);
        this.commandRegistry.addCommandToMenu(menu, "quick-copy", "一键复制", "copy");

        const quickMergeCommand = new QuickMergeCommand(this.mergeService, selectionArray, this.settings);
        this.commandRegistry.registerCommand("quick-merge", quickMergeCommand);
        this.commandRegistry.addCommandToMenu(menu, "quick-merge", "一键拼合", "file-plus");

        const openPreviewCommand = new OpenPreviewWorkbenchCommand(
            this.mergeService,
            selectionArray,
            canvasFile,
            this.settings
        );
        this.commandRegistry.registerCommand("open-preview-workbench", openPreviewCommand);
        this.commandRegistry.addCommandToMenu(menu, "open-preview-workbench", "打开预览...", "panel-right");

        menu.addSeparator();

        const propertiesCommand = new OpenCardPropertiesCommand(
            this.app,
            this.cardService,
            selectionArray,
            this.clipboardAdapter
        );
        this.commandRegistry.registerCommand("open-card-properties", propertiesCommand);
        this.commandRegistry.addCommandToMenu(menu, "open-card-properties", "管理卡片属性", "settings");
    }

    private resolveCanvasFileForCanvas(canvas: any): TFile | null {
        const leaf = this.app.workspace.getLeavesOfType("canvas").find((workspaceLeaf: any) => {
            return workspaceLeaf.view?.canvas === canvas;
        });

        const file = (leaf?.view as any)?.file || this.app.workspace.getActiveFile();
        return file instanceof TFile && file.extension === "canvas" ? file : null;
    }

    registerCanvasEvents() {
        this.registerEvent(
            this.app.workspace.on("file-open", (file: TFile) => {
                if (file && file.extension === "canvas") {
                    setTimeout(() => {
                        this.loadCanvasBadges(file);
                    }, 100);
                }
            })
        );

        this.registerEvent(
            this.app.workspace.on("layout-change", () => {
                this.badgeStyleManager.ensureStylesExist();
            })
        );
    }

    async loadCanvasBadges(file: TFile) {
        const leaves = this.app.workspace.getLeavesOfType("canvas");

        for (const leaf of leaves) {
            const view = leaf.view as any;
            if (view.file?.path === file.path) {
                const canvas = view.canvas;
                if (!canvas) {
                    continue;
                }

                try {
                    const canvasAdapter = new CanvasAdapter(canvas);
                    const badgeService = new BadgeService(canvasAdapter);
                    await badgeService.loadCanvasBadges();
                    console.log(`已加载 ${file.name} 的所有徽章`);
                } catch (error) {
                    console.error("加载 Canvas 徽章时出错:", error);
                }
            }
        }
    }

    loadAllCanvasBadges() {
        const canvasLeaves = this.app.workspace.getLeavesOfType("canvas");

        canvasLeaves.forEach((leaf) => {
            const view = leaf.view as any;
            if (view.file) {
                this.loadCanvasBadges(view.file);
            }
        });
    }

    async loadSettings() {
        this.settings = await this.storageAdapter.loadSettings();
    }

    async saveSettings() {
        await this.storageAdapter.saveSettings(this.settings);
    }

    onunload() {
        this.badgeStyleManager.removeStyles();
        this.commandRegistry.clear();
        console.log("Canvas Card Actions plugin unloaded");
    }

    private registerHotkeys() {
        this.addCommand({
            id: 'open-card-properties',
            name: '管理卡片属性',
            checkCallback: (checking: boolean) => {
                const context = this.getActiveCanvasSelectionContext();
                if (!context) {
                    return false;
                }

                if (!checking) {
                    this.setupCanvasServices(context.canvas);
                    const command = new OpenCardPropertiesCommand(
                        this.app,
                        this.cardService,
                        context.selection,
                        this.clipboardAdapter
                    );
                    void command.execute();
                }

                return true;
            }
        });

        this.addCommand({
            id: 'copy-card-dimensions',
            name: '复制选中卡片的尺寸',
            checkCallback: (checking: boolean) => {
                const context = this.getActiveCanvasSelectionContext();
                if (!context) {
                    return false;
                }

                if (!checking) {
                    const command = new CopyCardDimensionsCommand(context.selection);
                    void command.execute();
                }

                return true;
            }
        });
    }

    private registerSelectionCommands(): void {
        this.registerCanvasSelectionCommand(
            'quick-copy-selected-cards',
            '将当前选区一键复制',
            ({ selection }) => new QuickCopyCommand(this.contentService, selection, this.settings)
        );

        this.registerCanvasSelectionCommand(
            'quick-merge-selected-cards',
            '将当前选区一键拼合',
            ({ selection }) => new QuickMergeCommand(this.mergeService, selection, this.settings)
        );

        this.registerCanvasSelectionCommand(
            'open-merge-workbench',
            '打开预览工作台',
            ({ selection, file }) => new OpenPreviewWorkbenchCommand(this.mergeService, selection, file, this.settings)
        );

        this.registerCanvasSelectionCommand(
            'merge-selected-cards-to-canvas-card',
            '合并选区为新卡片',
            ({ selection }) => new MergeToCanvasCardCommand(this.mergeService, selection, this.settings)
        );

        this.registerCanvasSelectionCommand(
            'preview-selected-cards-in-workbench',
            '在工作台中预览合并结果',
            ({ selection, file }) => new MergeToSidebarPreviewCommand(this.mergeService, selection, file, this.settings)
        );

        this.registerCanvasSelectionCommand(
            'merge-selected-cards-to-markdown',
            '合并选区为新文稿',
            ({ selection, file }) => new MergeToMarkdownCommand(this.mergeService, selection, file, this.settings)
        );

        this.registerCanvasSelectionCommand(
            'manual-merge-selected-cards',
            '手动排序拼合选区',
            ({ selection, file }) => new ManualMergeCommand(this.app, this.mergeService, selection, file)
        );
    }

    private registerCanvasSelectionCommand(
        id: string,
        name: string,
        factory: (context: { selection: any[]; file: TFile | null }) => ICommand
    ): void {
        this.addCommand({
            id,
            name,
            checkCallback: (checking: boolean) => {
                const context = this.getActiveCanvasSelectionContext();
                if (!context) {
                    return false;
                }

                this.setupCanvasServices(context.canvas);
                const command = factory({
                    selection: context.selection,
                    file: context.file
                });

                if (command.canExecute && !command.canExecute()) {
                    return false;
                }

                if (!checking) {
                    void command.execute();
                }

                return true;
            }
        });
    }

    private getActiveCanvasSelectionContext(): { canvas: any; selection: any[]; file: TFile | null } | null {
        const activeLeaf = this.app.workspace.activeLeaf;
        const activeView = activeLeaf?.view as any;

        if (!activeView || activeView.getViewType?.() !== 'canvas' || !activeView.canvas) {
            return null;
        }

        const selection = Array.from(activeView.canvas.selection || []);
        if (selection.length === 0) {
            return null;
        }

        const file = activeView.file instanceof TFile ? activeView.file : null;
        return {
            canvas: activeView.canvas,
            selection,
            file
        };
    }
}
