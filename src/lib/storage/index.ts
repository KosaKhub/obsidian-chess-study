import { JSONContent } from '@tiptap/react';
import { Move } from 'chess.js';
import { DrawShape } from 'chessground/draw';
import { nanoid } from 'nanoid';
import { DataAdapter, normalizePath } from 'obsidian';
import { ROOT_FEN } from 'src/main';

export const CURRENT_STORAGE_VERSION = '0.0.2';

export interface Variant {
	variantId: string;
	parentMoveId: string;
	moves: VariantMove[];
}

export interface VariantMove extends Move {
	moveId: string;
	shapes: DrawShape[];
	comment: JSONContent | null;
}

export interface ChessStudyMove extends Move {
	moveId: string;
	variants: Variant[];
	shapes: DrawShape[];
	comment: JSONContent | null;
}

export interface ChessStudyFileData {
	version: string;
	header: { title: string | null };
	moves: ChessStudyMove[];
	rootFEN: string;
}

export interface SavedGameSummary {
	id: string;
	title: string | null;
	moveCount: number;
}

export class ChessStudyDataAdapter {
	adapter: DataAdapter;
	storagePath: string;

	constructor(adapter: DataAdapter, storagePath: string) {
		this.adapter = adapter;
		this.storagePath = storagePath;
	}

	async saveFile(data: ChessStudyFileData, id?: string) {
		const chessStudyId = id || nanoid();

		console.log(
			`Writing file to ${normalizePath(
				`${this.storagePath}/${chessStudyId}.json`
			)}`
		);

		await this.adapter.write(
			normalizePath(`${this.storagePath}/${chessStudyId}.json`),
			JSON.stringify(data, null, 2),
			{}
		);

		return chessStudyId;
	}

	async loadFile(id: string): Promise<ChessStudyFileData> {
		console.log(
			`Reading file from ${normalizePath(`${this.storagePath}/${id}.json`)}`
		);

		const data = await this.adapter.read(
			normalizePath(`${this.storagePath}/${id}.json`)
		);

		const jsonData = JSON.parse(data);

		//Make sure data is compatible with storage version 0.0.1.
		if (!jsonData.rootFEN) {
			return { ...jsonData, rootFEN: ROOT_FEN };
		}

		return jsonData;
	}

	async createStorageFolderIfNotExists() {
		const folderExists = await this.adapter.exists(this.storagePath);

		if (!folderExists) {
			console.log(`Creating storage folder at: ${this.storagePath}`);
			this.adapter.mkdir(this.storagePath);
		}
	}

	async listFiles(): Promise<SavedGameSummary[]> {
		const folderExists = await this.adapter.exists(this.storagePath);
		if (!folderExists) return [];

		const listed = await this.adapter.list(this.storagePath);
		const jsonFiles = listed.files.filter((f) => f.endsWith('.json'));

		const results = await Promise.all(
			jsonFiles.map(async (filePath) => {
				const id = filePath.split('/').pop()?.replace('.json', '') ?? '';
				try {
					const data = await this.loadFile(id);
					return { id, title: data.header.title, moveCount: data.moves.length };
				} catch (e) {
					console.warn(`Failed to load game ${id}`, e);
					return null;
				}
			})
		);

		return results.filter((r): r is SavedGameSummary => r !== null);
	}

	async deleteFile(id: string): Promise<void> {
		await this.adapter.remove(normalizePath(`${this.storagePath}/${id}.json`));
	}

	async copyFile(id: string): Promise<string> {
		const data = await this.loadFile(id);
		const newId = nanoid();
		await this.saveFile(data, newId);
		return newId;
	}
}
