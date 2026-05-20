import {App, PluginSettingTab, Setting} from "obsidian";
import CanvasLoomPlugin from "../main";
import {
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

		new Setting(containerEl)
			.setName('设置画布卡片分隔符')
			.setDesc('输入用于拆分单张画布卡片的分隔符，也可在拼合时作为卡片分隔线')
			.addText(text => text
				.setPlaceholder('---')
				.setValue(this.plugin.settings.canvasCardDelimiter)
				.onChange(async (value) => {
					this.plugin.settings.canvasCardDelimiter = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('拼合时插入分隔线')
			.setDesc('开启后，一键复制、拼合、新建文稿和工作台输出会在相邻卡片之间插入当前分隔符')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.insertDelimiterOnMerge)
				.onChange(async (value) => {
					this.plugin.settings.insertDelimiterOnMerge = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('拆分后每行卡片数')
			.setDesc(`控制单张卡片拆分后每行最多排列多少张卡片，包含原卡片。超过数量后会自动换到下一行，并按卡片高度和间距下移。请输入 ${MIN_SPLIT_CARDS_PER_ROW}-${MAX_SPLIT_CARDS_PER_ROW} 的整数。`)
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
			.setName('设置卡片排序优先级')
			.setDesc('选择多张卡片按位置排序时的阅读走向')
			.addDropdown(dropdown => dropdown
				.addOption('yx', '倒 N 排序（从上到下，再从左到右）')
				.addOption('xy', 'Z 字排序（从左到右，再从上到下）')
				.setValue(this.plugin.settings.sortPriority)
				.onChange(async (value: 'yx' | 'xy') => {
					this.plugin.settings.sortPriority = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('启用标记显示')
			.setDesc('在画布卡片右上角显示数字标记，关闭后不会删除已有标记')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableBadges)
				.onChange(async (value) => {
					await this.plugin.setBadgeDisplayEnabled(value);
				}));

		new Setting(containerEl)
			.setName('一键排序方式')
			.setDesc('设置一键复制、一键拼合默认按位置还是按标记处理')
			.addDropdown(dropdown => dropdown
				.addOption('position', '按位置顺序')
				.addOption('badge', '按标记顺序')
				.setValue(this.plugin.settings.defaultSortMode)
				.onChange(async (value: 'position' | 'badge') => {
					this.plugin.settings.defaultSortMode = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('拼合后处理方式')
			.setDesc('设置一键拼合后是否保留原卡片')
			.addDropdown(dropdown => dropdown
				.addOption('keep-source', '拼合后新建卡片（保留原卡片）')
				.addOption('delete-source', '拼合后新建并删除原卡片')
				.setValue(this.plugin.settings.mergeCleanupMode)
				.onChange(async (value: MergeCleanupMode) => {
					this.plugin.settings.mergeCleanupMode = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('启用 Canvas 性能模式')
			.setDesc('减少 Canvas-Loom 在大型 Canvas 中的附加渲染开销')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enablePerformanceMode)
				.onChange(async (value) => {
					await this.plugin.setPerformanceModeEnabled(value);
				}));

		new Setting(containerEl)
			.setName('启用性能诊断日志')
			.setDesc('在开发者控制台输出 Canvas-Loom 操作耗时和节点统计')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enablePerformanceDiagnostics)
				.onChange(async (value) => {
					this.plugin.settings.enablePerformanceDiagnostics = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('大 Canvas 判定数量')
			.setDesc('节点数达到该值后，标记加载会分批处理')
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
			.setName('标记刷新延迟')
			.setDesc('控制标记显示刷新的等待时间，单位毫秒')
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
