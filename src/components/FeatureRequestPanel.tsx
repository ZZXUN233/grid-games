import React, { useState, useEffect } from 'react';
import { FeatureRequest } from '../types';
import { fetchFeatureRequests, voteFeatureRequest } from '../firebase';
import { Lightbulb, Zap, CheckCircle, Clock, XCircle, Sparkles, ThumbsUp, ArrowRight } from 'lucide-react';

interface FeatureRequestPanelProps {
  userId: string;
  negentropy: number;
  onNegentropyChange: (spent: number) => void;
}

const TYPE_LABELS: Record<string, string> = {
  theme: '主题',
  difficulty: '难度',
  leaderboard: '排行榜',
  effect: '特效',
  game_mode: '游戏模式',
  avatar: '头像',
  custom: '自定义',
};

const STATUS_CONFIG: Record<string, { label: string; className: string; icon: React.ElementType }> = {
  pending: { label: '待响应', className: 'text-amber-500 bg-amber-500/10', icon: Clock },
  in_progress: { label: '开发中', className: 'text-blue-500 bg-blue-500/10', icon: Sparkles },
  done: { label: '已实现', className: 'text-[#3EB489] bg-[#3EB489]/10', icon: CheckCircle },
  rejected: { label: '已驳回', className: 'text-zinc-500 bg-zinc-500/10', icon: XCircle },
};

export default function FeatureRequestPanel({ userId, negentropy, onNegentropyChange }: FeatureRequestPanelProps) {
  const [features, setFeatures] = useState<FeatureRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [votingId, setVotingId] = useState<number | null>(null);

  const loadFeatures = async () => {
    setLoading(true);
    const data = await fetchFeatureRequests(userId);
    setFeatures(data);
    setLoading(false);
  };

  useEffect(() => {
    loadFeatures();
  }, [userId]);

  const handleVote = async (feature: FeatureRequest) => {
    if (negentropy < feature.cost) return;
    if (feature.userVoted) return;
    setVotingId(feature.id);
    const ok = await voteFeatureRequest(feature.id, userId, feature.cost);
    if (ok) {
      onNegentropyChange(feature.cost);
      await loadFeatures();
    }
    setVotingId(null);
  };

  const StatusIcon = (feature: FeatureRequest) => {
    const config = STATUS_CONFIG[feature.status] || STATUS_CONFIG.pending;
    const IconComp = config.icon;
    return (
      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${config.className}`}>
        <IconComp size={9} />
        {config.label}
      </span>
    );
  };

  return (
    <div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-4.5 max-w-lg mx-auto flex flex-col gap-3.5 shadow-xl select-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6.5 h-6.5 bg-amber-500/10 rounded-lg border border-amber-500/20 flex items-center justify-center text-amber-500">
            <Lightbulb size={13} />
          </div>
          <span className="text-xs font-black text-white tracking-tight">需求工厂</span>
        </div>
        <span className="text-[9.5px] text-zinc-400 font-medium">
          负熵余额: <span className="text-[#3EB489] font-black">{negentropy} E</span>
        </span>
      </div>

      <div className="text-[10px] text-zinc-500 leading-relaxed bg-zinc-950/30 rounded-xl p-3 border border-zinc-800/20">
        消耗负熵向上帝提交需求。呼声越高，越可能被实现。每个需求每个用户限投一票。
      </div>

      {loading && features.length === 0 ? (
        <div className="text-center py-6 text-zinc-500 text-xs">加载中...</div>
      ) : (
        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
          {features.map((feature) => {
            const StatusComp = () => StatusIcon(feature);
            const canVote = !feature.userVoted && negentropy >= feature.cost && feature.status === 'pending';
            const voted = feature.userVoted;

            return (
              <div
                key={feature.id}
                className="bg-zinc-950/40 rounded-xl p-3 border border-zinc-800/20 hover:border-zinc-700/40 transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <h4 className="text-xs font-black text-white truncate">{feature.title}</h4>
                      <StatusComp />
                    </div>
                    <p className="text-[9.5px] text-zinc-500 line-clamp-1">{feature.description}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2 pt-2 border-t border-zinc-800/20">
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="flex items-center gap-0.5 text-zinc-400">
                      <ThumbsUp size={10} />
                      <span className="font-mono font-bold text-zinc-300">{feature.votes}</span>
                    </span>
                    <span className="text-zinc-600">·</span>
                    <span className="text-zinc-500">{TYPE_LABELS[feature.type] || feature.type}</span>
                    <span className="text-zinc-600">·</span>
                    <span className="font-mono text-amber-500/80 font-bold">{feature.cost} E</span>
                  </div>

                  {voted ? (
                    <span className="text-[9px] text-[#3EB489] font-bold flex items-center gap-0.5">
                      <CheckCircle size={9} />
                      已投票
                    </span>
                  ) : canVote ? (
                    <button
                      onClick={() => handleVote(feature)}
                      disabled={votingId === feature.id}
                      className="text-[9px] font-black text-white bg-amber-600 hover:bg-amber-500 disabled:opacity-50 px-2 py-0.5 rounded-lg transition-all flex items-center gap-0.5 cursor-pointer"
                    >
                      {votingId === feature.id ? '...' : '投票'}
                      <Zap size={9} />
                    </button>
                  ) : (
                    <span className="text-[9px] text-zinc-600">
                      {feature.status !== 'pending' ? '' : '负熵不足'}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-center gap-1 text-[9px] text-zinc-600 pt-1">
        <ArrowRight size={10} />
        <span>上帝正注视着你的需求...</span>
      </div>
    </div>
  );
}