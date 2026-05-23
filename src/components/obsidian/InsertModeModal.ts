import { App, Modal, Setting } from 'obsidian';

export class InsertModeModal extends Modal {
	private onSelectRef: () => void;
	private onSelectCopy: () => void;

	constructor(app: App, onSelectRef: () => void, onSelectCopy: () => void) {
		super(app);
		this.onSelectRef = onSelectRef;
		this.onSelectCopy = onSelectCopy;
	}

	onOpen() {
		const { contentEl } = this;

		contentEl.createEl('h3', { text: 'Select insertion mode' });

		new Setting(contentEl)
			.setName('Insert as reference')
			.setDesc(
				'References the same JSON file. Edits in one place are reflected everywhere.'
			)
			.addButton((btn) =>
				btn
					.setButtonText('Reference')
					.setCta()
					.onClick(() => {
						this.close();
						this.onSelectRef();
					})
			);

		new Setting(contentEl)
			.setName('Insert as copy')
			.setDesc('Creates a new independent JSON file. Changes are not shared.')
			.addButton((btn) =>
				btn.setButtonText('Copy').onClick(() => {
					this.close();
					this.onSelectCopy();
				})
			);
	}

	onClose() {
		this.contentEl.empty();
	}
}
