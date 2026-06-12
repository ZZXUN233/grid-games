import React, { useState, useEffect } from "react";
import { FeatureRequest } from "../types";
import {
  fetchFeatureRequests,
  voteFeatureRequest,
  createFeatureRequest,
} from "../api";
import {
  Lightbulb,
  Zap,
  CheckCircle,
  Clock,
  XCircle,
  Sparkles,
  ThumbsUp,
  ArrowRight,
  Plus,
  Send,
} from "lucide-react";

interface FeatureRequestPanelProps {
  userId: string;
  negentropy: number;
  onNegentropyChange: (spent: number) => void;
}

const SUBMIT_COST = 100; // negentropy cost to create a new feature request

const TYPE_LABELS: Record<string, string> = {
  theme: "主题",
  difficulty: "难度",
  leaderboard: "排行榜",
  effect: "特效",
  game_mode: "游戏模式",
  avatar: "头像",
  custom: "自定义",
};

const TYPE_OPTIONS = [
  "theme",
  "difficulty",
  "leaderboard",
  "effect",
  "game_mode",
  "avatar",
  "custom",
];

const STATUS_CONFIG: Record<
  string,
  { label: string; className: string; icon: React.ElementType }
> = {
  pending: {
    label: "待响应",
    className: "text-amber-500 bg-amber-500/10",
    icon: Clock,
  },
  in_progress: {
    label: "开发中",
    className: "text-blue-500 bg-blue-500/10",
    icon: Sparkles,
  },
  done: {
    label: "已实现",
    className: "text-[#3EB489] bg-[#3EB489]/10",
    icon: CheckCircle,
  },
  rejected: {
    label: "已驳回",
    className: "text-muted bg-zinc-500/10",
    icon: XCircle,
  },
};

