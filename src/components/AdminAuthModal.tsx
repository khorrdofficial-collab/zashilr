import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Lock, ShieldCheck, X } from 'lucide-react';
import {
  loginAdmin,
  setupAdminAccount,
  type AuthStatusResponse,
} from '../utils/api';

interface AdminAuthModalProps {
  authStatus: AuthStatusResponse;
  onClose: () => void;
  onAuthenticated: (session: { token: string; username: string }) => void;
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({
  authStatus,
  onClose,
  onAuthenticated,
}) => {
  const isFirstRunSetup = !authStatus.configured;
  const [username, setUsername] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [confirmPassword, setConfirmPassword] = useState<string>('');
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanUser = username.trim();
    if (!cleanUser || !password) {
      setError('Please enter both username and password.');
      return;
    }

    if (isFirstRunSetup) {
      if (cleanUser.length < 2) {
        setError('Username must be at least 2 characters.');
        return;
      }
      if (password.length < 4) {
        setError('Password must be at least 4 characters.');
        return;
      }
      if (password !== confirmPassword) {
        setError('Passwords do not match.');
        return;
      }
    }

    setSubmitting(true);
    setError(null);
    try {
      const result = isFirstRunSetup
        ? await setupAdminAccount(cleanUser, password)
        : await loginAdmin(cleanUser, password);
      onAuthenticated(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Authentication failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      aria-labelledby="admin-auth-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-md bg-white dark:bg-[#171A1F] border border-[#E2E5EC] dark:border-[#2A2F3A] rounded-2xl shadow-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-[#ECEFF4] dark:border-[#262A32] flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-[#16A34A]/15 text-[#16A34A] dark:text-[#22C55E] flex items-center justify-center shrink-0">
              {isFirstRunSetup ? (
                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
              ) : (
                <Lock className="w-4 h-4" aria-hidden="true" />
              )}
            </div>
            <div>
              <h2
                id="admin-auth-title"
                className="text-base font-bold text-[#111318] dark:text-white"
              >
                {isFirstRunSetup
                  ? 'Admin Account Setup (Admin သတ်မှတ်ရန်)'
                  : 'Admin Login (Admin ဝင်ရောက်ရန်)'}
              </h2>
              <p className="text-xs text-[#64748B] dark:text-[#94A3B8]">
                {isFirstRunSetup
                  ? 'First-time setup · Claim your admin username & password'
                  : 'Sign in to add teams, arrange fixtures & enter match scores'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close admin login modal"
            className="p-2 rounded-lg text-[#64748B] hover:text-[#111318] dark:hover:text-white hover:bg-[#F1F5F9] dark:hover:bg-[#232832]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {isFirstRunSetup && (
            <div className="p-3 rounded-lg bg-[#F8F9FB] dark:bg-[#12151A] border border-[#E2E5EC] dark:border-[#262A32] text-xs text-[#475569] dark:text-[#CBD5E1] leading-relaxed">
              Set your league admin username and password once. Once claimed, only this admin
              account can add teams, arrange fixtures, or edit match results — everyone else
              opening the link is locked to View-Only mode.
            </div>
          )}

          <div>
            <label
              htmlFor="admin-username"
              className="block text-xs font-semibold text-[#475569] dark:text-[#94A3B8] mb-1.5"
            >
              Username
            </label>
            <input
              id="admin-username"
              type="text"
              autoComplete="username"
              autoFocus
              value={username}
              onChange={(e) => {
                setUsername(e.target.value);
                setError(null);
              }}
              placeholder="Enter admin username"
              className="w-full h-10 px-3.5 text-sm font-medium rounded-lg bg-[#F8F9FB] dark:bg-[#12151A] border border-[#D8DEE9] dark:border-[#2C323E] text-[#111318] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
            />
          </div>

          <div>
            <label
              htmlFor="admin-password"
              className="block text-xs font-semibold text-[#475569] dark:text-[#94A3B8] mb-1.5"
            >
              Password
            </label>
            <div className="relative">
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                autoComplete={isFirstRunSetup ? 'new-password' : 'current-password'}
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError(null);
                }}
                placeholder="Enter admin password"
                className="w-full h-10 pl-3.5 pr-10 text-sm font-medium rounded-lg bg-[#F8F9FB] dark:bg-[#12151A] border border-[#D8DEE9] dark:border-[#2C323E] text-[#111318] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-[#64748B] hover:text-[#111318] dark:hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {isFirstRunSetup && (
            <div>
              <label
                htmlFor="admin-password-confirm"
                className="block text-xs font-semibold text-[#475569] dark:text-[#94A3B8] mb-1.5"
              >
                Confirm Password
              </label>
              <input
                id="admin-password-confirm"
                type={showPassword ? 'text' : 'password'}
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => {
                  setConfirmPassword(e.target.value);
                  setError(null);
                }}
                placeholder="Re-enter admin password"
                className="w-full h-10 px-3.5 text-sm font-medium rounded-lg bg-[#F8F9FB] dark:bg-[#12151A] border border-[#D8DEE9] dark:border-[#2C323E] text-[#111318] dark:text-white focus:outline-none focus:ring-2 focus:ring-[#16A34A]"
              />
            </div>
          )}

          {error && (
            <p className="text-xs font-medium text-[#DC2626] dark:text-[#F87171]" role="alert">
              {error}
            </p>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-3 border-t border-[#ECEFF4] dark:border-[#262A32]">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-[#F1F5F9] dark:bg-[#232832] text-[#334155] dark:text-[#CBD5E1]"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-5 py-2 text-xs font-semibold rounded-lg bg-[#16A34A] text-white hover:bg-[#15803D] disabled:opacity-60 transition-colors"
            >
              {submitting
                ? 'Verifying...'
                : isFirstRunSetup
                ? 'Create Admin & Sign In'
                : 'Sign In'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
