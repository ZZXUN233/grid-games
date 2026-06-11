import React, { useState, useEffect } from 'react';
import { ScoreRecord, GameTheme, UserProfile, EntropyRecord } from '../types';
import { fetchTopScores, fetchGameScores, fetchTodayEntropyLeaderboard } from '../api';
import { Trophy, RefreshCw, Orbit, Flame, Target, Bomb, Table, Cpu, Gamepad2 } from 'lucide-react';

interface LeaderboardProps {
  currentUserId: string;
  localScores: ScoreRecord[];
  theme: GameTheme;
  activeTab: 'level' | 'free' | 'letter';
  difficultyFilter: string;
  user?: UserProfile;
}

// Built-in AI challengers for a warm leaderboard experience
const LOCAL_CHALLENGERS: Record<string, ScoreRecord[]> = {
  'Level 1': [
    { id: 'c1', userId: 'ai_koala', nickname: '瞬时王考拉 🐨', avatarColor: '#10B981', avatarEmoji: '🐨', mode: 'level', difficulty: 'Level 1', time: 3.42, createdAt: Date.now() - 500000 },
    { id: 'c2', userId: 'ai_panda', nickname: '极速熊猫 🐼', avatarColor: '#8B5CF6', avatarEmoji: '🐼', mode: 'level', difficulty: 'Level 1', time: 5.11, createdAt: Date.now() - 3000000 }
  ],
  '3x3': [
    { id: 'c3', userId: 'ai_falcon', nickname: '猎鹰之眼 🦅', avatarColor: '#EF4444', avatarEmoji: '🦅', mode: 'free', difficulty: '3x3', time: 4.02, createdAt: Date.now() - 200000 },
    { id: 'c4', userId: 'ai_fox', nickname: '幻影狐 🦊', avatarColor: '#F59E0B', avatarEmoji: '🦊', mode: 'free', difficulty: '3x3', time: 6.25, createdAt: Date.now() - 8000000 }
  ],
  '5x5': [
    { id: 'c5', userId: 'ai_cheetah', nickname: '闪电猎豹 🐆', avatarColor: '#F59E0B', avatarEmoji: '🐆', mode: 'free', difficulty: '5x5', time: 14.88, createdAt: Date.now() - 1200000 },
    { id: 'c6', userId: 'ai_owl', nickname: '睿智猫头鹰 🦉', avatarColor: '#6366F1', avatarEmoji: '🦉', mode: 'free', difficulty: '5x5', time: 19.32, createdAt: Date.now() - 7000000 }
  ],
  'Alphabet 5x5': [
    { id: 'c7', userId: 'ai_dolphin', nickname: '感知海豚 🐬', avatarColor: '#3B82F6', avatarEmoji: '🐬', mode: 'letter', difficulty: 'Alphabet 5x5', time: 16.54, createdAt: Date.now() - 95000 },
    { id: 'c8', userId: 'ai_rabbit', nickname: '闪避兔 🐰', avatarColor: '#EC4899', avatarEmoji: '🐰', mode: 'letter', difficulty: 'Alphabet 5x5', time: 24.12, createdAt: Date.now() - 840000 }
  ]
};

const LOCAL_ENTROPY_CHALLENGERS: Omit<EntropyRecord, 'date'>[] = [
  { id: 'ec1', userId: 'ai_koala', nickname: '瞬时王考拉 🐨', avatarColor: '#10B981', avatarEmoji: '🐨', negentropy: 220 },
  { id: 'ec2', userId: 'ai_panda', nickname: '极速熊猫 🐼', avatarColor: '#8B5CF6', avatarEmoji: '🐼', negentropy: 185 },
  { id: 'ec3', userId: 'ai_falcon', nickname: '猎鹰之眼 🦅', avatarColor: '#EF4444', avatarEmoji: '🦅', negentropy: 145 },
  { id: 'ec4', userId: 'ai_fox', nickname: '幻影狐 🦊', avatarColor: '#F59E0B', avatarEmoji: '🦊', negentropy: 110 },
  { id: 'ec5', userId: 'ai_owl', nickname: '睿智猫头鹰 🦉', avatarColor: '#6366F1', avatarEmoji: '🦉', negentropy: 90 }
];

// Game definitions for the unified leaderboard
const GAMES: { id: string; label: string; icon: React.ElementType; color: string }[] = [
  { id: 'schulte', label: '舒尔特', icon: Target, color: '#3EB489' },
  { id: 'minesweeper', label: '扫雷', icon: Bomb, color: '#F43F5E' },
  { id: 'sudoku', label: '数独', icon: Table, color: '#10B981' },
  { id: 'memory-matrix', label: '记忆矩阵', icon: Cpu, color: '#8B5CF6' },
  { id: 'snake', label: '贪吃蛇', icon: Gamepad2, color: '#F59E0B' },
];

