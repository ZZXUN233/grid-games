import { ScoreRecord } from './types';

const API_BASE = '/api';

/** SHA-256 hash — client-side password hashing before network transmission */
export async function sha256(message: string): Promise<string> {
  const msgBuffer = new TextEncoder().encode(message);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// ==================== AUTH ====================

export interface AuthUser {
  userId: string;
  nickname: string;
  avatarColor: string;
  avatarEmoji: string;
  entropy?: number;
  negentropy?: number;
  totalNegentropyGenerated?: number;
  lastActiveDate?: string;
}

export async function registerUser(
  nickname: string,
  password: string,
  avatarColor?: string,
  avatarEmoji?: string
): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ nickname, password, avatarColor, avatarEmoji }),
    });
    return await res.json();
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function loginUser(
  userId: string,
  password: string
): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, password }),
    });
    return await res.json();
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function changePassword(
  userId: string,
  oldPassword: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, oldPassword, newPassword }),
    });
    return await res.json();
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateNickname(
  userId: string,
  nickname: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/auth/update-nickname`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, nickname }),
    });
    return await res.json();
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function updateAvatar(
  userId: string,
  avatarColor: string,
  avatarEmoji: string
): Promise<{ success: boolean; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/auth/update-avatar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, avatarColor, avatarEmoji }),
    });
    return await res.json();
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

export async function fetchProfile(
  userId: string
): Promise<{ success: boolean; user?: AuthUser; error?: string }> {
  try {
    const res = await fetch(`${API_BASE}/auth/profile`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    return await res.json();
  } catch (error: any) {
    return { success: false, error: error.message };
  }
}

// ==================== SCORES ====================

export async function saveScore(score: ScoreRecord): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(score),
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

// Unified game leaderboard — fetch top scores by game type
export async function fetchGameScores(
  game: string,
  difficulty?: string,
  limitCount = 10
): Promise<ScoreRecord[]> {
  try {
    const params = new URLSearchParams({ limit: String(limitCount) });
    if (difficulty) params.set('difficulty', difficulty);
    const res = await fetch(`${API_BASE}/scores/game/${encodeURIComponent(game)}?${params}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function fetchTopScores(
  mode: string,
  difficulty: string,
  limitCount = 10
): Promise<ScoreRecord[]> {
  try {
    const res = await fetch(
      `${API_BASE}/top-scores/${encodeURIComponent(mode)}/${encodeURIComponent(difficulty)}?limit=${limitCount}`
    );
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

// ==================== ENTROPY ====================

export async function saveEntropyRecord(
  userId: string,
  nickname: string,
  avatarColor: string,
  avatarEmoji: string,
  date: string,
  negentropy: number
): Promise<boolean> {
  try {
    const id = `${userId}_${date}`;
    const res = await fetch(`${API_BASE}/entropy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, userId, nickname, avatarColor, avatarEmoji, date, entropyConsumed: negentropy }),
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}

export async function fetchTodayEntropyLeaderboard(
  date: string,
  limitCount = 10
): Promise<any[]> {
  try {
    const res = await fetch(
      `${API_BASE}/entropy-leaderboard/${encodeURIComponent(date)}?limit=${limitCount}`
    );
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

// ==================== FEATURE REQUESTS ====================

export async function fetchFeatureRequests(userId: string): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE}/features?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

export async function voteFeatureRequest(
  featureId: number,
  userId: string,
  negentropySpent: number
): Promise<boolean> {
  try {
    const res = await fetch(`${API_BASE}/features/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ featureId, userId, negentropySpent }),
    });
    const data = await res.json();
    return data.success === true;
  } catch {
    return false;
  }
}