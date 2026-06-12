import React, { useState, useEffect, useRef, useCallback } from "react";
import { GameTheme } from "../types";
import { ArrowLeft, Info, Skull } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface SnakeProps {
  theme: GameTheme;
  onGoBack: () => void;
  userNickname: string;
  onConsumeEntropy: (points: number) => Promise<void>;
}

const N = 20;
type Dir = "U" | "D" | "L" | "R";
const OPP: Record<Dir, Dir> = { U: "D", D: "U", L: "R", R: "L" };
const KEY: Record<string, Dir> = {
  ArrowUp: "U",
  ArrowDown: "D",
  ArrowLeft: "L",
  ArrowRight: "R",
  w: "U",
  W: "U",
  s: "D",
  S: "D",
  a: "L",
  A: "L",
  d: "R",
  D: "R",
};

export default function Snake({
  theme,
  onGoBack,
  userNickname,
  onConsumeEntropy,
}: SnakeProps) {
  const [cells, setCells] = useState<{ r: number; c: number }[]>([
    { r: 10, c: 10 },
    { r: 10, c: 9 },
    { r: 10, c: 8 },
  ]);
  const [food, setFood] = useState({ r: 15, c: 15 });
  const [dir, setDir] = useState<Dir>("R");
  const [dead, setDead] = useState(false);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const [run, setRun] = useState(false);
  const [obs, setObs] = useState<{ r: number; c: number }[]>([]);
  const [obsOn, setObsOn] = useState(false);
  const [guide, setGuide] = useState(false);

  const dR = useRef(dir);
  const cR = useRef(cells);
  const fR = useRef(food);
  const oR = useRef(obs);
  const sR = useRef(score);
  const rR = useRef(run);
  const qR = useRef<Dir[]>([]);

  dR.current = dir;
  cR.current = cells;
  fR.current = food;
  oR.current = obs;
  sR.current = score;
  rR.current = run;

  useEffect(() => {
    try {
      const v = JSON.parse(localStorage.getItem("gridgame_snake_best") || "0");
      if (typeof v === "number") setBest(v);
    } catch {}
  }, []);

  const spawn = useCallback(
    (body: { r: number; c: number }[], o: { r: number; c: number }[]) => {
      const set = new Set<string>();
      body.forEach((x) => set.add(`${x.r},${x.c}`));
      o.forEach((x) => set.add(`${x.r},${x.c}`));
      const free: { r: number; c: number }[] = [];
      for (let r = 0; r < N; r++)
        for (let c = 0; c < N; c++)
          if (!set.has(`${r},${c}`)) free.push({ r, c });
      if (free.length) {
        const p = free[Math.floor(Math.random() * free.length)];
        setFood(p);
        fR.current = p;
      }
    },
    []
  );

  const mkObs = useCallback(() => {
    const a: { r: number; c: number }[] = [];
    const s = new Set<string>();
    for (let r = 8; r <= 12; r++)
      for (let c = 8; c <= 12; c++) s.add(`${r},${c}`);
    const t = Math.floor(N * N * 0.08);
    while (a.length < t) {
      const r = Math.floor(Math.random() * N),
        c = Math.floor(Math.random() * N);
      if (!s.has(`${r},${c}`)) {
        a.push({ r, c });
        s.add(`${r},${c}`);
      }
    }
    return a;
  }, []);

  const start = useCallback(() => {
    const b = [
      { r: 10, c: 10 },
      { r: 10, c: 9 },
      { r: 10, c: 8 },
    ];
    const o = obsOn ? mkObs() : [];
    setCells(b);
    setObs(o);
    setDir("R");
    setScore(0);
    setDead(false);
    setRun(true);
    cR.current = b;
    oR.current = o;
    dR.current = "R";
    sR.current = 0;
    rR.current = true;
    qR.current = [];
    spawn(b, o);
  }, [obsOn, mkObs, spawn]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const d = KEY[e.key];
      if (d) {
        e.preventDefault();
        qR.current.push(d);
      }
      if (e.key === " " || e.key === "Enter") {
        e.preventDefault();
        if (!run || dead) start();
      }
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [start, run, dead]);

  useEffect(() => {
    if (!run || dead) return;
    const id = setInterval(() => {
      let nd = dR.current;
      while (qR.current.length) {
        const q = qR.current.shift()!;
        if (q !== OPP[nd]) {
          nd = q;
          break;
        }
      }
      const body = cR.current;
      const h = body[0];
      let nr = h.r,
        nc = h.c;
      if (nd === "U") nr--;
      else if (nd === "D") nr++;
      else if (nd === "L") nc--;
      else nc++;
      if (nr < 0) nr = N - 1;
      if (nr >= N) nr = 0;
      if (nc < 0) nc = N - 1;
      if (nc >= N) nc = 0;

      const hitSelf = body.some((x) => x.r === nr && x.c === nc);
      const hitObs = oR.current.some((x) => x.r === nr && x.c === nc);
      if (hitSelf || hitObs) {
        const fs = sR.current;
        setDead(true);
        setRun(false);
        rR.current = false;
        const saved = JSON.parse(
          localStorage.getItem("gridgame_snake_best") || "0"
        );
        if (fs > saved) {
          localStorage.setItem("gridgame_snake_best", JSON.stringify(fs));
          setBest(fs);
        }
        onConsumeEntropy(Math.max(5, Math.min(60, Math.floor(fs * 0.5))));
        return;
      }
      const ate = nr === fR.current.r && nc === fR.current.c;
      const nb = [{ r: nr, c: nc }, ...body];
      if (!ate) nb.pop();
      setDir(nd);
      setCells(nb);
      dR.current = nd;
      cR.current = nb;
      if (ate) {
        setScore((x) => x + 1);
        sR.current += 1;
        spawn(nb, oR.current);
      }
    }, 150);
    return () => clearInterval(id);
  }, [run, dead, onConsumeEntropy, spawn]);

  const tm = "text-secondary";
  const bc = "border-theme";

  return (
    <div className={`w-full flex flex-col gap-4 select-none ${"text-theme"}`}>
      <div
        className={`flex items-center justify-between pb-3.5 border-b w-full px-1 ${bc}`}
      >
        <button
          onClick={onGoBack}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer active:scale-95 transition-all ${"bg-zinc-800/60 border border-theme hover:bg-zinc-800 hover:text-theme text-secondary"}`}
        >
          <ArrowLeft size={13} /> <span>返回大厅</span>
        </button>
        <div className="flex items-center gap-1.5">
          <div
            className={`w-2.5 h-2.5 rounded-full ${run ? "bg-emerald-500 animate-pulse" : "bg-zinc-500"}`}
          />
          <span
            className={`text-[11px] font-mono tracking-wider uppercase ${tm}`}
          >
            贪吃蛇 · SNAKE
          </span>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 px-2 py-1">
        <span className={`text-[10px] ${tm}`}>
          挑战者：
          <span className="text-xs font-bold font-mono text-theme">
            {userNickname}
          </span>
        </span>
        <div
          className={`px-2.5 py-1 rounded-lg border ${bc} ${"bg-zinc-900/40"}`}
        >
          <span
            className={`text-[10px] font-black font-mono ${"text-rose-400"}`}
          >
            得分: {score}
          </span>
        </div>
        <div
          className={`px-2.5 py-1 rounded-lg border ${bc} ${"bg-zinc-900/40"}`}
        >
          <span
            className={`text-[10px] font-black font-mono ${"text-amber-400"}`}
          >
            最高: {best}
          </span>
        </div>
      </div>
      <div
        className={`flex items-center justify-center gap-2 p-2 rounded-xl border ${bc} ${"bg-zinc-900/40"} max-w-sm mx-auto w-full`}
      >
        <button
          onClick={start}
          className={`px-4 py-1.5 rounded-lg text-xs font-black cursor-pointer active:scale-95 transition-all ${run || dead ? "bg-emerald-500 text-zinc-950" : "bg-emerald-600 text-white"}`}
        >
          {run ? "重新开始" : dead ? "再玩一局" : "开始游戏"}
        </button>
        <button
          onClick={() => {
            if (!run) setObsOn(!obsOn);
          }}
          className={`p-2 rounded-lg text-[9px] font-bold border cursor-pointer transition-all active:scale-95 ${obsOn ? "bg-rose-500/20 border-rose-500/40 text-rose-400" : `${"bg-zinc-900/40"} ${bc} ${tm}`}`}
          title="障碍模式"
        >
          <Skull size={14} />
        </button>
        <span className={`text-[8px] ${tm}`}>障碍</span>
      </div>
      <div className="flex justify-center">
        <div
          className="inline-block p-1.5 rounded-2xl border"
          style={{
            backgroundColor: "#09090B",
            borderColor: "rgba(39,39,42,0.5)",
          }}
        >
          <div
            className="grid gap-[1px]"
            style={{ gridTemplateColumns: `repeat(${N},1fr)` }}
          >
            {Array.from({ length: N * N }).map((_, i) => {
              const r = Math.floor(i / N),
                c = i % N;
              const isH = cells.length && cells[0].r === r && cells[0].c === c;
              const bi = cells.findIndex((x) => x.r === r && x.c === c);
              const isF = !isH && food.r === r && food.c === c;
              const isO = obs.some((x) => x.r === r && x.c === c);
              let bg = "#18181B";
              if (isO) bg = "#292524";
              else if (isF) bg = "#F59E0B";
              else if (bi >= 0) {
                const t = cells.length > 1 ? bi / (cells.length - 1) : 0;
                bg = `rgb(${Math.round(220 - t * 130)},${Math.round(70 + t * 100)},${Math.round(140 - t * 80)})`;
              }
              return (
                <div
                  key={i}
                  className="rounded-sm transition-all duration-100"
                  style={{
                    width: 14,
                    height: 14,
                    backgroundColor: bg,
                    boxShadow: isH
                      ? `0 0 6px ${"rgba(16,185,129,0.5)"}`
                      : isF
                        ? `0 0 8px ${"rgba(245,158,11,0.5)"}`
                        : "none",
                    transform: isH ? "scale(1.1)" : "scale(1)",
                  }}
                />
              );
            })}
          </div>
        </div>
      </div>
      <AnimatePresence>
        {dead && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="text-center py-4"
          >
            <div
              className={`inline-block p-4 rounded-2xl border ${bc} ${"bg-zinc-900/40"}`}
            >
              <div className="text-2xl mb-2">💀</div>
              <h3 className="text-sm font-black text-theme">游戏结束</h3>
              <p className={`text-[10px] mt-1 ${tm}`}>
                得分: {score} | 最高: {Math.max(best, score)}
              </p>
              <button
                onClick={start}
                className="mt-3 px-4 py-1.5 rounded-lg text-xs font-black bg-emerald-500 text-zinc-950 cursor-pointer active:scale-95 transition-all"
              >
                再来一局
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <div
        className={`max-w-sm mx-auto w-full p-2.5 rounded-xl border ${bc} ${"bg-zinc-900/40"}`}
      >
        <div className="flex justify-between items-center">
          <span
            className={`text-[9px] uppercase tracking-widest font-black ${tm}`}
          >
            玩法说明
          </span>
          <button
            onClick={() => setGuide(!guide)}
            className="text-[9px] font-bold text-indigo-400 hover:underline flex items-center gap-0.5 cursor-pointer"
          >
            <Info size={9} /> <span>{guide ? "收起" : "展开"}</span>
          </button>
        </div>
        {guide && (
          <div
            className={`mt-1.5 p-2 rounded-lg border text-[10px] leading-relaxed ${"bg-zinc-950/40 border-theme text-secondary"}`}
          >
            <p>
              🎮 <strong>操作：</strong> 方向键 / WASD 控制。支持输入缓冲，快速
              90 度折返。
            </p>
            <p>
              🧱 <strong>障碍模式：</strong>{" "}
              随机生成不可穿透废墟，压缩安全路径。
            </p>
            <p>
              🔥 <strong>负熵：</strong> 结算时分 × 0.5 折算负熵。
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
