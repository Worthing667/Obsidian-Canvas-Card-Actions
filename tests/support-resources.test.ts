import * as assert from "node:assert/strict";
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