export default function FeatureRequestPanel({
  userId,
  negentropy,
  onNegentropyChange,
}: FeatureRequestPanelProps) {
  const [features, setFeatures] = useState<FeatureRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [votingId, setVotingId] = useState<number | null>(null);

  // New feature submission form state
  const [showForm, setShowForm] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newType, setNewType] = useState("custom");
  const [submitLoading, setSubmitLoading] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");

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

  const handleSubmitFeature = async () => {
    setSubmitError("");
    setSubmitSuccess("");

    if (!newTitle.trim()) {
      setSubmitError("请输入需求标题");
      return;
    }
    if (negentropy < SUBMIT_COST) {
      setSubmitError(
        `负熵不足，提交需求需要 ${SUBMIT_COST} E（当前余额: ${negentropy} E）`
      );
      return;
    }

    setSubmitLoading(true);
    const result = await createFeatureRequest(
      userId,
      newTitle.trim(),
      newDesc.trim(),
      newType
    );
    setSubmitLoading(false);

    if (result.success) {
      setSubmitSuccess(`需求已提交！消耗 ${SUBMIT_COST} E，等待其他人投票`);
      setNewTitle("");
      setNewDesc("");
      setNewType("custom");
      setShowForm(false);
      onNegentropyChange(SUBMIT_COST);
      await loadFeatures();
      setTimeout(() => setSubmitSuccess(""), 5000);
    } else {
      setSubmitError(result.error || "提交失败");
    }
  };

  const StatusIcon = (feature: FeatureRequest) => {
    const config = STATUS_CONFIG[feature.status] || STATUS_CONFIG.pending;
    const IconComp = config.icon;
    return (
      <span
        className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full flex items-center gap-0.5 ${config.className}`}
      >
        <IconComp size={9} />
        {config.label}
      </span>
    );
  };

  const canSubmit = negentropy >= SUBMIT_COST;

  return (
    <div className="bg-zinc-900/40 border border-theme rounded-2xl p-4.5 w-full flex flex-col gap-3.5 shadow-xl select-none">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6.5 h-6.5 bg-amber-500/10 rounded-lg border border-amber-500/20 flex items-center justify-center text-amber-500">
            <Lightbulb size={13} />
          </div>
          <span className="text-xs font-black text-white tracking-tight">
            需求工厂
          </span>
        </div>
        <span className="text-[9.5px] text-secondary font-medium">
          负熵余额:{" "}
          <span className="text-[#3EB489] font-black">{negentropy} E</span>
        </span>
      </div>

      <div className="text-[10px] text-muted leading-relaxed bg-zinc-950/30 rounded-xl p-3 border border-theme">
        投票消耗需求标价 E；
        <strong className="text-amber-400">
          提交新需求消耗 {SUBMIT_COST} E
        </strong>
        ，自动含一票。
      </div>

      {/* Submit new feature button */}
      {!showForm && (
        <button
          onClick={() => {
            setShowForm(true);
            setSubmitError("");
            setSubmitSuccess("");
          }}
          disabled={!canSubmit}
          className={`flex items-center justify-center gap-1.5 py-2 rounded-xl text-[11px] font-bold transition-all cursor-pointer ${
            canSubmit
              ? "bg-amber-600/20 text-amber-400 border border-amber-500/30 hover:bg-amber-600/30 active:scale-95"
              : "bg-zinc-900/30 text-muted border border-theme cursor-not-allowed"
          }`}
        >
          <Plus size={12} />
          <span>提交新需求（{SUBMIT_COST} E）</span>
        </button>
      )}

      {/* Submission form */}
      {showForm && (
        <div className="bg-zinc-950/50 rounded-xl p-3 border border-amber-500/20 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[11px] font-black text-amber-400">
              提交新需求
            </span>
            <button
              onClick={() => setShowForm(false)}
              className="p-0.5 rounded text-muted hover:text-zinc-300 cursor-pointer"
            >
              <XCircle size={14} />
            </button>
          </div>

          {/* Type selector */}
          <div>
            <label className="text-[9px] text-muted block mb-1">需求类型</label>
            <div className="flex flex-wrap gap-1">
              {TYPE_OPTIONS.map((t) => (
                <button
                  key={t}
                  onClick={() => setNewType(t)}
                  className={`px-2 py-0.5 rounded text-[9px] font-bold transition-all cursor-pointer ${
                    newType === t
                      ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                      : "bg-zinc-800/40 text-muted border border-theme hover:text-zinc-300"
                  }`}
                >
                  {TYPE_LABELS[t] || t}
                </button>
              ))}
            </div>
          </div>

          {/* Title */}
          <div>
            <label className="text-[9px] text-muted block mb-1">需求标题</label>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder="用一句话描述你的需求"
              maxLength={64}
              className="w-full px-2.5 py-1.5 text-[11px] rounded-lg bg-zinc-900/80 border border-theme text-white placeholder-zinc-600 outline-none focus:border-amber-500/50 transition-all"
            />
          </div>

          {/* Description */}
          <div>
            <label className="text-[9px] text-muted block mb-1">
              补充说明（可选）
            </label>
            <textarea
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              placeholder="详细描述你的想法..."
              rows={2}
              className="w-full px-2.5 py-1.5 text-[11px] rounded-lg bg-zinc-900/80 border border-theme text-white placeholder-zinc-600 outline-none focus:border-amber-500/50 transition-all resize-none"
            />
          </div>

          {/* Messages */}
          {submitError && (
            <div className="text-[10px] text-red-400 bg-red-950/30 rounded-lg p-2 border border-red-500/20">
              {submitError}
            </div>
          )}
          {submitSuccess && (
            <div className="text-[10px] text-[#3EB489] bg-[#3EB489]/10 rounded-lg p-2 border border-[#3EB489]/20">
              {submitSuccess}
            </div>
          )}

          {/* Submit button */}
          <button
            onClick={handleSubmitFeature}
            disabled={submitLoading}
            className="w-full py-2 rounded-xl text-[11px] font-black bg-amber-600 hover:bg-amber-500 text-white disabled:opacity-50 transition-all flex items-center justify-center gap-1.5 cursor-pointer active:scale-95"
          >
            {submitLoading ? (
              <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
            ) : (
              <>
                <Send size={11} />
                <span>确认提交（消耗 {SUBMIT_COST} E）</span>
              </>
            )}
          </button>
        </div>
      )}

      {loading && features.length === 0 ? (
        <div className="text-center py-6 text-muted text-xs">加载中...</div>
      ) : (
        <div className="space-y-2 max-h-[320px] overflow-y-auto pr-1">
          {features.map((feature) => {
            const StatusComp = () => StatusIcon(feature);
            const canVote =
              !feature.userVoted &&
              negentropy >= feature.cost &&
              feature.status === "pending";
            const voted = feature.userVoted;

            return (
              <div
                key={feature.id}
                className="bg-zinc-950/40 rounded-xl p-3 border border-theme hover:border-theme transition-all"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <h4 className="text-xs font-black text-white truncate">
                        {feature.title}
                      </h4>
                      <StatusComp />
                    </div>
                    <p className="text-[9.5px] text-muted line-clamp-1">
                      {feature.description}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-2 pt-2 border-t border-theme">
                  <div className="flex items-center gap-2 text-[10px]">
                    <span className="flex items-center gap-0.5 text-secondary">
                      <ThumbsUp size={10} />
                      <span className="font-mono font-bold text-theme">
                        {feature.votes}
                      </span>
                    </span>
                    <span className="text-zinc-600">·</span>
                    <span className="text-muted">
                      {TYPE_LABELS[feature.type] || feature.type}
                    </span>
                    <span className="text-zinc-600">·</span>
                    <span className="font-mono text-amber-500/80 font-bold">
                      {feature.cost} E
                    </span>
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
                      {votingId === feature.id ? "..." : "投票"}
                      <Zap size={9} />
                    </button>
                  ) : (
                    <span className="text-[9px] text-zinc-600">
                      {feature.status !== "pending" ? "" : "负熵不足"}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="flex items-center justify-center gap-1 text-[9px] text-muted pt-1">
        <ArrowRight size={10} />
        <span>上帝正注视着你的需求...</span>
      </div>
    </div>
  );
}
