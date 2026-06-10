export interface UserProfile {
  userId: string;
  nickname: string;
  avatarColor: string;
  avatarEmoji: string;
  accumulatedEntropy: number; // accumulated unsolved entropy from past unfinished days
  todayEntropyConsumed: number; // today's generated negative entropy
  lastActiveDate: string; // e.g. "2026-06-09"
}

export interface EntropyRecord {
  id: string; // `userId_date`
  userId: string;
  nickname: string;
  avatarColor: string;
  avatarEmoji: string;
  date: string; // "2026-06-09"
  entropyConsumed: number; // negative entropy produced
  updatedAt?: number;
}

export interface ScoreRecord {
  id: string;
  userId: string;
  nickname: string;
  avatarColor: string;
  avatarEmoji: string;
  mode: 'level' | 'free' | 'letter';
  difficulty: string; // e.g., "Level 1 (3x3)", "5x5", "Alphabet 5x5"
  time: number; // Seconds (e.g. 14.32)
  createdAt: number; // epoch timestamp
}

export interface GameLevel {
  levelNumber: number;
  gridSize: number;
  timeLimit: number | null; // null means infinite time
  description: string;
}

export interface GameTheme {
  id: string;
  name: string;
  bg: string;              // page body bg class
  card: string;            // panel/container bg
  gridItemDefault: string; // default grid button style
  gridItemHover: string;   // grid button hover logic
  gridItemActive: string;  // completed state of grid button
  gridItemWrong: string;   // wrong click effect
  accent: string;          // control button backgrounds
  textMain: string;        // title text color
  textMuted: string;       // minor elements color
  border: string;          // divider lines color
  description: string;
}
