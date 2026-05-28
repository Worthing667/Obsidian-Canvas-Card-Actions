import { ICanvasAdapter } from "../adapters/CanvasAdapter";
import { t } from "../i18n";
import type { CanvasNodeData, CanvasNode } from "../types/canvas";

export interface ColorGroupResult {
    colors: Array<string | null>;
    scopeLabel: string;
    matchedNodes: CanvasNode[];
}

export interface IColorGroupService {
    hasTextCardSelection(selection: CanvasNode[]): boolean;
    getColorGroupFromSelection(selection: CanvasNode[]): ColorGroupResult;
    selectColorGroup(selection: CanvasNode[]): ColorGroupResult;
}

export class ColorGroupService implements IColorGroupService {
    constructor(private canvasAdapter: ICanvasAdapter) {}

    hasTextCardSelection(selection: CanvasNode[]): boolean {
        return this.resolveSelection(selection).some((node) => node.getData().type === "text");
    }

    getColorGroupFromSelection(selection: CanvasNode[]): ColorGroupResult {
        const sourceSelection = this.resolveSelection(selection);
        const colors = this.collectColors(sourceSelection);
        const colorKeys = new Set(colors.map((color) => this.toColorKey(color)));
        const matchedNodes = colorKeys.size === 0
            ? []
            : this.canvasAdapter.getData().nodes
                .filter((nodeData) => this.isMatchedTextNode(nodeData, colorKeys))
                .map((nodeData) => this.canvasAdapter.findNodeById(nodeData.id))
                .filter((node): node is CanvasNode => node !== null);

        return {
            colors,
            scopeLabel: this.buildScopeLabel(colors),
            matchedNodes,
        };
    }

    selectColorGroup(selection: CanvasNode[]): ColorGroupResult {
        const group = this.getColorGroupFromSelection(selection);
        this.canvasAdapter.replaceSelection(group.matchedNodes);
        return group;
    }

    private resolveSelection(selection: CanvasNode[]): CanvasNode[] {
        if (Array.isArray(selection) && selection.length > 0) {
            return selection;
        }

        return this.canvasAdapter.getSelectedNodes();
    }

    private collectColors(selection: CanvasNode[]): Array<string | null> {
        const colors: Array<string | null> = [];
        const seenKeys = new Set<string>();

        selection.forEach((node) => {
            const nodeData = node.getData();
            if (nodeData.type !== "text") {
                return;
            }

            const color = this.normalizeColor(nodeData.color);
            const colorKey = this.toColorKey(color);
            if (seenKeys.has(colorKey)) {
                return;
            }

            seenKeys.add(colorKey);
            colors.push(color);
        });

        return colors;
    }

    private isMatchedTextNode(nodeData: CanvasNodeData, colorKeys: Set<string>): boolean {
        if (nodeData.type !== "text") {
            return false;
        }

        return colorKeys.has(this.toColorKey(this.normalizeColor(nodeData.color)));
    }

    private buildScopeLabel(colors: Array<string | null>): string {
        if (colors.length === 0) {
            return t("workbench.colorGroup.sameColor");
        }

        if (colors.length === 1) {
            return colors[0] ? t("workbench.colorGroup.sameColor") : t("workbench.colorGroup.noColor");
        }

        return t("workbench.colorGroup.multipleColors", { count: colors.length });
    }

    private normalizeColor(color: unknown): string | null {
        if (typeof color !== "string") {
            return null;
        }

        const normalized = color.trim();
        return normalized || null;
    }

    private toColorKey(color: string | null): string {
        return color ?? "__canvas-loom-no-color__";
    }
}