// Game-specific difficulty filters
const GAME_DIFFICULTIES: Record<string, { label: string; value: string }[]> = {
  'schulte': [
    { label: '闯关 Lv.1', value: 'Level 1' },
    { label: '自由 3x3', value: '3x3' },
    { label: '自由 4x4', value: '4x4' },
    { label: '自由 5x5', value: '5x5' },
    { label: '自由 6x6', value: '6x6' },
    { label: '字母 5x5', value: 'Alphabet 5x5' },
  ],
  'minesweeper': [
    { label: '初级 9x9', value: '扫雷 [初级]' },
    { label: '中级 12x12', value: '扫雷 [中级]' },
    { label: '高级 15x15', value: '扫雷 [高级]' },
  ],
  'sudoku': [
    { label: '初级', value: '数独 [初级]' },
    { label: '中级', value: '数独 [中级]' },
    { label: '高级', value: '数独 [高级]' },
  ],
  'memory-matrix': [],
  'snake': [],
};

export default function Leaderboard({ currentUserId, localScores, theme, activeTab, difficultyFilter, user }: LeaderboardProps) {
  const [leaderboardMode, setLeaderboardMode] = useState<'entropy' | 'games'>('entropy');

  // Game leaderboard state
  const [selectedGame, setSelectedGame] = useState('schulte');
  const [selectedDifficulty, setSelectedDifficulty] = useState('');
  const [dbScores, setDbScores] = useState<ScoreRecord[]>([]);

  // Entropy states
  const [dbEntropyRecords, setDbEntropyRecords] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [syncCount, setSyncCount] = useState(0);

  // Auto-select first difficulty when game changes
  useEffect(() => {
    const diffs = GAME_DIFFICULTIES[selectedGame] || [];
    setSelectedDifficulty(diffs.length > 0 ? diffs[0].value : '');
  }, [selectedGame]);

  // Fetch online data
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      const todayStr = new Date().toISOString().split('T')[0];
      try {
        if (leaderboardMode === 'entropy') {
          const records = await fetchTodayEntropyLeaderboard(todayStr, 15);
          setDbEntropyRecords(records);
        } else {
          if (selectedGame === 'schulte' && selectedDifficulty) {
            // Use legacy endpoint for Schulte to keep backward compat
            let mode = 'free';
            if (selectedDifficulty.startsWith('Level')) mode = 'level';
            else if (selectedDifficulty.startsWith('Alphabet')) mode = 'letter';
            const records = await fetchTopScores(mode, selectedDifficulty, 15);
            setDbScores(records);
          } else if (selectedDifficulty) {
            const records = await fetchGameScores(selectedGame, selectedDifficulty, 15);
            setDbScores(records);
          } else {
            const records = await fetchGameScores(selectedGame, undefined, 15);
            setDbScores(records);
          }
        }
      } catch (e) {
        console.warn('Leaderboard fetch failed, using offline data.');
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [leaderboardMode, selectedGame, selectedDifficulty, syncCount]);

  // Merge game scores
  const getMergedScores = (): ScoreRecord[] => {
    const allRecords = [...dbScores];

    // Add local scores for this game+ difficulty
    localScores.forEach((local) => {
      if (!allRecords.some((r) => r.id === local.id)) {
        // Match by difficulty pattern
        if (selectedDifficulty && local.difficulty === selectedDifficulty) {
          allRecords.push(local);
        } else if (!selectedDifficulty) {
          allRecords.push(local);
        }
      }
    });

    // Add AI challengers for Schulte
    if (selectedGame === 'schulte' && selectedDifficulty) {
      const challengers = LOCAL_CHALLENGERS[selectedDifficulty] || [];
      challengers.forEach((chal) => {
        if (!allRecords.some((r) => r.id === chal.id || r.userId === chal.userId)) {
          allRecords.push(chal);
        }
      });
    }

    return allRecords.sort((a, b) => a.time - b.time).slice(0, 10);
  };

  // Merge entropy leaderboard
  const getMergedEntropyLeaderboard = (): any[] => {
    const allEntropy = [...dbEntropyRecords];
    const todayStr = new Date().toISOString().split('T')[0];

    // Inject self
    if (user && user.userId) {
      const selfIndex = allEntropy.findIndex((e) => e.userId === user.userId);
      if (selfIndex === -1 && (user.negentropy || 0) > 0) {
        allEntropy.push({
          id: `${user.userId}_${todayStr}`,
          userId: user.userId,
          nickname: user.nickname,
          avatarColor: user.avatarColor,
          avatarEmoji: user.avatarEmoji,
          date: todayStr,
          negentropy: user.negentropy
        });
      } else if (selfIndex !== -1 && (user.negentropy || 0) > (allEntropy[selfIndex].negentropy || 0)) {
        allEntropy[selfIndex].negentropy = user.negentropy;
      }
    }

    LOCAL_ENTROPY_CHALLENGERS.forEach((challenger) => {
      if (!allEntropy.some((e) => e.userId === challenger.userId)) {
        allEntropy.push({ ...challenger, date: todayStr });
      }
    });

    return allEntropy.sort((a, b) => (b.negentropy || 0) - (a.negentropy || 0)).slice(0, 10);
  };

  const finalScores = getMergedScores();
  const finalEntropyLeaderboard = getMergedEntropyLeaderboard();
  const difficulties = GAME_DIFFICULTIES[selectedGame] || [];

  // Ranking badge helper
  const rankBadge = (rank: number) => {
    if (rank === 1) return { emoji: '🥇', cls: 'text-yellow-500 font-bold', border: 'border-yellow-500/20 bg-yellow-500/5' };
    if (rank === 2) return { emoji: '🥈', cls: 'text-slate-300 font-bold', border: 'border-slate-300/20 bg-slate-300/5' };
    if (rank === 3) return { emoji: '🥉', cls: 'text-amber-700 font-bold', border: 'border-amber-700/20 bg-amber-700/5' };
    return { emoji: '', cls: 'text-zinc-500 font-mono font-bold', border: 'border-zinc-800/40 bg-zinc-900/10' };
  };

  return (
    <div className={`p-5 rounded-2xl ${theme.card} border border-zinc-800/30 transition-all duration-300`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="text-amber-500 animate-pulse shrink-0" size={18} />
            <h3 className={`text-base font-black ${theme.textMain}`}>格子熵 · 巅峰荣誉殿堂</h3>
          </div>
          <p className={`text-xs ${theme.textMuted} mt-1`}>
            {leaderboardMode === 'entropy'
              ? '每日消解混沌负熵的大师排行'
              : `${GAMES.find(g => g.id === selectedGame)?.label || ''} 极速纪录排行榜`}
          </p>
        </div>

        <button
          onClick={() => setSyncCount((c) => c + 1)}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1 text-xs rounded bg-white/5 border border-zinc-800 text-zinc-400 hover:bg-white/10 hover:border-zinc-700 active:scale-95 transition-all self-start sm:self-center cursor-pointer"
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          <span>{loading ? '同步中...' : '刷新排行'}</span>
        </button>
      </div>

      {/* Top-Level Tab: Entropy vs Games */}
      <div className="grid grid-cols-2 p-1 rounded-xl bg-black/60 border border-zinc-900 text-xs gap-1 mb-5">
        <button
          onClick={() => setLeaderboardMode('entropy')}
          className={`py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            leaderboardMode === 'entropy'
              ? 'bg-[#3EB489] text-zinc-950 shadow-md scale-[1.02]'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Orbit size={13} className={leaderboardMode === 'entropy' ? 'animate-spin' : ''} style={{ animationDuration: '4s' }} />
          <span>今日熵对抗</span>
        </button>
        <button
          onClick={() => setLeaderboardMode('games')}
          className={`py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            leaderboardMode === 'games'
              ? 'bg-amber-600 text-zinc-950 shadow-md scale-[1.02]'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Flame size={13} />
          <span>游戏荣誉榜</span>
        </button>
      </div>

      {/* ==================== ENTROPY LEADERBOARD ==================== */}
      {leaderboardMode === 'entropy' && (
        <div className="space-y-2">
          {finalEntropyLeaderboard.map((record, index) => {
            const isSelf = record.userId === currentUserId;
            const rank = index + 1;
            const targetLeft = Math.max(0, 100 - (record.negentropy || 0));
            const isComplete = (record.negentropy || 0) >= 100;
            const labelStr = isComplete
              ? `已完成 (超额 ${Math.abs(100 - (record.negentropy || 0))})`
              : `未完成 (余 ${targetLeft} 熵)`;

            const badge = rankBadge(rank);
            let cardBorder = badge.border;
            if (isSelf) cardBorder = 'border-[#3EB489]/50 bg-[#3EB489]/5 text-[#3EB489] shadow-sm';

            return (
              <div
                key={`entropy-${record.id}`}
                className={`flex items-center justify-between p-3 rounded-xl border text-xs transition-all ${cardBorder}`}
              >
                <div className="flex items-center gap-3 max-w-[65%]">
                  <div className={`w-6 text-center ${badge.cls}`}>
                    {badge.emoji ? <span className="text-sm">{badge.emoji}</span> : rank}
                  </div>
                  <div className="w-7.5 h-7.5 rounded-xl flex items-center justify-center text-sm shadow-inner shrink-0" style={{ backgroundColor: record.avatarColor }}>
                    <span className="select-none text-xs">{record.avatarEmoji}</span>
                  </div>
                  <div className="truncate">
                    <span className="font-extrabold text-zinc-100 block truncate leading-tight">{record.nickname}</span>
                    <span className={`text-[9px] font-medium leading-tight block mt-0.5 ${isSelf ? 'text-[#3EB489]' : 'text-zinc-500'}`}>
                      {isSelf ? `YOU · ${labelStr}` : labelStr}
                    </span>
                  </div>
                </div>
                <div className="text-right flex flex-col justify-center">
                  <span className={`font-mono text-xs font-black leading-none ${isSelf ? 'text-[#3EB489]' : 'text-[#3EB489]/90'}`}>
                    +{record.negentropy || 0} 负熵
                  </span>
                  <span className="text-[9px] text-zinc-500 font-mono mt-1 leading-none block">
                    熵值降至: {Math.max(-999, 100 - (record.negentropy || 0))}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ==================== UNIFIED GAME LEADERBOARD ==================== */}
      {leaderboardMode === 'games' && (
        <>
          {/* Game selector chips */}
          <div className="flex flex-wrap gap-1.5 mb-4">
            {GAMES.map((game) => {
              const Icon = game.icon;
              const isActive = selectedGame === game.id;
              return (
                <button
                  key={game.id}
                  onClick={() => setSelectedGame(game.id)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white/10 text-white border border-white/20 shadow-sm'
                      : 'text-zinc-500 hover:text-zinc-300 border border-transparent'
                  }`}
                  style={isActive ? { borderColor: `${game.color}40`, backgroundColor: `${game.color}15`, color: game.color } : {}}
                >
                  <Icon size={12} />
                  <span>{game.label}</span>
                </button>
              );
            })}
          </div>

          {/* Difficulty sub-filter (if applicable) */}
          {difficulties.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {difficulties.map((d) => (
                <button
                  key={d.value}
                  onClick={() => setSelectedDifficulty(d.value)}
                  className={`px-2.5 py-1 text-[10px] rounded-lg font-bold transition-all cursor-pointer ${
                    selectedDifficulty === d.value
                      ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                      : 'bg-zinc-900/40 text-zinc-500 border border-zinc-800 hover:text-zinc-300'
                  }`}
                >
                  {d.label}
                </button>
              ))}
            </div>
          )}

          {/* Ranking list */}
          <div className="space-y-1.5">
            {finalScores.length === 0 ? (
              <div className="py-10 text-center text-xs text-zinc-500">
                暂无记录，等待你来创下首个榜单纪录！
              </div>
            ) : (
              finalScores.map((record, index) => {
                const isSelf = record.userId === currentUserId;
                const rank = index + 1;
                const badge = rankBadge(rank);

                return (
                  <div
                    key={record.id}
                    className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition-all ${
                      isSelf ? 'border-amber-500/50 bg-amber-500/5 shadow-sm' : `${badge.border} hover:bg-zinc-900/30 hover:border-zinc-800`
                    }`}
                  >
                    <div className="flex items-center gap-2 max-w-[65%]">
                      <div className={`w-6 text-center ${badge.cls}`}>
                        {badge.emoji ? <span className="text-sm">{badge.emoji}</span> : rank}
                      </div>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-sm shadow-inner shrink-0" style={{ backgroundColor: record.avatarColor }}>
                        <span className="select-none text-xs">{record.avatarEmoji}</span>
                      </div>
                      <div className="truncate">
                        <span className="font-semibold text-zinc-200 block truncate leading-tight">{record.nickname}</span>
                        {isSelf && (
                          <span className="text-[9px] text-amber-500 font-bold uppercase tracking-wider block leading-tight">YOU</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right flex flex-col justify-center">
                      <span className="font-mono text-sm font-bold text-amber-500 leading-none">
                        {record.time.toFixed(2)}s
                      </span>
                      <span className="text-[9px] text-zinc-500 font-mono mt-0.5 leading-none block">
                        {new Date(record.createdAt).toLocaleDateString(undefined, { month: '2-digit', day: '2-digit' })}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}
    </div>
  );
}
