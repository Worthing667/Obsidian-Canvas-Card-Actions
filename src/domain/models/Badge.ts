export type BadgeType = 'number' | 'text' | 'emoji';

export interface Badge {
    content: string;
    type: BadgeType;
}

export class BadgeData {
    constructor(
        public readonly content: string,
        public readonly type: BadgeType
    ) {}

    static create(content: string): BadgeData {
        const type = BadgeData.determineBadgeType(content);
        return new BadgeData(content, type);
    }

    static determineBadgeType(content: string): BadgeType {
        if (!content) return 'text';
        
        if (/^\d+$/.test(content)) {
            return 'number';
        } else if (BadgeData.isEmoji(content)) {
            return 'emoji';
        } else {
            return 'text';
        }
    }

    static isEmoji(str: string): boolean {
        const emojiRegex = /^[\u{1F300}-\u{1F9FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{1F900}-\u{1F9FF}\u{1FA70}-\u{1FAFF}\u{1F600}-\u{1F64F}\u{1F680}-\u{1F6FF}]+$/u;
        return emojiRegex.test(str);
    }

    isEmpty(): boolean {
        return !this.content || this.content.trim().length === 0;
    }

    isNumber(): boolean {
        return this.type === 'number';
    }

    isText(): boolean {
        return this.type === 'text';
    }

    isEmoji(): boolean {
        return this.type === 'emoji';
    }

    getNumericValue(): number | null {
        if (this.type === 'number') {
            return parseInt(this.content) || 0;
        }
        return null;
    }

    toString(): string {
        return this.content;
    }
}