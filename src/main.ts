import { Notice, Plugin, TFile, WorkspaceLeaf } from 'obsidian';
import CanvasCardActionsSettings from "./settings/ICanvasCardActionsSettings";
import CanvasCardActionsSettingTab from "./settings/CanvasCardActionsSettingTab";

// 导入新架构的组件
import { CanvasAdapter, ClipboardAdapter, StorageAdapter, VaultAdapter } from './adapters';
import { CardService, BadgeService, ContentService, MergeService } from './services';
import { CommandRegistry } from './presentation/commands';
import { BadgeModal } from './presentation/modals';
import { BadgeStyleManager } from './presentation/styles';
import { MergePreviewView, MERGE_PREVIEW_VIEW_TYPE } from './presentation/views';
import {
    CopySingleCardCommand,
    CopyByPositionCommand,
    CopyByBadgeOrderCommand,
    CopyByManualOrderCommand,
    OpenSplitCardModalCommand,
    OpenBadgeModalCommand,
    MergeByDefaultCommand,
    MergeToCanvasCardCommand,
    MergeToSidebarPreviewCommand,
    MergeToMarkdownCommand
} from './presentation/commands';
import { OpenCardPropertiesCommand, CopyCardDimensionsCommand } from "./presentation/commands/PropertiesCommands";

const DEFAULT_SETTINGS: CanvasCardActionsSettings = {
    canvasCardDelimiter: '---',
    sortPriority: 'yx',
    enableBadges: true,
    mergeDefaultOrder: 'position',
    mergeDefaultOutput: 'canvas-card',
}

export default class CanvasCardActionsPlugin extends Plugin {
    settings: CanvasCardActionsSettings;
    
    // 依赖注入容器
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
        
