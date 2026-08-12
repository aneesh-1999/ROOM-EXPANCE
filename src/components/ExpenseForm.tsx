import React, { useState, useEffect } from 'react';
import { Category, SplitType, Roommate, PersonalAccount } from '../types';
import { addExpense } from '../dbService';
import { subscribeAccounts, addTransaction } from '../personalFinanceService';
import { 
  X, 
  Euro, 
  Layers, 
  HelpCircle,
  Home, 
  Zap, 
  ShoppingCart, 
  Sparkles, 
  Wifi, 
  Utensils, 
  MoreHorizontal 
} from 'lucide-react';

interface ExpenseFormProps {
  currentUser: Roommate;
  onClose: () => void;
  onSuccess: () => void;
  nicknames: Record<Roommate, string>;
  onSwitchToScanner?: () => void;
}

const CATEGORIES: { name: Category; icon: React.ComponentType<any>; color: string; defaultAmount?: number }[] = [
  { name: 'Shared Groceries', icon: ShoppingCart, color: 'text-emerald-700 bg-emerald-100 border-2 border-slate-900' },
  { name: 'Household Supplies', icon: Sparkles, color: 'text-sky-700 bg-sky-100 border-2 border-slate-900' },
  { name: 'Rent', icon: Home, color: 'text-indigo-700 bg-indigo-100 border-2 border-slate-900', defaultAmount: 700 },
  { name: 'Electricity (Coins)', icon: Zap, color: 'text-amber-700 bg-amber-100 border-2 border-slate-900' },
  { name: 'Internet/Wi-Fi', icon: Wifi, color: 'text-purple-700 bg-purple-100 border-2 border-slate-900' },
  { name: 'Takeout/Delivery', icon: Utensils, color: 'text-rose-700 bg-rose-100 border-2 border-slate-900' },
  { name: 'Other', icon: MoreHorizontal, color: 'text-slate-700 bg-slate-100 border-2 border-slate-900' },
];

