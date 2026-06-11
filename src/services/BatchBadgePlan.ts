import { BadgeData } from "../domain/models/Badge";

export type BatchBadgeApplyMode = "all" | "missing";

export function resolveDefaultBatchBadgeMode(
    totalCount: number,
    existingCount: number
): BatchBadgeApplyMode {
    return existingCount > 0 && existingCount < totalCount ? "missing" : "all";
}

export function createBadgeSequence(startBadge: string, count: number): string[] {
    const parts = BadgeData.normalize(startBadge).split(".");
    const lastPart = Number(parts[parts.length - 1]);
    const prefix = parts.slice(0, -1);

    return Array.from({ length: count }, (_, index) => {
        return [...prefix, String(lastPart + index)].join(".");
    });
}
