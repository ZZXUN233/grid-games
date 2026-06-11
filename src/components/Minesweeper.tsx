import React, { useState, useEffect, useRef } from 'react';
import { GameTheme, ScoreRecord } from '../types';
import { 
  Bomb, 
  Flag, 
  RefreshCw, 
  ArrowLeft, 
  Trophy, 
  Flame, 
  Sparkles, 
  Clock,
  Eye,
  Zap,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

interface MinesweeperProps {
  theme: GameTheme;
  onGoBack: () => void;
  userNickname: string;
  onConsumeEntropy: (points: number) => Promise<void>;
  onScoreSubmit?: (score: ScoreRecord) => Promise<void>;
  currentUserId?: string;
  avatarColor?: string;
  avatarEmoji?: string;
  initialDifficulty?: 'easy' | 'medium' | 'hard';
}

interface Cell {
  r: number;
  c: number;
  isMine: boolean;
  isRevealed: boolean;
  isFlagged: boolean;
  neighborMines: number;
}

export default function Minesweeper({
  theme,
  onGoBack,
  userNickname,
  onConsumeEntropy,
  onScoreSubmit,
  currentUserId = 'mines-tester',
  avatarColor = '#64748B',
  avatarEmoji = '💣',
  initialDifficulty = 'medium'
}: MinesweeperProps) {
  
  // Game state parameters depending on difficulty
  const [difficulty, setDifficulty] = useState<'easy' | 'medium' | 'hard'>(initialDifficulty);
  
  // Board states
  const [board, setBoard] = useState<Cell[][]>([]);
  const [isGameOver, setIsGameOver] = useState(false);
  const [isGameWon, setIsGameWon] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false); // true once first click seeds mines
  const [mineCount, setMineCount] = useState(10);
  const [flagCount, setFlagCount] = useState(0);

  // Stats
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Mobile Tap Action mode: 'dig' = Left-click / Reveal, 'flag' = Right-click / Flag
  const [mobileMode, setMobileMode] = useState<'dig' | 'flag'>('dig');

  // Help guides
  const [showGuide, setShowGuide] = useState(true);

  const isLight = theme.id === 'sepia-light';

  // Get difficulty parameters
  const getDifficultyParams = (diff: 'easy' | 'medium' | 'hard') => {
    switch (diff) {
      case 'easy':
        return { rows: 9, cols: 9, mines: 10, entropyPoints: 20 };
      case 'hard':
        return { rows: 15, cols: 15, mines: 35, entropyPoints: 60 }; // optimized for responsive frame sizes
      case 'medium':
      default:
        return { rows: 12, cols: 12, mines: 22, entropyPoints: 35 };
    }
  };

  const { rows, cols, mines: totalMines, entropyPoints } = getDifficultyParams(difficulty);

  // Initialize fresh blank board
  const initBlankBoard = () => {
    const newBoard: Cell[][] = [];
    for (let r = 0; r < rows; r++) {
      const row: Cell[] = [];
      for (let c = 0; c < cols; c++) {
        row.push({
          r,
          c,
          isMine: false,
          isRevealed: false,
          isFlagged: false,
          neighborMines: 0
        });
      }
      newBoard.push(row);
    }
    setBoard(newBoard);
    setIsGameOver(false);
    setIsGameWon(false);
    setIsInitialized(false);
    setFlagCount(0);
    setTimer(0);
    setIsTimerRunning(false);
    if (timerRef.current) clearInterval(timerRef.current);
  };

  // Generate board and trigger after first click to avoid instant loss
  const seedMinesAndCalculate = (firstR: number, firstC: number) => {
    const newBoard = board.map(row => row.map(cell => ({ ...cell })));
    
    // Seed mines, excluding the 3x3 region around the first-clicked cell (guaranteed empty)
    let minesPlaced = 0;
    while (minesPlaced < totalMines) {
      const r = Math.floor(Math.random() * rows);
      const c = Math.floor(Math.random() * cols);
      
      const isTooClose = Math.abs(r - firstR) <= 1 && Math.abs(c - firstC) <= 1;
      
      if (!newBoard[r][c].isMine && !isTooClose) {
        newBoard[r][c].isMine = true;
        minesPlaced++;
      }
    }

    // Calculate neighbor counts
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (newBoard[r][c].isMine) continue;
        
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
              if (newBoard[nr][nc].isMine) count++;
            }
          }
        }
        newBoard[r][c].neighborMines = count;
      }
    }

    return newBoard;
  };

  // Run on mounting or difficulty change
  useEffect(() => {
    initBlankBoard();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [difficulty]);

  // Timer runner logic
  useEffect(() => {
    if (isTimerRunning && !isGameOver && !isGameWon) {
      timerRef.current = setInterval(() => {
        setTimer(prev => prev + 1);
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isTimerRunning, isGameOver, isGameWon]);

  // Check general win conditions: all non-mine cells revealed
  const checkWinCondition = (currentBoard: Cell[][]) => {
    let win = true;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const cell = currentBoard[r][c];
        if (!cell.isMine && !cell.isRevealed) {
          win = false;
          break;
        }
      }
      if (!win) break;
    }
    return win;
  };

  // Flood fill blank cell reveal
  const revealCellAndNeighbors = (b: Cell[][], r: number, c: number) => {
    if (r < 0 || r >= rows || c < 0 || c >= cols) return;
    const cell = b[r][c];
    if (cell.isRevealed || cell.isFlagged) return;

    cell.isRevealed = true;

    // If it's empty (no neighboring mines), recursively trigger neighbors
    if (cell.neighborMines === 0 && !cell.isMine) {
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          revealCellAndNeighbors(b, r + dr, c + dc);
        }
      }
    }
  };

  // Interaction: Right Click (Flagging)
  const handleCellRightClick = (e: React.MouseEvent, r: number, c: number) => {
    e.preventDefault();
    if (isGameOver || isGameWon) return;
    
    const newBoard = board.map(row => row.map(cell => ({ ...cell })));
    const cell = newBoard[r][c];
    
    if (cell.isRevealed) return;

    // Toggle Flag
    const nextFlagged = !cell.isFlagged;
    cell.isFlagged = nextFlagged;
    setFlagCount(prev => prev + (nextFlagged ? 1 : -1));
    setBoard(newBoard);

    // Dynamic start timer if not yet running
    if (!isTimerRunning && isInitialized) {
      setIsTimerRunning(true);
    }
  };

  // Interaction: Left Click (Reveal)
  const handleCellLeftClick = (r: number, c: number) => {
    if (isGameOver || isGameWon) return;

    let currentBoard = board.map(row => row.map(cell => ({ ...cell })));
    let tempInitialized = isInitialized;

    // Guarantee first click safety: Seed mines AFTER the user taps their first tile
    if (!tempInitialized) {
      currentBoard = seedMinesAndCalculate(r, c);
      setIsInitialized(true);
      setIsTimerRunning(true);
      tempInitialized = true;
    }

    const cell = currentBoard[r][c];
    if (cell.isFlagged || cell.isRevealed) return;

    // Reveal
    if (cell.isMine) {
      // Exploded! Show all mines and end game
      cell.isRevealed = true;
      setIsGameOver(true);
      setIsTimerRunning(false);
      
      // Reveal all other mines
      for (let i = 0; i < rows; i++) {
        for (let j = 0; j < cols; j++) {
          if (currentBoard[i][j].isMine) {
            currentBoard[i][j].isRevealed = true;
          }
        }
      }
    } else {
      revealCellAndNeighbors(currentBoard, r, c);
      
      // Check win
      if (checkWinCondition(currentBoard)) {
        setIsGameWon(true);
        setIsTimerRunning(false);
        handleGameWin();
      }
    }

    setBoard(currentBoard);
  };

  // Master win routing: reduces negative entropy and logs scorecard to Firebase
  const handleGameWin = async () => {
    // 1. Reduce entropy
    await onConsumeEntropy(entropyPoints);

    // 2. Format a local score record
    const record: ScoreRecord = {
      id: `${currentUserId || 'tester'}_mines_${Date.now()}`,
      userId: currentUserId,
      nickname: userNickname,
      avatarColor: avatarColor,
      avatarEmoji: avatarEmoji,
      game: 'minesweeper',
      mode: 'minesweeper',
      difficulty: `扫雷 [${difficulty === 'easy' ? '初级' : difficulty === 'medium' ? '中级' : '高级'}]`,
      time: timer,
      createdAt: Date.now()
    };

    if (onScoreSubmit) {
      await onScoreSubmit(record);
    }
  };

  // Chord click (Quick layout clearing when surrounding flags match cell's neighboring mines)
  const handleChordClick = (r: number, c: number) => {
    const cell = board[r][c];
    if (!cell.isRevealed || cell.neighborMines === 0) return;

    // Count flagged neighbors
    let flagCountCheck = 0;
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
          if (board[nr][nc].isFlagged) flagCountCheck++;
        }
      }
    }

    // If flagged neighbors match exact mine quantity, clear remaining unflagged spaces safely
    if (flagCountCheck === cell.neighborMines) {
      const newBoard = board.map(row => row.map(cell => ({ ...cell })));
      let exploded = false;

      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) {
          const nr = r + dr;
          const nc = c + dc;
          if (nr >= 0 && nr < rows && nc >= 0 && nc < cols) {
            const tempCell = newBoard[nr][nc];
            if (!tempCell.isRevealed && !tempCell.isFlagged) {
              if (tempCell.isMine) {
                tempCell.isRevealed = true;
                exploded = true;
              } else {
                revealCellAndNeighbors(newBoard, nr, nc);
              }
            }
          }
        }
      }

      if (exploded) {
        setIsGameOver(true);
        setIsTimerRunning(false);
        // Reveal all mines as death visual
        for (let i = 0; i < rows; i++) {
          for (let j = 0; j < cols; j++) {
            if (newBoard[i][j].isMine) {
              newBoard[i][j].isRevealed = true;
            }
          }
        }
      } else if (checkWinCondition(newBoard)) {
        setIsGameWon(true);
        setIsTimerRunning(false);
        handleGameWin();
      }

      setBoard(newBoard);
    }
  };

  // Helper handling tap action depending on mobile modes (reveal vs flag)
  const handleCellClickOrTap = (r: number, c: number) => {
    if (mobileMode === 'dig') {
      handleCellLeftClick(r, c);
    } else {
      // Simulate right click flagging
      const fakeEvent = { preventDefault: () => {} } as React.MouseEvent;
      handleCellRightClick(fakeEvent, r, c);
    }
  };

  // CSS colors mapping for neighboring mines count
  const getNumberColor = (num: number) => {
    if (isLight) {
      switch (num) {
        case 1: return 'text-sky-800 font-black';
        case 2: return 'text-emerald-800 font-black';
        case 3: return 'text-rose-800 font-semibold';
        case 4: return 'text-violet-850 font-black';
        case 5: return 'text-amber-900 font-extrabold';
        case 6: return 'text-teal-900 font-black';
        case 7: return 'text-[#4A3C31] font-black';
        default: return 'text-zinc-900 font-black';
      }
    } else {
      switch (num) {
        case 1: return 'text-[#60A5FA] font-black'; // Vivid blue
        case 2: return 'text-[#34D399] font-black'; // Lime emerald
        case 3: return 'text-[#F87171] font-semibold'; // Vibrant red
        case 4: return 'text-[#C084FC] font-black'; // Purple
        case 5: return 'text-[#FBBF24] font-extrabold'; // Amber gold
        case 6: return 'text-[#2DD4BF] font-black'; // Cyan
        case 7: return 'text-[#F472B6] font-black'; // Rose pink
        default: return 'text-zinc-100 font-black';
      }
    }
  };

  // Get status emoticons for header button
  const getSmileEmote = () => {
    if (isGameOver) return '😵';
    if (isGameWon) return '😎';
    return '😊';
  };

  return (
    <div className={`w-full flex flex-col gap-4 select-none ${isLight ? 'text-[#4A3C31]' : 'text-zinc-300'}`}>
      
      {/* Sub-header Navigation row */}
      <div className={`flex items-center justify-between pb-3.5 border-b w-full px-1 ${
        isLight ? 'border-[#E1D4C0]' : 'border-zinc-800/60'
      }`}>
        <button
          onClick={onGoBack}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer active:scale-95 transition-all ${
            isLight 
              ? 'bg-[#EFEADB] hover:bg-[#E1D6BF] text-[#4A3C31] border border-[#DFD3C1]' 
              : 'bg-zinc-800/60 border border-zinc-700/50 hover:bg-zinc-805 hover:text-white text-zinc-400'
          }`}
        >
          <ArrowLeft size={13} />
          <span>返回大厅</span>
        </button>

        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-indigo-500 animate-pulse" />
          <span className={`text-[11px] font-mono tracking-wider block uppercase ${isLight ? 'text-[#8B5A2B]' : 'text-zinc-500'}`}>
            扫雷 · COMBAT ENTROPY
          </span>
        </div>
      </div>

      {/* Profile Info and Difficulty selectors */}
      <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between px-2 py-1">
        
        {/* Left segment - Nickname & Diff selectors */}
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline gap-1">
            <span className={`text-xs ${isLight ? 'text-[#81745E]' : 'text-zinc-500'}`}>挑战者：</span>
            <span className={`text-sm font-bold font-mono tracking-wide ${isLight ? 'text-[#4A3C31]' : 'text-white'}`}>
              {userNickname}
            </span>
          </div>

          {/* Preset parameters buttons */}
          <div className="flex gap-1.5">
            {(['easy', 'medium', 'hard'] as const).map(diff => (
              <button
                key={diff}
                onClick={() => setDifficulty(diff)}
                className={`px-2 py-1 rounded text-[10px] font-black tracking-wide border cursor-pointer active:scale-95 transition-all uppercase ${
                  difficulty === diff
                    ? isLight 
                      ? 'bg-[#8B5A2B] text-white border-[#8B5A2B] shadow-sm' 
                      : 'bg-indigo-600 border-indigo-500 text-white shadow-[0_0_10px_rgba(99,102,241,0.25)]'
                    : isLight 
                      ? 'bg-[#EFEADB]/50 hover:bg-[#E1D6BF] text-[#6C5E53] border-[#DFD3C1]' 
                      : 'bg-zinc-900/40 hover:bg-zinc-850 text-zinc-400 border-zinc-800'
                }`}
              >
                {diff === 'easy' ? '初级 (9x9)' : diff === 'medium' ? '中级 (12x12)' : '高级 (15x15)'}
              </button>
            ))}
          </div>
        </div>

        {/* Right segment - Real Time Stat Boards */}
        <div className="flex items-center gap-2自适应 justify-end">
          
          {/* MINE COUNTER BOARD */}
          <div className={`px-3 py-1.5 rounded-xl border flex flex-col items-center min-w-[70px] ${
            isLight ? 'bg-[#FAF6EE] border-[#E1D4C0]' : 'bg-zinc-900/60 border border-zinc-800'
          }`}>
            <span className={`text-[8px] uppercase tracking-wider font-bold ${isLight ? 'text-[#81745E]' : 'text-zinc-500'}`}>
              雷数/旗
            </span>
            <span className={`text-xs font-black font-mono leading-none mt-1 ${isLight ? 'text-[#8B5A2B]' : 'text-indigo-400'}`}>
              {totalMines - flagCount}
            </span>
          </div>

          {/* Smiley state indicator button reset */}
          <button
            onClick={initBlankBoard}
            className={`w-10 h-10 rounded-xl flex items-center justify-center text-lg active:scale-90 border transition-all cursor-pointer ${
              isLight 
                ? 'bg-[#FAF6EE] border-[#E1D4C0] hover:bg-[#E1D6BF]' 
                : 'bg-zinc-850 hover:bg-zinc-800 border-zinc-800 text-zinc-200'
            }`}
            title="重新洗牌 (再来一局)"
          >
            {getSmileEmote()}
          </button>

          {/* TIMER BOARD */}
          <div className={`px-2.5 py-1.5 rounded-xl border flex flex-col items-center min-w-[70px] ${
            isLight ? 'bg-[#FAF6EE] border-[#E1D4C0]' : 'bg-zinc-900/60 border border-zinc-800'
          }`}>
            <span className={`text-[8px] uppercase tracking-wider font-bold flex items-center gap-0.5 ${
              isLight ? 'text-[#81745E]' : 'text-zinc-500'
            }`}>
              用时 <Clock size={8} className={isTimerRunning ? 'animate-spin' : ''} style={{ animationDuration: '4s' }} />
            </span>
            <span className={`text-xs font-black font-mono leading-none mt-1 ${isLight ? 'text-[#4A3C31]' : 'text-white'}`}>
              {timer}s
            </span>
          </div>

        </div>
      </div>

      {/* Main Grid Game board Wrapper */}
      <div className={`relative max-w-lg mx-auto w-full p-2 rounded-2xl flex flex-col justify-center border transition-all duration-300 ${
        isLight ? 'bg-[#DFD3C1] border-[#E1D4C0] shadow-sm' : 'bg-zinc-950/80 border border-zinc-850'
      }`}>
        
        {/* Dynamically styled Board layout */}
        <div 
          className="grid gap-[2px] w-full aspect-square"
          style={{ 
            gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
            gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` 
          }}
        >
          {board.map((row, r) => 
            row.map((cell, c) => {
              const showOpened = cell.isRevealed;
              const hasFlag = cell.isFlagged;
              
              const isBgOdd = (r + c) % 2 === 0;

              // Compute cell background
              let cellBg = '';
              if (showOpened) {
                if (cell.isMine) {
                  cellBg = isLight ? 'bg-red-200 text-red-700' : 'bg-red-950/50 text-red-400';
                } else {
                  // revealed safe block
                  cellBg = isLight 
                    ? isBgOdd ? 'bg-[#FAF6EE]' : 'bg-[#F2ECE0]' 
                    : isBgOdd ? 'bg-zinc-900/60' : 'bg-zinc-900/40';
                }
              } else {
                // unrevealed button
                cellBg = isLight
                  ? isBgOdd ? 'bg-[#EFEADB] hover:bg-[#E1D6BF]' : 'bg-[#E5DFCE] hover:bg-[#D4CBB6]'
                  : isBgOdd ? 'bg-zinc-800' : 'bg-zinc-850';
              }

              return (
                <button
                  key={`cell-${r}-${c}`}
                  onClick={() => handleCellClickOrTap(r, c)}
                  onContextMenu={(e) => handleCellRightClick(e, r, c)}
                  onDoubleClick={() => handleChordClick(r, c)}
                  // Support touch double tap chord triggers as well for mobile accessibility
                  onTouchEnd={(e) => {
                    // Custom double tap detection for chord
                    const now = Date.now();
                    const lastTap = (e.currentTarget as any).lastTap || 0;
                    if (now - lastTap < 300) {
                      handleChordClick(r, c);
                    }
                    (e.currentTarget as any).lastTap = now;
                  }}
                  className={`w-full h-full rounded-md flex items-center justify-center relative cursor-pointer font-bold select-none text-xs md:text-sm shadow-inner transition-colors duration-200 border-t border-l ${cellBg} ${
                    isLight 
                      ? 'border-[#FAF6EE]/15' 
                      : 'border-white/5'
                  }`}
                  style={{
                    fontSize: cols > 12 ? '10px' : '13px'
                  }}
                  disabled={isGameOver || isGameWon}
                >
                  {/* CELL INTERIOR CONTENTS */}
                  {showOpened ? (
                    cell.isMine ? (
                      <Bomb size={cols > 12 ? 11 : 14} className="animate-bounce" />
                    ) : (
                      cell.neighborMines > 0 ? (
                        <span className={getNumberColor(cell.neighborMines)}>
                          {cell.neighborMines}
                        </span>
                      ) : null
                    )
                  ) : (
                    hasFlag ? (
                      <Flag 
                        size={cols > 12 ? 10 : 13} 
                        className={isLight ? 'text-amber-805 fill-amber-800' : 'text-indigo-400 fill-indigo-500/30'} 
                      />
                    ) : null
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* Win / Complete Blast Overlays */}
        <AnimatePresence>
          {isGameWon && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-black/85 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-6 z-20 text-center select-none"
            >
              <motion.div
                initial={{ scale: 0.85, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                className="flex flex-col items-center max-w-sm"
              >
                <div className="w-14 h-14 bg-emerald-500/10 rounded-full border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 animate-bounce">
                  <Sparkles size={26} />
                </div>
                
                <h3 className="text-lg font-black text-white uppercase tracking-wider">
                  排雷大获全胜！
                </h3>
                <p className="text-xs text-zinc-400 mt-2 font-medium">
                  精妙排雷布局无一漏网！完成了本次针对混沌的抵抗，有效阻止了网格熵的增生扩散。
                </p>

                {/* Score details banner */}
                <div className="bg-zinc-900 border border-zinc-800 px-4 py-2.5 rounded-xl w-full mt-4 flex items-center justify-around text-left">
                  <div>
                    <span className="text-[10px] text-zinc-500 block leading-none">通关用时</span>
                    <span className="text-sm font-black font-mono text-emerald-400 mt-1 block">
                      {timer} 秒
                    </span>
                  </div>
                  <div className="w-px h-6 bg-zinc-800" />
                  <div>
                    <span className="text-[10px] text-zinc-500 block leading-none">消解负熵</span>
                    <span className="text-sm font-black font-mono text-indigo-400 mt-1 block flex items-center gap-1">
                      <Flame size={12} className="text-rose-400" />
                      <span>{entropyPoints} P</span>
                    </span>
                  </div>
                </div>

                <div className="flex gap-2.5 mt-5 w-full">
                  <button
                    onClick={initBlankBoard}
                    className="flex-1 py-2 px-4 rounded-xl text-xs font-black bg-emerald-500 hover:bg-emerald-400 text-zinc-950 shadow-md cursor-pointer active:scale-95 transition-all text-center"
                  >
                    再来一局
                  </button>
                  <button
                    onClick={onGoBack}
                    className={`flex-1 py-2 px-4 rounded-xl text-xs font-black shadow active:scale-95 transition-all text-center ${
                      isLight 
                        ? 'bg-[#EFEADB] hover:bg-[#E1D6BF] text-[#4A3C31] border border-[#DFD3C1]' 
                        : 'bg-zinc-800 hover:bg-zinc-700 hover:text-white text-zinc-300'
                    }`}
                  >
                    返回大厅
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}

          {isGameOver && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-red-950/90 backdrop-blur-sm rounded-2xl flex flex-col items-center justify-center p-6 z-20 text-center select-none"
            >
              <motion.div
                initial={{ scale: 0.85, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                className="flex flex-col items-center max-w-sm"
              >
                <div className="w-14 h-14 bg-red-500/10 rounded-full border border-red-500/30 flex items-center justify-center text-red-400 mb-4 animate-pulse">
                  <Bomb size={24} />
                </div>
                
                <h3 className="text-base font-black text-white uppercase tracking-wider">
                  排雷失误！雷区引爆
                </h3>
                <p className="text-xs text-red-200 mt-1.5 leading-relaxed font-medium">
                  很遗憾触碰到了高能混沌爆心。别气馁，重新校正数学方位，再发起一次挑战。
                </p>

                <div className="flex gap-2.5 mt-5 w-full">
                  <button
                    onClick={initBlankBoard}
                    className="flex-1 py-1.5 px-4 rounded-lg text-xs font-black bg-red-630 hover:bg-red-500 text-white bg-red-600 shadow-md cursor-pointer active:scale-95 transition-all"
                  >
                    立即重置 (再战)
                  </button>
                  <button
                    onClick={onGoBack}
                    className={`flex-1 py-1.5 px-4 rounded-lg text-xs font-black shadow active:scale-95 transition-all ${
                      isLight 
                        ? 'bg-[#EFEADB] hover:bg-[#E1D6BF] text-[#4A3C31] border border-[#DFD3C1]' 
                        : 'bg-zinc-805 hover:bg-zinc-700/60 hover:text-white text-zinc-300'
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

      {/* Touch device virtual tool / Left-click & Right-click simulate options */}
      <div className={`max-w-[280px] mx-auto w-full flex flex-col gap-2 p-2.5 rounded-xl border ${
        isLight ? 'bg-[#FAF6EE] border-[#E1D4C0]' : 'bg-zinc-900/40 border border-zinc-800/40'
      }`}>
        <div className="flex justify-between items-center px-1">
          <span className={`text-[9px] uppercase tracking-widest font-black ${isLight ? 'text-[#81745E]' : 'text-zinc-500'}`}>
            触控手势工作模式
          </span>
          <button 
            onClick={() => setShowGuide(prev => !prev)}
            className="text-[9px] font-bold text-indigo-400 hover:underline flex items-center gap-0.5"
          >
            <Info size={9} />
            <span>{showGuide ? '收起玩法' : '展开玩法'}</span>
          </button>
        </div>

        {/* Dual button model layout */}
        <div className="grid grid-cols-2 gap-1.5 mt-0.5">
          <button
            onClick={() => setMobileMode('dig')}
            className={`py-2 px-3 rounded-lg text-xs font-bold leading-normal flex items-center justify-center gap-1 cursor-pointer transition-all ${
              mobileMode === 'dig'
                ? isLight 
                  ? 'bg-[#8B5A2B] text-white' 
                  : 'bg-indigo-650 border border-indigo-500 text-white shadow'
                : isLight 
                  ? 'bg-[#EFEADB] text-[#6C5E53]' 
                  : 'bg-zinc-800 text-zinc-400'
            }`}
          >
            <Eye size={12} />
            <span>排雷 (挖掘)</span>
          </button>

          <button
            onClick={() => setMobileMode('flag')}
            className={`py-2 px-3 rounded-lg text-xs font-bold leading-normal flex items-center justify-center gap-1 cursor-pointer transition-all ${
              mobileMode === 'flag'
                ? isLight 
                  ? 'bg-[#8B5A2B] text-white border border-[#8B5A2B]' 
                  : 'bg-amber-600 border border-amber-500 text-zinc-950 shadow'
                : isLight 
                  ? 'bg-[#EFEADB] text-[#6C5E53]' 
                  : 'bg-zinc-805 text-zinc-405'
            }`}
          >
            <Flag size={11} />
            <span>标旗 (插旗)</span>
          </button>
        </div>

        {/* Dynamic usage guidance alerts */}
        {showGuide && (
          <div className={`mt-1 p-2 rounded-lg border text-[10px] leading-normal flex flex-col gap-1 ${
            isLight ? 'bg-[#FAF6EE]/50 border-[#E1D4C0] text-[#6C5E53]' : 'bg-zinc-955/40 border border-zinc-900 text-zinc-400'
          }`}>
            <p>
              🎁 <strong className="text-indigo-400">首击：</strong> 首次左键点击(挖掘)一个方格时，系统有绝对的防爆逻辑机制，自动为您隔离 3x3 危险，从而绝不误踩雷。
            </p>
            <p>
              🖱️ <strong className="text-amber-500">提示：</strong> 电脑端玩家可以直接右击方格直接标旗。
            </p>
            <p>
              💥 <strong className="text-emerald-500">双击强闪除雷 (Chord):</strong> 当一个已揭示的数字格周围标记的旗子数量达到对应雷数，您可以<span className="underline">双击该数字格</span>（或手机上双击），直接瞬间揭示周围所有其它剩余安全格子。
            </p>
          </div>
        )}
      </div>

    </div>
  );
}
