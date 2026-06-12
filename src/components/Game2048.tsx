import React, { useState, useEffect, useCallback } from "react";
import { GameTheme } from "../types";
import {
  ArrowLeft,
  RefreshCw,
  Trophy,
  ArrowUp,
  ArrowDown,
  ArrowRight as ArrowRightIcon,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import confetti from "canvas-confetti";

interface Game2048Props {
  theme: GameTheme;
  onGoBack: () => void;
  userNickname: string;
  onConsumeEntropy?: (points: number) => void;
  spawnMode?: "normal" | "chaos" | "hell";
  starterCount?: number;
}

type Board = number[][];

export default function Game2048({
  theme,
  onGoBack,
  userNickname,
  onConsumeEntropy,
  spawnMode = "normal",
  starterCount = 2,
}: Game2048Props) {
  const [board, setBoard] = useState<Board>([
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ]);
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);
  const [won, setWon] = useState(false);
  const [hasCelebrated, setHasCelebrated] = useState(false);

  // Load best score on mount
  useEffect(() => {
    const cachedBest = localStorage.getItem("gridgame_2048_best");
    if (cachedBest) {
      setBestScore(parseInt(cachedBest, 10) || 0);
    }
  }, []);

  // Initialize a random cell with 2 or 4 based on spawnMode
  const spawnTile = (currentBoard: Board): Board => {
    const emptyCells: { r: number; c: number }[] = [];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (currentBoard[r][c] === 0) {
          emptyCells.push({ r, c });
        }
      }
    }
    if (emptyCells.length === 0) return currentBoard;

    const { r, c } = emptyCells[Math.floor(Math.random() * emptyCells.length)];

    // Choose spawn value based on mode
    let val = 2;
    if (spawnMode === "chaos") {
      val = Math.random() < 0.5 ? 2 : 4;
    } else if (spawnMode === "hell") {
      val = 4;
    } else {
      val = Math.random() < 0.9 ? 2 : 4;
    }

    const nextBoard = currentBoard.map((row) => [...row]);
    nextBoard[r][c] = val;
    return nextBoard;
  };

  // Check if any moves are possible
  const checkGameOver = (currentBoard: Board): boolean => {
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        if (currentBoard[r][c] === 0) return false;
        if (r < 3 && currentBoard[r][c] === currentBoard[r + 1][c])
          return false;
        if (c < 3 && currentBoard[r][c] === currentBoard[r][c + 1])
          return false;
      }
    }
    return true;
  };

  // Core Game Reset using starterCount config
  const resetGame = useCallback(() => {
    let freshBoard: Board = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    // Dynamic starting count
    for (let i = 0; i < starterCount; i++) {
      freshBoard = spawnTile(freshBoard);
    }
    setBoard(freshBoard);
    setScore(0);
    setGameOver(false);
    setWon(false);
    setHasCelebrated(false);
  }, [spawnMode, starterCount]);

  // Initialize game on start & whenever settings change
  useEffect(() => {
    resetGame();
  }, [resetGame]);

  // Handle Score Updates
  const updateScoreAndBest = (pointsToAdd: number) => {
    setScore((prev) => {
      const next = prev + pointsToAdd;
      if (next > bestScore) {
        setBestScore(next);
        localStorage.setItem("gridgame_2048_best", next.toString());
      }
      return next;
    });
    // Trigger live entropy reduction
    if (onConsumeEntropy) {
      const entropyPoints = Math.max(1, Math.floor(pointsToAdd * 0.15));
      onConsumeEntropy(entropyPoints);
    }
  };

  // Sliding row logic helper
  const slideRowLeft = (row: number[]): { slid: number[]; points: number } => {
    // 1. Filter out zeros
    let filtered = row.filter((val) => val !== 0);
    let points = 0;
    const result: number[] = [];

    // 2. Merge matching adjacent entries
    for (let i = 0; i < filtered.length; i++) {
      if (i < filtered.length - 1 && filtered[i] === filtered[i + 1]) {
        const mergedVal = filtered[i] * 2;
        result.push(mergedVal);
        points += mergedVal;
        i++; // skip next since it joined
      } else {
        result.push(filtered[i]);
      }
    }

    // 3. Right pad with zeros
    while (result.length < 4) {
      result.push(0);
    }

    return { slid: result, points };
  };

  // Rotate board 90deg clockwise to re-use left slide logic
  const rotateClockwise = (matrix: Board): Board => {
    const result = [
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ];
    for (let r = 0; r < 4; r++) {
      for (let c = 0; c < 4; c++) {
        result[c][3 - r] = matrix[r][c];
      }
    }
    return result;
  };

  // Move Board Actions
  const move = useCallback(
    (direction: "LEFT" | "RIGHT" | "UP" | "DOWN") => {
      if (gameOver) return;

      let tempBoard = board.map((row) => [...row]);
      let pointsEarned = 0;
      let rotatedCount = 0;

      // Convert direction into standard leftward operations via rotation
      if (direction === "UP") {
        // 270deg clockwise rotates UP columns to LEFT rows
        tempBoard = rotateClockwise(
          rotateClockwise(rotateClockwise(tempBoard))
        );
        rotatedCount = 1; // 1 rotation needed to restore
      } else if (direction === "RIGHT") {
        // 180deg
        tempBoard = rotateClockwise(rotateClockwise(tempBoard));
        rotatedCount = 2;
      } else if (direction === "DOWN") {
        // 90deg
        tempBoard = rotateClockwise(tempBoard);
        rotatedCount = 3;
      }

      // Process left slide for all rows
      let changed = false;
      const processedBoard: Board = [];
      for (let r = 0; r < 4; r++) {
        const { slid, points } = slideRowLeft(tempBoard[r]);
        processedBoard.push(slid);
        pointsEarned += points;
        if (JSON.stringify(tempBoard[r]) !== JSON.stringify(slid)) {
          changed = true;
        }
      }

      // Restore original orientation
      let finalBoard = processedBoard;
      if (rotatedCount === 1) {
        finalBoard = rotateClockwise(finalBoard);
      } else if (rotatedCount === 2) {
        finalBoard = rotateClockwise(rotateClockwise(finalBoard));
      } else if (rotatedCount === 3) {
        finalBoard = rotateClockwise(
          rotateClockwise(rotateClockwise(finalBoard))
        );
      }

      if (changed || pointsEarned > 0) {
        // Generate next tile
        const withNewTile = spawnTile(finalBoard);
        setBoard(withNewTile);
        if (pointsEarned > 0) {
          updateScoreAndBest(pointsEarned);
        }

        // Check if player hit 2048 for the first time
        let contains2048 = false;
        for (let r = 0; r < 4; r++) {
          for (let c = 0; c < 4; c++) {
            if (withNewTile[r][c] >= 2048) {
              contains2048 = true;
            }
          }
        }

        if (contains2048 && !hasCelebrated) {
          setWon(true);
          setHasCelebrated(true);
          // Trigger lovely 2048 success confetti burst
          confetti({
            particleCount: 150,
            spread: 80,
            origin: { y: 0.6 },
            colors: ["#FFD700", "#F59E0B", "#10B981", "#3B82F6"],
          });
        }

        // Check game over
        if (checkGameOver(withNewTile)) {
          setGameOver(true);
        }
      }
    },
    [board, gameOver, bestScore, hasCelebrated]
  );

  // Attach keyboard event handlers
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        [
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "KeyW",
          "KeyS",
          "KeyA",
          "KeyD",
        ].includes(e.code)
      ) {
        e.preventDefault();
      }
      switch (e.code) {
        case "ArrowUp":
        case "KeyW":
          move("UP");
          break;
        case "ArrowDown":
        case "KeyS":
          move("DOWN");
          break;
        case "ArrowLeft":
        case "KeyA":
          move("LEFT");
          break;
        case "ArrowRight":
        case "KeyD":
          move("RIGHT");
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [move]);

  // Style mapper for numbers
  const getTileStyles = (val: number) => {
    if (val === 0) {
      return false
        ? "bg-[#FAF6EE] text-transparent border border-[#DFD3C1] flex items-center justify-center rounded-xl font-bold font-mono transition-all duration-300"
        : "bg-zinc-900/40 text-transparent border border-theme flex items-center justify-center rounded-xl font-bold font-mono transition-all duration-300";
    }

    // Custom beautiful mapping matching modular systems
    const baseClass =
      "flex items-center justify-center font-bold rounded-xl transition-all duration-300 font-mono shadow-inner border";

    if (false) {
      switch (val) {
        case 2:
          return `${baseClass} bg-[#EFEADB] text-[#4A3C31] border-[#DFD3C1] text-xl`;
        case 4:
          return `${baseClass} bg-[#E1D6BF] text-[#2D2A26] border-[#DFD3C1] text-xl`;
        case 8:
          return `${baseClass} bg-[#DFD3C1] text-[#8B5A2B] border-[#81745E]/30 text-xl font-extrabold animate-pulse`;
        case 16:
          return `${baseClass} bg-[#D3C4B0] text-[#714B23] border-[#81745E]/40 text-xl font-black`;
        case 32:
          return `${baseClass} bg-orange-100 text-orange-700 border-orange-200 text-xl font-black`;
        case 64:
          return `${baseClass} bg-rose-100 text-rose-700 border-rose-200 text-xl font-black`;
        case 128:
          return `${baseClass} bg-emerald-100 text-emerald-800 border-emerald-200 text-[18px] font-black`;
        case 256:
          return `${baseClass} bg-teal-100 text-teal-800 border-teal-200 text-[18px] font-black`;
        case 512:
          return `${baseClass} bg-[#DFD3C1] text-[#8B5A2B] border-[#81745E]/30 text-[18px] font-black`;
        case 1024:
          return `${baseClass} bg-indigo-100 text-indigo-850 border-indigo-200 text-[16px] font-black`;
        case 2048:
          return `${baseClass} bg-amber-100 text-amber-800 border-amber-300 font-extrabold text-[16px] border-2 animate-bounce shadow-md`;
        default:
          return `${baseClass} bg-pink-100 text-pink-700 border-pink-200 text-[15px] border-2`;
      }
    } else {
      switch (val) {
        case 2:
          return `${baseClass} bg-zinc-800 text-zinc-100 border-theme text-xl`;
        case 4:
          return `${baseClass} bg-zinc-700/80 text-zinc-100 border-theme text-xl`;
        case 8:
          return `${baseClass} bg-amber-955/40 text-amber-500 border-amber-500/25 text-xl font-extrabold animate-pulse`;
        case 16:
          return `${baseClass} bg-amber-900/40 text-amber-400 border-amber-500/35 text-xl font-black`;
        case 62:
        case 32:
          return `${baseClass} bg-orange-950/40 text-orange-400 border-orange-500/40 text-xl font-black`;
        case 64:
          return `${baseClass} bg-rose-905/30 text-rose-455 border-rose-500/40 text-xl font-black`;
        case 128:
          return `${baseClass} bg-emerald-950/40 text-emerald-400 border-emerald-500/40 text-[18px] font-black shadow-[0_0_12px_rgba(16,185,129,0.15)]`;
        case 256:
          return `${baseClass} bg-teal-950/40 text-teal-300 border-teal-500/45 text-[18px] font-black shadow-[0_0_15px_rgba(20,184,166,0.2)]`;
        case 512:
          return `${baseClass} bg-sky-950/40 text-sky-400 border-sky-500/50 text-[18px] font-black shadow-[0_0_18px_rgba(14,165,233,0.25)]`;
        case 1024:
          return `${baseClass} bg-indigo-955/40 text-indigo-305 border-indigo-500/50 text-[16px] font-black shadow-[0_0_22px_rgba(99,102,241,0.3)]`;
        case 2048:
          return `${baseClass} bg-amber-500/20 text-yellow-300 border-amber-500 font-extrabold text-[16px] shadow-[0_0_30px_rgba(245,158,11,0.4)] border-2 animate-bounce`;
        default:
          return `${baseClass} bg-pink-500/20 text-pink-300 border-pink-500 text-[15px] shadow-[0_0_35px_rgba(236,72,153,0.5)] border-2`;
      }
    }
  };

  return (
    <div className={`w-full flex flex-col gap-5 select-none ${"text-theme"}`}>
      {/* Dynamic Sub-header */}
      <div
        className={`flex items-center justify-between pb-3.5 border-b w-full px-1 ${"border-theme"}`}
      >
        <button
          onClick={onGoBack}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer active:scale-95 transition-all ${"bg-zinc-800/60 border border-theme hover:bg-zinc-800 hover:text-white text-secondary"}`}
        >
          <ArrowLeft size={13} />
          <span>返回大厅</span>
        </button>

        <div className="flex items-center gap-1">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
          <span
            className={`text-[11px] font-mono tracking-wider block uppercase ${"text-muted"}`}
          >
            2048 合并微挑战
          </span>
        </div>
      </div>

      {/* Profile & Grid Status */}
      <div className="flex items-center justify-between px-2 py-1">
        <div className="flex flex-col">
          <span className={`text-xs leading-none ${"text-muted"}`}>
            当前挑战者
          </span>
          <span
            className={`text-sm font-bold mt-1 font-mono tracking-wide ${"text-white"}`}
          >
            {userNickname}
          </span>
        </div>

        {/* Real-time score boards */}
        <div className="flex items-center gap-2">
          <div
            className={`px-2.5 py-1.5 rounded-lg flex flex-col items-center min-w-[64px] border ${"bg-zinc-900/60 border border-theme"}`}
          >
            <span
              className={`text-[9px] uppercase tracking-wider font-bold ${"text-muted"}`}
            >
              分数
            </span>
            <span
              className={`text-xs font-black font-mono leading-none mt-1 ${"text-amber-500"}`}
            >
              {score}
            </span>
          </div>
          <div
            className={`px-2.5 py-1.5 rounded-lg flex flex-col items-center min-w-[64px] border ${"bg-zinc-900/60 border border-theme"}`}
          >
            <span
              className={`text-[9px] uppercase tracking-wider font-bold flex items-center gap-0.5 ${"text-muted"}`}
            >
              最佳{" "}
              <Trophy size={8} className="text-[#8B5A2B] sm:text-amber-500" />
            </span>
            <span
              className={`text-xs font-black font-mono leading-none mt-1 ${"text-white"}`}
            >
              {bestScore}
            </span>
          </div>
        </div>
      </div>

      {/* Main 4x4 grid board wrapper with dynamic transitions */}
      <div
        className={`relative max-w-sm mx-auto w-full aspect-square p-2.5 rounded-2xl flex flex-col justify-center border ${"bg-zinc-950/80 border border-theme"}`}
      >
        <div className="grid grid-cols-4 grid-rows-4 gap-2 w-full h-full">
          {board.map((row, r) =>
            row.map((val, c) => (
              <div
                key={`cell-${r}-${c}`}
                className={`${getTileStyles(val)} aspect-square`}
              >
                {val > 0 && (
                  <motion.span
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 350, damping: 20 }}
                  >
                    {val}
                  </motion.span>
                )}
              </div>
            ))
          )}
        </div>

        {/* Game Over overlay */}
        <AnimatePresence>
          {gameOver && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 rounded-2xl bg-black/90 backdrop-blur-md flex flex-col items-center justify-center p-6 text-center z-10"
            >
              <Trophy size={42} className="text-zinc-600 mb-3 animate-spin" />
              <h3 className="text-lg font-black text-white uppercase tracking-wider">
                挑战终结 (Game Over)
              </h3>
              <p className="text-xs text-secondary mt-2 max-w-[220px]">
                没有格子可以合并了！本次游戏得分{" "}
                <span className="text-amber-500 font-extrabold">{score}</span>
              </p>

              <button
                onClick={resetGame}
                className="mt-5 py-2.5 px-6 rounded-xl text-xs font-bold bg-[#8B5A2B] hover:bg-[#A06D3B] text-white active:scale-95 transition-all flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <RefreshCw size={12} />
                <span>重新出发 (再来一局)</span>
              </button>
            </motion.div>
          )}

          {won && !gameOver && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="absolute bottom-2 left-2 right-2 p-3.5 rounded-xl bg-gradient-to-r from-amber-600/20 to-emerald-600/20 border border-amber-500/30 backdrop-blur-sm shadow-xl flex items-center justify-between z-10"
            >
              <div className="flex flex-col">
                <span className="text-[10px] font-bold text-amber-500 uppercase tracking-widest leading-none">
                  传奇勋章
                </span>
                <span className="text-xs text-white font-extrabold mt-1">
                  🎉 冲刺达成 2048 方块！
                </span>
              </div>
              <button
                onClick={() => setWon(false)}
                className="px-2.5 py-1 rounded bg-[#3EB489]/10 text-[#3EB489] hover:bg-[#3EB489]/20 border border-[#3EB489]/30 text-[10px] font-extrabold active:scale-95 cursor-pointer transition-all"
              >
                继续挑战
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Swipe buttons for Mobile/iframe simulation */}
      <div
        className={`max-w-[200px] mx-auto w-full flex flex-col gap-1 items-center p-2 rounded-xl border ${"bg-zinc-900/30 border border-theme"}`}
      >
        <span
          className={`text-[9px] uppercase tracking-widest block font-bold mb-1 ${"text-muted"}`}
        >
          方向虚拟手柄
        </span>

        <button
          onClick={() => move("UP")}
          disabled={gameOver}
          className={`w-10 h-10 rounded-lg flex items-center justify-center active:scale-90 transition-all cursor-pointer border ${"bg-zinc-850 hover:bg-zinc-800 border-theme text-theme"}`}
        >
          <ArrowUp size={14} />
        </button>
        <div className="flex gap-4">
          <button
            onClick={() => move("LEFT")}
            disabled={gameOver}
            className={`w-10 h-10 rounded-lg flex items-center justify-center active:scale-90 transition-all cursor-pointer border ${"bg-zinc-850 hover:bg-zinc-800 border-theme text-theme"}`}
          >
            <ArrowLeft size={14} />
          </button>
          <button
            onClick={() => move("DOWN")}
            disabled={gameOver}
            className={`w-10 h-10 rounded-lg flex items-center justify-center active:scale-90 transition-all cursor-pointer border ${"bg-zinc-850 hover:bg-zinc-800 border-theme text-theme"}`}
          >
            <ArrowDown size={14} />
          </button>
          <button
            onClick={() => move("RIGHT")}
            disabled={gameOver}
            className={`w-10 h-10 rounded-lg flex items-center justify-center active:scale-90 transition-all cursor-pointer border ${"bg-zinc-850 hover:bg-zinc-800 border-theme text-theme"}`}
          >
            <ArrowRightIcon size={14} />
          </button>
        </div>

        <p
          className={`text-[9px] text-center font-mono mt-2 tracking-wide leading-none ${"text-muted"}`}
        >
          键盘 WASD / 键盘方向键亦可操控
        </p>
      </div>
    </div>
  );
}
