# 格子熵 · Grid Entropy — 架构设计文档

## 项目概述

"格子熵" (Grid Entropy) 是一个几何网格游戏聚合平台，以"对抗熵增"为主题。
前端采用 React 19 + TypeScript + Vite + Tailwind CSS v4，后端采用 Express + MySQL，
提供 9 款网格小游戏的在线游玩、成绩排行与负熵消解系统。

## 技术栈

| 层 | 技术 |
|---|------|
| 语言 | TypeScript 5.8 |
| UI 框架 | React 19 |
| 构建工具 | Vite 6 + esbuild |
| 样式 | Tailwind CSS v4 |
| 动画 | motion (Framer Motion v12) |
| 图标 | lucide-react |
| 后端 | Express 4 (Node.js) |
| 数据库 | MySQL 8 (via mysql2) |
| 密码加密 | bcryptjs |

## 系统架构

```
┌─────────────────────────────────────────────────────┐
│                    Browser                           │
│  ┌─────────────────────────────────────────────┐    │
│  │           React SPA (port 3000)             │    │
│  │  App.tsx (State Hub)                        │    │
│  │  ├── Lobby (游戏大厅 + 熵仪表盘 + 排行)      │    │
│  │  └── Game Workspace (9款游戏)                │    │
│  │  src/api.ts → fetch() → HTTP API            │    │
│  └─────────────────────────────────────────────┘    │
└────────────────────┬────────────────────────────────┘
                     │ HTTP (localhost:3001)
                     ▼
┌─────────────────────────────────────────────────────┐
│              Express API Server (port 3001)          │
│  /api/auth/*    → 用户注册/登录/修改                 │
│  /api/scores    → 成绩保存/查询                      │
│  /api/entropy   → 熵记录保存/排行榜                   │
└────────────────────┬────────────────────────────────┘
                     │ mysql2
                     ▼
┌─────────────────────────────────────────────────────┐
│              MySQL (localhost:3306)                   │
│  Database: test_db                                   │
│  Tables: users, scores, entropy_leaderboard          │
└─────────────────────────────────────────────────────┘
```

## 数据库设计

见 [sql/init.sql](../sql/init.sql) — 包含完整的建表 DDL。

三张表：
- **users** — 用户账号（#xxxx9999 格式 ID，bcrypt 密码）
- **scores** — 游戏成绩记录
- **entropy_leaderboard** — 每日熵消解排行榜

## API 设计

所有端点位于 `http://localhost:3001/api`。

### 认证模块

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/auth/register` | 注册（nickname + password） |
| POST | `/auth/login` | 登录（userId + password） |
| POST | `/auth/change-password` | 修改密码 |
| POST | `/auth/update-nickname` | 修改昵称 |
| POST | `/auth/update-avatar` | 修改头像 |
| POST | `/auth/profile` | 获取用户信息（会话恢复） |

### 游戏模块

| 方法 | 端点 | 说明 |
|------|------|------|
| POST | `/scores` | 保存成绩 |
| GET | `/top-scores/:mode/:difficulty` | 获取排行榜 |
| POST | `/entropy` | 保存/更新熵记录（UPSERT） |
| GET | `/entropy-leaderboard/:date` | 获取日熵排行榜 |

## 前端组件树

```
App (state hub)
├── Lobby (selectedGameId === null)
│   ├── NameEditor          — 个人资料编辑（昵称/头像/密码）
│   ├── ThemeSelector       — 6 种护眼视觉主题
│   ├── Game cards          — 3×3 游戏入口网格
│   ├── Entropy dashboard   — 每日"对抗熵增"仪表盘
│   └── Leaderboard         — 成绩排行 + 熵排行
├── AuthModal               — 登录/注册弹窗（可选）
└── Game Workspace
    ├── SchulteGrid          — 舒尔特方格
    ├── Game2048             — 2048 合并
    ├── Gomoku               — 五子棋
    ├── Sudoku               — 数独
    ├── Minesweeper          — 扫雷
    ├── MemoryMatrix         — 记忆矩阵
    ├── GameOfLife           — 元胞生活
    ├── PixelCanvas          — 像素画布
    └── Snake                — 贪吃蛇
```

## 游戏列表

| 游戏 | 组件 | 核心特性 |
|------|------|----------|
| 舒尔特方格 | SchulteGrid | 3-6 维数字点击，周边视野训练 |
| 2048 | Game2048 | 3 种生成模式（normal/chaos/hell） |
| 五子棋 | Gomoku | vs AI 或双人，3 种棋盘规格 |
| 数独 | Sudoku | 3 种难度，自动生成谜题 |
| 扫雷 | Minesweeper | 3 种难度，首次点击防爆 |
| 记忆矩阵 | MemoryMatrix | 动态 4-7 阶，闪烁+回忆训练 |
| 元胞生活 | GameOfLife | 40×40 Torus，6 种预设，播放/调速 |
| 像素画布 | PixelCanvas | 24×24，20 色调色板，铅笔/橡皮/油漆桶，导出 PNG |
| 贪吃蛇 | Snake | 20×20，输入缓冲，障碍模式，渐变蛇身 |

## 熵系统

每个玩家有 "accumulatedEntropy"（历史未消解）和 "todayEntropyConsumed"（今日已消解）。
每日目标：消解 100 负熵。玩游戏可获得熵值。隔日未消解部分自动滚动至累计历史熵。

熵值计算公式：
- 舒尔特：3×3=15, 4×4=25, 5×5=35, 6×6=50
- 扫雷：初级=20, 中级=35, 高级=60
- 记忆矩阵：目标数×动态系数（最高可达 140+）
- 贪吃蛇：得分×0.5（5-60 范围）
- 元胞生活：稳定环 50/100/200 代渐进回馈
- 像素画布：每次保存 10

## 本地开发

```bash
# 安装依赖
npm install

# 初始化数据库（需要 MySQL 运行在 localhost:3306）
mysql -u root -p test_db < sql/init.sql

# 启动后端 API（端口 3001）
npm run dev:server

# 启动前端（端口 3000）
npm run dev

# 同时启动前后端
npm run dev:all
```