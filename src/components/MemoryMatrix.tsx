import React, { useState, useEffect, useRef, useCallback } from "react";
import { GameTheme, ScoreRecord } from "../types";
import {
  Cpu,
  ArrowLeft,
  RefreshCw,
  Sparkles,
  Flame,
  Trophy,
  Target,
  Brain,
  ChevronUp,
  ChevronDown,
  Info,
  Zap,
  Star,
  Layers,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface MemoryMatrixProps {
  theme: GameTheme;
  onGoBack: () => void;
  userNickname: string;
  onConsumeEntropy: (points: number) => Promise<void>;
  onScoreSubmit?: (score: ScoreRecord) => Promise<void>;
  currentUserId?: string;
  avatarColor?: string;
  avatarEmoji?: string;
}

interface MatrixCell {
  row: number;
  col: number;
  isTarget: boolean;
  isSelected: boolean;
  isWrong: boolean;
  id: string;
}

// Grid size progression based on target count
const getGridForTargets = (targetCount: number): number => {
  if (targetCount <= 4) return 4; // 4x4 for 3-4 targets
  if (targetCount <= 6) return 5; // 5x5 for 5-6 targets
  if (targetCount <= 9) return 6; // 6x6 for 7-9 targets
  return 7; // 7x7 for 10+ targets
};

// Glow color pairs for flash phase (breathing gradient)
const GLOW_COLORS = [
  { from: "#F59E0B", to: "#F97316" }, // Amber → Orange
  { from: "#8B5CF6", to: "#6366F1" }, // Violet → Indigo
  { from: "#3EB489", to: "#10B981" }, // Mint → Emerald
  { from: "#EC4899", to: "#F43F5E" }, // Pink → Rose
  { from: "#06B6D4", to: "#0EA5E9" }, // Cyan → Sky
];

// Entropy points calculation based on target count
const getEntropyPoints = (targetCount: number): number => {
  if (targetCount <= 4) return 10 + targetCount * 3;
  if (targetCount <= 6) return 25 + targetCount * 4;
  if (targetCount <= 9) return 50 + targetCount * 5;
  return 80 + targetCount * 6;
};

// Flash duration decreases as difficulty increases (faster challenge)
const getFlashDuration = (targetCount: number): number => {
  return Math.max(600, 1400 - targetCount * 60);
};

// Display duration per target
const getDisplayDuration = (targetCount: number): number => {
  return Math.max(800, 2200 - targetCount * 80);
};

export default function MemoryMatrix({
  theme,
  onGoBack,
  userNickname,
  onConsumeEntropy,
  onScoreSubmit,
  currentUserId = "memory-tester",
  avatarColor = "#64748B",
  avatarEmoji = "🧠",
}: MemoryMatrixProps) {
  // === Game State ===
  const [targetCount, setTargetCount] = useState(3); // Start with 3 targets
  const [gridSize, setGridSize] = useState(4);
  const [phase, setPhase] = useState<"flash" | "recall" | "result">("flash");
  const [cells, setCells] = useState<MatrixCell[]>([]);
  const [selectedCount, setSelectedCount] = useState(0);
  const [isLocked, setIsLocked] = useState(false); // Input debounce lock
  const [streak, setStreak] = useState(0); // Consecutive wins
  const [bestStreak, setBestStreak] = useState(0);
  const [bestTargetCount, setBestTargetCount] = useState(3);
  const [isGameComplete, setIsGameComplete] = useState(false);
  const [flashGlowColor, setFlashGlowColor] = useState(GLOW_COLORS[0]);
  const [showGuide, setShowGuide] = useState(true);

  // Stats for current session
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [totalWins, setTotalWins] = useState(0);
  const [currentRound, setCurrentRound] = useState(1);

  // Timer for each round
  const [recallTime, setRecallTime] = useState(0);
  const [isTimingRecall, setIsTimingRecall] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Track selected target IDs for validation
  const [targetIds, setTargetIds] = useState<Set<string>>(new Set());

  // Load best from localStorage
  useEffect(() => {
    const cached = localStorage.getItem("memory_matrix_best");
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        setBestTargetCount(parsed.bestTargetCount || 3);
        setBestStreak(parsed.bestStreak || 0);
      } catch {
        // ignore
      }
    }
  }, []);

  // Save best to localStorage
  const saveBest = useCallback((targets: number, streakVal: number) => {
    const data = { bestTargetCount: targets, bestStreak: streakVal };
    localStorage.setItem("memory_matrix_best", JSON.stringify(data));
  }, []);

  // Generate a new round
  const generateRound = useCallback((numTargets: number) => {
    const size = getGridForTargets(numTargets);
    setGridSize(size);
    setPhase("flash");

    // Pick a random glow color for this round
    setFlashGlowColor(
      GLOW_COLORS[Math.floor(Math.random() * GLOW_COLORS.length)]
    );

    const totalCells = size * size;
    // Ensure targets <= total cells
    const actualTargets = Math.min(numTargets, totalCells - 1);

    // Randomly select target positions
    const targetPositions = new Set<number>();
    while (targetPositions.size < actualTargets) {
      targetPositions.add(Math.floor(Math.random() * totalCells));
    }

    const newTargetIds = new Set<string>();
    const newCells: MatrixCell[] = [];
    let idx = 0;
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        const id = `${r}-${c}`;
        const isTarget = targetPositions.has(idx);
        if (isTarget) newTargetIds.add(id);
        newCells.push({
          row: r,
          col: c,
          isTarget,
          isSelected: false,
          isWrong: false,
          id,
        });
        idx++;
      }
    }

    setCells(newCells);
    setTargetIds(newTargetIds);
    setSelectedCount(0);
    setIsLocked(true); // Lock during flash phase
    setIsGameComplete(false);
    setRecallTime(0);
    setIsTimingRecall(false);
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  // Initialize first round
  useEffect(() => {
    generateRound(targetCount);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // Flash phase timer: show targets then transition to recall
  useEffect(() => {
    if (phase === "flash" && cells.length > 0) {
      const flashDuration = getFlashDuration(targetCount);
      const displayDuration = getDisplayDuration(targetCount);
      const totalDuration = flashDuration + displayDuration;

      const timeout = setTimeout(() => {
        setPhase("recall");
        setIsLocked(false);
        setIsTimingRecall(true);
      }, totalDuration);

      return () => clearTimeout(timeout);
    }
  }, [phase, cells, targetCount]);

  // Recall phase timer
  useEffect(() => {
    if (isTimingRecall && phase === "recall") {
      timerRef.current = setInterval(() => {
        setRecallTime((prev) => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimingRecall, phase]);

  // Handle cell click during recall phase
  const handleCellClick = (cell: MatrixCell) => {
    if (isLocked || phase !== "recall" || isGameComplete) return;
    if (cell.isSelected) return;

    // Lock input briefly for click debounce
    setIsLocked(true);

    const newCells = cells.map((c) => ({ ...c }));
    const clickedCell = newCells.find((c) => c.id === cell.id)!;
    clickedCell.isSelected = true;
    clickedCell.isWrong = !cell.isTarget;

    if (cell.isTarget) {
      // Correct selection
      const newSelectedCount = selectedCount + 1;
      setSelectedCount(newSelectedCount);
      setCells(newCells);

      // Check if all targets found
      if (newSelectedCount >= targetIds.size) {
        // Round won!
        setIsTimingRecall(false);
        setPhase("result");
        setIsGameComplete(true);
        handleRoundWin();
      } else {
        // Release lock after a short debounce
        setTimeout(() => setIsLocked(false), 150);
      }
    } else {
      // Wrong selection — round failed
      setIsTimingRecall(false);
      setPhase("result");
      setIsGameComplete(true);
      setCells(newCells);
      handleRoundLoss();
    }
  };

  // Handle round win
  const handleRoundWin = async () => {
    const newStreak = streak + 1;
    const newTotalWins = totalWins + 1;
    setStreak(newStreak);
    setTotalWins(newTotalWins);

    // Update best if needed
    if (targetCount > bestTargetCount) {
      setBestTargetCount(targetCount);
      saveBest(targetCount, Math.max(bestStreak, newStreak));
    }
    if (newStreak > bestStreak) {
      setBestStreak(newStreak);
      saveBest(Math.max(bestTargetCount, targetCount), newStreak);
    }

    // Consume entropy based on target count
    const entropyPoints = getEntropyPoints(targetCount);
    await onConsumeEntropy(entropyPoints);

    // Submit score record
    if (onScoreSubmit) {
      const record: ScoreRecord = {
        id: `${currentUserId}_memory_${Date.now()}`,
        userId: currentUserId,
        nickname: userNickname,
        avatarColor,
        avatarEmoji,
        game: "memory-matrix",
        mode: "memory-matrix",
        difficulty: `记忆矩阵 ${targetCount}目标 ${gridSize}x${gridSize}`,
        time: recallTime || 1,
        createdAt: Date.now(),
      };
      await onScoreSubmit(record);
    }
  };

  // Handle round loss
  const handleRoundLoss = () => {
    setStreak(0);
    setTotalAttempts((prev) => prev + 1);

    // Consume a small amount even on failure (effort reward)
    const smallEntropy = Math.max(3, targetCount);
    onConsumeEntropy(smallEntropy);
  };

  // Proceed to next round (after result phase)
  const handleNextRound = () => {
    setCurrentRound((prev) => prev + 1);

    // Check if should level up or down
    let newTargetCount = targetCount;
    if (streak >= 2) {
      // 2 consecutive wins → level up (but cap at reasonable max for grid)
      const maxReasonable = gridSize * gridSize - 2;
      if (targetCount < maxReasonable) {
        newTargetCount = targetCount + 1;
      }
    }

    // No level down on loss — instead we just display the result
    // The level down happens when the user manually restarts or
    // after seeing the result

    setTargetCount(newTargetCount);
    generateRound(newTargetCount);
  };

  // Level down (called from loss screen)
  const handleLevelDownRetry = () => {
    const newTargetCount = Math.max(3, targetCount - 1);
    setTargetCount(newTargetCount);
    setCurrentRound((prev) => prev + 1);
    generateRound(newTargetCount);
  };

  // Full reset
  const handleReset = () => {
    setStreak(0);
    setTargetCount(3);
    setCurrentRound(1);
    setTotalAttempts(0);
    setTotalWins(0);
    generateRound(3);
  };

  // Flash glow animation style
  const getFlashStyle = (isTarget: boolean): React.CSSProperties => {
    if (!isTarget) return {};
    const { from, to } = flashGlowColor;
    return {
      background: `linear-gradient(135deg, ${from}33, ${to}22)`,
      borderColor: from,
      boxShadow: `0 0 20px ${from}55, inset 0 0 15px ${from}33`,
    };
  };

  // Get cell background based on state
  const getCellBackground = (cell: MatrixCell): string => {
    // Flash phase: show targets with glow
    if (phase === "flash") {
      if (cell.isTarget) {
        return false ? "bg-amber-100 border-amber-400" : "bg-zinc-800/80";
      }
      return false
        ? "bg-[#EFEADB] border-[#DFD3C1]"
        : "bg-zinc-900/60 border-theme";
    }

    // Recall phase or result
    if (cell.isSelected) {
      if (cell.isWrong) {
        return false
          ? "bg-red-100 border-red-400"
          : "bg-red-950/60 border-red-500";
      }
      // Correct selection
      return false
        ? "bg-emerald-100 border-emerald-400"
        : "bg-emerald-900/40 border-emerald-500";
    }

    // Unselected cells in recall/result
    // Show missed targets in result phase
    if (phase === "result" && cell.isTarget) {
      return false
        ? "bg-amber-50 border-amber-300 ring-1 ring-amber-200"
        : "bg-zinc-800/40 border-amber-600/40 ring-1 ring-amber-700/30";
    }

    // Default unselected
    return false
      ? "bg-[#EFEADB] hover:bg-[#E1D6BF] border-[#DFD3C1]"
      : "bg-zinc-900/60 hover:bg-zinc-800/80 border-theme";
  };

  return (
    <div className={`w-full flex flex-col gap-4 select-none ${"text-theme"}`}>
      {/* Sub-header Navigation row */}
      <div
        className={`flex items-center justify-between pb-3.5 border-b w-full px-1 ${"border-theme"}`}
      >
        <button
          onClick={onGoBack}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer active:scale-95 transition-all ${
            false
              ? "bg-[#EFEADB] hover:bg-[#E1D6BF] text-[#4A3C31] border border-[#DFD3C1]"
              : "bg-zinc-800/60 border border-theme hover:bg-zinc-800 hover:text-white text-secondary"
          }`}
        >
          <ArrowLeft size={13} />
          <span>返回大厅</span>
        </button>

        <div className="flex items-center gap-1.5">
          <div
            className={`w-2.5 h-2.5 rounded-full animate-pulse ${phase === "flash" ? "bg-amber-500" : phase === "recall" ? "bg-emerald-500" : "bg-indigo-500"}`}
          />
          <span
            className={`text-[11px] font-mono tracking-wider block uppercase ${"text-muted"}`}
          >
            记忆矩阵 · VISUAL CACHE
          </span>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between px-2 py-1">
        {/* Left segment - Player info & round stats */}
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline gap-1">
            <span className={`text-xs ${"text-muted"}`}>挑战者：</span>
            <span
              className={`text-sm font-bold font-mono tracking-wide ${"text-white"}`}
            >
              {userNickname}
            </span>
          </div>

          {/* Round info chips */}
          <div className="flex gap-2 flex-wrap">
            <div
              className={`px-2.5 py-1 rounded-lg border text-[10px] font-black tracking-wide flex items-center gap-1 ${
                false
                  ? "bg-[#FAF6EE] border-[#E1D4C0] text-[#8B5A2B]"
                  : "bg-zinc-900/60 border-theme text-theme"
              }`}
            >
              <Target size={10} />
              <span>目标: {targetIds.size} 个</span>
            </div>

            <div
              className={`px-2.5 py-1 rounded-lg border text-[10px] font-black tracking-wide flex items-center gap-1 ${
                false
                  ? "bg-[#FAF6EE] border-[#E1D4C0] text-[#8B5A2B]"
                  : "bg-zinc-900/60 border-theme text-theme"
              }`}
            >
              <Layers size={10} />
              <span>
                {gridSize}x{gridSize}
              </span>
            </div>

            <div
              className={`px-2.5 py-1 rounded-lg border text-[10px] font-black tracking-wide flex items-center gap-1 ${
                streak >= 2
                  ? false
                    ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                    : "bg-emerald-900/30 border-emerald-700/50 text-emerald-400"
                  : false
                    ? "bg-[#FAF6EE] border-[#E1D4C0] text-[#6C5E53]"
                    : "bg-zinc-900/60 border-theme text-secondary"
              }`}
            >
              <Zap size={10} className={streak >= 2 ? "animate-pulse" : ""} />
              <span>连胜: {streak}</span>
            </div>

            <div
              className={`px-2.5 py-1 rounded-lg border text-[10px] font-black tracking-wide flex items-center gap-1 ${
                false
                  ? "bg-[#FAF6EE] border-[#E1D4C0] text-[#6C5E53]"
                  : "bg-zinc-900/60 border-theme text-secondary"
              }`}
            >
              <Star size={10} />
              <span>最佳: {bestTargetCount}目标</span>
            </div>
          </div>
        </div>

        {/* Right - Timer */}
        <div
          className={`px-3 py-1.5 rounded-xl border flex flex-col items-center min-w-[70px] ${"bg-zinc-900/60 border border-theme"}`}
        >
          <span
            className={`text-[8px] uppercase tracking-wider font-bold ${"text-muted"}`}
          >
            回忆用时
          </span>
          <span
            className={`text-xs font-black font-mono leading-none mt-1 ${"text-white"}`}
          >
            {recallTime}s
          </span>
        </div>
      </div>

      {/* Main Game Board Wrapper */}
      <div
        className={`relative max-w-md mx-auto w-full p-3 rounded-2xl flex flex-col justify-center border transition-all duration-300 ${"bg-zinc-950/80 border border-theme"}`}
      >
        {/* Phase indicator */}
        <div className="flex items-center justify-between px-1 mb-2.5">
          <div className="flex items-center gap-2">
            {phase === "flash" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-1.5"
              >
                <div
                  className={`w-2 h-2 rounded-full ${"bg-amber-400"} animate-pulse`}
                />
                <span
                  className={`text-[10px] font-black tracking-wider ${"text-amber-400"}`}
                >
                  瞬时记忆阶段 · 正在闪烁
                </span>
              </motion.div>
            )}
            {phase === "recall" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-1.5"
              >
                <div
                  className={`w-2 h-2 rounded-full ${"bg-emerald-400"} animate-pulse`}
                />
                <span
                  className={`text-[10px] font-black tracking-wider ${"text-emerald-400"}`}
                >
                  空间回忆阶段 · 点击目标格
                </span>
              </motion.div>
            )}
            {phase === "result" && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex items-center gap-1.5"
              >
                <div className={`w-2 h-2 rounded-full ${"text-indigo-400"}`} />
                <span
                  className={`text-[10px] font-black tracking-wider ${"text-indigo-400"}`}
                >
                  本轮结算
                </span>
              </motion.div>
            )}
          </div>

          {phase === "recall" && (
            <span className={`text-[10px] font-bold ${"text-muted"}`}>
              已选择 {selectedCount}/{targetIds.size}
            </span>
          )}
        </div>

        {/* The Matrix Grid */}
        <div
          className="grid gap-1.5 w-full aspect-square"
          style={{
            gridTemplateRows: `repeat(${gridSize}, 1fr)`,
            gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
          }}
        >
          {cells.map((cell) => {
            const isFlashing = phase === "flash" && cell.isTarget;
            const isRevealedMiss =
              phase === "result" && cell.isTarget && !cell.isSelected;
            const isCorrectHit = cell.isSelected && !cell.isWrong;
            const isWrongHit = cell.isSelected && cell.isWrong;

            let cellContent: React.ReactNode = null;

            // Flash phase: show dots on targets
            if (isFlashing) {
              cellContent = (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{
                    scale: [0, 1.2, 1],
                    opacity: [0, 1, 0.8],
                  }}
                  transition={{ duration: 0.5, ease: "easeOut" }}
                  className="w-full h-full rounded-lg flex items-center justify-center"
                  style={{
                    background: `radial-gradient(circle, ${flashGlowColor.from}99, ${flashGlowColor.to}44)`,
                    boxShadow: `0 0 25px ${flashGlowColor.from}88, inset 0 0 15px ${flashGlowColor.from}44`,
                  }}
                >
                  <motion.div
                    animate={{
                      scale: [1, 1.15, 1],
                      opacity: [0.8, 1, 0.8],
                    }}
                    transition={{
                      duration: 1.2,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    className={`w-3 h-3 rounded-full ${"bg-white"} shadow-lg`}
                    style={{
                      boxShadow: `0 0 12px ${flashGlowColor.from}`,
                    }}
                  />
                </motion.div>
              );
            }

            // Result phase: show missed targets
            if (isRevealedMiss) {
              cellContent = (
                <div className="w-full h-full rounded-lg flex items-center justify-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", stiffness: 200 }}
                    className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${"border-amber-500/60 bg-amber-500/10"}`}
                  >
                    <span
                      className={`text-[8px] font-black ${"text-amber-400"}`}
                    >
                      ?
                    </span>
                  </motion.div>
                </div>
              );
            }

            // Correct hit
            if (isCorrectHit) {
              cellContent = (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 15 }}
                  className="w-full h-full rounded-lg flex items-center justify-center"
                >
                  <div
                    className={`w-5 h-5 rounded-full flex items-center justify-center ${"bg-emerald-500 text-zinc-950"}`}
                  >
                    <Sparkles size={10} />
                  </div>
                </motion.div>
              );
            }

            // Wrong hit
            if (isWrongHit) {
              cellContent = (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, damping: 15 }}
                  className="w-full h-full rounded-lg flex items-center justify-center"
                >
                  <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center text-white font-black text-xs">
                    ✕
                  </div>
                </motion.div>
              );
            }

            const bgClass = getCellBackground(cell);

            return (
              <button
                key={cell.id}
                onClick={() => handleCellClick(cell)}
                disabled={
                  phase !== "recall" || isGameComplete || cell.isSelected
                }
                className={`relative rounded-xl border-2 transition-all duration-200 cursor-pointer disabled:cursor-default overflow-hidden
                  ${bgClass}
                  ${isFlashing ? "" : ""}
                  ${
                    phase === "recall" && !cell.isSelected && !isGameComplete
                      ? false
                        ? "hover:shadow-md active:scale-95"
                        : "hover:shadow-lg hover:shadow-emerald-500/5 active:scale-95"
                      : ""
                  }
                  ${isWrongHit ? "animate-shake" : ""}
                `}
                style={{
                  ...(isFlashing ? getFlashStyle(true) : {}),
                  borderRadius: "10px",
                }}
              >
                {/* Flash phase glow overlay */}
                {isFlashing && (
                  <motion.div
                    className="absolute inset-0 rounded-xl"
                    animate={{
                      opacity: [0.4, 0.8, 0.4],
                    }}
                    transition={{
                      duration: 1.5,
                      repeat: Infinity,
                      ease: "easeInOut",
                    }}
                    style={{
                      background: `radial-gradient(circle at center, ${flashGlowColor.from}66, transparent 70%)`,
                    }}
                  />
                )}

                {/* Cell content */}
                <div className="relative z-10 w-full h-full flex items-center justify-center">
                  {cellContent}
                </div>
              </button>
            );
          })}
        </div>

        {/* Result Overlay */}
        <AnimatePresence>
          {phase === "result" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/80 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-6 z-20 text-center select-none"
            >
              <motion.div
                initial={{ scale: 0.85, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                className="flex flex-col items-center max-w-sm"
              >
                {/* Win state */}
                {selectedCount >= targetIds.size ? (
                  <>
                    <div className="w-14 h-14 bg-emerald-500/10 rounded-full border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{
                          duration: 2,
                          repeat: Infinity,
                          ease: "linear",
                        }}
                      >
                        <Brain size={26} />
                      </motion.div>
                    </div>

                    <h3 className="text-lg font-black text-white uppercase tracking-wider">
                      完美回忆！
                    </h3>
                    <p className="text-xs text-secondary mt-2 font-medium">
                      成功在 {gridSize}x{gridSize} 网格中精准定位了所有{" "}
                      {targetIds.size} 个目标块， 视觉空间暂存器表现卓越！
                    </p>

                    {/* Score details */}
                    <div className="bg-zinc-900 border border-theme px-4 py-2.5 rounded-xl w-full mt-4 flex items-center justify-around text-left">
                      <div>
                        <span className="text-[10px] text-muted block leading-none">
                          回忆用时
                        </span>
                        <span className="text-sm font-black font-mono text-emerald-400 mt-1 block">
                          {recallTime}s
                        </span>
                      </div>
                      <div className="w-px h-6 bg-zinc-800" />
                      <div>
                        <span className="text-[10px] text-muted block leading-none">
                          消解负熵
                        </span>
                        <span className="text-sm font-black font-mono text-indigo-400 mt-1 block flex items-center gap-1">
                          <Flame size={12} className="text-rose-400" />
                          <span>{getEntropyPoints(targetCount)} P</span>
                        </span>
                      </div>
                      <div className="w-px h-6 bg-zinc-800" />
                      <div>
                        <span className="text-[10px] text-muted block leading-none">
                          当前连胜
                        </span>
                        <span className="text-sm font-black font-mono text-amber-400 mt-1 block">
                          {streak}
                        </span>
                      </div>
                    </div>

                    {/* Level up hint */}
                    {streak >= 2 && (
                      <motion.div
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mt-3 flex items-center gap-1.5 text-[10px] font-bold text-amber-400 bg-amber-500/10 px-3 py-1.5 rounded-full border border-amber-500/30"
                      >
                        <ChevronUp size={12} />
                        <span>
                          连续 {streak} 次通关！即将提升至 {targetCount + 1}{" "}
                          个目标
                        </span>
                      </motion.div>
                    )}

                    <button
                      onClick={handleNextRound}
                      className="mt-5 w-full py-2.5 px-6 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-md cursor-pointer active:scale-95 transition-all text-center flex items-center justify-center gap-1.5"
                    >
                      <Sparkles size={14} />
                      <span>继续挑战下一轮</span>
                    </button>
                  </>
                ) : (
                  <>
                    {/* Loss state */}
                    <div className="w-14 h-14 bg-red-500/10 rounded-full border border-red-500/30 flex items-center justify-center text-red-400 mb-4 animate-pulse">
                      <Cpu size={26} />
                    </div>

                    <h3 className="text-lg font-black text-white uppercase tracking-wider">
                      空间记忆偏差
                    </h3>
                    <p className="text-xs text-secondary mt-2 font-medium">
                      未能完全复现 {targetIds.size}{" "}
                      个目标的空间格局。工作记忆对焦需要重新校准。
                    </p>

                    {/* Missed targets summary */}
                    <div className="bg-zinc-900 border border-theme px-4 py-2.5 rounded-xl w-full mt-4 flex items-center justify-around text-left">
                      <div>
                        <span className="text-[10px] text-muted block leading-none">
                          正确回忆
                        </span>
                        <span className="text-sm font-black font-mono text-emerald-400 mt-1 block">
                          {selectedCount} / {targetIds.size}
                        </span>
                      </div>
                      <div className="w-px h-6 bg-zinc-800" />
                      <div>
                        <span className="text-[10px] text-muted block leading-none">
                          回忆用时
                        </span>
                        <span className="text-sm font-black font-mono text-theme mt-1 block">
                          {recallTime}s
                        </span>
                      </div>
                    </div>

                    <div className="flex gap-2.5 mt-5 w-full">
                      <button
                        onClick={handleLevelDownRetry}
                        className="flex-1 py-2 px-4 rounded-xl text-xs font-black bg-indigo-500 hover:bg-indigo-400 text-zinc-950 shadow-md cursor-pointer active:scale-95 transition-all text-center flex items-center justify-center gap-1"
                      >
                        <ChevronDown size={12} />
                        <span>
                          降阶重试 ({Math.max(3, targetCount - 1)}目标)
                        </span>
                      </button>
                      <button
                        onClick={handleNextRound}
                        className={`flex-1 py-2 px-4 rounded-xl text-xs font-black shadow active:scale-95 transition-all text-center ${
                          false
                            ? "bg-[#EFEADB] hover:bg-[#E1D6BF] text-[#4A3C31] border border-[#DFD3C1]"
                            : "bg-zinc-800 hover:bg-zinc-700 hover:text-white text-theme"
                        }`}
                      >
                        保持当前阶数
                      </button>
                    </div>
                  </>
                )}

                {/* Back & Reset row */}
                <div className="flex gap-2.5 mt-3 w-full">
                  <button
                    onClick={handleReset}
                    className="flex-1 py-2 px-4 rounded-lg text-[10px] font-bold bg-zinc-800 hover:bg-zinc-700 text-secondary hover:text-white cursor-pointer active:scale-95 transition-all flex items-center justify-center gap-1"
                  >
                    <RefreshCw size={12} />
                    <span>重置 (从3目标开始)</span>
                  </button>
                  <button
                    onClick={onGoBack}
                    className={`flex-1 py-2 px-4 rounded-lg text-[10px] font-bold shadow active:scale-95 transition-all text-center ${
                      false
                        ? "bg-[#EFEADB] hover:bg-[#E1D6BF] text-[#4A3C31] border border-[#DFD3C1]"
                        : "bg-zinc-800/50 hover:bg-zinc-700/60 hover:text-white text-secondary"
                    }`}
                  >
                    返回大厅
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* How to Play Guide */}
      <div
        className={`max-w-md mx-auto w-full flex flex-col gap-2 p-3 rounded-xl border ${"bg-zinc-900/40 border border-theme"}`}
      >
        <div className="flex justify-between items-center px-1">
          <span
            className={`text-[9px] uppercase tracking-widest font-black ${"text-muted"}`}
          >
            玩法说明
          </span>
          <button
            onClick={() => setShowGuide((prev) => !prev)}
            className="text-[9px] font-bold text-indigo-400 hover:underline flex items-center gap-0.5"
          >
            <Info size={9} />
            <span>{showGuide ? "收起" : "展开"}</span>
          </button>
        </div>

        {showGuide && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className={`mt-0.5 p-2.5 rounded-lg border text-[10px] leading-relaxed flex flex-col gap-1.5 ${
              false
                ? "bg-[#FAF6EE]/80 border-[#E1D4C0] text-[#6C5E53]"
                : "bg-zinc-950/40 border-theme text-secondary"
            }`}
          >
            <p>
              🧠 <strong className="text-emerald-400">瞬时视觉暂存：</strong>{" "}
              网格中部分单元格会短暂闪烁（Glow脉冲），
              您需要在它们消失后准确回忆并点击所有目标位置。
            </p>
            <p>
              🎯 <strong className="text-amber-400">动态层级：</strong> 从 3
              个目标开始。 连续成功{" "}
              <strong className="text-emerald-400">2 次</strong>{" "}
              后自动增加目标数（升阶）； 失败后自动建议降阶重试。
            </p>
            <p>
              ⚡ <strong className="text-indigo-400">空间视觉训练：</strong>{" "}
              高阶挑战将扩大网格规模 (4x4 → 5x5 → 6x6 →
              7x7)，同时目标数量递增，训练工作记忆对焦与空间格局瞬时捕获能力。
            </p>
            <p>
              🔥 <strong className="text-rose-400">负熵消解：</strong>{" "}
              每次完美通关折算高额负熵值， 目标越高阶，消解熵增效果越显著。
            </p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
