import React, { useState, useEffect } from 'react';
import { Category, SplitType, Roommate } from '../types';
import { addExpense } from '../dbService';
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

export default function ExpenseForm({ currentUser, onClose, onSuccess, nicknames }: ExpenseFormProps) {
  const [title, setTitle] = useState('');
  const [amountStr, setAmountStr] = useState('');
  const [paidBy, setPaidBy] = useState<Roommate>(currentUser);
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

  // Sync active user profile when it shifts
  useEffect(() => {
    setPaidBy(currentUser);
  }, [currentUser]);

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

    setIsSubmitting(true);
    try {
      await addExpense({
        title: title.trim(),
        amount: totalAmount,
        paidBy,
        category,
        splitType,
        notes: notes.trim(),
        splitDetails: {
          OzricAmount: parseFloat(ozricShare.toFixed(2)),
          PawanAmount: parseFloat(pawanShare.toFixed(2))
        },
        itemizedDetails: itemizedDetails ? {
          personalUser: itemizedDetails.personalUser,
          personalAmount: parseFloat(itemizedDetails.personalAmount.toFixed(2))
        } : undefined,
        createdBy: currentUser,
        status: 'pending'
      });
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
        <div className="p-5 border-b-4 border-slate-100 flex items-center justify-between bg-indigo-50/25 sticky top-0 backdrop-blur z-10">
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 bg-pink-100 text-pink-600 rounded-2xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
              <Layers className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-lg font-black tracking-tight text-slate-900">Add Shared Expense</h3>
              <p className="text-xs text-slate-500 font-medium">Add a new receipt, bill or custom charge</p>
            </div>
          </div>
          <button 
            id="btn-close-expense-form"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 border-2 border-slate-200 hover:border-slate-900 transition duration-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* FORM */}
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-6 flex-1">
          {errorMsg && (
            <div className="bg-rose-100 border-2 border-slate-900 text-slate-900 text-xs rounded-2xl p-4 flex items-start gap-2.5 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] font-bold">
              <span className="mt-0.5">⚠️</span>
              <p className="leading-relaxed">{errorMsg}</p>
            </div>
          )}

          {/* TOTAL AMOUNT INPUT */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono">
              Total Amount (€)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-slate-900">
                <Euro className="w-6 h-6" />
              </div>
              <input
                id="input-expense-amount"
                type="number"
                step="0.01"
                placeholder="0.00"
                value={amountStr}
                onChange={(e) => setAmountStr(e.target.value)}
                required
                className="w-full pl-12 pr-4 py-4 rounded-2xl bg-slate-50 border-3 border-slate-900 focus:bg-white focus:outline-none text-2xl font-black font-mono tracking-tight text-slate-900 transition-all placeholder:text-slate-400 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]"
              />
            </div>
          </div>

          {/* DESCRIPTION TITLE */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono">
              Title / Item Description
            </label>
            <input
              id="input-expense-title"
              type="text"
              placeholder="e.g. Shared Groceries, Wi-Fi bill..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="w-full px-4 py-3.5 rounded-xl bg-slate-50 border-2 border-slate-900 focus:bg-white focus:outline-none text-sm font-bold text-slate-900 transition-all placeholder:text-slate-450"
            />
          </div>

          {/* CATEGORY GRID */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono">
              Category
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {CATEGORIES.map((cat) => {
                const Icon = cat.icon;
                const isSelected = category === cat.name;
                return (
                  <button
                    id={`btn-cat-${cat.name.replace(/\s+/g, '-').toLowerCase()}`}
                    key={cat.name}
                    type="button"
                    onClick={() => handleCategorySelect(cat.name)}
                    className={`flex items-center gap-2 px-2.5 py-3 rounded-xl border-2 transition-all duration-300 text-left cursor-pointer ${
                      isSelected
                        ? 'bg-amber-100 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] text-slate-900 font-black'
                        : 'bg-white border-slate-900 text-slate-500 font-bold hover:text-slate-800 hover:bg-slate-50'
                    }`}
                  >
                    <span className={`p-1 rounded-lg border-2 border-slate-900 ${isSelected ? 'bg-amber-400 text-slate-900' : 'bg-slate-100 text-slate-700'}`}>
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-[11px] font-extrabold truncate leading-none">
                      {cat.name.replace('/Delivery', '').replace(' (Coins)', '')}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* PAID BY */}
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono">
              Paid By
            </label>
            <div className="grid grid-cols-2 bg-slate-100 p-1.5 rounded-2xl border-2 border-slate-900">
              <button
                id="btn-paid-by-ozric"
                type="button"
                onClick={() => setPaidBy('Ozric')}
                className={`py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  paidBy === 'Ozric'
                    ? 'bg-indigo-600 text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] border-2 border-slate-900'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {nicknames.Ozric} Paid
              </button>
              <button
                id="btn-paid-by-pawan"
                type="button"
                onClick={() => setPaidBy('Pawan')}
                className={`py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all cursor-pointer ${
                  paidBy === 'Pawan'
                    ? 'bg-indigo-600 text-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] border-2 border-slate-900'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                {nicknames.Pawan} Paid
              </button>
            </div>
          </div>

          {/* SPLIT TYPE TABS */}
          <div className="space-y-3.5 pt-2 border-t-2 border-slate-100">
            <div className="flex items-center justify-between">
              <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono">
                Split Type
              </label>
              <span className="text-[10px] text-slate-500 font-black font-mono">
                Configure shares
              </span>
            </div>
            
            <div className="grid grid-cols-3 bg-slate-100 p-1.5 rounded-2xl border-2 border-slate-900">
              <button
                id="btn-split-5050"
                type="button"
                onClick={() => setSplitType('50/50')}
                className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  splitType === '50/50'
                    ? 'bg-emerald-300 text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] border-2 border-slate-900'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Equal
              </button>
              <button
                id="btn-split-custom"
                type="button"
                onClick={() => setSplitType('custom')}
                className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  splitType === 'custom'
                    ? 'bg-emerald-300 text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] border-2 border-slate-900'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Custom
              </button>
              <button
                id="btn-split-itemized"
                type="button"
                onClick={() => setSplitType('itemized')}
                className={`py-2 rounded-xl text-xs font-black transition-all cursor-pointer ${
                  splitType === 'itemized'
                    ? 'bg-emerald-300 text-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] border-2 border-slate-900'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Itemized
              </button>
            </div>

            {/* SPLIT DETAILS RENDER DYNAMICALLY */}
            {splitType === '50/50' && amountStr && !isNaN(parseFloat(amountStr)) && (
              <div className="bg-indigo-50 border-2 border-slate-900 p-4 rounded-2xl flex justify-between gap-4 text-center shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] text-slate-900 font-black">
                <div className="flex-1">
                  <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider">{nicknames.Ozric}'s Share</span>
                  <p className="text-lg font-black font-mono text-slate-900 mt-1">€{(parseFloat(amountStr) / 2).toFixed(2)}</p>
                </div>
                <div className="w-0.5 h-10 bg-slate-900 self-center" />
                <div className="flex-1">
                  <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider">{nicknames.Pawan}'s Share</span>
                  <p className="text-lg font-black font-mono text-slate-900 mt-1">€{(parseFloat(amountStr) / 2).toFixed(2)}</p>
                </div>
              </div>
            )}

            {splitType === 'custom' && (
              <div className="bg-slate-50 border-2 border-slate-900 p-4 rounded-2xl space-y-4 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
                <div className="flex items-center gap-2 text-[11px] text-slate-700 font-bold">
                  <HelpCircle className="w-4 h-4 shrink-0 text-slate-900" />
                  <span>Specify exact Euro parts for each user. Sum must equal total.</span>
                </div>

                <div className="grid grid-cols-2 gap-3.5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 font-black font-mono uppercase">{nicknames.Ozric} Share (€)</label>
                    <input
                      id="input-split-custom-ozric"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={customOzricAmount}
                      onChange={(e) => setCustomOzricAmount(e.target.value)}
                      className="w-full pl-3 pr-3 py-2.5 rounded-xl bg-white border-2 border-slate-900 text-sm font-black font-mono text-slate-900 focus:bg-indigo-50/50 outline-none"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 font-black font-mono uppercase">{nicknames.Pawan} Share (€)</label>
                    <input
                      id="input-split-custom-pawan"
                      type="number"
                      step="0.01"
                      placeholder="0.00"
                      value={customPawanAmount}
                      onChange={(e) => setCustomPawanAmount(e.target.value)}
                      className="w-full pl-3 pr-3 py-2.5 rounded-xl bg-white border-2 border-slate-900 text-sm font-black font-mono text-slate-900 focus:bg-indigo-50/50 outline-none"
                    />
                  </div>
                </div>

                {amountStr && (
                  <div className="pt-2.5 border-t border-slate-200 flex justify-between text-[11px] font-mono font-bold">
                    <span className="text-slate-500">Target: €{parseFloat(amountStr).toFixed(2)}</span>
                    <span className={`font-black ${
                      Math.abs((parseFloat(customOzricAmount) || 0) + (parseFloat(customPawanAmount) || 0) - parseFloat(amountStr)) < 0.05
                        ? 'text-emerald-600'
                        : 'text-rose-600'
                    }`}>
                      Sum logged: €{((parseFloat(customOzricAmount) || 0) + (parseFloat(customPawanAmount) || 0)).toFixed(2)}
                    </span>
                  </div>
                )}
              </div>
            )}

            {splitType === 'itemized' && (
              <div className="bg-slate-50 border-2 border-slate-900 p-4 rounded-2xl space-y-4 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
                <div className="flex items-start gap-2 text-[11px] text-slate-700 font-bold">
                  <HelpCircle className="w-4 h-4 shrink-0 mt-0.5 text-slate-900" />
                  <p>Input a personal item cost first. The remaining bill splits equally.</p>
                </div>

                <div className="space-y-3.5">
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 font-black font-mono uppercase">Whose Personal Item?</label>
                    <div className="grid grid-cols-2 gap-2 bg-slate-200 p-1.5 rounded-xl border-2 border-slate-900">
                      <button
                        id="btn-itemized-owner-ozric"
                        type="button"
                        onClick={() => setPersonalUser('Ozric')}
                        className={`py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                          personalUser === 'Ozric' ? 'bg-indigo-600 text-white shadow-md border border-slate-900' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {nicknames.Ozric}
                      </button>
                      <button
                        id="btn-itemized-owner-pawan"
                        type="button"
                        onClick={() => setPersonalUser('Pawan')}
                        className={`py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                          personalUser === 'Pawan' ? 'bg-indigo-600 text-white shadow-md border border-slate-900' : 'text-slate-500 hover:text-slate-700'
                        }`}
                      >
                        {nicknames.Pawan}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[10px] text-slate-500 font-black font-mono uppercase">Personal Item Amount (€)</label>
                    <input
                      id="input-itemized-personal-amount"
                      type="number"
                      step="0.01"
                      placeholder="e.g. 15.00"
                      value={personalAmountStr}
                      onChange={(e) => setPersonalAmountStr(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-white border-2 border-slate-900 text-sm font-black font-mono text-slate-900 focus:bg-indigo-50/50 outline-none"
                    />
                  </div>
                </div>

                {amountStr && personalAmountStr && !isNaN(parseFloat(amountStr)) && !isNaN(parseFloat(personalAmountStr)) && (
                  <div className="pt-3 border-t border-slate-200 text-xs space-y-2 font-bold text-slate-700">
                    <p className="text-slate-500 font-mono text-[11px]">
                      Shared portion: €{(parseFloat(amountStr) - parseFloat(personalAmountStr)).toFixed(2)} (€{((parseFloat(amountStr) - parseFloat(personalAmountStr)) / 2).toFixed(2)} each)
                    </p>
                    <div className="bg-white rounded-2xl p-3 flex justify-between font-mono font-black border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] text-slate-900">
                      <div>
                        <span className="text-[9px] text-slate-500 block">{nicknames.Ozric} Share</span>
                        <span>
                          €{personalUser === 'Ozric' 
                            ? (parseFloat(personalAmountStr) + (parseFloat(amountStr) - parseFloat(personalAmountStr)) / 2).toFixed(2)
                            : ((parseFloat(amountStr) - parseFloat(personalAmountStr)) / 2).toFixed(2)
                          }
                        </span>
                      </div>
                      <div className="w-0.5 h-8 bg-slate-900" />
                      <div>
                        <span className="text-[9px] text-slate-500 block">{nicknames.Pawan} Share</span>
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
          <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono">
              Notes (Optional)
            </label>
            <textarea
              id="input-expense-notes"
              placeholder="Store any extra context or transaction details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-900 focus:bg-white focus:outline-none text-xs text-slate-800 transition-all placeholder:text-slate-400 resize-none font-bold"
            />
          </div>

          {/* SUBMIT BUTTON */}
          <button
            id="btn-submit-expense"
            type="submit"
            disabled={isSubmitting}
            className="w-full py-4 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-300 bg-indigo-600 text-white border-3 border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-50 mt-4 flex items-center justify-center gap-2 cursor-pointer"
          >
            {isSubmitting ? 'Adding Expense...' : 'Add Expense'}
          </button>
        </form>
      </div>
    </div>
  );
}
