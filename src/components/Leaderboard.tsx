import React, { useState, useEffect } from 'react';
import { ScoreRecord, GameTheme, UserProfile, EntropyRecord } from '../types';
import { fetchTopScores, fetchTodayEntropyLeaderboard } from '../api';
import { Trophy, RefreshCw, Eye, Component, Swords, Hash, Flame, Sparkles, Orbit } from 'lucide-react';

interface LeaderboardProps {
  currentUserId: string;
  localScores: ScoreRecord[];
  theme: GameTheme;
  activeTab: 'level' | 'free' | 'letter';
  difficultyFilter: string;
  user?: UserProfile;
}

// Creative AI Challenger records to give a warm, fully populated leaderboard experience immediately
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

export default function Leaderboard({ currentUserId, localScores, theme, activeTab, difficultyFilter, user }: LeaderboardProps) {
  const [leaderboardMode, setLeaderboardMode] = useState<'entropy' | 'schulte'>('entropy');
  
  // Schulte states
  const [boardType, setBoardType] = useState<'level' | 'free' | 'letter'>(activeTab);
  const [selectedSubDiff, setSelectedSubDiff] = useState<string>('');
  const [dbScores, setDbScores] = useState<ScoreRecord[]>([]);
  
  // Entropy states
  const [dbEntropyRecords, setDbEntropyRecords] = useState<any[]>([]);

  const [loading, setLoading] = useState(false);
  const [syncCount, setSyncCount] = useState(0);

  // Keep boardType synced when game triggers a top-level tab change
  useEffect(() => {
    setBoardType(activeTab);
  }, [activeTab]);

  // Set default filter values depending on mode
  useEffect(() => {
    if (boardType === 'level') {
      setSelectedSubDiff(difficultyFilter.startsWith('Level') ? difficultyFilter : 'Level 1');
    } else if (boardType === 'free') {
      setSelectedSubDiff(difficultyFilter.match(/^\d+x\d+$/) ? difficultyFilter : '5x5');
    } else {
      setSelectedSubDiff('Alphabet 5x5');
    }
  }, [boardType, difficultyFilter]);

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
          if (selectedSubDiff) {
            const records = await fetchTopScores(boardType, selectedSubDiff, 15);
            setDbScores(records);
          }
        }
      } catch (e) {
        console.warn("Firestore fetch exception, using offline rules.");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [leaderboardMode, boardType, selectedSubDiff, syncCount]);

  // Merge Schulte scores
  const getMergedLeaderboard = (): ScoreRecord[] => {
    const filteredLocal = localScores.filter(
      (s) => s.mode === boardType && s.difficulty === selectedSubDiff
    );
    const seedChallengers = LOCAL_CHALLENGERS[selectedSubDiff] || [];
    const allRecords = [...dbScores];

    filteredLocal.forEach((local) => {
      if (!allRecords.some((r) => r.id === local.id)) {
        allRecords.push(local);
      }
    });

    seedChallengers.forEach((chal) => {
      if (!allRecords.some((r) => r.id === chal.id || r.userId === chal.userId)) {
        allRecords.push(chal);
      }
    });

    return allRecords.sort((a, b) => a.time - b.time).slice(0, 10);
  };

  // Merge Entropy scores
  const getMergedEntropyLeaderboard = (): any[] => {
    const allEntropy = [...dbEntropyRecords];
    const todayStr = new Date().toISOString().split('T')[0];

    // Inject self if not present
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

    // Inject static challenger backups to make leaderboard full/competitive
    LOCAL_ENTROPY_CHALLENGERS.forEach((challenger) => {
      if (!allEntropy.some((e) => e.userId === challenger.userId)) {
        allEntropy.push({
          ...challenger,
          date: todayStr
        });
      }
    });

    // Sort descending by entropy consumed
    return allEntropy.sort((a, b) => (b.negentropy || 0) - (a.negentropy || 0)).slice(0, 10);
  };

  const finalSchulteLeaderboard = getMergedLeaderboard();
  const finalEntropyLeaderboard = getMergedEntropyLeaderboard();

  return (
    <div className={`p-5 rounded-2xl ${theme.card} border border-zinc-800/30 transition-all duration-300`}>
      {/* Top Banner & Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2">
            <Trophy className="text-amber-500 animate-pulse shrink-0" size={18} />
            <h3 className={`text-base font-black ${theme.textMain}`}>格子熵 - 巅峰战绩殿堂</h3>
          </div>
          <p className={`text-xs ${theme.textMuted} mt-1`}>
            {leaderboardMode === 'entropy' 
              ? '今日消解混沌负熵的大师。每天首个 100 负熵即攻克兰心熵增任务！' 
              : '与线上极客玩家及内置专注护卫队一决高下。'}
          </p>
        </div>

        {/* Sync Trigger button */}
        <button
          id="refresh-leaderboard-btn"
          onClick={() => setSyncCount((c) => c + 1)}
          disabled={loading}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded bg-white/5 border border-zinc-800 text-zinc-400 hover:bg-white/10 hover:border-zinc-700 active:scale-95 transition-all self-start sm:self-center cursor-pointer`}
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
          <span>{loading ? '同步中...' : '同步云排位'}</span>
        </button>
      </div>

      {/* Primary Category Selector Tab */}
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
          <span>今日对抗熵增排行</span>
        </button>
        <button
          onClick={() => setLeaderboardMode('schulte')}
          className={`py-2 rounded-lg font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
            leaderboardMode === 'schulte'
              ? 'bg-amber-600 text-zinc-950 shadow-md scale-[1.02]'
              : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Flame size={13} />
          <span>舒尔特方格极速</span>
        </button>
      </div>

      {/* ==================== 1. ENTROPY LEADERBOARD VIEW ==================== */}
      {leaderboardMode === 'entropy' && (
        <div className="space-y-2">
          {finalEntropyLeaderboard.map((record, index) => {
            const isSelf = record.userId === currentUserId;
            const rank = index + 1;
            const targetLeft = Math.max(0, 100 - (record.negentropy || 0));
            const isComplete = (record.negentropy || 0) >= 100;
            const labelStr = isComplete
              ? `已完成 (超额 ${Math.abs(100 - record.negentropy)})`
              : `未完成 (余 ${targetLeft} 熵)`;

            let rankBadge = '';
            let rankTextClass = 'text-zinc-500 font-mono font-bold';
            let cardBorder = 'border-zinc-800/40 bg-zinc-900/10';

            if (rank === 1) {
              rankBadge = '🥇';
              rankTextClass = 'text-yellow-500 font-bold';
              cardBorder = 'border-yellow-500/20 bg-yellow-500/5';
            } else if (rank === 2) {
              rankBadge = '🥈';
              rankTextClass = 'text-slate-300 font-bold';
              cardBorder = 'border-slate-300/20 bg-slate-300/5';
            } else if (rank === 3) {
              rankBadge = '🥉';
              rankTextClass = 'text-amber-700 font-bold';
              cardBorder = 'border-amber-700/20 bg-amber-700/5';
            }

            if (isSelf) {
              cardBorder = 'border-[#3EB489]/50 bg-[#3EB489]/5 text-[#3EB489] shadow-sm';
            }

            return (
              <div
                key={`entropy-item-${record.id}`}
                className={`flex items-center justify-between p-3 rounded-xl border text-xs transition-all ${cardBorder}`}
              >
                {/* Left block */}
                <div className="flex items-center gap-3 max-w-[65%]">
                  <div className={`w-6 text-center ${rankTextClass}`}>
                    {rankBadge ? <span className="text-sm">{rankBadge}</span> : rank}
                  </div>

                  <div
                    className="w-7.5 h-7.5 rounded-xl flex items-center justify-center text-sm shadow-inner shrink-0"
                    style={{ backgroundColor: record.avatarColor }}
                  >
                    <span className="select-none text-xs">{record.avatarEmoji}</span>
                  </div>

                  <div className="truncate">
                    <span className="font-extrabold text-zinc-100 block truncate leading-tight">
                      {record.nickname}
                    </span>
                    <span className={`text-[9px] font-medium leading-tight block mt-0.5 ${isSelf ? 'text-[#3EB489]' : 'text-zinc-500'}`}>
                      {isSelf ? `YOU · ${labelStr}` : labelStr}
                    </span>
                  </div>
                </div>

                {/* Right block: Entropy Stats */}
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

      {/* ==================== 2. CLASSIC SCHULTE LEADERBOARD VIEW ==================== */}
      {leaderboardMode === 'schulte' && (
        <>
          {/* Grid Sub-Tabs Selector */}
          <div className="grid grid-cols-3 p-1 rounded-lg bg-black/40 border border-zinc-900 text-xs mb-4">
            <button
              onClick={() => setBoardType('level')}
              className={`py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                boardType === 'level'
                  ? 'bg-amber-600 text-zinc-950 shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              闯关模式
            </button>
            <button
              onClick={() => setBoardType('free')}
              className={`py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                boardType === 'free'
                  ? 'bg-amber-600 text-zinc-950 shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              自由模式
            </button>
            <button
              onClick={() => setBoardType('letter')}
              className={`py-1.5 rounded-md font-bold transition-all cursor-pointer ${
                boardType === 'letter'
                  ? 'bg-amber-600 text-zinc-950 shadow-md'
                  : 'text-zinc-400 hover:text-white'
              }`}
            >
              英文字母
            </button>
          </div>

          {/* Difficulty Sub-Filter Badges */}
          <div className="flex flex-wrap gap-1.5 mb-4 max-h-[85px] overflow-y-auto pr-1">
            {boardType === 'level' &&
              ['Level 1', 'Level 2', 'Level 3', 'Level 4', 'Level 5', 'Level 6', 'Level 7', 'Level 8', 'Level 9', 'Level 10'].map((l) => (
                <button
                  key={l}
                  onClick={() => setSelectedSubDiff(l)}
                  className={`px-2 py-0.5 text-[10px] font-mono rounded cursor-pointer ${
                    selectedSubDiff === l
                      ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30 font-bold'
                      : 'bg-zinc-920 border border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {l.replace('Level ', '第')}关
                </button>
              ))}

            {boardType === 'free' &&
              ['3x3', '4x4', '5x5', '6x6'].map((size) => (
                <button
                  key={size}
                  onClick={() => setSelectedSubDiff(size)}
                  className={`px-2.5 py-0.5 text-[10px] font-mono rounded cursor-pointer ${
                    selectedSubDiff === size
                      ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30'
                      : 'bg-zinc-920 border border-zinc-800 text-zinc-400 hover:text-white'
                  }`}
                >
                  {size}
                </button>
              ))}

            {boardType === 'letter' && (
              <button
                className="px-3 py-0.5 text-[10px] rounded bg-amber-500/10 text-amber-500 border border-amber-500/30 font-bold"
              >
                Alphabet 5x5 (舒尔特 25 字母快速盲扫)
              </button>
            )}
          </div>

          {/* Rankings List */}
          <div className="space-y-1.5">
            {finalSchulteLeaderboard.length === 0 ? (
              <div className="py-8 text-center text-xs text-zinc-500">
                暂无该模式记录，等待您来创下首个榜单纪录！
              </div>
            ) : (
              finalSchulteLeaderboard.map((record, index) => {
                const isSelf = record.userId === currentUserId;
                const rank = index + 1;
                
                let rankBadge = '';
                let rankTextClass = 'text-zinc-500 font-mono';
                if (rank === 1) {
                  rankBadge = '🥇';
                  rankTextClass = 'text-yellow-500 font-bold';
                } else if (rank === 2) {
                  rankBadge = '🥈';
                  rankTextClass = 'text-slate-300 font-bold';
                } else if (rank === 3) {
                  rankBadge = '🥉';
                  rankTextClass = 'text-amber-700 font-bold';
                }

                return (
                  <div
                    key={record.id}
                    className={`flex items-center justify-between p-2.5 rounded-lg border text-xs transition-all ${
                      isSelf
                        ? 'border-amber-500/50 bg-amber-500/5 text-amber-200 shadow-sm'
                        : 'border-zinc-800/60 bg-zinc-900/10 hover:bg-zinc-900/30 hover:border-zinc-800'
                    }`}
                  >
                    <div className="flex items-center gap-2 max-w-[65%]">
                      <div className={`w-6 text-center ${rankTextClass}`}>
                        {rankBadge ? <span className="text-sm">{rankBadge}</span> : rank}
                      </div>

                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-sm shadow-inner shrink-0"
                        style={{ backgroundColor: record.avatarColor }}
                      >
                        <span className="select-none text-xs">{record.avatarEmoji}</span>
                      </div>

                      <div className="truncate">
                        <span className="font-semibold text-zinc-200 block truncate leading-tight">
                          {record.nickname}
                        </span>
                        {isSelf && (
                          <span className="text-[9px] text-amber-500 font-bold uppercase tracking-wider block leading-tight">
                            YOU · 本人
                          </span>
                        )}
                      </div>
                    </div>

                    <div className="text-right flex flex-col justify-center">
                      <span className="font-mono text-sm font-bold text-amber-500 leading-none">
                        {record.time.toFixed(2)}s
                      </span>
                      <span className="text-[9px] text-zinc-500 font-mono mt-0.5 leading-none block">
                        {new Date(record.createdAt).toLocaleDateString(undefined, {
                          month: '2-digit',
                          day: '2-digit'
                        })}
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
