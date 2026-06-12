import React, { useState, useEffect } from "react";
import { GameTheme } from "../types";
import { ArrowLeft, RefreshCw, Trophy, Swords, Zap, Users } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";

interface GomokuProps {
  theme: GameTheme;
  onGoBack: () => void;
  userNickname: string;
  onConsumeEntropy?: (points: number) => void;
  initialGridSize?: number; // 11, 13, 15
  initialDifficulty?: "easy" | "medium" | "hard";
}

type Stone = "black" | "white" | null;
type Board = Stone[][];

export default function Gomoku({
  theme,
  onGoBack,
  userNickname,
  onConsumeEntropy,
  initialGridSize = 11,
  initialDifficulty = "medium",
}: GomokuProps) {
  const [gridSize, setGridSize] = useState<number>(initialGridSize);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">(
    initialDifficulty
  );

  const [board, setBoard] = useState<Board>(() =>
    Array(initialGridSize)
      .fill(null)
      .map(() => Array(initialGridSize).fill(null))
  );
  const [currentPlayer, setCurrentPlayer] = useState<"black" | "white">(
    "black"
  ); // Black plays first
  const [gameMode, setGameMode] = useState<"vs-bot" | "pass-and-play">(
    "vs-bot"
  );
  const [winner, setWinner] = useState<"black" | "white" | "draw" | null>(null);
  const [winLine, setWinLine] = useState<[number, number][]>([]);
  const [hasConsumedEntropy, setHasConsumedEntropy] = useState(false);

  // Sync with prop updates
  useEffect(() => {
    setGridSize(initialGridSize);
    setDifficulty(initialDifficulty);
    setBoard(
      Array(initialGridSize)
        .fill(null)
        .map(() => Array(initialGridSize).fill(null))
    );
    setCurrentPlayer("black");
    setWinner(null);
    setWinLine([]);
    setHasConsumedEntropy(false);
  }, [initialGridSize, initialDifficulty]);

  // Reset core game state
  const resetGame = (sizeToUse: number = gridSize) => {
    setBoard(
      Array(sizeToUse)
        .fill(null)
        .map(() => Array(sizeToUse).fill(null))
    );
    setCurrentPlayer("black");
    setWinner(null);
    setWinLine([]);
    setHasConsumedEntropy(false);
  };

  // Switch size dynamically
  const handleGridSizeChange = (newSize: number) => {
    setGridSize(newSize);
    resetGame(newSize);
  };

  // Trigger entropy consumption on game over
  useEffect(() => {
    if (!winner || hasConsumedEntropy) return;
    if (onConsumeEntropy) {
      setHasConsumedEntropy(true);
      if (winner === "black" && gameMode === "vs-bot") {
        const reward = gridSize === 11 ? 40 : gridSize === 13 ? 55 : 75; // larger board rewards more negative entropy
        onConsumeEntropy(
          difficulty === "easy"
            ? Math.floor(reward * 0.7)
            : difficulty === "hard"
              ? Math.floor(reward * 1.3)
              : reward
        );
      } else {
        onConsumeEntropy(15); // Mental effort contribution
      }
    }
  }, [
    winner,
    gameMode,
    gridSize,
    difficulty,
    onConsumeEntropy,
    hasConsumedEntropy,
  ]);

  // Check victory condition checking for 5 consecutives in 4 directions
  const checkWin = (
    b: Board,
    row: number,
    col: number,
    player: "black" | "white"
  ): [number, number][] | null => {
    const directions = [
      [0, 1], // horizontal
      [1, 0], // vertical
      [1, 1], // diagonal down-right
      [1, -1], // diagonal down-left
    ];

    for (const [dr, dc] of directions) {
      const line: [number, number][] = [[row, col]];

      // Positive direction scan
      let r = row + dr;
      let c = col + dc;
      while (
        r >= 0 &&
        r < gridSize &&
        c >= 0 &&
        c < gridSize &&
        b[r][c] === player
      ) {
        line.push([r, c]);
        r += dr;
        c += dc;
      }

      // Negative direction scan
      r = row - dr;
      c = col - dc;
      while (
        r >= 0 &&
        r < gridSize &&
        c >= 0 &&
        c < gridSize &&
        b[r][c] === player
      ) {
        line.push([r, c]);
        r -= dr;
        c -= dc;
      }

      if (line.length >= 5) {
        return line.slice(0, 5); // Return indices of winning 5 stones
      }
    }
    return null;
  };

  // Check if board is full (Draw)
  const checkDraw = (b: Board): boolean => {
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        if (b[r][c] === null) return false;
      }
    }
    return true;
  };

  // Heuristic AI Bot Move decider for White
  const findBestBotMove = (b: Board): [number, number] => {
    // Easy mode adds some random mistakes
    if (difficulty === "easy" && Math.random() < 0.45) {
      const emptyCells: [number, number][] = [];
      for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
          if (b[r][c] === null) {
            emptyCells.push([r, c]);
          }
        }
      }
      if (emptyCells.length > 0) {
        return emptyCells[Math.floor(Math.random() * emptyCells.length)];
      }
    }

    let bestScore = -1;
    let candidates: [number, number][] = [];

    // Direction arrays
    const dirs = [
      [0, 1],
      [1, 0],
      [1, 1],
      [1, -1],
    ];

    // Scoring heuristics
    const evaluatePoint = (row: number, col: number): number => {
      let score = 0;

      for (const [dr, dc] of dirs) {
        // Form sequences passing through (row, col)
        // Check both player and bot shapes
        const countStones = (player: "black" | "white") => {
          let consecutive = 1;
          let openEnds = 0;

          // Positive side
          let r = row + dr;
          let c = col + dc;
          while (
            r >= 0 &&
            r < gridSize &&
            c >= 0 &&
            c < gridSize &&
            b[r][c] === player
          ) {
            consecutive++;
            r += dr;
            c += dc;
          }
          if (
            r >= 0 &&
            r < gridSize &&
            c >= 0 &&
            c < gridSize &&
            b[r][c] === null
          ) {
            openEnds++;
          }

          // Negative side
          r = row - dr;
          c = col - dc;
          while (
            r >= 0 &&
            r < gridSize &&
            c >= 0 &&
            c < gridSize &&
            b[r][c] === player
          ) {
            consecutive++;
            r -= dr;
            c -= dc;
          }
          if (
            r >= 0 &&
            r < gridSize &&
            c >= 0 &&
            c < gridSize &&
            b[r][c] === null
          ) {
            openEnds++;
          }

          return { consecutive, openEnds };
        };

        const botStats = countStones("white");
        const playerStats = countStones("black");

        // Scoring rules:
        // 1. My 5-in-a-row (Instant victory!)
        if (botStats.consecutive >= 5) score += 100000;
        // 2. Play block of enemy 4-in-a-row
        else if (playerStats.consecutive >= 5) score += 20000;
        else if (playerStats.consecutive === 4 && playerStats.openEnds > 0)
          score += 10000;
        // 3. Complete bot 4-in-a-row
        else if (botStats.consecutive === 4 && botStats.openEnds > 0)
          score += 8000;
        // 4. Block player 3-in-a-row (open ends)
        else if (playerStats.consecutive === 3 && playerStats.openEnds === 2)
          score += 5000;
        // 5. Build bot 3-in-a-row
        else if (botStats.consecutive === 3 && botStats.openEnds === 2)
          score += 3000;
        // 6. Generic small weights
        else {
          score +=
            botStats.consecutive * (difficulty === "hard" ? 12 : 10) +
            botStats.openEnds * 5;
          score +=
            playerStats.consecutive * (difficulty === "hard" ? 10 : 8) +
            playerStats.openEnds * 4;
        }
      }

      // Proximity weight (prefer center of the board)
      const center = Math.floor(gridSize / 2);
      const distFromCenter = Math.abs(row - center) + Math.abs(col - center);
      score += (gridSize - distFromCenter) * 2;

      return score;
    };

    // Scan the board
    for (let r = 0; r < gridSize; r++) {
      for (let c = 0; c < gridSize; c++) {
        if (b[r][c] === null) {
          const score = evaluatePoint(r, c);
          if (score > bestScore) {
            bestScore = score;
            candidates = [[r, c]];
          } else if (score === bestScore) {
            candidates.push([r, c]);
          }
        }
      }
    }

    // fallback first available empty
    if (candidates.length === 0) {
      for (let r = 0; r < gridSize; r++) {
        for (let c = 0; c < gridSize; c++) {
          if (b[r][c] === null) return [r, c];
        }
      }
    }

    // Return a random selection from top score candidates to avoid deterministic play loops
    return candidates[Math.floor(Math.random() * candidates.length)];
  };

  // Bot response action loop triggered on player move
  const triggerBotMove = (currentBoard: Board) => {
    setTimeout(() => {
      if (winner) return;

      const [r, c] = findBestBotMove(currentBoard);
      const nextBoard = currentBoard.map((row) => [...row]);
      nextBoard[r][c] = "white";
      setBoard(nextBoard);

      const winningTrail = checkWin(nextBoard, r, c, "white");
      if (winningTrail) {
        setWinner("white");
        setWinLine(winningTrail);
      } else if (checkDraw(nextBoard)) {
        setWinner("draw");
      } else {
        setCurrentPlayer("black");
      }
    }, 450); // Small natural delay
  };

  // Player place stone click
  const handleCellClick = (row: number, col: number) => {
    if (board[row][col] !== null || winner) return;

    // Place active stone
    const player = currentPlayer;
    const nextBoard = board.map((r) => [...r]);
    nextBoard[row][col] = player;
    setBoard(nextBoard);

    // Evaluate result
    const winningTrail = checkWin(nextBoard, row, col, player);
    if (winningTrail) {
      setWinner(player);
      setWinLine(winningTrail);

      // Joyous celebration confetti
      confetti({
        particleCount: 110,
        spread: 80,
        origin: { y: 0.6 },
        colors:
          player === "black"
            ? ["#10B981", "#3EB489", "#FFD700", "#ffffff"]
            : ["#E4E4E7", "#FBBF24", "#3B82F6"],
      });
    } else if (checkDraw(nextBoard)) {
      setWinner("draw");
    } else {
      // Toggle player or pass turn to bot
      if (gameMode === "vs-bot") {
        setCurrentPlayer("white"); // BOT plays next
        triggerBotMove(nextBoard);
      } else {
        setCurrentPlayer(currentPlayer === "black" ? "white" : "black");
      }
    }
  };

  const isWinPoint = (r: number, c: number): boolean => {
    return winLine.some(([wr, wc]) => wr === r && wc === c);
  };

  const stoneSizeClass =
    gridSize === 11
      ? "w-6.5 h-6.5 sm:w-8 sm:h-8"
      : gridSize === 13
        ? "w-5.5 h-5.5 sm:w-7 sm:h-7"
        : "w-4.5 h-4.5 sm:w-6 sm:h-6";

  const hoverSizeClass =
    gridSize === 11
      ? "w-4 h-4 sm:w-6 sm:h-6"
      : gridSize === 13
        ? "w-3.5 h-3.5 sm:w-5 sm:h-5"
        : "w-3 h-3 sm:w-4 sm:h-4";

  return (
    <div className="w-full flex flex-col gap-4 select-none text-theme">
      {/* Sub-Header */}
      <div className="flex items-center justify-between pb-3.5 border-b border-theme w-full px-1">
        <button
          onClick={onGoBack}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/60 border border-theme hover:bg-zinc-800 hover:text-white text-secondary transition-all text-xs font-semibold cursor-pointer active:scale-95"
        >
          <ArrowLeft size={13} />
          <span>返回大厅</span>
        </button>

        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-violet-500 animate-pulse" />
          <span className="text-[11px] text-secondary font-mono tracking-wider block uppercase font-bold">
            五子棋连珠博弈 ({gridSize}x{gridSize}) -{" "}
            {difficulty === "easy"
              ? "入门"
              : difficulty === "hard"
                ? "大师"
                : "普通"}{" "}
            AI
          </span>
        </div>
      </div>

      {/* Dynamic Game-settings Panel directly inside Go Interface */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 bg-zinc-900/35 border border-theme p-3 rounded-xl">
        {/* Row 1: Board specifications choice */}
        <div className="flex items-center justify-between gap-2.5 bg-zinc-950/25 p-2 rounded-lg border border-theme">
          <span className="text-xs font-bold text-secondary font-mono tracking-wide shrink-0">
            棋盘规格:
          </span>
          <div className="flex items-center gap-1.5">
            {[11, 13, 15].map((size) => (
              <button
                key={`opt-size-${size}`}
                onClick={() => handleGridSizeChange(size)}
                className={`py-1 px-2.5 rounded text-[10.5px] font-mono font-bold transition-all ${
                  gridSize === size
                    ? "bg-violet-605/80 text-white ring-1 ring-violet-500/50 font-black shadow"
                    : "bg-zinc-900/60 text-muted hover:bg-zinc-800 hover:text-zinc-300"
                }`}
              >
                {size}x{size}
              </button>
            ))}
          </div>
        </div>

        {/* Row 2: Master difficulty settings */}
        <div className="flex items-center justify-between gap-2.5 bg-zinc-950/25 p-2 rounded-lg border border-theme">
          <span className="text-xs font-bold text-secondary font-mono tracking-wide shrink-0">
            对手智商:
          </span>
          <div className="flex items-center gap-1.5">
            {[
              { id: "easy", label: "入门" },
              { id: "medium", label: "普通" },
              { id: "hard", label: "大师" },
            ].map((opt) => (
              <button
                key={`opt-diff-${opt.id}`}
                onClick={() =>
                  setDifficulty(opt.id as "easy" | "medium" | "hard")
                }
                className={`py-1 px-2.5 rounded text-[10.5px] font-bold transition-all ${
                  difficulty === opt.id
                    ? "bg-amber-600/90 text-zinc-950 font-black ring-1 ring-amber-500/40 shadow"
                    : "bg-zinc-900/60 text-muted hover:bg-zinc-800 hover:text-zinc-300"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Configuration Switches */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-zinc-900/40 p-3 rounded-xl border border-theme">
        {/* Game Mode Pickers */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              setGameMode("vs-bot");
              resetGame();
            }}
            className={`flex-1 sm:flex-initial py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              gameMode === "vs-bot"
                ? "bg-amber-500 text-zinc-950 font-extrabold shadow-sm"
                : "bg-zinc-800 text-secondary hover:bg-zinc-750"
            }`}
          >
            <Zap size={12} />
            <span>人机对抗模式</span>
          </button>

          <button
            onClick={() => {
              setGameMode("pass-and-play");
              resetGame();
            }}
            className={`flex-1 sm:flex-initial py-1.5 px-3 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
              gameMode === "pass-and-play"
                ? "bg-amber-500 text-zinc-950 font-extrabold shadow-sm"
                : "bg-zinc-800 text-secondary hover:bg-zinc-750"
            }`}
          >
            <Users size={12} />
            <span>双人同屏对奕</span>
          </button>
        </div>

        {/* Turn indicator */}
        <div className="flex items-center justify-between sm:justify-end gap-3.5 px-1.5 py-0.5">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">落子权:</span>

            <div className="flex items-center gap-1.5">
              <div
                className={`w-3.5 h-3.5 rounded-full border border-theme shadow-sm ${
                  currentPlayer === "black"
                    ? "bg-zinc-950 text-white border-theme"
                    : "bg-white text-zinc-950 border-theme"
                }`}
              />
              <span className="text-xs font-bold text-theme font-mono">
                {currentPlayer === "black"
                  ? `${userNickname} (黑子)`
                  : gameMode === "vs-bot"
                    ? "智能AI (白子)"
                    : "同屏对手 (白子)"}
              </span>
            </div>
          </div>

          <button
            onClick={() => resetGame()}
            className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-750 border border-theme text-secondary hover:text-white transition-all cursor-pointer"
            title="重开棋局"
          >
            <RefreshCw size={12} />
          </button>
        </div>
      </div>

      {/* Go board drawing container */}
      <div
        className="relative max-w-[360px] sm:max-w-md mx-auto w-full aspect-square p-3 rounded-2xl bg-[#E6D0B3] border-4 border-amber-950/80 shadow-2xl flex flex-col justify-center"
        style={{ contentVisibility: "auto" }}
      >
        {/* Draw intersection lines on backdrop */}
        <div className="absolute inset-3 pointer-events-none opacity-40">
          {Array(gridSize)
            .fill(0)
            .map((_, r) => {
              const pct = ((r + 0.5) / gridSize) * 100;
              return (
                <div
                  key={`line-h-${r}`}
                  className="absolute left-0 right-0 h-[1.5px] bg-amber-950/80"
                  style={{ top: `${pct}%` }}
                />
              );
            })}
          {Array(gridSize)
            .fill(0)
            .map((_, c) => {
              const pct = ((c + 0.5) / gridSize) * 100;
              return (
                <div
                  key={`line-v-${c}`}
                  className="absolute top-0 bottom-0 w-[1.5px] bg-amber-950/80"
                  style={{ left: `${pct}%` }}
                />
              );
            })}

          {/* Place standard Star Points (天元/星位) dynamically matches quadrant center */}
          {gridSize % 2 === 1 && (
            <>
              {(() => {
                const center = Math.floor(gridSize / 2);
                const starPoints: [number, number][] =
                  gridSize === 11
                    ? [
                        [2, 2],
                        [2, 8],
                        [8, 2],
                        [8, 8],
                        [center, center],
                      ]
                    : gridSize === 13
                      ? [
                          [3, 3],
                          [3, 9],
                          [9, 3],
                          [9, 9],
                          [center, center],
                        ]
                      : [
                          [3, 3],
                          [3, 11],
                          [11, 3],
                          [11, 11],
                          [center, center],
                        ];

                return starPoints.map(([r, c], idx) => {
                  const topPct = ((r + 0.5) / gridSize) * 100;
                  const leftPct = ((c + 0.5) / gridSize) * 100;
                  return (
                    <div
                      key={`star-${idx}`}
                      className="absolute w-1.5 h-1.5 rounded-full bg-amber-950/90"
                      style={{
                        left: `${leftPct}%`,
                        top: `${topPct}%`,
                        transform: "translate(-50%, -50%)",
                      }}
                    />
                  );
                });
              })()}
            </>
          )}
        </div>

        {/* Real placement grids */}
        <div
          className="relative z-10 w-full h-full grid gap-0"
          style={{
            gridTemplateColumns: `repeat(${gridSize}, minmax(0, 1fr))`,
            gridTemplateRows: `repeat(${gridSize}, minmax(0, 1fr))`,
          }}
        >
          {board.map((row, rIdx) =>
            row.map((val, cIdx) => (
              <button
                key={`go-${rIdx}-${cIdx}`}
                onClick={() => handleCellClick(rIdx, cIdx)}
                disabled={
                  val !== null ||
                  winner !== null ||
                  (currentPlayer === "white" && gameMode === "vs-bot")
                }
                className="w-full h-full relative focus:outline-none cursor-pointer flex items-center justify-center group"
                style={{ touchAction: "manipulation" }}
              >
                {/* Visual hovering outline stone */}
                {val === null &&
                  !winner &&
                  !(currentPlayer === "white" && gameMode === "vs-bot") && (
                    <div
                      className={`absolute select-none pointer-events-none rounded-full opacity-0 group-hover:opacity-35 border border-dashed border-theme ${hoverSizeClass} ${
                        currentPlayer === "black" ? "bg-zinc-950" : "bg-white"
                      }`}
                    />
                  )}

                {/* Substantive placed go stone */}
                {val !== null && (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{
                      scale: isWinPoint(rIdx, cIdx) ? 1.08 : 1,
                    }}
                    transition={{ type: "spring", stiffness: 450, damping: 20 }}
                    className={`absolute rounded-full flex items-center justify-center shadow-md select-none ring-1 relative ${stoneSizeClass} ${
                      val === "black"
                        ? "bg-gradient-to-br from-zinc-800 to-zinc-950 text-white ring-zinc-900/60 border border-theme"
                        : "bg-gradient-to-br from-white to-zinc-150 text-zinc-900 ring-zinc-300 border border-theme"
                    }`}
                  >
                    {/* Win pulsated marker highlight */}
                    {isWinPoint(rIdx, cIdx) && (
                      <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0.35, 0.95, 0.35] }}
                        transition={{ repeat: Infinity, duration: 1.5 }}
                        className="absolute inset-0 rounded-full bg-emerald-500/40 border-2 border-emerald-400 z-10"
                      />
                    )}

                    {/* Dot on last stone placed or winning connection */}
                    {val === "black" && isWinPoint(rIdx, cIdx) && (
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 shrink-0 z-20" />
                    )}
                    {val === "white" && isWinPoint(rIdx, cIdx) && (
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-600 shrink-0 z-20" />
                    )}
                  </motion.div>
                )}
              </button>
            ))
          )}
        </div>

        {/* Victory/Defeat Game statuses overlay */}
        <AnimatePresence>
          {winner && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 rounded-xl bg-black/85 backdrop-blur-sm flex flex-col items-center justify-center p-6 text-center z-20 border-4 border-amber-950/80"
            >
              <Swords
                size={38}
                className="text-amber-500 mb-3.5 animate-bounce"
              />
              <h3 className="text-lg font-black text-white uppercase tracking-wider">
                棋局终了
              </h3>
              <p className="text-xs text-theme mt-2 max-w-[280px]">
                {winner === "draw" ? (
                  <span>落子无处！此局以棋逢对手「和棋」落帷。</span>
                ) : winner === "black" ? (
                  <span>
                    恭喜{" "}
                    <span className="text-[#3EB489] font-black">
                      {userNickname} (黑子)
                    </span>{" "}
                    连成五子，赢得本次博弈大捷！
                  </span>
                ) : (
                  <span>
                    {gameMode === "vs-bot" ? (
                      <span>
                        白子 AI 技高一筹完成五连珠！
                        <br />
                        <span className="text-muted mt-1 block">
                          其落子诡橘，下次小心陷入它的陷阱。
                        </span>
                      </span>
                    ) : (
                      <span>白子棋手连珠大捷，顺利终结黑方的攻势！</span>
                    )}
                  </span>
                )}
              </p>

              <button
                onClick={() => resetGame()}
                className="mt-6 py-2.5 px-6 rounded-xl text-xs font-bold bg-amber-500 text-zinc-950 hover:bg-amber-400 active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <RefreshCw size={12} />
                <span>重新博弈 (再来一局)</span>
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Guide text */}
      <div className="bg-zinc-900/30 p-3 rounded-lg border border-theme text-[11px] text-muted leading-relaxed text-center font-mono select-text">
        💡 五子棋规则：黑先白后，双方轮流落子，先在横、竖、斜任意方向连成连续 5
        颗同色棋子者胜。消解越大棋盘规格或更高对手智商将获得更多负熵。
      </div>
    </div>
  );
}
