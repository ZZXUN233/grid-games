export const NICKNAME_PREFIXES = [
  '超级', '专注的', '闪电', '睿智的', '敏捷的', '冷静的',
  '坚毅的', '飞凡的', '幽灵', '无畏的', '星空', '极速',
  '元气', '追光的', '风暴', '深海', '流光', '不羁的'
];

export const NICKNAME_SUFFIXES = [
  '猎豹', '苍鹰', '海豚', '夜莺', '猫咪', '考拉',
  '刺猬', '松鼠', '仓鼠', '大熊猫', '飞鱼', '独角兽',
  '小恐龙', '银狐', '金雕', '雪豹', '萌虎', '树懒'
];

export const AVATAR_COLORS = [
  '#F59E0B', // Amber
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#EF4444', // Red
  '#14B8A6', // Teal
  '#6366F1'  // Indigo
];

export const AVATAR_EMOJIS = [
  '⚡', '🎯', '🦉', '🐱', '🦕', '🦊', '🐼', '🐬',
  '🦁', '🐯', '🐰', '🐨', '🐿️', '🦄', '🌟', '🚀'
];

export function generateRandomProfile() {
  const prefix = NICKNAME_PREFIXES[Math.floor(Math.random() * NICKNAME_PREFIXES.length)];
  const suffix = NICKNAME_SUFFIXES[Math.floor(Math.random() * NICKNAME_SUFFIXES.length)];
  const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
  const emoji = AVATAR_EMOJIS[Math.floor(Math.random() * AVATAR_EMOJIS.length)];
  const uuid = 'user_' + Math.random().toString(36).substring(2, 11);
  const todayStr = new Date().toISOString().split('T')[0];
  
  return {
    userId: uuid,
    nickname: `${prefix}${suffix}`,
    avatarColor: color,
    avatarEmoji: emoji,
    accumulatedEntropy: 0,
    todayEntropyConsumed: 0,
    lastActiveDate: todayStr
  };
}
