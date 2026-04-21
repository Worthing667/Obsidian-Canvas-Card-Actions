import CanvasLoomSettings from "../settings/ICanvasLoomSettings";

export interface IStorageAdapter {
    loadSettings(): Promise<CanvasLoomSettings>;
    saveSettings(settings: CanvasLoomSettings): Promise<void>;
}

export class StorageAdapter implements IStorageAdapter {
    constructor(
        private plugin: any,
        private defaultSettings: CanvasLoomSettings
    ) {}

    async loadSettings(): Promise<CanvasLoomSettings> {
        try {
            const data = await this.plugin.loadData();
            const normalizedData = { ...(data || {}) };

            if (!normalizedData.defaultSortMode && normalizedData.mergeDefaultOrder) {
                normalizedData.defaultSortMode = normalizedData.mergeDefaultOrder;
            }

            delete normalizedData.mergeDefaultOrder;
            return Object.assign({}, this.defaultSettings, normalizedData);
        } catch (error) {
            console.error("Failed to load settings:", error);
            return this.defaultSettings;
        }
    }

    async saveSettings(settings: CanvasLoomSettings): Promise<void> {
        try {
            await this.plugin.saveData({ ...settings });
        } catch (error) {
            console.error("Failed to save settings:", error);
            throw new Error("保存设置失败");
        }
    }
}
