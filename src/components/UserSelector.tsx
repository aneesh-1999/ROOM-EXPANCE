import React from 'react';
import { Roommate, Profile } from '../types';
import { User } from 'lucide-react';

interface UserSelectorProps {
  currentUser: Roommate;
  onUserChange: (user: Roommate) => void;
  nicknames?: Record<Roommate, string>;
  profiles?: Record<Roommate, Profile>;
}

export default function UserSelector({ currentUser, onUserChange, nicknames, profiles }: UserSelectorProps) {
  const ozricLabel = nicknames?.Ozric || 'Ozric';
  const pawanLabel = nicknames?.Pawan || 'Pawan';

  const getButtonStyles = (user: Roommate) => {
    const isActive = currentUser === user;
    if (!isActive) {
      return 'text-slate-500 hover:text-slate-800 hover:bg-white/50 cursor-pointer';
    }

    const profile = profiles?.[user];
    const accent = profile?.accentColor || (user === 'Ozric' ? 'indigo' : 'rose');

    switch (accent) {
      case 'rose':
        return 'bg-rose-600 text-white border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] cursor-pointer';
      case 'amber':
        return 'bg-amber-400 text-slate-900 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] cursor-pointer';
      case 'emerald':
        return 'bg-emerald-600 text-white border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] cursor-pointer';
      case 'violet':
        return 'bg-violet-600 text-white border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] cursor-pointer';
      case 'sky':
        return 'bg-sky-500 text-slate-900 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] cursor-pointer';
      case 'indigo':
      default:
        return 'bg-indigo-600 text-white border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] cursor-pointer';
    }
  };

  const getIndicatorStyles = (user: Roommate) => {
    const isActive = currentUser === user;
    if (!isActive) return 'bg-slate-300';
    const profile = profiles?.[user];
    const accent = profile?.accentColor || (user === 'Ozric' ? 'indigo' : 'rose');
    
    if (accent === 'amber' || accent === 'sky') return 'bg-slate-900';
    return 'bg-amber-400';
  };

  return (
    <div className="bg-white border-4 border-slate-900 rounded-3xl p-5 flex flex-col sm:flex-row items-center justify-between gap-4 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] animate-fade-in">
      <div className="flex items-center gap-3">
        <div className="bg-pink-100 text-pink-600 p-3 rounded-2xl border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
          <User className="w-5 h-5" />
        </div>
        <div>
          <h2 className="text-sm font-black text-slate-900 font-display uppercase tracking-wide">Active User Profile</h2>
          <p className="text-xs text-slate-500 mt-0.5 font-medium">Select who is logging or viewing the dashboard</p>
        </div>
      </div>
      
      <div className="flex bg-indigo-50 p-1.5 rounded-2xl border-2 border-slate-900 w-full sm:w-auto">
        <button
          id="btn-select-ozric"
          onClick={() => onUserChange('Ozric')}
          className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 ${getButtonStyles('Ozric')}`}
        >
          <span className="text-base filter drop-shadow-[1px_1px_0px_rgba(0,0,0,0.15)]">
            {profiles?.Ozric?.avatar || '🐼'}
          </span>
          {ozricLabel}
          <span className={`w-2 h-2 rounded-full border border-slate-900/40 ml-1 ${getIndicatorStyles('Ozric')}`}></span>
        </button>
        <button
          id="btn-select-pawan"
          onClick={() => onUserChange('Pawan')}
          className={`flex-1 sm:flex-none px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 flex items-center justify-center gap-2 ${getButtonStyles('Pawan')}`}
        >
          <span className="text-base filter drop-shadow-[1px_1px_0px_rgba(0,0,0,0.15)]">
            {profiles?.Pawan?.avatar || '🦊'}
          </span>
          {pawanLabel}
          <span className={`w-2 h-2 rounded-full border border-slate-900/40 ml-1 ${getIndicatorStyles('Pawan')}`}></span>
        </button>
      </div>
    </div>
  );
}
