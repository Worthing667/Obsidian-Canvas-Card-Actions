import { Plugin, TFile } from 'obsidian';
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
        this.registerEvent(this.app.workspace.on("canvas:selection-menu", (menu: any, selection: any) => {
            const firstNode = Array.from(selection)[0] as any;
            if (firstNode) {
                this.setupCanvasServices(firstNode.canvas);
                this.addSelectionMenuCommands(menu, selection);
            }
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
    }

    private addSelectionMenuCommands(menu: any, selection: any): void {
        if (!this.contentService) return;

        const selectionArray = Array.from(selection);

        // 按位置复制命令
        const copyByPositionCommand = new CopyByPositionCommand(
            this.contentService, 
            selectionArray, 
            this.settings.sortPriority
        );
        this.commandRegistry.registerCommand('copy-by-position', copyByPositionCommand);
        this.commandRegistry.addCommandToMenu(menu, 'copy-by-position', '按位置复制内容', 'map-pin');

        // 按徽章顺序复制命令
        const copyByBadgeCommand = new CopyByBadgeOrderCommand(this.contentService, selectionArray);
        this.commandRegistry.registerCommand('copy-by-badge', copyByBadgeCommand);
        this.commandRegistry.addCommandToMenu(menu, 'copy-by-badge', '按徽章顺序复制内容', 'sort-asc');
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
}