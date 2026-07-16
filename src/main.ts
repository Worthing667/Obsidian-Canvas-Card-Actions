import { Menu, Plugin, TFile, View, WorkspaceLeaf } from 'obsidian';
import CanvasLoomSettings, {
    DEFAULT_LANGUAGE,
    DEFAULT_SPLIT_CARDS_PER_ROW,
    DEFAULT_CANVAS_LABEL_ZOOM_COMPENSATION,
    resolveMergeCardSeparator
} from "./settings/ICanvasLoomSettings";
import CanvasLoomSettingTab from "./settings/CanvasLoomSettingTab";

import { CanvasAdapter, ClipboardAdapter, StorageAdapter, VaultAdapter } from './adapters';
import {
    CardService,
    BadgeService,
    ContentService,
    ColorGroupService,
    MergeService,
    PerformanceService,
    BadgeRenderScheduler,
    CanvasSelectionToolbarService,
    CanvasGlobalFindReplaceToolbarService,
    CanvasLabelScaleService,
    CanvasPerformanceModeService,
    CanvasZoomControlService,
    SearchReplaceService,
    CardImageExportService,
    HtmlToImageCardRenderer
} from './services';
import {
    CommandRegistry,
    CopySingleCardCommand,
    OpenSplitCardModalCommand,
    OpenBadgeModalCommand,
    OpenSequenceToolsCommand,
    SelectSameColorCardsCommand,
    OpenSameColorGroupWorkbenchCommand,
    MergeToCanvasCardCommand,
    MergeToSidebarPreviewCommand,
    MergeToMarkdownCommand,
    ManualMergeCommand,
    OpenPreviewWorkbenchCommand,
    QuickCopyCommand,
    QuickMergeCommand,
    OpenFindReplaceWorkbenchCommand,
    ExportCardsAsImageCommand,
    ICommand
} from './presentation/commands';
import { BadgeModal, BatchBadgeModal } from './presentation/modals';
import { MergeWorkbenchView, MERGE_PREVIEW_VIEW_TYPE } from './presentation/views';
import { OpenCardPropertiesCommand, CopyCardDimensionsCommand } from "./presentation/commands/PropertiesCommands";
import type { Canvas, CanvasNode } from "./types/canvas";
import { clearTranslationRuntimeContext, configureTranslationRuntimeContext, t } from "./i18n";
import type { TranslationKey, TranslationParams } from "./i18n";
import { isTextNodeData } from "./utils/canvasNodeUtils";
import { hasCanvasEditingNode, isCanvasNodeEditing } from "./utils/canvasEditingState";

const DEFAULT_SETTINGS: CanvasLoomSettings = {
    language: DEFAULT_LANGUAGE,
    canvasCardDelimiter: '---',
    insertDelimiterOnMerge: false,
    splitCardsPerRow: DEFAULT_SPLIT_CARDS_PER_ROW,
    sortPriority: 'yx',
    enableBadges: true,
    showEdgesAboveCards: false,
    canvasLabelZoomCompensation: DEFAULT_CANVAS_LABEL_ZOOM_COMPENSATION,
    defaultSortMode: 'position',
    mergeCleanupMode: 'keep-source',
    enablePerformanceMode: false,
    enablePerformanceDiagnostics: false,
    largeCanvasNodeThreshold: 80,
    badgeUpdateDebounceMs: 150,
    enableZoomControl: true,
};

interface CanvasServiceBundle {
    cardService: CardService;
    badgeService: BadgeService;
    contentService: ContentService;
    colorGroupService: ColorGroupService;
    searchReplaceService: SearchReplaceService;
    mergeService: MergeService;
    cardImageExportService: CardImageExportService;
}

export default class CanvasLoomPlugin extends Plugin {
    settings: CanvasLoomSettings;

    private clipboardAdapter: ClipboardAdapter;
    private storageAdapter: StorageAdapter;
    private cardService: CardService;
    private badgeService: BadgeService;
    private contentService: ContentService;
    private colorGroupService: ColorGroupService;
    private mergeService: MergeService;
    private searchReplaceService: SearchReplaceService;
    private cardImageExportService: CardImageExportService;
    private performanceService: PerformanceService;
    private badgeRenderScheduler: BadgeRenderScheduler;
    private canvasSelectionToolbarService: CanvasSelectionToolbarService;
    private canvasGlobalFindReplaceToolbarService: CanvasGlobalFindReplaceToolbarService;
    private canvasLabelScaleService: CanvasLabelScaleService;
    private canvasPerformanceModeService: CanvasPerformanceModeService;
    private canvasZoomControlService: CanvasZoomControlService;
    private commandRegistry: CommandRegistry;
    private vaultAdapter: VaultAdapter;
    private cardImageRenderer: HtmlToImageCardRenderer;
    private canvasEdgeLayerRefreshTimeout: number | null = null;
    private canvasEdgeLayerInteractionObserver: MutationObserver | null = null;
    private canvasEdgeLayerObservedRootEl: HTMLElement | null = null;
    private canvasServicesByCanvas = new WeakMap<Canvas, CanvasServiceBundle>();

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
        this.cardImageRenderer = new HtmlToImageCardRenderer();

