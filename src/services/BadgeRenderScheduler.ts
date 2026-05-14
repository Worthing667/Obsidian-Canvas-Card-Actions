import { BadgeService } from "./BadgeService";
import { PerformanceService } from "./PerformanceService";

export interface BadgeRenderScheduleOptions {
    key: string;
    badgeService: BadgeService;
    debounceMs: number;
    batchSize: number;
    performanceService?: PerformanceService;
}

export class BadgeRenderScheduler {
    private timers = new Map<string, number>();
    private animationFrames = new Map<string, number>();

    schedule(options: BadgeRenderScheduleOptions): void {
        this.cancel(options.key);

        const timerId = activeWindow.setTimeout(() => {
            this.timers.delete(options.key);
            void this.run(options);
        }, Math.max(0, options.debounceMs));

        this.timers.set(options.key, timerId);
    }

    cancel(key: string): void {
        const timerId = this.timers.get(key);
        if (timerId !== undefined) {
            activeWindow.clearTimeout(timerId);
            this.timers.delete(key);
        }

        const frameId = this.animationFrames.get(key);
        if (frameId !== undefined) {
            activeWindow.cancelAnimationFrame(frameId);
            this.animationFrames.delete(key);
        }
    }

    cancelAll(): void {
        Array.from(this.timers.keys()).forEach((key) => this.cancel(key));
        Array.from(this.animationFrames.keys()).forEach((key) => this.cancel(key));
    }

    private async run(options: BadgeRenderScheduleOptions): Promise<void> {
        await options.performanceService?.measure("loadBadges", () => this.renderBadges(options));

        if (!options.performanceService) {
            await this.renderBadges(options);
        }
    }

    private renderBadges(options: BadgeRenderScheduleOptions): Promise<void> {
        const entries = options.badgeService.getBadgeRenderEntries();
        const activeIds = new Set(entries.map((entry) => entry.id));
        const batchSize = Math.max(1, options.batchSize);
        let index = 0;

        return new Promise((resolve) => {
            const processBatch = () => {
                const end = Math.min(index + batchSize, entries.length);

                while (index < end) {
                    const entry = entries[index];
                    options.badgeService.applyBadgeByNodeId(entry.id, entry.badge);
                    index++;
                }

                if (index < entries.length) {
                    const frameId = activeWindow.requestAnimationFrame(processBatch);
                    this.animationFrames.set(options.key, frameId);
                    return;
                }

                this.animationFrames.delete(options.key);
                options.badgeService.clearStaleBadgeDom(activeIds);
                options.performanceService?.log("loadBadges.summary", {
                    badgeNodeCount: entries.length,
                    batchSize
                });
                resolve();
            };

            processBatch();
        });
    }
}