        // 添加快捷键注册
        this.registerHotkeys();
    }

    private async initializeServices(): Promise<void> {
        // 初始化适配器（不依赖Canvas的服务）
        this.clipboardAdapter = new ClipboardAdapter();
        this.storageAdapter = new StorageAdapter(this, DEFAULT_SETTINGS);
        this.vaultAdapter = new VaultAdapter(this.app);
        
        // 初始化设置
        await this.loadSettings();
        
        // 初始化服务（这些服务在Canvas打开时会被重新配置）
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
        this.registerView(MERGE_PREVIEW_VIEW_TYPE, (leaf) => new MergePreviewView(leaf));
    }

    private registerEventHandlers(): void {
        // 注册Canvas菜单事件
        this.registerCanvasMenus();
        
        // 监听Canvas事件
        this.registerCanvasEvents();
    }

    private initializeBadges(): void {
        this.app.workspace.onLayoutReady(() => {
            this.loadAllCanvasBadges();
        });
    }

    registerCanvasMenus() {
        // 单个节点右键菜单
        // @ts-ignore
        this.registerEvent(this.app.workspace.on("canvas:node-menu", (menu: any, node: any) => {
            this.setupCanvasServices(node.canvas);
            this.addNodeMenuCommands(menu, node);
        }));

        // 多选节点右键菜单
        // @ts-ignore
        this.registerEvent(this.app.workspace.on("canvas:selection-menu", (menu: any, canvas: any) => {
            const selection = canvas.selection;
            
            if (!selection || selection.size === 0) {
                return;
            }
            
            // 使用canvas设置服务
            this.setupCanvasServices(canvas);
            
            // 传递选择集合到命令处理器
            this.addSelectionMenuCommands(menu, selection);
        }));
    }

    private setupCanvasServices(canvas: any): void {
        if (!canvas) return;

        // 为当前Canvas创建适配器和服务实例
        const canvasAdapter = new CanvasAdapter(canvas);
        this.cardService = new CardService(canvasAdapter);
        this.badgeService = new BadgeService(canvasAdapter);
        this.contentService = new ContentService(canvasAdapter, this.clipboardAdapter, this.badgeService);
        this.mergeService = new MergeService(this.app, canvasAdapter, this.contentService, this.vaultAdapter);
    }

    private addNodeMenuCommands(menu: any, node: any): void {
        // 徽章命令
        if (this.badgeService && this.badgeService.isValidBadgeNode(node)) {
            const badgeCommand = new OpenBadgeModalCommand(
                async (node) => {
                    const currentBadge = await this.badgeService.getCurrentBadge(node);
                    new BadgeModal(this.app, node, this.badgeService, currentBadge?.content || '').open();
                },
                node
            );
            this.commandRegistry.registerCommand('open-badge-modal', badgeCommand);
            this.commandRegistry.addCommandToMenu(menu, 'open-badge-modal', '添加/编辑徽章', 'tag');
        }

        // 拆分卡片命令
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

        // 复制单卡内容命令
        if (node.text && this.contentService) {
            const copyCommand = new CopySingleCardCommand(this.contentService, node);
            this.commandRegistry.registerCommand('copy-single-card', copyCommand);
            this.commandRegistry.addCommandToMenu(menu, 'copy-single-card', '复制卡片内容', 'copy');
        }

        // 卡片属性管理命令 - 统一命名
        if (node.getData && node.getData().type === "text") {
            menu.addSeparator();
            
            const propertiesCommand = new OpenCardPropertiesCommand(
                this.app,
                this.cardService,
                [node], // 将单个节点包装为数组
                this.clipboardAdapter
            );
            
            this.commandRegistry.registerCommand("open-single-card-properties", propertiesCommand);
            this.commandRegistry.addCommandToMenu(
                menu, 
                "open-single-card-properties", 
                "管理卡片属性", // 统一命名
                "settings"
            );
        }
    }

    private addSelectionMenuCommands(menu: any, selection: any): void {
        if (!this.contentService || !this.mergeService) {
            return;
        }
        
        // 将选择集合转换为数组
        const selectionArray = Array.from(selection);
        
        // 验证我们有实际的节点
        if (selectionArray.length === 0) {
            return;
        }
        
        // 添加按位置复制命令
        const copyByPositionCommand = new CopyByPositionCommand(
            this.contentService,
            selectionArray,
            this.settings.sortPriority
        );
        
        this.commandRegistry.registerCommand("copy-by-position", copyByPositionCommand);
        this.commandRegistry.addCommandToMenu(menu, "copy-by-position", "按位置复制内容", "map-pin");
        
        // 添加按徽章复制命令
        const copyByBadgeCommand = new CopyByBadgeOrderCommand(this.contentService, selectionArray);
        
        this.commandRegistry.registerCommand("copy-by-badge", copyByBadgeCommand);
        this.commandRegistry.addCommandToMenu(menu, "copy-by-badge", "按徽章顺序复制内容", "sort-asc");
        
        // 添加手动排序复制命令
        const copyByManualOrderCommand = new CopyByManualOrderCommand(
            this.app,
            selectionArray
        );
        this.commandRegistry.registerCommand("copy-by-manual-order", copyByManualOrderCommand);
        this.commandRegistry.addCommandToMenu(menu, "copy-by-manual-order", "手动排序复制", "list-ordered");

        menu.addSeparator();

        const mergeByDefaultCommand = new MergeByDefaultCommand(
            this.mergeService,
            selectionArray,
            this.settings
        );
        this.commandRegistry.registerCommand("merge-by-default", mergeByDefaultCommand);
        this.commandRegistry.addCommandToMenu(menu, "merge-by-default", "一键合并（默认）", "combine-glyph");

        const mergeToCardCommand = new MergeToCanvasCardCommand(
            this.mergeService,
            selectionArray,
            this.settings
        );
        this.commandRegistry.registerCommand("merge-to-card", mergeToCardCommand);
        this.commandRegistry.addCommandToMenu(menu, "merge-to-card", "合并并新建卡片", "file-plus");

        const mergeToSidebarCommand = new MergeToSidebarPreviewCommand(
            this.mergeService,
            selectionArray,
            this.settings
        );
        this.commandRegistry.registerCommand("merge-to-sidebar", mergeToSidebarCommand);
        this.commandRegistry.addCommandToMenu(menu, "merge-to-sidebar", "合并并侧边栏预览", "layout-sidebar-right");

        const mergeToMarkdownCommand = new MergeToMarkdownCommand(
            this.mergeService,
            selectionArray,
            this.app.workspace.getActiveFile(),
            this.settings
        );
        this.commandRegistry.registerCommand("merge-to-markdown", mergeToMarkdownCommand);
        this.commandRegistry.addCommandToMenu(menu, "merge-to-markdown", "合并并新建文稿", "file-text");

        // 添加分隔线
        menu.addSeparator();

        // 批量卡片属性管理命令 - 统一命名
        const propertiesCommand = new OpenCardPropertiesCommand(
            this.app,
            this.cardService,
            selectionArray,
            this.clipboardAdapter
        );
        this.commandRegistry.registerCommand("open-card-properties", propertiesCommand);
        this.commandRegistry.addCommandToMenu(
            menu,
            "open-card-properties",
            "管理卡片属性", // 统一命名
            "settings"
        );
    }

    registerCanvasEvents() {
        // 监听 Canvas 文件打开事件
        this.registerEvent(
            this.app.workspace.on("file-open", (file: TFile) => {
                if (file && file.extension === "canvas") {
                    // 延迟一下，确保 Canvas 完全加载
                    setTimeout(() => {
                        this.loadCanvasBadges(file);
                    }, 100);
                }
            })
        );
        
        // 监听布局变化，确保样式持续存在
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
                if (!canvas) continue;
                
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
        // 加载所有打开的 Canvas 的徽章
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

    // ============================================
    // 快捷键注册（可选）
    // ============================================

    private registerHotkeys() {
        // 管理卡片属性的快捷键 - 统一命名
        this.addCommand({
            id: 'open-card-properties',
            name: '管理卡片属性', // 统一命名
            checkCallback: (checking: boolean) => {
                // @ts-ignore
                const activeView = this.app.workspace.getActiveViewOfType(this.app.workspace.ItemView);
                // @ts-ignore
                if (activeView && activeView.getViewType() === 'canvas') {
                    // @ts-ignore
                    const canvas = activeView.canvas;
                    if (canvas && canvas.selection && canvas.selection.size > 0) {
                        if (!checking) {
                            this.setupCanvasServices(canvas);
                            const selectionArray = Array.from(canvas.selection);
                            const command = new OpenCardPropertiesCommand(
                                this.app,
                                this.cardService,
                                selectionArray,
                                this.clipboardAdapter
                            );
                            command.execute();
                        }
                        return true;
                    }
                }
                return false;
            }
        });

        // 复制卡片尺寸的快捷键
        this.addCommand({
            id: 'copy-card-dimensions',
            name: '复制选中卡片的尺寸',
            checkCallback: (checking: boolean) => {
                // @ts-ignore
                const activeView = this.app.workspace.getActiveViewOfType(this.app.workspace.ItemView);
                // @ts-ignore
                if (activeView && activeView.getViewType() === 'canvas') {
                    // @ts-ignore
                    const canvas = activeView.canvas;
                    if (canvas && canvas.selection && canvas.selection.size > 0) {
                        if (!checking) {
                            const selectionArray = Array.from(canvas.selection);
                            const command = new CopyCardDimensionsCommand(selectionArray);
                            command.execute();
                        }
                        return true;
                    }
                }
                return false;
            }
        });
    }
}
