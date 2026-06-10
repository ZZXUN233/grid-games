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