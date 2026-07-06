#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const CHINESE_PREFIXES = ["新增：", "优化：", "修复：", "移除：", "兼容性：", "说明："];
const ENGLISH_PREFIXES = ["Added:", "Improved:", "Fixed:", "Removed:", "Compatibility:", "Note:"];

const INTERNAL_DETAIL_PATTERNS = [
	{ pattern: /\b(?:src|tests|docs|build|\.github)\/[^\s，。,.]+/, label: "源码或仓库路径" },
	{ pattern: /\b[A-Fa-f0-9]{7,40}\b/, label: "commit hash" },
	{ pattern: /\bPR\s*#\d+\b/i, label: "PR 编号" },
	{ pattern: /#\d+\b/, label: "议题或 PR 编号" },
	{ pattern: /\b[\w.-]+\.(?:ts|tsx|js|mjs|css|json|yml|yaml)\b/, label: "内部文件名" },
];

const CJK_PATTERN = /[\u3400-\u9fff]/;
const ENGLISH_PATTERN = /[A-Za-z]/;

function hasAnyPrefix(text, prefixes) {
	return prefixes.some((prefix) => text.startsWith(prefix));
}

function isHeading(line) {
	return line.startsWith("#");
}

function isBlank(line) {
	return line.trim() === "";
}

function isChineseBullet(line) {
	const text = line.slice(2).trim();
	return CJK_PATTERN.test(text) && hasAnyPrefix(text, CHINESE_PREFIXES);
}

function isEnglishBullet(line) {
	const text = line.slice(2).trim();
	return ENGLISH_PATTERN.test(text) && hasAnyPrefix(text, ENGLISH_PREFIXES);
}

function validateInternalDetails(lines, errors) {
	for (const [index, line] of lines.entries()) {
		for (const { pattern, label } of INTERNAL_DETAIL_PATTERNS) {
			if (pattern.test(line)) {
				errors.push(`第 ${index + 1} 行包含面向维护者的内部细节：${label}`);
			}
		}
	}
}

function validateBulletPairs(lines, errors) {
	let pairCount = 0;

	for (let index = 0; index < lines.length; index += 1) {
		const line = lines[index].trim();

		if (isBlank(line) || isHeading(line)) {
			continue;
		}

		if (!line.startsWith("- ")) {
			errors.push(`第 ${index + 1} 行不是发布说明条目或标题`);
			continue;
		}

		if (!isChineseBullet(line)) {
			errors.push(`第 ${index + 1} 行必须是中文条目，并以 ${CHINESE_PREFIXES.join("、")} 开头`);
			continue;
		}

		const nextLine = lines[index + 1]?.trim() ?? "";
		if (!nextLine.startsWith("- ") || !isEnglishBullet(nextLine)) {
			errors.push(`第 ${index + 1} 行中文条目的下一行必须是英文对照`);
			continue;
		}

		pairCount += 1;
		index += 1;
	}

	if (pairCount === 0) {
		errors.push("发布说明至少需要一组中英逐行对照条目");
	}
}

export function validateReleaseNotesText(text, version) {
	const errors = [];
	const lines = text.replace(/\r\n/g, "\n").split("\n");
	const title = `## Canvas Loom ${version}`;

	if (!lines.some((line) => line.trim() === title)) {
		errors.push(`发布说明必须包含标题：${title}`);
	}

	validateBulletPairs(lines, errors);
	validateInternalDetails(lines, errors);

	return { valid: errors.length === 0, errors };
}

export function resolveReleaseNotesPath(version, cwd = process.cwd()) {
	return path.join(cwd, "docs", "releases", `${version}.md`);
}

function printUsage() {
	console.error("用法：node scripts/validate-release-notes.mjs <version>");
	console.error("示例：node scripts/validate-release-notes.mjs 1.8.4");
}

function main() {
	const version = process.argv[2];
	if (!version) {
		printUsage();
		process.exitCode = 1;
		return;
	}

	const releaseNotesPath = resolveReleaseNotesPath(version);
	if (!fs.existsSync(releaseNotesPath)) {
		console.error(`未找到发布说明：${releaseNotesPath}`);
		process.exitCode = 1;
		return;
	}

	const text = fs.readFileSync(releaseNotesPath, "utf8");
	const result = validateReleaseNotesText(text, version);
	if (!result.valid) {
		console.error(`发布说明格式校验失败：${releaseNotesPath}`);
		for (const error of result.errors) {
			console.error(`- ${error}`);
		}
		process.exitCode = 1;
		return;
	}

	console.log(`发布说明格式校验通过：${releaseNotesPath}`);
}

const currentFilePath = fileURLToPath(import.meta.url);
if (process.argv[1] && path.resolve(process.argv[1]) === currentFilePath) {
	main();
}
