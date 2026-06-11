# 认证系统改造方案：微信登录 + JWT Token 会话管理

> 针对 Grid Entropy (格子熵) 项目的认证系统重构

---

## 1. 现状与问题

### 1.1 当前架构

```
浏览器 localStorage
  ├── gridgame_auth_session: { userId, password }   ← 从未写入（onSuccess 回调 BUG）
  ├── schulte_profile: UserProfile                    ← 熵数据（仅存本地）
  └── schulte_local_scores: ScoreRecord[]

API 请求: 仅靠 userId 标识身份，无 Token、无签名
```

### 1.2 存在问题

| # | 问题 | 严重性 | 说明 |
|---|------|--------|------|
| 1 | **无真实登录态** | 高 | AuthModal 的 `onSuccess` 未传递 password，`gridgame_auth_session` 从未被写入，session restore 路径实际不生效 |
| 2 | **无 Token 认证** | 高 | 所有 API 仅靠 `userId` 标识，知道他人 userId 即可越权操作 |
| 3 | **不支持 OAuth** | 中 | 无法接入微信等第三方登录 |
| 4 | **密码存 localStorage** | 中 | 即使修复 session，也是明文存 password |
| 5 | **熵状态仅存前端** | 中 | 切换设备/清缓存丢失所有熵数据 |

---

## 2. 目标架构

```
┌─────────────────┐      JWT Token       ┌──────────────┐      SQL       ┌─────────┐
│  前端 (React)   │ ──────────────────→   │  Express API  │ ───────────→  │  MySQL  │
│  localStorage:  │ ←──────────────────   │   (server.ts) │               │         │
│  • access_token │   Bearer <token>      │               │               │  users  │
│  • refresh_token│                       │  中间件:      │               │   ...   │
│                 │                       │  verifyToken  │               └─────────┘
└─────────────────┘                       └──────────────┘
```

### 2.1 核心变化

- 登录/注册返回 `{ user, accessToken, refreshToken }`
- 所有 API 请求带 `Authorization: Bearer <token>` 头
- `verifyToken` 中间件保护需要认证的端点
- 熵数据以服务端为主、本地做乐观更新

---

## 3. 分阶段实施

### Phase 1: JWT Token 认证（预计 1-2 天）

#### 3.1.1 后端改造 (`server.ts`)

**新增依赖**

```bash
npm install jsonwebtoken
npm install -D @types/jsonwebtoken
```

**环境变量（开发环境默认值，生产环境从环境变量读取）**

| 变量 | 默认值 | 说明 |
|------|--------|------|
| `JWT_SECRET` | `dev-jwt-secret-gridgame-2026` | accessToken 签名密钥 |
| `JWT_REFRESH_SECRET` | `dev-refresh-secret-gridgame-2026` | refreshToken 签名密钥 |
| `ACCESS_TOKEN_EXPIRY` | `15m` | accessToken 有效期 |
| `REFRESH_TOKEN_EXPIRY` | `7d` | refreshToken 有效期 |

**新增工具函数**

```typescript
// server.ts 顶部
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'dev-jwt-secret-gridgame-2026';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-gridgame-2026';
const ACCESS_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || '15m';
const REFRESH_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d';

function generateAccessToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: ACCESS_EXPIRY });
}

function generateRefreshToken(userId: string): string {
  return jwt.sign({ userId, type: 'refresh' }, JWT_REFRESH_SECRET, { expiresIn: REFRESH_EXPIRY });
}
```

**新增 verifyToken 中间件**

```typescript
function verifyToken(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ success: false, error: '未提供认证令牌' });
    return;
  }
  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    (req as any).userId = decoded.userId;
    next();
  } catch {
    res.status(401).json({ success: false, error: '令牌无效或已过期' });
  }
}
```

**改造现有端点**

- `POST /api/auth/login` → 成功时额外返回 `{ accessToken, refreshToken }`
- `POST /api/auth/register` → 成功时额外返回 `{ accessToken, refreshToken }`

**新增端点**

- `POST /api/auth/refresh-token`
  - 输入: `{ refreshToken }`
  - 逻辑: 验证 refreshToken → 生成新 accessToken → 返回
  - 可选: refreshToken 轮换（每次刷新同时发新 refreshToken，旧失效）

- `POST /api/auth/logout`
  - 输入: `{ refreshToken }`
  - 逻辑: 将 refreshToken 加入黑名单/删除

**中间件保护**

用 `verifyToken` 保护以下端点：

| 端点 | 当前状态 | 改造后 |
|------|----------|--------|
| POST /api/auth/update-nickname | 仅靠 userId | 需要 JWT |
| POST /api/auth/update-avatar | 仅靠 userId | 需要 JWT |
| POST /api/auth/change-password | 仅靠 userId + 密码 | 需要 JWT |
| POST /api/scores | 无校验 | 需要 JWT |
| POST /api/features/vote | 无校验 | 需要 JWT |
| POST /api/entropy/sync | 无校验 | 需要 JWT |

