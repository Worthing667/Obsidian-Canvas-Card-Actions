import { App, PluginSettingTab, Setting } from "obsidian";
import alipaySupportImage from "../../docs/support/alipay.jpg";
import wechatSupportImage from "../../docs/support/wechat.png";
import type CanvasLoomPlugin from "../main";
import { getCurrentLanguage, normalizeLanguageSetting, t } from "../i18n";
import type { TranslationKey, TranslationParams } from "../i18n";
import {
	MAX_SPLIT_CARDS_PER_ROW,
	MIN_SPLIT_CARDS_PER_ROW,
	MIN_CANVAS_LABEL_ZOOM_COMPENSATION,
	MAX_CANVAS_LABEL_ZOOM_COMPENSATION,
} from "./ICanvasLoomSettings";
import {
	SUPPORT_CONTACT_EMAIL,
	getSupportImageSource,
	shouldShowSupportQRCodes,
} from "./supportResources";

type LegacySettingControl =
	| {
			type: "dropdown";
			key: string;
			options: Record<string, string>;
	  }
	| {
			type: "text";
			key: string;
			placeholder?: string;
	  }
	| {
			type: "number";
			key: string;
			placeholder?: string;
			min?: number;
			max?: number;
			step?: number | "any";
	  }
	| {
			type: "toggle";
			key: string;
	  };

type LegacySettingDefinition = {
	name: string;
	desc?: string | DocumentFragment;
	control?: LegacySettingControl;
	render?: (setting: Setting, group: never) => void | (() => void);
};

type LegacySettingGroup = {
	type: "group";
	heading?: string;
	cls?: string;
	items?: LegacySettingDefinition[];
};

