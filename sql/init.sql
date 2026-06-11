-- Grid Game (格子熵) 数据库初始化脚本
-- Database: test_db
-- 执行: mysql -u root -p test_db < sql/init.sql

-- ==================== 用户表 ====================
CREATE TABLE IF NOT EXISTS `users` (
  `user_id` varchar(16) NOT NULL COMMENT '用户ID，格式 #xxxx9999',
  `nickname` varchar(16) NOT NULL COMMENT '昵称',
  `avatar_color` varchar(7) NOT NULL DEFAULT '#64748B' COMMENT '头像背景色 Hex',
  `avatar_emoji` varchar(8) NOT NULL DEFAULT '👤' COMMENT '头像表情',
  `password_hash` varchar(128) NOT NULL COMMENT 'bcrypt 加密密码',
  `entropy` int NOT NULL DEFAULT '0' COMMENT '当前混沌熵值',
  `negentropy` int NOT NULL DEFAULT '0' COMMENT '当前负熵余额',
  `total_negentropy_generated` int NOT NULL DEFAULT '0' COMMENT '累计产生负熵总量',
  `last_active_date` varchar(10) DEFAULT NULL COMMENT '最后活跃日期 YYYY-MM-DD',
  `created_at` bigint NOT NULL COMMENT '注册时间戳',
  `updated_at` bigint NOT NULL COMMENT '更新时间戳',
  PRIMARY KEY (`user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='用户账号表';


-- ==================== 成绩表 ====================
CREATE TABLE IF NOT EXISTS `scores` (
  `id` varchar(64) NOT NULL COMMENT '记录ID',
  `user_id` varchar(64) NOT NULL COMMENT '用户ID',
  `nickname` varchar(32) NOT NULL COMMENT '玩家昵称',
  `avatar_color` varchar(7) NOT NULL DEFAULT '#64748B' COMMENT '头像颜色',
  `avatar_emoji` varchar(8) NOT NULL DEFAULT '👤' COMMENT '头像表情',
  `mode` varchar(16) NOT NULL COMMENT '模式: level/free/letter',
  `difficulty` varchar(64) NOT NULL COMMENT '难度描述',
  `time_seconds` decimal(10,2) NOT NULL COMMENT '用时(秒)',
  `created_at` bigint NOT NULL COMMENT '创建时间戳',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_mode_difficulty` (`mode`, `difficulty`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='游戏成绩表';


-- ==================== 每日熵排行榜表 ====================
CREATE TABLE IF NOT EXISTS `entropy_leaderboard` (
  `id` varchar(128) NOT NULL COMMENT '记录ID (user_id_date)',
  `user_id` varchar(64) NOT NULL COMMENT '用户ID',
  `nickname` varchar(32) NOT NULL COMMENT '玩家昵称',
  `avatar_color` varchar(7) NOT NULL DEFAULT '#64748B' COMMENT '头像颜色',
  `avatar_emoji` varchar(8) NOT NULL DEFAULT '👤' COMMENT '头像表情',
  `date` varchar(10) NOT NULL COMMENT '日期 YYYY-MM-DD',
  `entropy_consumed` int NOT NULL DEFAULT '0' COMMENT '当日消解负熵值',
  `updated_at` bigint NOT NULL COMMENT '更新时间戳',
  PRIMARY KEY (`id`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_date` (`date`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='每日熵排行榜表';


-- ==================== 需求清单表 ====================
CREATE TABLE IF NOT EXISTS `feature_requests` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '需求ID',
  `title` varchar(64) NOT NULL COMMENT '需求标题',
  `description` text COMMENT '需求描述',
  `type` varchar(16) NOT NULL COMMENT '内置类型: theme/difficulty/leaderboard/effect/game_mode/avatar/custom',
  `cost` int NOT NULL DEFAULT 30 COMMENT '消耗负熵值',
  `votes` int NOT NULL DEFAULT 0 COMMENT '总投票数(呼声)',
  `status` varchar(16) NOT NULL DEFAULT 'pending' COMMENT '状态: pending/in_progress/done/rejected',
  `created_at` bigint NOT NULL COMMENT '创建时间戳',
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='需求清单表 (用户消耗负熵投票投需求)';


-- ==================== 需求投票记录表 ====================
CREATE TABLE IF NOT EXISTS `feature_votes` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '投票ID',
  `feature_id` int NOT NULL COMMENT '需求ID',
  `user_id` varchar(64) NOT NULL COMMENT '用户ID',
  `negentropy_spent` int NOT NULL COMMENT '消耗的负熵量',
  `created_at` bigint NOT NULL COMMENT '创建时间戳',
  PRIMARY KEY (`id`),
  UNIQUE KEY `idx_user_feature` (`user_id`, `feature_id`),
  KEY `idx_feature_id` (`feature_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='需求投票记录表';


-- ==================== 初始预置需求 ====================
INSERT IGNORE INTO `feature_requests` (`id`, `title`, `description`, `type`, `cost`, `votes`, `status`, `created_at`) VALUES
(1, '新视觉主题包', '解锁一套全新的视觉主题配色与背景', 'theme', 30, 0, 'pending', UNIX_TIMESTAMP() * 1000),
(2, '新增游戏高难度模式', '为某个游戏解锁更高难度的挑战模式', 'difficulty', 50, 0, 'pending', UNIX_TIMESTAMP() * 1000),
(3, '排行榜周榜/月榜', '扩展排行榜为周度和月度排名', 'leaderboard', 40, 0, 'pending', UNIX_TIMESTAMP() * 1000),
(4, '游戏内连击特效', '解锁操作时的粒子特效与连击动画', 'effect', 25, 0, 'pending', UNIX_TIMESTAMP() * 1000),
(5, '全新游戏模式', '为已有游戏增加一种全新玩法模式', 'game_mode', 80, 0, 'pending', UNIX_TIMESTAMP() * 1000),
(6, '自定义头像框', '更多个性化头像框样式选择', 'avatar', 20, 0, 'pending', UNIX_TIMESTAMP() * 1000);


-- ==================== 邀请追踪表 ====================
CREATE TABLE IF NOT EXISTS `invite_clicks` (
  `id` int NOT NULL AUTO_INCREMENT COMMENT '点击ID',
  `inviter_user_id` varchar(16) NOT NULL COMMENT '邀请者用户ID',
  `clicker_ip` varchar(45) NOT NULL COMMENT '点击者IP（24h去重）',
  `reward` int NOT NULL DEFAULT 5 COMMENT '本次奖励负熵值',
  `created_at` bigint NOT NULL COMMENT '点击时间戳',
  PRIMARY KEY (`id`),
  KEY `idx_inviter` (`inviter_user_id`),
  KEY `idx_ip_time` (`inviter_user_id`, `clicker_ip`, `created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='邀请点击追踪表（24h同IP去重，每次点击奖励负熵5）';

-- ==================== 迁移脚本 (已有数据库升级) ====================
-- 如果 users 表缺少熵字段，执行以下 ALTER
ALTER TABLE `users`
  ADD COLUMN IF NOT EXISTS `entropy` int NOT NULL DEFAULT '0' COMMENT '当前混沌熵值' AFTER `password_hash`,
  ADD COLUMN IF NOT EXISTS `negentropy` int NOT NULL DEFAULT '0' COMMENT '当前负熵余额' AFTER `entropy`,
  ADD COLUMN IF NOT EXISTS `total_negentropy_generated` int NOT NULL DEFAULT '0' COMMENT '累计产生负熵总量' AFTER `negentropy`,
  ADD COLUMN IF NOT EXISTS `last_active_date` varchar(10) DEFAULT NULL COMMENT '最后活跃日期 YYYY-MM-DD' AFTER `total_negentropy_generated`;