import React, { useState, useEffect } from 'react';
import { Expense, Roommate, Profile, PersonalAccount } from '../types';
import { logCoinInsertion, confirmExpense } from '../dbService';
import { subscribeAccounts, addTransaction } from '../personalFinanceService';
import { Zap, HelpCircle, AlertCircle, Sparkles, Check, Coins, Plus, Clock, ChevronDown, ChevronUp, CheckCircle2 } from 'lucide-react';

interface CoinMeterProps {
  expenses: Expense[];
  currentUser: Roommate;
  onLogSuccess: () => void;
  nicknames: Record<Roommate, string>;
  profiles?: Record<Roommate, Profile>;
}

export default function CoinMeter({ expenses, currentUser, onLogSuccess, nicknames, profiles }: CoinMeterProps) {
  const [loading, setLoading] = useState<number | null>(null); // Quick coin insert loading state
  const [customAmount, setCustomAmount] = useState('');
  const [customLoading, setCustomLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showConfetti, setShowConfetti] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null); // ID of confirming coin

  // Personal Vault Auto-Deduct State
  const [personalAccounts, setPersonalAccounts] = useState<PersonalAccount[]>([]);
  const [autoDeduct, setAutoDeduct] = useState(false);
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
        console.error('Failed to fetch live rates in CoinMeter', err);
      }
    };
    fetchLiveRates();
    return () => {
      isMounted = false;
    };
  }, []);

  const deductFromWallet = async (amount: number) => {
    if (autoDeduct && selectedPersonalAccountId) {
      const selectedAcc = personalAccounts.find(a => a.id === selectedPersonalAccountId);
      if (selectedAcc) {
        const targetCurrency = selectedAcc.currency;
        const rate = exchangeRates[targetCurrency] || 1.0;
        const convertedAmount = amount * rate;

        await addTransaction({
          user: currentUser,
          title: `Coin Meter: Contributed €${amount.toFixed(2)}`,
          amount: parseFloat(convertedAmount.toFixed(2)),
          type: 'expense',
          category: 'Electricity / Utilities',
          accountId: selectedAcc.id,
          tags: ['Roommate', 'CoinMeter', 'Electricity'],
          notes: `Auto-deducted from Coin Meter contribution. (Original: €${amount.toFixed(2)})`,
          currency: targetCurrency,
          exchangeRate: targetCurrency === 'EUR' ? 1.0 : rate
        }, selectedAcc);
      }
    }
  };

  const currentUserProfile = profiles?.[currentUser];
  const preferredCoinCategory = currentUserProfile?.quickCoinCategory || 'Electricity (Coins)';

  // Helper to robustly parse timestamps
  const parseExpenseDate = (timestamp: any): Date => {
    if (!timestamp) return new Date();
    if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
    if (timestamp.toDate && typeof timestamp.toDate === 'function') return timestamp.toDate();
    const d = new Date(timestamp);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  // 1. FILTER COIN TRANSACTIONS
  // All confirmed coins (actually contributed and approved)
  const confirmedCoins = expenses.filter((exp) => {
    return exp.isCoin && exp.status !== 'pending';
  });

  // Pending coins (added but awaiting approval)
  const pendingCoins = expenses.filter((exp) => {
    return exp.isCoin && exp.status === 'pending';
  });

  // All coin logs sorted by date descending for the history log
  const allCoinLogs = expenses
    .filter((exp) => exp.isCoin)
    .sort((a, b) => {
      const dateA = parseExpenseDate(a.timestamp);
      const dateB = parseExpenseDate(b.timestamp);
      return dateB.getTime() - dateA.getTime();
    });

  // 2. CALCULATE RUNNING BALANCES
  const ozricCoinTotal = confirmedCoins
    .reduce((sum, exp) => {
      const amt = exp.paymentDistribution ? (exp.paymentDistribution.OzricAmount ?? 0) : (exp.paidBy === 'Ozric' ? exp.amount : 0);
      return sum + amt;
    }, 0);

  const pawanCoinTotal = confirmedCoins
    .reduce((sum, exp) => {
      const amt = exp.paymentDistribution ? (exp.paymentDistribution.PawanAmount ?? 0) : (exp.paidBy === 'Pawan' ? exp.amount : 0);
      return sum + amt;
    }, 0);

  const totalCoinsAdded = ozricCoinTotal + pawanCoinTotal;

  // 3. MEMBER BALANCE DIFFERENCES (WHO NEEDS TO CATCH UP)
  // Formula: Difference = Higher Contribution - Lower Contribution
  // The member with the lower contribution owes the difference to the higher contributor
  let higherContributor: Roommate | null = null;
  let lowerContributor: Roommate | null = null;
  let coinDiff = 0;

  if (ozricCoinTotal > pawanCoinTotal) {
    higherContributor = 'Ozric';
    lowerContributor = 'Pawan';
    coinDiff = ozricCoinTotal - pawanCoinTotal;
  } else if (pawanCoinTotal > ozricCoinTotal) {
    higherContributor = 'Pawan';
    lowerContributor = 'Ozric';
    coinDiff = pawanCoinTotal - ozricCoinTotal;
  }

  // Handle Preset Fast-Log Insertions (€1, €2, €5, €10)
  const handleInsertPreset = async (value: number) => {
    setLoading(value);
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await logCoinInsertion(currentUser, value, currentUser, preferredCoinCategory);
      await deductFromWallet(value);
      setShowConfetti(true);
      setSuccessMsg(`Successfully logged €${value.toFixed(2)} coin contribution!`);
      setTimeout(() => {
        setShowConfetti(false);
        setSuccessMsg('');
      }, 4000);
      onLogSuccess();
    } catch (error: any) {
      setErrorMsg("Failed to log preset: " + (error?.message || error));
    } finally {
      setLoading(null);
    }
  };

  // Handle Custom Insertions
  const handleCustomInsertSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    const parsed = parseFloat(customAmount);
    if (isNaN(parsed) || parsed <= 0) {
      setErrorMsg("Please enter a valid positive number greater than 0.");
      return;
    }

    setCustomLoading(true);
    try {
      await logCoinInsertion(currentUser, parsed, currentUser, preferredCoinCategory);
      await deductFromWallet(parsed);
      setCustomAmount('');
      setShowConfetti(true);
      setSuccessMsg(`Successfully logged custom €${parsed.toFixed(2)} coin contribution!`);
      setTimeout(() => {
        setShowConfetti(false);
        setSuccessMsg('');
      }, 4000);
      onLogSuccess();
    } catch (error: any) {
      setErrorMsg("Failed to log contribution: " + (error?.message || error));
    } finally {
      setCustomLoading(false);
    }
  };

  // Handle Inline Coin Confirmation
  const handleConfirmCoin = async (id: string) => {
    if (!id) return;
    setActionLoading(id);
    setErrorMsg('');
    try {
      await confirmExpense(id, currentUser);
      setSuccessMsg("Contribution successfully approved and added to balance!");
      setTimeout(() => setSuccessMsg(''), 4000);
      onLogSuccess();
    } catch (error: any) {
      setErrorMsg("Failed to approve contribution: " + (error?.message || error));
    } finally {
      setActionLoading(null);
    }
  };

  // Percent calculation for the visual tracker bar
  const ozricPercent = totalCoinsAdded > 0 ? (ozricCoinTotal / totalCoinsAdded) * 100 : 50;
  const pawanPercent = totalCoinsAdded > 0 ? (pawanCoinTotal / totalCoinsAdded) * 100 : 50;

  const ozricName = nicknames.Ozric || 'Ozric';
  const pawanName = nicknames.Pawan || 'Pawan';

  return (
    <div id="coin-meter-card" className="bg-white border-4 border-slate-900 rounded-3xl p-6 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] relative overflow-hidden">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-4 border-slate-100 pb-4 mb-6 gap-3">
        <div className="flex items-center gap-3">
          <div className="bg-amber-100 text-amber-600 p-2.5 rounded-2xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
            <Coins className="w-5 h-5 fill-amber-400/20 animate-pulse text-amber-600" />
          </div>
          <div>
            <h3 className="text-lg font-black font-display tracking-tight text-slate-900">Coin Meter Tracker</h3>
            <p className="text-xs text-slate-500 font-medium">Shared electricity fund contributions</p>
          </div>
        </div>
        <div className="self-start sm:self-center bg-amber-400 text-slate-900 text-xs font-mono font-black px-3.5 py-2 rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
          Total Contributed: €{totalCoinsAdded.toFixed(2)}
        </div>
      </div>

      {/* ERROR & SUCCESS MESSAGES */}
      {errorMsg && (
        <div className="mb-4 p-3 bg-red-50 border-2 border-red-500 rounded-xl flex items-center gap-2 text-xs text-red-800 font-bold">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="mb-4 p-3 bg-emerald-50 border-2 border-emerald-500 rounded-xl flex items-center gap-2 text-xs text-emerald-800 font-bold">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* RUNNING BALANCE STATS */}
      <div className="space-y-4 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Running totals */}
          <div className="bg-slate-50 border-2 border-slate-900 rounded-2xl p-4 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
            <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest font-mono">Running Balances</span>
            <div className="space-y-1.5 mt-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">{ozricName}</span>
                <span className="text-xs font-mono font-black text-slate-900">€{ozricCoinTotal.toFixed(2)}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-slate-700">{pawanName}</span>
                <span className="text-xs font-mono font-black text-slate-900">€{pawanCoinTotal.toFixed(2)}</span>
              </div>
            </div>
          </div>

          {/* Settle Status / Who is behind */}
          <div className="bg-indigo-50/45 border-2 border-slate-900 rounded-2xl p-4 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] flex flex-col justify-center">
            <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest font-mono">Catch-Up Status</span>
            <div className="mt-2">
              {coinDiff === 0 ? (
                <div className="flex items-center gap-1.5 text-xs font-black text-slate-850">
                  <Check className="w-4 h-4 text-emerald-600 stroke-[3px]" />
                  <span>Even contributions! (Either can insert)</span>
                </div>
              ) : (
                <div className="space-y-1">
                  <p className="text-xs font-black text-slate-900 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 fill-amber-400 text-amber-600" />
                    <span>
                      {lowerContributor === 'Ozric' ? ozricName : pawanName} is behind
                    </span>
                  </p>
                  <p className="text-[11px] text-slate-600 font-medium leading-relaxed">
                    Needs to contribute <strong className="text-slate-900 font-mono">€{coinDiff.toFixed(2)}</strong> to catch up with {higherContributor === 'Ozric' ? ozricName : pawanName}.
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* PROGRESS BAR */}
        <div className="h-6 bg-slate-100 rounded-2xl overflow-hidden flex border-2 border-slate-900 relative">
          {totalCoinsAdded === 0 ? (
            <div className="w-full h-full bg-slate-50 text-[10px] text-slate-500 flex items-center justify-center font-black uppercase tracking-wider">
              No coin contributions logged yet
            </div>
          ) : (
            <>
              <div 
                className="h-full bg-teal-400 border-r-2 border-slate-900 transition-all duration-500 relative flex items-center"
                style={{ width: `${ozricPercent}%` }}
              >
                {ozricPercent > 12 && (
                  <span className="absolute left-2.5 text-[10px] font-black text-slate-900 truncate uppercase tracking-tight">
                    {ozricName} ({ozricPercent.toFixed(0)}%)
                  </span>
                )}
              </div>
              <div 
                className="h-full bg-pink-400 transition-all duration-500 relative flex items-center justify-end"
                style={{ width: `${pawanPercent}%` }}
              >
                {pawanPercent > 12 && (
                  <span className="absolute right-2.5 text-[10px] font-black text-slate-900 truncate uppercase tracking-tight">
                    ({pawanPercent.toFixed(0)}%) {pawanName}
                  </span>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* ADD CONTRIBUTION SECTION */}
      <div className="bg-indigo-50/50 rounded-2xl p-5 border-2 border-slate-900 space-y-4">
        <div>
          <h4 className="text-xs font-black text-indigo-900 uppercase tracking-wide">Add Money to Coin Meter</h4>
          <p className="text-[11px] text-slate-500 font-medium mt-0.5">Logged contributions are credited directly to your running total.</p>
        </div>

        {/* Quick presets */}
        <div className="space-y-1.5">
          <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest font-mono">Quick Preset Coins</label>
          <div className="flex flex-wrap gap-2">
            {[1, 2, 5, 10, 20].map((val) => (
              <button
                key={val}
                type="button"
                id={`btn-preset-coin-${val}`}
                disabled={loading !== null || customLoading}
                onClick={() => handleInsertPreset(val)}
                className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-800 text-xs font-extrabold rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] transition-all cursor-pointer disabled:opacity-50"
              >
                {loading === val ? '...' : `+ €${val}`}
              </button>
            ))}
          </div>
        </div>

        {/* Custom manual contribution */}
        <form onSubmit={handleCustomInsertSubmit} className="space-y-1.5 pt-1">
          <label className="text-[9px] text-slate-500 font-black uppercase tracking-widest font-mono block">Log Custom Amount</label>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-black font-mono">€</span>
              <input
                type="number"
                step="any"
                value={customAmount}
                onChange={(e) => setCustomAmount(e.target.value)}
                placeholder="Custom contribution (e.g. 13.00)"
                className="w-full bg-white border-2 border-slate-900 rounded-xl pl-7 pr-3 py-2 text-xs text-slate-800 font-mono font-bold outline-none shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] focus:bg-white"
              />
            </div>
            <button
              type="submit"
              id="btn-coin-submit-custom"
              disabled={loading !== null || customLoading || !customAmount}
              className="px-4 py-2 bg-indigo-600 text-white text-xs font-black tracking-wide uppercase rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:bg-indigo-700 active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] transition-all cursor-pointer disabled:opacity-50 inline-flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>{customLoading ? 'Saving...' : 'Add'}</span>
            </button>
          </div>
        </form>

        {/* Personal Vault Sync Toggle inside Coin Meter */}
        <div className="bg-white/80 border-2 border-slate-900 p-3.5 rounded-xl space-y-2.5 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <input
                id="checkbox-coin-auto-deduct"
                type="checkbox"
                checked={autoDeduct}
                onChange={(e) => setAutoDeduct(e.target.checked)}
                className="w-4 h-4 text-indigo-600 border-2 border-slate-900 rounded focus:ring-indigo-500 cursor-pointer"
              />
              <label htmlFor="checkbox-coin-auto-deduct" className="text-xs font-black text-slate-950 cursor-pointer select-none">
                Deduct from Personal Vault
              </label>
            </div>
            <span className="text-[9px] font-mono font-black bg-indigo-100 border border-indigo-200 px-1.5 py-0.5 rounded text-indigo-800 uppercase tracking-tight">
              Auto-sync
            </span>
          </div>

          {autoDeduct && (
            <div className="space-y-1.5 animate-fade-in pl-5 border-l-2 border-indigo-300">
              {personalAccounts.length === 0 ? (
                <p className="text-[10px] text-rose-600 font-bold">
                  ⚠️ No private wallets found. Create a wallet first in the Personal Finance tab!
                </p>
              ) : (
                <div className="space-y-1">
                  <label htmlFor="select-coin-personal-account" className="text-[9px] font-black text-slate-500 uppercase tracking-wider block font-mono">
                    Select Private Wallet to Deduct
                  </label>
                  <select
                    id="select-coin-personal-account"
                    value={selectedPersonalAccountId}
                    onChange={(e) => setSelectedPersonalAccountId(e.target.value)}
                    className="w-full p-2 bg-white border-2 border-slate-900 rounded-lg text-xs font-bold focus:outline-none"
                  >
                    {personalAccounts.map(acc => {
                      let displayBal = `${acc.currency} ${acc.balance.toFixed(2)}`;
                      if (acc.currency === 'EUR') displayBal = `€${acc.balance.toFixed(2)}`;
                      else if (acc.currency === 'NPR') displayBal = `रू ${Math.round(acc.balance)}`;
                      else displayBal = `$${acc.balance.toFixed(2)}`;

                      return (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} (Bal: {displayBal})
                        </option>
                      );
                    })}
                  </select>

                  {(() => {
                    const acc = personalAccounts.find(a => a.id === selectedPersonalAccountId);
                    if (!acc) return null;
                    const testVal = parseFloat(customAmount) || 1.0;
                    const rate = exchangeRates[acc.currency] || 1.0;
                    const converted = testVal * rate;
                    let displayConv = `${acc.currency} ${converted.toFixed(2)}`;
                    if (acc.currency === 'EUR') displayConv = `€${converted.toFixed(2)}`;
                    else if (acc.currency === 'NPR') displayConv = `रू ${Math.round(converted)}`;
                    else displayConv = `$${converted.toFixed(2)}`;

                    return (
                      <p className="text-[9px] font-mono text-slate-500 font-bold">
                        Will deduct using rate 1 EUR = {rate.toFixed(4)} {acc.currency}.
                        {parseFloat(customAmount) > 0 && (
                          <span> (Estimated deduction: <strong className="text-slate-900">{displayConv}</strong>)</span>
                        )}
                      </p>
                    );
                  })()}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* COLLAPSIBLE CONTRIBUTIONS LOG */}
      <div className="mt-5 border-t-2 border-slate-100 pt-4">
        <button
          type="button"
          id="btn-toggle-coin-history"
          onClick={() => setShowHistory(!showHistory)}
          className="w-full flex items-center justify-between text-xs font-black text-slate-700 hover:text-slate-900 cursor-pointer py-1.5 px-1 bg-slate-50 rounded-xl border-2 border-slate-900/5 transition"
        >
          <div className="flex items-center gap-1.5 pl-2">
            <Clock className="w-3.5 h-3.5 text-slate-500" />
            <span>Contribution Logs History ({allCoinLogs.length})</span>
            {pendingCoins.length > 0 && (
              <span className="bg-amber-100 text-amber-850 text-[9px] font-black px-1.5 py-0.5 rounded-full border border-amber-300">
                {pendingCoins.length} Action Needed
              </span>
            )}
          </div>
          <span className="pr-2">
            {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </span>
        </button>

        {showHistory && (
          <div className="mt-3.5 space-y-2 max-h-60 overflow-y-auto pr-1">
            {allCoinLogs.length === 0 ? (
              <p className="text-center text-[11px] text-slate-400 py-4 font-medium">No coins or meter contributions have been logged yet.</p>
            ) : (
              allCoinLogs.map((log) => {
                const date = parseExpenseDate(log.timestamp);
                const formattedTime = date.toLocaleDateString('default', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                }) + ' at ' + date.toLocaleTimeString('default', {
                  hour: '2-digit',
                  minute: '2-digit'
                });

                const payerName = nicknames[log.paidBy] || log.paidBy;
                const isPending = log.status === 'pending';

                return (
                  <div 
                    key={log.id} 
                    className={`p-3 rounded-xl border-2 text-slate-800 flex items-center justify-between gap-3 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] transition duration-200 ${
                      isPending ? 'bg-amber-50/70 border-amber-300' : 'bg-slate-50 border-slate-900/10'
                    }`}
                  >
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-xs font-extrabold text-slate-900">{payerName}</span>
                        <span className="text-[10px] font-semibold text-slate-500 font-mono">contributed</span>
                        <span className="text-xs font-black text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.5 rounded">
                          €{log.amount.toFixed(2)}
                        </span>
                        {isPending ? (
                          <span className="text-[9px] font-black uppercase bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded border border-amber-300">
                            Pending
                          </span>
                        ) : (
                          <span className="text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded border border-emerald-300 flex items-center gap-0.5">
                            <Check className="w-2.5 h-2.5 stroke-[3px]" /> Confirmed
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 font-medium">{formattedTime}</p>
                    </div>

                    {/* Pending Actions */}
                    {isPending && (
                      <div className="shrink-0">
                        {log.createdBy === currentUser ? (
                          <span className="text-[9px] text-slate-400 font-mono font-medium">Awaiting {nicknames[currentUser === 'Ozric' ? 'Pawan' : 'Ozric']}</span>
                        ) : (
                          <button
                            type="button"
                            disabled={actionLoading !== null}
                            onClick={() => handleConfirmCoin(log.id!)}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider rounded border border-slate-950 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] active:translate-x-[0.5px] active:translate-y-[0.5px] cursor-pointer disabled:opacity-50"
                          >
                            {actionLoading === log.id ? '...' : 'Approve'}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}
      </div>

    </div>
  );
}
