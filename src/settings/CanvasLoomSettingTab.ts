import {App, PluginSettingTab, Setting} from "obsidian";
import CanvasLoomPlugin from "../main";
import { normalizeLanguageSetting, t } from "../i18n";
import type { TranslationKey, TranslationParams } from "../i18n";
import {
	type CanvasLoomLanguageSetting,
	MAX_SPLIT_CARDS_PER_ROW,
	MIN_SPLIT_CARDS_PER_ROW,
	type MergeCleanupMode
} from "./ICanvasLoomSettings";

export default class CanvasLoomSettingTab extends PluginSettingTab {
	plugin: CanvasLoomPlugin;

	constructor(app: App, plugin: CanvasLoomPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		const translate = (key: TranslationKey, params?: TranslationParams): string => {
			return t(key, params, {settings: this.plugin.settings, app: this.app});
		};

		new Setting(containerEl)
			.setName(translate("settings.language.name"))
			.setDesc(translate("settings.language.desc"))
			.addDropdown(dropdown => dropdown
				.addOption("auto", translate("settings.language.option.auto"))
				.addOption("en", translate("settings.language.option.en"))
				.addOption("zh-CN", translate("settings.language.option.zhCN"))
				.setValue(normalizeLanguageSetting(this.plugin.settings.language))
				.onChange(async (value: CanvasLoomLanguageSetting) => {
					this.plugin.settings.language = normalizeLanguageSetting(value);
					await this.plugin.saveSettings();
					this.display();
				}));

		new Setting(containerEl)
			.setName(translate("settings.canvasCardDelimiter.name"))
			.setDesc(translate("settings.canvasCardDelimiter.desc"))
			.addText(text => text
				.setPlaceholder('---')
				.setValue(this.plugin.settings.canvasCardDelimiter)
				.onChange(async (value) => {
					this.plugin.settings.canvasCardDelimiter = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(translate("settings.insertDelimiterOnMerge.name"))
			.setDesc(translate("settings.insertDelimiterOnMerge.desc"))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.insertDelimiterOnMerge)
				.onChange(async (value) => {
					this.plugin.settings.insertDelimiterOnMerge = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(translate("settings.splitCardsPerRow.name"))
			.setDesc(translate("settings.splitCardsPerRow.desc", {
				min: MIN_SPLIT_CARDS_PER_ROW,
				max: MAX_SPLIT_CARDS_PER_ROW
			}))
			.addText(text => {
				text.inputEl.type = 'number';
				text.inputEl.min = String(MIN_SPLIT_CARDS_PER_ROW);
				text.inputEl.max = String(MAX_SPLIT_CARDS_PER_ROW);
				text.inputEl.step = '1';
				text
					.setPlaceholder('5')
					.setValue(String(this.plugin.settings.splitCardsPerRow))
					.onChange(async (value) => {
						const parsedValue = Number(value);
						if (!Number.isInteger(parsedValue)
							|| parsedValue < MIN_SPLIT_CARDS_PER_ROW
							|| parsedValue > MAX_SPLIT_CARDS_PER_ROW) {
							return;
						}

						this.plugin.settings.splitCardsPerRow = parsedValue;
						await this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName(translate("settings.sortPriority.name"))
			.setDesc(translate("settings.sortPriority.desc"))
			.addDropdown(dropdown => dropdown
				.addOption('yx', translate("settings.sortPriority.option.yx"))
				.addOption('xy', translate("settings.sortPriority.option.xy"))
				.setValue(this.plugin.settings.sortPriority)
				.onChange(async (value: 'yx' | 'xy') => {
					this.plugin.settings.sortPriority = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(translate("settings.enableBadges.name"))
			.setDesc(translate("settings.enableBadges.desc"))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableBadges)
				.onChange(async (value) => {
					await this.plugin.setBadgeDisplayEnabled(value);
				}));

		new Setting(containerEl)
			.setName(translate("settings.showEdgesAboveCards.name"))
			.setDesc(translate("settings.showEdgesAboveCards.desc"))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showEdgesAboveCards)
				.onChange(async (value) => {
					await this.plugin.setShowEdgesAboveCardsEnabled(value);
				}));

		new Setting(containerEl)
			.setName(translate("settings.disableCanvasLabelFontSizeRelativeToZoom.name"))
			.setDesc(translate("settings.disableCanvasLabelFontSizeRelativeToZoom.desc"))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.disableCanvasLabelFontSizeRelativeToZoom)
				.onChange(async (value) => {
					await this.plugin.setDisableCanvasLabelFontSizeRelativeToZoomEnabled(value);
				}));

		new Setting(containerEl)
			.setName(translate("settings.defaultSortMode.name"))
			.setDesc(translate("settings.defaultSortMode.desc"))
			.addDropdown(dropdown => dropdown
				.addOption('position', translate("settings.defaultSortMode.option.position"))
				.addOption('badge', translate("settings.defaultSortMode.option.badge"))
				.setValue(this.plugin.settings.defaultSortMode)
				.onChange(async (value: 'position' | 'badge') => {
					this.plugin.settings.defaultSortMode = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(translate("settings.mergeCleanupMode.name"))
			.setDesc(translate("settings.mergeCleanupMode.desc"))
			.addDropdown(dropdown => dropdown
				.addOption('keep-source', translate("settings.mergeCleanupMode.option.keepSource"))
				.addOption('delete-source', translate("settings.mergeCleanupMode.option.deleteSource"))
				.setValue(this.plugin.settings.mergeCleanupMode)
				.onChange(async (value: MergeCleanupMode) => {
					this.plugin.settings.mergeCleanupMode = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(translate("settings.enablePerformanceMode.name"))
			.setDesc(translate("settings.enablePerformanceMode.desc"))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enablePerformanceMode)
				.onChange(async (value) => {
					await this.plugin.setPerformanceModeEnabled(value);
				}));

		new Setting(containerEl)
			.setName(translate("settings.enablePerformanceDiagnostics.name"))
			.setDesc(translate("settings.enablePerformanceDiagnostics.desc"))
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enablePerformanceDiagnostics)
				.onChange(async (value) => {
					this.plugin.settings.enablePerformanceDiagnostics = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(translate("settings.largeCanvasNodeThreshold.name"))
			.setDesc(translate("settings.largeCanvasNodeThreshold.desc"))
			.addText(text => text
				.setPlaceholder('80')
				.setValue(String(this.plugin.settings.largeCanvasNodeThreshold))
				.onChange(async (value) => {
					const parsedValue = Number(value);
					if (!Number.isFinite(parsedValue) || parsedValue < 1) {
						return;
					}

					this.plugin.settings.largeCanvasNodeThreshold = Math.round(parsedValue);
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName(translate("settings.badgeUpdateDebounceMs.name"))
			.setDesc(translate("settings.badgeUpdateDebounceMs.desc"))
			.addText(text => text
				.setPlaceholder('150')
				.setValue(String(this.plugin.settings.badgeUpdateDebounceMs))
				.onChange(async (value) => {
					const parsedValue = Number(value);
					if (!Number.isFinite(parsedValue) || parsedValue < 0) {
						return;
					}

					this.plugin.settings.badgeUpdateDebounceMs = Math.round(parsedValue);
					await this.plugin.saveSettings();
				}));
	}
}
