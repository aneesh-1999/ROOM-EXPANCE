import React, { useState, useEffect } from 'react';
import { Roommate, Expense, PersonalAccount } from '../types';
import { settleUpBalances } from '../dbService';
import { subscribeAccounts, addTransaction } from '../personalFinanceService';
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
    if (expense.isCoin) return; // Coin Meter contributions are NOT standard split expenses
    
    let payOzric = 0;
    let payPawan = 0;
    if (expense.paymentDistribution) {
      payOzric = expense.paymentDistribution.OzricAmount ?? 0;
      payPawan = expense.paymentDistribution.PawanAmount ?? 0;
    } else {
      if (expense.paidBy === 'Ozric') {
        payOzric = expense.amount;
      } else if (expense.paidBy === 'Pawan') {
        payPawan = expense.amount;
      }
    }

    const shareOzric = expense.splitDetails?.OzricAmount ?? 0;
    const sharePawan = expense.splitDetails?.PawanAmount ?? 0;

    const pawanOwedDiff = sharePawan - payPawan;
    if (pawanOwedDiff > 0) {
      totalPawanOwesOzric += pawanOwedDiff;
    } else if (pawanOwedDiff < 0) {
      totalOzricOwesPawan += Math.abs(pawanOwedDiff);
    }
  });

  const netBalance = totalPawanOwesOzric - totalOzricOwesPawan; // positive means Pawan owes Ozric, negative means Ozric owes Pawan

  // Local state
  const [payer, setPayer] = useState<Roommate>('Pawan');
  const [receiver, setReceiver] = useState<Roommate>('Ozric');
  const [amountStr, setAmountStr] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Personal Vault Sync State
  const [personalAccounts, setPersonalAccounts] = useState<PersonalAccount[]>([]);
  const [syncPersonal, setSyncPersonal] = useState(false);
  const [selectedPersonalAccountId, setSelectedPersonalAccountId] = useState('');
  const [exchangeRates, setExchangeRates] = useState({
    EUR: 1.0,
    NPR: 175.72,
    USD: 1.09
  });

  // Subscribe to personal accounts of current roommate
  useEffect(() => {
    const unsubscribe = subscribeAccounts(currentUser, (accounts) => {
      setPersonalAccounts(accounts);
      if (accounts.length > 0) {
        setSelectedPersonalAccountId(prev => {
          if (accounts.some(a => a.id === prev)) return prev;
          return accounts[0].id;
        });
      }
    });
    return () => unsubscribe();
  }, [currentUser]);

  // Fetch live exchange rates for conversion
  useEffect(() => {
    let isMounted = true;
    const fetchLiveRates = async () => {
      try {
        const response = await fetch('https://open.er-api.com/v6/latest/EUR');
        if (response.ok) {
          const data = await response.json();
          if (data && data.rates && isMounted) {
            const fetchedNPR = data.rates.NPR || 175.72;
            const fetchedUSD = data.rates.USD || 1.09;
            setExchangeRates({
              EUR: 1.0,
              NPR: parseFloat(fetchedNPR.toFixed(4)),
              USD: parseFloat(fetchedUSD.toFixed(4))
            });
          }
        }
      } catch (err) {
        console.error('Failed to fetch live rates in SettleUpModal', err);
      }
    };
    fetchLiveRates();
    return () => {
      isMounted = false;
    };
  }, []);

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

      if (syncPersonal && selectedPersonalAccountId) {
        const selectedAcc = personalAccounts.find(a => a.id === selectedPersonalAccountId);
        if (selectedAcc) {
          const isPaying = payer === currentUser;
          const targetCurrency = selectedAcc.currency;
          const rate = exchangeRates[targetCurrency] || 1.0;
          const convertedAmount = amt * rate;

          await addTransaction({
            user: currentUser,
            title: isPaying ? `Roommate Settle Up: Paid ${receiver}` : `Roommate Settle Up: Received from ${payer}`,
            amount: parseFloat(convertedAmount.toFixed(2)),
            type: isPaying ? 'expense' : 'income',
            category: 'Settlement',
            accountId: selectedAcc.id,
            tags: ['Roommate', 'Settlement'],
            notes: `Auto-logged from Settle Up. (Original: €${amt.toFixed(2)})`,
            currency: targetCurrency,
            exchangeRate: targetCurrency === 'EUR' ? 1.0 : rate
          }, selectedAcc);
        }
      }

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

          {/* PERSONAL VAULT SYNC */}
          {(() => {
            const amt = parseFloat(amountStr) || 0;
            if (amt <= 0) return null;

            const isPaying = payer === currentUser;

            return (
              <div className="bg-indigo-50/50 border-2 border-slate-900 p-4 rounded-2xl space-y-3 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] animate-fade-in">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <input
                      id="checkbox-sync-personal"
                      type="checkbox"
                      checked={syncPersonal}
                      onChange={(e) => setSyncPersonal(e.target.checked)}
                      className="w-4 h-4 text-indigo-600 border-2 border-slate-900 rounded focus:ring-indigo-500 cursor-pointer"
                    />
                    <label htmlFor="checkbox-sync-personal" className="text-xs font-black text-slate-950 cursor-pointer select-none">
                      {isPaying ? 'Deduct from Personal Vault' : 'Deposit to Personal Vault'}
                    </label>
                  </div>
                  <span className="text-[10px] font-mono font-black bg-white border-2 border-slate-900 px-2.5 py-0.5 rounded-lg">
                    €{amt.toFixed(2)}
                  </span>
                </div>

                {syncPersonal && (
                  <div className="space-y-2 animate-fade-in pl-6 border-l-2 border-slate-300">
                    {personalAccounts.length === 0 ? (
                      <p className="text-[10px] text-rose-600 font-bold">
                        ⚠️ No private wallets found. Please create a wallet first in the Personal Finance tab!
                      </p>
                    ) : (
                      <div className="space-y-1.5">
                        <label htmlFor="select-personal-account-settle" className="text-[9px] font-black text-slate-500 uppercase tracking-wider block font-mono">
                          Select Private Wallet
                        </label>
                        <select
                          id="select-personal-account-settle"
                          value={selectedPersonalAccountId}
                          onChange={(e) => setSelectedPersonalAccountId(e.target.value)}
                          className="w-full p-2 bg-white border-2 border-slate-900 rounded-xl text-xs font-bold focus:outline-none font-mono"
                        >
                          {personalAccounts.map(acc => {
                            let displayBal = `${acc.currency} ${acc.balance.toFixed(2)}`;
                            if (acc.currency === 'EUR') displayBal = `€${acc.balance.toFixed(2)}`;
                            else if (acc.currency === 'NPR') displayBal = `रू ${Math.round(acc.balance)}`;
                            else displayBal = `$${acc.balance.toFixed(2)}`;

                            return (
                              <option key={acc.id} value={acc.id}>
                                {acc.name} ({displayBal})
                              </option>
                            );
                          })}
                        </select>

                        {(() => {
                          const acc = personalAccounts.find(a => a.id === selectedPersonalAccountId);
                          if (!acc) return null;
                          const rate = exchangeRates[acc.currency] || 1.0;
                          const converted = amt * rate;
                          let displayConv = `${acc.currency} ${converted.toFixed(2)}`;
                          if (acc.currency === 'EUR') displayConv = `€${converted.toFixed(2)}`;
                          else if (acc.currency === 'NPR') displayConv = `रू ${Math.round(converted)}`;
                          else displayConv = `$${converted.toFixed(2)}`;

                          return (
                            <p className="text-[9px] font-mono text-slate-500 font-bold">
                              Will {isPaying ? 'deduct' : 'deposit'} <span className="text-slate-900 font-black">{displayConv}</span> using exchange rate (1 EUR = {rate.toFixed(4)} {acc.currency}).
                            </p>
                          );
                        })()}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

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
