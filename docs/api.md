# 格子熵 · Grid Entropy — API 文档

Base URL: `http://localhost:3001/api`

所有请求和响应均为 JSON 格式。

---

## 认证模块

### POST /auth/register — 注册

**请求体：**

```json
{
  "nickname": "闪电猎豹",
  "password": "pass123",
  "avatarColor": "#F59E0B",
  "avatarEmoji": "⚡"
}
```

`avatarColor` 和 `avatarEmoji` 可选。

**响应：**

```json
{
  "success": true,
  "user": {
    "userId": "#rkih9460",
    "nickname": "闪电猎豹",
    "avatarColor": "#F59E0B",
    "avatarEmoji": "⚡"
  }
}
```

`userId` 自动生成为 `#` + 4位小写字母 + 4位数字。

---

### POST /auth/login — 登录

**请求体：**

```json
{
  "userId": "#rkih9460",
  "password": "pass123"
}
```

**响应：**

```json
{
  "success": true,
  "user": {
    "userId": "#rkih9460",
    "nickname": "闪电猎豹",
    "avatarColor": "#64748B",
    "avatarEmoji": "👤"
  }
}
```

---

### POST /auth/change-password — 修改密码

**请求体：**

```json
{
  "userId": "#rkih9460",
  "oldPassword": "pass123",
  "newPassword": "newpwd456"
}
```

---

### POST /auth/update-nickname — 修改昵称

```json
{
  "userId": "#rkih9460",
  "nickname": "超级猎豹"
}
```

---

### POST /auth/update-avatar — 修改头像

```json
{
  "userId": "#rkih9460",
  "avatarColor": "#F59E0B",
  "avatarEmoji": "⚡"
}
```

---

### POST /auth/profile — 获取用户信息

```json
{
  "userId": "#rkih9460"
}
```

响应：

```json
{
  "success": true,
  "user": {
    "userId": "#rkih9460",
    "nickname": "闪电猎豹",
    "avatarColor": "#64748B",
    "avatarEmoji": "👤"
  }
}
```

---

## 游戏成绩

### POST /scores — 保存成绩

```json
{
  "id": "user_schulte_1712345678000",
  "userId": "#rkih9460",
  "nickname": "闪电猎豹",
  "avatarColor": "#F59E0B",
  "avatarEmoji": "⚡",
  "mode": "level",
  "difficulty": "Level 1",
  "time": 5.23,
  "createdAt": 1712345678000
}
```

### GET /top-scores/:mode/:difficulty — 获取排行榜

```
GET /top-scores/level/Level%201?limit=10
```

参数 `:mode` 取值：`level` / `free` / `letter`

---

## 熵系统

### POST /entropy — 保存/更新熵记录

```json
{
  "id": "#rkih9460_2026-06-10",
  "userId": "#rkih9460",
  "nickname": "闪电猎豹",
  "avatarColor": "#F59E0B",
  "avatarEmoji": "⚡",
  "date": "2026-06-10",
  "entropyConsumed": 75
}
```

### GET /entropy-leaderboard/:date — 获取日熵排行榜

```
GET /entropy-leaderboard/2026-06-10?limit=10
```