**数据库 — refresh_tokens 表**

```sql
CREATE TABLE IF NOT EXISTS `refresh_tokens` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` varchar(16) NOT NULL,
  `token_hash` varchar(128) NOT NULL COMMENT 'refreshToken 的 SHA256 哈希',
  `expires_at` bigint NOT NULL,
  `created_at` bigint NOT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_token_hash` (`token_hash`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

#### 3.1.2 前端改造

**`api.ts` — 封装认证请求**

```typescript
// 新增类型
export interface AuthResult {
  success: boolean;
  user?: AuthUser;
  accessToken?: string;
  refreshToken?: string;
  error?: string;
}

// Token 管理
const TOKEN_KEYS = {
  access: 'gridgame_access_token',
  refresh: 'gridgame_refresh_token',
};

export function getAccessToken(): string | null {
  return localStorage.getItem(TOKEN_KEYS.access);
}

export function saveTokens(accessToken: string, refreshToken: string) {
  localStorage.setItem(TOKEN_KEYS.access, accessToken);
  localStorage.setItem(TOKEN_KEYS.refresh, refreshToken);
}

export function clearTokens() {
  localStorage.removeItem(TOKEN_KEYS.access);
  localStorage.removeItem(TOKEN_KEYS.refresh);
}
```

**`api.ts` — fetchWithAuth 拦截器**

```typescript
let refreshPromise: Promise<boolean> | null = null;

export async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = getAccessToken();
  const headers = {
    ...options.headers,
    'Authorization': `Bearer ${token}`,
  };

  let res = await fetch(url, { ...options, headers });

  // 401 → 尝试刷新 token
  if (res.status === 401 && getAccessToken()) {
    const refreshed = await refreshAccessToken();
    if (refreshed) {
      const newToken = getAccessToken();
      headers['Authorization'] = `Bearer ${newToken}`;
      res = await fetch(url, { ...options, headers });
    } else {
      clearTokens();
      window.location.reload(); // 强制重新登录
    }
  }

  return res;
}

