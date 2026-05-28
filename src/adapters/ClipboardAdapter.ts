import { Notice } from 'obsidian';
import { t } from "../i18n";

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
            console.error('Failed to copy to clipboard:', error);
            return false;
        }
    }

    async writeTextWithNotice(text: string, noticeMessage?: string): Promise<boolean> {
        try {
            const success = await this.writeText(text);
            if (success) {
                new Notice(noticeMessage || t("notice.clipboardContentCopied"));
            } else {
                new Notice(t("notice.clipboardCopyFailed"));
            }
            return success;
        } catch (error) {
            console.error('Failed to copy to clipboard:', error);
            new Notice(t("notice.clipboardCopyFailedWithMessage", {
                message: (error as Error).message
            }));
            return false;
        }
    }
}
