import * as assert from 'node:assert/strict';
import { StorageAdapter } from '../src/adapters/StorageAdapter';
import type CanvasLoomSettings from '../src/settings/ICanvasLoomSettings';

const DEFAULT_SETTINGS: CanvasLoomSettings = {
  canvasCardDelimiter: '---',
  insertDelimiterOnMerge: false,
  splitCardsPerRow: 5,
  sortPriority: 'yx',
  enableBadges: true,
  showEdgesAboveCards: false,
  defaultSortMode: 'position',
  mergeCleanupMode: 'keep-source',
  enablePerformanceMode: false,
  enablePerformanceDiagnostics: false,
  largeCanvasNodeThreshold: 80,
  badgeUpdateDebounceMs: 150,
};

function customSettings(): CanvasLoomSettings {
  return {
    ...DEFAULT_SETTINGS,
    canvasCardDelimiter: '***',
    insertDelimiterOnMerge: true,
    splitCardsPerRow: 8,
    sortPriority: 'xy',
    enableBadges: false,
    showEdgesAboveCards: true,
    defaultSortMode: 'badge',
    mergeCleanupMode: 'delete-source',
    enablePerformanceMode: true,
    enablePerformanceDiagnostics: true,
    largeCanvasNodeThreshold: 120,
    badgeUpdateDebounceMs: 320,
  };
}

function createMemoryStorage() {
  const values = new Map<string, string>();
  return {
    get length(): number {
      return values.size;
    },
    getItem(key: string): string | null {
      return values.get(key) ?? null;
    },
    key(index: number): string | null {
      return Array.from(values.keys())[index] ?? null;
    },
    setItem(key: string, value: string): void {
      values.set(key, value);
    },
    removeItem(key: string): void {
      values.delete(key);
    },
    clear(): void {
      values.clear();
    },
  };
}

async function testLoadSettingsFallsBackToBackupWhenPluginDataIsMissing() {
  const storage = createMemoryStorage();
  const backupSettings = customSettings();
  storage.setItem('canvas-loom:settings-backup', JSON.stringify(backupSettings));
  (globalThis as typeof globalThis & { localStorage?: typeof storage }).localStorage = storage;

  const plugin = {
    loadData: async () => null,
    saveData: async () => undefined,
  };

  const adapter = new StorageAdapter(plugin as any, DEFAULT_SETTINGS);
  const loadedSettings = await adapter.loadSettings();

  assert.deepEqual(loadedSettings, backupSettings);
}

async function testSaveSettingsAlsoWritesBackup() {
  const storage = createMemoryStorage();
  (globalThis as typeof globalThis & { localStorage?: typeof storage }).localStorage = storage;

  let savedPluginData: CanvasLoomSettings | undefined;
  const plugin = {
    loadData: async () => null,
    saveData: async (settings: CanvasLoomSettings) => {
      savedPluginData = settings;
    },
  };

  const settings = customSettings();
  const adapter = new StorageAdapter(plugin as any, DEFAULT_SETTINGS);
  await adapter.saveSettings(settings);

  assert.deepEqual(savedPluginData, settings);
  assert.equal(storage.getItem('canvas-loom:settings-backup'), JSON.stringify(settings));
}

async function testSaveSettingsUsesVaultScopedBackupKeyWhenAvailable() {
  const storage = createMemoryStorage();
  (globalThis as typeof globalThis & { localStorage?: typeof storage }).localStorage = storage;

  const plugin = {
    manifest: { id: 'canvas-loom' },
    app: { vault: { getName: () => '工作库 A' } },
    loadData: async () => null,
    saveData: async () => undefined,
  };

  const settings = customSettings();
  const adapter = new StorageAdapter(plugin as any, DEFAULT_SETTINGS);
  await adapter.saveSettings(settings);

  assert.equal(
    storage.getItem('canvas-loom:%E5%B7%A5%E4%BD%9C%E5%BA%93%20A:settings-backup'),
    JSON.stringify(settings)
  );
  assert.equal(storage.getItem('canvas-loom:settings-backup'), null);
}

async function testLoadSettingsStillReturnsBackupWhenPluginRehydrateFails() {
  const storage = createMemoryStorage();
  const backupSettings = customSettings();
  storage.setItem('canvas-loom:settings-backup', JSON.stringify(backupSettings));
  (globalThis as typeof globalThis & { localStorage?: typeof storage }).localStorage = storage;

  const plugin = {
    loadData: async () => null,
    saveData: async () => {
      throw new Error('write failed');
    },
  };

  const originalConsoleError = console.error;
  console.error = () => undefined;
  const adapter = new StorageAdapter(plugin as any, DEFAULT_SETTINGS);
  let loadedSettings: CanvasLoomSettings;
  try {
    loadedSettings = await adapter.loadSettings();
  } finally {
    console.error = originalConsoleError;
  }

  assert.deepEqual(loadedSettings, backupSettings);
}

async function testLoadSettingsPrefersBackupWhenPluginDataWasResetToDefaults() {
  const storage = createMemoryStorage();
  const backupSettings = customSettings();
  storage.setItem('canvas-loom:settings-backup', JSON.stringify(backupSettings));
  (globalThis as typeof globalThis & { localStorage?: typeof storage }).localStorage = storage;

  let savedPluginData: CanvasLoomSettings | undefined;
  const plugin = {
    loadData: async () => ({ ...DEFAULT_SETTINGS }),
    saveData: async (settings: CanvasLoomSettings) => {
      savedPluginData = settings;
    },
  };

  const adapter = new StorageAdapter(plugin as any, DEFAULT_SETTINGS);
  const loadedSettings = await adapter.loadSettings();

  assert.deepEqual(loadedSettings, backupSettings);
  assert.deepEqual(savedPluginData, backupSettings);
}

void (async () => {
  await testLoadSettingsFallsBackToBackupWhenPluginDataIsMissing();
  await testSaveSettingsAlsoWritesBackup();
  await testSaveSettingsUsesVaultScopedBackupKeyWhenAvailable();
  await testLoadSettingsStillReturnsBackupWhenPluginRehydrateFails();
  await testLoadSettingsPrefersBackupWhenPluginDataWasResetToDefaults();
  console.log('storage adapter tests passed');
})();
