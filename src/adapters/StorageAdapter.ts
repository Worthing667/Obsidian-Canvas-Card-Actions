import CanvasCardActionsSettings from "../settings/ICanvasCardActionsSettings";

export interface IStorageAdapter {
    loadSettings(): Promise<CanvasCardActionsSettings>;
    saveSettings(settings: CanvasCardActionsSettings): Promise<void>;
}

export class StorageAdapter implements IStorageAdapter {
    constructor(
        private plugin: any,
        private defaultSettings: CanvasCardActionsSettings
    ) {}

    async loadSettings(): Promise<CanvasCardActionsSettings> {
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

    async saveSettings(settings: CanvasCardActionsSettings): Promise<void> {
        try {
            await this.plugin.saveData({ ...settings });
        } catch (error) {
            console.error("Failed to save settings:", error);
            throw new Error("保存设置失败");
        }
    }
}
