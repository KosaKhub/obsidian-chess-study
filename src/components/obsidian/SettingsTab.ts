import { App, PluginSettingTab, Setting, normalizePath } from 'obsidian';
import ChessStudyPlugin from 'src/main';

export interface ChessStudyPluginSettings {
	boardOrientation: 'white' | 'black';
	boardColor: 'green' | 'brown';
	viewComments: true | false;
	storagePath: string;
}

export const DEFAULT_SETTINGS: Omit<ChessStudyPluginSettings, 'storagePath'> = {
	boardOrientation: 'white',
	boardColor: 'green',
	viewComments: true,
};

export class SettingsTab extends PluginSettingTab {
	plugin: ChessStudyPlugin;

	constructor(app: App, plugin: ChessStudyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Board orientation')
			.setDesc('Sets the default orientation of the board')
			.addDropdown((dropdown) => {
				dropdown.addOption('white', 'White');
				dropdown.addOption('black', 'Black');

				dropdown
					.setValue(this.plugin.settings.boardOrientation)
					.onChange((orientation) => {
						this.plugin.settings.boardOrientation = orientation as 'white' | 'black';
						this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Board color')
			.setDesc('Sets the default color of the board')
			.addDropdown((dropdown) => {
				dropdown.addOption('green', 'Green');
				dropdown.addOption('brown', 'Brown');

				dropdown
					.setValue(this.plugin.settings.boardColor)
					.onChange((boardColor) => {
						this.plugin.settings.boardColor = boardColor as 'green' | 'brown';
						this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('View Comments')
			.setDesc('Sets the default view of the comments')
			.addDropdown((dropdown) => {
				dropdown.addOption('true', 'True');
				dropdown.addOption('false', 'False');
				dropdown
					.setValue(this.plugin.settings.viewComments.toString())
					.onChange((viewComments) => {
						this.plugin.settings.viewComments = viewComments === 'true';
						this.plugin.saveSettings();
					});
			});

		new Setting(containerEl)
			.setName('Storage folder')
			.setDesc(
				'Folder where chess study JSON files are saved (relative to vault root). ' +
					'Existing files are NOT moved automatically. ' +
					'Tip: a path outside .obsidian/ enables auto-refresh in the sidebar panel.'
			)
			.addText((text) =>
				text
					.setPlaceholder(this.plugin.defaultStoragePath)
					.setValue(this.plugin.settings.storagePath)
					.onChange(async (value) => {
						this.plugin.settings.storagePath = normalizePath(
							value.trim() || this.plugin.defaultStoragePath
						);
						await this.plugin.saveSettings();
					})
			)
			.addButton((btn) =>
				btn.setButtonText('Reset to default').onClick(async () => {
					this.plugin.settings.storagePath = this.plugin.defaultStoragePath;
					await this.plugin.saveSettings();
					this.display();
				})
			);
	}
}
