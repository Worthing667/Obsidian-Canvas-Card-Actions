import {Plugin, Modal, Notice, TFile} from 'obsidian';
import CardifySettings from "./interface/ICardifySettings";
import {copyTextToClipboard} from "./utils/clipboardUtils";
import CardifySettingTab from "./class/CardifySettingTabClass";

const DEFAULT_SETTINGS: CardifySettings = {
	canvasCardDelimiter: '---',
	sortPriority: 'yx',
	enableBadges: true,
}

// Canvas 数据的类型定义
interface CanvasData {
    nodes: CanvasNodeData[];
    edges: CanvasEdgeData[];
}

interface CanvasNodeData {
    id: string;
    type: string;
    text?: string;
    file?: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color?: string;
    // 我们的自定义字段
    badge?: string;
    badgeType?: 'number' | 'text' | 'emoji';
}

interface CanvasEdgeData {
    id: string;
    fromNode: string;
    toNode: string;
    fromSide: string;
    toSide: string;
}

// BadgeModal 类 - 处理徽章输入界面
class BadgeModal extends Modal {
    plugin: Cardify;
    node: any;
    currentBadge: string;

    constructor(plugin: Cardify, node: any, currentBadge: string) {
        super(plugin.app);
        this.plugin = plugin;
        this.node = node;
        this.currentBadge = currentBadge || "";
    }

    onOpen() {
        const { contentEl } = this;
        contentEl.empty();
        
        contentEl.createEl("h2", { text: "设置卡片徽章" });
        
        const inputContainer = contentEl.createDiv();
        inputContainer.createEl("label", { text: "徽章内容（数字、文字或emoji）：" });
        
        const input = inputContainer.createEl("input", {
            type: "text",
            value: this.currentBadge,
            placeholder: "例如: 1, Done, ✅"
        });
        input.style.width = "100%";
        input.style.marginTop = "10px";
        
        const hint = contentEl.createDiv();
        hint.style.fontSize = "0.9em";
        hint.style.color = "var(--text-muted)";
        hint.style.marginTop = "10px";
        hint.setText("提示：徽章会自动保存在 Canvas 文件中");
        
        const buttonContainer = contentEl.createDiv();
        buttonContainer.style.marginTop = "20px";
        buttonContainer.style.display = "flex";
        buttonContainer.style.justifyContent = "flex-end";
        buttonContainer.style.gap = "10px";
        
        const removeButton = buttonContainer.createEl("button", { text: "移除徽章" });
        removeButton.addEventListener("click", async () => {
            await this.setBadge("");
            this.close();
        });
        
        const cancelButton = buttonContainer.createEl("button", { text: "取消" });
        cancelButton.addEventListener("click", () => {
            this.close();
        });
        
        const confirmButton = buttonContainer.createEl("button", { text: "确定" });
        confirmButton.addClass("mod-cta");
        confirmButton.addEventListener("click", async () => {
            await this.setBadge(input.value.trim());
            this.close();
        });
        
        input.addEventListener("keypress", async (e) => {
            if (e.key === "Enter") {
                await this.setBadge(input.value.trim());
                this.close();
            }
        });
        
        input.focus();
        input.select();
    }

    async setBadge(badgeText: string) {
        try {
            // 第一步：更新 DOM（立即显示效果）
            this.updateNodeDOM(this.node, badgeText);
            
            // 第二步：持久化到 Canvas 文件
            await this.plugin.persistBadgeToCanvas(this.node, badgeText);
            
            if (badgeText) {
                new Notice(`徽章已设置: ${badgeText}`);
            } else {
                new Notice("徽章已移除");
            }
        } catch (error) {
            console.error("设置徽章时出错:", error);
            new Notice("设置徽章失败，请查看控制台了解详情");
        }
    }

