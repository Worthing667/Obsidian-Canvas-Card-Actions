export class BadgeStyleManager {
    private styleEl: HTMLStyleElement | null = null;

    injectStyles(): void {
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

    ensureStylesExist(): void {
        if (!document.querySelector('#canvas-badge-styles')) {
            this.injectStyles();
        }
    }

    removeStyles(): void {
        if (this.styleEl && this.styleEl.parentNode) {
            this.styleEl.remove();
        }
    }
}