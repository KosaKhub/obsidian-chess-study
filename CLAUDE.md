# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # watch mode — rebuilds on file changes (use during development)
npm run build    # production build (runs tsc type-check first, then esbuild)
npm run format   # run prettier
```

There are no tests. Type-checking is done only during `npm run build` (via `tsc -noEmit`).

## Deploying to Obsidian for testing

Copy (or symlink) the three output files to the vault's plugin folder:

```
<vault>/.obsidian/plugins/chess-study/main.js      ← dist/main.js
<vault>/.obsidian/plugins/chess-study/manifest.json ← manifest.json (root)
<vault>/.obsidian/plugins/chess-study/styles.css   ← dist/styles.css
```

After rebuilding, reload the plugin in Obsidian (disable → enable in Community Plugins).

## Architecture

This is an **Obsidian plugin** that registers a `chessStudy` fenced code block renderer.

### Entry point flow

1. **`src/main.tsx`** — `ChessStudyPlugin` (extends Obsidian `Plugin`)

   - Registers the `chessStudy` code block processor
   - Registers the "Insert FEN/PGN-Editor" command
   - Instantiates `ChessStudyDataAdapter` for JSON file I/O

2. **`src/components/ReactView.tsx`** — `MarkdownRenderChild` that mounts/unmounts a React tree into the Obsidian DOM element.

3. **`src/components/react/ChessStudy.tsx`** — Root React component. Owns all game state via `useImmerReducer`. Dispatches `GameActions` for every user interaction.

### State model

`GameState` in `ChessStudy.tsx`:

- `study: ChessStudyFileData` — the full persistent data (moves, shapes, comments, rootFEN)
- `currentMove` — which move is selected in the PGN viewer

`ChessStudyFileData` (defined in `src/lib/storage/index.ts`) is the JSON structure written to disk:

```
{ version, header, rootFEN, moves: ChessStudyMove[] }
```

Each `ChessStudyMove` extends chess.js `Move` with `moveId`, `variants`, `shapes`, `comment`.

Variants are depth-1 only: `ChessStudyMove.variants[]` → each variant has its own flat `VariantMove[]`.

### Two chess instances

- **`chessLogic` (Chess.js)** — enforces rules, generates legal moves for Chessground
- **`chessView` (Chessground API)** — renders the board visually

Both must be kept in sync. `src/lib/chess-logic/index.ts` provides `toColor`, `toDests`, `playOtherSide` as the bridge utilities.

### UI state helpers (`src/lib/ui-state/index.ts`)

- `displayMoveInHistory` — updates both `chessView` and `draft.currentMove` for prev/next/select navigation
- `findMoveIndex` — searches main line and variants to locate a move by `moveId`
- `getCurrentMove` — returns the immer draft of the currently selected move

### Persistence

`ChessStudyDataAdapter` reads/writes JSON files under:

```
<vault>/.obsidian/plugins/chess-study/storage/<nanoid>.json
```

The code block stores only the `chessStudyId` (the nanoid); all game data lives in the JSON file. Save is explicit (Save button) — the plugin does not auto-save.

### Settings

`ChessStudyPluginSettings` (`boardOrientation`, `boardColor`, `viewComments`) are stored via Obsidian's `loadData/saveData`. Per-block overrides are parsed from the YAML body of the `chessStudy` code block via `parseUserConfig` in `src/lib/obsidian/index.ts`.

### Build

esbuild bundles from `src/main.tsx` → `dist/main.js` (CJS, ES2018 target). `obsidian` and all `@codemirror/*` / `@lezer/*` packages are externalized — they are provided by Obsidian at runtime. The `renameStyles` esbuild plugin renames `dist/main.css` → `dist/styles.css` after bundling. The `dist/` directory is git-ignored.
