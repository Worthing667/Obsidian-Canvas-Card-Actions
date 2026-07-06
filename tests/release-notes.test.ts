import * as assert from "node:assert/strict";
import { test } from "node:test";

async function loadValidator() {
	return import("../scripts/validate-release-notes.mjs");
}

test("发布说明接受中英逐行对照的用户可读条目", async () => {
	const { validateReleaseNotesText } = await loadValidator();
	const result = validateReleaseNotesText(
		[
			"## Canvas Loom 1.8.4",
			"",
			"- 新增：可以在 Canvas 中显示缩放控件。",
			"- Added: Show a zoom control directly in Canvas.",
			"",
			"- 优化：设置页中的支持入口更加清晰。",
			"- Improved: Support links in settings are easier to find.",
			"",
			"- 修复：修正部分 Canvas 场景下标记显示不稳定的问题。",
			"- Fixed: Badges are more reliable in some Canvas views.",
		].join("\n"),
		"1.8.4"
	);

	assert.deepEqual(result.errors, []);
});

test("发布说明要求中文条目下一行必须是英文对照", async () => {
	const { validateReleaseNotesText } = await loadValidator();
	const result = validateReleaseNotesText(
		[
			"## Canvas Loom 1.8.4",
			"",
			"- 新增：可以在 Canvas 中显示缩放控件。",
			"",
			"- 优化：设置页中的支持入口更加清晰。",
			"- Improved: Support links in settings are easier to find.",
		].join("\n"),
		"1.8.4"
	);

	assert.match(result.errors.join("\n"), /英文对照/);
});

test("发布说明拒绝面向维护者的内部细节", async () => {
	const { validateReleaseNotesText } = await loadValidator();
	const result = validateReleaseNotesText(
		[
			"## Canvas Loom 1.8.4",
			"",
			"- 修复：调整 src/settings/CanvasLoomSettingTab.ts 中的实现。",
			"- Fixed: Adjusted implementation in src/settings/CanvasLoomSettingTab.ts.",
			"",
			"- 优化：合并 PR #42 和提交 abc1234。",
			"- Improved: Merged PR #42 and commit abc1234.",
		].join("\n"),
		"1.8.4"
	);

	assert.match(result.errors.join("\n"), /内部细节/);
});
