import React, { useState, useEffect } from 'react';
import { Roommate, Profile } from '../types';
import { getProfile } from '../dbService';
import { sendDiscordNotification } from '../discordService';
import { ShieldCheck, Lock, Unlock, RefreshCw, Key, Users, AlertCircle, ArrowRight } from 'lucide-react';

interface ProfileLockScreenProps {
  selectedUser: Roommate;
  onUnlock: () => void;
  onSwitchUser: (user: Roommate) => void;
}

export default function ProfileLockScreen({ 
  selectedUser, 
  onUnlock, 
  onSwitchUser 
}: ProfileLockScreenProps) {
  const otherUser: Roommate = selectedUser === 'Ozric' ? 'Pawan' : 'Ozric';

  const [password, setPassword] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Fetch security details
  useEffect(() => {
    async function loadSecurity() {
      setLoading(true);
      setErrorMsg('');
      try {
        const data = await getProfile(selectedUser);
        if (data) {
          setProfile(data);
        }
      } catch (err: any) {
        setErrorMsg('Error contacting security server: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
    loadSecurity();
  }, [selectedUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!profile) return;

    setVerifying(true);
    // Mimic quick cryptographic matching delay for a secure feel
    await new Promise((resolve) => setTimeout(resolve, 350));

    if (password === profile.password) {
      sendDiscordNotification('userLoginLogout', {
        title: `🔓 Profile Unlocked Successfully`,
        description: `${selectedUser} has successfully unlocked their roommate dashboard profile.`,
        category: 'security',
        color: 3066993, // emerald green
        fields: [
          { name: 'Roommate Profile', value: selectedUser, inline: true },
          { name: 'Status', value: '🟢 Authenticated', inline: true }
        ]
      }, selectedUser);

      onUnlock();
    } else {
      sendDiscordNotification('failedLogins', {
        title: `🚨 Unauthorized Access Attempt`,
        description: `An incorrect passcode was entered to unlock ${selectedUser}'s roommate profile.`,
        category: 'security',
        color: 15158332, // red
        fields: [
          { name: 'Attempted Profile', value: selectedUser, inline: true },
          { name: 'Security Action', value: '❌ Failed Authentication', inline: true }
        ]
      }, selectedUser);

      setErrorMsg('Incorrect security password. Please try again.');
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-indigo-50/50 flex items-center justify-center p-4 antialiased">
      <div className="bg-white border-4 border-slate-900 rounded-3xl w-full max-w-md shadow-[10px_10px_0px_0px_rgba(15,23,42,1)] overflow-hidden my-auto flex flex-col p-6 sm:p-8 space-y-6">
        
        {/* SECURE LOCK LOGO */}
        <div className="text-center space-y-3">
          <div className="relative inline-flex">
            <span className="p-4 bg-pink-100 text-pink-600 rounded-3xl border-3 border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] inline-block">
              <Lock className="w-8 h-8 stroke-[2.5px]" />
            </span>
            <span className="absolute -top-1 -right-1 bg-amber-400 border-2 border-slate-900 p-1.5 rounded-full shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] text-slate-900">
              <Key className="w-3.5 h-3.5" />
            </span>
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 font-display uppercase tracking-tight">Profile Locked</h2>
            <p className="text-xs text-slate-500 font-medium font-sans">Enter password to secure {selectedUser}'s private dashboard</p>
          </div>
        </div>

        {errorMsg && (
          <div className="bg-rose-100 border-2 border-slate-900 text-slate-900 text-xs rounded-2xl p-4 flex items-start gap-2.5 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] font-bold">
            <AlertCircle className="w-4 h-4 text-rose-650 shrink-0 mt-0.5" />
            <p className="leading-relaxed">{errorMsg}</p>
          </div>
        )}

        {loading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3 text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
            <p className="text-xs font-bold font-mono">Loading security credentials...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* PASSWORD INPUT */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center">
                <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono">
                  Roommate Password
                </label>
              </div>
              <input
                id="input-lock-password"
                type="password"
                placeholder="Enter password..."
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoFocus
                className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border-3 border-slate-900 focus:bg-white focus:outline-none text-center text-lg font-black font-mono text-slate-900"
              />
            </div>

            {/* CONFIRM BUTTON */}
            <button
              id="btn-unlock-profile"
              type="submit"
              disabled={verifying}
              className="w-full py-4 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-300 bg-pink-500 text-white border-3 border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
            >
              <Unlock className="w-4 h-4" />
              {verifying ? 'Verifying security...' : 'Unlock Dashboard'}
            </button>
          </form>
        )}

        {/* PROFILE SWITCHER FOOTER */}
        <div className="border-t-2 border-slate-100 pt-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">
              Not your profile?
            </span>
            <button
              id="btn-switch-lock-user"
              onClick={() => onSwitchUser(otherUser)}
              className="text-xs font-black text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors cursor-pointer"
            >
              Switch to {otherUser}
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}
