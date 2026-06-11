# Lobby Layout Optimization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 修复大厅页面熵面板宽度对齐 + 将需求工厂移至页面底部

**Architecture:** 仅修改 `src/App.tsx`，调整三处：熵面板容器宽度 class、FeatureRequestPanel 组件位置移动、熵面板内部大屏响应式布局。不涉及其他文件。

**Tech Stack:** React 19 + TypeScript + Tailwind CSS v4

---

### Task 1: 熵面板宽度对齐 + 大屏响应式优化

**Files:**
- Modify: `src/App.tsx:478`

- [ ] **Step 1: 修改熵面板外层容器宽度**

将熵面板外层 div 的 `max-w-lg` 改为 `max-w-2xl`，与下方游戏九宫格宽度对齐。

找到 [App.tsx:478](src/App.tsx#L478)：
```tsx
<div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-4.5 max-w-lg mx-auto flex flex-col gap-3.5 shadow-xl select-none">
```

改为：
```tsx
<div className="bg-zinc-900/40 border border-zinc-800/80 rounded-2xl p-4.5 max-w-2xl mx-auto flex flex-col gap-3.5 shadow-xl select-none">
```

- [ ] **Step 2: 优化大屏下状态徽章位置**

当前状态徽章在标题行右侧，与左侧标题挤在同一行。在大屏下（`sm:`+）将熵面板内部改为更清晰的两栏布局。

找到 entropy dashboard 标题行（约 line 479-499），当前结构：
```tsx
<div className="flex items-center justify-between">
  <div className="flex items-center gap-2">
    {/* icon + 标题 */}
  </div>
  {/* 状态徽章 — 与标题同行，小屏可能挤压 */}
  {(user.entropy || 0) <= 0 ? (...) : (...)}
</div>
```

改为两段式 — 标题行独立，状态徽章移到下方详细信息区段，与右侧面板自然融合。具体将状态徽章移到详情网格区域上方或内部。

实际修改：将状态徽章移到熵值条和详情网格之间，作为独立的状态指示行，不受标题行挤压：

```tsx
<div className="flex items-center justify-between">
  <div className="flex items-center gap-2">
    <div className="w-6.5 h-6.5 bg-[#3EB489]/10 rounded-lg border border-[#3EB489]/20 flex items-center justify-center text-[#3EB489]">
      <Orbit size={13} className="animate-spin" style={{ animationDuration: '6s' }} />
    </div>
    <span className="text-xs font-black text-white tracking-tight">熵 · 系统状态</span>
  </div>
  {/* 标题行右侧留空，或放置紧凑图标 */}
</div>

{/* 状态徽章独立行 — 大屏下不挤压标题 */}
<div className="flex items-center gap-2">
  {(user.entropy || 0) <= 0 ? (
    <span className="text-[9.5px] font-black text-[#3EB489] bg-[#3EB489]/10 px-2.5 py-0.5 rounded-full border border-[#3EB489]/25 flex items-center gap-1">
      <Sparkles size={10} className="animate-pulse" />
      <span>秩序井然（低熵态）</span>
    </span>
  ) : (
    <span className="text-[9.5px] font-bold text-amber-500 bg-amber-500/10 px-2.5 py-0.5 rounded-full border border-amber-500/25 flex items-center gap-1 animate-pulse">
      <Flame size={10} />
      <span>熵增中（需整理）</span>
    </span>
  )}
</div>
```

- [ ] **Step 3: 运行 lint 验证**

```bash
cd /root/no-jobs/zzxun/grid-games && npm run lint
```
Expected: `tsc --noEmit` 零错误退出。

---

### Task 2: 需求工厂移至页面底部

**Files:**
- Modify: `src/App.tsx:550-555` (移除)
- Modify: `src/App.tsx:834` 之后 (插入)

- [ ] **Step 1: 移除 FeatureRequestPanel 当前位置**

删除 [App.tsx:550-555](src/App.tsx#L550-L555) 中的 FeatureRequestPanel 引用：
```tsx
{/* 🌟 需求工厂 - Feature Request Panel */}
<FeatureRequestPanel
  userId={user.userId}
  negentropy={user.negentropy || 0}
  onNegentropyChange={handleNegentropySpent}
/>
```

连同其上方空行一起删除，让九宫格紧接在熵面板之后。

- [ ] **Step 2: 在 Leaderboard 下方插入 FeatureRequestPanel**

找到 Leaderboard 区块结束位置（[App.tsx:833-834](src/App.tsx#L833-L834)），在 `</div>` 闭合标签之后、`</main>` 之前插入：

```tsx
          {/* 🌟 需求工厂 - 移至底部，浏览完游戏和排行后自然看到 */}
          {selectedGameId === null && user.userId && (
            <div className="w-full max-w-2xl mx-auto mt-5">
              <FeatureRequestPanel
                userId={user.userId}
                negentropy={user.negentropy || 0}
                onNegentropyChange={handleNegentropySpent}
              />
            </div>
          )}
```

注意：FeatureRequestPanel 只在 Lobby 模式（`selectedGameId === null`）且有用户 ID 时展示，与 Leaderboard 的显示条件一致。

- [ ] **Step 3: 运行 lint 验证**

```bash
cd /root/no-jobs/zzxun/grid-games && npm run lint
```
Expected: `tsc --noEmit` 零错误退出。

---

### Task 3: 功能验证

- [ ] **Step 1: 启动应用验证**

```bash
cd /root/no-jobs/zzxun/grid-games && npm run dev:all
```

- [ ] **Step 2: 目视检查**

- [ ] 熵面板宽度在大屏下与游戏九宫格对齐（同为 672px 最大宽度）
- [ ] 熵面板状态徽章不挤压标题
- [ ] 需求工厂出现在排行榜下方
- [ ] 小屏（手机）下布局正常，无溢出
- [ ] 进入游戏后返回大厅，布局保持正确

- [ ] **Step 3: 提交**

```bash
git add src/App.tsx docs/superpowers/specs/2026-06-12-lobby-layout-optimization.md docs/superpowers/plans/2026-06-12-lobby-layout-optimization.md
git commit -m "fix: 优化大厅布局 — 熵面板宽度对齐 + 需求工厂移至底部"
```
