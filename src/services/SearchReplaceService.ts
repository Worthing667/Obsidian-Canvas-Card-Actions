import { ICanvasAdapter } from "../adapters/CanvasAdapter";
import { PositionSortStrategy } from "../domain/strategies";
import { t } from "../i18n";
import type { CardSnapshot } from "../types/WorkbenchState";
import type { CanvasNodeData } from "../types/canvas";

export type SearchReplaceScope = "canvas" | "selection";

export interface SearchReplaceQueryOptions {
    query: string;
    scope: SearchReplaceScope;
    selectedNodeIds?: Set<string>;
    caseSensitive: boolean;
    regex: boolean;
}

export interface SearchReplaceOptions extends SearchReplaceQueryOptions {
    replacement: string;
}

export interface SearchMatchRange {
    start: number;
    end: number;
    value: string;
}

export interface CardSearchResult {
    nodeId: string;
    text: string;
    x: number;
    y: number;
    color?: string;
    badge?: string;
    ranges: SearchMatchRange[];
}

export interface SearchReplaceResult {
    cards: CardSearchResult[];
    totalCards: number;
    totalMatches: number;
    error?: string;
}

export interface ReplaceTarget {
    nodeId: string;
    matchIndex: number;
}

export interface ReplaceResult {
    matchedCount: number;
    changedCount: number;
    changedNodeCount: number;
    error?: string;
}

interface CompiledSearchPattern {
    pattern: RegExp | null;
    error?: string;
}

interface TextReplacementPlan {
    text: string;
    matchedCount: number;
}

export class SearchReplaceService {
    constructor(private canvasAdapter: ICanvasAdapter) {}

    hasTextCards(selectedNodeIds?: Set<string>): boolean {
        const scope: SearchReplaceScope = selectedNodeIds && selectedNodeIds.size > 0 ? "selection" : "canvas";
        return this.getSearchableNodes({ scope, selectedNodeIds }).length > 0;
    }

    getTextCardSnapshots(nodeIds?: Set<string>): CardSnapshot[] {
        return (this.canvasAdapter.getData().nodes || [])
            .filter((nodeData) => {
                if (nodeData.type !== "text" || typeof nodeData.text !== "string") {
                    return false;
                }

                return !nodeIds || nodeIds.has(nodeData.id);
            })
            .map((nodeData) => ({
                id: nodeData.id,
                text: nodeData.text || "",
                x: nodeData.x ?? 0,
                y: nodeData.y ?? 0,
                width: nodeData.width ?? 400,
                height: nodeData.height ?? 400,
                color: typeof nodeData.color === "string" ? nodeData.color : undefined,
                badge: typeof nodeData.badge === "string" ? nodeData.badge : undefined,
            }));
    }

    findMatches(options: SearchReplaceQueryOptions): SearchReplaceResult {
        const compiled = this.compilePattern(options);
        if (compiled.error) {
            return {
                cards: [],
                totalCards: 0,
                totalMatches: 0,
                error: compiled.error
            };
        }

        if (!compiled.pattern) {
            return {
                cards: [],
                totalCards: this.getSearchableNodes(options).length,
                totalMatches: 0
            };
        }

        const cards = this.getSearchableNodes(options)
            .map((nodeData) => this.createCardResult(nodeData, compiled.pattern as RegExp))
            .filter((result): result is CardSearchResult => !!result);

        const sorter = new PositionSortStrategy("yx", 10);
        const orderedCards = sorter.sort(cards);

        return {
            cards: orderedCards,
            totalCards: this.getSearchableNodes(options).length,
            totalMatches: orderedCards.reduce((total, card) => total + card.ranges.length, 0)
        };
    }

    async replaceAll(options: SearchReplaceOptions): Promise<ReplaceResult> {
        return this.applyReplacement(options, () => true);
    }

    async replaceInCard(options: SearchReplaceOptions, nodeId: string): Promise<ReplaceResult> {
        return this.applyReplacement(options, (nodeData) => nodeData.id === nodeId);
    }