    updateNodeDOM(node: any, badgeText: string) {
        // 在多个可能的元素上设置属性
        const elementsToUpdate = [
            node.nodeEl?.querySelector('.canvas-node-content'),
            node.nodeEl?.querySelector('.canvas-node-container'),
            node.nodeEl
        ].filter(Boolean);
        
        elementsToUpdate.forEach(element => {
            if (badgeText) {
                element.setAttribute("data-badge", badgeText);
                
                // 判断徽章类型
                const badgeType = this.determineBadgeType(badgeText);
                element.setAttribute("data-badge-type", badgeType);
            } else {
                element.removeAttribute("data-badge");
                element.removeAttribute("data-badge-type");
            }
        });
    }

    determineBadgeType(text: string): 'number' | 'text' | 'emoji' {
        if (/^\d+$/.test(text)) {
            return 'number';
        } else if (this.isEmoji(text)) {
            return 'emoji';
        } else {
            return 'text';
        }
    }

    isEmoji(str: string): boolean {
        const emojiRegex = /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}\u{2000}-\u{206F}\u{2300}-\u{23FF}\u{2B00}-\u{2BFF}\u{3000}-\u{303F}]+$/u;
        return emojiRegex.test(str);
    }

    onClose() {
        const { contentEl } = this;
        contentEl.empty();
    }
}

// 主插件类
export default class Cardify extends Plugin {
	settings: CardifySettings;
    
    private styleEl: HTMLStyleElement | null = null;

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    async onload() {
        console.log("Loading Canvas Card Actions plugin with persistence");

        await this.loadSettings();
        
        // 注册设置页面
        this.addSettingTab(new CardifySettingTab(this.app, this));
        
        // 注入样式
        this.injectStyles();
        
        // 注册右键菜单
        this.registerCanvasMenus();
        
        // 监听 Canvas 事件
        this.registerCanvasEvents();
        
        // 初始化时加载所有徽章
        this.app.workspace.onLayoutReady(() => {
            this.loadAllCanvasBadges();
        });
    }
    
