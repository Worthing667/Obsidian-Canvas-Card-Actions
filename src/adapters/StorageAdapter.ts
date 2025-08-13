import CardifySettings from "../interface/ICardifySettings";

export interface IStorageAdapter {
    loadSettings(): Promise<CardifySettings>;
    saveSettings(settings: CardifySettings): Promise<void>;
}

export class StorageAdapter implements IStorageAdapter {
    constructor(
        private plugin: any,
        private defaultSettings: CardifySettings
    ) {}

    async loadSettings(): Promise<CardifySettings> {
        try {
            const data = await this.plugin.loadData();
            return Object.assign({}, this.defaultSettings, data);
        } catch (error) {
            console.error("Failed to load settings:", error);
            return this.defaultSettings;
        }
    }

    async saveSettings(settings: CardifySettings): Promise<void> {
        try {
            await this.plugin.saveData(settings);
        } catch (error) {
            console.error("Failed to save settings:", error);
            throw new Error("保存设置失败");
        }
    }
}