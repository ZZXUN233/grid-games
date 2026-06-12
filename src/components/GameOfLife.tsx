import React, { useState, useEffect, useRef, useCallback } from "react";
import { GameTheme } from "../types";
import {
  Play,
  Pause,
  StepForward,
  RotateCcw,
  Sparkles,
  ArrowLeft,
  Flame,
  Dna,
  SkipForward,
  Info,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface GameOfLifeProps {
  theme: GameTheme;
  onGoBack: () => void;
  userNickname: string;
  onConsumeEntropy: (points: number) => Promise<void>;
}

const GRID_SIZE = 40;
const CELL_SIZE = 14;

// Preset patterns
const PRESETS: Record<string, { name: string; cells: [number, number][] }> = {
  glider: {
    name: "滑翔机 (Glider)",
    cells: [
      [1, 2],
      [2, 3],
      [3, 1],
      [3, 2],
      [3, 3],
    ],
  },
  pulsar: {
    name: "脉冲器 (Pulsar)",
    cells: (() => {
      const pts: [number, number][] = [];
      const offsets = [
        [2, 4],
        [2, 5],
        [2, 6],
        [2, 10],
        [2, 11],
        [2, 12],
        [4, 2],
        [5, 2],
        [6, 2],
        [4, 7],
        [5, 7],
        [6, 7],
        [4, 9],
        [5, 9],
        [6, 9],
        [4, 14],
        [5, 14],
        [6, 14],
        [7, 4],
        [7, 5],
        [7, 6],
        [7, 10],
        [7, 11],
        [7, 12],
        [9, 4],
        [9, 5],
        [9, 6],
        [9, 10],
        [9, 11],
        [9, 12],
        [10, 2],
        [11, 2],
        [12, 2],
        [10, 7],
        [11, 7],
        [12, 7],
        [10, 9],
        [11, 9],
        [12, 9],
        [10, 14],
        [11, 14],
        [12, 14],
        [14, 4],
        [14, 5],
        [14, 6],
        [14, 10],
        [14, 11],
        [14, 12],
      ];
      for (const [r, c] of offsets) pts.push([r + 3, c + 3]);
      return pts;
    })(),
  },
  gosper: {
    name: "高斯帕机枪 (Gosper Gun)",
    cells: (() => {
      const pts: [number, number][] = [
        [1, 25],
        [2, 23],
        [2, 25],
        [3, 13],
        [3, 14],
        [3, 21],
        [3, 22],
        [3, 35],
        [3, 36],
        [4, 12],
        [4, 16],
        [4, 21],
        [4, 22],
        [4, 35],
        [4, 36],
        [5, 1],
        [5, 2],
        [5, 11],
        [5, 17],
        [5, 21],
        [5, 22],
        [6, 1],
        [6, 2],
        [6, 11],
        [6, 15],
        [6, 17],
        [6, 18],
        [6, 23],
        [6, 25],
        [7, 11],
        [7, 17],
        [7, 25],
        [8, 12],
        [8, 16],
        [9, 13],
        [9, 14],
      ];
      return pts.map(([r, c]) => [r + 10, c + 5]);
    })(),
  },
  beacon: {
    name: "信标 (Beacon)",
    cells: [
      [1, 1],
      [1, 2],
      [2, 1],
      [2, 2],
      [3, 3],
      [3, 4],
      [4, 3],
      [4, 4],
    ],
  },
  toad: {
    name: "蛤蟆 (Toad)",
    cells: [
      [2, 2],
      [2, 3],
      [2, 4],
      [3, 1],
      [3, 2],
      [3, 3],
    ],
  },
  random: {
    name: "随机混沌",
    cells: [],
  },
};

export default function GameOfLife({
  theme,
  onGoBack,
  userNickname,
  onConsumeEntropy,
}: GameOfLifeProps) {
  const [grid, setGrid] = useState<boolean[][]>([]);
  const [running, setRunning] = useState(false);
  const [speed, setSpeed] = useState(2);
  const [generation, setGeneration] = useState(0);
  const [presetName, setPresetName] = useState("");
  const [showGuide, setShowGuide] = useState(false);
  const [entropyAwarded, setEntropyAwarded] = useState(false);
  const [stableCheck, setStableCheck] = useState(false);
  const prevGridRef = useRef<string>("");
  const stableGenerationsRef = useRef(0);
  const runningRef = useRef(running);
  runningRef.current = running;
  const speedRef = useRef(speed);
  speedRef.current = speed;

  // Init random grid
  const initRandom = useCallback(() => {
    const g: boolean[][] = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      g[r] = [];
      for (let c = 0; c < GRID_SIZE; c++) {
        g[r][c] = Math.random() < 0.25;
      }
    }
    setGrid(g);
    setGeneration(0);
    setEntropyAwarded(false);
    setStableCheck(false);
    stableGenerationsRef.current = 0;
  }, []);

  // Load a preset
  const loadPreset = useCallback((key: string) => {
    const preset = PRESETS[key];
    if (!preset) return;
    setPresetName(preset.name);
    setRunning(false);
    setGeneration(0);
    setEntropyAwarded(false);
    setStableCheck(false);
    stableGenerationsRef.current = 0;

    const g: boolean[][] = [];
    for (let r = 0; r < GRID_SIZE; r++) {
      g[r] = new Array(GRID_SIZE).fill(false);
    }
    if (key === "random") {
      for (let r = 0; r < GRID_SIZE; r++) {
        for (let c = 0; c < GRID_SIZE; c++) {
          g[r][c] = Math.random() < 0.3;
        }
      }
    } else {
      const offsetR = Math.floor((GRID_SIZE - 20) / 2);
      const offsetC = Math.floor((GRID_SIZE - 20) / 2);
      for (const [r, c] of preset.cells) {
        const nr = r + offsetR;
        const nc = c + offsetC;
        if (nr >= 0 && nr < GRID_SIZE && nc >= 0 && nc < GRID_SIZE) {
          g[nr][nc] = true;
        }
      }
    }
    setGrid(g);
  }, []);

  // Initial random on mount
  useEffect(() => {
    initRandom();
  }, [initRandom]);

  // Toggle cell
  const toggleCell = (r: number, c: number) => {
    if (running) return;
    setGrid((prev) => {
      const next = prev.map((row) => [...row]);
      next[r][c] = !next[r][c];
      return next;
    });
  };

  // Compute next generation
  const computeNext = useCallback((g: boolean[][]) => {
    const next: boolean[][] = g.map((row) => [...row]);
    for (let r = 0; r < GRID_SIZE; r++) {
      for (let c = 0; c < GRID_SIZE; c++) {
        let neighbors = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            if (dr === 0 && dc === 0) continue;
            const nr = (r + dr + GRID_SIZE) % GRID_SIZE;
            const nc = (c + dc + GRID_SIZE) % GRID_SIZE;
            if (g[nr][nc]) neighbors++;
          }
        }
        if (g[r][c]) {
          next[r][c] = neighbors === 2 || neighbors === 3;
        } else {
          next[r][c] = neighbors === 3;
        }
      }
    }
    return next;
  }, []);

  // Step one generation
  const stepOnce = useCallback(() => {
    setGrid((prev) => {
      const next = computeNext(prev);
      const nextKey = JSON.stringify(next);
      const prevKey = JSON.stringify(prev);
      if (nextKey === prevKey && !stableCheck) {
        setStableCheck(true);
        stableGenerationsRef.current = 0;
      } else if (nextKey === prevKey) {
        stableGenerationsRef.current++;
      } else {
        stableGenerationsRef.current = 0;
        setStableCheck(false);
      }
      return next;
    });
    setGeneration((prev) => prev + 1);
  }, [computeNext, stableCheck]);

  // Auto-run loop
  useEffect(() => {
    if (!running) return;
    const interval = setInterval(
      () => {
        stepOnce();
      },
      Math.max(50, 500 / speedRef.current)
    );
    return () => clearInterval(interval);
  }, [running, stepOnce, speed]);

  // Check entropy reward: stable for 20+ gens at milestones
  useEffect(() => {
    if (
      stableGenerationsRef.current >= 20 &&
      !entropyAwarded &&
      (generation >= 50 || generation >= 100 || generation >= 200)
    ) {
      setEntropyAwarded(true);
      const points = generation >= 200 ? 50 : generation >= 100 ? 30 : 15;
      onConsumeEntropy(points);
    }
  }, [generation, entropyAwarded, onConsumeEntropy]);

  const txtMuted = "text-secondary";
  const txtMain = "text-white";
  const borderCls = "border-theme";
  const bgCard = "bg-zinc-900/40";

  return (
    <div className={`w-full flex flex-col gap-4 select-none ${"text-theme"}`}>
      {/* Header */}
      <div
        className={`flex items-center justify-between pb-3.5 border-b w-full px-1 ${borderCls}`}
      >
        <button
          onClick={onGoBack}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer active:scale-95 transition-all ${"bg-zinc-800/60 border border-theme hover:bg-zinc-800 hover:text-white text-secondary"}`}
        >
          <ArrowLeft size={13} /> <span>返回大厅</span>
        </button>
        <div className="flex items-center gap-1.5">
          <div
            className={`w-2.5 h-2.5 rounded-full ${running ? "bg-emerald-500 animate-pulse" : stableCheck ? "bg-amber-500" : "bg-zinc-500"}`}
          />
          <span
            className={`text-[11px] font-mono tracking-wider uppercase ${txtMuted}`}
          >
            元胞生活 · LIFE
          </span>
        </div>
      </div>

      {/* Stats bar */}
      <div className="flex flex-wrap items-center gap-3 px-2 py-1">
        <div className="flex items-center gap-1">
          <span className={`text-[10px] ${txtMuted}`}>挑战者：</span>
          <span className={`text-xs font-bold font-mono ${txtMain}`}>
            {userNickname}
          </span>
        </div>
        <div className={`px-2 py-1 rounded-lg border ${borderCls} ${bgCard}`}>
          <span
            className={`text-[9px] font-mono font-bold ${"text-emerald-400"}`}
          >
            ♾ {generation} 代
          </span>
        </div>
        <div className={`px-2 py-1 rounded-lg border ${borderCls} ${bgCard}`}>
          <span
            className={`text-[9px] font-mono font-bold ${"text-indigo-400"}`}
          >
            ● {grid.flat().filter(Boolean).length} 活
          </span>
        </div>
      </div>

      {/* Preset buttons */}
      <div className="flex flex-wrap gap-1.5 px-2">
        {Object.entries(PRESETS).map(([key, preset]) => (
          <button
            key={key}
            onClick={() => loadPreset(key)}
            className={`px-2 py-1 rounded-lg text-[9px] font-bold border cursor-pointer transition-all active:scale-95 ${
              key === "random"
                ? "bg-amber-500/10 border-amber-500/30 text-amber-400 hover:bg-amber-500/20"
                : `${bgCard} ${borderCls} ${txtMuted} hover:border-emerald-500/40 hover:text-emerald-400`
            }`}
          >
            {preset.name}
          </button>
        ))}
      </div>

      {/* Controls */}
      <div
        className={`flex items-center justify-center gap-2 p-2 rounded-xl border ${borderCls} ${bgCard} max-w-sm mx-auto w-full`}
      >
        <button
          onClick={() => setRunning(!running)}
          className={`p-2 rounded-lg text-xs font-black cursor-pointer transition-all active:scale-90 ${
            running
              ? "bg-amber-500 text-zinc-950 shadow-lg"
              : "bg-emerald-500 text-zinc-950"
          }`}
        >
          {running ? <Pause size={16} /> : <Play size={16} />}
        </button>
        <button
          onClick={stepOnce}
          disabled={running}
          className="p-2 rounded-lg bg-zinc-800/50 text-secondary hover:text-white cursor-pointer disabled:opacity-30 transition-all active:scale-90"
        >
          <StepForward size={16} />
        </button>
        <button
          onClick={() => {
            setRunning(false);
            loadPreset("random");
          }}
          className="p-2 rounded-lg bg-zinc-800/50 text-secondary hover:text-amber-400 cursor-pointer transition-all active:scale-90"
        >
          <RotateCcw size={16} />
        </button>
        <div className="flex items-center gap-1.5 px-2">
          <span className={`text-[9px] font-mono ${txtMuted}`}>速度</span>
          <input
            type="range"
            min="1"
            max="10"
            value={speed}
            onChange={(e) => setSpeed(Number(e.target.value))}
            className="w-16 h-1 accent-emerald-500 cursor-pointer"
          />
          <span
            className={`text-[9px] font-mono font-bold ${"text-emerald-400"}`}
          >
            {speed}x
          </span>
        </div>
      </div>

      {/* Grid container */}
      <div className="flex justify-center">
        <div
          className="inline-block p-1.5 rounded-2xl border"
          style={{
            backgroundColor: "#09090B",
            borderColor: "rgba(39,39,42,0.5)",
          }}
        >
          <div
            className="grid gap-[1px]"
            style={{ gridTemplateColumns: `repeat(${GRID_SIZE}, 1fr)` }}
          >
            {grid.map((row, r) =>
              row.map((alive, c) => (
                <div
                  key={`${r}-${c}`}
                  onClick={() => toggleCell(r, c)}
                  className="cursor-pointer transition-all duration-200 rounded-sm"
                  style={{
                    width: CELL_SIZE,
                    height: CELL_SIZE,
                    backgroundColor: alive ? "#34D399" : "#18181B",
                    boxShadow: alive
                      ? `0 0 4px ${"rgba(52,211,153,0.25)"}`
                      : "none",
                  }}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Entropy reward notice */}
      {entropyAwarded && (
        <div
          className={`text-center text-[10px] font-bold py-1 ${"text-emerald-400"} animate-pulse`}
        >
          已达成稳定环状态，负熵已消解
        </div>
      )}

      {/* Guide */}
      <div
        className={`max-w-sm mx-auto w-full p-2.5 rounded-xl border ${borderCls} ${bgCard}`}
      >
        <div className="flex justify-between items-center">
          <span
            className={`text-[9px] uppercase tracking-widest font-black ${txtMuted}`}
          >
            玩法说明
          </span>
          <button
            onClick={() => setShowGuide(!showGuide)}
            className="text-[9px] font-bold text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer"
          >
            <Info size={9} /> <span>{showGuide ? "收起" : "展开"}</span>
          </button>
        </div>
        {showGuide && (
          <div
            className={`mt-1.5 p-2 rounded-lg border text-[10px] leading-relaxed ${"bg-zinc-950/40 border-theme text-secondary"}`}
          >
            <p>
              🧬 <strong>生命游戏：</strong>{" "}
              每个元胞的生死取决于相邻元胞数。活元胞 2-3 个邻居存活，死元胞恰好
              3 个邻居则新生。
            </p>
            <p>
              🎭 <strong>预设：</strong>{" "}
              滑翔机、脉冲器、高斯帕机枪等经典模式可直接加载观赏。
            </p>
            <p>
              � <strong>熵奖励：</strong> 在冥想观测模式下，演化达到 50/100/200
              代并进入稳定环状态时，结算渐进式负熵抗熵回馈。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
