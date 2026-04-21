export class BadgeStyleManager {
    private styleEl: HTMLStyleElement | null = null;

    injectStyles(): void {
        // 如果已存在，先移除
        if (this.styleEl && this.styleEl.parentNode) {
            this.styleEl.remove();
        }
        
        this.styleEl = document.createElement("style");
        this.styleEl.id = "canvas-badge-styles";
        
        this.styleEl.textContent = `
            .canvas-node .canvas-node-content[data-badge],
            .markdown-embed[data-badge] {
                position: relative;
                overflow: visible;
            }

            .canvas-node .canvas-node-content[data-badge]::after,
            .canvas-node-content[data-badge]::after,
            .markdown-embed[data-badge]::after {
                content: attr(data-badge);
                position: absolute;
                top: -10px;
                right: -10px;
                min-width: 24px;
                height: 24px;
                padding: 3px 7px;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 12px;
                font-weight: 600;
                line-height: 1;
                color: var(--text-on-accent);
                background: var(--interactive-accent);
                border: 1px solid var(--background-primary);
                border-radius: 999px;
                z-index: 1000;
                box-shadow: 0 2px 6px rgba(0, 0, 0, 0.18);
                white-space: nowrap;
                pointer-events: none;
                font-family: var(--font-interface);
                font-variant-numeric: tabular-nums;
                animation: badge-appear 0.2s ease-out;
            }

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

            .canvas-node.is-selected .canvas-node-content[data-badge]::after {
                z-index: 1001;
            }
        `;
        
        document.head.appendChild(this.styleEl);
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

        this.styleEl = null;
    }
}
