import React, { useState } from 'react';
import { motion } from 'motion/react';
import { GameTheme } from '../types';
import { registerUser, loginUser, AuthUser } from '../api';
import { LogIn, UserPlus, Eye, EyeOff, X } from 'lucide-react';

interface AuthModalProps {
  theme: GameTheme;
  onSuccess: (user: AuthUser, password?: string) => void;
  onClose?: () => void;
}

export default function AuthModal({ theme, onSuccess, onClose }: AuthModalProps) {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [userId, setUserId] = useState('');
  const [nickname, setNickname] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const isLight = theme.id === 'sepia-light';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (mode === 'register') {
        if (!nickname.trim()) throw new Error('请输入昵称');
  if (nickname.length > 16) throw new Error('昵称不能超过 16 个字符');
        if (password.length < 6) throw new Error('密码至少 6 个字符 ');
        if (password !== confirmPassword) throw new Error('两次密码不一致');

        const result = await registerUser(nickname.trim(), password);
        if (result.success && result.user) {
          onSuccess(result.user, password);
        } else {
          throw new Error(result.error || '注册失败');
        }
      } else {
        if (!userId.trim()) throw new Error('请输入用户 ID');
        if (!password) throw new Error('请输入密码');

        const result = await loginUser(userId.trim(), password);
        if (result.success && result.user) {
          onSuccess(result.user, password);
        } else {
          throw new Error(result.error || '登录失败');
        }
      }
    } catch( err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const inpCls = `w-full px-3 py-2 text-sm rounded-xl border bg-transparent transition-all outline-none ${
    isLight
      ? 'border-[#DFD3C1] text-[#4A3C31] placeholder-[#A39584] focus:border-[#8B5A2B]'
      : 'border-zinc-700 text-white placeholder-zinc-500 focus:border-emerald-500'
  }`;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className={`w-full max-w-md mx-auto rounded-2xl border p-6 shadow-2xl ${theme.card}`}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className={`flex items-center gap-2 mb-5 pb-4 border-b ${isLight ? 'border-[#E1D4C0]' : 'border-zinc-800/60'}`}>
        <div className={`p-2 rounded-xl ${isLight ? 'bg-[#EFEADB]' : 'bg-emerald-500/10'}`}>
          {mode === 'login' ? (
            <LogIn size={18} className={isLight ? 'text-[#8B5A2B]' : 'text-emerald-400'} />
          ) : (
            <UserPlus size={18} className={isLight ? 'text-[#8B5A2B]' : 'text-emerald-400'} />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className={`text-sm font-black ${isLight ? 'text-[#4A3C31]' : 'text-white'}`}>
            {mode === 'login' ? '登录账号' : '注册新账号'}
          </h3>
          <p className={`text-[10px] ${isLight ? 'text-[#6C5E53]' : 'text-zinc-500'}`}>
            {mode === 'login' ? '使用你的用户 ID 和密码登录' : '创建账号以保存你的游戏进度'}
          </p>
        </div>
        {onClose && (
          <button
            onClick={onClose}
            className={`p-1.5 rounded-lg hover:bg-zinc-800/50 text-zinc-500 hover:text-white transition-all cursor-pointer shrink-0`}
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* Error message */}
      {error && (
        <div className={`mb-4 p-2.5 rounded-xl border text-[11px] font-medium ${
          isLight ? 'bg-red-50 border-red-200 text-red-600' : 'bg-red-950/40 border-red-500/40 text-red-400'
        }`}>
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3.5">
        {mode === 'register' ? (
          <div>
            <label className={`text-[10px] font-bold uppercase tracking-wider block mb-1 ${isLight ? 'text-[#6C5E53]' : 'text-zinc-400'}`}>
              昵称
            </label>
            <input
              type="text"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
              placeholder="输入你的游戏昵称"
              className={inpCls}
              maxLength={16}
            />
          </div>
        ) : (
          <div>
            <label className={`text-[10px] font-bold uppercase tracking-wider block mb-1 ${isLight ? 'text-[#6C5E53]' : 'text-zinc-400'}`}>
              用户 ID
            </label>
            <input
              type="text"
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              placeholder="输入你的用户 ID (如 #abc12345)"
              className={inpCls}
            />
          </div>
        )}

        <div>
          <label className={`text-[10px] font-bold uppercase tracking-wider block mb-1 ${isLight ? 'text-[#6C5E53]' : 'text-zinc-400'}`}>
            密码
          </label>
          <div className="relative">
            <input
              type={showPwd ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? '至少 6 位字符' : '输入密码'}
              className={inpCls + ' pr-10'}
              maxLength={32}
            />
            <button
              type="button"
              onClick={() => setShowPwd(!showPwd)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 cursor-pointer"
            >
              {showPwd ? <EyeOff size={15} /> : <Eye size={15} />}
            </button>
          </div>
        </div>

        {mode === 'register' && (
          <div>
            <label className={`text-[10px] font-bold uppercase tracking-wider block mb-1 ${isLight ? 'text-[#6C5E53]' : 'text-zinc-400'}`}>
              确认密码
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="再次输入密码"
              className={inpCls}
              maxLength={32}
            />
          </div>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={loading}
          className={`w-full py-2.5 rounded-xl text-sm font-black transition-all cursor-pointer disabled:opacity-50 active:scale-95 flex items-center justify-center gap-2 ${
            isLight
              ? 'bg-[#8B5A2B] hover:bg-[#A06D3B] text-white'
              : 'bg-emerald-500 hover:bg-emerald-400 text-zinc-950'
          }`}
        >
          {loading ? (
            <span className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              {mode === 'login' ? <LogIn size={15} /> : <UserPlus size={15} />}
              <span>{mode === 'login' ? '登录' : '注册'}</span>
            </>
          )}
        </button>
      </form>

      {/* Toggle mode */}
      <div className="mt-4 pt-3.5 border-t border-zinc-800/40 text-center">
        <button
          onClick={() => { setMode(m => m === 'login' ? 'register' : 'login'); setError(''); }}
          className={`text-[11px] font-bold hover:underline cursor-pointer ${
            isLight ? 'text-[#8B5A2B]' : 'text-emerald-400'
          }`}
        >
          {mode === 'login' ? '没有账号？点击注册' : '已有账号？点击登录'}
        </button>
      </div>

      {/* User ID hint for register mode */}
      {mode === 'register' && (
        <div className={`mt-3 p-2.5 rounded-xl border text-[10px] leading-relaxed ${
          isLight
            ? 'bg-[#FAF6EE] border-[#E1D4C0] text-[#6C5E53]'
            : 'bg-zinc-900/40 border-zinc-800/40 text-zinc-400'
        }`}>
          <strong className={isLight ? 'text-[#8B5A2B]' : 'text-amber-400'}>提示：</strong>
          注册后系统会自动生成一个唯一用户 ID（格式如 #abc12345），
          请务必牢记你的用户 ID 和密码，用于后续登录。
        </div>
      )}
    </motion.div>
  );
}