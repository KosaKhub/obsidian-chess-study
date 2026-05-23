import { ItemView, WorkspaceLeaf } from 'obsidian';
import * as React from 'react';
import * as ReactDOM from 'react-dom/client';
import ChessStudyPlugin from 'src/main';
import { SavedGamesList } from '../react/SavedGamesList';

export const SAVED_GAMES_VIEW_TYPE = 'chess-study-saved-games';

export class SavedGamesView extends ItemView {
	private root: ReactDOM.Root;
	private plugin: ChessStudyPlugin;

	constructor(leaf: WorkspaceLeaf, plugin: ChessStudyPlugin) {
		super(leaf);
		this.plugin = plugin;
	}

	getViewType(): string {
		return SAVED_GAMES_VIEW_TYPE;
	}

	getDisplayText(): string {
		return 'Chess Study: Saved Games';
	}

	getIcon(): string {
		return 'library';
	}

	async onOpen(): Promise<void> {
		this.root = ReactDOM.createRoot(this.contentEl);
		this.root.render(
			<React.StrictMode>
				<SavedGamesList
					app={this.app}
					dataAdapter={this.plugin.dataAdapter}
					pluginSettings={this.plugin.settings}
				/>
			</React.StrictMode>
		);
	}

	async onClose(): Promise<void> {
		this.root?.unmount();
	}
}