        await this.loadSettings();
        configureTranslationRuntimeContext({
            getSettings: () => this.settings,
            getApp: () => this.app
        });

        this.commandRegistry = new CommandRegistry();
        this.performanceService = new PerformanceService(() => this.settings);
        this.badgeRenderScheduler = new BadgeRenderScheduler();
        this.canvasSelectionToolbarService = new CanvasSelectionToolbarService(
            this.app,
            () => this.settings,
            {
                openNumbering: (canvas, nodes) => {
                    const services = this.getOrCreateCanvasServices(canvas);
                    if (nodes.length === 1) {
                        void services.badgeService.getCurrentBadge(nodes[0]).then((currentBadge) => {
                            new BadgeModal(
                                this.app,
                                nodes[0],
                                services.badgeService,
                                currentBadge?.content || ""
                            ).open();
                        });
                        return;
                    }

                    new BatchBadgeModal(
                        this.app,
                        nodes,
                        services.badgeService,
                        this.settings.sortPriority
                    ).open();
                },
                removeBadges: async (canvas, nodes) => {
                    const services = this.getOrCreateCanvasServices(canvas);
                    return services.badgeService.removeBadges(nodes);
                }
            }
        );
        this.canvasGlobalFindReplaceToolbarService = new CanvasGlobalFindReplaceToolbarService(
            this.app,
            this.performanceService
        );
        this.canvasLabelScaleService = new CanvasLabelScaleService(this.app);
        this.canvasPerformanceModeService = new CanvasPerformanceModeService(
            this.app,
            () => this.settings.largeCanvasNodeThreshold
        );
        this.canvasZoomControlService = new CanvasZoomControlService(this.app);
    }

    private registerSettingTab(): void {
        this.addSettingTab(new CanvasLoomSettingTab(this.app, this));
    }

    private setupUI(): void {
        this.syncPerformanceModeClass();
        this.syncCanvasPerformanceMode();
        this.syncCanvasEdgeLayerClass();
        this.syncCanvasLabelScale();
        this.syncCanvasZoomControl();
        this.registerCanvasEdgeLayerInteractionTracking();

        this.registerMergePreviewView();
        this.canvasSelectionToolbarService.start();
        this.canvasGlobalFindReplaceToolbarService.start();
        this.canvasZoomControlService.start();
    }

    private registerMergePreviewView(): void {
        this.registerView(MERGE_PREVIEW_VIEW_TYPE, (leaf) => new MergeWorkbenchView(leaf, () => this.settings));
    }

    private registerEventHandlers(): void {
        this.registerCanvasMenus();
        this.registerCanvasEvents();
        this.registerBadgeUndoRefresh();
    }

    private initializeBadges(): void {
        this.app.workspace.onLayoutReady(() => {
            if (this.settings.enableBadges) {
                void this.loadAllCanvasBadges();
            } else {
                this.clearAllCanvasBadgeDom();
            }
        });
    }

    registerCanvasMenus() {
        // @ts-ignore
        this.registerEvent(this.app.workspace.on("canvas:node-menu", (menu: Menu, node: CanvasNode) => {
            this.setupCanvasServices(node.canvas);
            this.addNodeMenuCommands(menu, node);
        }));

        // @ts-ignore
        this.registerEvent(this.app.workspace.on("canvas:selection-menu", (menu: Menu, canvas: Canvas) => {
            const selection = canvas.selection;
            if (!selection || selection.size === 0) {
                return;
            }

            this.setupCanvasServices(canvas);
            this.addSelectionMenuCommands(menu, canvas, this.resolveCanvasFileForCanvas(canvas));
        }));
    }

    private setupCanvasServices(canvas?: Canvas): void {
        if (!canvas) {
            return;
        }

        const services = this.getOrCreateCanvasServices(canvas);
        this.cardService = services.cardService;
        this.badgeService = services.badgeService;
        this.contentService = services.contentService;
        this.colorGroupService = services.colorGroupService;
        this.searchReplaceService = services.searchReplaceService;
        this.mergeService = services.mergeService;
        this.cardImageExportService = services.cardImageExportService;
    }

    private getOrCreateCanvasServices(canvas: Canvas): CanvasServiceBundle {
        const existingServices = this.canvasServicesByCanvas.get(canvas);
        if (existingServices) {
            return existingServices;
        }

        const canvasAdapter = new CanvasAdapter(canvas, this.performanceService);
        const badgeService = new BadgeService(canvasAdapter, () => this.settings.enableBadges);
        const contentService = new ContentService(canvasAdapter, this.clipboardAdapter, badgeService);
        const searchReplaceService = new SearchReplaceService(canvasAdapter);
        const services: CanvasServiceBundle = {
            cardService: new CardService(
                canvasAdapter,
                20,
                400,
                400,
                this.performanceService,
                () => this.settings.splitCardsPerRow
            ),
            badgeService,
            contentService,
            colorGroupService: new ColorGroupService(canvasAdapter),
            searchReplaceService,
            mergeService: new MergeService(
                this.app,
                canvasAdapter,
                contentService,
                this.vaultAdapter,
                searchReplaceService,
                this.performanceService,
                () => this.settings.mergeCleanupMode,
                () => resolveMergeCardSeparator(this.settings)
            ),
            cardImageExportService: new CardImageExportService(
                canvas,
                this.cardImageRenderer,
                this.vaultAdapter
            )
        };

        this.canvasServicesByCanvas.set(canvas, services);
        return services;
    }

    private translate(key: TranslationKey, params?: TranslationParams): string {
        return t(key, params, { settings: this.settings, app: this.app });
    }

    private addNodeMenuCommands(menu: Menu, node: CanvasNode): void {
        if (this.badgeService && this.badgeService.isValidBadgeNode(node)) {
            const badgeCommand = new OpenBadgeModalCommand(
                async (targetNode) => {
                    const currentBadge = await this.badgeService.getCurrentBadge(targetNode);
                    new BadgeModal(this.app, targetNode, this.badgeService, currentBadge?.content || '').open();
                },
                node,
                this.settings
            );
            this.commandRegistry.registerCommand('open-badge-modal', badgeCommand);
            this.commandRegistry.addCommandToMenu(menu, 'open-badge-modal', this.translate("menu.editBadge"), 'tag');
        }

        const nodeText = node?.getData?.()?.text;
        if (typeof nodeText === "string" && nodeText.trim() && this.cardService) {
            const splitCommand = new OpenSplitCardModalCommand(
                this.app,
                this.cardService,
                node,
                this.settings.canvasCardDelimiter,
                this.settings
            );
            this.commandRegistry.registerCommand('split-card', splitCommand);
            this.commandRegistry.addCommandToMenu(menu, 'split-card', this.translate("menu.splitCard"), 'split');
        }

        if (node.text && this.contentService) {
            const copyCommand = new CopySingleCardCommand(this.contentService, node, this.settings);
            this.commandRegistry.registerCommand('copy-single-card', copyCommand);
            this.commandRegistry.addCommandToMenu(menu, 'copy-single-card', this.translate("menu.copyCardContent"), 'copy');
        }

        if (isTextNodeData(node.getData?.()) && node.canvas && this.cardImageExportService) {
            const exportCommand = new ExportCardsAsImageCommand(
                this.cardImageExportService,
                [node],
                this.resolveCanvasFileForCanvas(node.canvas),
                this.settings
            );
            this.commandRegistry.registerCommand("export-card-as-image", exportCommand);
            this.commandRegistry.addCommandToMenu(
                menu,
                "export-card-as-image",
                this.translate("menu.exportCardAsImage"),
                "image"
            );
        }

        if (isTextNodeData(node.getData?.()) && this.colorGroupService) {
            const selectSameColorCommand = new SelectSameColorCardsCommand(
                this.colorGroupService,
                this.resolveNodeMenuSelection(node),
                this.settings
            );
            this.commandRegistry.registerCommand("select-same-color-cards", selectSameColorCommand);
            this.commandRegistry.addCommandToMenu(menu, "select-same-color-cards", this.translate("menu.selectSameColorCards"), "palette");
        }

        if (isTextNodeData(node.getData?.())) {
            menu.addSeparator();

            const propertiesCommand = new OpenCardPropertiesCommand(
                this.app,
                this.cardService,
                [node],
                this.clipboardAdapter,
                this.settings
            );

            this.commandRegistry.registerCommand("open-single-card-properties", propertiesCommand);
            this.commandRegistry.addCommandToMenu(menu, "open-single-card-properties", this.translate("menu.manageCardProperties"), "settings");
        }
    }

    private addSelectionMenuCommands(menu: Menu, canvas: Canvas, canvasFile: TFile | null): void {
        if (!this.contentService || !this.mergeService) {
            return;
        }

        const selection = canvas.selection || new Set<CanvasNode>();
        const selectionArray = Array.from(selection);
        if (selectionArray.length === 0) {
            return;
        }

        if (this.colorGroupService?.hasTextCardSelection(selectionArray)) {
            const selectSameColorCommand = new SelectSameColorCardsCommand(
                this.colorGroupService,
                selectionArray,
                this.settings
            );
            this.commandRegistry.registerCommand("select-same-color-cards", selectSameColorCommand);
            this.commandRegistry.addCommandToMenu(menu, "select-same-color-cards", this.translate("menu.selectSameColorCards"), "palette");
        }

        if (this.badgeService && this.hasBadgeEditableSelection(selectionArray)) {
            const sequenceToolsCommand = new OpenSequenceToolsCommand(
                () => {
                    const viewWindow = canvas.wrapperEl?.ownerDocument.defaultView || window;
                    viewWindow.setTimeout(() => {
                        this.canvasSelectionToolbarService.openSequenceTools(canvas);
                    }, 0);
                },
                selectionArray,
                (nodes) => this.hasBadgeEditableSelection(nodes),
                this.settings
            );
            this.commandRegistry.registerCommand("open-sequence-tools", sequenceToolsCommand);
            this.commandRegistry.addCommandToMenu(menu, "open-sequence-tools", this.translate("menu.sequenceTools"), "tag");
        }

        const quickCopyCommand = new QuickCopyCommand(this.contentService, selectionArray, this.settings);
        this.commandRegistry.registerCommand("quick-copy", quickCopyCommand);
        this.commandRegistry.addCommandToMenu(menu, "quick-copy", this.translate("menu.quickCopy"), "copy");

        if (this.cardImageExportService && this.hasTextCardSelectionFast(selectionArray)) {
            const exportCommand = new ExportCardsAsImageCommand(
                this.cardImageExportService,
                selectionArray,
                canvasFile,
                this.settings
            );
            this.commandRegistry.registerCommand("export-selection-as-image", exportCommand);
            this.commandRegistry.addCommandToMenu(
                menu,
                "export-selection-as-image",
                this.translate("menu.exportSelectionAsImage"),
                "image"
            );
        }

        const quickMergeCommand = new QuickMergeCommand(this.mergeService, selectionArray, this.settings);
        this.commandRegistry.registerCommand("quick-merge", quickMergeCommand);
        this.commandRegistry.addCommandToMenu(menu, "quick-merge", this.translate("menu.quickMerge"), "file-plus");

        const openPreviewCommand = new OpenPreviewWorkbenchCommand(
            this.mergeService,
            selectionArray,
            canvasFile,
            this.settings
        );
        this.commandRegistry.registerCommand("open-preview-workbench", openPreviewCommand);
        this.commandRegistry.addCommandToMenu(menu, "open-preview-workbench", this.translate("menu.previewCardGroup"), "panel-right");

        menu.addSeparator();

        const propertiesCommand = new OpenCardPropertiesCommand(
            this.app,
            this.cardService,
            selectionArray,
            this.clipboardAdapter,
            this.settings
        );
        this.commandRegistry.registerCommand("open-card-properties", propertiesCommand);
        this.commandRegistry.addCommandToMenu(menu, "open-card-properties", this.translate("menu.manageCardProperties"), "settings");
    }

    private resolveCanvasFileForCanvas(canvas: Canvas): TFile | null {
        const leaf = this.app.workspace.getLeavesOfType("canvas").find((workspaceLeaf: WorkspaceLeaf) => {
            return workspaceLeaf.view?.canvas === canvas;
        });

        const file = leaf?.view?.file || this.app.workspace.getActiveFile();
        return file instanceof TFile && file.extension === "canvas" ? file : null;
    }

    registerCanvasEvents() {
        this.registerEvent(
            this.app.workspace.on("file-open", (file: TFile) => {
                if (!file || file.extension !== "canvas") {
                    return;
                }

                window.setTimeout(() => {
                    this.syncCanvasLabelScale();
                    this.syncCanvasPerformanceMode();
                    this.syncCanvasZoomControl();

                    if (this.settings.enableBadges) {
                        void this.loadCanvasBadges(file);
                    }
                }, 100);
            })
        );

        this.registerEvent(
            this.app.workspace.on("layout-change", () => {
                this.syncCanvasLabelScale();
                this.syncCanvasPerformanceMode();
                this.syncCanvasZoomControl();
            })
        );
    }

    private registerBadgeUndoRefresh(): void {
        this.registerDomEvent(activeDocument, "keydown", (event: KeyboardEvent) => {
            if (!this.settings.enableBadges || !this.isUndoOrRedoShortcut(event)) {
                return;
            }

            this.scheduleActiveCanvasBadgeRefresh();
        }, { capture: true });
    }

    async loadCanvasBadges(file: TFile) {
        if (!this.settings.enableBadges) {
            return;
        }

        const leaves = this.app.workspace.getLeavesOfType("canvas");

        for (const leaf of leaves) {
            const view = leaf.view;
            if (view.file?.path === file.path) {
                const canvas = view.canvas;
                if (!canvas) {
                    continue;
                }

                try {
                    this.scheduleCanvasBadgeRender(canvas, file.path);
                } catch (error) {
                    console.error("Failed to load Canvas badges:", error);
                }
            }
        }
    }

    async loadAllCanvasBadges(): Promise<void> {
        if (!this.settings.enableBadges) {
            return;
        }

        const canvasLeaves = this.app.workspace.getLeavesOfType("canvas");

        for (const leaf of canvasLeaves) {
            const view = leaf.view;
            if (view.file) {
                await this.loadCanvasBadges(view.file);
            }
        }
    }

    private scheduleActiveCanvasBadgeRefresh(): void {
        this.refreshActiveCanvasBadges();
    }

    private refreshActiveCanvasBadges(): void {
        if (!this.settings.enableBadges) {
            return;
        }

        const activeView = this.app.workspace.getActiveViewOfType(View);
        if (!activeView || activeView.getViewType?.() !== "canvas" || !activeView.canvas) {
            return;
        }

        try {
            const file = activeView.file instanceof TFile ? activeView.file : null;
            this.scheduleCanvasBadgeRender(activeView.canvas, file?.path || "active-canvas");
        } catch (error) {
            console.error("Failed to refresh Canvas badge display:", error);
        }
    }

    private scheduleCanvasBadgeRender(canvas: Canvas, key: string): void {
        const canvasAdapter = new CanvasAdapter(canvas, this.performanceService);
        const badgeService = new BadgeService(canvasAdapter, () => this.settings.enableBadges);
        const canvasData = canvasAdapter.getData();
        const stats = this.performanceService.getStats(canvasData);

        this.performanceService.log("canvas.stats", {
            filePath: key,
            ...stats
        });

        this.badgeRenderScheduler.schedule({
            key,
            badgeService,
            debounceMs: this.settings.badgeUpdateDebounceMs,
            batchSize: stats.isLargeCanvas ? 30 : Math.max(1, stats.badgeNodeCount),
            performanceService: this.performanceService
        });
    }

    private isUndoOrRedoShortcut(event: KeyboardEvent): boolean {
        return (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "z";
    }

    clearAllCanvasBadgeDom() {
        const canvasLeaves = this.app.workspace.getLeavesOfType("canvas");

        canvasLeaves.forEach((leaf) => {
            const view = leaf.view;
            const canvas = view?.canvas;
            if (!canvas) {
                return;
            }

            try {
                const canvasAdapter = new CanvasAdapter(canvas, this.performanceService);
                const badgeService = new BadgeService(canvasAdapter, () => this.settings.enableBadges);
                badgeService.clearCanvasBadgeDom();
            } catch (error) {
                console.error("Failed to clear Canvas badge display:", error);
            }
        });
    }

    async loadSettings() {
        this.settings = await this.storageAdapter.loadSettings();
    }

    async saveSettings() {
        await this.storageAdapter.saveSettings(this.settings);
    }

    async setBadgeDisplayEnabled(enabled: boolean) {
        this.settings.enableBadges = enabled;
        await this.saveSettings();

        if (enabled) {
            void this.loadAllCanvasBadges();
            return;
        }

        this.badgeRenderScheduler.cancelAll();
        this.clearAllCanvasBadgeDom();
    }

    async setPerformanceModeEnabled(enabled: boolean) {
        this.settings.enablePerformanceMode = enabled;
        await this.saveSettings();
        this.syncPerformanceModeClass();
        this.syncCanvasPerformanceMode();
    }

    async setShowEdgesAboveCardsEnabled(enabled: boolean) {
        this.settings.showEdgesAboveCards = enabled;
        await this.saveSettings();
        this.syncCanvasEdgeLayerClass();
    }

    async setCanvasLabelZoomCompensation(value: number) {
        this.settings.canvasLabelZoomCompensation = value;
        await this.saveSettings();
        this.syncCanvasLabelScale();
    }

    private syncPerformanceModeClass(): void {
        activeDocument.body.classList.toggle(
            "canvas-loom-performance-mode",
            this.settings.enablePerformanceMode
        );
    }

    private syncCanvasEdgeLayerClass(): void {
        activeDocument.body.classList.toggle(
            "canvas-loom-edges-above-cards",
            this.settings.showEdgesAboveCards
        );

        if (this.settings.showEdgesAboveCards) {
            this.startCanvasEdgeLayerInteractionObserver();
            this.scheduleCanvasEdgeLayerInteractionRefresh();
            return;
        }

        activeDocument.body.classList.remove("canvas-loom-card-interaction-active");
        this.clearCanvasEdgeLayerRefreshTimeout();
        this.stopCanvasEdgeLayerInteractionObserver();
    }

    private syncCanvasLabelScale(): void {
        this.canvasLabelScaleService.syncCanvasWrappers(this.settings.canvasLabelZoomCompensation);
    }

    private syncCanvasPerformanceMode(): void {
        if (this.settings.enablePerformanceMode) {
            this.canvasPerformanceModeService.syncCanvasWrappers(true);
            this.canvasPerformanceModeService.start();
            return;
        }

        this.canvasPerformanceModeService.stop();
    }

    async setZoomControlEnabled(enabled: boolean) {
        this.settings.enableZoomControl = enabled;
        await this.saveSettings();
        this.syncCanvasZoomControl();
    }

    private syncCanvasZoomControl(): void {
        this.canvasZoomControlService.setEnabled(this.settings.enableZoomControl);
    }

    private registerCanvasEdgeLayerInteractionTracking(): void {
        const scheduleRefresh = () => this.scheduleCanvasEdgeLayerInteractionRefresh();
        const eventNames: Array<keyof DocumentEventMap> = [
            "pointerdown",
            "pointerup",
            "click",
            "dblclick",
            "focusin",
            "focusout",
            "keydown",
            "keyup"
        ];

        eventNames.forEach((eventName) => {
            this.registerDomEvent(activeDocument, eventName, scheduleRefresh, { capture: true });
        });

        this.register(() => this.stopCanvasEdgeLayerInteractionObserver());
    }

    private startCanvasEdgeLayerInteractionObserver(): void {
        this.syncCanvasEdgeLayerInteractionObserverRoot();
    }

    private syncCanvasEdgeLayerInteractionObserverRoot(): void {
        if (!this.settings.showEdgesAboveCards) {
            this.stopCanvasEdgeLayerInteractionObserver();
            return;
        }

        const rootEl = this.resolveActiveCanvasRootEl();
        if (this.canvasEdgeLayerObservedRootEl === rootEl) {
            return;
        }

        this.stopCanvasEdgeLayerInteractionObserver();
        this.canvasEdgeLayerObservedRootEl = rootEl;

        if (!rootEl) {
            return;
        }

        this.canvasEdgeLayerInteractionObserver = new MutationObserver((mutations) => {
            const shouldRefresh = mutations.some((mutation) => {
                return mutation.target.instanceOf(HTMLElement)
                    && (mutation.target.classList.contains("canvas-node")
                        || Boolean(mutation.target.closest(".canvas-node")));
            });

            if (shouldRefresh) {
                this.scheduleCanvasEdgeLayerInteractionRefresh();
            }
        });

        this.canvasEdgeLayerInteractionObserver.observe(rootEl, {
            attributes: true,
            attributeFilter: ["class"],
            subtree: true
        });
    }

    private stopCanvasEdgeLayerInteractionObserver(): void {
        if (!this.canvasEdgeLayerInteractionObserver) {
            return;
        }

        this.canvasEdgeLayerInteractionObserver.disconnect();
        this.canvasEdgeLayerInteractionObserver = null;
        this.canvasEdgeLayerObservedRootEl = null;
    }

    private scheduleCanvasEdgeLayerInteractionRefresh(): void {
        if (!this.settings.showEdgesAboveCards) {
            return;
        }

        this.syncCanvasEdgeLayerInteractionObserverRoot();
        this.clearCanvasEdgeLayerRefreshTimeout();
        this.canvasEdgeLayerRefreshTimeout = window.setTimeout(() => {
            this.canvasEdgeLayerRefreshTimeout = null;
            this.syncCanvasEdgeLayerInteractionClass();
        }, 50);
    }

    private clearCanvasEdgeLayerRefreshTimeout(): void {
        if (this.canvasEdgeLayerRefreshTimeout === null) {
            return;
        }

        window.clearTimeout(this.canvasEdgeLayerRefreshTimeout);
        this.canvasEdgeLayerRefreshTimeout = null;
    }

    private syncCanvasEdgeLayerInteractionClass(): void {
        activeDocument.body.classList.toggle(
            "canvas-loom-card-interaction-active",
            this.hasActiveCanvasCard()
        );
    }

    private hasActiveCanvasCard(): boolean {
        const rootEl = this.resolveActiveCanvasRootEl();
        const activeElement = activeDocument.activeElement;
        if (activeElement?.instanceOf(HTMLElement)
            && (!rootEl || rootEl.contains(activeElement))
            && activeElement.closest(".canvas-node")) {
            return true;
        }

        const queryRoot: ParentNode = rootEl || activeDocument;
        return Boolean(queryRoot.querySelector(
            [
                ".canvas-node.is-selected",
                ".canvas-node.is-focused",
                ".canvas-node.is-editing",
                ".canvas-node .cm-focused",
                ".canvas-node textarea:focus",
                ".canvas-node [contenteditable='true']:focus"
            ].join(", ")
        ));
    }

    private resolveActiveCanvasRootEl(): HTMLElement | null {
        const activeView = this.app.workspace.getActiveViewOfType(View);
        if (!activeView || activeView.getViewType?.() !== "canvas" || !activeView.canvas) {
            return null;
        }

        const wrapperEl = activeView.canvas.wrapperEl;
        if (wrapperEl?.instanceOf(HTMLElement)) {
            return wrapperEl;
        }

        const viewWithContainer = activeView as View & { containerEl?: HTMLElement };
        return viewWithContainer.containerEl?.instanceOf(HTMLElement)
            ? viewWithContainer.containerEl
            : null;
    }

    onunload() {
        this.clearCanvasEdgeLayerRefreshTimeout();
        this.stopCanvasEdgeLayerInteractionObserver();
        this.badgeService?.dispose();
        this.badgeRenderScheduler.cancelAll();
        this.canvasSelectionToolbarService.stop();
        this.canvasGlobalFindReplaceToolbarService.stop();
        this.canvasLabelScaleService.dispose();
        this.canvasPerformanceModeService.stop();
        this.canvasZoomControlService.stop();
        activeDocument.body.classList.remove("canvas-loom-performance-mode");
        activeDocument.body.classList.remove("canvas-loom-edges-above-cards");
        activeDocument.body.classList.remove("canvas-loom-card-interaction-active");
        this.commandRegistry.clear();
        clearTranslationRuntimeContext();
    }

    private registerHotkeys() {
        this.addCommand({
            id: 'find-replace-canvas-cards',
            name: this.translate("commands.findReplaceCanvasCards"),
            checkCallback: (checking: boolean) => {
                const context = this.getActiveCanvasContext();
                if (!context) {
                    return false;
                }

                if (this.shouldIgnoreFindReplaceCommandContext()) {
                    return false;
                }

                if (!checking) {
                    this.canvasGlobalFindReplaceToolbarService.openForActiveCanvas(true);
                }

                return true;
            }
        });

        this.addCommand({
            id: 'open-card-properties',
            name: this.translate("commands.openCardProperties"),
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
                        this.clipboardAdapter,
                        this.settings
                    );
                    void command.execute();
                }

                return true;
            }
        });

        this.addCommand({
            id: 'copy-card-dimensions',
            name: this.translate("commands.copyCardDimensions"),
            checkCallback: (checking: boolean) => {
                const context = this.getActiveCanvasSelectionContext();
                if (!context) {
                    return false;
                }

                if (!checking) {
                    const command = new CopyCardDimensionsCommand(context.selection, this.settings);
                    void command.execute();
                }

                return true;
            }
        });
    }

    private registerSelectionCommands(): void {
        this.registerCanvasSelectionCommand(
            'export-selected-cards-as-image',
            this.translate("commands.exportSelectedCardsAsImage"),
            ({ canvas, selection, file }) => new ExportCardsAsImageCommand(
                this.getOrCreateCanvasServices(canvas).cardImageExportService,
                selection,
                file,
                this.settings
            ),
            ({ selection, file }) => !!file
                && this.hasTextCardSelectionFast(selection)
                && !selection.some((node) => isCanvasNodeEditing(node))
        );

        this.registerCanvasSelectionCommand(
            'quick-copy-selected-cards',
            this.translate("commands.quickCopySelectedCards"),
            ({ selection }) => new QuickCopyCommand(this.contentService, selection, this.settings)
        );

        this.registerCanvasSelectionCommand(
            'quick-merge-selected-cards',
            this.translate("commands.quickMergeSelectedCards"),
            ({ selection }) => new QuickMergeCommand(this.mergeService, selection, this.settings)
        );

        this.registerCanvasSelectionCommand(
            'open-merge-workbench',
            this.translate("commands.openMergeWorkbench"),
            ({ selection, file }) => new OpenPreviewWorkbenchCommand(this.mergeService, selection, file, this.settings)
        );

        this.registerCanvasSelectionCommand(
            'find-replace-selected-canvas-cards',
            this.translate("commands.findReplaceSelectedCanvasCards"),
            ({ selection, file }) => new OpenFindReplaceWorkbenchCommand(this.mergeService, selection, file, this.settings)
        );

        this.registerCanvasSelectionCommand(
            'batch-edit-selected-card-badges',
            this.translate("commands.openSequenceTools"),
            ({ selection, canvas }) => new OpenSequenceToolsCommand(
                () => {
                    this.canvasSelectionToolbarService.openSequenceTools(canvas);
                },
                selection,
                (nodes) => this.hasBadgeEditableSelection(nodes),
                this.settings
            ),
            ({ selection }) => this.hasBadgeEditableSelectionFast(selection)
        );

        this.registerCanvasSelectionCommand(
            'preview-same-color-card-group',
            this.translate("commands.previewSameColorCardGroup"),
            ({ selection, file }) => new OpenSameColorGroupWorkbenchCommand(
                this.colorGroupService,
                this.mergeService,
                selection,
                file,
                this.settings
            ),
            ({ selection }) => this.hasTextCardSelectionFast(selection)
        );

        this.registerCanvasSelectionCommand(
            'merge-selected-cards-to-canvas-card',
            this.translate("commands.mergeSelectedCardsToCanvasCard"),
            ({ selection }) => new MergeToCanvasCardCommand(this.mergeService, selection, this.settings)
        );

        this.registerCanvasSelectionCommand(
            'preview-selected-cards-in-workbench',
            this.translate("commands.previewSelectedCardsInWorkbenchExpanded"),
            ({ selection, file }) => new MergeToSidebarPreviewCommand(this.mergeService, selection, file, this.settings)
        );

        this.registerCanvasSelectionCommand(
            'merge-selected-cards-to-markdown',
            this.translate("commands.mergeSelectedCardsToMarkdown"),
            ({ selection, file }) => new MergeToMarkdownCommand(this.mergeService, selection, file, this.settings)
        );

        this.registerCanvasSelectionCommand(
            'manual-merge-selected-cards',
            this.translate("commands.manualMergeSelectedCards"),
            ({ selection, file }) => new ManualMergeCommand(this.app, this.mergeService, selection, file, this.settings),
            ({ selection }) => selection.length > 1
        );
    }

    private registerCanvasSelectionCommand(
        id: string,
        name: string,
        factory: (context: { canvas: Canvas; selection: CanvasNode[]; file: TFile | null }) => ICommand,
        canExecuteWhileChecking?: (context: { canvas: Canvas; selection: CanvasNode[]; file: TFile | null }) => boolean
    ): void {
        this.addCommand({
            id,
            name,
            checkCallback: (checking: boolean) => {
                const context = this.getActiveCanvasSelectionContext();
                if (!context) {
                    return false;
                }

                if (checking) {
                    return canExecuteWhileChecking ? canExecuteWhileChecking(context) : true;
                }

                this.setupCanvasServices(context.canvas);
                const command = factory({
                    canvas: context.canvas,
                    selection: context.selection,
                    file: context.file
                });

                if (command.canExecute && !command.canExecute()) {
                    return false;
                }

                void command.execute();

                return true;
            }
        });
    }

    private shouldIgnoreFindReplaceCommandContext(): boolean {
        const context = this.getActiveCanvasContext();
        return !context || hasCanvasEditingNode(context.canvas);
    }

    private getActiveCanvasContext(): { canvas: Canvas; selection: CanvasNode[]; file: TFile | null } | null {
        const activeView = this.app.workspace.getActiveViewOfType(View);

        if (!activeView || activeView.getViewType?.() !== 'canvas' || !activeView.canvas) {
            return null;
        }

        const file = activeView.file instanceof TFile ? activeView.file : null;
        return {
            canvas: activeView.canvas,
            selection: Array.from(activeView.canvas.selection || []),
            file
        };
    }

    private getActiveCanvasSelectionContext(): { canvas: Canvas; selection: CanvasNode[]; file: TFile | null } | null {
        const context = this.getActiveCanvasContext();
        if (!context) {
            return null;
        }

        if (context.selection.length === 0) {
            return null;
        }

        return context;
    }

    private resolveNodeMenuSelection(node: CanvasNode): CanvasNode[] {
        const selection = Array.from(node.canvas?.selection || []);
        if (selection.length === 0) {
            return [node];
        }

        return selection.some((selectedNode) => selectedNode.id === node.id) ? selection : [node];
    }

    private hasBadgeEditableSelection(selection: CanvasNode[]): boolean {
        return !!this.badgeService && selection.some((node) => this.badgeService.isValidBadgeNode(node));
    }

    private hasBadgeEditableSelectionFast(selection: CanvasNode[]): boolean {
        return selection.some((node) => this.isBadgeEditableNode(node));
    }

    private isBadgeEditableNode(node: CanvasNode): boolean {
        const nodeData = node.getData?.();
        const isTextCard = node.text !== undefined || nodeData?.type === "text";
        const isMarkdownEmbed = !!node.nodeEl?.querySelector(".markdown-embed");
        return isTextCard || isMarkdownEmbed;
    }

    private hasTextCardSelectionFast(selection: CanvasNode[]): boolean {
        return selection.some((node) => isTextNodeData(node.getData?.()));
    }
}
