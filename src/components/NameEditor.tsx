import React, { useState } from "react";
import { UserProfile, GameTheme } from "../types";
import {
  AVATAR_COLORS,
  AVATAR_EMOJIS,
  generateRandomProfile,
} from "../data/names";
import { updateNickname, updateAvatar, changePassword, sha256 } from "../api";
import {
  Sparkles,
  Edit2,
  Check,
  RefreshCw,
  Key,
  Eye,
  EyeOff,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

interface NameEditorProps {
  user: UserProfile;
  onChange: (user: UserProfile) => void;
  theme: GameTheme;
}

export default function NameEditor({ user, onChange, theme }: NameEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [nicknameInput, setNicknameInput] = useState(user.nickname);
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showPasswordChanger, setShowPasswordChanger] = useState(false);
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showPwdOld, setShowPwdOld] = useState(false);
  const [showPwdNew, setShowPwdNew] = useState(false);
  const [pwdError, setPwdError] = useState("");
  const [pwdSuccess, setPwdSuccess] = useState("");
  const [pwdLoading, setPwdLoading] = useState(false);
  const [avatarLoading, setAvatarLoading] = useState(false);

  const handleRandomize = async () => {
    const newProfile = generateRandomProfile();
    const updated = { ...newProfile, userId: user.userId };
    onChange(updated);
    setNicknameInput(updated.nickname);
    await updateAvatar(user.userId, updated.avatarColor, updated.avatarEmoji);
  };

  const handleSaveNickname = async () => {
    const trimmed = nicknameInput.trim();
    if (trimmed.length > 0 && trimmed.length <= 16) {
      onChange({ ...user, nickname: trimmed });
      setIsEditing(false);
      await updateNickname(user.userId, trimmed);
    }
  };

  const selectColor = async (color: string) => {
    const updated = { ...user, avatarColor: color };
    onChange(updated);
    setAvatarLoading(true);
    await updateAvatar(user.userId, color, user.avatarEmoji);
    setAvatarLoading(false);
  };

  const selectEmoji = async (emoji: string) => {
    const updated = { ...user, avatarEmoji: emoji };
    onChange(updated);
    setAvatarLoading(true);
    await updateAvatar(user.userId, user.avatarColor, emoji);
    setAvatarLoading(false);
  };

  const handlePasswordChange = async () => {
    setPwdError("");
    setPwdSuccess("");
    if (!oldPassword) {
      setPwdError("请输入原密码");
      return;
    }
    if (newPassword.length < 6) {
      setPwdError("新密码至少 6 个字符");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPwdError("两次密码不一致");
      return;
    }

    setPwdLoading(true);
    const hashedOld = await sha256(oldPassword);
    const hashedNew = await sha256(newPassword);
    const result = await changePassword(user.userId, hashedOld, hashedNew);
    setPwdLoading(false);

    if (result.success) {
      setPwdSuccess("密码修改成功");
      setOldPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
    } else {
      setPwdError(result.error || "密码修改失败");
    }
  };

  const inputBase = `w-full px-2.5 py-1.5 text-xs rounded-lg border bg-transparent transition-all outline-none ${
    false
      ? "border-[#DFD3C1] text-[#4A3C31] focus:border-[#8B5A2B]"
      : "border-theme text-white focus:border-emerald-500"
  }`;

  return (
    <div className={`p-4 rounded-xl card-theme transition-all duration-300`}>
      <div className="flex flex-col sm:flex-row items-center gap-4">
        {/* Avatar */}
        <div className="relative group">
          <div
            id="avatar-circle"
            className="w-16 h-16 rounded-full flex items-center justify-center text-3xl font-bold shadow-md cursor-pointer relative overflow-hidden ring-2 ring-transparent group-hover:ring-amber-500/40 transition-all active:scale-95 duration-200"
            style={{ backgroundColor: user.avatarColor }}
            onClick={() => setShowColorPicker(!showColorPicker)}
            title="点击更换形象"
          >
            <span className="relative z-10 select-none animate-float">
              {user.avatarEmoji}
            </span>
            <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <span className="text-[10px] text-white font-medium bg-black/60 px-1 rounded">
                更 换
              </span>
            </div>
          </div>
          {avatarLoading && (
            <span className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[8px] text-emerald-400 animate-pulse">
              同步中
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 w-full text-center sm:text-left">
          <div className="flex flex-col justify-center sm:justify-start">
            <span
              className={`text-xs text-muted font-mono tracking-wider mb-0.5`}
            >
              PLAYER ID: {user.userId.toUpperCase()}
            </span>

            <div className="flex items-center justify-center sm:justify-start gap-2 mt-1">
              {isEditing ? (
                <div className="flex items-center gap-2 w-full max-w-xs">
                  <input
                    id="nickname-input"
                    type="text"
                    value={nicknameInput}
                    onChange={(e) => setNicknameInput(e.target.value)}
                    className="flex-1 px-2.5 py-1 text-sm rounded border border-theme bg-zinc-900 text-white focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500"
                    maxLength={16}
                    autoFocus
                    onKeyDown={(e) => e.key === "Enter" && handleSaveNickname()}
                  />
                  <button
                    id="save-nickname-btn"
                    onClick={handleSaveNickname}
                    className="p-1 px-2 rounded bg-emerald-700 hover:bg-emerald-600 text-white transition-all text-xs flex items-center gap-1"
                  >
                    <Check size={14} /> 保存
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 group">
                  <h3 className={`text-lg font-bold text-theme`}>
                    {user.nickname}
                  </h3>
                  <button
                    id="edit-nickname-toggle"
                    onClick={() => {
                      setNicknameInput(user.nickname);
                      setIsEditing(true);
                    }}
                    className={`p-1 rounded-md opacity-30 group-hover:opacity-100 hover:bg-white/10 transition-all text-muted`}
                    title="修改昵称"
                  >
                    <Edit2 size={13} />
                  </button>
                </div>
              )}
            </div>
          </div>

          <p className={`text-xs text-muted mt-1`}>
            点击左侧头像选择配色与图标。修改将自动同步至服务器。
          </p>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            id="random-profile-btn"
            onClick={handleRandomize}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg border border-transparent hover:border-white/10 bg-white/5 active:scale-95 hover:bg-white/10 transition-all text-theme font-medium`}
            title="随机摇号新形象"
          >
            <RefreshCw size={13} className="animate-spin-slow" />
            <span>随机摇号</span>
          </button>
        </div>
      </div>

      {/* Avatar colors & emojis */}
      <AnimatePresence>
        {showColorPicker && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className={`mt-4 pt-4 border-t border-theme overflow-hidden`}
          >
            <div>
              <span className={`text-xs text-muted block mb-1.5 font-medium`}>
                选择头像底色:
              </span>
              <div className="flex flex-wrap gap-2">
                {AVATAR_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => selectColor(color)}
                    className="w-6 h-6 rounded-full cursor-pointer ring-offset-2 ring-offset-zinc-950 transition-all hover:scale-110 active:scale-95"
                    style={{
                      backgroundColor: color,
                      boxShadow:
                        user.avatarColor === color
                          ? `0 0 0 2px ${color}`
                          : "none",
                    }}
                  />
                ))}
              </div>
            </div>

            <div className="mt-3">
              <span className={`text-xs text-muted block mb-1.5 font-medium`}>
                选择胸章图标:
              </span>
              <div className="flex flex-wrap gap-2">
                {AVATAR_EMOJIS.map((emoji) => (
                  <button
                    key={emoji}
                    onClick={() => selectEmoji(emoji)}
                    className={`w-8 h-8 rounded flex items-center justify-center text-lg cursor-pointer bg-white/5 hover:bg-white/10 active:scale-95 transition-all ${
                      user.avatarEmoji === emoji
                        ? "ring-1 ring-amber-500 bg-white/10"
                        : ""
                    }`}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Password Change Toggle */}
      <div className="mt-4 pt-3 border-t border-theme">
        <button
          onClick={() => {
            setShowPasswordChanger(!showPasswordChanger);
            setPwdError("");
            setPwdSuccess("");
          }}
          className={`flex items-center gap-1.5 text-[11px] font-bold cursor-pointer hover:underline ${"text-emerald-400"}`}
        >
          <Key size={12} />
          <span>{showPasswordChanger ? "收起密码修改" : "修改密码"}</span>
        </button>

        <AnimatePresence>
          {showPasswordChanger && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 space-y-2.5 overflow-hidden"
            >
              {pwdError && (
                <div
                  className={`p-2 rounded-lg border text-[10px] ${"bg-red-950/40 border-red-500/40 text-red-400"}`}
                >
                  {pwdError}
                </div>
              )}
              {pwdSuccess && (
                <div
                  className={`p-2 rounded-lg border text-[10px] ${"bg-emerald-950/40 border-emerald-500/40 text-emerald-400"}`}
                >
                  {pwdSuccess}
                </div>
              )}

              <div className="relative">
                <input
                  type={showPwdOld ? "text" : "password"}
                  value={oldPassword}
                  onChange={(e) => setOldPassword(e.target.value)}
                  placeholder="原密码"
                  className={inputBase + " pr-8"}
                />
                <button
                  type="button"
                  onClick={() => setShowPwdOld(!showPwdOld)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted cursor-pointer"
                >
                  {showPwdOld ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              </div>

              <div className="relative">
                <input
                  type={showPwdNew ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="新密码 (至少 6 位)"
                  className={inputBase + " pr-8"}
                />
                <button
                  type="button"
                  onClick={() => setShowPwdNew(!showPwdNew)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted cursor-pointer"
                >
                  {showPwdNew ? <EyeOff size={12} /> : <Eye size={12} />}
                </button>
              </div>

              <input
                type="password"
                value={confirmNewPassword}
                onChange={(e) => setConfirmNewPassword(e.target.value)}
                placeholder="确认新密码"
                className={inputBase}
              />

              <button
                onClick={handlePasswordChange}
                disabled={pwdLoading}
                className={`w-full py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer disabled:opacity-50 active:scale-95 ${
                  false
                    ? "bg-[#8B5A2B] hover:bg-[#A06D3B] text-white"
                    : "bg-emerald-600 hover:bg-emerald-500 text-white"
                }`}
              >
                {pwdLoading ? "修改中..." : "确认修改密码"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
