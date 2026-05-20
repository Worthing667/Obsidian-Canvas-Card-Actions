export interface MergedCardContent {
    text: string;
    badge?: string;
}

export interface FormatMergedCardsContentOptions {
    includeBadgePrefix?: boolean;
    cardSeparator?: string | null;
}

export function formatMergedCardsContent(
    cards: MergedCardContent[],
    options: FormatMergedCardsContentOptions = {}
): string {
    const includeBadgePrefix = options.includeBadgePrefix ?? false;
    const joiner = resolveCardJoiner(options.cardSeparator);

    return cards
        .map((card) => includeBadgePrefix && card.badge ? `[${card.badge}] ${card.text}` : card.text)
        .join(joiner);
}

export function resolveCardJoiner(cardSeparator?: string | null): string {
    const normalizedSeparator = cardSeparator?.trim();
    return normalizedSeparator ? `\n\n${normalizedSeparator}\n\n` : "\n\n";
}
