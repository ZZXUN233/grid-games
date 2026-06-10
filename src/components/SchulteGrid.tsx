import React, { useState, useEffect, useRef } from 'react';
import { ScoreRecord, GameLevel, GameTheme } from '../types';
import { Play, RotateCcw, AlertTriangle, Eye, ArrowRight, ArrowLeft, Hourglass, HelpCircle, CheckCircle, Compass, Grid, LetterText, Sparkles } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import confetti from 'canvas-confetti';

interface SchulteGridProps {
  currentUserId: string;
  userNickname: string;
  avatarColor: string;
  avatarEmoji: string;
  theme: GameTheme;
  onGameStatusChange: (isPlaying: boolean) => void;
  onScoreSubmit: (score: ScoreRecord) => void;
  onShowPoster?: (score: ScoreRecord) => void;
  onGoBack?: () => void;
  defaultFreeSize?: number;
}

export const CAMPAIGN_LEVELS: GameLevel[] = [
  { levelNumber: 1, gridSize: 3, timeLimit: null, description: '初学试练：3x3 经典方格，静下心，用外周视野全纳九格' },
  { levelNumber: 2, gridSize: 3, timeLimit: 10, description: '基础提速：3x3 网格，要求在 10 秒时间闸内完成扫视' },
  { levelNumber: 3, gridSize: 4, timeLimit: null, description: '中阶视宽：4x4 中阶方格，锻炼由中心焦点向四周延展' },
  { levelNumber: 4, gridSize: 4, timeLimit: 25, description: '极限扫频：4x4 网格，限时 25 秒，逼迫眼球搜索提速' },
  { levelNumber: 5, gridSize: 4, timeLimit: 16, description: '中阶登顶：4x4 网格，限时 16 秒，进入高扫视反射区' },
  { levelNumber: 10, gridSize: 5, timeLimit: 18, description: '终极掌控：5x5 大师网格，极限限时 18 秒，跨入天神领域！' },
  { levelNumber: 6, gridSize: 5, timeLimit: null, description: '5x5 国际标准：测试专注力的经典方格，静候视野全开' },
  { levelNumber: 7, gridSize: 5, timeLimit: 50, description: '标准测试：5x5 网格，限时 50 秒，测试专注力是否合格' },
  { levelNumber: 8, gridSize: 5, timeLimit: 36, description: '精锐突刺：5x5 网格，限时 36 秒，训练视网膜边缘阅读力' },
  { levelNumber: 9, gridSize: 5, timeLimit: 24, description: '超感知觉：5x5 网格，限时 24 秒，大幅缩省大脑解码时差' },
];

