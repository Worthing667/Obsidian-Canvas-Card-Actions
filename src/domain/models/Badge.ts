export const BADGE_PATTERN = /^\d+(\.\d+)*$/;

export interface Badge {
    content: string;
}

export class BadgeData {
    constructor(public readonly content: string) {}

    static create(content: string): BadgeData {
        return new BadgeData(BadgeData.normalize(content));
    }

    static normalize(content: string): string {
        return (content || "").trim();
    }

    static isValidContent(content: string): boolean {
        return BADGE_PATTERN.test(BadgeData.normalize(content));
    }

    isEmpty(): boolean {
        return this.content.length === 0;
    }

    isValid(): boolean {
        return BadgeData.isValidContent(this.content);
    }

    toString(): string {
        return this.content;
    }
}
