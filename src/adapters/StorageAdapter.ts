import type { Plugin } from "obsidian";
import CanvasLoomSettings from "../settings/ICanvasLoomSettings";

type LegacyStorageData = Partial<CanvasLoomSettings> & {
    mergeDefaultOrder?: CanvasLoomSettings["defaultSortMode"];
};

type StoragePlugin = Pick<Plugin, "loadData" | "saveData"> & {
    manifest?: { id?: string };
    app?: { vault?: { getName?: () => string } };
};

const LEGACY_SETTINGS_BACKUP_KEY = "canvas-loom:settings-backup";

export interface IStorageAdapter {
    loadSettings(): Promise<CanvasLoomSettings>;
    saveSettings(settings: CanvasLoomSettings): Promise<void>;
}

export class StorageAdapter implements IStorageAdapter {
    constructor(
        private plugin: StoragePlugin,
        private defaultSettings: CanvasLoomSettings
    ) {}

    private normalizeLoadedSettings(data: unknown): LegacyStorageData {
        if (!data || typeof data !== "object") {
            return {};
        }

        return { ...(data as Record<string, unknown>) } as LegacyStorageData;
    }

    private getBackupStorage(): Storage | null {
        if (typeof globalThis === "undefined" || !("localStorage" in globalThis)) {
            return null;
        }

        return globalThis.localStorage ?? null;
    }

    private getSettingsBackupKey(): string {
        const pluginId = this.plugin.manifest?.id;
        const vaultName = this.plugin.app?.vault?.getName?.();
        if (!pluginId || !vaultName) {
            return LEGACY_SETTINGS_BACKUP_KEY;
        }

        return `${pluginId}:${encodeURIComponent(vaultName)}:settings-backup`;
    }

    private getSettingsBackupReadKeys(): string[] {
        const backupKey = this.getSettingsBackupKey();
        if (backupKey === LEGACY_SETTINGS_BACKUP_KEY) {
            return [backupKey];
        }

        return [backupKey, LEGACY_SETTINGS_BACKUP_KEY];
    }

    private loadBackupSettings(): LegacyStorageData {
        const storage = this.getBackupStorage();
        if (!storage) {
            return {};
        }

        try {
            const raw = this.getSettingsBackupReadKeys()
                .map((key) => storage.getItem(key))
                .find((value): value is string => !!value);
            if (!raw) {
                return {};
            }

            return this.normalizeLoadedSettings(JSON.parse(raw));
        } catch (error) {
            console.error("Failed to load settings backup:", error);
            return {};
        }
    }

    private saveBackupSettings(settings: CanvasLoomSettings): void {
        const storage = this.getBackupStorage();
        if (!storage) {
            return;
        }

        try {
            storage.setItem(this.getSettingsBackupKey(), JSON.stringify(settings));
        } catch (error) {
            console.error("Failed to save settings backup:", error);
        }
    }

    private migrateLegacySettings(data: LegacyStorageData): LegacyStorageData {
        const migratedData = { ...data };

        if (!migratedData.defaultSortMode && migratedData.mergeDefaultOrder) {
            migratedData.defaultSortMode = migratedData.mergeDefaultOrder;
        }

        delete migratedData.mergeDefaultOrder;
        return migratedData;
    }

    private hasSettingsData(data: LegacyStorageData): boolean {
        return Object.keys(data).length > 0;
    }

    private isDefaultSettings(settings: CanvasLoomSettings): boolean {
        return Object.keys(this.defaultSettings).every((key) => {
            const settingKey = key as keyof CanvasLoomSettings;
            return settings[settingKey] === this.defaultSettings[settingKey];
        });
    }

    private async rehydratePluginSettings(settings: CanvasLoomSettings): Promise<void> {
        try {
            await this.plugin.saveData({ ...settings });
        } catch (error) {
            console.error("Failed to restore settings from backup:", error);
        }
    }

    async loadSettings(): Promise<CanvasLoomSettings> {
        try {
            const pluginData = this.normalizeLoadedSettings(await this.plugin.loadData());
            const backupData = this.loadBackupSettings();
            const hasBackupData = this.hasSettingsData(backupData);
            const hasPluginData = this.hasSettingsData(pluginData);
            const pluginSettings = Object.assign(
                {},
                this.defaultSettings,
                this.migrateLegacySettings(pluginData)
            );
            const shouldRestoreBackup = hasBackupData
                && (!hasPluginData || this.isDefaultSettings(pluginSettings));
            const mergedData = this.migrateLegacySettings(
                shouldRestoreBackup ? backupData : { ...backupData, ...pluginData }
            );
            const settings = Object.assign({}, this.defaultSettings, mergedData);

            if (shouldRestoreBackup) {
                await this.rehydratePluginSettings(settings);
            }

            this.saveBackupSettings(settings);
            return settings;
        } catch (error) {
            console.error("Failed to load settings:", error);
            return this.defaultSettings;
        }
    }

    async saveSettings(settings: CanvasLoomSettings): Promise<void> {
        try {
            await this.plugin.saveData({ ...settings });
            this.saveBackupSettings(settings);
        } catch (error) {
            console.error("Failed to save settings:", error);
            throw new Error("保存设置失败");
        }
    }
}