export default function ExpenseForm({ currentUser, onClose, onSuccess, nicknames, onSwitchToScanner }: ExpenseFormProps) {
  const [title, setTitle] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [payOzricAmount, setPayOzricAmount] = useState('');
  const [payPawanAmount, setPayPawanAmount] = useState('');
  const [isPaymentEdited, setIsPaymentEdited] = useState(false);
  const [category, setCategory] = useState<Category>('Shared Groceries');
  const [splitType, setSplitType] = useState<SplitType>('50/50');
  const [notes, setNotes] = useState('');

  // Custom Split state
  const [customOzricAmount, setCustomOzricAmount] = useState('');
  const [customPawanAmount, setCustomPawanAmount] = useState('');

  // Itemized Split state (e.g., total = 50, itemized personal portion = 15, belongs to Pawan)
  const [personalUser, setPersonalUser] = useState<Roommate>('Pawan');
  const [personalAmountStr, setPersonalAmountStr] = useState('');

  const [errorMsg, setErrorMsg] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
        console.error('Failed to fetch live rates in ExpenseForm', err);
      }
    };
    fetchLiveRates();
    return () => {
      isMounted = false;
    };
  }, []);

  // Reset manual flag on mount/user shift
  useEffect(() => {
    setIsPaymentEdited(false);
  }, [currentUser]);

  // Keep payment distribution in sync with total amount if not edited manually
  useEffect(() => {
    const total = parseFloat(amountStr) || 0;
    if (!isPaymentEdited) {
      if (currentUser === 'Ozric') {
        setPayOzricAmount(total > 0 ? total.toFixed(2) : '');
        setPayPawanAmount('0.00');
      } else {
        setPayPawanAmount(total > 0 ? total.toFixed(2) : '');
        setPayOzricAmount('0.00');
      }
    }
  }, [amountStr, currentUser, isPaymentEdited]);

  // Handle category default overrides
  const handleCategorySelect = (catName: Category) => {
    setCategory(catName);
    const catConfig = CATEGORIES.find(c => c.name === catName);
    
    // Auto-populate default amount
    if (catConfig?.defaultAmount) {
      setAmountStr(catConfig.defaultAmount.toString());
    }

    // Default Rent split is uneven: €400 (Ozric) / €300 (Pawan)
    if (catName === 'Rent') {
      setTitle('Rent');
      setSplitType('custom');
      setCustomOzricAmount('400');
      setCustomPawanAmount('300');
    } else {
      // For general categories, default to title and 50/50
      if (title === 'Rent') {
        setTitle('');
      }
      setSplitType('50/50');
    }
  };

  // Keep Custom Split fields reactive if 50/50 is selected and amount is updated
  useEffect(() => {
    const amt = parseFloat(amountStr);
    if (!isNaN(amt) && splitType === '50/50') {
      const half = (amt / 2).toFixed(2);
      setCustomOzricAmount(half);
      setCustomPawanAmount(half);
    }
  }, [amountStr, splitType]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const totalAmount = parseFloat(amountStr);
    if (isNaN(totalAmount) || totalAmount <= 0) {
      setErrorMsg('Please enter a valid expense total amount.');
      return;
    }

    if (!title.trim()) {
      setErrorMsg('Please enter a description/title for this expense.');
      return;
    }

    let ozricShare = 0;
    let pawanShare = 0;
    let itemizedDetails = undefined;

    if (splitType === '50/50') {
      ozricShare = totalAmount / 2;
      pawanShare = totalAmount / 2;
    } 
    else if (splitType === 'custom') {
      const oAmt = parseFloat(customOzricAmount);
      const pAmt = parseFloat(customPawanAmount);

      if (isNaN(oAmt) || isNaN(pAmt)) {
        setErrorMsg('Please enter valid numeric amounts for both Ozric and Pawan.');
        return;
      }

      // Check if custom amounts sum to total amount
      const sum = oAmt + pAmt;
      if (Math.abs(sum - totalAmount) > 0.05) {
        setErrorMsg(`The split parts (€${sum.toFixed(2)}) must sum up to the total amount (€${totalAmount.toFixed(2)}).`);
        return;
      }

      ozricShare = oAmt;
      pawanShare = pAmt;
    } 
    else if (splitType === 'itemized') {
      const persAmt = parseFloat(personalAmountStr);
      if (isNaN(persAmt) || persAmt < 0 || persAmt > totalAmount) {
        setErrorMsg('Please enter a valid personal amount between €0 and the total expense amount.');
        return;
      }

      itemizedDetails = {
        personalUser,
        personalAmount: persAmt
      };

      const sharedRemaining = totalAmount - persAmt;
      const sharedHalf = sharedRemaining / 2;

      if (personalUser === 'Ozric') {
        ozricShare = persAmt + sharedHalf;
        pawanShare = sharedHalf;
      } else {
        pawanShare = persAmt + sharedHalf;
        ozricShare = sharedHalf;
      }
    }

    const pOzric = parseFloat(payOzricAmount) || 0;
    const pPawan = parseFloat(payPawanAmount) || 0;
    const totalPaid = pOzric + pPawan;
    if (Math.abs(totalPaid - totalAmount) > 0.05) {
      setErrorMsg(`The sum of roommate payment contributions (€${totalPaid.toFixed(2)}) must equal the total expense amount (€${totalAmount.toFixed(2)}).`);
      return;
    }

    setIsSubmitting(true);
    try {
      await addExpense({
        title: title.trim(),
        amount: totalAmount,
        paidBy: pOzric >= pPawan ? 'Ozric' : 'Pawan',
        category,
        splitType,
        notes: notes.trim(),
        splitDetails: {
          OzricAmount: parseFloat(ozricShare.toFixed(2)),
          PawanAmount: parseFloat(pawanShare.toFixed(2))
        },
        paymentDistribution: {
          OzricAmount: parseFloat(pOzric.toFixed(2)),
          PawanAmount: parseFloat(pPawan.toFixed(2))
        },
        itemizedDetails: itemizedDetails ? {
          personalUser: itemizedDetails.personalUser,
          personalAmount: parseFloat(itemizedDetails.personalAmount.toFixed(2))
        } : undefined,
        createdBy: currentUser,
        status: 'pending'
      });

      // Auto-deduct from personal vault
      const myPaidAmount = currentUser === 'Ozric' ? pOzric : pPawan;
      if (autoDeduct && myPaidAmount > 0 && selectedPersonalAccountId) {
        const selectedAcc = personalAccounts.find(a => a.id === selectedPersonalAccountId);
        if (selectedAcc) {
          const targetCurrency = selectedAcc.currency;
          const rate = exchangeRates[targetCurrency] || 1.0;
          const convertedAmount = myPaidAmount * rate;

          await addTransaction({
            user: currentUser,
            title: `Roommate Bill: ${title.trim()}`,
            amount: parseFloat(convertedAmount.toFixed(2)),
            type: 'expense',
            category: 'Roommate Expense',
            accountId: selectedAcc.id,
            tags: ['Roommate', category],
            notes: `Auto-deducted from Roommate Expense logging. (Original: €${myPaidAmount.toFixed(2)})`,
            currency: targetCurrency,
            exchangeRate: targetCurrency === 'EUR' ? 1.0 : rate
          }, selectedAcc);
        }
      }

      onSuccess();
    } catch (err: any) {
      setErrorMsg('Database submission failed: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
      <div className="bg-white border-4 border-slate-900 rounded-3xl w-full max-w-lg shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] overflow-hidden my-auto max-h-[92vh] flex flex-col">
        {/* HEADER */}
        <div className="p-3.5 sm:p-4 border-b-2 border-slate-200 flex items-center justify-between bg-indigo-50/50 sticky top-0 backdrop-blur z-10">
          <div className="flex items-center gap-2">
            <span className="p-2 bg-pink-100 text-pink-600 rounded-xl border border-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] shrink-0">
              <Layers className="w-4 h-4" />
            </span>
            <div>
              <h3 className="text-base font-black tracking-tight text-slate-900">Add Shared Expense</h3>
              <p className="text-[10px] text-slate-500 font-bold">Split bills & log shared payments</p>
            </div>
          </div>
          <button 
            id="btn-close-expense-form"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 border border-slate-300 hover:border-slate-900 transition duration-150 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="p-3.5 sm:p-4 overflow-y-auto space-y-4 flex-1">
          {onSwitchToScanner && (
            <button
              type="button"
              onClick={onSwitchToScanner}
              className="w-full py-2 px-3 bg-amber-50 hover:bg-amber-100 border border-dashed border-amber-500 rounded-xl flex items-center justify-center gap-2 text-xs font-black text-amber-950 uppercase tracking-wider transition duration-150 cursor-pointer shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]"
            >
              <span className="text-sm">📸</span>
              <span>Scan Receipt with AI</span>
            </button>
          )}

          {errorMsg && (
            <div className="bg-rose-100 border border-slate-900 text-slate-900 text-xs rounded-xl p-3 flex items-start gap-2 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] font-bold">
              <span className="mt-0.5">⚠️</span>
              <p className="leading-snug">{errorMsg}</p>
            </div>
          )}

          {/* TOTAL AMOUNT & TITLE IN 2-COL OR COMPACT STACK */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3">
            <div className="sm:col-span-5 space-y-1">
              <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 font-mono">
                Total Amount (€)
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-900">
                  <Euro className="w-5 h-5 stroke-[2.5]" />
                </div>
                <input
                  id="input-expense-amount"
                  type="number"
                  step="0.01"
                  placeholder="0.00"
                  value={amountStr}
                  onChange={(e) => setAmountStr(e.target.value)}
                  required
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-slate-50 border-2 border-slate-900 focus:bg-white focus:outline-none text-xl font-black font-mono text-slate-900 transition-all placeholder:text-slate-400 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
                />
              </div>
            </div>

            <div className="sm:col-span-7 space-y-1">
              <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 font-mono">
                Description / Title
              </label>
              <input
                id="input-expense-title"
                type="text"
                placeholder="Groceries, Wi-Fi, Rent..."
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                required
                className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border-2 border-slate-900 focus:bg-white focus:outline-none text-xs font-bold text-slate-900 transition-all placeholder:text-slate-400 min-h-[42px]"
              />
            </div>
          </div>

          {/* CATEGORY GRID */}
          <div className="space-y-1.5">
            <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 font-mono">
              Category
            </label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isSelected = category === cat.name;
                return (
                  <button
                    id={`btn-cat-${cat.name.replace(/\s+/g, '-').toLowerCase()}`}
                    key={cat.name}
                    type="button"
                    onClick={() => handleCategorySelect(cat.name)}
                    className={`flex items-center gap-1.5 px-2 py-2 rounded-xl border transition-all duration-150 text-left cursor-pointer min-h-[40px] ${
                      isSelected
                        ? 'bg-amber-100 border-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] text-slate-900 font-black'
                        : 'bg-white border-slate-300 text-slate-600 font-bold hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`p-1 rounded-lg border border-slate-900 shrink-0 ${isSelected ? 'bg-amber-400 text-slate-900' : 'bg-slate-100 text-slate-700'}`}>
                      <Icon className="w-3 h-3 stroke-[2.5]" />
                    </span>
                    <span className="text-[10px] font-extrabold truncate leading-tight">
                      {cat.name.replace('/Delivery', '').replace(' (Coins)', '')}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* PAYMENT DISTRIBUTION */}
          <div className="space-y-2 pt-1">
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 font-mono">
                Who Paid
              </label>
              <span className="text-[9px] text-slate-400 font-mono">
                Enter payment contributions
              </span>
            </div>

            <div className="bg-slate-50 border-2 border-slate-900 p-3 rounded-xl space-y-3 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
              {/* Quick Fill Actions */}
              <div className="grid grid-cols-3 gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    const total = parseFloat(amountStr) || 0;
                    setPayOzricAmount(total.toFixed(2));
                    setPayPawanAmount('0.00');
                    setIsPaymentEdited(true);
                  }}
                  className="px-2 py-1 bg-white border border-slate-900 text-[9px] font-black uppercase tracking-wider rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer text-center truncate"
                >
                  {nicknames.Ozric} All
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const total = parseFloat(amountStr) || 0;
                    setPayPawanAmount(total.toFixed(2));
                    setPayOzricAmount('0.00');
                    setIsPaymentEdited(true);
                  }}
                  className="px-2 py-1 bg-white border border-slate-900 text-[9px] font-black uppercase tracking-wider rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer text-center truncate"
                >
                  {nicknames.Pawan} All
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const total = parseFloat(amountStr) || 0;
                    const half = (total / 2).toFixed(2);
                    setPayOzricAmount(half);
                    setPayPawanAmount(half);
                    setIsPaymentEdited(true);
                  }}
                  className="px-2 py-1 bg-white border border-slate-900 text-[9px] font-black uppercase tracking-wider rounded-lg text-slate-700 hover:bg-slate-100 cursor-pointer text-center truncate"
                >
                  50 / 50
                </button>
              </div>

              {/* Input Grid */}
              <div className="grid grid-cols-2 gap-2.5">
                <div className="space-y-0.5">
                  <label className="text-[9px] text-slate-500 font-black font-mono uppercase">
                    {nicknames.Ozric} (€)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400 font-mono font-bold text-xs">€</span>
                    <input
                      id="input-pay-dist-ozric"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={payOzricAmount}
                      onChange={(e) => {
                        setPayOzricAmount(e.target.value);
                        setIsPaymentEdited(true);
                      }}
                      className="w-full pl-6 pr-2 py-1.5 rounded-lg bg-white border border-slate-900 text-xs font-black font-mono text-slate-900 focus:bg-indigo-50/50 outline-none"
                    />
                  </div>
                </div>

                <div className="space-y-0.5">
                  <label className="text-[9px] text-slate-500 font-black font-mono uppercase">
                    {nicknames.Pawan} (€)
                  </label>
                  <div className="relative">
                    <span className="absolute inset-y-0 left-0 pl-2.5 flex items-center pointer-events-none text-slate-400 font-mono font-bold text-xs">€</span>
                    <input
                      id="input-pay-dist-pawan"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={payPawanAmount}
                      onChange={(e) => {
                        setPayPawanAmount(e.target.value);
                        setIsPaymentEdited(true);
                      }}
                      className="w-full pl-6 pr-2 py-1.5 rounded-lg bg-white border border-slate-900 text-xs font-black font-mono text-slate-900 focus:bg-indigo-50/50 outline-none"
                    />
                  </div>
                </div>
              </div>

              {amountStr && (
                <div className="pt-1.5 border-t border-slate-200 flex justify-between text-[9px] font-mono font-bold">
                  <span className="text-slate-500">Target: €{parseFloat(amountStr).toFixed(2)}</span>
                  <span className={`font-black ${
                    Math.abs((parseFloat(payOzricAmount) || 0) + (parseFloat(payPawanAmount) || 0) - parseFloat(amountStr)) < 0.05
                      ? 'text-emerald-600'
                      : 'text-rose-600'
                  }`}>
                    Paid: €{((parseFloat(payOzricAmount) || 0) + (parseFloat(payPawanAmount) || 0)).toFixed(2)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* SPLIT TYPE TABS */}
          <div className="space-y-2 pt-1 border-t border-slate-200">
            <div className="flex items-center justify-between">
              <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 font-mono">
                Split Ratio
              </label>
            </div>
            
            <div className="grid grid-cols-3 bg-slate-100 p-1 rounded-xl border border-slate-900">
              <button
                id="btn-split-5050"
                type="button"
                onClick={() => setSplitType('50/50')}
                className={`py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  splitType === '50/50'
                    ? 'bg-emerald-300 text-slate-900 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] border border-slate-900'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Equal
              </button>
              <button
                id="btn-split-custom"
                type="button"
                onClick={() => setSplitType('custom')}
                className={`py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  splitType === 'custom'
                    ? 'bg-emerald-300 text-slate-900 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] border border-slate-900'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Custom
              </button>
              <button
                id="btn-split-itemized"
                type="button"
                onClick={() => setSplitType('itemized')}
                className={`py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  splitType === 'itemized'
                    ? 'bg-emerald-300 text-slate-900 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] border border-slate-900'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Itemized
              </button>
            </div>

            {/* SPLIT DETAILS RENDER DYNAMICALLY */}
            {splitType === '50/50' && amountStr && !isNaN(parseFloat(amountStr)) && (
              <div className="bg-indigo-50 border border-slate-900 p-2.5 rounded-xl flex justify-between gap-2 text-center shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] text-slate-900 font-black">
                <div className="flex-1">
                  <span className="text-[9px] text-slate-500 font-black uppercase">{nicknames.Ozric}</span>
                  <p className="text-base font-black font-mono text-slate-900">€{(parseFloat(amountStr) / 2).toFixed(2)}</p>
                </div>
                <div className="w-px h-8 bg-slate-900/30 self-center" />
                <div className="flex-1">
                  <span className="text-[9px] text-slate-500 font-black uppercase">{nicknames.Pawan}</span>
                  <p className="text-base font-black font-mono text-slate-900">€{(parseFloat(amountStr) / 2).toFixed(2)}</p>
                </div>
              </div>
            )}

            {splitType === 'custom' && (
              <div className="bg-slate-50 border border-slate-900 p-3 rounded-xl space-y-3 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-0.5">
                    <label className="text-[9px] text-slate-500 font-black font-mono uppercase">{nicknames.Ozric} (€)</label>
                    <input
                      id="input-split-custom-ozric"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={customOzricAmount}
                      onChange={(e) => setCustomOzricAmount(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-900 text-xs font-black font-mono text-slate-900 outline-none"
                    />
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[9px] text-slate-500 font-black font-mono uppercase">{nicknames.Pawan} (€)</label>
                    <input
                      id="input-split-custom-pawan"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={customPawanAmount}
                      onChange={(e) => setCustomPawanAmount(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-900 text-xs font-black font-mono text-slate-900 outline-none"
                    />
                  </div>
                </div>

                {amountStr && (
                  <div className="pt-1.5 border-t border-slate-200 flex justify-between text-[9px] font-mono font-bold">
                    <span className="text-slate-500">Target: €{parseFloat(amountStr).toFixed(2)}</span>
                    <span className={`font-black ${
                      Math.abs((parseFloat(customOzricAmount) || 0) + (parseFloat(customPawanAmount) || 0) - parseFloat(amountStr)) < 0.05
                        ? 'text-emerald-600'
                        : 'text-rose-600'
                    }`}>
                      Logged: €{((parseFloat(customOzricAmount) || 0) + (parseFloat(customPawanAmount) || 0)).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {splitType === 'itemized' && (
              <div className="bg-slate-50 border border-slate-900 p-3 rounded-xl space-y-2.5 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]">
                <div className="space-y-2">
                  <div className="space-y-0.5">
                    <label className="text-[9px] text-slate-500 font-black font-mono uppercase">Personal Owner</label>
                    <div className="grid grid-cols-2 gap-1.5 bg-slate-200 p-1 rounded-lg border border-slate-900">
                      <button
                        id="btn-itemized-owner-ozric"
                        type="button"
                        onClick={() => setPersonalUser('Ozric')}
                        className={`py-1 rounded text-xs font-black transition-all cursor-pointer ${
                          personalUser === 'Ozric' ? 'bg-indigo-600 text-white border border-slate-900' : 'text-slate-600'
                        }`}
                      >
                        {nicknames.Ozric}
                      </button>
                      <button
                        id="btn-itemized-owner-pawan"
                        type="button"
                        onClick={() => setPersonalUser('Pawan')}
                        className={`py-1 rounded text-xs font-black transition-all cursor-pointer ${
                          personalUser === 'Pawan' ? 'bg-indigo-600 text-white border border-slate-900' : 'text-slate-600'
                        }`}
                      >
                        {nicknames.Pawan}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[9px] text-slate-500 font-black font-mono uppercase">Personal Cost (€)</label>
                    <input
                      id="input-itemized-personal-amount"
                      type="number"
                      step="0.01"
                      placeholder="e.g. 15.00"
                      value={personalAmountStr}
                      onChange={(e) => setPersonalAmountStr(e.target.value)}
                      className="w-full px-2.5 py-1.5 rounded-lg bg-white border border-slate-900 text-xs font-black font-mono text-slate-900 outline-none"
                    />
                  </div>
                </div>

                {amountStr && personalAmountStr && !isNaN(parseFloat(amountStr)) && !isNaN(parseFloat(personalAmountStr)) && (
                  <div className="pt-2 border-t border-slate-200 text-[10px] space-y-1 font-bold text-slate-700">
                    <div className="bg-white rounded-lg p-2 flex justify-between font-mono font-black border border-slate-900 text-slate-900">
                      <div>
                        <span className="text-[8px] text-slate-500 block">{nicknames.Ozric}</span>
                        <span>
                          €{personalUser === 'Ozric' 
                            ? (parseFloat(personalAmountStr) + (parseFloat(amountStr) - parseFloat(personalAmountStr)) / 2).toFixed(2)
                            : ((parseFloat(amountStr) - parseFloat(personalAmountStr)) / 2).toFixed(2)
                          }
                        </span>
                      </div>
                      <div className="w-px h-6 bg-slate-900/30" />
                      <div>
                        <span className="text-[8px] text-slate-500 block">{nicknames.Pawan}</span>
                        <span>
                          €{personalUser === 'Pawan' 
                            ? (parseFloat(personalAmountStr) + (parseFloat(amountStr) - parseFloat(personalAmountStr)) / 2).toFixed(2)
                            : ((parseFloat(amountStr) - parseFloat(personalAmountStr)) / 2).toFixed(2)
                          }
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* OPTIONAL NOTES */}
          <div className="space-y-1">
            <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 font-mono">
              Notes (Optional)
            </label>
            <input
              id="input-expense-notes"
              type="text"
              placeholder="Extra details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 rounded-lg bg-slate-50 border border-slate-900 focus:bg-white focus:outline-none text-xs text-slate-800 font-bold placeholder:text-slate-400"
            />
          </div>

          {/* AUTO-DEDUCT FROM PERSONAL VAULT */}
          {(() => {
            const pOzric = parseFloat(payOzricAmount) || 0;
            const pPawan = parseFloat(payPawanAmount) || 0;
            const myPaidAmount = currentUser === 'Ozric' ? pOzric : pPawan;

            if (myPaidAmount <= 0) return null;

            return (
              <div className="bg-indigo-50/50 border border-slate-900 p-2.5 rounded-xl space-y-2 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <input
                      id="checkbox-auto-deduct"
                      type="checkbox"
                      checked={autoDeduct}
                      onChange={(e) => setAutoDeduct(e.target.checked)}
                      className="w-3.5 h-3.5 text-indigo-600 border border-slate-900 rounded cursor-pointer"
                    />
                    <label htmlFor="checkbox-auto-deduct" className="text-xs font-black text-slate-900 cursor-pointer select-none">
                      Deduct from Personal Wallet
                    </label>
                  </div>
                  <span className="text-[9px] font-mono font-black bg-white border border-slate-900 px-2 py-0.5 rounded-md">
                    €{myPaidAmount.toFixed(2)}
                  </span>
                </div>

                {autoDeduct && (
                  <div className="space-y-1.5 pl-5 border-l-2 border-indigo-200">
                    {personalAccounts.length === 0 ? (
                      <p className="text-[9px] text-rose-600 font-bold">
                        No private wallets found in Personal Finance.
                      </p>
                    ) : (
                      <div className="space-y-1">
                        <select
                          id="select-personal-account"
                          value={selectedPersonalAccountId}
                          onChange={(e) => setSelectedPersonalAccountId(e.target.value)}
                          className="w-full p-1.5 bg-white border border-slate-900 rounded-lg text-xs font-bold focus:outline-none"
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
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })()}

          {/* SUBMIT BUTTON */}
          <button
            id="btn-submit-expense"
            type="submit"
            disabled={isSubmitting}
            className="w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-200 bg-indigo-600 hover:bg-indigo-700 text-white border-2 border-slate-900 shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] disabled:opacity-50 mt-2 flex items-center justify-center gap-2 cursor-pointer min-h-[44px]"
          >
            {isSubmitting ? 'Adding Expense...' : 'Add Expense'}
          </button>
        </form>
      </div>
    </div>
  );
}
