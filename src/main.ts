import { Notice, Plugin, TFile, WorkspaceLeaf } from 'obsidian';
import CardifySettings from "./interface/ICardifySettings";
import CardifySettingTab from "./class/CardifySettingTabClass";

// 导入新架构的组件
import { CanvasAdapter, ClipboardAdapter, StorageAdapter } from './adapters';
import { CardService, BadgeService, ContentService } from './services';
import { CommandRegistry } from './presentation/commands';
import { BadgeModal } from './presentation/modals';
import { BadgeStyleManager } from './presentation/styles';
import { 
    CopySingleCardCommand, 
    CopyByPositionCommand, 
    CopyByBadgeOrderCommand,
    SplitCardCommand,
    OpenBadgeModalCommand 
} from './presentation/commands';
import { OpenCardPropertiesCommand, CopyCardDimensionsCommand } from "./presentation/commands/PropertiesCommands";

const DEFAULT_SETTINGS: CardifySettings = {
    canvasCardDelimiter: '---',
    sortPriority: 'yx',
    enableBadges: true,
}

export default class Cardify extends Plugin {
    settings: CardifySettings;
    
    // 依赖注入容器
    private clipboardAdapter: ClipboardAdapter;
    private storageAdapter: StorageAdapter;
    private cardService: CardService;
    private badgeService: BadgeService;
    private contentService: ContentService;
    private commandRegistry: CommandRegistry;
    private badgeStyleManager: BadgeStyleManager;

    async onload() {
        console.log("Loading Canvas Card Actions plugin with new architecture");

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
        
        // 初始化设置
        await this.loadSettings();
        
        // 初始化服务（这些服务在Canvas打开时会被重新配置）
        this.commandRegistry = new CommandRegistry();
        this.badgeStyleManager = new BadgeStyleManager();
    }

    private registerSettingTab(): void {
        this.addSettingTab(new CardifySettingTab(this.app, this));
    }

    private setupUI(): void {
        this.badgeStyleManager.injectStyles();
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
        // @ts-ignore
        this.registerEvent(this.app.workspace.on("canvas:node-menu", (menu: any, node: any) => {
            this.setupCanvasServices(node.canvas);
            this.addNodeMenuCommands(menu, node);
        }));

        // @ts-ignore
        this.registerEvent(this.app.workspace.on("canvas:selection-menu", (menu: any, canvas: any) => {
            console.log("Canvas selection menu event triggered");
            
            // CRITICAL FIX: The parameter is a canvas, not a selection
            // Access the selection from canvas.selection
            const selection = canvas.selection;
            
            if (!selection || selection.size === 0) {
                console.log("No nodes selected");
                return;
            }
            
            const selectionArray = Array.from(selection);
            console.log("Selection array:", selectionArray);
            console.log("Number of selected nodes:", selectionArray.length);
            
            // Setup services using the canvas
            this.setupCanvasServices(canvas);
            
            // Pass the selection to the command handler
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
        if (node.text && this.cardService) {
            const splitCommand = new SplitCardCommand(this.cardService, node, this.settings.canvasCardDelimiter);
            this.commandRegistry.registerCommand('split-card', splitCommand);
            this.commandRegistry.addCommandToMenu(menu, 'split-card', '按分隔符拆分卡片', 'split');
        }

        // 复制单卡内容命令
        if (node.text && this.contentService) {
            const copyCommand = new CopySingleCardCommand(this.contentService, node);
            this.commandRegistry.registerCommand('copy-single-card', copyCommand);
            this.commandRegistry.addCommandToMenu(menu, 'copy-single-card', '复制卡片内容', 'copy');
        }

        // 添加属性查看功能 - 适用于所有文本节点
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
                "编辑卡片尺寸...", 
                "edit"
            );

        }
    }

    private addSelectionMenuCommands(menu: any, selection: any): void {
        console.log("addSelectionMenuCommands called");
        console.log("Selection received:", selection);
        console.log("Selection size:", selection?.size || 0);
        console.log("contentService exists:", !!this.contentService);
        
        if (!this.contentService) {
            console.error("Content service not initialized");
            return;
        }
        
        // Convert the selection Set to an array
        const selectionArray = Array.from(selection);
        console.log("Adding selection menu commands for", selectionArray.length, "items");
        
        // Verify we have actual nodes
        if (selectionArray.length === 0) {
            console.log("No nodes to add commands for");
            return;
        }
        
        // Log the first node to verify its structure
        console.log("First selected node:", selectionArray[0]);
        console.log("First node type:", (selectionArray[0] as any)?.type);
        console.log("First node has text:", !!(selectionArray[0] as any)?.text);
        
        // Add copy by position command
        const copyByPositionCommand = new CopyByPositionCommand(
            this.contentService,
            selectionArray,
            this.settings.sortPriority
        );
        
        console.log("Copy by position command canExecute:", copyByPositionCommand.canExecute());
        
        this.commandRegistry.registerCommand("copy-by-position", copyByPositionCommand);
        this.commandRegistry.addCommandToMenu(menu, "copy-by-position", "按位置复制内容", "map-pin");
        
        // Add copy by badge command
        const copyByBadgeCommand = new CopyByBadgeOrderCommand(this.contentService, selectionArray);
        
        console.log("Copy by badge command canExecute:", copyByBadgeCommand.canExecute());
        
        this.commandRegistry.registerCommand("copy-by-badge", copyByBadgeCommand);
        this.commandRegistry.addCommandToMenu(menu, "copy-by-badge", "按徽章顺序复制内容", "sort-asc");
        
        // 添加分隔线
        menu.addSeparator();
        
        // ===== 新增：卡片属性查看器 =====
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
            "批量管理卡片属性...", 
            "settings"
        );
        
        // 获取文本卡片以进行尺寸操作
        const textCards = selectionArray.filter(
            (node: any) => node.getData && node.getData().type === "text"
        );
        
        
        console.log("Selection menu commands added successfully");
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
        // 查看卡片属性的快捷键
        this.addCommand({
            id: 'open-card-properties',
            name: '查看选中卡片的属性',
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