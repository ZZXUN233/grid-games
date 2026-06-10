import React, { useState, useEffect, useCallback } from 'react';
import { UserProfile, ScoreRecord, GameTheme } from './types';
import { THEMES } from './data/themes';
import { generateRandomProfile } from './data/names';
import { saveScoreToFirebase, saveEntropyRecordToFirebase } from './firebase';
import { fetchProfile, AuthUser } from './api';
import NameEditor from './components/NameEditor';
import AuthModal from './components/AuthModal';
import ThemeSelector from './components/ThemeSelector';
import SchulteGrid from './components/SchulteGrid';
import Leaderboard from './components/Leaderboard';
import ScorePoster from './components/ScorePoster';
import Game2048 from './components/Game2048';
import Gomoku from './components/Gomoku';
import Sudoku from './components/Sudoku';
import Minesweeper from './components/Minesweeper';
import MemoryMatrix from './components/MemoryMatrix';
import GameOfLife from './components/GameOfLife';
import PixelCanvas from './components/PixelCanvas';
import Snake from './components/Snake';
import { 
  Trophy, 
  Share2, 
  HelpCircle, 
  Info, 
  ChevronDown, 
  ChevronUp, 
  Menu, 
  X, 
  Grid, 
  Target,
  Hash,
  CircleDot,
  Table,
  Bomb,
  Cpu,
  Dna,
  Palette,
  Gamepad2,
  Flame,
  Orbit,
  Sparkles,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export default function App() {
  // Global profile & visual theme state
  const [user, setUser] = useState<UserProfile>({
    userId: '',
    nickname: '',
    avatarColor: '',
    avatarEmoji: '',
    accumulatedEntropy: 0,
    todayEntropyConsumed: 0,
    lastActiveDate: '',
  });
  const [themeId, setThemeId] = useState<string>('minimalism');
  const [localScores, setLocalScores] = useState<ScoreRecord[]>([]);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  
  // Game router state
  // null = Lobby (九宫格 Portal), 'schulte' = Schulte Pro, '2048' = 2048, 'gomoku' = Gomoku 五子棋
  const [selectedGameId, setSelectedGameId] = useState<string | null>(null);

  // Custom Game configurations state
  const [gomokuSettings, setGomokuSettings] = useState({
    gridSize: 11, // 11, 13, 15
    difficulty: 'medium' as 'easy' | 'medium' | 'hard',
  });

  const [game2048Settings, setGame2048Settings] = useState({
    spawnMode: 'normal' as 'normal' | 'chaos' | 'hell',
    starterCount: 2,
  });

  const [schulteSettings, setSchulteSettings] = useState({
    defaultDimension: 5, // 3, 4, 5, 6
  });

  const [sudokuSettings, setSudokuSettings] = useState({
    difficulty: 'medium' as 'easy' | 'medium' | 'hard',
  });

  const [minesweeperSettings, setMinesweeperSettings] = useState({
    difficulty: 'medium' as 'easy' | 'medium' | 'hard',
  });

  const [activeSettingsGameId, setActiveSettingsGameId] = useState<string | null>(null);
  
  // For Schulte focus/playing state to hide secondary outer layouts
  const [isSchulteInnerPlaying, setIsSchulteInnerPlaying] = useState(false);
  const [recentScore, setRecentScore] = useState<ScoreRecord | null>(null);
  const [showHowToPlay, setShowHowToPlay] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  // Load state on mount
  useEffect(() => {
    (async () => {
    // 1. Theme Configuration loading
    const cachedTh = localStorage.getItem('schulte_theme_id');
    if (cachedTh && THEMES.some((t) => t.id === cachedTh)) {
      setThemeId(cachedTh);
    }

    // 2. Load saved user session: try auth session first, fallback to legacy profile
    const authSession = localStorage.getItem('gridgame_auth_session');
    let loadedUser: UserProfile | null = null;
    const todayStr = new Date().toISOString().split('T')[0];

    if (authSession) {
      try {
        const session = JSON.parse(authSession);
        if (session.userId && session.password) {
          // Try to restore session by fetching profile from server
          const profileRes = await fetchProfile(session.userId);
          if (profileRes.success && profileRes.user) {
            const p = profileRes.user;
            loadedUser = {
              userId: p.userId,
              nickname: p.nickname,
              avatarColor: p.avatarColor,
              avatarEmoji: p.avatarEmoji,
              accumulatedEntropy: 0,
              todayEntropyConsumed: 0,
              lastActiveDate: todayStr,
            };
          }
        }
      } catch (e) {
        // fall through
      }
    }

    // Fallback to old profile format
    if (!loadedUser) {
      const cachedProf = localStorage.getItem('schulte_profile');
      if (cachedProf) {
        try {
          const parsed = JSON.parse(cachedProf);
          if (parsed.userId && parsed.nickname) {
            loadedUser = { ...parsed };
          }
        } catch (e) {
          // ignore
        }
      }
    }

    if (!loadedUser) {
      loadedUser = generateRandomProfile();
    }

    if (loadedUser) {
      if (loadedUser.accumulatedEntropy === undefined) loadedUser.accumulatedEntropy = 0;
      if (loadedUser.todayEntropyConsumed === undefined) loadedUser.todayEntropyConsumed = 0;
      if (!loadedUser.lastActiveDate) loadedUser.lastActiveDate = todayStr;

      if (loadedUser.lastActiveDate !== todayStr) {
        const remainingUnsolved = 100 - (loadedUser.todayEntropyConsumed || 0);
        const nextAccumulated = Math.max(0, (loadedUser.accumulatedEntropy || 0) + remainingUnsolved);
        loadedUser.accumulatedEntropy = nextAccumulated;
        loadedUser.todayEntropyConsumed = 0;
        loadedUser.lastActiveDate = todayStr;
        localStorage.setItem('schulte_profile', JSON.stringify(loadedUser));
      }
      setUser(loadedUser);
    }

    // 3. Load locally stored high scores
    const cachedScores = localStorage.getItem('schulte_local_scores');
    if (cachedScores) {
      try {
        setLocalScores(JSON.parse(cachedScores));
      } catch (e) {
        setLocalScores([]);
      }
    }
    })();
  }, []);

  const handleUserChange = (updatedUser: UserProfile) => {
    setUser(updatedUser);
    localStorage.setItem('schulte_profile', JSON.stringify(updatedUser));
  };

  const handleThemeChange = (newThemeId: string) => {
    setThemeId(newThemeId);
    localStorage.setItem('schulte_theme_id', newThemeId);
  };

  const handleAuthSuccess = (authUser: AuthUser, password?: string) => {
    const todayStr = new Date().toISOString().split('T')[0];
    const profile: UserProfile = {
      userId: authUser.userId,
      nickname: authUser.nickname,
      avatarColor: authUser.avatarColor,
      avatarEmoji: authUser.avatarEmoji,
      accumulatedEntropy: 0,
      todayEntropyConsumed: 0,
      lastActiveDate: todayStr,
    };
    setUser(profile);
    setShowAuth(false);
    setIsLoggedInState(true);
    localStorage.setItem('schulte_profile', JSON.stringify(profile));
    if (password) {
      localStorage.setItem('gridgame_auth_session', JSON.stringify({ userId: authUser.userId, password }));
    }
  };

  const handleLogout = () => {
    setUser(generateRandomProfile());
    localStorage.removeItem('gridgame_auth_session');
    localStorage.removeItem('schulte_profile');
    setIsLoggedInState(false);
  };

  const isLoggedIn = !!localStorage.getItem('gridgame_auth_session');
  const [isLoggedInState, setIsLoggedInState] = useState(false);

  // Track login state on mount
  useEffect(() => {
    setIsLoggedInState(!!localStorage.getItem('gridgame_auth_session'));
  }, []);

  const handleOpenAuth = () => {
    setActiveSettingsGameId(null);
    setIsDrawerOpen(false);
    setShowAuth(true);
  };

  // Dynamic real-time entropy consumption engine
  const consumeEntropy = useCallback(async (points: number) => {
    setUser((prevUser) => {
      if (!prevUser.userId) return prevUser;
      const todayStr = new Date().toISOString().split('T')[0];
      const nextConsumed = (prevUser.todayEntropyConsumed || 0) + points;
      const updated = {
        ...prevUser,
        todayEntropyConsumed: nextConsumed,
        lastActiveDate: todayStr
      };
      
      localStorage.setItem('schulte_profile', JSON.stringify(updated));
      
      // Async background server sync
      saveEntropyRecordToFirebase(
        updated.userId,
        updated.nickname,
        updated.avatarColor,
        updated.avatarEmoji,
        todayStr,
        nextConsumed
      );

      return updated;
    });
  }, []);

  const handleScoreSubmit = async (score: ScoreRecord) => {
    // 1. Add to local cache list
    const updated = [score, ...localScores];
    setLocalScores(updated);
    localStorage.setItem('schulte_local_scores', JSON.stringify(updated));

    // 2. Submit score asynchronously to Firestore
    await saveScoreToFirebase(score);

    // 3. Calculate grid difficulty rating points for entropy reduction
    let points = 25; // default benchmark
    if (score.difficulty.includes('3x3')) points = 15;
    else if (score.difficulty.includes('4x4')) points = 25;
    else if (score.difficulty.includes('5x5')) points = 35;
    else if (score.difficulty.includes('6x6')) points = 50;
    
    await consumeEntropy(points);
  };

  // Auto-close mobile drawer when game begins
  useEffect(() => {
    if (selectedGameId !== null || isSchulteInnerPlaying) {
      setIsDrawerOpen(false);
    }
  }, [selectedGameId, isSchulteInnerPlaying]);

  const activeTheme = THEMES.find((t) => t.id === themeId) || THEMES[0];

  // We are in active play screen if a game is selected and for Schulte, the countdown is active
  const hideOuterLayout = selectedGameId !== null || isSchulteInnerPlaying;

  // Games meta for the 3x3 九宫格 Portal
  const gamePortalSlots = [
    {
      id: 'schulte',
      title: '舒尔特方格 (Retina)',
      desc: '周边视野与眼肌对焦张力训练',
      icon: Target,
      color: '#3EB489',
      status: 'HOT',
      bgClass: 'from-[#3EB489]/10 to-[#3EB489]/5 border-[#3EB489]/25 hover:border-[#3EB489]/60',
    },
    {
      id: '2048',
      title: '网格合并 2048',
      desc: '数学方向规划，极限数字卡片进阶',
      icon: Hash,
      color: '#F59E0B',
      status: 'NEW',
      bgClass: 'from-[#F59E0B]/10 to-[#F59E0B]/5 border-[#F59E0B]/25 hover:border-[#F59E0B]/60',
    },
    {
      id: 'gomoku',
      title: '五子连珠 (Gobang)',
      desc: '落子无悔之博，对称网格策略对抗',
      icon: CircleDot,
      color: '#8B5CF6',
      status: 'BOT',
      bgClass: 'from-[#8B5CF6]/10 to-[#8B5CF6]/5 border-[#8B5CF6]/25 hover:border-[#8B5CF6]/60',
    },
    {
      id: 'sudoku',
      title: '经典数独 (Sudoku)',
      desc: '空缺填位逻辑，数字链推理训练',
      icon: Table,
      color: '#10B981',
      status: 'HOT',
      bgClass: 'from-[#10B981]/10 to-[#10B981]/5 border-[#10B981]/25 hover:border-[#10B981]/60',
    },
    {
      id: 'mines',
      title: '经典扫雷 (Minesweeper)',
      desc: '排雷标记危险区，全盘逻辑数算',
      icon: Bomb,
      color: '#F43F5E',
      status: 'HOT',
      bgClass: 'from-[#F43F5E]/10 to-[#F43F5E]/5 border-[#F43F5E]/25 hover:border-[#F43F5E]/60',
    },
    {
      id: 'memory',
      title: '记忆矩阵 (Matrix)',
      desc: '空间格局瞬时激发，视见回忆检验',
      icon: Cpu,
      color: '#8B5CF6',
      status: 'HOT',
      bgClass: 'from-[#8B5CF6]/10 to-[#8B5CF6]/5 border-[#8B5CF6]/25 hover:border-[#8B5CF6]/60',
    },
    {
      id: 'life',
      title: '元胞生活 (Life)',
      desc: '生命自动规则，网格繁复衍化斑驳',
      icon: Dna,
      color: '#10B981',
      status: 'HOT',
      bgClass: 'from-[#10B981]/10 to-[#10B981]/5 border-[#10B981]/25 hover:border-[#10B981]/60',
    },
    {
      id: 'pixel',
      title: '像素艺术 (Canvas)',
      desc: '创意自由像素填色，作品即时保存',
      icon: Palette,
      color: '#F59E0B',
      status: 'HOT',
      bgClass: 'from-[#F59E0B]/10 to-[#F59E0B]/5 border-[#F59E0B]/25 hover:border-[#F59E0B]/60',
    },
    {
      id: 'snake',
      title: '网格贪吃蛇 (Snake)',
      desc: '极限避让障碍，贪吃巨蛇生存博弈',
      icon: Gamepad2,
      color: '#F43F5E',
      status: 'HOT',
      bgClass: 'from-[#F43F5E]/10 to-[#F43F5E]/5 border-[#F43F5E]/25 hover:border-[#F43F5E]/60',
    }
  ];

  return (
    <div className={`min-h-screen ${activeTheme.bg} transition-colors duration-500 py-6 px-4 flex flex-col justify-between select-none`}>
      {/* Outer balanced boundary container */}
      <div className="w-full max-w-5xl mx-auto flex-1 flex flex-col justify-center gap-6">

        {/* ========================================================= */}
        {/* TOP HEADER SECTION: Hides smoothly during play distraction-free */}
        {/* ========================================================= */}
        <AnimatePresence>
          {!hideOuterLayout && (
            <motion.header
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="w-full flex flex-col gap-4 mt-2"
            >
              {/* Header Bar */}
              <div className="flex items-center justify-between flex-nowrap gap-2 pb-3.5 border-b border-zinc-800/60 w-full px-1">
                <div className="flex items-center gap-2.5 min-w-0 shrink">
                  <div className="w-8.5 h-8.5 bg-[#3EB489]/10 rounded-lg border border-[#3EB489]/25 flex items-center justify-center text-[#3EB489] font-black text-base select-none shrink-0">
                    <Grid size={15} className="animate-spin" style={{ animationDuration: '6s' }} />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-sm md:text-base font-extrabold tracking-tight text-white select-none leading-none uppercase truncate">
                      格子熵 · Grid Entropy
                    </h1>
                    <span className="text-[9px] md:text-[10px] text-zinc-500 font-mono tracking-wider block leading-none mt-1 truncate">
                      九宫格平面网格聚合对抗熵增空间
                    </span>
                  </div>
                </div>

                {/* Minimalist Settings Gear Trigger */}
                <button
                  id="mobile-drawer-trigger"
                  onClick={() => setIsDrawerOpen(true)}
                  className="p-2 rounded-xl bg-zinc-800/60 border border-zinc-700/50 hover:bg-zinc-800 hover:text-amber-500 active:scale-95 transition-all cursor-pointer shrink-0 text-zinc-300 group"
                  title="大厅及主题配置"
                >
                  <Settings size={18} className="group-hover:rotate-45 transition-transform duration-300 shrink-0" />
                </button>
              </div>
            </motion.header>
          )}
        </AnimatePresence>

        {/* ========================================================= */}
        {/* ACTIVE MAIN PLAY INTERACTIVE SECTION */}
        {/* ========================================================= */}
        <main className="w-full flex flex-col gap-6 items-center">
          
          <div className="w-full max-w-2xl">
            {selectedGameId === null ? (
              /* ========================================================= */
              /* 1. LOBBY PORTAL VIEW: 3x3 Interactive Grid and Entropy stats */
              /* ========================================================= */
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3 }}
                className="space-y-5"
              >
                {/* 🌌 对抗熵增 - Daily Entropy Combat Dashboard */}
                <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-4.5 max-w-lg mx-auto flex flex-col gap-3.5 shadow-xl select-none">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6.5 h-6.5 bg-[#3EB489]/10 rounded-lg border border-[#3EB489]/20 flex items-center justify-center text-[#3EB489]">
                        <Orbit size={13} className="animate-spin" style={{ animationDuration: '6s' }} />
                      </div>
                      <span className="text-xs font-black text-white tracking-tight">每日“对抗熵增”任务</span>
                    </div>

                    {/* Status Badge */}
                    {user.todayEntropyConsumed >= 100 ? (
                      <span className="text-[9.5px] font-black text-[#3EB489] bg-[#3EB489]/10 px-2.5 py-0.5 rounded-full border border-[#3EB489]/25 flex items-center gap-1">
                        <Sparkles size={10} className="animate-pulse" />
                        <span>负熵常驻（已攻克）</span>
                      </span>
                    ) : (
                      <span className="text-[9.5px] font-bold text-amber-500 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/25 flex items-center gap-1 animate-pulse">
                        <Flame size={10} />
                        <span>处于熵增中（未消解）</span>
                      </span>
                    )}
                  </div>

                  {/* High Contrast Slider / Bar */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-[11px] font-semibold text-zinc-400">
                      <span>{user.todayEntropyConsumed >= 100 ? '今日负熵释放完成，进入高度有序状态' : '今日负熵释放进度'}</span>
                      <span className="font-mono text-zinc-300 font-bold">
                        {user.todayEntropyConsumed || 0} / 100 负熵
                      </span>
                    </div>
                    
                    {/* Real Custom Progress Track */}
                    <div className="h-2 rounded-full bg-zinc-800/60 overflow-hidden relative border border-zinc-950">
                      <div 
                        className="h-full bg-gradient-to-r from-amber-500 to-[#3EB489] transition-all duration-500"
                        style={{ width: `${Math.min(100, ((user.todayEntropyConsumed || 0) / 100) * 100)}%` }}
                      />
                    </div>
                  </div>

                  {/* Detail Row containing Carry-Over details */}
                  <div className="grid grid-cols-2 gap-2.5 text-[11px] font-medium pt-3.5 border-t border-zinc-800/40 text-zinc-400">
                    <div className="bg-zinc-950/40 p-2.5 rounded-xl border border-zinc-800/20 flex flex-col gap-0.5">
                      <span className="text-[9px] text-zinc-500 block">
                        累计历史混沌熵
                      </span>
                      <span className="font-mono text-xs font-black text-white flex items-center gap-1.5 mt-0.5">
                        <span className={(user.accumulatedEntropy || 0) > 0 ? "text-rose-400 animate-pulse font-extrabold" : "text-[#3EB489]"}>
                          {user.accumulatedEntropy || 0} E
                        </span>
                        {(user.accumulatedEntropy || 0) > 0 && (
                          <span className="text-[8.5px] font-normal text-zinc-500 leading-tight">未达标累存值</span>
                        )}
                      </span>
                    </div>

                    <div className="bg-zinc-950/40 p-2.5 rounded-xl border border-zinc-800/20 flex flex-col gap-0.5">
                      <span className="text-[9px] text-zinc-500 block">
                        秩序混沌状态级
                      </span>
                      <span className="font-mono text-xs font-black text-white flex items-center gap-1 mt-0.5">
                        <span className={100 - (user.todayEntropyConsumed || 0) <= 0 ? "text-[#3EB489]" : "text-amber-500 font-bold"}>
                          {100 - (user.todayEntropyConsumed || 0)} E
                        </span>
                        <span className="text-[9px] font-normal text-zinc-500">
                          ({100 - (user.todayEntropyConsumed || 0) <= 0 ? '产生秩序' : '处于高熵'})
                        </span>
                      </span>
                    </div>
                  </div>
                </div>

                {/* 3x3 Grid console (Optimized responsive columns) */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 md:gap-4 w-full max-w-2xl mx-auto">
                  {gamePortalSlots.map((slot, index) => {
                    const IconComp = slot.icon;
                    const isPlayable = slot.status !== 'PLAN';
                    
                    return (
                      <motion.div
                        key={slot.id}
                        initial={{ opacity: 0, y: 15 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.04, type: "spring", stiffness: 200, damping: 18 }}
                        onClick={() => {
                          if (isPlayable) {
                            setSelectedGameId(slot.id);
                          }
                        }}
                        className={`group relative rounded-2xl p-3 flex flex-col justify-between border select-none transition-all duration-300 min-h-[135px] sm:min-h-[145px] md:min-h-[155px] ${
                          isPlayable 
                            ? `bg-gradient-to-b ${slot.bgClass} cursor-pointer active:scale-95 shadow-lg shadow-black/30` 
                            : 'bg-zinc-900/15 border-zinc-900/40 opacity-40 cursor-not-allowed'
                        }`}
                      >
                        {/* Status tag & alignment layout row */}
                        <div className="flex justify-between items-center mb-1.5 md:mb-3">
                          <div 
                            className="p-1.5 rounded-lg border"
                            style={{ 
                              color: slot.color, 
                              borderColor: `${slot.color}1e`,
                              backgroundColor: `${slot.color}08` 
                            }}
                          >
                            <IconComp size={16} className={isPlayable ? "group-hover:rotate-12 transition-transform duration-300" : ""} />
                          </div>

                          <div className="flex items-center gap-1.5">
                            {isPlayable && (
                              <button
                                id={`gear-${slot.id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setActiveSettingsGameId(slot.id);
                                }}
                                className="p-1.5 rounded-md bg-zinc-950/60 hover:bg-zinc-800 hover:text-emerald-400 text-zinc-400 border border-zinc-800/60 transition-all cursor-pointer relative z-20"
                                title="参数与规格配置"
                              >
                                <Settings size={12} className="animate-spin-slow hover:animate-spin" />
                              </button>
                            )}
                            <span 
                              className="text-[8px] font-black tracking-widest px-1.5 py-0.5 rounded-full select-none"
                              style={{ 
                                backgroundColor: isPlayable ? `${slot.color}20` : '#27272a',
                                color: isPlayable ? slot.color : '#71717a'
                              }}
                            >
                              {slot.status}
                            </span>
                          </div>
                        </div>

                        {/* Perfectly Aligned Title & Description using standardized min-height bounds */}
                        <div className="space-y-1 text-left mt-1.5">
                          <h3 className="text-xs sm:text-[13px] font-black text-white group-hover:text-[#3EB489] transition-colors leading-tight flex items-center min-h-[30px] sm:min-h-[34px] line-clamp-2">
                            {slot.title}
                          </h3>
                          <p className="text-[10px] sm:text-[11px] text-zinc-500 leading-normal line-clamp-2 min-h-[28px] sm:min-h-[32px] font-sans font-medium">
                            {slot.desc}
                          </p>
                        </div>

                        {/* Interactive glow effect */}
                        {isPlayable && (
                          <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none duration-500 border border-[#3EB489]/20" />
                        )}
                      </motion.div>
                    );
                  })}
                </div>

                {/* Quick Player Profile card under the portal */}
                <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/30 rounded-xl border border-zinc-800/50 max-w-lg mx-auto">
                  <div className="flex items-center gap-2">
                    <span className="text-base select-none">{user.avatarEmoji || "🕹️"}</span>
                    <span className="text-xs text-zinc-400 font-bold">已登录玩家：</span>
                    <span className="text-xs font-black text-white font-mono">{user.nickname || "载入中..."}</span>
                  </div>
                  <div className="flex items-cnter gap-1.5">
                    <button
                      onClick={() => setIsDrawerOpen(true)}
                      className="text-[10px] py-1 px-2.5 rounded-md bg-zinc-800 hover:bg-zinc-700 font-bold text-zinc-400 hover:text-zinc-200 cursor-pointer active:scale-95 transition-all"
                    >
                      修改别名/主题
                    </button>
                    {isLoggedInState ? (
                      <button
                        onClick={handleLogout}
                        className="text-[10px] py-1 px-2 rounded-md bg-zinc-800/50 hover:bg-rose-800/50 font-bold text-zinc-500 hover:text-rose-300 cursor-pointer active:scale-95 transition-all"
                        title="注销当前账号"
                      >
                        注销
                      </button>
                    ) : (
                      <button
                        onClick={handleOpenAuth}
                        className="text-[10px] py-1 px-2.5 rounded-md bg-emerald-700/50 hover:bg-emerald-600/70 font-bold text-emerald-300 hover:text-emerald-200 cursor-pointer active:scale-95 transition-all"
                        title="登录以保存进度到服务器"
                      >
                        登录/注册
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            ) : (
              /* ========================================================= */
              /* 2. GAME WORKSPACE ROUTER: Schulte Pro, 2048, Gobang */
              /* ========================================================= */
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="w-full"
              >
                {selectedGameId === 'schulte' && (
                  <SchulteGrid
                    currentUserId={user.userId}
                    userNickname={user.nickname}
                    avatarColor={user.avatarColor}
                    avatarEmoji={user.avatarEmoji}
                    theme={activeTheme}
                    onGameStatusChange={setIsSchulteInnerPlaying}
                    onScoreSubmit={handleScoreSubmit}
                    onShowPoster={(score) => setRecentScore(score)}
                    onGoBack={() => {
                      setSelectedGameId(null);
                      setIsSchulteInnerPlaying(false);
                    }}
                    defaultFreeSize={schulteSettings.defaultDimension}
                  />
                )}

                {selectedGameId === '2048' && (
                  <Game2048
                    theme={activeTheme}
                    onGoBack={() => {
                      setSelectedGameId(null);
                      setIsSchulteInnerPlaying(false);
                    }}
                    userNickname={user.nickname}
                    onConsumeEntropy={consumeEntropy}
                    spawnMode={game2048Settings.spawnMode}
                    starterCount={game2048Settings.starterCount}
                  />
                )}

                {selectedGameId === 'gomoku' && (
                  <Gomoku
                    theme={activeTheme}
                    onGoBack={() => {
                      setSelectedGameId(null);
                      setIsSchulteInnerPlaying(false);
                    }}
                    userNickname={user.nickname}
                    onConsumeEntropy={consumeEntropy}
                    initialGridSize={gomokuSettings.gridSize}
                    initialDifficulty={gomokuSettings.difficulty}
                  />
                )}

                {selectedGameId === 'sudoku' && (
                  <Sudoku
                    theme={activeTheme}
                    onGoBack={() => {
                      setSelectedGameId(null);
                      setIsSchulteInnerPlaying(false);
                    }}
                    userNickname={user.nickname}
                    onConsumeEntropy={consumeEntropy}
                    onScoreSubmit={handleScoreSubmit}
                    initialDifficulty={sudokuSettings.difficulty}
                  />
                )}

                {selectedGameId === 'mines' && (
                  <Minesweeper
                    theme={activeTheme}
                    onGoBack={() => {
                      setSelectedGameId(null);
                      setIsSchulteInnerPlaying(false);
                    }}
                    userNickname={user.nickname}
                    onConsumeEntropy={consumeEntropy}
                    onScoreSubmit={handleScoreSubmit}
                    currentUserId={user.userId}
                    avatarColor={user.avatarColor}
                    avatarEmoji={user.avatarEmoji}
                    initialDifficulty={minesweeperSettings.difficulty}
                  />
                )}

                {selectedGameId === 'memory' && (
                  <MemoryMatrix
                    theme={activeTheme}
                    onGoBack={() => {
                      setSelectedGameId(null);
                      setIsSchulteInnerPlaying(false);
                    }}
                    userNickname={user.nickname}
                    onConsumeEntropy={consumeEntropy}
                    onScoreSubmit={handleScoreSubmit}
                    currentUserId={user.userId}
                    avatarColor={user.avatarColor}
                    avatarEmoji={user.avatarEmoji}
                  />
                )}

                {selectedGameId === 'life' && (
                  <GameOfLife
                    theme={activeTheme}
                    onGoBack={() => {
                      setSelectedGameId(null);
                      setIsSchulteInnerPlaying(false);
                    }}
                    userNickname={user.nickname}
                    onConsumeEntropy={consumeEntropy}
                  />
                )}

                {selectedGameId === 'pixel' && (
                  <PixelCanvas
                    theme={activeTheme}
                    onGoBack={() => {
                      setSelectedGameId(null);
                      setIsSchulteInnerPlaying(false);
                    }}
                    userNickname={user.nickname}
                    onConsumeEntropy={consumeEntropy}
                    currentUserId={user.userId}
                    avatarColor={user.avatarColor}
                    avatarEmoji={user.avatarEmoji}
                  />
                )}

                {selectedGameId === 'snake' && (
                  <Snake
                    theme={activeTheme}
                    onGoBack={() => {
                      setSelectedGameId(null);
                      setIsSchulteInnerPlaying(false);
                    }}
                    userNickname={user.nickname}
                    onConsumeEntropy={consumeEntropy}
                  />
                )}
              </motion.div>
            )}
          </div>

          {/* Leaderboard */}
          {selectedGameId === null && user.userId && (
            <div className={`w-full max-w-2xl rounded-2xl p-4.5 ${activeTheme.card} border ${activeTheme.border} transition-colors duration-300`}>
              <div className="flex items-center gap-2 mb-3.5 pb-2.5 border-b border-zinc-800/60">
                <Trophy size={15} className="text-amber-500 animate-bounce" />
                <h4 className="text-xs font-extrabold text-white uppercase tracking-wider">格子熵对抗排行荣誉碑 (每日解熵与高速格盘)</h4>
              </div>
              <Leaderboard
                currentUserId={user.userId}
                localScores={localScores}
                theme={activeTheme}
                activeTab="level"
                difficultyFilter="Level 1"
                user={user}
              />
            </div>
          )}
        </main>

        {/* ========================================================= */}
        {/* POSTER VIEW OVERLAY (Modals) */}
        {/* ========================================================= */}
        <AnimatePresence>
          {recentScore && (
            <ScorePoster
              score={recentScore}
              theme={activeTheme}
              onClose={() => setRecentScore(null)}
            />
          )}
        </AnimatePresence>

        {/* ========================================================= */}
        {/* SLIDE-OUT DRAWER (Hamburger Menu settings) */}
        {/* ========================================================= */}
        <AnimatePresence>
          {isDrawerOpen && (
            <>
              {/* Drawer Backdrop overlay */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.6 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsDrawerOpen(false)}
                className="fixed inset-0 bg-black/70 z-50 backdrop-blur-sm"
              />

              {/* Custom Drawer container */}
              <motion.div
                initial={{ x: '100%' }}
                animate={{ x: 0 }}
                exit={{ x: '100%' }}
                transition={{ type: 'spring', damping: 26, stiffness: 220 }}
                className={`fixed top-0 right-0 bottom-0 w-[88%] max-w-[400px] z-50 p-5 overflow-y-auto ${activeTheme.bg} border-l border-zinc-800/80 shadow-2xl flex flex-col select-none`}
              >
                {/* Header of Menu */}
                <div className="flex items-center justify-between pb-4 mb-5 border-b border-zinc-800/40">
                  <div className="flex items-center gap-2">
                    <Trophy size={16} className="text-[#3EB489]" />
                    <span className="text-sm font-extrabold text-white font-sans tracking-wide">训练控制中心</span>
                  </div>
                  <button
                    onClick={() => setIsDrawerOpen(false)}
                    className="p-1 px-2.5 rounded-lg bg-zinc-800/50 text-zinc-400 hover:text-white transition-all text-xs flex items-center gap-1 cursor-pointer font-bold border border-zinc-700/40"
                  >
                    <X size={14} />
                    <span>收起</span>
                  </button>
                </div>

                {/* Body elements of Drawer */}
                <div className="space-y-6 pb-16 flex-1">
                  <div className="bg-[#3EB489]/5 p-3 rounded-xl border border-[#3EB489]/15 text-[10px] leading-relaxed text-zinc-400">
                    💡 您在此处可以随时自定义角色名、修改头像与背景主题，变更将自适应并实时全大厅、全游戏地实时全局生效。
                  </div>

                  {/* Profile Name editor */}
                  {user.userId && (
                    <div className="space-y-1">
                      <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-bold px-1 mb-1">
                        玩家个性设置
                      </span>
                      <NameEditor
                        user={user}
                        onChange={handleUserChange}
                        theme={activeTheme}
                      />
                    </div>
                  )}

                  {/* Themes list selector */}
                  <div className="space-y-1">
                    <span className="text-[10px] text-zinc-500 uppercase tracking-widest block font-bold px-1 mb-1">
                      极简视力主题
                    </span>
                    <ThemeSelector
                      currentThemeId={themeId}
                      onSelect={handleThemeChange}
                      theme={activeTheme}
                    />
                  </div>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ========================================================= */}
        {/* GAME SPECIFIC CONFIGURABLE MODAL */}
        {/* ========================================================= */}
        <AnimatePresence>
          {activeSettingsGameId && (
            <>
              {/* Modal Backdrop */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 0.7 }}
                exit={{ opacity: 0 }}
                onClick={() => setActiveSettingsGameId(null)}
                className="fixed inset-0 bg-black/80 z-50 backdrop-blur-md"
              />

              {/* Modal Inner Container */}
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 10 }}
                transition={{ type: 'spring', damping: 24, stiffness: 210 }}
                className={`fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[92%] max-w-[420px] z-50 rounded-2xl border border-zinc-850 bg-zinc-950 p-5 shadow-2xl select-none ${activeTheme.bg}`}
              >
                {/* Header */}
                <div className="flex items-center justify-between pb-3.5 mb-4 border-b border-zinc-800/60">
                  <div className="flex items-center gap-2">
                    <Settings className="text-emerald-400 animate-spin-slow" size={16} />
                    <span className="text-sm font-black text-white tracking-wide">
                      {activeSettingsGameId === 'gomoku' && '五子连珠 (Gobang) 偏好设置'}
                      {activeSettingsGameId === 'sudoku' && '终极数独 (Sudoku) 偏好设置'}
                      {activeSettingsGameId === '2048' && '2048 合并 (Game 2048) 偏好设置'}
                      {activeSettingsGameId === 'schulte' && '舒尔特网格 (Schulte) 偏好设置'}
                      {activeSettingsGameId === 'mines' && '经典扫雷 (Minesweeper) 偏好设置'}
                    </span>
                  </div>
                  <button
                    onClick={() => setActiveSettingsGameId(null)}
                    className="p-1 rounded-lg hover:bg-zinc-800 text-zinc-500 hover:text-white transition-all cursor-pointer"
                  >
                    <X size={14} />
                  </button>
                </div>

                {/* Body scroll area */}
                <div className="space-y-5 max-h-[360px] overflow-y-auto pr-1">
                  {activeSettingsGameId === 'gomoku' && (
                    <>
                      {/* Grid Size Config */}
                      <div className="space-y-2">
                        <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">
                          棋盘规格 (Board size & lines)
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {[11, 13, 15].map((size) => (
                            <button
                              key={`gomoku-size-${size}`}
                              onClick={() => setGomokuSettings(prev => ({ ...prev, gridSize: size }))}
                              className={`py-2 px-3 rounded-lg text-xs font-black border transition-all cursor-pointer ${
                                gomokuSettings.gridSize === size
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500'
                                  : 'bg-zinc-900/40 text-zinc-400 border-zinc-800 hover:bg-zinc-800'
                              }`}
                            >
                              {size} x {size}
                            </button>
                          ))}
                        </div>
                        <p className="text-[9px] text-zinc-500">
                          * 对应初级、标准与专业围棋标准，更高规格要求更大博弈视野与后视深度。
                        </p>
                      </div>

                      {/* Difficulty Config */}
                      <div className="space-y-2">
                        <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">
                          智能黑洞白子 AI 智商（Difficulty）
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {[
                            { id: 'easy', label: '入门小白' },
                            { id: 'medium', label: '算力中班' },
                            { id: 'hard', label: '五子大师' },
                          ].map((diff) => (
                            <button
                              key={`gomoku-diff-${diff.id}`}
                              onClick={() => setGomokuSettings(prev => ({ ...prev, difficulty: diff.id as 'easy' | 'medium' | 'hard' }))}
                              className={`py-2 px-3 rounded-lg text-xs font-black border transition-all cursor-pointer ${
                                gomokuSettings.difficulty === diff.id
                                  ? 'bg-purple-500/20 text-purple-300 border-purple-500'
                                  : 'bg-zinc-900/40 text-zinc-400 border-zinc-800 hover:bg-zinc-800'
                              }`}
                            >
                              {diff.label}
                            </button>
                          ))}
                        </div>
                        <p className="text-[9px] text-zinc-500">
                          * 大师模式下，AI 白子会预判并切断您的每一条死/活三 or 死/活四路线，博弈挑战性拉满。
                        </p>
                      </div>
                    </>
                  )}

                  {activeSettingsGameId === 'sudoku' && (
                    <>
                      {/* Difficulty Config */}
                      <div className="space-y-2">
                        <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">
                          数独难度设定 (Difficulty)
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {[
                            { id: 'easy', label: '初级小白' },
                            { id: 'medium', label: '中级标准' },
                            { id: 'hard', label: '逻辑大师' },
                          ].map((diff) => (
                            <button
                              key={`sudoku-diff-${diff.id}`}
                              onClick={() => setSudokuSettings(prev => ({ ...prev, difficulty: diff.id as 'easy' | 'medium' | 'hard' }))}
                              className={`py-2 px-3 rounded-lg text-xs font-black border transition-all cursor-pointer ${
                                sudokuSettings.difficulty === diff.id
                                  ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500'
                                  : 'bg-zinc-900/40 text-zinc-400 border-zinc-800 hover:bg-zinc-800'
                              }`}
                            >
                              {diff.label}
                            </button>
                          ))}
                        </div>
                        <p className="text-[9px] text-zinc-500">
                          * 初级暴露较多已知数值以供探索；中等要求基础三链锁；大师深度测试数独的隐性唯余与链排。
                        </p>
                      </div>
                    </>
                  )}

                  {activeSettingsGameId === 'mines' && (
                    <>
                      {/* Difficulty Config */}
                      <div className="space-y-2">
                        <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">
                          扫雷雷盘规则设定 (Difficulty)
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {[
                            { id: 'easy', label: '初级(9x9 10雷)' },
                            { id: 'medium', label: '中级(12x12 22雷)' },
                            { id: 'hard', label: '高级(15x15 35雷)' },
                          ].map((diff) => (
                            <button
                              key={`mines-diff-${diff.id}`}
                              onClick={() => setMinesweeperSettings(prev => ({ ...prev, difficulty: diff.id as 'easy' | 'medium' | 'hard' }))}
                              className={`py-2 px-3 rounded-lg text-xs font-black border transition-all cursor-pointer leading-tight ${
                                minesweeperSettings.difficulty === diff.id
                                  ? 'bg-[#F43F5E]/20 text-rose-300 border-[#F43F5E]'
                                  : 'bg-zinc-900/40 text-zinc-400 border-zinc-800 hover:bg-zinc-800'
                              }`}
                            >
                              {diff.label}
                            </button>
                          ))}
                        </div>
                        <p className="text-[9px] text-zinc-500">
                          * 初级便于视力敏捷训练；中级带有中等排斥链推理；高级测试极佳的空间对焦张力与深逻辑连通。
                        </p>
                      </div>
                    </>
                  )}

                  {activeSettingsGameId === '2048' && (
                    <>
                      {/* Spawn Mode Config */}
                      <div className="space-y-2">
                        <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">
                          新牌生成机制 (Tile Spawn Engine)
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {[
                            { id: 'normal', label: '经典(90%出2)' },
                            { id: 'chaos', label: '混沌(50%出4)' },
                            { id: 'hell', label: '炼狱(100%出4)' },
                          ].map((mode) => (
                            <button
                              key={`2048-mode-${mode.id}`}
                              onClick={() => setGame2048Settings(prev => ({ ...prev, spawnMode: mode.id as 'normal' | 'chaos' | 'hell' }))}
                              className={`py-2 px-1 rounded-lg text-xs font-black border transition-all cursor-pointer leading-tight ${
                                game2048Settings.spawnMode === mode.id
                                  ? 'bg-amber-500/20 text-amber-303 border-amber-500'
                                  : 'bg-zinc-900/40 text-zinc-405 border-zinc-800 hover:bg-zinc-800'
                              }`}
                            >
                              {mode.label}
                            </button>
                          ))}
                        </div>
                        <p className="text-[9px] text-zinc-505">
                          * 在混沌或炼狱模式下，生成的初始数值更大，网格极易卡死或提速合并，对高阶规划挑战极大！
                        </p>
                      </div>

                      {/* Starter blocks config */}
                      <div className="space-y-2">
                        <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">
                          开局奖励区块数 (Starter Blocks)
                        </label>
                        <div className="grid grid-cols-3 gap-2">
                          {[2, 3, 4].map((count) => (
                            <button
                              key={`2048-count-${count}`}
                              onClick={() => setGame2048Settings(prev => ({ ...prev, starterCount: count }))}
                              className={`py-2 px-3 rounded-lg text-xs font-black border transition-all cursor-pointer ${
                                game2048Settings.starterCount === count
                                  ? 'bg-[#3EB489]/20 text-emerald-300 border-[#3EB489]'
                                  : 'bg-zinc-900/40 text-zinc-400 border-zinc-800 hover:bg-zinc-800'
                              }`}
                            >
                              {count} 块卡牌
                            </button>
                          ))}
                        </div>
                        <p className="text-[9px] text-zinc-500">
                          * 开局加载出的空闲奖励牌数量，较多数量可支持高级博局迅速衔接合并。
                        </p>
                      </div>
                    </>
                  )}

                  {activeSettingsGameId === 'schulte' && (
                    <>
                      {/* Default Dimension Config */}
                      <div className="space-y-2">
                        <label className="text-[10px] text-zinc-400 font-bold uppercase tracking-wider block">
                          自由训练 舒尔特网格维度 (Dimension size)
                        </label>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 animate-pulse-none">
                          {[3, 4, 5, 6].map((dim) => (
                            <button
                              key={`schulte-dim-${dim}`}
                              onClick={() => setSchulteSettings({ defaultDimension: dim })}
                              className={`py-2 px-1 rounded-lg text-xs font-black border transition-all cursor-pointer ${
                                schulteSettings.defaultDimension === dim
                                  ? 'bg-[#3EB489]/20 text-emerald-300 border-[#3EB489]'
                                  : 'bg-zinc-900/40 text-zinc-400 border-zinc-800 hover:bg-zinc-800'
                              }`}
                            >
                              {dim} x {dim}
                            </button>
                          ))}
                        </div>
                        <p className="text-[9px] text-zinc-500">
                          * 舒尔特最核心的视力自由训练参数。3x3为热身，5x5为国际测试标准，6x6测试并拓展极限界。
                        </p>
                      </div>
                    </>
                  )}

                </div>

                {/* Footer Save button */}
                <div className="mt-6 pt-3 border-t border-zinc-800/40 flex justify-end">
                  <button
                    onClick={() => setActiveSettingsGameId(null)}
                    className="py-1.5 px-4 rounded-lg text-xs font-bold bg-[#3EB489] hover:bg-[#3d9f7c] text-zinc-950 active:scale-95 transition-all shadow-md cursor-pointer flex items-center gap-1"
                  >
                    <span>完成设置并返回大厅</span>
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

      </div>

      {/* ========================================================= */}
      {/* AUTH MODAL OVERLAY (outside main container) */}
      {/* ========================================================= */}
      <AnimatePresence>
        {showAuth && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.7 }}
              exit={{ opacity: 0 }}
              onClick={() => {}}
              className="fixed inset-0 bg-black/80 z-50 backdrop-blur-md"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="pointer-events-auto w-full max-w-md">
                <AuthModal
                  theme={activeTheme}
                  onSuccess={(authUser) => handleAuthSuccess(authUser)}
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ========================================================= */}
      {/* PERSISTENT MINIMAL FOOTER */}
      {/* ========================================================= */}
      <footer className="w-full text-center py-4 mt-8 border-t border-zinc-900 text-[10px] text-zinc-650 block leading-tight">
        <p className="select-text">Grid Game Box Diagnostic Hub © 矩阵网格游戏实验室 · 筑梦几何机能集</p>
      </footer>
    </div>
  );
}
