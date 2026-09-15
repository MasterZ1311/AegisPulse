import React, { useState } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  KeyRound,
  User,
  Lock,
  LogOut,
  X,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';

interface AdminAuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  isAdmin: boolean;
  currentAdmin: { username: string; fullName: string } | null;
  onLoginSuccess: (admin: { username: string; fullName: string; token: string }) => void;
  onLogout: () => void;
}

export const AdminAuthModal: React.FC<AdminAuthModalProps> = ({
  isOpen,
  onClose,
  isAdmin,
  currentAdmin,
  onLoginSuccess,
  onLogout,
}) => {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('AdminPass123!');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleFillMockAdmin = () => {
    setUsername('admin');
    setPassword('AdminPass123!');
    setErrorMsg(null);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      // 1. Attempt API login
      const res = await fetch('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (res.ok) {
        const body = await res.json();
        const token = body.data?.accessToken || 'admin-token';
        const user = body.data?.user || {
          username: 'admin',
          fullName: 'Aegis System Administrator',
          role: 'ADMIN',
        };

        if (user.role !== 'ADMIN') {
          setErrorMsg(`User role '${user.role}' does not have Administrator privileges.`);
          setIsLoading(false);
          return;
        }

        localStorage.setItem('aegis-admin-token', token);
        localStorage.setItem('aegis-admin-user', JSON.stringify(user));
        setSuccessMsg(`Welcome, ${user.fullName}`);
        setTimeout(() => {
          onLoginSuccess({ username: user.username, fullName: user.fullName, token });
          onClose();
        }, 500);
      } else {
        // Fallback for standalone/dev testing: check mock credentials directly
        if ((username === 'admin' || username === 'administrator') && password === 'AdminPass123!') {
          const mockAdmin = {
            username: 'admin',
            fullName: 'Aegis System Administrator',
            token: 'admin-token',
          };
          localStorage.setItem('aegis-admin-token', mockAdmin.token);
          localStorage.setItem('aegis-admin-user', JSON.stringify(mockAdmin));
          setSuccessMsg('Admin credentials verified (Dev Mode)');
          setTimeout(() => {
            onLoginSuccess(mockAdmin);
            onClose();
          }, 500);
        } else {
          const errData = await res.json().catch(() => ({}));
          setErrorMsg(errData.detail || 'Invalid admin username or password.');
        }
      }
    } catch {
      // Offline fallback for local dev
      if ((username === 'admin' || username === 'administrator') && password === 'AdminPass123!') {
        const mockAdmin = {
          username: 'admin',
          fullName: 'Aegis System Administrator',
          token: 'admin-token',
        };
        localStorage.setItem('aegis-admin-token', mockAdmin.token);
        localStorage.setItem('aegis-admin-user', JSON.stringify(mockAdmin));
        setSuccessMsg('Admin credentials verified (Offline Session)');
        setTimeout(() => {
          onLoginSuccess(mockAdmin);
          onClose();
        }, 500);
      } else {
        setErrorMsg('Authentication service unavailable. Check connection.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleSignOut = () => {
    localStorage.removeItem('aegis-admin-token');
    localStorage.removeItem('aegis-admin-user');
    onLogout();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/70 backdrop-blur-md animate-in fade-in duration-200">
      <div className="relative w-full max-w-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/10 dark:bg-amber-400/10 text-amber-600 dark:text-amber-400">
              <ShieldAlert className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-white text-base">
                Admin Access & Authentication
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Patient Census CRUD & Jurisdiction Control
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {isAdmin ? (
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                <div>
                  <h4 className="text-sm font-bold text-emerald-900 dark:text-emerald-200">
                    Administrator Session Active
                  </h4>
                  <p className="text-xs text-emerald-700 dark:text-emerald-400 mt-1">
                    Logged in as <span className="font-bold">{currentAdmin?.fullName}</span> (@{currentAdmin?.username}). Full hospital-wide patient CRUD permissions granted.
                  </p>
                </div>
              </div>

              <div className="p-3 bg-slate-50 dark:bg-slate-800/50 rounded-2xl border border-slate-100 dark:border-slate-800 text-xs space-y-1.5 font-mono text-slate-600 dark:text-slate-300">
                <div className="flex justify-between">
                  <span className="text-slate-400">ROLE:</span>
                  <span className="font-bold text-amber-600 dark:text-amber-400">ADMIN</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">JURISDICTION:</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">* (All Wards)</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">ACTIONS:</span>
                  <span className="font-semibold text-slate-700 dark:text-slate-200">Admit, Edit, Discharge</span>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  variant="outline"
                  onClick={onClose}
                  className="w-1/2 font-semibold"
                >
                  Close
                </Button>
                <Button
                  variant="destructive"
                  onClick={handleSignOut}
                  className="w-1/2 gap-2 font-semibold"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </Button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleLogin} className="space-y-4">
              {/* Credentials helper card */}
              <div className="p-3.5 rounded-2xl bg-amber-500/10 dark:bg-amber-400/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 space-y-2">
                <div className="flex items-center gap-2 font-bold text-amber-900 dark:text-amber-200">
                  <KeyRound className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                  Mock Admin Credentials
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono bg-white/60 dark:bg-slate-900/60 p-2.5 rounded-xl border border-amber-500/15">
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Username: </span>
                    <span className="font-bold text-slate-800 dark:text-slate-100">admin</span>
                  </div>
                  <div>
                    <span className="text-slate-500 dark:text-slate-400">Password: </span>
                    <span className="font-bold text-slate-800 dark:text-slate-100">AdminPass123!</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleFillMockAdmin}
                  className="flex items-center gap-1.5 text-xs font-bold text-amber-700 dark:text-amber-300 hover:text-amber-900 dark:hover:text-amber-100 underline decoration-amber-400/50 cursor-pointer transition-colors"
                >
                  <Sparkles className="h-3 w-3" />
                  Auto-fill mock credentials
                </button>
              </div>

              {errorMsg && (
                <div className="p-3 bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 rounded-xl text-xs font-medium text-rose-600 dark:text-rose-300">
                  {errorMsg}
                </div>
              )}

              {successMsg && (
                <div className="p-3 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 rounded-xl text-xs font-medium text-emerald-600 dark:text-emerald-300 flex items-center gap-2">
                  <CheckCircle2 className="h-4 w-4" />
                  {successMsg}
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Username
                </label>
                <div className="relative">
                  <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono text-slate-900 dark:text-white"
                    placeholder="e.g. admin"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full pl-10 pr-3 py-2 text-sm bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-500 font-mono text-slate-900 dark:text-white"
                    placeholder="Enter password"
                    required
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={onClose}
                  className="w-1/2 font-semibold"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-1/2 gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-amber-500 dark:hover:bg-amber-600 dark:text-slate-950 font-bold"
                >
                  <ShieldCheck className="h-4 w-4" />
                  {isLoading ? 'Verifying...' : 'Sign In'}
                </Button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