    async replaceCurrent(options: SearchReplaceOptions, target: ReplaceTarget): Promise<ReplaceResult> {
        return this.applyReplacement(options, (nodeData) => nodeData.id === target.nodeId, target);
    }

    selectNode(nodeId: string): boolean {
        const node = this.canvasAdapter.findNodeById(nodeId);
        if (!node) {
            return false;
        }

        this.canvasAdapter.replaceSelection([node]);
        return true;
    }

    locateNode(nodeId: string): boolean {
        const locator = this.canvasAdapter as ICanvasAdapter & {
            locateNode?: (id: string) => boolean;
        };

        return typeof locator.locateNode === "function"
            ? locator.locateNode(nodeId)
            : false;
    }

    private async applyReplacement(
        options: SearchReplaceOptions,
        includeNode: (nodeData: CanvasNodeData) => boolean,
        target?: ReplaceTarget
    ): Promise<ReplaceResult> {
        const compiled = this.compilePattern(options);
        if (compiled.error) {
            return {
                matchedCount: 0,
                changedCount: 0,
                changedNodeCount: 0,
                error: compiled.error
            };
        }

        if (!compiled.pattern) {
            return {
                matchedCount: 0,
                changedCount: 0,
                changedNodeCount: 0
            };
        }

        const updates = new Map<string, string>();
        let matchedCount = 0;
        let changedCount = 0;

        this.getSearchableNodes(options).forEach((nodeData) => {
            if (!includeNode(nodeData) || typeof nodeData.text !== "string") {
                return;
            }

            const plan = target && nodeData.id === target.nodeId
                ? this.replaceOneMatch(nodeData.text, compiled.pattern as RegExp, target.matchIndex, options)
                : this.replaceAllInText(nodeData.text, compiled.pattern as RegExp, options);

            matchedCount += plan.matchedCount;
            if (plan.text !== nodeData.text) {
                updates.set(nodeData.id, plan.text);
                changedCount += plan.matchedCount;
            }
        });

        if (updates.size === 0) {
            return {
                matchedCount,
                changedCount: 0,
                changedNodeCount: 0
            };
        }

        await this.canvasAdapter.mutateData((canvasData) => {
            canvasData.nodes = canvasData.nodes.map((nodeData) => {
                const updatedText = updates.get(nodeData.id);
                return updatedText === undefined
                    ? nodeData
                    : { ...nodeData, text: updatedText };
            });
        });
        await this.canvasAdapter.requestSave();

        return {
            matchedCount,
            changedCount,
            changedNodeCount: updates.size
        };
    }

    private getSearchableNodes(options: Pick<SearchReplaceQueryOptions, "scope" | "selectedNodeIds">): CanvasNodeData[] {
        const selectedNodeIds = options.selectedNodeIds || new Set<string>();
        return (this.canvasAdapter.getData().nodes || []).filter((nodeData) => {
            if (nodeData.type !== "text" || typeof nodeData.text !== "string") {
                return false;
            }

            if (options.scope === "selection") {
                return selectedNodeIds.has(nodeData.id);
            }

            return true;
        });
    }

    private createCardResult(nodeData: CanvasNodeData, pattern: RegExp): CardSearchResult | null {
        const text = nodeData.text || "";
        const ranges = this.findRanges(text, pattern);

        if (ranges.length === 0) {
            return null;
        }

        return {
            nodeId: nodeData.id,
            text,
            x: nodeData.x ?? 0,
            y: nodeData.y ?? 0,
            color: typeof nodeData.color === "string" ? nodeData.color : undefined,
            badge: typeof nodeData.badge === "string" ? nodeData.badge : undefined,
            ranges
        };
    }

    private findRanges(text: string, pattern: RegExp): SearchMatchRange[] {
        const ranges: SearchMatchRange[] = [];
        pattern.lastIndex = 0;

        let match: RegExpExecArray | null;
        while ((match = pattern.exec(text)) !== null) {
            if (match[0].length === 0) {
                break;
            }

            ranges.push({
                start: match.index,
                end: match.index + match[0].length,
                value: match[0]
            });
        }

        pattern.lastIndex = 0;
        return ranges;
    }

