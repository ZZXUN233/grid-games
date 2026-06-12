import React from "react";
import { THEMES } from "../data/themes";
import { GameTheme } from "../types";
import { Palette, Eye } from "lucide-react";

interface ThemeSelectorProps {
  currentThemeId: string;
  onSelect: (id: string) => void;
  theme: GameTheme; // current active theme styling
}

export default function ThemeSelector({
  currentThemeId,
  onSelect,
  theme,
}: ThemeSelectorProps) {
  return (
    <div className={`p-4 rounded-xl card-theme transition-all duration-300`}>
      <div className="flex items-center gap-2 mb-3">
        <Palette size={16} className="text-theme" />
        <h4 className={`text-sm font-bold tracking-tight text-theme`}>
          护眼视觉主题
        </h4>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-secondary font-mono">
          {THEMES.length} PRESETS
        </span>
      </div>

      <p
        className={`text-xs text-muted mb-3`}
        style={{ contentVisibility: "auto" }}
      >
        支持暗场抗蓝光与日间高对比度自适应。每次点击均具备高对比动画响应。
      </p>

      <div className="grid grid-cols-1 gap-2.5">
        {THEMES.map((t) => {
          const isActive = t.id === currentThemeId;

          return (
            <button
              id={`theme-btn-${t.id}`}
              key={t.id}
              onClick={() => onSelect(t.id)}
              className={`p-3 rounded-lg border text-left transition-all relative overflow-hidden flex items-center gap-3 group active:scale-[0.98] ${
                isActive
                  ? "border-amber-500 bg-amber-500/5 shadow-md"
                  : "border-theme bg-zinc-900/50 hover:bg-zinc-900 hover:border-theme"
              }`}
            >
              {/* Visual Swatch: dark dot + accent dot */}
              <div className="flex gap-0.5 items-center shrink-0">
                <span
                  className="w-4 h-4 rounded-full border border-black/10"
                  style={{ backgroundColor: "#121212" }}
                />
                <span
                  className="w-4 h-4 rounded-full border border-black/10"
                  style={{ backgroundColor: t.accent }}
                />
              </div>

              <div className="flex-1 min-w-0">
                <span
                  className={`text-xs font-bold leading-tight block ${isActive ? "text-theme" : "text-theme"}`}
                >
                  {t.name}
                </span>
                <span className="text-[10px] text-muted leading-tight block truncate">
                  {t.description}
                </span>
              </div>

              {isActive && (
                <div className="absolute right-0 bottom-0 w-2 h-2 bg-amber-500 rounded-tl-full" />
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
