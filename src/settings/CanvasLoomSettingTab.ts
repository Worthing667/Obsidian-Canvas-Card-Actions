import { App, PluginSettingTab, type SettingDefinitionItem } from "obsidian";
import type CanvasLoomPlugin from "../main";
import { normalizeLanguageSetting, t } from "../i18n";
import type { TranslationKey, TranslationParams } from "../i18n";
import {
	MAX_SPLIT_CARDS_PER_ROW,
	MIN_SPLIT_CARDS_PER_ROW,
} from "./ICanvasLoomSettings";

export default class CanvasLoomSettingTab extends PluginSettingTab {
	plugin: CanvasLoomPlugin;

	constructor(app: App, plugin: CanvasLoomPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	getControlValue(key: string): unknown {
		const settings = this.plugin.settings;
		switch (key) {
			case "language":
				return normalizeLanguageSetting(settings.language);
			case "canvasCardDelimiter":
				return settings.canvasCardDelimiter;
			case "insertDelimiterOnMerge":
				return settings.insertDelimiterOnMerge;
			case "splitCardsPerRow":
				return settings.splitCardsPerRow;
			case "sortPriority":
				return settings.sortPriority;
			case "enableBadges":
				return settings.enableBadges;
			case "showEdgesAboveCards":
				return settings.showEdgesAboveCards;
			case "disableCanvasLabelFontSizeRelativeToZoom":
				return settings.disableCanvasLabelFontSizeRelativeToZoom;
			case "defaultSortMode":
				return settings.defaultSortMode;
			case "mergeCleanupMode":
				return settings.mergeCleanupMode;
			case "enablePerformanceMode":
				return settings.enablePerformanceMode;
			case "enablePerformanceDiagnostics":
				return settings.enablePerformanceDiagnostics;
			case "largeCanvasNodeThreshold":
				return settings.largeCanvasNodeThreshold;
			case "badgeUpdateDebounceMs":
				return settings.badgeUpdateDebounceMs;
			case "enableZoomControl":
				return settings.enableZoomControl;
			default:
				return undefined;
		}
	}

	async setControlValue(key: string, value: unknown): Promise<void> {
		switch (key) {
			case "language": {
				this.plugin.settings.language = normalizeLanguageSetting(value);
				await this.plugin.saveSettings();
				this.update();
				return;
			}
			case "enableBadges":
				await this.plugin.setBadgeDisplayEnabled(value as boolean);
				return;
			case "showEdgesAboveCards":
				await this.plugin.setShowEdgesAboveCardsEnabled(value as boolean);
				return;
			case "disableCanvasLabelFontSizeRelativeToZoom":
				await this.plugin.setDisableCanvasLabelFontSizeRelativeToZoomEnabled(value as boolean);
				return;
			case "enablePerformanceMode":
				await this.plugin.setPerformanceModeEnabled(value as boolean);
				return;
			case "enableZoomControl":
				await this.plugin.setZoomControlEnabled(value as boolean);
				return;
			default: {
				const settings = this.plugin.settings as unknown as Record<string, unknown>;
				settings[key] = value;
				await this.plugin.saveSettings();
			}
		}
	}

	getSettingDefinitions(): SettingDefinitionItem[] {
		const translate = (key: TranslationKey, params?: TranslationParams): string => {
			return t(key, params, { settings: this.plugin.settings, app: this.app });
		};

		return [
			{
				name: translate("settings.language.name"),
				desc: translate("settings.language.desc"),
				control: {
					type: "dropdown",
					key: "language",
					options: {
						auto: translate("settings.language.option.auto"),
						en: translate("settings.language.option.en"),
						"zh-CN": translate("settings.language.option.zhCN"),
					},
				},
			},
			{
				name: translate("settings.canvasCardDelimiter.name"),
				desc: translate("settings.canvasCardDelimiter.desc"),
				control: {
					type: "text",
					key: "canvasCardDelimiter",
					placeholder: "---",
				},
			},
			{
				name: translate("settings.insertDelimiterOnMerge.name"),
				desc: translate("settings.insertDelimiterOnMerge.desc"),
				control: {
					type: "toggle",
					key: "insertDelimiterOnMerge",
				},
			},
			{
				name: translate("settings.splitCardsPerRow.name"),
				desc: translate("settings.splitCardsPerRow.desc", {
					min: MIN_SPLIT_CARDS_PER_ROW,
					max: MAX_SPLIT_CARDS_PER_ROW,
				}),
				control: {
					type: "number",
					key: "splitCardsPerRow",
					placeholder: "5",
					min: MIN_SPLIT_CARDS_PER_ROW,
					max: MAX_SPLIT_CARDS_PER_ROW,
					step: 1,
				},
			},
			{
				name: translate("settings.sortPriority.name"),
				desc: translate("settings.sortPriority.desc"),
				control: {
					type: "dropdown",
					key: "sortPriority",
					options: {
						yx: translate("settings.sortPriority.option.yx"),
						xy: translate("settings.sortPriority.option.xy"),
					},
				},
			},
			{
				name: translate("settings.enableBadges.name"),
				desc: translate("settings.enableBadges.desc"),
				control: {
					type: "toggle",
					key: "enableBadges",
				},
			},
			{
				name: translate("settings.showEdgesAboveCards.name"),
				desc: translate("settings.showEdgesAboveCards.desc"),
				control: {
					type: "toggle",
					key: "showEdgesAboveCards",
				},
			},
			{
				name: translate("settings.disableCanvasLabelFontSizeRelativeToZoom.name"),
				desc: translate("settings.disableCanvasLabelFontSizeRelativeToZoom.desc"),
				control: {
					type: "toggle",
					key: "disableCanvasLabelFontSizeRelativeToZoom",
				},
			},
			{
				name: translate("settings.defaultSortMode.name"),
				desc: translate("settings.defaultSortMode.desc"),
				control: {
					type: "dropdown",
					key: "defaultSortMode",
					options: {
						position: translate("settings.defaultSortMode.option.position"),
						badge: translate("settings.defaultSortMode.option.badge"),
					},
				},
			},
			{
				name: translate("settings.mergeCleanupMode.name"),
				desc: translate("settings.mergeCleanupMode.desc"),
				control: {
					type: "dropdown",
					key: "mergeCleanupMode",
					options: {
						"keep-source": translate("settings.mergeCleanupMode.option.keepSource"),
						"delete-source": translate("settings.mergeCleanupMode.option.deleteSource"),
					},
				},
			},
			{
				name: translate("settings.enablePerformanceMode.name"),
				desc: translate("settings.enablePerformanceMode.desc"),
				control: {
					type: "toggle",
					key: "enablePerformanceMode",
				},
			},
			{
				name: translate("settings.enablePerformanceDiagnostics.name"),
				desc: translate("settings.enablePerformanceDiagnostics.desc"),
				control: {
					type: "toggle",
					key: "enablePerformanceDiagnostics",
				},
			},
			{
				name: translate("settings.largeCanvasNodeThreshold.name"),
				desc: translate("settings.largeCanvasNodeThreshold.desc"),
				control: {
					type: "number",
					key: "largeCanvasNodeThreshold",
					placeholder: "80",
					min: 1,
					step: 1,
				},
			},
			{
				name: translate("settings.badgeUpdateDebounceMs.name"),
				desc: translate("settings.badgeUpdateDebounceMs.desc"),
				control: {
					type: "number",
					key: "badgeUpdateDebounceMs",
					placeholder: "150",
					min: 0,
					step: 1,
				},
			},
			{
				name: translate("settings.enableZoomControl.name"),
				desc: translate("settings.enableZoomControl.desc"),
				control: {
					type: "toggle",
					key: "enableZoomControl",
				},
			},
		];
	}
}