    private replaceAllInText(text: string, pattern: RegExp, options: SearchReplaceOptions): TextReplacementPlan {
        const ranges = this.findRanges(text, pattern);
        if (ranges.length === 0) {
            return { text, matchedCount: 0 };
        }

        pattern.lastIndex = 0;
        const nextText = options.regex
            ? text.replace(pattern, options.replacement)
            : text.replace(pattern, () => options.replacement);
        pattern.lastIndex = 0;

        return {
            text: nextText,
            matchedCount: ranges.length
        };
    }

    private replaceOneMatch(
        text: string,
        pattern: RegExp,
        targetMatchIndex: number,
        options: SearchReplaceOptions
    ): TextReplacementPlan {
        let currentIndex = 0;
        let matchedCount = 0;
        pattern.lastIndex = 0;

        const nextText = text.replace(pattern, (...args: unknown[]) => {
            const match = String(args[0]);
            const callbackInfo = this.getReplacementCallbackInfo(args);

            if (currentIndex !== targetMatchIndex) {
                currentIndex += 1;
                return match;
            }

            currentIndex += 1;
            matchedCount = 1;
            return options.regex
                ? this.expandRegexReplacement(options.replacement, match, callbackInfo.captures, callbackInfo.fullText, callbackInfo.offset)
                : options.replacement;
        });

        pattern.lastIndex = 0;
        return {
            text: nextText,
            matchedCount
        };
    }

    private getReplacementCallbackInfo(args: unknown[]): { captures: string[]; offset: number; fullText: string } {
        const maybeGroups = args[args.length - 1];
        const hasGroups = typeof maybeGroups === "object" && maybeGroups !== null;
        const fullTextIndex = hasGroups ? args.length - 2 : args.length - 1;
        const offsetIndex = hasGroups ? args.length - 3 : args.length - 2;
        const captureEndIndex = hasGroups ? args.length - 3 : args.length - 2;

        return {
            captures: args.slice(1, captureEndIndex).map((value) => value === undefined ? "" : String(value)),
            offset: Number(args[offsetIndex]) || 0,
            fullText: String(args[fullTextIndex] || "")
        };
    }

    private expandRegexReplacement(
        replacement: string,
        match: string,
        captures: string[],
        fullText: string,
        offset: number
    ): string {
        return replacement.replace(/\$(\$|&|`|'|\d{1,2})/g, (token, marker: string) => {
            if (marker === "$") {
                return "$";
            }
            if (marker === "&") {
                return match;
            }
            if (marker === "`") {
                return fullText.slice(0, offset);
            }
            if (marker === "'") {
                return fullText.slice(offset + match.length);
            }

            const captureIndex = Number(marker) - 1;
            if (Number.isNaN(captureIndex) || captureIndex < 0) {
                return token;
            }

            return captures[captureIndex] ?? "";
        });
    }

    private compilePattern(options: Pick<SearchReplaceQueryOptions, "query" | "caseSensitive" | "regex">): CompiledSearchPattern {
        if (!options.query) {
            return { pattern: null };
        }

        const source = options.regex
            ? options.query
            : this.escapeRegExp(options.query);
        const flags = `g${options.caseSensitive ? "" : "i"}`;

        try {
            const pattern = new RegExp(source, flags);
            if (this.canMatchEmptyString(pattern)) {
                return { pattern: null, error: t("errors.regexCannotMatchEmpty") };
            }

            return { pattern };
        } catch (error) {
            const message = error instanceof Error ? error.message : String(error);
            return { pattern: null, error: t("errors.regexInvalid", { message }) };
        }
    }

    private canMatchEmptyString(pattern: RegExp): boolean {
        const samples = ["", "a", "\n"];

        for (const sample of samples) {
            pattern.lastIndex = 0;
            const match = pattern.exec(sample);
            if (match && match[0].length === 0) {
                pattern.lastIndex = 0;
                return true;
            }
        }

        pattern.lastIndex = 0;
        return false;
    }

    private escapeRegExp(value: string): string {
        return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    }
}
