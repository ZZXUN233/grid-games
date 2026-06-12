import React, { useState, useEffect, useRef, useCallback } from "react";
import { GameTheme } from "../types";
import {
  ArrowLeft,
  Download,
  Save,
  Palette,
  Eraser,
  PaintBucket,
  Grid,
  Info,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface PixelCanvasProps {
  theme: GameTheme;
  onGoBack: () => void;
  userNickname: string;
  onConsumeEntropy: (points: number) => Promise<void>;
  currentUserId?: string;
  avatarColor?: string;
  avatarEmoji?: string;
}

const N = 24;
const PALETTE = [
  "#D4C5B5",
  "#A39584",
  "#8B7A6B",
  "#6C5E53",
  "#4A3C31",
  "#C4A882",
  "#D4A574",
  "#B86F52",
  "#9C4F3A",
  "#7A3B2E",
  "#A8B5A0",
  "#7A9E7A",
  "#5C8A5C",
  "#3D6B3D",
  "#2D4F2D",
  "#8AA8C4",
  "#5A8AB5",
  "#3A6A9A",
  "#2A4A7A",
  "#1A2A5A",
];

export default function PixelCanvas({
  theme,
  onGoBack,
  userNickname,
  onConsumeEntropy,
  currentUserId = "pixel-tester",
  avatarColor = "#64748B",
  avatarEmoji = "🎨",
}: PixelCanvasProps) {
  const [pixels, setPixels] = useState<string[][]>(() =>
    Array.from({ length: N }, () => Array(N).fill(PALETTE[0]))
  );
  const [color, setColor] = useState(PALETTE[0]);
  const [tool, setTool] = useState<"pen" | "eraser" | "bucket">("pen");
  const [showGrid, setShowGrid] = useState(true);
  const [guide, setGuide] = useState(false);
  const [drafts, setDrafts] = useState<string[]>([]);
  const [saved, setSaved] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Load drafts
  useEffect(() => {
    try {
      const d = JSON.parse(
        localStorage.getItem("gridgame_pixel_drafts") || "[]"
      );
      if (Array.isArray(d)) setDrafts(d);
    } catch {}
  }, []);

  const saveDraft = () => {
    const key = `pixel_${Date.now()}`;
    const data = JSON.stringify(pixels);
    const updated = [...drafts, key].slice(-10);
    setDrafts(updated);
    localStorage.setItem("gridgame_pixel_drafts", JSON.stringify(updated));
    localStorage.setItem(key, data);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
    onConsumeEntropy(10);
  };

  const loadDraft = (key: string) => {
    try {
      const data = localStorage.getItem(key);
      if (data) setPixels(JSON.parse(data));
    } catch {}
  };

  const clearCanvas = () => {
    setPixels(Array.from({ length: N }, () => Array(N).fill(PALETTE[0])));
  };

  const fill = (r: number, c: number, target: string, replacement: string) => {
    if (target === replacement) return;
    const newPixels = pixels.map((row) => [...row]);
    const stack = [[r, c]];
    while (stack.length) {
      const [cr, cc] = stack.pop()!;
      if (cr < 0 || cr >= N || cc < 0 || cc >= N) continue;
      if (newPixels[cr][cc] !== target) continue;
      newPixels[cr][cc] = replacement;
      stack.push([cr - 1, cc], [cr + 1, cc], [cr, cc - 1], [cr, cc + 1]);
    }
    setPixels(newPixels);
  };

  const paint = (r: number, c: number) => {
    if (tool === "bucket") {
      fill(r, c, pixels[r][c], color);
    } else {
      const newPixels = pixels.map((row) => [...row]);
      newPixels[r][c] = tool === "eraser" ? PALETTE[0] : color;
      setPixels(newPixels);
    }
  };

  const exportPng = useCallback(() => {
    const size = 512;
    const canvas = canvasRef.current;
    if (!canvas) return;
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const cellSize = size / N;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        ctx.fillStyle = pixels[r][c];
        ctx.fillRect(c * cellSize, r * cellSize, cellSize, cellSize);
      }
    }
    const link = document.createElement("a");
    link.download = `pixel-art-${Date.now()}.png`;
    link.href = canvas.toDataURL();
    link.click();
  }, [pixels]);

  const tm = "text-secondary";
  const bc = "border-theme";
  const bgc = "bg-zinc-900/40";

  const toolBtn = (t: "pen" | "eraser" | "bucket", icon: React.ReactNode) => (
    <button
      onClick={() => setTool(t)}
      className={`p-2 rounded-lg border cursor-pointer transition-all active:scale-95 ${tool === t ? "bg-emerald-500 text-zinc-950 border-emerald-500" : `${bgc} ${bc} ${tm}`}`}
    >
      {icon}
    </button>
  );

  return (
    <div className={`w-full flex flex-col gap-4 select-none ${"text-theme"}`}>
      <div
        className={`flex items-center justify-between pb-3.5 border-b w-full px-1 ${bc}`}
      >
        <button
          onClick={onGoBack}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer active:scale-95 transition-all ${"bg-zinc-800/60 border border-theme hover:bg-zinc-800 hover:text-white text-secondary"}`}
        >
          <ArrowLeft size={13} /> <span>返回大厅</span>
        </button>
        <div className="flex items-center gap-1.5">
          <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
          <span
            className={`text-[11px] font-mono tracking-wider uppercase ${tm}`}
          >
            像素艺术 · PIXEL
          </span>
        </div>
      </div>

      {/* Toolbar */}
      <div
        className={`flex items-center gap-2 p-2 rounded-xl border ${bc} ${bgc} flex-wrap`}
      >
        {toolBtn("pen", <Palette size={14} />)}
        {toolBtn("eraser", <Eraser size={14} />)}
        {toolBtn("bucket", <PaintBucket size={14} />)}
        <div className="w-px h-6 bg-zinc-800 mx-1" />
        <button
          onClick={clearCanvas}
          className={`p-2 rounded-lg border cursor-pointer transition-all active:scale-95 ${bgc} ${bc} ${tm}`}
          title="清空"
        >
          <Eraser size={14} />
        </button>
        <button
          onClick={() => setShowGrid(!showGrid)}
          className={`p-2 rounded-lg border cursor-pointer transition-all active:scale-95 ${showGrid ? "bg-emerald-500 text-zinc-950" : `${bgc} ${bc} ${tm}`}`}
          title="网格"
        >
          <Grid size={14} />
        </button>
        <button
          onClick={saveDraft}
          className={`p-2 rounded-lg border cursor-pointer transition-all active:scale-95 ${bgc} ${bc} ${tm}`}
          title="保存草稿"
        >
          <Save size={14} />
        </button>
        <button
          onClick={exportPng}
          className={`p-2 rounded-lg border cursor-pointer transition-all active:scale-95 ${bgc} ${bc} ${tm}`}
          title="导出PNG"
        >
          <Download size={14} />
        </button>
      </div>

      {/* Color palette */}
      <div className="flex flex-wrap gap-1.5 justify-center px-2">
        {PALETTE.map((c) => (
          <button
            key={c}
            onClick={() => setColor(c)}
            className="w-6 h-6 rounded-lg cursor-pointer transition-all active:scale-90 hover:scale-110"
            style={{
              backgroundColor: c,
              boxShadow:
                color === c
                  ? `0 0 0 2px ${"#34D399"}, 0 0 8px rgba(52,211,153,0.4)`
                  : "none",
            }}
          />
        ))}
      </div>

      {/* Pixel grid */}
      {saved && (
        <div
          className={`text-center text-[10px] font-bold ${"text-emerald-400"}`}
        >
          草稿已保存！
        </div>
      )}

      <div className="flex justify-center">
        <div
          className="inline-block p-1.5 rounded-2xl border"
          style={{
            backgroundColor: "#09090B",
            borderColor: "rgba(39,39,42,0.5)",
          }}
        >
          <div
            className="grid"
            style={{
              gridTemplateColumns: `repeat(${N},1fr)`,
              gap: showGrid ? "1px" : "0",
            }}
          >
            {pixels.map((row, r) =>
              row.map((c, ci) => (
                <div
                  key={`${r}-${ci}`}
                  onClick={() => paint(r, ci)}
                  onMouseEnter={(e) => {
                    if (e.buttons > 0 && tool !== "bucket") paint(r, ci);
                  }}
                  className={showGrid ? "rounded-sm" : ""}
                  style={{
                    width: 14,
                    height: 14,
                    backgroundColor: c,
                    cursor: "pointer",
                  }}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* Drafts */}
      {drafts.length > 0 && (
        <div
          className={`max-w-sm mx-auto w-full p-2.5 rounded-xl border ${bc} ${bgc}`}
        >
          <span
            className={`text-[9px] uppercase tracking-widest font-black ${tm}`}
          >
            本地草稿 ({drafts.length})
          </span>
          <div className="flex flex-wrap gap-1.5 mt-1.5">
            {drafts
              .slice(-5)
              .reverse()
              .map((key) => (
                <button
                  key={key}
                  onClick={() => loadDraft(key)}
                  className={`px-2 py-0.5 text-[9px] font-bold rounded-lg border cursor-pointer ${bgc} ${bc} ${tm} hover:text-emerald-400`}
                >
                  🎨 {key.slice(-6)}
                </button>
              ))}
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
