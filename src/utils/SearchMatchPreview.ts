export interface SearchMatchPreviewRange {
    start: number;
    end: number;
    value: string;
}

interface SearchMatchPreviewOptions {
    before?: number;
    after?: number;
}

type SearchMatchPreviewPartKind = "context" | "match" | "ellipsis";

interface SearchMatchPreviewPart {
    kind: SearchMatchPreviewPartKind;
    text: string;
}

const DEFAULT_CONTEXT_BEFORE = 36;
const DEFAULT_CONTEXT_AFTER = 56;

export function buildSearchMatchPreviewParts(
    text: string,
    range: SearchMatchPreviewRange,
    options: SearchMatchPreviewOptions = {}
): SearchMatchPreviewPart[] {
    const before = Math.max(0, options.before ?? DEFAULT_CONTEXT_BEFORE);
    const after = Math.max(0, options.after ?? DEFAULT_CONTEXT_AFTER);
    const matchStart = clamp(range.start, 0, text.length);
    const matchEnd = clamp(Math.max(range.end, matchStart), matchStart, text.length);
    const previewStart = Math.max(0, matchStart - before);
    const previewEnd = Math.min(text.length, matchEnd + after);
    const parts: SearchMatchPreviewPart[] = [];

    if (previewStart > 0) {
        parts.push({ kind: "ellipsis", text: "..." });
    }

    appendPart(parts, "context", text.slice(previewStart, matchStart));
    appendPart(parts, "match", range.value || text.slice(matchStart, matchEnd));
    appendPart(parts, "context", text.slice(matchEnd, previewEnd));

    if (previewEnd < text.length) {
        parts.push({ kind: "ellipsis", text: "..." });
    }

    return parts;
}

export function renderSearchMatchPreview(
    container: HTMLElement,
    text: string,
    range: SearchMatchPreviewRange,
    options: SearchMatchPreviewOptions = {}
): void {
    const doc = container.ownerDocument || document;
    const parts = buildSearchMatchPreviewParts(text, range, options);

    parts.forEach((part) => {
        const element = doc.createElement(part.kind === "match" ? "mark" : "span");
        element.textContent = part.text;
        container.appendChild(element);
    });
}

function appendPart(parts: SearchMatchPreviewPart[], kind: SearchMatchPreviewPartKind, text: string): void {
    if (text.length === 0) {
        return;
    }

    parts.push({ kind, text });
}

function clamp(value: number, min: number, max: number): number {
    return Math.min(Math.max(value, min), max);
}
