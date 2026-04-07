import {App, PluginSettingTab, Setting} from "obsidian";
import Cardify from "../main";

export default class CardifySettingTab extends PluginSettingTab {
	plugin: Cardify;

	constructor(app: App, plugin: Cardify) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('设置Canvas卡片分隔符')
			.setDesc('输入用于拆分单个Canvas卡片的分隔符')
			.addText(text => text
				.setPlaceholder('---')
				.setValue(this.plugin.settings.canvasCardDelimiter)
				.onChange(async (value) => {
					this.plugin.settings.canvasCardDelimiter = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('设置卡片排序优先级')
			.setDesc('选择在复制多张卡片时的排序优先级')
			.addDropdown(dropdown => dropdown
				.addOption('yx', '优先按垂直方向排序（从上到下，然后从左到右）')
				.addOption('xy', '优先按水平方向排序（从左到右，然后从上到下）')
				.setValue(this.plugin.settings.sortPriority)
				.onChange(async (value: 'yx' | 'xy') => {
					this.plugin.settings.sortPriority = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('启用徽章功能')
			.setDesc('是否在Canvas卡片上显示徽章')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableBadges)
				.onChange(async (value) => {
					this.plugin.settings.enableBadges = value;
					await this.plugin.saveSettings();
					
					// 如果启用了徽章功能，初始化所有徽章显示
					if (value) {
						this.plugin.loadAllCanvasBadges();
					}
				}));
	}
}
