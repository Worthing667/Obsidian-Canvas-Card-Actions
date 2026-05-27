export function findNthTextMatchIndex(text: string, target: string, occurrenceIndex: number): number {
    if (!target || occurrenceIndex < 0) {
        return -1;
    }

    let fromIndex = 0;
    let foundCount = 0;

    while (fromIndex <= text.length) {
        const index = text.indexOf(target, fromIndex);
        if (index === -1) {
            return -1;
        }

        if (foundCount === occurrenceIndex) {
            return index;
        }

        foundCount += 1;
        fromIndex = index + Math.max(1, target.length);
    }

    return -1;
}