type LegacySettingItem = LegacySettingDefinition | LegacySettingGroup;

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
			case "canvasLabelZoomCompensation":
				return settings.canvasLabelZoomCompensation;
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
				this.refreshSettingsTab();
				return;
			}
			case "enableBadges":
				await this.plugin.setBadgeDisplayEnabled(value as boolean);
				return;
			case "showEdgesAboveCards":
				await this.plugin.setShowEdgesAboveCardsEnabled(value as boolean);
				return;
			case "canvasLabelZoomCompensation":
				await this.plugin.setCanvasLabelZoomCompensation(value as number);
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

	private refreshSettingsTab(): void {
		this.display();
	}

	private translate(key: TranslationKey, params?: TranslationParams): string {
		return t(key, params, { settings: this.plugin.settings, app: this.app });
	}

	private getLegacySettingDefinitions(): LegacySettingItem[] {
		return this.getLegacySettingItems();
	}

	private isLegacySettingGroup(definition: LegacySettingItem): definition is LegacySettingGroup {
		return "type" in definition && definition.type === "group";
	}

	private renderLegacySettingGroup(containerEl: HTMLElement, group: LegacySettingGroup): void {
		const groupEl = containerEl.createDiv({
			cls: ["canvas-loom-setting-section", group.cls].filter(Boolean).join(" "),
		});

		if (group.heading) {
			groupEl.createDiv({ cls: "canvas-loom-setting-section-heading", text: group.heading });
		}

		group.items?.forEach((definition) => {
			this.renderLegacySettingDefinition(groupEl, definition);
		});
	}

	private renderLegacySettingItem(containerEl: HTMLElement, definition: LegacySettingItem): void {
		if (this.isLegacySettingGroup(definition)) {
			this.renderLegacySettingGroup(containerEl, definition);
			return;
		}

		this.renderLegacySettingDefinition(containerEl, definition);
	}

	private renderLegacySettingDefinition(containerEl: HTMLElement, definition: LegacySettingDefinition): void {
		const setting = new Setting(containerEl)
			.setName(definition.name)
			.setDesc(definition.desc ?? "");

		if (definition.render) {
			definition.render(setting, undefined as never);
			return;
		}

		if (!definition.control) {
			return;
		}

		switch (definition.control.type) {
			case "dropdown":
				this.renderLegacyDropdown(setting, definition.control);
				return;
			case "text":
				this.renderLegacyText(setting, definition.control);
				return;
			case "number":
				this.renderLegacyNumber(setting, definition.control);
				return;
			case "toggle":
				this.renderLegacyToggle(setting, definition.control);
				return;
		}
	}

	private renderLegacyDropdown(setting: Setting, control: Extract<LegacySettingControl, { type: "dropdown" }>): void {
		setting.addDropdown((dropdown) => {
			Object.entries(control.options).forEach(([value, label]) => {
				dropdown.addOption(value, label);
			});
			dropdown
				.setValue(String(this.getControlValue(control.key) ?? ""))
				.onChange((value) => {
					void this.setControlValue(control.key, value);
				});
		});
	}

	private renderLegacyText(setting: Setting, control: Extract<LegacySettingControl, { type: "text" }>): void {
		setting.addText((text) => {
			text
				.setPlaceholder(control.placeholder ?? "")
				.setValue(String(this.getControlValue(control.key) ?? ""))
				.onChange((value) => {
					void this.setControlValue(control.key, value);
				});
		});
	}

	private renderLegacyNumber(setting: Setting, control: Extract<LegacySettingControl, { type: "number" }>): void {
		setting.addText((text) => {
			text.inputEl.type = "number";
			if (control.min !== undefined) {
				text.inputEl.min = String(control.min);
			}
			if (control.max !== undefined) {
				text.inputEl.max = String(control.max);
			}
			if (control.step !== undefined) {
				text.inputEl.step = String(control.step);
			}

			text
				.setPlaceholder(control.placeholder ?? "")
				.setValue(String(this.getControlValue(control.key) ?? ""))
				.onChange((value) => {
					const parsed = Number(value);
					if (!Number.isFinite(parsed)) {
						return;
					}
					if (control.min !== undefined && parsed < control.min) {
						return;
					}
					if (control.max !== undefined && parsed > control.max) {
						return;
					}

					const nextValue = control.step === "any" ? parsed : Math.round(parsed);
					void this.setControlValue(control.key, nextValue);
				});
		});
	}

	private renderLegacyToggle(setting: Setting, control: Extract<LegacySettingControl, { type: "toggle" }>): void {
		setting.addToggle((toggle) => {
			toggle
				.setValue(Boolean(this.getControlValue(control.key)))
				.onChange((value) => {
					void this.setControlValue(control.key, value);
				});
		});
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		containerEl.addClass("canvas-loom-settings-tab");
		this.getLegacySettingDefinitions().forEach((definition) => {
			this.renderLegacySettingItem(containerEl, definition);
		});
	}

	private renderSupportSetting(setting: Setting): void {
		setting.setClass("canvas-loom-support-setting");

		const translate = (key: TranslationKey, params?: TranslationParams): string => {
			return t(key, params, { settings: this.plugin.settings, app: this.app });
		};
		const language = getCurrentLanguage(this.plugin.settings, this.app);

		if (!shouldShowSupportQRCodes(language)) {
			const contactEl = setting.controlEl.createDiv({ cls: "canvas-loom-support-contact" });
			contactEl.createEl("span", {
				cls: "canvas-loom-support-email",
				text: SUPPORT_CONTACT_EMAIL,
			});
			setting.addButton((button) => {
				button
					.setButtonText(translate("settings.support.contactButton"))
					.onClick(() => {
						activeWindow.open(`mailto:${SUPPORT_CONTACT_EMAIL}`);
					});
			});
			return;
		}

		const qrListEl = setting.controlEl.createDiv({ cls: "canvas-loom-support-qr-list" });
		const assets = [
			{
				label: translate("settings.support.wechat"),
				alt: translate("settings.support.wechatAlt"),
				source: wechatSupportImage,
				imageClass: "canvas-loom-support-qr-image-wechat",
			},
			{
				label: translate("settings.support.alipay"),
				alt: translate("settings.support.alipayAlt"),
				source: alipaySupportImage,
				imageClass: "canvas-loom-support-qr-image-alipay",
			},
		];

		assets.forEach((asset) => {
			const itemEl = qrListEl.createDiv({ cls: "canvas-loom-support-qr" });
			const imageSource = getSupportImageSource(asset.source);
			itemEl.createDiv({ cls: "canvas-loom-support-qr-label", text: asset.label });

			if (imageSource) {
				const imageFrameEl = itemEl.createDiv({ cls: "canvas-loom-support-qr-image-frame" });
				imageFrameEl.createEl("img", {
					cls: `canvas-loom-support-qr-image ${asset.imageClass}`,
					attr: {
						src: imageSource,
						alt: asset.alt,
						loading: "lazy",
					},
				});
			} else {
				itemEl.createDiv({
					cls: "canvas-loom-support-qr-missing",
					text: translate("settings.support.assetMissing"),
				});
			}
		});
	}

	private getLegacySettingItems(): LegacySettingItem[] {
		const translate = (key: TranslationKey, params?: TranslationParams): string => {
			return t(key, params, { settings: this.plugin.settings, app: this.app });
		};

		return [
			{
				name: translate("settings.compatibilityWarning.name"),
				desc: translate("settings.compatibilityWarning.desc"),
			},
			{
				type: "group",
				heading: translate("settings.sections.basic"),
				cls: "canvas-loom-setting-section-basic",
				items: [
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
				],
			},
			{
				type: "group",
				heading: translate("settings.sections.cardProcessing"),
				cls: "canvas-loom-setting-section-card-processing",
				items: [
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
				],
			},
			{
				type: "group",
				heading: translate("settings.sections.canvasDisplay"),
				cls: "canvas-loom-setting-section-canvas-display",
				items: [
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
						name: translate("settings.canvasLabelZoomCompensation.name"),
						desc: translate("settings.canvasLabelZoomCompensation.desc"),
						render: (setting) => {
							const currentValue = this.plugin.settings.canvasLabelZoomCompensation;

							let sliderComponent: import("obsidian").SliderComponent;
							let textComponent: import("obsidian").TextComponent;
							let updating = false;

							setting.addSlider((slider) => {
								sliderComponent = slider;
								slider.setLimits(
									MIN_CANVAS_LABEL_ZOOM_COMPENSATION,
									MAX_CANVAS_LABEL_ZOOM_COMPENSATION,
									1
								);
								slider.setValue(currentValue);
								slider.onChange((value: number) => {
									if (updating) return;
									updating = true;
									textComponent.setValue(String(value));
									updating = false;
									void this.setControlValue("canvasLabelZoomCompensation", value);
								});
							});

							setting.addText((text) => {
								textComponent = text;
								text.setValue(String(currentValue));
								text.setPlaceholder("0-100");
								text.inputEl.type = "number";
								text.inputEl.min = String(MIN_CANVAS_LABEL_ZOOM_COMPENSATION);
								text.inputEl.max = String(MAX_CANVAS_LABEL_ZOOM_COMPENSATION);
								text.inputEl.step = "1";
								text.inputEl.addClass("canvas-loom-setting-number-input");
								text.onChange((value: string) => {
									if (updating) return;
									const parsed = parseInt(value, 10);
									if (isNaN(parsed)) return;
									const clamped = Math.max(
										MIN_CANVAS_LABEL_ZOOM_COMPENSATION,
										Math.min(MAX_CANVAS_LABEL_ZOOM_COMPENSATION, parsed)
									);
									updating = true;
									sliderComponent.setValue(clamped);
									updating = false;
									void this.setControlValue("canvasLabelZoomCompensation", clamped);
								});
							});
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
				],
			},
			{
				type: "group",
				heading: translate("settings.sections.performance"),
				cls: "canvas-loom-setting-section-performance",
				items: [
					{
						name: translate("settings.enablePerformanceMode.name"),
						desc: translate("settings.enablePerformanceMode.desc"),
						control: {
							type: "toggle",
							key: "enablePerformanceMode",
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
						name: translate("settings.enablePerformanceDiagnostics.name"),
						desc: translate("settings.enablePerformanceDiagnostics.desc"),
						control: {
							type: "toggle",
							key: "enablePerformanceDiagnostics",
						},
					},
				],
			},
			{
				type: "group",
				heading: translate("settings.sections.support"),
				cls: "canvas-loom-setting-section-support",
				items: [
					{
						name: translate("settings.support.name"),
						desc: translate("settings.support.desc"),
						render: (setting) => {
							this.renderSupportSetting(setting);
						},
					},
				],
			},
		];
	}
}
