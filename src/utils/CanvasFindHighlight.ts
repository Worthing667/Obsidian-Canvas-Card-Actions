import { findNthTextMatchIndex } from "./TextMatchLocator";
import type { Canvas } from "../types/canvas";

export const ACTIVE_CARD_CLASS = "canvas-loom-find-active-card";
export const ACTIVE_CARD_PULSE_CLASS = "canvas-loom-find-pulse";
export const ACTIVE_MATCH_CLASS = "canvas-loom-find-active-match";

export interface CanvasFindHighlightMatch {
    card: {
        nodeId: string;
        text?: string;
        x?: number;
        y?: number;
        color?: string;
        badge?: string;
        ranges: Array<{
            start?: number;
            end?: number;
            value: string;
        }>;
    };
    matchIndex: number;
}

export class CanvasFindActiveMatchHighlighter {
    private highlightedNodeEl: HTMLElement | null = null;
    private activeMatchMarkEl: HTMLElement | null = null;
    private highlightPulseTimer: number | null = null;

    apply(canvas: Canvas, match: CanvasFindHighlightMatch): boolean {
        const nodeId = match.card.nodeId;
        const node = canvas.nodes?.get(nodeId) || null;
        const nodeEl = node?.nodeEl || null;
        if (!nodeEl) {
            this.clear();
            return false;
        }

        this.applyToNodeElement(nodeEl, match);
        return true;
    }

    applyToNodeElement(nodeEl: HTMLElement, match: CanvasFindHighlightMatch): void {
        this.clearActiveRenderedMatch();
        this.clearHighlightedCardIfChanged(nodeEl);

        nodeEl.classList.add(ACTIVE_CARD_CLASS);
        nodeEl.classList.remove(ACTIVE_CARD_PULSE_CLASS);
        void nodeEl.offsetWidth;
        nodeEl.classList.add(ACTIVE_CARD_PULSE_CLASS);
        this.highlightedNodeEl = nodeEl;
        this.applyRenderedMatchHighlight(nodeEl, match);

        if (this.highlightPulseTimer !== null) {
            window.clearTimeout(this.highlightPulseTimer);
        }
        this.highlightPulseTimer = window.setTimeout(() => {
            this.highlightPulseTimer = null;
            nodeEl.classList.remove(ACTIVE_CARD_PULSE_CLASS);
        }, 480);
    }

    clear(): void {
        if (this.highlightPulseTimer !== null) {
            window.clearTimeout(this.highlightPulseTimer);
            this.highlightPulseTimer = null;
        }

        this.clearActiveRenderedMatch();
        this.highlightedNodeEl?.classList.remove(ACTIVE_CARD_CLASS);
        this.highlightedNodeEl?.classList.remove(ACTIVE_CARD_PULSE_CLASS);
        this.highlightedNodeEl = null;
    }

    private clearHighlightedCardIfChanged(nodeEl: HTMLElement): void {
        if (!this.highlightedNodeEl || this.highlightedNodeEl === nodeEl) {
            return;
        }

        this.highlightedNodeEl.classList.remove(ACTIVE_CARD_CLASS);
        this.highlightedNodeEl.classList.remove(ACTIVE_CARD_PULSE_CLASS);
    }

    private applyRenderedMatchHighlight(nodeEl: HTMLElement, match: CanvasFindHighlightMatch): void {
        const range = match.card.ranges[match.matchIndex];
        if (!range?.value) {
            return;
        }

        const contentEl = this.getNodeTextContentElement(nodeEl);
        if (!contentEl) {
            return;
        }

        const visibleText = contentEl.textContent || "";
        const sameValueOccurrence = match.card.ranges
            .slice(0, match.matchIndex)
            .filter((item) => item.value === range.value)
            .length;
        const visibleStart = findNthTextMatchIndex(visibleText, range.value, sameValueOccurrence);
        if (visibleStart === -1) {
            return;
        }

        const domRange = this.createDomRangeForTextSpan(contentEl, visibleStart, visibleStart + range.value.length);
        if (!domRange) {
            return;
        }

        const mark = contentEl.ownerDocument.createElement("mark");
        mark.className = ACTIVE_MATCH_CLASS;
        mark.appendChild(domRange.extractContents());
        domRange.insertNode(mark);
        this.activeMatchMarkEl = mark;
        mark.scrollIntoView({ block: "nearest", inline: "nearest" });
    }

    private getNodeTextContentElement(nodeEl: HTMLElement): HTMLElement | null {
        const contentEl = nodeEl.querySelector<HTMLElement>(".canvas-node-content");
        if (contentEl) {
            return contentEl;
        }

        return nodeEl;
    }

    private createDomRangeForTextSpan(rootEl: HTMLElement, start: number, end: number): Range | null {
        const doc = rootEl.ownerDocument;
        const nodeFilter = doc.defaultView?.NodeFilter || NodeFilter;
        const walker = doc.createTreeWalker(rootEl, nodeFilter.SHOW_TEXT);
        let currentOffset = 0;
        let startNode: Text | null = null;
        let endNode: Text | null = null;
        let startOffset = 0;
        let endOffset = 0;

        while (walker.nextNode()) {
            const node = walker.currentNode as Text;
            const nodeTextLength = node.data.length;
            const nodeStart = currentOffset;
            const nodeEnd = currentOffset + nodeTextLength;

            if (!startNode && start >= nodeStart && start <= nodeEnd) {
                startNode = node;
                startOffset = start - nodeStart;
            }

            if (!endNode && end >= nodeStart && end <= nodeEnd) {
                endNode = node;
                endOffset = end - nodeStart;
                break;
            }

            currentOffset = nodeEnd;
        }

        if (!startNode || !endNode) {
            return null;
        }

        const range = doc.createRange();
        range.setStart(startNode, startOffset);
        range.setEnd(endNode, endOffset);
        return range;
    }

    private clearActiveRenderedMatch(): void {
        const mark = this.activeMatchMarkEl;
        if (!mark) {
            return;
        }

        const parent = mark.parentNode;
        if (parent) {
            while (mark.firstChild) {
                parent.insertBefore(mark.firstChild, mark);
            }
            parent.removeChild(mark);
            parent.normalize();
        }

        this.activeMatchMarkEl = null;
    }
}
