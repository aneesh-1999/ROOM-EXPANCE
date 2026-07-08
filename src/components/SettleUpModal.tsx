import React, { useState, useEffect } from 'react';
import { Roommate, Expense } from '../types';
import { settleUpBalances } from '../dbService';
import { X, ArrowRight, ShieldCheck, Check, Sparkles } from 'lucide-react';

interface SettleUpModalProps {
  expenses: Expense[];
  currentUser: Roommate;
  onClose: () => void;
  onSuccess: () => void;
  nicknames: Record<Roommate, string>;
}

export default function SettleUpModal({ expenses, currentUser, onClose, onSuccess, nicknames }: SettleUpModalProps) {
  // Compute balances
  let totalPawanOwesOzric = 0;
  let totalOzricOwesPawan = 0;

  expenses.forEach((expense) => {
    if (expense.status === 'pending') return;
    if (expense.paidBy === 'Ozric') {
      totalPawanOwesOzric += expense.splitDetails.PawanAmount;
    } else if (expense.paidBy === 'Pawan') {
      totalOzricOwesPawan += expense.splitDetails.OzricAmount;
    }
  });

  const netBalance = totalPawanOwesOzric - totalOzricOwesPawan; // positive means Pawan owes Ozric, negative means Ozric owes Pawan

  // Local state
  const [payer, setPayer] = useState<Roommate>('Pawan');
  const [receiver, setReceiver] = useState<Roommate>('Ozric');
  const [amountStr, setAmountStr] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (Math.abs(netBalance) > 0.01) {
      if (netBalance > 0) {
        // Pawan owes Ozric
        setPayer('Pawan');
        setReceiver('Ozric');
        setAmountStr(Math.abs(netBalance).toFixed(2));
      } else {
        // Ozric owes Pawan
        setPayer('Ozric');
        setReceiver('Pawan');
        setAmountStr(Math.abs(netBalance).toFixed(2));
      }
    } else {
      // Balance is even, preselect current user paying other
      setPayer(currentUser);
      setReceiver(currentUser === 'Ozric' ? 'Pawan' : 'Ozric');
      setAmountStr('0.00');
    }
  }, [netBalance, currentUser]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const amt = parseFloat(amountStr);
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('Please enter a valid, positive settlement amount.');
      return;
    }

    setIsSubmitting(true);
    try {
      await settleUpBalances(payer, receiver, amt, currentUser);
      onSuccess();
    } catch (error: any) {
      setErrorMsg('Failed to log settlement: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white border-4 border-slate-900 rounded-3xl w-full max-w-md shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] overflow-hidden my-auto flex flex-col">
        {/* HEADER */}
        <div className="p-5 border-b-4 border-slate-100 flex items-center justify-between bg-indigo-50/25">
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 bg-pink-100 text-pink-600 rounded-2xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-lg font-black tracking-tight text-slate-900">Settle Up Balances</h3>
              <p className="text-xs text-slate-500 font-medium">Log a money transfer to balance debts</p>
            </div>
          </div>
          <button 
            id="btn-close-settle-modal"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 border-2 border-slate-200 hover:border-slate-900 transition duration-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CONTENT */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {errorMsg && (
            <div className="bg-rose-100 border-2 border-slate-900 text-slate-900 text-xs rounded-2xl p-4 flex items-start gap-2.5 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] font-bold">
              <span>⚠️</span>
              <p className="leading-relaxed">{errorMsg}</p>
            </div>
          )}

          {/* NET DEBT EXPLANATION */}
          <div className="bg-amber-100 border-2 border-slate-900 p-4 rounded-2xl shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] space-y-2 text-slate-900">
            <span className="text-[10px] text-slate-650 font-black uppercase tracking-widest font-mono block">Current Standings</span>
            {Math.abs(netBalance) < 0.01 ? (
              <p className="text-sm font-black text-slate-900 flex items-center gap-1.5">
                <Check className="w-4 h-4 text-emerald-600 stroke-[3px]" /> Balances are currently perfectly even!
              </p>
            ) : netBalance > 0 ? (
              <p className="text-sm font-bold text-slate-800">
                <strong className="text-slate-900 underline decoration-pink-500 decoration-2">{nicknames.Pawan}</strong> owes <strong className="text-slate-900 underline decoration-emerald-500 decoration-2">{nicknames.Ozric}</strong> a total of <strong className="text-slate-950 font-mono font-black">€{netBalance.toFixed(2)}</strong>
              </p>
            ) : (
              <p className="text-sm font-bold text-slate-800">
                <strong className="text-slate-900 underline decoration-pink-500 decoration-2">{nicknames.Ozric}</strong> owes <strong className="text-slate-900 underline decoration-emerald-500 decoration-2">{nicknames.Pawan}</strong> a total of <strong className="text-slate-950 font-mono font-black">€{Math.abs(netBalance).toFixed(2)}</strong>
              </p>
            )}
          </div>

          {/* SENDER TO RECEIVER ROW */}
          <div className="flex items-center justify-between bg-indigo-50/50 p-4 rounded-2xl border-2 border-slate-900 gap-3">
            <div className="text-center flex-1">
              <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider font-mono block mb-1">Payer</span>
              <span className="text-xs font-black text-slate-900 bg-rose-200 border-2 border-slate-900 px-3.5 py-2.5 rounded-xl inline-block w-full shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                {nicknames[payer] || payer}
              </span>
            </div>
            
            <div className="text-slate-900 animate-pulse">
              <ArrowRight className="w-5 h-5 stroke-[2.5px]" />
            </div>

            <div className="text-center flex-1">
              <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider font-mono block mb-1">Receiver</span>
              <span className="text-xs font-black text-slate-900 bg-emerald-200 border-2 border-slate-900 px-3.5 py-2.5 rounded-xl inline-block w-full shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                {nicknames[receiver] || receiver}
              </span>
            </div>
          </div>

          {/* AMOUNT INPUT */}
          <div className="space-y-2">
            <div className="flex justify-between">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono">
                Settled Amount (€)
              </label>
              <button
                id="btn-settle-max"
                type="button"
                onClick={() => setAmountStr(Math.abs(netBalance).toFixed(2))}
                className="text-xs text-indigo-600 hover:text-indigo-800 font-black underline cursor-pointer font-mono"
              >
                Use full balance
              </button>
            </div>
            <input
              id="input-settle-amount"
              type="number"
              step="0.01"
              placeholder="0.00"
              value={amountStr}
              onChange={(e) => setAmountStr(e.target.value)}
              required
              className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border-2 border-slate-900 focus:bg-white focus:outline-none text-xl font-black font-mono text-center text-slate-900"
            />
          </div>

          {/* SUBMIT */}
          <button
            id="btn-confirm-settlement"
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-300 bg-indigo-600 text-white border-3 border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer"
          >
            <Sparkles className="w-4 h-4 fill-white/10" />
            {isSubmitting ? 'Logging Settlement...' : 'Confirm Settle Up'}
          </button>
        </form>
      </div>
    </div>
  );
}
