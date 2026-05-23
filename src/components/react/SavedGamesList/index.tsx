import {
	ArrowUpDown,
	ChevronLeft,
	ChevronRight,
	FileInput,
	Plus,
	RefreshCw,
	Trash2,
} from 'lucide-react';
import { App, Editor, MarkdownView, Notice, TAbstractFile } from 'obsidian';
import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ChessStringModal } from 'src/components/obsidian/ChessStringModal';
import { ConfirmModal } from 'src/components/obsidian/ConfirmModal';
import { InsertModeModal } from 'src/components/obsidian/InsertModeModal';
import { ChessStudyPluginSettings } from 'src/components/obsidian/SettingsTab';
import { parseChessStringToFileData } from 'src/lib/chess-logic';
import {
	ChessStudyDataAdapter,
	ChessStudyFileData,
	SavedGameSummary,
} from 'src/lib/storage';
import { BoardPreview } from '../BoardPreview';

interface SavedGamesListProps {
	app: App;
	dataAdapter: ChessStudyDataAdapter;
	pluginSettings: ChessStudyPluginSettings;
}

interface SelectedGame {
	id: string;
	data: ChessStudyFileData;
}

export const SavedGamesList = ({
	app,
	dataAdapter,
	pluginSettings,
}: SavedGamesListProps) => {
	const [games, setGames] = useState<SavedGameSummary[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [editingTitle, setEditingTitle] = useState('');
	const [selectedGame, setSelectedGame] = useState<SelectedGame | null>(null);
	const [previewMoveIndex, setPreviewMoveIndex] = useState(-1);
	const [previewOrientation, setPreviewOrientation] = useState<
		'white' | 'black'
	>(pluginSettings.boardOrientation);
	const editInputRef = useRef<HTMLInputElement>(null);
	const lastActiveEditorRef = useRef<Editor | null>(null);

	// Track the last active MarkdownView editor so Insert works even after
	// the sidebar gains focus and getActiveViewOfType returns a stale result.
	useEffect(() => {
		const onActiveLeafChange = () => {
			const view = app.workspace.getActiveViewOfType(MarkdownView);
			if (view?.editor) lastActiveEditorRef.current = view.editor;
		};
		app.workspace.on('active-leaf-change', onActiveLeafChange);
		return () => app.workspace.off('active-leaf-change', onActiveLeafChange);
	}, [app]);

	const loadGames = useCallback(async () => {
		setIsLoading(true);
		try {
			const list = await dataAdapter.listFiles();
			setGames(list);
		} catch (e) {
			new Notice('Failed to load saved games.');
		} finally {
			setIsLoading(false);
		}
	}, [dataAdapter]);

	useEffect(() => {
		loadGames();
	}, [loadGames]);

	// Auto-refresh when storage files change (e.g. saved from the board editor)
	useEffect(() => {
		const onFileChange = (file: TAbstractFile) => {
			if (file.path.startsWith(dataAdapter.storagePath)) {
				loadGames();
			}
		};
		app.vault.on('modify', onFileChange);
		app.vault.on('create', onFileChange);
		app.vault.on('delete', onFileChange);
		return () => {
			app.vault.off('modify', onFileChange);
			app.vault.off('create', onFileChange);
			app.vault.off('delete', onFileChange);
		};
	}, [app.vault, dataAdapter.storagePath, loadGames]);

	const handleSelectGame = useCallback(
		async (id: string) => {
			if (selectedGame?.id === id) return;
			try {
				const data = await dataAdapter.loadFile(id);
				setSelectedGame({ id, data });
				setPreviewMoveIndex(data.moves.length > 0 ? data.moves.length - 1 : -1);
			} catch (e) {
				new Notice('Failed to load game.');
			}
		},
		[dataAdapter, selectedGame]
	);

	const handleAddGame = useCallback(() => {
		new ChessStringModal(app, async (chessString) => {
			try {
				const data = parseChessStringToFileData(chessString ?? '');
				await dataAdapter.saveFile(data);
				await loadGames();
			} catch (e) {
				new Notice('Failed to parse PGN/FEN.');
			}
		}).open();
	}, [app, dataAdapter, loadGames]);

	const handleDeleteGame = useCallback(
		(id: string) => {
			new ConfirmModal(
				app,
				'Delete this game? This action cannot be undone.',
				async () => {
					try {
						await dataAdapter.deleteFile(id);
						if (selectedGame?.id === id) setSelectedGame(null);
						await loadGames();
					} catch (e) {
						new Notice('Failed to delete game.');
					}
				}
			).open();
		},
		[app, dataAdapter, loadGames, selectedGame]
	);

	const handleTitleEditStart = useCallback((game: SavedGameSummary) => {
		setEditingId(game.id);
		setEditingTitle(game.title ?? '');
	}, []);

	const handleTitleEditSave = useCallback(
		async (id: string) => {
			try {
				const data = await dataAdapter.loadFile(id);
				data.header.title = editingTitle.trim() || null;
				await dataAdapter.saveFile(data, id);
				if (selectedGame?.id === id) {
					setSelectedGame({ id, data });
				}
				await loadGames();
			} catch (e) {
				new Notice('Failed to save title.');
			} finally {
				setEditingId(null);
			}
		},
		[dataAdapter, editingTitle, loadGames, selectedGame]
	);

	const findEditor = useCallback((): Editor | null => {
		// Prefer the editor that was active just before the sidebar gained focus.
		if (lastActiveEditorRef.current) return lastActiveEditorRef.current;

		// Fallback: search all leaves for any MarkdownView in editing mode.
		let found: Editor | null = null;
		app.workspace.iterateAllLeaves((leaf) => {
			if (found) return;
			const view = leaf.view;
			if (
				view instanceof MarkdownView &&
				view.getMode() !== 'preview' &&
				view.editor
			) {
				found = view.editor;
			}
		});
		return found;
	}, [app]);

	const handleInsertToEditor = useCallback(() => {
		if (!selectedGame) return;
		const editor = findEditor();
		if (!editor) {
			new Notice('No markdown editor in editing mode found. Open a note first.');
			return;
		}

		const insertCodeBlock = (id: string) => {
			const cursor = editor.getCursor();
			editor.replaceRange(`\`\`\`chessStudy\nchessStudyId: ${id}\n\`\`\``, cursor);
			editor.focus();
		};

		new InsertModeModal(
			app,
			() => insertCodeBlock(selectedGame.id),
			async () => {
				try {
					const newId = await dataAdapter.copyFile(selectedGame.id);
					insertCodeBlock(newId);
					await loadGames();
				} catch (e) {
					new Notice('Failed to copy game.');
				}
			}
		).open();
	}, [app, dataAdapter, findEditor, loadGames, selectedGame]);

	const currentFen = selectedGame
		? previewMoveIndex < 0
			? selectedGame.data.rootFEN
			: selectedGame.data.moves[previewMoveIndex].after
		: null;

	const currentShapes =
		previewMoveIndex >= 0
			? selectedGame?.data.moves[previewMoveIndex].shapes
			: [];

	const currentMoveLabel = (() => {
		if (previewMoveIndex < 0 || !selectedGame) return 'Start';
		const move = selectedGame.data.moves[previewMoveIndex];
		const moveNumber = Math.floor(previewMoveIndex / 2) + 1;
		return move.color === 'w'
			? `${moveNumber}. ${move.san}`
			: `${moveNumber}... ${move.san}`;
	})();

	return (
		<div className="saved-games-view">
			<div className="saved-games-header">
				<span className="saved-games-title">Saved Games</span>
				<div className="saved-games-header-actions">
					<button
						className="saved-games-add-btn"
						onClick={loadGames}
						title="Refresh"
					>
						<RefreshCw size={14} />
					</button>
					<button
						className="saved-games-add-btn"
						onClick={handleAddGame}
						title="Add new game"
					>
						<Plus size={16} />
					</button>
				</div>
			</div>

			<div className="saved-games-list">
				{isLoading && <p className="saved-games-loading">Loading...</p>}
				{!isLoading && games.length === 0 && (
					<p className="saved-games-empty">No saved games found.</p>
				)}
				{games.map((game) => (
					<div
						key={game.id}
						className={`saved-game-item${
							selectedGame?.id === game.id ? ' selected' : ''
						}`}
						onClick={() => handleSelectGame(game.id)}
					>
						{editingId === game.id ? (
							<input
								ref={editInputRef}
								className="saved-game-title-input"
								value={editingTitle}
								onChange={(e) => setEditingTitle(e.target.value)}
								onBlur={() => handleTitleEditSave(game.id)}
								onKeyDown={(e) => {
									if (e.key === 'Enter') handleTitleEditSave(game.id);
									if (e.key === 'Escape') setEditingId(null);
								}}
								autoFocus
								onClick={(e) => e.stopPropagation()}
							/>
						) : (
							<span
								className="saved-game-title"
								onClick={(e) => {
									e.stopPropagation();
									handleTitleEditStart(game);
								}}
								title="Click to edit title"
							>
								{game.title ?? '(No title)'}
							</span>
						)}
						<span className="saved-game-moves">{game.moveCount} moves</span>
					</div>
				))}
			</div>

			{selectedGame && currentFen && (
				<div className="saved-games-preview">
					<div className="preview-board-container">
						<BoardPreview
							fen={currentFen}
							shapes={currentShapes}
							boardColor={pluginSettings.boardColor}
							orientation={previewOrientation}
						/>
					</div>
					<div className="preview-nav">
						<button
							onClick={() => setPreviewMoveIndex((i) => Math.max(-1, i - 1))}
							disabled={previewMoveIndex < 0}
							title="Previous move"
						>
							<ChevronLeft size={16} />
						</button>
						<span className="preview-move-label">{currentMoveLabel}</span>
						<button
							onClick={() =>
								setPreviewMoveIndex((i) =>
									Math.min(selectedGame.data.moves.length - 1, i + 1)
								)
							}
							disabled={previewMoveIndex >= selectedGame.data.moves.length - 1}
							title="Next move"
						>
							<ChevronRight size={16} />
						</button>
						<button
							onClick={() =>
								setPreviewOrientation((o) => (o === 'white' ? 'black' : 'white'))
							}
							title="Flip board"
						>
							<ArrowUpDown size={16} />
						</button>
					</div>
					<div className="preview-actions">
						<button
							className="preview-action-btn"
							onClick={handleInsertToEditor}
							title="Insert into editor"
						>
							<FileInput size={14} /> Insert
						</button>
						<button
							className="preview-action-btn preview-action-btn--danger"
							onMouseDown={(e) => e.preventDefault()}
							onClick={() => handleDeleteGame(selectedGame.id)}
							title="Delete"
						>
							<Trash2 size={14} /> Delete
						</button>
					</div>
				</div>
			)}
		</div>
	);
};
