import * as assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import {
	SUPPORT_CONTACT_EMAIL,
	getSupportImageSource,
	shouldShowSupportQRCodes,
} from "../src/settings/supportResources";

test("中文界面显示本地收款码，英文界面只保留联系邮箱", () => {
	assert.equal(shouldShowSupportQRCodes("zh-CN"), true);
	assert.equal(shouldShowSupportQRCodes("en"), false);
	assert.equal(SUPPORT_CONTACT_EMAIL, "anitaoskar770@gmail.com");
});

test("收款码只接受打包后的本地 data URL", () => {
	assert.equal(
		getSupportImageSource("data:image/png;base64,abc"),
		"data:image/png;base64,abc"
	);
	assert.equal(getSupportImageSource("https://example.com/wechat.png"), null);
	assert.equal(getSupportImageSource(undefined), null);
});

test("设置页支持二维码尺寸足够扫码", () => {
	const styles = readFileSync("styles.css", "utf8");
	const settingsSource = readFileSync("src/settings/CanvasLoomSettingTab.ts", "utf8");

	assert.match(settingsSource, /setClass\("canvas-loom-support-setting"\)/);
	assert.match(settingsSource, /itemEl\.createDiv\(\{ cls: "canvas-loom-support-qr-label"[\s\S]*?if \(imageSource\)/);
	assert.match(settingsSource, /cls: "canvas-loom-support-qr-image-frame"/);
	assert.match(settingsSource, /canvas-loom-support-qr-image-wechat/);
	assert.match(settingsSource, /canvas-loom-support-qr-image-alipay/);
	assert.match(styles, /\.canvas-loom-support-setting\s*\{[^}]*\bflex-direction:\s*column;[^}]*\balign-items:\s*stretch;/s);
	assert.match(styles, /\.canvas-loom-support-setting\s+\.setting-item-info\s*\{[^}]*\bwidth:\s*100%;/s);
	assert.match(styles, /\.canvas-loom-support-setting\s+\.setting-item-control\s*\{[^}]*\bwidth:\s*100%;/s);
	assert.match(styles, /\.canvas-loom-support-qr-list\s*\{[^}]*\bgrid-template-columns:\s*repeat\(2,\s*minmax\(280px,\s*300px\)\);/s);
	assert.match(styles, /\.canvas-loom-support-qr-list\s*\{[^}]*\bjustify-content:\s*start;/s);
	assert.doesNotMatch(styles, /\.canvas-loom-support-qr-list\s*\{[^}]*\bflex-wrap:\s*wrap;/s);
	assert.match(styles, /\.canvas-loom-support-qr\s*\{[^}]*\bwidth:\s*300px;/s);
	assert.match(styles, /\.canvas-loom-support-qr-image-frame\s*\{[^}]*\bwidth:\s*280px;[^}]*\bheight:\s*280px;/s);
	assert.match(styles, /\.canvas-loom-support-qr-image\s*\{[^}]*\bposition:\s*absolute;/s);
	assert.match(styles, /\.canvas-loom-support-qr-missing\s*\{[^}]*\bwidth:\s*280px;[^}]*\bheight:\s*280px;/s);
});
