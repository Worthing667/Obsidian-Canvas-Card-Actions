import { normalizePath, TFile } from "obsidian";

export interface IVaultAdapter {
    createMergedDocument(content: string, canvasFile: TFile, baseName: string): Promise<TFile>;
}

export class VaultAdapter implements IVaultAdapter {
    constructor(private app: any) {}

    async createMergedDocument(content: string, canvasFile: TFile, baseName: string): Promise<TFile> {
        const fileName = `${this.sanitizeFileName(baseName)}-${this.formatTimestamp(new Date())}.md`;
        const parentPath = canvasFile.parent?.path || '';
        const targetPath = normalizePath(parentPath ? `${parentPath}/${fileName}` : fileName);
        const uniquePath = this.ensureUniquePath(targetPath);
        return await this.app.vault.create(uniquePath, content);
    }

    private ensureUniquePath(path: string): string {
        if (!this.app.vault.getAbstractFileByPath(path)) {
            return path;
        }

        const extIndex = path.lastIndexOf('.');
        const base = extIndex > -1 ? path.slice(0, extIndex) : path;
        const ext = extIndex > -1 ? path.slice(extIndex) : '';

        let counter = 1;
        while (this.app.vault.getAbstractFileByPath(`${base}-${counter}${ext}`)) {
            counter += 1;
        }

        return `${base}-${counter}${ext}`;
    }

    private sanitizeFileName(name: string): string {
        const trimmed = (name || '').trim();
        if (!trimmed) {
            return '卡片合并';
        }

        return trimmed.replace(/[\\/:*?"<>|]/g, '-');
    }

    private formatTimestamp(date: Date): string {
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const day = String(date.getDate()).padStart(2, '0');
        const hour = String(date.getHours()).padStart(2, '0');
        const minute = String(date.getMinutes()).padStart(2, '0');
        const second = String(date.getSeconds()).padStart(2, '0');
        return `${year}${month}${day}-${hour}${minute}${second}`;
    }
}
