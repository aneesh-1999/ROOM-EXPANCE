import React, { useState } from 'react';
import { ShieldCheck, KeyRound, Mail, Lock, Eye, EyeOff, AlertTriangle, ArrowLeft } from 'lucide-react';

interface SecretAdminLoginProps {
  onLoginSuccess: () => void;
  onCancel: () => void;
}

export default function SecretAdminLogin({ onLoginSuccess, onCancel }: SecretAdminLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    // Simulate small latency for realistic security clearance feel
    setTimeout(() => {
      const normalizedEmail = email.trim().toLowerCase();
      if (normalizedEmail === 'work.anishdallakoti@gmail.com' && password === '1234') {
        sessionStorage.setItem('isAdminLoggedIn', 'true');
        onLoginSuccess();
      } else {
        setErrorMsg('❌ Access Denied: Invalid Administrator Credentials.');
        setIsSubmitting(false);
      }
    }, 600);
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 selection:bg-rose-100">
      <div className="w-full max-w-md bg-white border-4 border-slate-900 rounded-3xl p-6 sm:p-8 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] space-y-6 relative overflow-hidden">
        
        {/* Subtle decorative security grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:14px_14px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 -z-10" />

        {/* TOP ACCENT LINE */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 border-b-2 border-slate-900" />

        {/* HEADER */}
        <div className="text-center space-y-2.5 pt-2">
          <div className="inline-flex p-3 bg-rose-100 text-rose-750 rounded-2xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] mb-1 animate-pulse">
            <ShieldCheck className="w-8 h-8 stroke-[2.5px]" />
          </div>
          <h2 className="text-xl font-black uppercase tracking-tight text-slate-900">
            Secure Admin Vault
          </h2>
          <p className="text-xs font-mono font-bold text-slate-500 tracking-wide uppercase">
            AUTHORIZED PERSONNEL PROTOCOL
          </p>
        </div>

        {errorMsg && (
          <div className="bg-rose-100 border-2 border-slate-900 rounded-2xl p-3 flex items-start gap-2.5 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] text-slate-900 animate-shake">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <p className="text-xs font-black leading-tight">{errorMsg}</p>
          </div>
        )}

        {/* FORM */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 font-mono flex items-center gap-1.5">
              <Mail className="w-3.5 h-3.5 text-indigo-600" />
              Admin Identifier
            </label>
            <input
              id="admin-email"
              type="email"
              required
              placeholder="e.g. name@domain.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-3.5 py-2.5 text-xs font-medium border-2 border-slate-900 rounded-xl shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] focus:outline-none focus:ring-0 focus:border-indigo-600 focus:translate-x-[0.5px] focus:translate-y-[0.5px] focus:shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] bg-white transition-all text-slate-900 font-mono"
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 font-mono flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-indigo-600" />
              Security Passcode
            </label>
            <div className="relative">
              <input
                id="admin-password"
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-3.5 pr-10 py-2.5 text-xs font-medium border-2 border-slate-900 rounded-xl shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] focus:outline-none focus:ring-0 focus:border-indigo-600 focus:translate-x-[0.5px] focus:translate-y-[0.5px] focus:shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] bg-white transition-all text-slate-900 font-mono"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-2.5 top-2.5 p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
                title={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div className="pt-3 space-y-2.5">
            <button
              id="btn-admin-submit"
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 bg-amber-400 hover:bg-amber-500 disabled:bg-amber-200 disabled:cursor-not-allowed text-slate-950 border-2 border-slate-900 rounded-xl font-black uppercase tracking-wider text-xs shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1.5px] active:translate-y-[1.5px] active:shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4" />
              {isSubmitting ? 'Verifying Clearance...' : 'Authenticate Access'}
            </button>

            <button
              id="btn-admin-cancel"
              type="button"
              onClick={onCancel}
              className="w-full py-2 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-950 border-2 border-slate-900 rounded-xl font-black uppercase tracking-wider text-[10px] shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Cancel & Exit
            </button>
          </div>
        </form>

        <div className="pt-2 text-center text-[9px] font-mono text-slate-400 leading-normal">
          Warning: Unauthorised entries are logged and reported.<br/>
          Protected under standard cohabitation ledger protocols.
        </div>
      </div>
    </div>
  );
}
