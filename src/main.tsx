import { Editor, Notice, Plugin, WorkspaceLeaf, normalizePath } from 'obsidian';
import { parseChessStringToFileData } from 'src/lib/chess-logic';
import { ChessStudyDataAdapter } from 'src/lib/storage';
import { ReactView } from './components/ReactView';
import { ChessStringModal } from './components/obsidian/ChessStringModal';
import {
	SAVED_GAMES_VIEW_TYPE,
	SavedGamesView,
} from './components/obsidian/SavedGamesView';
import {
	ChessStudyPluginSettings,
	DEFAULT_SETTINGS,
	SettingsTab,
} from './components/obsidian/SettingsTab';

// these styles must be imported somewhere
import 'assets/board/green.css';
import 'chessground/assets/chessground.base.css';
import 'chessground/assets/chessground.brown.css';
import 'chessground/assets/chessground.cburnett.css';
import { parseUserConfig } from './lib/obsidian';
import './main.css';

type FEN = string;
type PGN = string;
export type ChessString = FEN | PGN;

export const ROOT_FEN =
	'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

// TODO:
// 1) Allow to show the root position
// 2) Display correct move after removing the last move

export default class ChessStudyPlugin extends Plugin {
	settings: ChessStudyPluginSettings;
	dataAdapter: ChessStudyDataAdapter;

	get defaultStoragePath(): string {
		return normalizePath(
			`${this.app.vault.configDir}/plugins/${this.manifest.id}/storage`
		);
	}

	async onload() {
		// Load Settings
		await this.loadSettings();

		// Register Saved Games View
		this.registerView(
			SAVED_GAMES_VIEW_TYPE,
			(leaf: WorkspaceLeaf) => new SavedGamesView(leaf, this)
		);

		// Add ribbon icon for Saved Games View
		this.addRibbonIcon('library', 'Chess Study: Saved Games', () =>
			this.openSavedGamesView()
		);

		// Register Data Adapter
		this.dataAdapter = new ChessStudyDataAdapter(
			this.app.vault.adapter,
			this.settings.storagePath
		);

		await this.dataAdapter.createStorageFolderIfNotExists();

		// Add settings tab
		this.addSettingTab(new SettingsTab(this.app, this));

		// Add command to open Saved Games View
		this.addCommand({
			id: 'open-saved-games-view',
			name: 'Open Saved Games View',
			callback: () => this.openSavedGamesView(),
		});

		// Add command
		this.addCommand({
			id: 'insert-chess-study',
			name: 'Insert FEN/PGN-Editor at cursor position',
			editorCallback: (editor: Editor) => {
				const cursorPosition = editor.getCursor();

				const onSubmit = async (chessString: ChessString | undefined) => {
					try {
						const chessStudyFileData = parseChessStringToFileData(chessString ?? '');

						this.dataAdapter.createStorageFolderIfNotExists();

						const id = await this.dataAdapter.saveFile(chessStudyFileData);

						editor.replaceRange(
							`\`\`\`chessStudy\nchessStudyId: ${id}\n\`\`\``,
							cursorPosition
						);
					} catch (e) {
						console.log(e);
						new Notice('There was an error during PGN parsing.', 0);
					}
				};

				new ChessStringModal(this.app, onSubmit).open();
			},
		});

		// Add chess study code block processor
		this.registerMarkdownCodeBlockProcessor(
			'chessStudy',
			async (source, el, ctx) => {
				const { chessStudyId } = parseUserConfig(this.settings, source);

				if (!chessStudyId.trim().length)
					return new Notice(
						"No chessStudyId parameter found, please add one manually if the file already exists or add it via the 'Insert PGN-Editor at cursor position' command.",
						0
					);

				try {
					const data = await this.dataAdapter.loadFile(chessStudyId);

					ctx.addChild(
						new ReactView(el, source, this.app, this.settings, data, this.dataAdapter)
					);
				} catch (e) {
					new Notice(
						`There was an error while trying to load ${chessStudyId}.json. You can check the plugin folder if the file exist and if not add one via the 'Insert PGN-Editor at cursor position' command.`,
						0
					);
				}
			}
		);

		console.log('Chess Study Plugin successfully loaded');
	}

	async onunload() {
		this.app.workspace.detachLeavesOfType(SAVED_GAMES_VIEW_TYPE);
		console.log('Chess Study Plugin successfully unloaded');
	}

	private async openSavedGamesView() {
		const existing = this.app.workspace.getLeavesOfType(SAVED_GAMES_VIEW_TYPE);
		if (existing.length) {
			this.app.workspace.revealLeaf(existing[0]);
			return;
		}
		const leaf = this.app.workspace.getRightLeaf(false);
		if (!leaf) return;
		await leaf.setViewState({ type: SAVED_GAMES_VIEW_TYPE });
		this.app.workspace.revealLeaf(leaf);
	}

	async loadSettings() {
		const saved = await this.loadData();
		this.settings = Object.assign(
			{},
			DEFAULT_SETTINGS,
			{ storagePath: this.defaultStoragePath },
			saved
		);
	}

	async saveSettings() {
		await this.saveData(this.settings);
		this.dataAdapter.storagePath = this.settings.storagePath;
		await this.dataAdapter.createStorageFolderIfNotExists();
	}
}
