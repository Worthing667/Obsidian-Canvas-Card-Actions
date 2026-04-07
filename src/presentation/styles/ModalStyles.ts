export class ModalStyleManager {
    static injectSharedStyles(): void {
        if (document.getElementById("canvas-card-actions-modal-styles")) return;

        const style = document.createElement("style");
        style.id = "canvas-card-actions-modal-styles";

        style.textContent = `
            /* 统计信息与布局共享 */
            .cca-stats-section {
                background: var(--background-secondary-alt);
                border-radius: 6px;
                padding: 20px;
                margin-bottom: 24px;
                border: 1px solid var(--background-modifier-border);
            }

            .cca-grid-cols-2 {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 20px;
            }

             .cca-grid-cols-3 {
                display: grid;
                grid-template-columns: repeat(3, 1fr);
                gap: 20px;
            }

            .cca-stat-item {
                text-align: center;
            }

            .cca-stat-label {
                font-size: 12px;
                color: var(--text-muted);
                margin-bottom: 4px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }

            .cca-stat-value {
                font-size: 18px;
                font-weight: 600;
                color: var(--text-normal);
                margin-bottom: 2px;
            }

            .cca-stat-value.highlight {
                color: var(--interactive-accent);
            }

            .cca-stat-detail {
                font-size: 13px;
                color: var(--text-faint);
            }

            /* 内容预览区域 */
            .cca-preview-section {
                background: var(--background-secondary-alt);
                border-radius: 6px;
                padding: 16px;
                margin-bottom: 24px;
                border: 1px solid var(--background-modifier-border);
            }

            .cca-section-title {
                font-size: 14px;
                color: var(--text-muted);
                margin-bottom: 12px;
                font-weight: 500;
            }

            /* 控件共享 */
            .cca-control-group {
                display: flex;
                flex-direction: column;
            }

            .cca-control-group label {
                font-size: 13px;
                color: var(--text-muted);
                margin-bottom: 6px;
            }

            .cca-control-group input {
                background: var(--background-primary);
                border: 1px solid var(--background-modifier-border);
                color: var(--text-normal);
                padding: 10px 12px;
                border-radius: 4px;
                font-size: 14px;
                outline: none;
                transition: border-color 0.2s;
            }

            .cca-control-group input:focus {
                border-color: var(--interactive-accent);
            }

            /* 按钮组 */
            .cca-action-footer {
                display: flex;
                gap: 12px;
                padding-top: 20px;
                border-top: 1px solid var(--background-modifier-border);
            }

            .cca-btn {
                flex: 1;
                padding: 12px 16px;
                border: none;
                border-radius: 6px;
                font-size: 14px;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
            }

            .cca-btn-primary {
                background: var(--interactive-accent);
                color: var(--text-on-accent);
            }

            .cca-btn-primary:hover {
                background: var(--interactive-accent-hover);
            }

            .cca-btn-secondary {
                background: var(--background-secondary);
                color: var(--text-muted);
            }

            .cca-btn-secondary:hover {
                background: var(--background-modifier-hover);
                color: var(--text-normal);
            }

            /* 响应式调整 */
            @media (max-width: 640px) {
                .cca-grid-cols-2, .cca-grid-cols-3 {
                    grid-template-columns: 1fr;
                    gap: 16px;
                }
            }
        `;
        document.head.appendChild(style);
    }

    static removeSharedStyles(): void {
        const style = document.getElementById("canvas-card-actions-modal-styles");
        if (style) {
            style.remove();
        }
    }
}
