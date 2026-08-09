import React, { useState, useEffect } from 'react';
import { Roommate, Expense, PersonalAccount } from '../types';
import { logLendBorrow } from '../dbService';
import { subscribeAccounts, addTransaction } from '../personalFinanceService';
import { X, ArrowRight, Coins, DollarSign, CreditCard, Sparkles, AlertCircle } from 'lucide-react';

interface LendBorrowModalProps {
  currentUser: Roommate;
  onClose: () => void;
  onSuccess: () => void;
  nicknames: Record<Roommate, string>;
}

export default function LendBorrowModal({ currentUser, onClose, onSuccess, nicknames }: LendBorrowModalProps) {
  const otherUser: Roommate = currentUser === 'Ozric' ? 'Pawan' : 'Ozric';
  const otherUserLabel = nicknames[otherUser] || otherUser;
  const currentUserLabel = nicknames[currentUser] || currentUser;

  // State
  const [action, setAction] = useState<'lend' | 'borrow'>('lend');
  const [amountStr, setAmountStr] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Revolut' | 'Bank Transfer'>('Revolut');
  const [notes, setNotes] = useState('');
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
        console.error('Failed to fetch live rates in LendBorrowModal', err);
      }
    };
    fetchLiveRates();
    return () => {
      isMounted = false;
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const amt = parseFloat(amountStr);
    if (isNaN(amt) || amt <= 0) {
      setErrorMsg('Please enter a valid, positive amount.');
      return;
    }

    const lender = action === 'lend' ? currentUser : otherUser;
    const borrower = action === 'lend' ? otherUser : currentUser;

    setIsSubmitting(true);
    try {
      await logLendBorrow(lender, borrower, amt, paymentMethod, notes, currentUser);

      // Auto-sync with personal finance wallet
      if (syncPersonal && selectedPersonalAccountId) {
        const selectedAcc = personalAccounts.find(a => a.id === selectedPersonalAccountId);
        if (selectedAcc) {
          const targetCurrency = selectedAcc.currency;
          const rate = exchangeRates[targetCurrency] || 1.0;
          const convertedAmount = amt * rate;

          await addTransaction({
            user: currentUser,
            title: action === 'lend' ? `Lent money to ${otherUserLabel}` : `Borrowed money from ${otherUserLabel}`,
            amount: parseFloat(convertedAmount.toFixed(2)),
            type: action === 'lend' ? 'expense' : 'income',
            category: action === 'lend' ? 'Loan / Lend' : 'Loan / Borrow',
            accountId: selectedAcc.id,
            tags: ['Roommate', 'LoanTransfer'],
            notes: `Auto-synced from Lend & Borrow modal. (Original: €${amt.toFixed(2)})`,
            currency: targetCurrency,
            exchangeRate: targetCurrency === 'EUR' ? 1.0 : rate
          }, selectedAcc);
        }
      }

      onSuccess();
    } catch (error: any) {
      setErrorMsg('Failed to log transfer: ' + error.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white border-4 border-slate-900 rounded-3xl w-full max-w-md shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] overflow-hidden my-auto flex flex-col">
        {/* HEADER */}
        <div className="p-5 border-b-4 border-slate-100 flex items-center justify-between bg-violet-50/25">
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 bg-violet-100 text-violet-600 rounded-2xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
              <Coins className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-lg font-black tracking-tight text-slate-900">Lend & Borrow Cash</h3>
              <p className="text-xs text-slate-500 font-medium font-sans">Direct cash loans & transfer trackers</p>
            </div>
          </div>
          <button 
            id="btn-close-lend-modal"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 border-2 border-slate-200 hover:border-slate-900 transition duration-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CONTENT */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {errorMsg && (
            <div className="bg-rose-100 border-2 border-slate-900 text-slate-900 text-xs rounded-2xl p-4 flex items-start gap-2.5 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] font-bold">
              <AlertCircle className="w-4 h-4 text-rose-650 shrink-0 mt-0.5" />
              <p className="leading-relaxed">{errorMsg}</p>
            </div>
          )}

          {/* ACTION SELECTOR (LEND VS BORROW) */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono">
              Action Type
            </label>
            <div className="grid grid-cols-2 bg-slate-100 p-1.5 rounded-2xl border-2 border-slate-900">
              <button
                id="btn-action-lend"
                type="button"
                onClick={() => setAction('lend')}
                className={`py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  action === 'lend'
                    ? 'bg-violet-600 text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] border-2 border-slate-900'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                I Lent Money
              </button>
              <button
                id="btn-action-borrow"
                type="button"
                onClick={() => setAction('borrow')}
                className={`py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  action === 'borrow'
                    ? 'bg-violet-600 text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] border-2 border-slate-900'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                I Borrowed Money
              </button>
            </div>
          </div>

          {/* LENDER TO BORROWER VISUAL INDICATOR */}
          <div className="flex items-center justify-between bg-indigo-50/50 p-4 rounded-2xl border-2 border-slate-900 gap-3">
            <div className="text-center flex-1">
              <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider font-mono block mb-1">
                Lender (Giver)
              </span>
              <span className={`text-xs font-black text-slate-900 border-2 border-slate-900 px-3.5 py-2.5 rounded-xl inline-block w-full shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] ${
                action === 'lend' ? 'bg-emerald-200' : 'bg-rose-200'
              }`}>
                {action === 'lend' ? currentUserLabel : otherUserLabel}
              </span>
            </div>
            
            <div className="text-slate-950">
              <ArrowRight className="w-5 h-5 stroke-[2.5px]" />
            </div>

            <div className="text-center flex-1">
              <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider font-mono block mb-1">
                Borrower (Receiver)
              </span>
              <span className={`text-xs font-black text-slate-900 border-2 border-slate-900 px-3.5 py-2.5 rounded-xl inline-block w-full shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] ${
                action === 'lend' ? 'bg-rose-200' : 'bg-emerald-200'
              }`}>
                {action === 'lend' ? otherUserLabel : currentUserLabel}
              </span>
            </div>
          </div>

          {/* TRANSFER PLATFORM METHOD */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono">
              Transfer Mode
            </label>
            <div className="grid grid-cols-3 bg-slate-100 p-1.5 rounded-2xl border-2 border-slate-900 gap-1.5">
              {(['Cash', 'Revolut', 'Bank Transfer'] as const).map((mode) => {
                const isSelected = paymentMethod === mode;
                return (
                  <button
                    id={`btn-transfer-method-${mode.replace(/\s+/g, '-').toLowerCase()}`}
                    key={mode}
                    type="button"
                    onClick={() => setPaymentMethod(mode)}
                    className={`py-2 px-1 rounded-xl text-[11px] font-black tracking-tight transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-amber-400 text-slate-950 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] border-2 border-slate-900'
                        : 'text-slate-500 hover:text-slate-800'
                    }`}
                  >
                    {mode}
                  </button>
                );
              })}
            </div>
          </div>

          {/* AMOUNT INPUT */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono">
              Transfer Amount (€)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-900">
                <span className="font-mono font-black text-lg">€</span>
              </div>
              <input
                id="input-lend-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                required
                className="w-full pl-10 pr-4 py-3.5 rounded-xl bg-slate-50 border-2 border-slate-900 focus:bg-white focus:outline-none text-xl font-black font-mono text-slate-900"
              />
            </div>
          </div>

          {/* OPTIONAL NOTES */}
          <div className="space-y-1.5">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono">
              Description / Notes (Optional)
            </label>
            <input
              id="input-lend-notes"
              type="text"
              placeholder="e.g. for concert tickets, taxi ride, pocket cash..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-900 focus:bg-white focus:outline-none text-xs text-slate-800 font-bold"
            />
          </div>

          {/* PERSONAL VAULT SYNC */}
          <div className="bg-indigo-50/50 border-2 border-slate-900 p-4 rounded-2xl space-y-3 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <input
                  id="checkbox-lend-auto-deduct"
                  type="checkbox"
                  checked={syncPersonal}
                  onChange={(e) => setSyncPersonal(e.target.checked)}
                  className="w-4 h-4 text-indigo-600 border-2 border-slate-900 rounded focus:ring-indigo-500 cursor-pointer"
                />
                <label htmlFor="checkbox-lend-auto-deduct" className="text-xs font-black text-slate-950 cursor-pointer select-none">
                  {action === 'lend' ? 'Deduct from Personal Vault' : 'Deposit to Personal Vault'}
                </label>
              </div>
              <span className="text-[10px] font-mono font-black bg-white border-2 border-slate-900 px-2 py-0.5 rounded">
                Auto-sync
              </span>
            </div>

            {syncPersonal && (
              <div className="space-y-1.5 animate-fade-in pl-5 border-l-2 border-slate-300">
                {personalAccounts.length === 0 ? (
                  <p className="text-[10px] text-rose-650 font-bold">
                    ⚠️ No private wallets found. Create a wallet first in the Personal Finance tab!
                  </p>
                ) : (
                  <div className="space-y-1">
                    <label htmlFor="select-lend-personal-account" className="text-[9px] font-black text-slate-500 uppercase tracking-wider block font-mono">
                      Select Private Wallet
                    </label>
                    <select
                      id="select-lend-personal-account"
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
                      const val = parseFloat(amountStr) || 0;
                      const rate = exchangeRates[acc.currency] || 1.0;
                      const converted = val * rate;
                      let displayConv = `${acc.currency} ${converted.toFixed(2)}`;
                      if (acc.currency === 'EUR') displayConv = `€${converted.toFixed(2)}`;
                      else if (acc.currency === 'NPR') displayConv = `रू ${Math.round(converted)}`;
                      else displayConv = `$${converted.toFixed(2)}`;

                      return (
                        <p className="text-[9px] font-mono text-slate-500 font-bold">
                          Using rate 1 EUR = {rate.toFixed(4)} {acc.currency}.
                          {val > 0 && (
                            <span> (Will {action === 'lend' ? 'deduct' : 'deposit'}: <strong className="text-slate-900">{displayConv}</strong>)</span>
                          )}
                        </p>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SUBMIT BUTTON */}
          <button
            id="btn-confirm-lend-borrow"
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-300 bg-violet-600 text-white border-3 border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer mt-2"
          >
            <Sparkles className="w-4 h-4 fill-white/10" />
            {isSubmitting ? 'Logging Transaction...' : `Confirm ${action === 'lend' ? 'Lend' : 'Borrow'}`}
          </button>
        </form>
      </div>
    </div>
  );
}
