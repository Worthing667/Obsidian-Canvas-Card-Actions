import * as assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { test } from "node:test";

function read(path: string): string {
    return readFileSync(resolve(path), "utf8");
}

test("Obsidian API 最低版本覆盖菜单图标接口", () => {
    const manifest = JSON.parse(read("manifest.json")) as { minAppVersion: string };

    assert.equal(manifest.minAppVersion, "1.13.0");
});

test("源码使用跨窗口安全的 Obsidian DOM API", () => {
    const sourceFiles = [
        "src/adapters/StorageAdapter.ts",
        "src/main.ts",
        "src/services/CanvasGlobalFindReplaceToolbarService.ts",
        "src/services/CanvasLabelScaleService.ts",
        "src/services/CanvasPerformanceModeService.ts",
        "src/services/CanvasSelectionToolbarService.ts",
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
    const toolbarSource = read("src/services/CanvasGlobalFindReplaceToolbarService.ts");
    const labelScaleSource = read("src/services/CanvasLabelScaleService.ts");
    const styles = read("styles.css");

    assert.doesNotMatch(toolbarSource, /\.style\.right\s*=\s*["']auto["']/);
    assert.match(styles, /\.canvas-loom-global-fr-panel\s*\{[^}]*\bright:\s*auto;/s);
    assert.match(labelScaleSource, /\.setCssProps\(\{\s*\[ZOOM_MULTIPLIER_PROPERTY\]:\s*target\s*\}\)/);
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
