import { moment, type App } from "obsidian";
import type { CanvasLoomLanguageSetting } from "../settings/ICanvasLoomSettings";

export type ResolvedCanvasLoomLanguage = "en" | "zh-CN";

const LANGUAGE_SETTINGS: CanvasLoomLanguageSetting[] = ["auto", "en", "zh-CN"];

type ObsidianLanguageSource = App & {
	vault?: {
		getConfig?: (key: string) => unknown;
	};
};

export function normalizeLanguageSetting(value: unknown): CanvasLoomLanguageSetting {
	if (typeof value === "string" && LANGUAGE_SETTINGS.includes(value as CanvasLoomLanguageSetting)) {
		return value as CanvasLoomLanguageSetting;
	}

	return "auto";
}

function isChineseLanguage(language: unknown): boolean {
	if (typeof language !== "string") {
		return false;
	}

	const normalizedLanguage = language.trim().toLowerCase().replace(/_/g, "-");
	return normalizedLanguage === "zh" || normalizedLanguage.startsWith("zh-");
}

function isLanguageCandidate(language: unknown): language is string {
	return typeof language === "string" && language.trim().length > 0;
}

function getObsidianLanguageCandidates(app?: App): unknown[] {
	const obsidianLanguage = (app as ObsidianLanguageSource | undefined)?.vault?.getConfig?.("language");
	const momentLanguage = moment.locale();

	return [obsidianLanguage, momentLanguage];
}

function getBrowserLanguageCandidates(): unknown[] {
	const browserLanguages = typeof navigator === "undefined" ? [] : [
		navigator.language,
		...(navigator.languages ?? [])
	];

	return browserLanguages;
}

export function resolveLanguage(setting: unknown, app?: App): ResolvedCanvasLoomLanguage {
	const normalizedSetting = normalizeLanguageSetting(setting);
	if (normalizedSetting !== "auto") {
		return normalizedSetting;
	}

	const obsidianLanguage = getObsidianLanguageCandidates(app).find(isLanguageCandidate);
	if (obsidianLanguage) {
		return isChineseLanguage(obsidianLanguage) ? "zh-CN" : "en";
	}

	return getBrowserLanguageCandidates().some(isChineseLanguage) ? "zh-CN" : "en";
}
