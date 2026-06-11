# Lobby Layout Optimization — 大厅布局优化

**Date:** 2026-06-12
**Status:** Approved

## Problem

1. **熵面板宽度不对齐**：Entropy Dashboard 使用 `max-w-lg`（512px），而游戏九宫格使用 `max-w-2xl`（672px）。大屏下两者视觉不对齐，熵面板明显偏窄。
2. **需求工厂位置打断浏览流**：FeatureRequestPanel 夹在"熵状态"和"游戏九宫格入口"之间，打断了用户"看状态→选游戏"的自然流程。

## Design

### 布局流重构

```
Before:
  Header → 熵状态(窄) → 需求工厂 ← 打断！→ 九宫格 → 名片 → 排行榜

After:
  Header → 熵状态(宽,对齐) → 九宫格 → 名片 → 排行榜 → 需求工厂 ↓ 底部
```

### 改动点

#### 1. 熵面板宽度对齐（App.tsx）

- 将熵面板容器从 `max-w-lg` 改为 `max-w-2xl`，与游戏九宫格宽度一致
- 大屏下（`sm:`+）状态徽章移到右侧独立显示，与左侧信息形成两栏
- 不改动熵面板内部数据逻辑

#### 2. 需求工厂下移（App.tsx）

- 从当前位置（熵面板和九宫格之间）移除 `<FeatureRequestPanel />`
- 放到 Leaderboard 下方、Footer 上方
- 宽度也从 `max-w-lg` 改为 `max-w-2xl`，与其他区块对齐
- 组件内部代码无需改动

### 参考来源

| 产品 | 模式 |
|------|------|
| Steam 库 | 个人状态条 → 游戏网格 → 社区/工坊在下方 |
| Switch Home | 顶部资讯栏 → 游戏图标主区 → 底部系统功能 |
| 原神/星铁 | 顶部紧凑资源条 → 主体内容入口 → 底部公告 |

共同点：**游戏入口是主角，系统状态是配角，社区/反馈是底层内容。**

### 影响范围

- `src/App.tsx`：移动 `<FeatureRequestPanel />` 位置，修改熵面板 width class
- 不涉及 `FeatureRequestPanel.tsx` 内部逻辑
- 不涉及 API、类型、其他组件

### 不做什么

- 不重构熵面板的数据逻辑
- 不改动 FeatureRequestPanel 组件内部
- 不改变移动端布局（手机端本就是单列，宽度对齐无影响，下移不影响操作）
