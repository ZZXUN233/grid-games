import { ScoreRecord } from './types';

// Backend API base URL
const API_BASE = 'http://localhost:3001/api';

/**
 * Save a score to MySQL via backend API.
 */
export async function saveScoreToFirebase(score: ScoreRecord): Promise<boolean> {
  try {
    const response = await fetch(`${API_BASE}/scores`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(score),
    });
    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('Failed to save score to server:', error);
    return false;
  }
}

/**
 * Fetch top scores for a specific mode & difficulty
 */
export async function fetchTopScoresFromFirebase(
  mode: 'level' | 'free' | 'letter',
  difficulty: string,
  limitCount = 10
): Promise<ScoreRecord[]> {
  try {
    const response = await fetch(
      `${API_BASE}/top-scores/${encodeURIComponent(mode)}/${encodeURIComponent(difficulty)}?limit=${limitCount}`
    );
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch top scores:', error);
    return [];
  }
}

/**
 * Save/replace daily entropy record
 */
export async function saveEntropyRecordToFirebase(
  userId: string,
  nickname: string,
  avatarColor: string,
  avatarEmoji: string,
  date: string,
  negentropy: number
): Promise<boolean> {
  try {
    const id = `${userId}_${date}`;
    const response = await fetch(`${API_BASE}/entropy`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, userId, nickname, avatarColor, avatarEmoji, date, entropyConsumed: negentropy }),
    });
    const data = await response.json();
    return data.success === true;
  } catch (error) {
    console.error('Failed to save entropy record:', error);
    return false;
  }
}

/**
 * Fetch today's entropy leaderboard
 */
export async function fetchTodayEntropyLeaderboard(
  date: string,
  limitCount = 10
): Promise<any[]> {
  try {
    const response = await fetch(
      `${API_BASE}/entropy-leaderboard/${encodeURIComponent(date)}?limit=${limitCount}`
    );
    if (!response.ok) return [];
    return await response.json();
  } catch (error) {
    console.error('Failed to fetch entropy leaderboard:', error);
    return [];
  }
}

/**
 * Fetch feature requests
 */
export async function fetchFeatureRequests(userId: string): Promise<any[]> {
  try {
    const res = await fetch(`${API_BASE}/features?userId=${encodeURIComponent(userId)}`);
    if (!res.ok) return [];
    return await res.json();
  } catch {
    return [];
  }
}

/**
 * Vote for a feature request (consumes negentropy)
 */
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