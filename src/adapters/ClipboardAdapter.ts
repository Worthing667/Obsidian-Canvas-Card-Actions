import { Notice } from 'obsidian';

export interface IClipboardAdapter {
    writeText(text: string): Promise<boolean>;
    writeTextWithNotice(text: string, noticeMessage?: string): Promise<boolean>;
}

export class ClipboardAdapter implements IClipboardAdapter {
    async writeText(text: string): Promise<boolean> {
        try {
            await navigator.clipboard.writeText(text);
            return true;
        } catch (error) {
            console.error('复制到剪贴板失败:', error);
            return false;
        }
    }

    async writeTextWithNotice(text: string, noticeMessage?: string): Promise<boolean> {
        try {
            const success = await this.writeText(text);
            if (success) {
                new Notice(noticeMessage || '内容已复制到剪贴板');
            } else {
                new Notice('复制到剪贴板失败');
            }
            return success;
        } catch (error) {
            console.error('复制到剪贴板失败:', error);
            new Notice('复制到剪贴板失败: ' + (error as Error).message);
            return false;
        }
    }
}