async function refreshAccessToken(): Promise<boolean> {
  // 防止并发重复刷新
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const rt = localStorage.getItem(TOKEN_KEYS.refresh);
    if (!rt) return false;

    try {
      const res = await fetch(`${API_BASE}/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: rt }),
      });
      const data = await res.json();
      if (data.success && data.accessToken) {
        saveTokens(data.accessToken, data.refreshToken || rt);
        return true;
      }
      return false;
    } catch {
      return false;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}
```

**改造现有 API 函数**：`loginUser`、`registerUser` 返回 `AuthResult`（带 token）。其他写操作改用 `fetchWithAuth`。

**`App.tsx` — session restore**

```typescript
// 替换原来 gridgame_auth_session 的恢复逻辑
const accessToken = localStorage.getItem('gridgame_access_token');
const refreshToken = localStorage.getItem('gridgame_refresh_token');

if (accessToken && refreshToken) {
  // 有 token 尝试恢复
  const refreshed = await refreshAccessToken();
  if (refreshed) {
    // 获取用户信息
    const profileRes = await fetchProfile(session.userId);
    // ... 构造 UserProfile
  }
  // 如果 refresh 失败，清除 token → 游客模式
}
```

---

### Phase 2: 微信登录支持（预计 2-3 天）

#### 前提条件

| 资源 | 说明 |
|------|------|
| 微信开放平台账号 | 用于 PC 扫码登录 |
| 或微信公众号/服务号 | 用于 H5 内登录 |
| AppID + AppSecret | 微信应用凭证 |
| 回调域名 | 在微信后台配置 |

#### 3.2.1 数据库变更

```sql
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `wechat_openid` varchar(128) DEFAULT NULL COMMENT '微信 OpenID' AFTER `last_active_date`,
  ADD COLUMN IF NOT EXISTS `wechat_unionid` varchar(128) DEFAULT NULL COMMENT '微信 UnionID' AFTER `wechat_openid`;

ALTER TABLE `users`
  ADD UNIQUE KEY `uk_wechat_openid` (`wechat_openid`);
```

#### 3.2.2 后端新增端点

**微信登录 `POST /api/auth/wechat/login`**

```
输入: { code: string }
流程:
  1. 用 code 调微信接口换取 openid + session_key
     GET https://api.weixin.qq.com/sns/jscode2session
       ?appid=APPID&secret=SECRET&js_code=CODE&grant_type=authorization_code
  2. 根据 openid 查 users 表
     - 存在 → 返回 JWT
     - 不存在 → 自动创建用户（生成 userId，后期可补全昵称/头像）
  3. 返回 { success, user, accessToken, refreshToken }
```

**绑定微信 `POST /api/auth/bind-wechat`**

```
需要: JWT 认证
输入: { code }
流程:
  1. 验证当前登录用户
  2. 用 code 换取 openid
  3. 检查 openid 是否已被绑定
  4. 写入 users.wechat_openid
```

**解绑微信 `POST /api/auth/unbind-wechat`**

```
需要: JWT 认证
输入: 无（从 token 取 userId）
流程: users.wechat_openid = NULL
```

#### 3.2.3 前端改造

**AuthModal 新增微信入口**

```tsx
// 在登录表单下方
<button onClick={handleWechatLogin} className="...">
  {/* 微信图标 */}
  微信登录
</button>
```

**微信 OAuth 流程**

```
PC 端（扫码）:
  1. 点击「微信登录」→ 显示二维码弹窗
  2. 后端生成临时 ticket → 返回二维码 URL
  3. 前端轮询/ticket/status → 用户扫码后获取 code
  4. 调 /api/auth/wechat/login → 获取 JWT

H5 端（公众号内）:
  1. 点击「微信登录」→ 跳转微信 OAuth 授权页
  2. 授权后回跳到 redirect_uri?code=CODE
  3. 前端解析 URL 中的 code → 调 /api/auth/wechat/login
  4. 获取 JWT → 保存 → 跳转首页
```

---

### Phase 3: 登录态维护与优化（预计 1 天）

#### 3.3.1 Token 自动刷新

- `fetchWithAuth()` 请求前检查 accessToken 是否过期
- 过期 = `refreshAccessToken()` 自动续期
- refreshToken 过期 = 清除 token → 降级为游客
- 请求锁防止并发重复刷新

#### 3.3.2 熵状态云端同步

**登录恢复**：

```
App.tsx mount
  → 检查 localStorage 有 token
  → refreshAccessToken() 恢复登录态
  → GET /api/entropy/state/:userId
  → 用服务端熵数据覆盖本地
  → 如果有多日未登录，本地计算熵增后 POST 回服务端
```

**实时同步**：

```
consumeEntropy(points)
  → 更新本地 UserProfile 状态（乐观更新）
  → 异步 POST /api/entropy/sync { entropy, negentropy, totalNegentropyGenerated, lastActiveDate }
  → 同时 POST /api/entropy 更新熵排行榜
```

#### 3.3.3 AuthModal 修复

- `onSuccess` 回调改为传 `AuthResult`（含 token），不再传 password
- 注册流程增加头像选择步骤（avatarColor + avatarEmoji）

---

## 4. 关键文件清单

| 文件 | 改动类型 | 涉及 Phase |
|------|----------|-----------|
| `server.ts` | 新增 JWT 工具函数 + 中间件 + 微信/refresh/logout 端点 | P1, P2 |
| `src/api.ts` | 封装 `fetchWithAuth()` 拦截器，新增微信登录接口 | P1, P2 |
| `src/App.tsx` | session restore 改为 token 恢复，熵数据同步 | P1, P3 |
| `src/components/AuthModal.tsx` | 新增微信登录按钮，修复 onSuccess 回调 | P1, P2 |
| `src/types.ts` | 新增 `AuthResult`、`AuthTokens` 类型 | P1 |
| `sql/init.sql` | users 表新增 wechat 字段；新增 refresh_tokens 表 | P1, P2 |
| `package.json` | 新增 `jsonwebtoken` 依赖 | P1 |

---

## 5. 安全注意事项

| 注意点 | 措施 |
|--------|------|
| JWT 密钥 | 生产环境从环境变量读取，不硬编码 |
| refreshToken 轮换 | 每次 refresh 生成新 refreshToken，旧作废 |
| 微信 session_key | 只服务端使用，不传给前端 |
| 越权防护 | 敏感端点必须 JWT 认证 + 校验 userId 匹配 |
| 密码安全 | 登录后不再存任何密码到 localStorage |
| 暴力破解 | 添加 express-rate-limit 限制登录频率 |

---

## 6. 验证方案

| 测试项 | 方法 | 预期结果 |
|--------|------|----------|
| JWT 认证 | login → 获取 token → 带 token 调 profile | 返回正确用户 |
| Token 过期 | 使用过期 accessToken 调接口 | 返回 401 → 自动 refresh → 成功 |
| 无 Token 访问 | 不带 Authorization 头调受保护端点 | 返回 401 |
| Session 恢复 | 登录后刷新页面 | 自动恢复登录态，无需重新输入密码 |
| 微信登录 | （需真实 AppID 方可端到端） | 扫码/授权后自动注册/登录 |
| 熵数据同步 | 登录后检查熵数值 | 与服务端一致，跨设备恢复正常 |