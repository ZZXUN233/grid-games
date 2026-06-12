import express from "express";
import mysql2 from "mysql2/promise";
import bcrypt from "bcryptjs";
import crypto from "crypto";
import cors from "cors";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env.local for local dev, fallback to .env for production
dotenv.config({ path: path.resolve(__dirname, ".env.local") });
dotenv.config({ path: path.resolve(__dirname, ".env") });

const app = express();
app.use(express.json());

// CORS — same pattern as chigua/Poetica-6, permissive in dev, irrelevant in production (single origin)
app.use(cors());

// Rate limiting — anti-abuse for auth endpoints
const globalLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "请求过于频繁，请稍后再试" },
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // max 5 registrations per hour per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "注册请求过于频繁（5次/小时），请稍后再试",
  },
  skipSuccessfulRequests: true, // only count failed attempts
});

const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // max 20 login attempts per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "登录尝试过于频繁（20次/15分钟），请稍后再试",
  },
  skipSuccessfulRequests: true, // only count failures (prevent brute force)
});

app.use(globalLimiter);

const PORT = parseInt(process.env.PORT || "3001", 10);

// MySQL connection pool — configured via .env.local (dev) or env vars (Docker/prod)
const pool = mysql2.createPool({
  host: process.env.DB_HOST || "localhost",
  port: parseInt(process.env.DB_PORT || "3306", 10),
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "root123456",
  database: process.env.DB_NAME || "test_db",
  waitForConnections: true,
  connectionLimit: parseInt(process.env.DB_CONNECTION_LIMIT || "10", 10),
  connectTimeout: 10000,
  // Recycle idle connections before MySQL wait_timeout kills them
  idleTimeout: 60000,
  // TCP keep-alive to prevent intermediate NAT/firewall drops
  enableKeepAlive: true,
  keepAliveInitialDelay: 10000,
});

// Print effective DB config on startup (password masked)
console.log(
  "DB Config:",
  JSON.stringify({
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    user: process.env.DB_USER || "root",
    password: "***",
    database: process.env.DB_NAME || "test_db",
  })
);

// Test connection on startup
pool
  .getConnection()
  .then((conn) => {
    console.log("MySQL connected successfully");
    conn.release();
  })
  .catch((err) => {
    console.error("MySQL connection failed:", err.message);
    console.error(
      "Full error:",
      JSON.stringify(err, Object.getOwnPropertyNames(err))
    );
  });

// ==================== HELPER ====================

/** Generate a user ID in format: # + 4 random lowercase letters + 4 random digits */
function generateUserId(): string {
  const letters = crypto.randomBytes(4).toString("hex").slice(0, 4); // 4 hex = letters a-f, fine
  // Ensure we get a-f lowercase
  const letterPart = Array.from({ length: 4 }, () =>
    String.fromCharCode(97 + Math.floor(Math.random() * 26))
  ).join("");
  const digitPart = Array.from({ length: 4 }, () =>
    Math.floor(Math.random() * 10).toString()
  ).join("");
  return `#${letterPart}${digitPart}`;
}

// ==================== USER / AUTH API ====================

