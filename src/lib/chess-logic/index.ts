import { Chess, QUEEN, SQUARES, Square } from 'chess.js';
import { Api } from 'chessground/api';
import { Config } from 'chessground/config';
import { nanoid } from 'nanoid';
import { CURRENT_STORAGE_VERSION, ChessStudyFileData } from 'src/lib/storage';
import { ChessString, ROOT_FEN } from 'src/main';

export function toColor(chess: Chess) {
	return chess.turn() === 'w' ? 'white' : 'black';
}

export function toDests(chess: Chess): Map<Square, Square[]> {
	const dests = new Map();
	SQUARES.forEach((s) => {
		const ms = chess.moves({ square: s, verbose: true });
		if (ms.length)
			dests.set(
				s,
				ms.map((m) => m.to)
			);
	});
	return dests;
}

export function parseChessStringToFileData(
	chessString: ChessString
): ChessStudyFileData {
	const trimmed = chessString?.trim() ?? '';
	const isFen = trimmed.includes('/');
	const chess = isFen ? new Chess(trimmed) : new Chess();
	if (!isFen) chess.loadPgn(trimmed, { strict: false });

	return {
		version: CURRENT_STORAGE_VERSION,
		header: { title: chess.header()['opening'] || null },
		moves: chess.history({ verbose: true }).map((move) => ({
			...move,
			moveId: nanoid(),
			variants: [],
			shapes: [],
			comment: null,
		})),
		rootFEN: isFen ? trimmed : ROOT_FEN,
	};
}

export function playOtherSide(cg: Api, chess: Chess) {
	return (orig: string, dest: string) => {
		const move = chess.move({ from: orig, to: dest, promotion: QUEEN });

		const commonTurnProperties: Partial<Config> = {
			turnColor: toColor(chess),
			movable: {
				color: toColor(chess),
				dests: toDests(chess),
			},
			check: chess.isCheck(),
		};

		if (move.flags === 'e' || move.promotion) {
			//Handle En Passant && Promote to Queen by default
			cg.set({
				fen: chess.fen(),
				...commonTurnProperties,
			});
		} else {
			cg.set(commonTurnProperties);
		}

		return move;
	};
}
