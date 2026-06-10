import express from 'express';
import mysql2 from 'mysql2/promise';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const app = express();
app.use(express.json());

// CORS — allow frontend on port 3000
app.use((_req, res, next) => {
  res.header('Access-Control-Allow-Origin', 'http://localhost:3000');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (_req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

const PORT = 3001;

// MySQL connection pool
const pool = mysql2.createPool({
  host: 'localhost',
  port: 3306,
  user: 'root',
  password: 'root123456',
  database: 'test_db',
  waitForConnections: true,
  connectionLimit: 10,
});

// Test connection on startup
pool.getConnection()
  .then(conn => {
    console.log('MySQL connected successfully');
    conn.release();
  })
  .catch(err => {
    console.error('MySQL connection failed:', err.message);
  });

// ==================== HELPER ====================

/** Generate a user ID in format: # + 4 random lowercase letters + 4 random digits */
function generateUserId(): string {
  const letters = crypto.randomBytes(4).toString('hex').slice(0, 4); // 4 hex = letters a-f, fine
  // Ensure we get a-f lowercase
  const letterPart = Array.from({ length: 4 }, () =>
    String.fromCharCode(97 + Math.floor(Math.random() * 26))
  ).join('');
  const digitPart = Array.from({ length: 4 }, () =>
    Math.floor(Math.random() * 10).toString()
  ).join('');
  return `#${letterPart}${digitPart}`;
}

// ==================== USER / AUTH API ====================

// POST /api/auth/register - Register a new user
app.post('/api/auth/register', async (req, res) => {
  try {
    const { nickname, password, avatarColor, avatarEmoji } = req.body;

    if (!nickname || nickname.trim().length === 0 || nickname.length > 16) {
      return res.status(400).json({ success: false, error: '昵称长度需在 1-16 个字符' });
    }
    if (!password || password.length < 6 || password.length > 32) {
      return res.status(400).json({ success: false, error: '密码长度需在 6-32 个字符' });
    }

    // Generate unique user ID (retry on collision)
    let userId = '';
    let attempts = 0;
    while (attempts < 10) {
      userId = generateUserId();
      const [existing] = await pool.execute('SELECT user_id FROM users WHERE user_id = ?', [userId]);
      if ((existing as any[]).length === 0) break;
      attempts++;
    }
    if (attempts >= 10) {
      return res.status(500).json({ success: false, error: '用户 ID 生成失败，请重试' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const now = Date.now();

    await pool.execute(
      `INSERT INTO users (user_id, nickname, avatar_color, avatar_emoji, password_hash, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [userId, nickname.trim(), avatarColor || '#64748B', avatarEmoji || '👤', hashedPassword, now, now]
    );

    res.json({
      success: true,
      user: {
        userId,
        nickname: nickname.trim(),
        avatarColor: avatarColor || '#64748B',
        avatarEmoji: avatarEmoji || '👤',
      }
    });
  } catch (error: any) {
    console.error('Error registering user:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/auth/login - Login with password
app.post('/api/auth/login', async (req, res) => {
  try {
    const { userId, password } = req.body;

    if (!userId || !password) {
      return res.status(400).json({ success: false, error: '请输入用户 ID 和密码' });
    }

    const [rows] = await pool.execute(
      'SELECT user_id, nickname, avatar_color, avatar_emoji, password_hash FROM users WHERE user_id = ?',
      [userId]
    );
    const users = rows as any[];
    if (users.length === 0) {
      return res.status(401).json({ success: false, error: '用户 ID 或密码错误' });
    }

    const user = users[0];
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, error: '用户 ID 或密码错误' });
    }

    res.json({
      success: true,
      user: {
        userId: user.user_id,
        nickname: user.nickname,
        avatarColor: user.avatar_color,
        avatarEmoji: user.avatar_emoji,
      }
    });
  } catch (error: any) {
    console.error('Error logging in:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/auth/change-password - Change password
app.post('/api/auth/change-password', async (req, res) => {
  try {
    const { userId, oldPassword, newPassword } = req.body;

    if (!userId || !oldPassword || !newPassword) {
      return res.status(400).json({ success: false, error: '缺少必要参数' });
    }
    if (newPassword.length < 6 || newPassword.length > 32) {
      return res.status(400).json({ success: false, error: '新密码长度需在 6-32 个字符' });
    }

    const [rows] = await pool.execute(
      'SELECT password_hash FROM users WHERE user_id = ?',
      [userId]
    );
    const users = rows as any[];
    if (users.length === 0) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    const valid = await bcrypt.compare(oldPassword, users[0].password_hash);
    if (!valid) {
      return res.status(401).json({ success: false, error: '原密码错误' });
    }

    const hashed = await bcrypt.hash(newPassword, 10);
    await pool.execute(
      'UPDATE users SET password_hash = ?, updated_at = ? WHERE user_id = ?',
      [hashed, Date.now(), userId]
    );

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error changing password:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/auth/update-nickname - Change nickname
app.post('/api/auth/update-nickname', async (req, res) => {
  try {
    const { userId, nickname } = req.body;

    if (!nickname || nickname.trim().length === 0 || nickname.length > 16) {
      return res.status(400).json({ success: false, error: '昵称长度需在 1-16 个字符' });
    }

    const [result] = await pool.execute(
      'UPDATE users SET nickname = ?, updated_at = ? WHERE user_id = ?',
      [nickname.trim(), Date.now(), userId]
    );

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updaing nickname:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/auth/update-avatar - Change avatar (color + emoji)
app.post('/api/auth/update-avatar', async (req, res) => {
  try {
    const { userId, avatarColor, avatarEmoji } = req.body;

    if (!avatarColor || !avatarEmoji) {
      return res.status(400).json({ success: false, error: '缺少头像参数' });
    }

    await pool.execute(
      'UPDATE users SET avatar_color = ?, avatar_emoji = ?, updated_at = ? WHERE user_id = ?',
      [avatarColor, avatarEmoji, Date.now(), userId]
    );

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error updating avatar:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// POST /api/auth/profile - Fetch user profile by userId (for session restore)
app.post('/api/auth/profile', async (req, res) => {
  try {
    const { userId } = req.body;
    if (!userId) {
      return res.status(400).json({ success: false, error: '缺少用户 ID' });
    }

    const [rows] = await pool.execute(
      'SELECT user_id, nickname, avatar_color, avatar_emoji FROM users WHERE user_id = ?',
      [userId]
    );
    const users = rows as any[];
    if (users.length === 0) {
      return res.status(404).json({ success: false, error: '用户不存在' });
    }

    const user = users[0];
    res.json({
      success: true,
      user: {
        userId: user.user_id,
        nickname: user.nickname,
        avatarColor: user.avatar_color,
        avatarEmoji: user.avatar_emoji,
      }
    });
  } catch (error: any) {
    console.error('Error fetching profile:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ==================== SCORES API ====================

// POST /api/scores - Save a score
app.post('/api/scores', async (req, res) => {
  try {
    const { id, userId, nickname, avatarColor, avatarEmoji, mode, difficulty, time, createdAt } = req.body;

    await pool.execute(
      `INSERT INTO scores (id, user_id, nickname, avatar_color, avatar_emoji, mode, difficulty, time_seconds, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, userId, nickname || avatarColor || '#64748B', avatarEmoji || '👤', mode, difficulty, time, createdAt || Date.now()]
    );

    res.json({ success: true });
  } catch (error: any) {
    if (error.code === 'ER_DUP_ENTRY') {
      return res.json({ success: true });
    }
    console.error('Error saving score:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/top-scores/:mode/:difficulty - Fetch top scores
app.get('/api/top-scores/:mode/:difficulty', async (req, res) => {
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
    console.error('Error fetching top scores:', error.message);
    res.status(500).json([]);
  }
});

// ==================== ENTROPY API ====================

// POST /api/entropy - Save/replace entropy record
app.post('/api/entropy', async (req, res) => {
  try {
    const { id, userId, nickname, avatarColor, avatarEmoji, date, entropyConsumed } = req.body;

    await pool.execute(
      `INSERT INTO entropy_leaderboard (id, user_id, nickname, avatar_color, avatar_emoji, date, entropy_consumed, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
        nickname = VALUES(nickname),
        avatar_color = VALUES(avatar_color),
        avatar_emoji = VALUES(avatar_emoji),
        entropy_consumed = VALUES(entropy_consumed),
        updated_at = VALUES(updated_at)`,
      [id, userId, nickname, avatarColor || '#64748B', avatarEmoji || '👤', date, entropyConsumed, Date.now()]
    );

    res.json({ success: true });
  } catch (error: any) {
    console.error('Error saving entropy:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// GET /api/entropy-leaderboard/:date - Fetch daily entropy leaderboard
app.get('/api/entropy-leaderboard/:date', async (req, res) => {
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
    console.error('Error fetching entropy leaderboard:', error.message);
    res.status(500).json([]);
  }
});

app.listen(PORT, () => {
  console.log(`Grid Game API server running on http://localhost:${PORT}`);
});