// POST /api/auth/register - Register a new user
app.post("/api/auth/register", registerLimiter, async (req, res) => {
  try {
    const { nickname, password, avatarColor, avatarEmoji } = req.body;

    if (!nickname || nickname.trim().length === 0 || nickname.length > 16) {
      return res
        .status(400)
        .json({ success: false, error: "昵称长度需在 1-16 个字符" });
    }
    if (!password) {
      return res.status(400).json({ success: false, error: "请输入密码" });
    }

    // Generate unique user ID (retry on collision)
    let userId = "";
    let attempts = 0;
    while (attempts < 10) {
      userId = generateUserId();
      const [existing] = await pool.execute(
        "SELECT user_id FROM users WHERE user_id = ?",
        [userId]
      );
      if ((existing as any[]).length === 0) break;
      attempts++;
    }
    if (attempts >= 10) {
      return res
        .status(500)
        .json({ success: false, error: "用户 ID 生成失败，请重试" });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const now = Date.now();

    await pool.execute(
      `INSERT INTO users (user_id, nickname, avatar_color, avatar_emoji, password_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        userId,
        nickname.trim(),
        avatarColor || "#64748B",
        avatarEmoji || "👤",
        hashedPassword,
        now,
        now,
      ]
    );

    res.json({
      success: true,
      user: {
        userId,
        nickname: nickname.trim(),
        avatarColor: avatarColor || "#64748B",
        avatarEmoji: avatarEmoji || "👤",
      },
    });
  } catch (error: any) {
    console.error("Error registering user:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/auth/login - Login with password
app.post("/api/auth/login", loginLimiter, async (req, res) => {
  try {
    const { userId, password } = req.body;

    if (!userId || !password) {
      return res
        .status(400)
        .json({ success: false, error: "请输入用户 ID 和密码" });
    }

    const [rows] = await pool.execute(
      "SELECT user_id, nickname, avatar_color, avatar_emoji, password_hash FROM users WHERE user_id = ?",
      [userId]
    );
    const users = rows as any[];
    if (users.length === 0) {
      return res
        .status(401)
        .json({ success: false, error: "用户 ID 或密码错误" });
    }

    const user = users[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res
        .status(401)
        .json({ success: false, error: "用户 ID 或密码错误" });
    }

    res.json({
      success: true,
      user: {
        userId: user.user_id,
        nickname: user.nickname,
        avatarColor: user.avatar_color,
        avatarEmoji: user.avatar_emoji,
      },
    });
  } catch (error: any) {
    console.error("Error logging in:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/auth/change-password - Change password
app.post("/api/auth/change-password", async (req, res) => {
  try {
    const { userId, oldPassword, newPassword } = req.body;

    if (!userId || !oldPassword || !newPassword) {
      return res.status(400).json({ success: false, error: "缺少必要参数" });
    }
    if (!newPassword) {
      return res.status(400).json({ success: false, error: "请输入新密码" });
    }

    const [rows] = await pool.execute(
      "SELECT password_hash FROM users WHERE user_id = ?",
      [userId]
    );
    const users = rows as any[];
    if (users.length === 0) {
      return res.status(404).json({ success: false, error: "用户不存在" });
    }

    const valid = await bcrypt.compare(oldPassword, users[0].password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, error: "原密码错误" });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.execute(
      "UPDATE users SET password_hash = ?, updated_at = ? WHERE user_id = ?",
      [hashed, Date.now(), userId]
    );

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error changing password:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/auth/update-nickname - Change nickname
app.post("/api/auth/update-nickname", async (req, res) => {
  try {
    const { userId, nickname } = req.body;

    if (!nickname || nickname.trim().length === 0 || nickname.length > 16) {
      return res
        .status(400)
        .json({ success: false, error: "昵称长度需在 1-16 个字符" });
    }

    const [result] = await pool.execute(
      "UPDATE users SET nickname = ?, updated_at = ? WHERE user_id = ?",
      [nickname.trim(), Date.now(), userId]
    );

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error updaing nickname:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/auth/update-avatar - Change avatar (color + emoji)
app.post("/api/auth/update-avatar", async (req, res) => {
  try {
    const { userId, avatarColor, avatarEmoji } = req.body;

    if (!avatarColor || !avatarEmoji) {
      return res.status(400).json({ success: false, error: "缺少头像参数" });
    }

    await pool.execute(
      "UPDATE users SET avatar_color = ?, avatar_emoji = ?, updated_at = ? WHERE user_id = ?",
      [avatarColor, avatarEmoji, Date.now(), userId]
    );

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error updating avatar:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/auth/profile - Fetch user profile by userId (for session restore)
app.post("/api/auth/profile", async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, error: "缺少用户 ID" });
    }

    const [rows] = await pool.execute(
      "SELECT user_id, nickname, avatar_color, avatar_emoji, entropy, negentropy, total_negentropy_generated, last_active_date FROM users WHERE user_id = ?",
      [userId]
    );
    const users = rows as any[];
    if (users.length === 0) {
      return res.status(404).json({ success: false, error: "用户不存在" });
    }

    const user = users[0];
    res.json({
      success: true,
      user: {
        userId: user.user_id,
        nickname: user.nickname,
        avatarColor: user.avatar_color,
        avatarEmoji: user.avatar_emoji,
        entropy: user.entropy ?? 0,
        negentropy: user.negentropy ?? 0,
        totalNegentropyGenerated: user.total_negentropy_generated ?? 0,
        lastActiveDate: user.last_active_date || "",
      },
    });
  } catch (error: any) {
    console.error("Error fetching profile:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== SCORES API ====================

// POST /api/scores - Save a score
app.post("/api/scores", async (req, res) => {
  try {
    const {
      id,
      userId,
      nickname,
      avatarColor,
      avatarEmoji,
      mode,
      difficulty,
      time,
      createdAt,
    } = req.body;

    // Round time to 2 decimal places for DECIMAL(10,2) column
    const timeSec =
      typeof time === "number"
        ? Math.round(time * 100) / 100
        : parseFloat(time || "0");
    const ts = typeof createdAt === "number" ? createdAt : Date.now();

    await pool.execute(
      `INSERT INTO scores (id, user_id, nickname, avatar_color, avatar_emoji, mode, difficulty, time_seconds, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        String(id),
        String(userId),
        nickname || avatarColor || "#64748B",
        avatarEmoji || "👤",
        mode,
        difficulty,
        timeSec,
        ts,
      ]
    );

    res.json({ success: true });
  } catch (error: any) {
    if (error.code === "ER_DUP_ENTRY") {
      return res.json({ success: true });
    }
    console.error(
      "Error saving score:",
      error.code,
      error.message,
      error.sqlMessage || ""
    );
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/scores/game/:game — Unified game leaderboard
app.get("/api/scores/game/:game", async (req, res) => {
  try {
    const { game } = req.params;
    const difficulty = (req.query.difficulty as string) || "";
    const limitCount = parseInt(req.query.limit as string) || 10;

    let query = `SELECT id, user_id as userId, nickname, avatar_color as avatarColor, avatar_emoji as avatarEmoji,
                        mode, difficulty, time_seconds as time, created_at as createdAt
                 FROM scores WHERE `;
    const params: any[] = [];

    if (game === "schulte") {
      query += `mode IN ('level', 'free', 'letter')`;
      if (difficulty) {
        query += ` AND difficulty = ?`;
        params.push(difficulty);
      }
    } else {
      // For other games, match by difficulty prefix (game name in brackets)
      const gamePrefixMap: Record<string, string> = {
        minesweeper: "扫雷",
        sudoku: "数独",
        "memory-matrix": "记忆",
        snake: "贪吃蛇",
      };
      const prefix = gamePrefixMap[game] || game;
      query += `difficulty LIKE ?`;
      params.push(`${prefix}%`);
    }

    query += ` ORDER BY time_seconds ASC LIMIT ${limitCount}`;

    const [rows] = await pool.execute(query, params);
    res.json(rows);
  } catch (error: any) {
    console.error("Error fetching game scores:", error.message);
    res.status(500).json([]);
  }
});

// GET /api/top-scores/:mode/:difficulty — Legacy, kept for backward compat
app.get("/api/top-scores/:mode/:difficulty", async (req, res) => {
  try {
    const { mode, difficulty } = req.params;
    const limitCount = parseInt(req.query.limit as string) || 10;

    const [rows] = await pool.execute(
      `SELECT id, user_id as userId, nickname, avatar_color as avatarColor, avatar_emoji as avatarEmoji,
              mode, difficulty, time_seconds as time, created_at as createdAt
       FROM scores
       WHERE mode = ? AND difficulty = ?
       ORDER BY time_seconds ASC
       LIMIT ${limitCount}`,
      [mode, difficulty]
    );

    res.json(rows);
  } catch (error: any) {
    console.error("Error fetching top scores:", error.message);
    res.status(500).json([]);
  }
});

// ==================== ENTROPY API ====================

// POST /api/entropy - Save/replace entropy record
app.post("/api/entropy", async (req, res) => {
  try {
    const {
      id,
      userId,
      nickname,
      avatarColor,
      avatarEmoji,
      date,
      entropyConsumed,
    } = req.body;

    await pool.execute(
      `INSERT INTO entropy_leaderboard (id, user_id, nickname, avatar_color, avatar_emoji, date, entropy_consumed, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        nickname = VALUES(nickname),
        avatar_color = VALUES(avatar_color),
        avatar_emoji = VALUES(avatar_emoji),
        entropy_consumed = VALUES(entropy_consumed),
        updated_at = VALUES(updated_at)`,
      [
        id,
        userId,
        nickname,
        avatarColor || "#64748B",
        avatarEmoji || "👤",
        date,
        entropyConsumed,
        Date.now(),
      ]
    );

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error saving entropy:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/entropy-leaderboard/:date - Fetch daily entropy leaderboard
app.get("/api/entropy-leaderboard/:date", async (req, res) => {
  try {
    const { date } = req.params;
    const limitCount = parseInt(req.query.limit as string) || 10;

    const [rows] = await pool.execute(
      `SELECT id, user_id as userId, nickname, avatar_color as avatarColor, avatar_emoji as avatarEmoji,
              date, entropy_consumed as entropyConsumed, updated_at as updatedAt
       FROM entropy_leaderboard
       WHERE date = ?
       ORDER BY entropy_consumed DESC
       LIMIT ${limitCount}`,
      [date]
    );

    res.json(rows);
  } catch (error: any) {
    console.error("Error fetching entropy leaderboard:", error.message);
    res.status(500).json([]);
  }
});

// ==================== FEATURE REQUESTS API ====================

// GET /api/features - Fetch all feature requests with user's vote status
app.get("/api/features", async (req, res) => {
  try {
    const userId = (req.query.userId as string) || "";

    const [rows] = await pool.execute(
      `SELECT fr.*,
              CASE WHEN fv.user_id IS NOT NULL THEN TRUE ELSE FALSE END as userVoted
       FROM feature_requests fr
       LEFT JOIN feature_votes fv ON fr.id = fv.feature_id AND fv.user_id = ?
       ORDER BY fr.votes DESC, fr.created_at ASC`,
      [userId]
    );

    res.json(rows);
  } catch (error: any) {
    console.error("Error fetching feature requests:", error.message);
    res.status(500).json([]);
  }
});

// POST /api/features — Submit a new feature request (costs 100 negentropy)
app.post("/api/features", async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { userId, title, description, type } = req.body;
    const SUBMIT_COST = 100; // fixed cost to create a new feature request

    if (!userId) {
      res.status(400).json({ success: false, error: "请先登录" });
      return;
    }
    if (!title || title.trim().length === 0 || title.length > 64) {
      res
        .status(400)
        .json({ success: false, error: "需求标题长度需在 1-64 个字符" });
      return;
    }

    await connection.beginTransaction();

    // Check user has enough negentropy
    const [users] = await connection.execute(
      "SELECT negentropy FROM users WHERE user_id = ?",
      [userId]
    );
    const userRows = users as any[];
    if (userRows.length === 0 || (userRows[0].negentropy || 0) < SUBMIT_COST) {
      await connection.rollback();
      res
        .status(400)
        .json({
          success: false,
          error: `负熵不足，提交需求需要消耗 ${SUBMIT_COST} E`,
        });
      return;
    }

    // Deduct negentropy
    await connection.execute(
      "UPDATE users SET negentropy = negentropy - ?, updated_at = ? WHERE user_id = ?",
      [SUBMIT_COST, Date.now(), userId]
    );

    // Create feature request (default voting cost 30, status pending, self-voted)
    const [result] = await connection.execute(
      `INSERT INTO feature_requests (title, description, type, cost, votes, status, created_at)
       VALUES (?, ?, ?, 30, 1, 'pending', ?)`,
      [title.trim(), description || "", type || "custom", Date.now()]
    );
    const featureId = (result as any).insertId;

    // Auto-vote: submitter implicitly supports their own request
    await connection.execute(
      `INSERT INTO feature_votes (feature_id, user_id, negentropy_spent, created_at)
       VALUES (?, ?, ?, ?)`,
      [featureId, userId, SUBMIT_COST, Date.now()]
    );

    await connection.commit();
    res.json({ success: true, featureId, negentropySpent: SUBMIT_COST });
  } catch (error: any) {
    await connection.rollback();
    console.error("Error creating feature request:", error.message);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
});

// POST /api/features/vote - Vote for a feature request (consumes negentropy)
app.post("/api/features/vote", async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { featureId, userId, negentropySpent } = req.body;

    if (!featureId || !userId || !negentropySpent) {
      res
        .status(400)
        .json({ success: false, error: "Missing required fields" });
      return;
    }

    await connection.beginTransaction();

    // Check if user already voted for this feature
    const [existing] = await connection.execute(
      `SELECT id FROM feature_votes WHERE feature_id = ? AND user_id = ?`,
      [featureId, userId]
    );

    if ((existing as any[]).length > 0) {
      await connection.rollback();
      res
        .status(409)
        .json({ success: false, error: "Already voted for this feature" });
      return;
    }

    // Insert vote record
    await connection.execute(
      `INSERT INTO feature_votes (feature_id, user_id, negentropy_spent, created_at)
       VALUES (?, ?, ?, ?)`,
      [featureId, userId, negentropySpent, Date.now()]
    );

    // Increment vote count
    await connection.execute(
      `UPDATE feature_requests SET votes = votes + 1 WHERE id = ?`,
      [featureId]
    );

    await connection.commit();
    res.json({ success: true });
  } catch (error: any) {
    await connection.rollback();
    console.error("Error voting for feature:", error.message);
    res.status(500).json({ success: false, error: error.message });
  } finally {
    connection.release();
  }
});

// ==================== INVITE SYSTEM ====================

const INVITE_REWARD = 5; // negentropy per valid click
const INVITE_24H = 86400000;
const INVITE_IP_DAILY_MAX = 5; // max unique inviters one IP can reward per day

// POST /api/invite/click — Record invite click with multi-layer anti-abuse
// Layer 1: self-click rejection
// Layer 2: IP + inviter dedup (same IP clicking same link within 24h)
// Layer 3: IP + UA fingerprint dedup (same device clicking same link)
// Layer 4: global per-IP daily cap (max 5 unique inviters per IP per day)
app.post("/api/invite/click", async (req, res) => {
  try {
    const { inviterUserId, clickerUserId } = req.body;
    const clickerIp = req.ip || req.socket.remoteAddress || "unknown";
    const clickerUa = (req.headers["user-agent"] || "unknown").substring(
      0,
      200
    );

    if (!inviterUserId) {
      res.status(400).json({ success: false, error: "Missing inviterUserId" });
      return;
    }

    // Layer 1: can't click your own invite link
    if (clickerUserId && clickerUserId === inviterUserId) {
      res.json({ success: true, rewarded: false, reason: "self-click" });
      return;
    }

    // Layer 2: IP + inviter dedup (same IP → same inviter, 24h)
    const [sameInviter] = await pool.execute(
      `SELECT id FROM invite_clicks WHERE inviter_user_id = ? AND clicker_ip = ? AND created_at > ?`,
      [inviterUserId, clickerIp, Date.now() - INVITE_24H]
    );
    if ((sameInviter as any[]).length > 0) {
      res.json({
        success: true,
        rewarded: false,
        reason: "duplicate: same IP + inviter in 24h",
      });
      return;
    }

    // Layer 3: IP + UA fingerprint dedup (same device clicking same link)
    const [sameDevice] = await pool.execute(
      `SELECT id FROM invite_clicks WHERE inviter_user_id = ? AND clicker_ip = ? AND clicker_ua = ? AND created_at > ?`,
      [inviterUserId, clickerIp, clickerUa, Date.now() - INVITE_24H]
    );
    if ((sameDevice as any[]).length > 0) {
      res.json({
        success: true,
        rewarded: false,
        reason: "duplicate: same device fingerprint in 24h",
      });
      return;
    }

    // Layer 4: global per-IP daily cap (prevent one IP from farming many inviters)
    const [dailyCount] = await pool.execute(
      `SELECT COUNT(DISTINCT inviter_user_id) as cnt FROM invite_clicks WHERE clicker_ip = ? AND created_at > ?`,
      [clickerIp, Date.now() - INVITE_24H]
    );
    if (((dailyCount as any[])[0]?.cnt || 0) >= INVITE_IP_DAILY_MAX) {
      res.json({
        success: true,
        rewarded: false,
        reason: `IP daily limit reached (${INVITE_IP_DAILY_MAX}/day)`,
      });
      return;
    }

    // All checks passed — record click and reward
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();

      await connection.execute(
        `INSERT INTO invite_clicks (inviter_user_id, clicker_ip, clicker_ua, reward, created_at) VALUES (?, ?, ?, ?, ?)`,
        [inviterUserId, clickerIp, clickerUa, INVITE_REWARD, Date.now()]
      );

      await connection.execute(
        `UPDATE users SET negentropy = negentropy + ?, total_negentropy_generated = total_negentropy_generated + ?, updated_at = ? WHERE user_id = ?`,
        [INVITE_REWARD, INVITE_REWARD, Date.now(), inviterUserId]
      );

      await connection.commit();
      res.json({ success: true, rewarded: true, reward: INVITE_REWARD });
    } catch (err: any) {
      await connection.rollback();
      throw err;
    } finally {
      connection.release();
    }
  } catch (error: any) {
    console.error("Error recording invite click:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/invite/stats/:userId — Get inviter statistics
app.get("/api/invite/stats/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const [rows] = await pool.execute(
      `SELECT COUNT(*) as totalClicks, COALESCE(SUM(reward), 0) as totalReward
       FROM invite_clicks WHERE inviter_user_id = ?`,
      [userId]
    );
    const stats = (rows as any[])[0] || { totalClicks: 0, totalReward: 0 };

    res.json({
      success: true,
      totalClicks: stats.totalClicks,
      totalReward: stats.totalReward,
      rewardPerClick: INVITE_REWARD,
    });
  } catch (error: any) {
    console.error("Error fetching invite stats:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== ENTROPY STATE SYNC ====================

// POST /api/entropy/sync - Sync user entropy/negentropy state to users table
app.post("/api/entropy/sync", async (req, res) => {
  try {
    const {
      userId,
      entropy,
      negentropy,
      totalNegentropyGenerated,
      lastActiveDate,
    } = req.body;

    if (!userId) {
      res.status(400).json({ success: false, error: "Missing userId" });
      return;
    }

    await pool.execute(
      `UPDATE users SET
        entropy = ?,
        negentropy = ?,
        total_negentropy_generated = ?,
        last_active_date = ?,
        updated_at = ?
       WHERE user_id = ?`,
      [
        entropy || 0,
        negentropy || 0,
        totalNegentropyGenerated || 0,
        lastActiveDate || null,
        Date.now(),
        userId,
      ]
    );

    res.json({ success: true });
  } catch (error: any) {
    console.error("Error syncing entropy state:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/entropy/state/:userId - Fetch user entropy state
app.get("/api/entropy/state/:userId", async (req, res) => {
  try {
    const { userId } = req.params;

    const [rows] = await pool.execute(
      `SELECT user_id as userId, entropy, negentropy,
              total_negentropy_generated as totalNegentropyGenerated,
              last_active_date as lastActiveDate
       FROM users
       WHERE user_id = ?
       LIMIT 1`,
      [userId]
    );

    const records = rows as any[];
    if (records.length > 0) {
      res.json({ success: true, state: records[0] });
    } else {
      res.json({ success: false, error: "User not found" });
    }
  } catch (error: any) {
    console.error("Error fetching entropy state:", error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== STATIC FILES (Production) ====================

// Static files — serve built frontend from dist/ (production)
const distPath = path.join(__dirname, "dist");
app.use(express.static(distPath));

// SPA fallback — match paths without file extensions (real page routes, not assets)
// Pattern copied from chigua/Poetica-6
app.get(/^\/(?!.*\.[a-z0-9]+$).*$/, (_req, res) => {
  res.sendFile(path.join(distPath, "index.html"), (err) => {
    if (err) {
      // dist/ doesn't exist (dev mode) — serve 404 JSON
      res.status(404).json({ error: "Not found" });
    }
  });
});

app.listen(PORT, () => {
  console.log(`Grid Game API server running on http://localhost:${PORT}`);
});
