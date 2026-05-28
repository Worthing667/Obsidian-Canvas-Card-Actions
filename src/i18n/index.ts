import type { App } from "obsidian";
import type CanvasLoomSettings from "../settings/ICanvasLoomSettings";
import enDictionary from "./dictionaries/en";
import zhCNDictionary from "./dictionaries/zh-CN";
import { resolveLanguage } from "./language";
import type { TranslationDictionary, TranslationKey, TranslationParams } from "./types";

export { normalizeLanguageSetting, resolveLanguage } from "./language";
export type { ResolvedCanvasLoomLanguage } from "./language";
export type { TranslationKey, TranslationParams } from "./types";

const dictionaries: Record<string, TranslationDictionary> = {
	en: enDictionary,
	"zh-CN": zhCNDictionary
};

function getDictionaryValue(dictionary: TranslationDictionary, key: TranslationKey): string | null {
	const value = key
		.split(".")
		.reduce<unknown>((currentValue, keyPart) => {
			if (!currentValue || typeof currentValue !== "object") {
				return undefined;
			}

			return (currentValue as Record<string, unknown>)[keyPart];
		}, dictionary);

	return typeof value === "string" ? value : null;
}

function interpolate(template: string, params?: TranslationParams): string {
	if (!params) {
		return template;
	}

	return template.replace(/\{(\w+)\}/g, (match, paramName) => {
		const value = params[paramName];
		return value === null || value === undefined ? match : String(value);
	});
}

export function getCurrentLanguage(settings?: Partial<CanvasLoomSettings>, app?: App): keyof typeof dictionaries {
	return resolveLanguage(settings?.language, app);
}

export function t(
	key: TranslationKey,
	params?: TranslationParams,
	options?: {
		settings?: Partial<CanvasLoomSettings>;
		app?: App;
	}
): string {
	const language = getCurrentLanguage(options?.settings, options?.app);
	const dictionary = dictionaries[language] ?? enDictionary;
	const value = getDictionaryValue(dictionary, key) ?? getDictionaryValue(enDictionary, key) ?? key;

	return interpolate(value, params);
}
