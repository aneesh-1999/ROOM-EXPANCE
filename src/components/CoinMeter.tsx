import React, { useState } from 'react';
import { Expense, Roommate, Profile } from '../types';
import { logCoinInsertion } from '../dbService';
import { Zap, HelpCircle, UserPlus, AlertCircle, Sparkles, Check } from 'lucide-react';

interface CoinMeterProps {
  expenses: Expense[];
  currentUser: Roommate;
  onLogSuccess: () => void;
  nicknames: Record<Roommate, string>;
  profiles?: Record<Roommate, Profile>;
}

export default function CoinMeter({ expenses, currentUser, onLogSuccess, nicknames, profiles }: CoinMeterProps) {
  const [loading, setLoading] = useState<number | null>(null); // holds coin value being inserted, e.g. 1 or 2
  const [showConfetti, setShowConfetti] = useState(false);

  const currentUserProfile = profiles?.[currentUser];
  const preferredCoinCategory = currentUserProfile?.quickCoinCategory || 'Electricity (Coins)';

  // Compute stats for current calendar month
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();

  const coinExpensesThisMonth = expenses.filter((exp) => {
    if (!exp.isCoin || exp.status === 'pending') return false;
    const date = new Date(exp.timestamp);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });

  const ozricCoinTotal = coinExpensesThisMonth
    .filter((exp) => exp.paidBy === 'Ozric')
    .reduce((sum, exp) => sum + exp.amount, 0);

  const pawanCoinTotal = coinExpensesThisMonth
    .filter((exp) => exp.paidBy === 'Pawan')
    .reduce((sum, exp) => sum + exp.amount, 0);

  const totalCoinSpend = ozricCoinTotal + pawanCoinTotal;

  // Determine whose turn is next
  let nextTurn: Roommate | 'Either' = 'Either';
  let diff = 0;
  if (ozricCoinTotal > pawanCoinTotal) {
    nextTurn = 'Pawan';
    diff = ozricCoinTotal - pawanCoinTotal;
  } else if (pawanCoinTotal > ozricCoinTotal) {
    nextTurn = 'Ozric';
    diff = pawanCoinTotal - ozricCoinTotal;
  }

  const handleInsert = async (value: number) => {
    setLoading(value);
    try {
      await logCoinInsertion(currentUser, value, currentUser, preferredCoinCategory);
      setShowConfetti(true);
      setTimeout(() => setShowConfetti(false), 3000);
      onLogSuccess();
    } catch (error) {
      alert("Failed to log coin insertion: " + error);
    } finally {
      setLoading(null);
    }
  };

  // Percent calculation for the visual tracker bar
  const totalBoth = ozricCoinTotal + pawanCoinTotal;
  const ozricPercent = totalBoth > 0 ? (ozricCoinTotal / totalBoth) * 100 : 50;
  const pawanPercent = totalBoth > 0 ? (pawanCoinTotal / totalBoth) * 100 : 50;

  const nextTurnLabel = nextTurn === 'Either' ? 'Either' : (nicknames[nextTurn] || nextTurn);

  return (
    <div className="bg-white border-4 border-slate-900 rounded-3xl p-6 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] relative overflow-hidden">
      <div className="flex items-center justify-between border-b-4 border-slate-100 pb-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="bg-amber-100 text-amber-600 p-2.5 rounded-2xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
            <Zap className="w-5 h-5 fill-amber-400/20 animate-pulse text-amber-600" />
          </div>
          <div>
            <h3 className="text-lg font-black font-display tracking-tight text-slate-900">Coin Meter Tracker</h3>
            <p className="text-xs text-slate-500 font-medium">Shared electricity coin logs for {new Date().toLocaleString('default', { month: 'long' })}</p>
          </div>
        </div>
        <div className="bg-amber-400 text-slate-900 text-xs font-mono font-black px-3 py-1.5 rounded-full border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
          Total: €{totalCoinSpend.toFixed(2)}
        </div>
      </div>

      {/* COIN DUTY TRACKER VISUAL */}
      <div className="space-y-4 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
          <div>
            <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest font-mono">Duty Split</span>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-black text-slate-700 bg-teal-50 border border-teal-300 px-2.5 py-1 rounded-lg">{nicknames.Ozric}: €{ozricCoinTotal.toFixed(2)}</span>
              <span className="text-slate-400">•</span>
              <span className="text-xs font-black text-slate-700 bg-pink-50 border border-pink-300 px-2.5 py-1 rounded-lg">{nicknames.Pawan}: €{pawanCoinTotal.toFixed(2)}</span>
            </div>
          </div>
          <div className="text-left sm:text-right">
            <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest font-mono">Next Up</span>
            <div className="mt-1">
              {nextTurn === 'Either' ? (
                <span className="text-xs font-black text-slate-900 bg-amber-200 px-2.5 py-1.5 rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                  Even (Either)
                </span>
              ) : (
                <span className={`text-xs font-black px-2.5 py-1.5 rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] flex items-center gap-1.5 ${
                  nextTurn === currentUser
                    ? 'text-slate-900 bg-amber-300'
                    : 'text-slate-900 bg-violet-300'
                }`}>
                  <Sparkles className="w-3.5 h-3.5 fill-current text-slate-900" />
                  {nextTurnLabel}'s turn (Diff: €{diff.toFixed(2)})
                </span>
              )}
            </div>
          </div>
        </div>

        {/* PROGRESS BAR BAR CHART */}
        <div className="h-6 bg-slate-100 rounded-2xl overflow-hidden flex border-2 border-slate-900">
          {totalBoth === 0 ? (
            <div className="w-full h-full bg-slate-50 text-[10px] text-slate-500 flex items-center justify-center font-black uppercase tracking-wider">
              No coins logged this month
            </div>
          ) : (
            <>
              <div 
                className="h-full bg-teal-400 border-r-2 border-slate-900 transition-all duration-500 relative flex items-center"
                style={{ width: `${ozricPercent}%` }}
              >
                <span className="absolute left-2 text-[10px] font-black text-slate-900 truncate uppercase tracking-tight">
                  {ozricPercent.toFixed(0)}% {nicknames.Ozric}
                </span>
              </div>
              <div 
                className="h-full bg-pink-400 transition-all duration-500 relative flex items-center justify-end"
                style={{ width: `${pawanPercent}%` }}
              >
                <span className="absolute right-2 text-[10px] font-black text-slate-900 truncate uppercase tracking-tight">
                  {nicknames.Pawan} {pawanPercent.toFixed(0)}%
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* QUICK LOG BUTTONS */}
      <div className="bg-indigo-50/50 rounded-2xl p-4 border-2 border-slate-900">
        <div className="flex items-center justify-between mb-3.5">
          <p className="text-xs font-bold text-slate-700">
            Log coin insertion for <strong className="text-indigo-600 underline decoration-2">{nicknames[currentUser] || currentUser}</strong>:
          </p>
          {showConfetti && (
            <span className="text-[11px] text-emerald-600 font-black animate-bounce flex items-center gap-1">
              <Check className="w-3.5 h-3.5 stroke-[3px]" /> Inserted!
            </span>
          )}
        </div>
        
        <div className="grid grid-cols-2 gap-3.5">
          <button
            id="btn-coin-1"
            disabled={loading !== null}
            onClick={() => handleInsert(1)}
            className="relative overflow-hidden group py-4 rounded-2xl border-2 border-slate-900 text-slate-900 bg-white font-black transition-all duration-300 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-50 flex flex-col items-center justify-center gap-1.5 cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full border-2 border-slate-900 bg-amber-400 text-slate-900 flex items-center justify-center text-lg font-black shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] group-hover:scale-105 transition-all">
              €1
            </div>
            <span className="text-xs text-slate-700 font-bold">
              {loading === 1 ? 'Logging...' : 'Insert €1'}
            </span>
          </button>

          <button
            id="btn-coin-2"
            disabled={loading !== null}
            onClick={() => handleInsert(2)}
            className="relative overflow-hidden group py-4 rounded-2xl border-2 border-slate-900 text-slate-900 bg-white font-black transition-all duration-300 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-50 flex flex-col items-center justify-center gap-1.5 cursor-pointer"
          >
            <div className="w-12 h-12 rounded-full border-2 border-slate-900 bg-amber-400 text-slate-900 flex items-center justify-center text-lg font-black shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] group-hover:scale-105 transition-all">
              €2
            </div>
            <span className="text-xs text-slate-700 font-bold">
              {loading === 2 ? 'Logging...' : 'Insert €2'}
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
