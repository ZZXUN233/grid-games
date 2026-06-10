# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

"格子熵" (Grid Entropy) — a geometric grid game aggregation platform with an "entropy combat" theme. Built with React 19 + TypeScript + Vite + Tailwind CSS v4. Deployable via Google AI Studio.

## Dev Commands

```bash
npm run dev          # Start Vite dev server on port 3000
npm run dev:server   # Start MySQL API server on port 3001
npm run dev:all      # Start both servers concurrently
npm run build        # Production build to dist/
npm run preview      # Preview production build
npm run lint         # Type check: tsc --noEmit
npm run clean        # Remove dist/
```

No test framework is configured. `npm run lint` is the only quality check.

## Tech Stack

- **Language:** TypeScript 5.8
- **UI:** React 19, `motion` (Framer Motion v12), `lucide-react` icons
- **Styling:** Tailwind CSS v4 (via `@tailwindcss/vite` plugin)
- **Build:** Vite 6, esbuild
- **Backend:** MySQL (via localhost:3306, Express API server on port 3001, `mysql2` driver)
- **Misc:** `canvas-confetti` for score celebrations

## Architecture

### Entry & Routing

```
index.html → src/main.tsx → <App /> (root component)
```

`App.tsx` is the **state hub** — holds all global state (user profile, theme, game router, scores) and passes it via props to child components. No external state management library. No router library — game selection toggles via `selectedGameId` state (null = lobby).

### Component Tree

```
App (state hub)
├── Lobby (when selectedGameId === null)
│   ├── NameEditor        — Profile editor (nickname, avatar, color)
│   ├── ThemeSelector      — Visual theme switcher (6 themes)
│   ├── Game cards         — 3×3 portal grid (5 implemented, 4 planned)
│   ├── Entropy dashboard  — Daily "熵 combat" gauge
│   └── Leaderboard        — Score + entropy leaderboard
└── Game workspace (when selectedGameId is set)
    ├── SchulteGrid    — Schulte Grid (number-clicking)
    ├── Game2048       — 2048 tile-merging
    ├── Gomoku         — Five-in-a-row (vs AI bot or pass-and-play)
    ├── Sudoku         — Sudoku puzzle generator
    └── Minesweeper    — Classic minesweeper
```

### Games

| Game | Component | Config |
|------|-----------|--------|
| Schulte Grid | `SchulteGrid.tsx` | dimension (3-6) |
| 2048 | `Game2048.tsx` | spawnMode (normal/chaos/hell), starterCount |
| Gomoku | `Gomoku.tsx` | gridSize (11/13/15), difficulty (easy/medium/hard) |
| Sudoku | `Sudoku.tsx` | difficulty (easy/medium/hard) |
| Minesweeper | `Minesweeper.tsx` | difficulty (easy/medium/hard) |
| Memory Matrix | `MemoryMatrix.tsx` | target count (3+) |
| Game of Life | `GameOfLife.tsx` | presets (glider/gosper/pulsar/random), speed (1-10x) |
| Pixel Canvas | `PixelCanvas.tsx` | 20-color palette, pencil/eraser/bucket tools |
| Snake | `Snake.tsx` | obstacle mode toggle |

All 9 games are now implemented.

### Data Layer

- **Frontend:** `src/firebase.ts` (legacy name) / `src/api.ts` → HTTP calls to backend at `http://localhost:3001/api`
- **Backend:** `server.ts` — Express server, connects to MySQL (`mysql2` pool), exposes REST endpoints
- **Database:** MySQL (`test_db`), three tables: `users`, `scores`, `entropy_leaderboard`

**Auth API Endpoints:**
- `POST /api/auth/register` — Register with nickname + password, returns auto-generated userId (format `#xxxx9999`)
- `POST /api/auth/login` — Login with userId + password
- `POST /api/auth/change-password` — Change password (old + new)
- `POST /api/auth/update-nickname` — Update display name
- `POST /api/auth/update-avatar` — Update avatar color + emoji
- `POST /api/auth/profile` — Fetch user profile by userId

**Game API Endpoints:**
- `POST /api/scores` — Save a score record
- `GET /api/top-scores/:mode/:difficulty` — Fetch top scores by mode+difficulty
- `POST /api/entropy` — Save/replace daily entropy record (upsert)
- `GET /api/entropy-leaderboard/:date` — Fetch daily entropy leaderboard

**Auth model:** Password-based with bcryptjs hashing. Session stored in `localStorage('gridgame_auth_session')` as `{ userId, password }` for auto-restore. On first visit, user must register or login via the `AuthModal` overlay.

### State & Persistence

- **UserProfile** → `localStorage('schulte_profile')` — identity + entropy state (legacy, still used)
- **Auth session** → `localStorage('gridgame_auth_session')` — `{ userId, password }` for session restore
- **Theme** → `localStorage('schulte_theme_id')`
- **Local scores** → `localStorage('schulte_local_scores')` (typo in key name preserved)

### Entropy System

Each player has `accumulatedEntropy` (carry-over from unfinished days) and `todayEntropyConsumed`. Daily goal: 100 "negative entropy". Playing games consumes entropy ticks; unconsumed entropy rolls over via daily carry-over logic.

## Key Patterns

- **Theme system:** Defined in `src/data/themes.ts` as `GameTheme[]`, each with Tailwind class mappings (bg, card, gridItemDefault, etc.). Applied directly via string interpolation in className.
- **Score sharing:** `ScorePoster` component generates shareable images using canvas-confetti + screenshot-style rendering.
- **Path alias:** `@/` maps to `src/` (configured in vite.config.ts and tsconfig.json).
- **Running the backend:** Start with `npm run dev:server` or `npm run dev:all` (both frontend + backend).