export default function SchulteGrid({
  currentUserId,
  userNickname,
  avatarColor,
  avatarEmoji,
  theme,
  onGameStatusChange,
  onScoreSubmit,
  onShowPoster,
  onGoBack,
  defaultFreeSize = 5,
}: SchulteGridProps) {
  // Mode settings
  const [activeTab, setActiveTab] = useState<'level' | 'free' | 'letter'>('level');
  
  // States of game mechanics
  const [currentLevelIdx, setCurrentLevelIdx] = useState(0);
  const [freeSize, setFreeSize] = useState(defaultFreeSize);

  useEffect(() => {
    if (defaultFreeSize) {
      setFreeSize(defaultFreeSize);
    }
  }, [defaultFreeSize]);
  
  const [gameState, setGameState] = useState<'idle' | 'countdown' | 'playing' | 'completed' | 'failed'>('idle');
  const [countdown, setCountdown] = useState(3);
  
  // Playing states
  const [gridCells, setGridCells] = useState<(number | string)[]>([]);
  const [sortedTargets, setSortedTargets] = useState<(number | string)[]>([]);
  const [targetIndex, setTargetIndex] = useState(0);
  const [mistakes, setMistakes] = useState(0);
  const [wrongCellVal, setWrongCellVal] = useState<number | string | null>(null);
  
  // Core Timer clock
  const [elapsedTime, setElapsedTime] = useState(0.0);
  const [discardedLetter, setDiscardedLetter] = useState<string>('');
  const [currentScoreItem, setCurrentScoreItem] = useState<ScoreRecord | null>(null);
  
  const timerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);

  // Trigger celebration explosion - grand multi-burst cascade (scattering flowers layout)
  const fireConfetti = () => {
    // 1. Center colorful primary blast
    confetti({
      particleCount: 110,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#3EB489', '#FBBF24', '#3B82F6', '#EC4899', '#ffffff', '#FFD700']
    });

    // 2. Left side celebratory angle launcher
    setTimeout(() => {
      confetti({
        particleCount: 70,
        angle: 60,
        spread: 60,
        origin: { x: 0, y: 0.75 },
        colors: ['#3EB489', '#FFD700', '#EC4899', '#10B981']
      });
    }, 200);

    // 3. Right side celebratory angle launcher
    setTimeout(() => {
      confetti({
        particleCount: 70,
        angle: 120,
        spread: 60,
        origin: { x: 1, y: 0.75 },
        colors: ['#3EB489', '#FFD700', '#EC4899', '#10B981']
      });
    }, 400);

    // 4. Sustainable slow falling flower cascade
    setTimeout(() => {
      const end = Date.now() + 2000;
      const interval = setInterval(() => {
        if (Date.now() > end) {
          return clearInterval(interval);
        }
        confetti({
          particleCount: 6,
          startVelocity: 0,
          ticks: 200,
          origin: {
            x: Math.random(),
            y: Math.random() * 0.3 - 0.05
          },
          colors: ['#3EB489', '#FBBF24', '#EC4899', '#3B82F6'],
          gravity: 0.6,
          scalar: 1.1,
          drift: Math.random() - 0.5
        });
      }, 80);
    }, 600);
  };

  // Setup game board depending on current configuration
  const setupGame = () => {
    let size = 5;
    let isLetterMode = false;

    if (activeTab === 'level') {
      const gLevel = CAMPAIGN_LEVELS[currentLevelIdx];
      size = gLevel.gridSize;
    } else if (activeTab === 'free') {
      size = freeSize;
    } else {
      isLetterMode = true;
      size = 5; // Fixed 5x5 for letters
    }

    if (isLetterMode) {
      // 26 big English letters
      const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
      // Randomly discard 1
      const discardIdx = Math.floor(Math.random() * letters.length);
      const discarded = letters[discardIdx];
      setDiscardedLetter(discarded);
      
      const filteredLetters = letters.filter((l) => l !== discarded); // 25 elements Left
      // Target list is alphabetical
      const alphabeticalSorted = [...filteredLetters]; // already sorted A-Z minus discarded
      
      // Shuffle filtered array
      const shuffled = [...filteredLetters].sort(() => Math.random() - 0.5);
      
      setGridCells(shuffled);
      setSortedTargets(alphabeticalSorted);
    } else {
      // Numerical
      const totalCount = size * size;
      const numbers = Array.from({ length: totalCount }, (_, i) => i + 1);
      const alphabeticalSorted = [...numbers]; // sorted 1, 2, 3...
      const shuffled = [...numbers].sort(() => Math.random() - 0.5);
      
      setGridCells(shuffled);
      setSortedTargets(alphabeticalSorted);
      setDiscardedLetter('');
    }

    setTargetIndex(0);
    setMistakes(0);
    setElapsedTime(0);
    setWrongCellVal(null);
    setCurrentScoreItem(null);
  };

  // Start game sequence with a focus countdown
  const startChallenge = () => {
    setupGame();
    setCountdown(3);
    setGameState('countdown');
    onGameStatusChange(false); // Alert parent to prep for full screen focus hiding
  };

  // Sub countdown timer
  useEffect(() => {
    if (gameState !== 'countdown') return;

    if (countdown > 0) {
      const handle = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(handle);
    } else {
      setGameState('playing');
      onGameStatusChange(true); // Fully hide outer UI
      startTimeRef.current = Date.now();
      
      // Start stopwatch clock loop
      timerRef.current = window.setInterval(() => {
        const delta = (Date.now() - startTimeRef.current) / 1000;
        setElapsedTime(delta);

        // Calculate if we have matched any time limit in level mode
        if (activeTab === 'level') {
          const limitTime = CAMPAIGN_LEVELS[currentLevelIdx].timeLimit;
          if (limitTime && delta >= limitTime) {
            handleGameLoss();
          }
        }
      }, 13); // High frequency accuracy loop
    }
  }, [gameState, countdown]);

  const clearTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  // Force stop / exit Game
  const terminateGame = () => {
    clearTimer();
    setGameState('idle');
    onGameStatusChange(false);
  };

  const handleGameLoss = () => {
    clearTimer();
    setGameState('failed');
    onGameStatusChange(false);
  };

  const handleCellClick = (val: number | string) => {
    if (gameState !== 'playing') return;

    const currentTarget = sortedTargets[targetIndex];
    if (val === currentTarget) {
      // Match correct
      setWrongCellVal(null);
      const nextIdx = targetIndex + 1;
      setTargetIndex(nextIdx);

      // Check win condition
      if (nextIdx >= sortedTargets.length) {
        clearTimer();
        setGameState('completed');
        onGameStatusChange(false);
        fireConfetti();

        // Save Score
        let difficultyStr = '';
        if (activeTab === 'level') {
          difficultyStr = `Level ${CAMPAIGN_LEVELS[currentLevelIdx].levelNumber}`;
        } else if (activeTab === 'free') {
          difficultyStr = `${freeSize}x${freeSize}`;
        } else {
          difficultyStr = 'Alphabet 5x5';
        }

        const scoreObj: ScoreRecord = {
          id: `score_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          userId: currentUserId,
          nickname: userNickname,
          avatarColor: avatarColor,
          avatarEmoji: avatarEmoji,
          mode: activeTab,
          difficulty: difficultyStr,
          time: Number(elapsedTime.toFixed(2)),
          createdAt: Date.now(),
        };

        setCurrentScoreItem(scoreObj);
        onScoreSubmit(scoreObj);
      }
    } else {
      // Misclick / incorrect hit
      setMistakes((m) => m + 1);
      setWrongCellVal(val);
      // Flash animation timeout
      setTimeout(() => setWrongCellVal(null), 300);
    }
  };

  // Cleanup on dismount
  useEffect(() => {
    return () => clearTimer();
  }, []);

  // Compute grid sizing to look incredibly fitted
  const getGridColsStyle = (size: number) => {
    if (size === 3) return 'grid-cols-3';
    if (size === 4) return 'grid-cols-4';
    if (size === 5) return 'grid-cols-5';
    if (size === 6) return 'grid-cols-6';
    if (size === 7) return 'grid-cols-7';
    if (size === 8) return 'grid-cols-8';
    if (size === 9) return 'grid-cols-9';
    return 'grid-cols-10';
  };

  const currentLevelInfo = CAMPAIGN_LEVELS[currentLevelIdx];
  const nextCampaignLevelExists = currentLevelIdx + 1 < CAMPAIGN_LEVELS.length;

  return (
    <div className="w-full flex flex-col gap-5 select-none text-zinc-300">
      
      {/* Dynamic Sub-header */}
      {onGoBack && (
        <div className="flex items-center justify-between pb-3.5 border-b border-zinc-800/60 w-full px-1">
          <button
            onClick={onGoBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-zinc-800/60 border border-zinc-700/50 hover:bg-zinc-800 hover:text-white text-zinc-400 transition-all text-xs font-semibold cursor-pointer active:scale-95"
          >
            <ArrowLeft size={13} />
            <span>返回大厅</span>
          </button>

          <div className="flex items-center gap-1">
            <div className="w-2.5 h-2.5 rounded-full bg-[#3EB489] animate-pulse" />
            <span className="text-[11px] text-zinc-500 font-mono tracking-wider block uppercase">
              舒尔特专注格盘 (Retina)
            </span>
          </div>
        </div>
      )}

      <div className={`p-4 md:p-6 rounded-2xl ${theme.card} transition-all duration-300 w-full`}>
      
      {/* 1. Main IDLE View: Schedulers & Lobby Rules */}
      {gameState === 'idle' && (
        <div>
          {/* Mode Tabs Header */}
          <div className="flex border-b border-zinc-800 mb-6">
            <button
              id="game-tab-level"
              onClick={() => setActiveTab('level')}
              className={`flex-1 pb-3 text-sm font-bold text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'level'
                  ? 'border-amber-500 text-amber-500'
                  : 'border-transparent text-zinc-400 hover:text-white'
              }`}
            >
              <Compass size={14} />
              <span>闯关模式</span>
            </button>
            <button
              id="game-tab-free"
              onClick={() => setActiveTab('free')}
              className={`flex-1 pb-3 text-sm font-bold text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'free'
                  ? 'border-amber-500 text-amber-500'
                  : 'border-transparent text-zinc-400 hover:text-white'
              }`}
            >
              <Grid size={14} />
              <span>自由模式</span>
            </button>
            <button
              id="game-tab-letter"
              onClick={() => setActiveTab('letter')}
              className={`flex-1 pb-3 text-sm font-bold text-center border-b-2 transition-all flex items-center justify-center gap-1.5 ${
                activeTab === 'letter'
                  ? 'border-amber-500 text-amber-500'
                  : 'border-transparent text-zinc-400 hover:text-white'
              }`}
            >
              <LetterText size={14} />
              <span>其它模式</span>
            </button>
          </div>

          {/* TAB 1 CONTENT: CAMPAIGN MODE */}
          {activeTab === 'level' && (
            <div className="space-y-4">
              <div className="bg-zinc-900/60 rounded-xl p-4 border border-zinc-800 flex items-center justify-between gap-3 flex-col sm:flex-row">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center border border-amber-500/20 text-amber-500 shrink-0">
                    <span className="text-lg font-bold font-mono">{currentLevelInfo.levelNumber}</span>
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                      <span>第 {currentLevelInfo.levelNumber} 关</span>
                      <span className="text-[10px] bg-amber-500/10 px-1.5 py-0.5 rounded text-amber-500 font-mono">
                        {currentLevelInfo.gridSize}x{currentLevelInfo.gridSize}
                      </span>
                    </h4>
                    <p className={`text-xs ${theme.textMuted} mt-1 leading-relaxed`}>
                      {currentLevelInfo.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 mr-1 shrink-0 text-amber-500 font-mono text-xs">
                  <Hourglass size={13} />
                  <span>
                    {currentLevelInfo.timeLimit ? `限时 ${currentLevelInfo.timeLimit} 秒` : '无时间限制'}
                  </span>
                </div>
              </div>

              {/* Levels Slider Line */}
              <div>
                <span className={`text-[10px] ${theme.textMuted} uppercase block mb-2 font-bold tracking-wider`}>
                  关卡选择 (已解锁):
                </span>
                <div className="grid grid-cols-5 sm:grid-cols-10 gap-1.5">
                  {CAMPAIGN_LEVELS.map((lvl, index) => (
                    <button
                      id={`level-dot-${lvl.levelNumber}`}
                      key={lvl.levelNumber}
                      onClick={() => setCurrentLevelIdx(index)}
                      className={`py-2 text-xs font-mono font-bold rounded-lg transition-all border ${
                        index === currentLevelIdx
                          ? 'bg-amber-600 text-zinc-950 font-extrabold border-amber-500 shadow-md scale-105'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:bg-zinc-800 hover:border-zinc-700'
                      }`}
                    >
                      {lvl.levelNumber}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2 CONTENT: FREE MODE */}
          {activeTab === 'free' && (
            <div className="space-y-4">
              <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-xl p-4">
                <span className={`text-xs ${theme.textMuted} block mb-2 font-semibold`}>
                  选择方格大小 (由 3x3 最低，最高支持到 10x10):
                </span>
                
                <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
                  {[3, 4, 5, 6, 7, 8, 9, 10].map((size) => (
                    <button
                      id={`free-size-choice-${size}`}
                      key={size}
                      onClick={() => setFreeSize(size)}
                      className={`py-2.5 rounded-lg font-mono font-bold text-xs transition-all border ${
                        freeSize === size
                          ? 'bg-amber-600 text-zinc-950 font-bold border-amber-500 shadow-md scale-105'
                          : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:border-zinc-700'
                      }`}
                    >
                      {size} x {size}
                    </button>
                  ))}
                </div>

                <div className="mt-4 p-3 bg-amber-500/5 border border-amber-500/10 rounded-lg text-xs leading-relaxed text-zinc-400">
                  ⚡ 5x5 是公认的黄金诊断配置，6x6 以上极度考验眼角周边外膜视觉。建议挺拔坐姿，双眼距离屏幕 30 厘米以上，固定直视中央！
                </div>
              </div>
            </div>
          )}

          {/* TAB 3 CONTENT: LETTER MODE */}
          {activeTab === 'letter' && (
            <div className="space-y-4">
              <div className="bg-zinc-900/60 rounded-xl p-4 border border-zinc-800">
                <h4 className="text-sm font-bold text-white flex items-center gap-1.5">
                  <Sparkles size={14} className="text-amber-500" />
                  <span>25字母空间感知模式 (5x5)</span>
                </h4>
                <p className={`text-xs ${theme.textMuted} mt-1.5 leading-relaxed`}>
                  英文字母表共有 26 个。本模式将
                  <strong className="text-amber-500"> 随机舍弃其中 1 个字母 </strong>
                  并将余下的 25 个字母随机洗牌。要求你按照 A-B-C 的纯字母顺序连续指认。这不仅是扫眼测试，更是在由于未知缺失而导致决策犹豫时，诊断心理抗干扰力的绝佳方案！
                </p>

                <div className="mt-3.5 flex items-center gap-2 p-2 px-3 bg-zinc-950 rounded border border-zinc-800 text-[11px] text-zinc-400">
                  <CheckCircle size={14} className="text-emerald-500" />
                  <span>顶端状态栏会自动提醒下一个搜寻字母，免去记诵顾虑。</span>
                </div>
              </div>
            </div>
          )}

          {/* PLAY CONTROL */}
          <button
            id="start-challenge-btn"
            onClick={startChallenge}
            className={`w-full py-4 mt-6 rounded-xl text-sm font-bold flex items-center justify-center gap-2 ${theme.accent}`}
          >
            <Play size={16} fill="currentColor" />
            <span>进入静心调试 · 开启挑战</span>
          </button>
        </div>
      )}

      {/* 2. COUNTDOWN STAGE */}
      {gameState === 'countdown' && (
        <div className="py-20 flex flex-col items-center justify-center text-center">
          <motion.div
            key={countdown}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1.2, opacity: 1 }}
            exit={{ scale: 1.5, opacity: 0 }}
            transition={{ duration: 0.5 }}
            className="text-8xl font-black font-mono text-amber-500 mb-4"
          >
            {countdown === 0 ? '专注！' : countdown}
          </motion.div>
          <p className={`text-xs ${theme.textMuted} tracking-widest uppercase`}>
            呼吸均匀 · 直视正中 · 全幅感知
          </p>
        </div>
      )}

      {/* 3. PLAYING SCREEN (Minimalist Distraction Free View rendered inside parent frame) */}
      {gameState === 'playing' && (
        <div className="flex flex-col items-center">
          {/* Distraction free top target bar */}
          <div className="w-full flex items-center justify-between border-b border-zinc-800/80 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <span className="text-xs text-zinc-500 font-mono tracking-wider">TARGET:</span>
              <span className="text-lg font-black font-mono text-amber-500 animate-pulse px-2 py-0.5 rounded bg-amber-500/10">
                {sortedTargets[targetIndex]}
              </span>
            </div>

            {/* Glowing clock timer */}
            <div className="flex items-center gap-3">
              <div className="text-right">
                <span className="text-[10px] text-zinc-500 font-mono block">STATED TIME</span>
                <span className="text-xl font-mono text-emerald-400 font-extrabold font-semibold">
                  {elapsedTime.toFixed(2)}s
                </span>
              </div>
              
              {/* Optional countdown bar if limit exists */}
              {activeTab === 'level' && CAMPAIGN_LEVELS[currentLevelIdx].timeLimit && (
                <div className="w-1.5 h-8 bg-zinc-900 rounded-full overflow-hidden relative border border-zinc-800">
                  <div
                    className="absolute bottom-0 left-0 right-0 bg-red-500 transition-all duration-75"
                    style={{
                      height: `${Math.min(
                        100,
                        (elapsedTime / (CAMPAIGN_LEVELS[currentLevelIdx].timeLimit || 1)) * 100
                      )}%`
                    }}
                  />
                </div>
              )}
            </div>
          </div>

          {/* Letter Mode alert inside board if active */}
          {activeTab === 'letter' && (
            <div className="w-full mb-3 text-center text-[10px] text-zinc-500 bg-zinc-950/40 p-1.5 rounded transition-all">
              <span>💡 本次已隐藏丢弃英文字母: </span>
              <strong className="text-rose-400 text-xs font-mono">{discardedLetter}</strong>
              <span>，其余 25 个均按字母表顺序排列。</span>
            </div>
          )}

          {/* Minimalist interactive grid metrics */}
          <div className="w-full text-left text-[10px] text-zinc-500 flex items-center justify-between mb-4 px-1">
            <span>第 {targetIndex} / {sortedTargets.length} 项</span>
            <span>失误: <b className={mistakes > 0 ? 'text-red-400' : ''}>{mistakes}</b> 次</span>
          </div>

          {/* Grid canvas core layout */}
          <div
            className={`grid ${getGridColsStyle(
              activeTab === 'level'
                ? CAMPAIGN_LEVELS[currentLevelIdx].gridSize
                : activeTab === 'free'
                ? freeSize
                : 5
            )} gap-1.5 w-full aspect-square max-w-lg mx-auto`}
          >
            {gridCells.map((val, cellIdx) => {
              const targetIdxOfVal = sortedTargets.indexOf(val);
              const isCellActivated = targetIdxOfVal !== -1 && targetIdxOfVal < targetIndex;
              const isWrong = wrongCellVal === val;

              // Compute continuous fading highlighting effect for the 5 most recently clicked cells
              let customStyle = '';
              let inlineStyle: React.CSSProperties = { touchAction: 'manipulation', minHeight: '44px' };
              const isInActiveTrail = isCellActivated && (targetIndex - 1 - targetIdxOfVal) < 5;
              const clickAge = isCellActivated ? (targetIndex - 1 - targetIdxOfVal) : 999;

              if (isCellActivated) {
                if (isInActiveTrail) {
                  // Inside the decaying highlight trail (last 5 clicked cells)
                  // clickAge: 0 (newest) -> 100%, 1 -> 85%, 2 -> 68%, 3 -> 50%, 4 (oldest in queue) -> 32%
                  const opacities = [1.0, 0.82, 0.65, 0.48, 0.30];
                  const scales = ["scale-105 shadow-md", "scale-102 shadow-sm font-black", "scale-100", "scale-98 opacity-90", "scale-95 opacity-80"];
                  
                  const opacity = opacities[clickAge] || 0.30;
                  const scaleClass = scales[clickAge] || "scale-95";
                  
                  customStyle = `${theme.gridItemActive} ${scaleClass}`;
                  inlineStyle = {
                    ...inlineStyle,
                    opacity: opacity,
                  };
                } else {
                  // Clicked earlier (clickAge >= 5) -> returns to a quiet, default/neutral background to prevent visual clutter
                  // styled with very low opacity to remain readable but clearly inactive.
                  customStyle = `${theme.gridItemDefault} select-none cursor-default opacity-15 pointer-events-none border-transparent shadow-none scale-95`;
                }
              } else if (isWrong) {
                customStyle = theme.gridItemWrong;
              } else {
                customStyle = `${theme.gridItemDefault} active:scale-95 cursor-pointer shadow-sm hover:scale-102`;
              }

              return (
                <button
                  key={`${val}-${cellIdx}`}
                  onClick={() => handleCellClick(val)}
                  disabled={isCellActivated}
                  className={`w-full h-full rounded-lg flex items-center justify-center font-mono font-bold select-none text-xl transition-all duration-300 relative overflow-hidden ${customStyle} ${
                    (activeTab === 'level' ? CAMPAIGN_LEVELS[currentLevelIdx].gridSize : activeTab === 'free' ? freeSize : 5) >= 7
                      ? 'text-sm md:text-md'
                      : 'text-lg md:text-2xl'
                  }`}
                  style={inlineStyle}
                >
                  <span className={`transition-all duration-300 ${
                    isCellActivated && !isInActiveTrail
                      ? 'line-through opacity-30 select-none scale-90'
                      : isInActiveTrail
                      ? 'text-zinc-950 font-black' // Maximum text clarity inside highlighted trail
                      : ''
                  }`}>
                    {val}
                  </span>
                  
                  {isCellActivated && (
                    <span className="absolute bottom-1 right-1 text-[8px] bg-zinc-950/30 text-white rounded-full w-3.5 h-3.5 flex items-center justify-center font-sans select-none scale-90 opacity-60">
                      ✓
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          <button
            id="abort-challenge-btn"
            onClick={terminateGame}
            className="mt-6 flex items-center gap-1 text-xs text-zinc-500 hover:text-zinc-300 py-2 px-4 rounded hover:bg-white/5 transition-all active:scale-95 border border-zinc-800"
          >
            <RotateCcw size={12} />
            <span>退出本次练习 (清零)</span>
          </button>
        </div>
      )}

      {/* 4. COMPLETED SUCCESS SCREEN */}
      {gameState === 'completed' && (
        <div className="text-center py-8">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 text-3xl mx-auto mb-4 animate-bounce">
            🎉
          </div>

          <h3 className="text-2xl font-black text-white">挑战大成功！</h3>
          
          <div className="my-6 py-4 px-6 rounded-xl bg-zinc-950/60 border border-zinc-800 w-full max-w-sm mx-auto">
            <span className={`text-xs ${theme.textMuted} block`}>
              本次完成耗时 ({activeTab === 'level' ? `第${CAMPAIGN_LEVELS[currentLevelIdx].levelNumber}关` : activeTab === 'free' ? `${freeSize}x${freeSize}` : '字母款'})
            </span>
            <div className="text-4xl font-extrabold text-amber-500 font-mono mt-1">
              {elapsedTime.toFixed(2)}s
            </div>
            
            <div className="mt-3 pt-3 border-t border-zinc-900 grid grid-cols-2 text-xs text-zinc-400">
              <div>
                <span>失误次数</span>
                <span className="block font-bold text-white font-mono mt-0.5">{mistakes}</span>
              </div>
              <div>
                <span>扫眼效率</span>
                <span className="block font-bold text-white font-mono mt-0.5">
                  {(elapsedTime / sortedTargets.length).toFixed(2)} 秒/格
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 max-w-sm mx-auto">
            {activeTab === 'level' && nextCampaignLevelExists && (
              <button
                id="next-level-btn"
                onClick={() => {
                  setCurrentLevelIdx((idx) => idx + 1);
                  setGameState('idle');
                }}
                className="py-3.5 px-4 rounded-xl text-xs font-extrabold text-zinc-950 bg-amber-500 hover:bg-amber-400 flex items-center justify-center gap-1.5 transition-all shadow-md active:scale-95 cursor-pointer"
              >
                <span>直接挑战下一关</span>
                <ArrowRight size={14} />
              </button>
            )}

            <button
              id="retry-challenge-btn"
              onClick={startChallenge}
              className="py-3 px-4 rounded-xl text-xs font-bold text-emerald-400 bg-emerald-905/20 border border-emerald-500/20 hover:bg-emerald-950/40 hover:border-emerald-500/40 transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <RotateCcw size={13} />
              <span>重新开始本关 (再来一局)</span>
            </button>

            {currentScoreItem && onShowPoster && (
              <button
                id="generate-poster-action-btn"
                onClick={() => onShowPoster(currentScoreItem)}
                className="py-3 px-4 rounded-xl text-xs font-bold text-sky-400 bg-sky-950/20 border border-sky-500/25 hover:bg-sky-950/40 hover:border-sky-500/45 transition-all flex items-center justify-center gap-1.5 active:scale-95 cursor-pointer animate-pulse"
              >
                <span>🏆 制作并导出本次荣誉海报</span>
              </button>
            )}

            <button
              id="lobby-back-btn"
              onClick={() => setGameState('idle')}
              className="py-3 px-4 rounded-xl text-xs font-bold text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 transition-all active:scale-95 cursor-pointer"
            >
              返回挑战大厅 (选关/模式)
            </button>
          </div>
        </div>
      )}

      {/* 5. FAILED LIMIT OUT VIEW */}
      {gameState === 'failed' && (
        <div className="text-center py-10">
          <div className="w-16 h-16 rounded-full bg-rose-500/10 border border-rose-500/30 flex items-center justify-center text-rose-400 text-3xl mx-auto mb-4 animate-pulse">
            <AlertTriangle size={32} />
          </div>

          <h3 className="text-xl font-bold text-white">时间耗尽！挑战失败</h3>
          <p className={`text-xs ${theme.textMuted} mt-2 max-w-xs mx-auto leading-relaxed`}>
            本关具有严格眼球扫频限重（{currentLevelInfo.timeLimit}秒）。别灰心，深呼吸，平静心境能大幅提高摄入网格速度！
          </p>

          <div className="mt-8 flex flex-col gap-2 max-w-xs mx-auto">
            <button
              id="retry-failed-btn"
              onClick={startChallenge}
              className={`py-3 px-4 rounded-xl text-xs font-bold ${theme.accent}`}
            >
              重新发起挑战
            </button>

            <button
              id="lobby-failed-back-btn"
              onClick={() => setGameState('idle')}
              className="py-3 px-4 rounded-xl text-xs font-medium text-zinc-400 hover:text-white bg-zinc-900 border border-zinc-800 transition-all"
            >
              返回训练大厅
            </button>
          </div>
        </div>
      )}
    </div>
    </div>
  );
}
