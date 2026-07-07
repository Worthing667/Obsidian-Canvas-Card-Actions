import * as assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

function read(path: string): string {
    return readFileSync(resolve(path), "utf8");
}

test("manifest 保持旧版 Obsidian 可加载", () => {
    const manifest = JSON.parse(read("manifest.json")) as { minAppVersion: string };

    assert.equal(manifest.minAppVersion, "0.16.2");
});

test("manifest 只声明 Obsidian 官方支持的字段", () => {
    const manifest = JSON.parse(read("manifest.json")) as Record<string, unknown>;
    const allowedFields = new Set([
        "id",
        "name",
        "version",
        "minAppVersion",
        "description",
        "author",
        "authorUrl",
        "fundingUrl",
        "isDesktopOnly",
    ]);

    assert.deepEqual(
        Object.keys(manifest).filter((key) => !allowedFields.has(key)),
        []
    );
});

test("源码使用跨窗口安全的 Obsidian DOM API", () => {
    const sourceFiles = [
        "src/adapters/StorageAdapter.ts",
        "src/main.ts",
        "src/services/CanvasGlobalFindReplaceToolbarService.ts",
        "src/services/CanvasLabelScaleService.ts",
        "src/services/CanvasPerformanceModeService.ts",
        "src/services/CanvasSelectionToolbarService.ts",
        "src/services/CanvasZoomControlService.ts",
        "src/utils/CanvasFindHighlight.ts",
        "src/utils/SearchMatchPreview.ts",
    ];
    const source = sourceFiles.map(read).join("\n");

    assert.doesNotMatch(source, /\bglobalThis\b/);
    assert.doesNotMatch(source, /instanceof HTMLElement/);
    assert.doesNotMatch(source, /(^|[^\w.])requestAnimationFrame\(/m);
    assert.doesNotMatch(source, /\|\|\s*document\b/);
});

test("审核指出的静态样式通过 Obsidian 样式 API 或 CSS 声明", () => {
    const settingsSource = read("src/settings/CanvasLoomSettingTab.ts");
    const toolbarSource = read("src/services/CanvasGlobalFindReplaceToolbarService.ts");
    const labelScaleSource = read("src/services/CanvasLabelScaleService.ts");
    const styles = read("styles.css");

    assert.doesNotMatch(settingsSource, /\.style\.width\s*=/);
    assert.match(settingsSource, /addClass\("canvas-loom-setting-number-input"\)/);
    assert.match(styles, /\.canvas-loom-setting-number-input\s*\{[^}]*\bwidth:\s*60px;/s);
    assert.doesNotMatch(toolbarSource, /\.style\.right\s*=\s*["']auto["']/);
    assert.match(styles, /\.canvas-loom-global-fr-panel\s*\{[^}]*\bright:\s*auto;/s);
    assert.match(labelScaleSource, /\.setCssProps\(\{\s*\[ZOOM_MULTIPLIER_PROPERTY\]:\s*target\s*\}\)/);
});

test("设置页提供旧版 Obsidian display fallback 和升级风险提示", () => {
    const settingsSource = read("src/settings/CanvasLoomSettingTab.ts");
    const enSettings = read("src/i18n/dictionaries/en/settings.ts");
    const zhSettings = read("src/i18n/dictionaries/zh-CN/settings.ts");

    assert.match(settingsSource, /\bdisplay\(\): void\s*\{/);
    assert.match(settingsSource, /settings\.compatibilityWarning\.name/);
    assert.match(settingsSource, /settings\.compatibilityWarning\.desc/);
    assert.match(enSettings, /compatibilityWarning/);
    assert.match(zhSettings, /compatibilityWarning/);
});

test("设置页 fallback 不直接调用新版滑块 API", () => {
    const settingsSource = read("src/settings/CanvasLoomSettingTab.ts");

    assert.doesNotMatch(settingsSource, /slider\.setInstant\(/);
    assert.doesNotMatch(settingsSource, /slider\.setDisplayFormat\(/);
    assert.match(settingsSource, /setInstant\?\./);
    assert.match(settingsSource, /setDisplayFormat\?\./);
});

test("审核指出的不必要类型断言不再出现", () => {
    const storageSource = read("src/adapters/StorageAdapter.ts");
    const toolbarSource = read("src/services/CanvasGlobalFindReplaceToolbarService.ts");

    assert.doesNotMatch(storageSource, /data as Record<string, unknown>[\s\S]*as LegacyStorageData/);
    assert.doesNotMatch(toolbarSource, /as SearchReplaceScope/);
});

test("查找替换命令不再声明默认热键，文档同步说明由用户自行配置", () => {
    const mainSource = read("src/main.ts");
    const readme = read("README.md");
    const featureDoc = read("docs/功能-Canvas卡片查找替换.md");

    assert.doesNotMatch(mainSource, /hotkeys\s*:/);
    assert.doesNotMatch(mainSource, /\bPlatform\b/);
    assert.doesNotMatch(readme, /`Ctrl\+F` \(macOS\) hotkey/);
    assert.match(featureDoc, /不设置默认热键/);
    assert.doesNotMatch(featureDoc, /默认热键：macOS 上为 `Control\+F`/);
});
