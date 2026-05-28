import type { App } from "obsidian";
import { t } from "../../i18n";
import type CanvasLoomSettings from "../../settings/ICanvasLoomSettings";
import type { TranslationKey, TranslationParams } from "../../i18n";

interface CanvasLoomPluginLike {
	settings?: Partial<CanvasLoomSettings>;
}

interface AppWithPlugins extends App {
	plugins?: {
		plugins?: Record<string, CanvasLoomPluginLike>;
	};
}

function getCanvasLoomSettings(app: App): Partial<CanvasLoomSettings> | undefined {
	const plugins = (app as AppWithPlugins).plugins?.plugins;
	return plugins?.["canvas-loom"]?.settings ?? plugins?.["Canvas-Loom"]?.settings;
}

export function modalT(app: App, key: TranslationKey, params?: TranslationParams): string {
	return t(key, params, {
		app,
		settings: getCanvasLoomSettings(app)
	});
}
