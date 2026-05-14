import {App, PluginSettingTab, Setting} from "obsidian";
import CanvasLoomPlugin from "../main";
import type { MergeCleanupMode } from "./ICanvasLoomSettings";

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
			.setDesc('输入用于拆分单个画布卡片的分隔符')
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
			.setName('启用标记功能')
			.setDesc('是否在画布卡片上显示标记')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.enableBadges)
				.onChange(async (value) => {
					await this.plugin.setBadgeDisplayEnabled(value);
				}));

		new Setting(containerEl)
			.setName('一键排序方式')
			.setDesc('设置一键复制和一键拼合默认使用的位置或标记顺序')
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
			.setDesc('控制拼合完成后对原始卡片的处理方式')
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
			.setName('大 Canvas 阈值')
			.setDesc('节点数达到该值后，标记加载会使用更保守的分帧策略')
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
			.setName('标记更新防抖时间')
			.setDesc('控制标记 DOM 更新的延迟，单位毫秒')
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
