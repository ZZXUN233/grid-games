import React, { useRef, useState, useEffect } from "react";
import { ScoreRecord, GameTheme } from "../types";
import { Download, Copy, Check, Share2, Award, Eye, Heart } from "lucide-react";
import { motion } from "motion/react";

interface ScorePosterProps {
  score: ScoreRecord;
  theme: GameTheme;
  onClose: () => void;
}

export default function ScorePoster({
  score,
  theme,
  onClose,
}: ScorePosterProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloading, setDownloading] = useState(false);

  // Generate an encouraging visual rating based on the completion speed
  const getRatingAndEncouragement = (
    time: number,
    mode: string,
    diff: string
  ) => {
    if (mode === "letter") {
      if (time < 20)
        return {
          stars: "⭐⭐⭐⭐⭐",
          text: "空间神童！Alpha 级多维感知力",
          badge: "最强大脑",
        };
      if (time < 35)
        return {
          stars: "⭐⭐⭐⭐",
          text: "灵敏非凡！视野感知超越常人",
          badge: "空间猎手",
        };
      return {
        stars: "⭐⭐⭐",
        text: "渐入佳境！专注力与字母搜索同步提升",
        badge: "字母挑战者",
      };
    }

    // Level or Free numerical modes
    const size = diff.includes("3x3")
      ? 9
      : diff.includes("4x4")
        ? 16
        : diff.includes("5x5")
          ? 25
          : diff.includes("6x6")
            ? 36
            : 49;
    const avgTimePerGrid = time / size;

    if (avgTimePerGrid < 0.6) {
      return {
        stars: "⭐⭐⭐⭐⭐",
        text: "神之一星！视野雷达，瞬时全幅极速摄入",
        badge: "视野掌控者",
      };
    } else if (avgTimePerGrid < 1.0) {
      return {
        stars: "⭐⭐⭐⭐",
        text: "专注大咖！手眼极速协同，行云流水",
        badge: "极速先锋",
      };
    } else if (avgTimePerGrid < 1.6) {
      return {
        stars: "⭐⭐⭐",
        text: "眼力优秀！视网膜周边阅读与瞬时识别契合",
        badge: "眼力先锋",
      };
    } else {
      return {
        stars: "⭐⭐",
        text: "沉稳而行！心跳规律，在宁静中累积专注",
        badge: "心静如水",
      };
    }
  };

  const evalStats = getRatingAndEncouragement(
    score.time,
    score.mode,
    score.difficulty
  );

  const getShareText = () => {
    return `⏱️ 舒尔特方格 (Schulte Grid) 挑战成功！\n👤 选手: ${score.nickname}\n🎯 模式: ${
      score.mode === "level"
        ? "闯关突破"
        : score.mode === "letter"
          ? "字母空间感知"
          : "自由定制"
    } (${score.difficulty})\n⚡ 耗时: ${score.time.toFixed(2)} 秒 (${evalStats.badge})\n🔥 专注评级: ${evalStats.stars}\n\n在宁静深处，聚集非凡专注。你也来测测你的空间感知与扫视眼力吧！`;
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(getShareText());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn("Clipboard write failed");
    }
  };

  const handleGenerateAndDownload = () => {
    setDownloading(true);
    const canvas = canvasRef.current;
    if (!canvas) {
      setDownloading(false);
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      setDownloading(false);
      return;
    }

    // Set high-res scaling
    canvas.width = 640;
    canvas.height = 880;

    // Outer Background Base Fill
    ctx.fillStyle = "#0F0F11"; // Elegant deep off-black
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Decorative ambient glowing curves using safe native paths
    ctx.beginPath();
    ctx.arc(320, -100, 480, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(217, 118, 6, 0.08)"; // Golden warm glow
    ctx.fill();

    // Golden boundary frame
    ctx.strokeStyle = "#2E2214";
    ctx.lineWidth = 2;
    ctx.strokeRect(20, 20, canvas.width - 40, canvas.height - 40);

    // Thin outer frame accent
    ctx.strokeStyle = "#D97706";
    ctx.lineWidth = 1;
    ctx.globalAlpha = 0.5;
    ctx.strokeRect(30, 30, canvas.width - 60, canvas.height - 60);
    ctx.globalAlpha = 1.0;

    // Corner decorative markers
    const size = 15;
    ctx.strokeStyle = "#D97706";
    ctx.lineWidth = 3;
    // Top-Left marker
    ctx.beginPath();
    ctx.moveTo(35, 35 + size);
    ctx.lineTo(35, 35);
    ctx.lineTo(35 + size, 35);
    ctx.stroke();
    // Top-Right marker
    ctx.beginPath();
    ctx.moveTo(605 - size, 35);
    ctx.lineTo(605, 35);
    ctx.lineTo(605, 35 + size);
    ctx.stroke();
    // Bottom-Left
    ctx.beginPath();
    ctx.moveTo(35, 845 - size);
    ctx.lineTo(35, 845);
    ctx.lineTo(35 + size, 845);
    ctx.stroke();
    // Bottom-Right
    ctx.beginPath();
    ctx.moveTo(605 - size, 845);
    ctx.lineTo(605, 845);
    ctx.lineTo(605, 845 - size);
    ctx.stroke();

    // 1. Title Section
    ctx.fillStyle = "#E4E4E7";
    ctx.font = 'bold 36px "System-UI", -apple-system, sans-serif';
    ctx.textAlign = "center";
    ctx.fillText("舒 尔 特 方 格 成 绩 单", 320, 110);
    ctx.font = "14px monospace";
    ctx.fillStyle = "#71717A";
    ctx.fillText("SCHULTE CONCENTRATION DIAGNOSTIC", 320, 138);

    // Dynamic separator line
    ctx.strokeStyle = "rgba(217, 118, 6, 0.2)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(120, 160);
    ctx.lineTo(520, 160);
    ctx.stroke();

    // 2. Avatar Drawing (Color circle + Emoji)
    const avatarX = 320;
    const avatarY = 240;
    const avatarRadius = 55;
    ctx.beginPath();
    ctx.arc(avatarX, avatarY, avatarRadius, 0, Math.PI * 2);
    ctx.fillStyle = score.avatarColor;
    ctx.fill();
    ctx.lineWidth = 4;
    ctx.strokeStyle = "#18181C";
    ctx.stroke();

    // Render Emoji on top of the circle
    ctx.font = '64px "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.fillText(score.avatarEmoji, avatarX, avatarY + 4);

    // 3. Player Nickname
    ctx.fillStyle = "#FFFFFF";
    ctx.font = 'bold 26px "System-UI", sans-serif';
    ctx.fillText(score.nickname, 320, 340);
    ctx.font = "12px monospace";
    ctx.fillStyle = "#D97706";
    ctx.fillText(`UID: ${score.userId.toUpperCase()}`, 320, 365);

    // 4. Large Stat Clock Panel
    const rectX = 100;
    const rectY = 390;
    const rectW = 440;
    const rectH = 180;
    ctx.fillStyle = "#141416";
    ctx.fillRect(rectX, rectY, rectW, rectH);
    ctx.strokeStyle = "#27272A";
    ctx.lineWidth = 1.5;
    ctx.strokeRect(rectX, rectY, rectW, rectH);

    // Content inside panel: Mode & Difficulty
    ctx.font = '14px "System-UI", sans-serif';
    ctx.fillStyle = "#A1A1AA";
    ctx.fillText(
      `挑战模式: ${score.mode === "level" ? "闯关卡" : score.mode === "letter" ? "字母空间感知" : "自由练习"}`,
      320,
      425
    );
    ctx.font = 'bold 18px "System-UI", sans-serif';
    ctx.fillStyle = "#E4E4E7";
    ctx.fillText(`【 ${score.difficulty} 】`, 320, 452);

    // Time Value representation
    ctx.font = 'bold 64px "Monaco", "Courier New", monospace';
    ctx.fillStyle = "#FFA000"; // Eye-friendly radiant golden
    ctx.fillText(`${score.time.toFixed(2)}`, 320, 522);

    // Label "秒 (Seconds)"
    ctx.font = '13px "System-UI", sans-serif';
    ctx.fillStyle = "#71717A";
    ctx.fillText("COMPLETION TIME (SECONDS)", 320, 550);

    // 5. Rating Comments Section
    ctx.font = '24px "Apple Color Emoji", "Segoe UI Emoji", sans-serif';
    ctx.fillText(evalStats.stars, 320, 605);
    ctx.font = 'bold 18px "System-UI", sans-serif';
    ctx.fillStyle = "#34D399"; // Positive Emerald Feedback
    ctx.fillText(`称号 : ${evalStats.badge}`, 320, 638);

    ctx.font = '14px "System-UI", sans-serif';
    ctx.fillStyle = "#D4D4D8";

    // Wrap encouragement text cleanly if too long
    const encouragement = evalStats.text;
    ctx.fillText(encouragement, 320, 670);

    // 6. Footer section with decorative QR area or scan instructions
    const scanY = 750;

    // Abstract geometric design representing "Focus Radar/Schulte grid" inside footer
    ctx.lineWidth = 1;
    ctx.strokeStyle = "#27272A";
    for (let i = 0; i < 4; i++) {
      ctx.strokeRect(40 + i * 12, scanY - 5, 10, 10);
    }

    ctx.textAlign = "left";
    ctx.font = '12px "System-UI", sans-serif';
    ctx.fillStyle = "#A1A1AA";
    ctx.fillText("舒尔特专注力视觉训练评估网格", 95, scanY - 3);
    ctx.font = '10px "System-UI", sans-serif';
    ctx.fillStyle = "#52525B";
    ctx.fillText(
      "通过外周扫视视网膜周边阅读与极速手眼反应进行专注力评级",
      95,
      scanY + 12
    );

    // Date mark on the right
    ctx.textAlign = "right";
    const dateFormatted = new Date(score.createdAt).toLocaleDateString(
      "zh-CN",
      {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      }
    );
    ctx.font = "11px monospace";
    ctx.fillStyle = "#71717A";
    ctx.fillText(dateFormatted, 600, scanY + 8);

    // Create image download link
    try {
      const dataUrl = canvas.toDataURL("image/png");
      const link = document.createElement("a");
      link.download = `Schulte_Score_${score.difficulty}_${score.time.toFixed(2)}s.png`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error("Canvas export failed", e);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/85 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-lg bg-[#161619] border border-theme rounded-2xl overflow-hidden shadow-2xl relative"
      >
        {/* Main Header inside sharing card */}
        <div className="flex items-center justify-between p-4 border-b border-theme bg-[#1D1D22]">
          <div className="flex items-center gap-2">
            <Award className="text-amber-500" size={18} />
            <span className="font-bold text-white text-sm">分享挑战成绩单</span>
          </div>
          <button
            id="close-poster-btn"
            onClick={onClose}
            className="text-secondary hover:text-zinc-200 py-1 px-2.5 rounded-lg bg-zinc-800/40 hover:bg-zinc-800/80 border border-theme transition-all text-xs flex items-center gap-1 cursor-pointer font-medium"
          >
            <span>返回大厅</span>
            <span className="font-bold">✕</span>
          </button>
        </div>

        {/* Visual Poster Body */}
        <div className="p-5 flex flex-col items-center">
          {/* Aesthetic Poster Preview Card */}
          <div className="w-full bg-[#0F0F11] border border-[#27272A] rounded-xl p-6 relative overflow-hidden flex flex-col items-center text-center shadow-inner">
            <div className="absolute top-0 right-0 p-3 flex gap-1 transform scale-75 opacity-25">
              <Eye size={16} />
              <Heart size={16} />
            </div>

            <span className="text-[10px] text-muted font-mono tracking-widest uppercase mb-1">
              Schulte Diagnostic Report
            </span>
            <h4 className="text-md font-extrabold text-theme tracking-wider mb-4">
              舒尔特方格专注力评估
            </h4>

            {/* Profile Avatar Spot */}
            <div
              className="w-16 h-16 rounded-full flex items-center justify-center text-3xl font-bold shadow-lg ring-2 ring-zinc-800 mb-2 relative"
              style={{ backgroundColor: score.avatarColor }}
            >
              <span>{score.avatarEmoji}</span>
            </div>

            <span className="text-sm font-semibold text-white">
              {score.nickname}
            </span>
            <span className="text-[10px] text-muted font-mono">
              UID: {score.userId}
            </span>

            {/* Middle scoreboard */}
            <div className="my-5 py-3.5 px-6 rounded-lg bg-zinc-950/85 border border-theme w-full max-w-xs">
              <span className="text-xs text-secondary font-medium block">
                {score.mode === "level"
                  ? "闯关突破"
                  : score.mode === "letter"
                    ? "字母空间感知"
                    : "自由定制"}{" "}
                ({score.difficulty})
              </span>
              <div className="text-3xl font-mono font-bold text-amber-500 mt-1 select-all">
                {score.time.toFixed(2)} 秒
              </div>
              <span className="text-[10px] text-muted font-bold tracking-wider mt-0.5 block uppercase">
                Completion Time
              </span>
            </div>

            {/* Rating description */}
            <div className="text-xs text-emerald-400 font-medium mb-1 flex items-center gap-1 justify-center">
              <span>{evalStats.stars}</span>
              <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-[10px] font-bold">
                {evalStats.badge}
              </span>
            </div>
            <p className="text-xs text-secondary leading-relaxed max-w-sm">
              “{evalStats.text}”
            </p>

            <span className="text-[9px] text-[#A1A1AA]/30 mt-6 font-mono self-end">
              {new Date(score.createdAt).toLocaleDateString()}
            </span>
          </div>

          {/* Canvas for rendering - Hidden offscreen but accessible by reference */}
          <canvas ref={canvasRef} className="hidden" />

          {/* Social Media Copy-Paste Card Text */}
          <div className="w-full mt-4 bg-zinc-900/60 border border-theme p-3 rounded-xl text-left">
            <span className="text-[10px] text-muted font-bold uppercase tracking-wider block mb-1">
              文字版格式 (适于粘贴微信/微博)
            </span>
            <textarea
              readOnly
              value={getShareText()}
              className="w-full h-24 bg-transparent border-0 text-secondary text-xs resize-none focus:outline-none focus:ring-0 placeholder-zinc-700 leading-relaxed font-sans"
              onClick={(e) => (e.target as HTMLTextAreaElement).select()}
            />
          </div>

          {/* Interaction Action Buttons */}
          <div className="grid grid-cols-2 gap-3 w-full mt-5">
            <button
              id="copy-text-btn"
              onClick={handleCopyText}
              className="flex items-center justify-center gap-1.5 py-2.5 px-4 text-xs font-semibold rounded-xl bg-zinc-800 hover:bg-zinc-700 text-zinc-100 transition-colors active:scale-95 border border-theme cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="text-emerald-500" size={14} />
                  <span>复制成功</span>
                </>
              ) : (
                <>
                  <Copy size={14} />
                  <span>复制成绩文字</span>
                </>
              )}
            </button>

            <button
              id="download-poster-btn"
              onClick={handleGenerateAndDownload}
              disabled={downloading}
              className={`flex items-center justify-center gap-1.5 py-2.5 px-4 text-xs font-bold rounded-xl text-zinc-950 transition-colors active:scale-95 bg-amber-500 hover:bg-amber-400 cursor-pointer`}
            >
              <Download size={14} />
              <span>{downloading ? "生成海报中..." : "保存成绩海报"}</span>
            </button>
          </div>

          {/* Explicit Back to Game & Retry Option */}
          <button
            id="close-poster-primary-btn"
            onClick={onClose}
            className="w-full mt-3.5 py-3.5 px-4 text-xs font-bold rounded-xl bg-[#3EB489]/10 text-[#3EB489] hover:bg-[#3EB489]/20 border border-[#3EB489]/25 hover:border-[#3EB489]/45 transition-all active:scale-98 flex items-center justify-center gap-1.5 cursor-pointer shadow-sm shadow-[#3EB489]/5"
          >
            <span>确定并返回游戏 (准备下一关 / 再来一局)</span>
          </button>
        </div>
      </motion.div>
    </div>
  );
}