    registerCanvasMenus() {
        // @ts-ignore
        this.registerEvent(this.app.workspace.on("canvas:node-menu", (menu: any, node: any) => {
            this.addBadgeCommand(menu, node);
            this.addSplitCardCommand(menu, node);
            this.addCopyCardContentCommand(menu, node);
        }));

        // @ts-ignore
        this.registerEvent(this.app.workspace.on("canvas:selection-menu", (menu: any, selection: any) => {
            if (selection.size === 1) {
                const node = Array.from(selection)[0];
                this.addBadgeCommand(menu, node);
            }
        }));
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
                this.ensureStylesExist();
            })
        );
    }

    addSplitCardCommand(menu: any, node: any) {
        if (node.text) {
            menu.addItem((item: any) => {
                item
                    .setTitle("按分隔符拆分卡片")
                    .setIcon("split")
                    .onClick(() => {
                        this.splitCard(node);
                    });
            });
        }
    }

    addCopyCardContentCommand(menu: any, node: any) {
        if (node.text) {
            menu.addItem((item: any) => {
                item
                    .setTitle("复制卡片内容")
                    .setIcon("copy")
                    .onClick(() => {
                        copyTextToClipboard(node.text);
                    });
            });
        }
    }

    splitCard(node: any) {
        const canvas = node.canvas;
        const nodeData = node.getData();
        const text = nodeData.text;
        const delimiter = this.settings.canvasCardDelimiter;

        if (!text || !text.includes(delimiter)) {
            new Notice("卡片中未找到分隔符。");
            return;
        }

        const parts = text.split(delimiter).map((p:string) => p.trim()).filter((p:string) => p);
        if (parts.length <= 1) {
            new Notice("没有可拆分的内容。");
            return;
        }

        const canvasData = canvas.getData();
        const originalNodeIndex = canvasData.nodes.findIndex((n: any) => n.id === node.id);

        if (originalNodeIndex === -1) return;

        // Update original node
        canvasData.nodes[originalNodeIndex].text = parts[0];

        const newNodes = [];
        for (let i = 1; i < parts.length; i++) {
            const newNode = {
                ...nodeData,
                id: `${Math.random().toString(36).substr(2, 9)}`,
                x: nodeData.x,
                y: nodeData.y + (nodeData.height + 20) * i,
                text: parts[i],
            };
            newNodes.push(newNode);
        }

        canvasData.nodes.push(...newNodes);
        canvas.setData(canvasData);
        canvas.requestSave();
    }
    
    addBadgeCommand(menu: any, node: any) {
        // 检查是否是可以添加徽章的节点
        const isTextCard = node.text !== undefined;
        const isMarkdownEmbed = node.nodeEl?.querySelector('.markdown-embed') !== null;
        
        if (isTextCard || isMarkdownEmbed) {
            menu.addItem((item: any) => {
                item
                    .setTitle("添加/编辑徽章")
                    .setIcon("tag")
                    .onClick(async () => {
                        const currentBadge = await this.getCurrentBadge(node);
                        new BadgeModal(this, node, currentBadge).open();
                    });
            });
        }
    }
    
    async getCurrentBadge(node: any): Promise<string> {
        // 首先尝试从 Canvas 数据中获取
        try {
            const canvas = node.canvas;
            if (canvas && canvas.getData) {
                const canvasData = canvas.getData();
                const nodeData = canvasData.nodes.find((n: CanvasNodeData) => n.id === node.id);
                if (nodeData && nodeData.badge) {
                    return nodeData.badge;
                }
            }
        } catch (error) {
            console.log("从 Canvas 数据获取徽章失败，尝试从 DOM 获取");
        }
        
        // 降级方案：从 DOM 获取
        const possibleElements = [
            node.nodeEl?.querySelector('.canvas-node-content'),
            node.nodeEl?.querySelector('.canvas-node-container'),
            node.nodeEl
        ].filter(Boolean);
        
        for (const element of possibleElements) {
            const badge = element.getAttribute("data-badge");
            if (badge) {
                return badge;
            }
        }
        
        return "";
    }
    
    async persistBadgeToCanvas(node: any, badgeText: string) {
        const canvas = node.canvas;
        if (!canvas || !canvas.getData || !canvas.setData) {
            console.error("无法访问 Canvas 数据");
            throw new Error("无法访问 Canvas 数据");
        }
        
        // 获取当前 Canvas 的完整数据
        const canvasData = canvas.getData();
        
        // 找到对应的节点数据
        const nodeData = canvasData.nodes.find((n: CanvasNodeData) => n.id === node.id);
        if (!nodeData) {
            console.error("在 Canvas 数据中找不到节点");
            throw new Error("在 Canvas 数据中找不到节点");
        }
        
        // 更新节点数据
        if (badgeText) {
            nodeData.badge = badgeText;
            nodeData.badgeType = this.determineBadgeType(badgeText);
        } else {
            // 移除徽章
            delete nodeData.badge;
            delete nodeData.badgeType;
        }
        
        // 保存修改后的数据回 Canvas
        await canvas.setData(canvasData);
        
        // 请求保存文件
        await canvas.requestSave();
        
        console.log(`徽章已持久化: ${badgeText || '(已移除)'}`);
    }
    
    determineBadgeType(text: string): 'number' | 'text' | 'emoji' {
        if (/^\d+$/.test(text)) {
            return 'number';
        } else if (this.isEmoji(text)) {
            return 'emoji';
        } else {
            return 'text';
        }
    }
    
    isEmoji(str: string): boolean {
        const emojiRegex = /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]+$/u;
        return emojiRegex.test(str);
    }
    
    async loadCanvasBadges(file: TFile) {
        const leaves = this.app.workspace.getLeavesOfType("canvas");
        
        for (const leaf of leaves) {
            const view = leaf.view as any;
            if (view.file?.path === file.path) {
                const canvas = view.canvas;
                if (!canvas) continue;
                
                try {
                    const canvasData = canvas.getData();
                    
                    // 遍历所有节点
                    canvasData.nodes.forEach((nodeData: CanvasNodeData) => {
                        if (nodeData.badge) {
                            // 找到对应的 DOM 节点
                            const node = canvas.nodes?.get(nodeData.id);
                            if (node) {
                                this.applyBadgeToNode(node, nodeData.badge, nodeData.badgeType);
                            }
                        }
                    });
                    
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
    
    applyBadgeToNode(node: any, badgeText: string, badgeType?: string) {
        // 应用徽章到节点的 DOM 元素
        const elementsToUpdate = [
            node.nodeEl?.querySelector('.canvas-node-content'),
            node.nodeEl?.querySelector('.canvas-node-container'),
            node.nodeEl
        ].filter(Boolean);
        
        elementsToUpdate.forEach(element => {
            element.setAttribute("data-badge", badgeText);
            if (badgeType) {
                element.setAttribute("data-badge-type", badgeType);
            } else {
                // 如果没有指定类型，自动判断
                const type = this.determineBadgeType(badgeText);
                element.setAttribute("data-badge-type", type);
            }
        });
    }
    
    ensureStylesExist() {
        if (!document.querySelector('#canvas-badge-styles')) {
            this.injectStyles();
        }
    }
    
    injectStyles() {
        // 如果已存在，先移除
        if (this.styleEl && this.styleEl.parentNode) {
            this.styleEl.remove();
        }
        
        this.styleEl = document.createElement("style");
        this.styleEl.id = "canvas-badge-styles";
        
        // 使用高优先级的 CSS 规则
        this.styleEl.textContent = `
            /* 确保 Canvas 节点内容有相对定位 */
            .canvas-node .canvas-node-content {
                position: relative !important;
            }
            
            /* 主要徽章样式 */
            .canvas-node .canvas-node-content[data-badge]::after,
            .canvas-node-content[data-badge]::after,
            .markdown-embed[data-badge]::after {
                content: attr(data-badge) !important;
                position: absolute !important;
                top: -10px !important;
                right: -10px !important;
                min-width: 24px !important;
                height: 24px !important;
                padding: 3px 7px !important;
                display: flex !important;
                align-items: center !important;
                justify-content: center !important;
                font-size: 12px !important;
                font-weight: bold !important;
                color: white !important;
                background-color: #5865F2 !important;
                border-radius: 12px !important;
                z-index: 1000 !important;
                box-shadow: 0 2px 6px rgba(0, 0, 0, 0.25) !important;
                white-space: nowrap !important;
                pointer-events: none !important;
                line-height: 1 !important;
                font-family: var(--font-interface) !important;
                border: 2px solid var(--background-primary) !important;
                animation: badge-appear 0.2s ease-out !important;
            }
            
            /* 数字徽章 - 完美圆形 */
            .canvas-node-content[data-badge-type="number"]::after {
                background-color: #5865F2 !important;
                border-radius: 50% !important;
                padding: 0 !important;
                min-width: 26px !important;
                height: 26px !important;
            }
            
            /* 文字徽章 - 药丸形状 */
            .canvas-node-content[data-badge-type="text"]::after {
                background-color: #6c757d !important;
                border-radius: 13px !important;
                padding: 3px 10px !important;
                min-width: auto !important;
            }
            
            /* Emoji 徽章 - 无背景 */
            .canvas-node-content[data-badge-type="emoji"]::after {
                background-color: transparent !important;
                box-shadow: none !important;
                border: none !important;
                font-size: 20px !important;
                min-width: auto !important;
                height: auto !important;
                padding: 0 !important;
            }
            
            /* 动画效果 */
            @keyframes badge-appear {
                from {
                    transform: scale(0);
                    opacity: 0;
                }
                to {
                    transform: scale(1);
                    opacity: 1;
                }
            }
            
            /* 确保徽章在节点被选中时仍然可见 */
            .canvas-node.is-selected .canvas-node-content[data-badge]::after {
                z-index: 1001 !important;
            }
            
            /* 暗色主题优化 */
            .theme-dark .canvas-node-content[data-badge]::after {
                box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5) !important;
            }
        `;
        
        document.head.appendChild(this.styleEl);
        console.log("Canvas badge styles injected with persistence support");
    }
    
    onunload() {
        if (this.styleEl && this.styleEl.parentNode) {
            this.styleEl.remove();
        }
        console.log("Canvas Card Actions plugin unloaded");
    }
}
