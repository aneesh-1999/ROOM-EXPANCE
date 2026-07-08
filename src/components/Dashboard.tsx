import React from 'react';
import { Expense, Roommate, Profile } from '../types';
import { ArrowUpRight, ArrowDownLeft, CheckCircle2, DollarSign, Wallet, Coins, Target, Sparkles, Phone } from 'lucide-react';

interface DashboardProps {
  expenses: Expense[];
  currentUser: Roommate;
  onOpenAddExpense: () => void;
  onOpenSettleUp: () => void;
  onOpenLendBorrow: () => void;
  nicknames: Record<Roommate, string>;
  profiles?: Record<Roommate, Profile>;
}

export default function Dashboard({ 
  expenses, 
  currentUser, 
  onOpenAddExpense, 
  onOpenSettleUp, 
  onOpenLendBorrow, 
  nicknames,
  profiles
}: DashboardProps) {
  // Compute balances
  // Net Balance = (Sum of Pawan's share of expenses paid by Ozric) - (Sum of Ozric's share of expenses paid by Pawan)
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

  const otherUser: Roommate = currentUser === 'Ozric' ? 'Pawan' : 'Ozric';
  const otherUserLabel = nicknames[otherUser] || otherUser;

  // Determine user perspective balance
  let perspectiveBalance = 0;
  let isOwed = false;
  let isEven = false;

  if (Math.abs(netBalance) < 0.01) {
    isEven = true;
  } else if (currentUser === 'Ozric') {
    if (netBalance > 0) {
      perspectiveBalance = netBalance;
      isOwed = true;
    } else {
      perspectiveBalance = Math.abs(netBalance);
      isOwed = false;
    }
  } else { // Pawan is current user
    if (netBalance < 0) {
      perspectiveBalance = Math.abs(netBalance);
      isOwed = true;
    } else {
      perspectiveBalance = netBalance;
      isOwed = false;
    }
  }

  // Monthly active stats (for items created this calendar month)
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const currentMonthExpenses = expenses.filter(exp => {
    if (exp.isSettlement || exp.isLendBorrow || exp.status === 'pending') return false;
    const date = new Date(exp.timestamp);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });

  const totalMonthlySpend = currentMonthExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  const userPaidThisMonth = currentMonthExpenses
    .filter(exp => exp.paidBy === currentUser)
    .reduce((sum, exp) => sum + exp.amount, 0);

  return (
    <div className="space-y-6">
      {/* PERSPECTIVE CARD */}
      <div className={`relative overflow-hidden rounded-3xl border-4 border-slate-900 p-6 md:p-8 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] transition-all duration-300 ${
        isEven 
          ? 'bg-amber-100' 
          : isOwed 
            ? 'bg-emerald-100' 
            : 'bg-rose-100'
      }`}>
        
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <span className="text-[10px] font-black tracking-widest text-slate-700 uppercase font-mono bg-white/60 border border-slate-900 px-2 py-0.5 rounded-md">
              Net Summary Balance
            </span>
            
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-black font-display tracking-tight text-slate-900">
                €{perspectiveBalance.toFixed(2)}
              </span>
            </div>

            <p className="text-sm font-bold flex items-center gap-2 mt-1">
              {isEven ? (
                <>
                  <CheckCircle2 className="w-5 h-5 text-slate-900" />
                  <span className="text-slate-800">You and {otherUserLabel} are fully settled up!</span>
                </>
              ) : isOwed ? (
                <>
                  <span className="inline-flex p-1 rounded-full bg-emerald-200 text-emerald-800 border border-slate-900">
                    <ArrowUpRight className="w-4 h-4" />
                  </span>
                  <span className="text-slate-900 font-extrabold">{otherUserLabel} owes you €{perspectiveBalance.toFixed(2)}</span>
                </>
              ) : (
                <>
                  <span className="inline-flex p-1 rounded-full bg-rose-200 text-rose-800 border border-slate-900">
                    <ArrowDownLeft className="w-4 h-4" />
                  </span>
                  <span className="text-slate-900 font-extrabold">You owe {otherUserLabel} €{perspectiveBalance.toFixed(2)}</span>
                </>
              )}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row md:flex-col gap-3.5 justify-end w-full md:w-auto">
            <button
              id="btn-add-expense-quick"
              onClick={onOpenAddExpense}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-300 bg-indigo-600 text-white border-3 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Wallet className="w-4 h-4" />
              Add Expense
            </button>

            <button
              id="btn-lend-borrow-quick"
              onClick={onOpenLendBorrow}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-300 bg-violet-600 text-white border-3 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Coins className="w-4 h-4" />
              Lend / Borrow
            </button>
            
            {!isEven && (
              <button
                id="btn-settle-up-quick"
                onClick={onOpenSettleUp}
                className="w-full sm:w-auto px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-300 bg-amber-400 text-slate-900 border-3 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] flex items-center justify-center gap-2 cursor-pointer"
              >
                Settle Up
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Spend Tracker & Roommate Contact helper */}
      {(() => {
        const currentUserProfile = profiles?.[currentUser];
        const otherUser = currentUser === 'Ozric' ? 'Pawan' : 'Ozric';
        const otherUserProfile = profiles?.[otherUser];
        const currentUserBudget = currentUserProfile?.monthlyBudget;
        const budgetPercentage = currentUserBudget ? (userPaidThisMonth / currentUserBudget) * 100 : 0;
        const currentUserLabel = nicknames[currentUser] || currentUser;

        return (currentUserBudget || otherUserProfile?.phone) ? (
          <div className="grid grid-cols-1 gap-4">
            {currentUserBudget && (
              <div className="bg-white border-4 border-slate-900 rounded-3xl p-6 shadow-[5px_5px_0px_0px_rgba(15,23,42,1)] space-y-3.5">
                <div className="flex justify-between items-center text-xs font-black uppercase tracking-wider text-slate-800">
                  <span className="flex items-center gap-2 font-mono text-[10px] text-slate-500">
                    <Target className="w-4 h-4 text-slate-600" />
                    Monthly Spend vs Budget ({currentUserProfile?.avatar || '👤'} {currentUserLabel})
                  </span>
                  <span className="font-mono bg-indigo-50 border-2 border-slate-900 px-3 py-1 rounded-xl text-indigo-700 text-xs shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]">
                    €{userPaidThisMonth.toFixed(2)} / €{currentUserBudget}
                  </span>
                </div>
                
                <div className="w-full bg-slate-100 rounded-2xl h-5 border-3 border-slate-900 overflow-hidden relative">
                  <div 
                    className={`h-full transition-all duration-500 rounded-l-md border-r-2 border-slate-900 ${
                      budgetPercentage >= 100 
                        ? 'bg-rose-500' 
                        : budgetPercentage >= 85 
                          ? 'bg-amber-400' 
                          : 'bg-emerald-400'
                    }`}
                    style={{ width: `${Math.min(budgetPercentage, 100)}%` }}
                  />
                </div>
                <div className="flex justify-between text-[10px] text-slate-500 font-bold font-mono">
                  <span>0% Budget Used</span>
                  <span className={budgetPercentage >= 100 ? 'text-rose-600 animate-pulse' : 'text-slate-700'}>
                    {budgetPercentage.toFixed(0)}% Used {budgetPercentage >= 100 && '⚠️ (Budget Exceeded!)'}
                  </span>
                  <span>100%</span>
                </div>
              </div>
            )}

            {otherUserProfile?.phone && !isEven && !isOwed && (
              <div className="bg-amber-50 border-3 border-slate-900 rounded-2xl p-4 flex items-center justify-between gap-3 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
                <div className="flex items-center gap-2.5">
                  <span className="p-2 bg-amber-100 text-amber-700 rounded-xl border-2 border-slate-900">
                    <Phone className="w-4 h-4" />
                  </span>
                  <div>
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-amber-900 font-mono">Reimbursement Quick Dial</h5>
                    <p className="text-[11px] text-slate-600 font-medium">Need to request {otherUserLabel}'s bank or payment details?</p>
                  </div>
                </div>
                <a 
                  href={`tel:${otherUserProfile.phone}`}
                  className="px-3.5 py-1.5 bg-slate-900 text-white rounded-xl text-[10px] font-black tracking-wider uppercase border-2 border-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] hover:bg-slate-850 hover:border-slate-850 active:translate-x-[1px] active:translate-y-[1px] transition duration-200"
                >
                  Call {otherUserProfile.nickname || otherUser}
                </a>
              </div>
            )}
          </div>
        ) : null;
      })()}

      {/* QUICK STATS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border-4 border-slate-900 rounded-3xl p-6 flex items-center justify-between shadow-[5px_5px_0px_0px_rgba(15,23,42,1)]">
          <div className="space-y-1">
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest font-mono">Monthly Household Spend</p>
            <p className="text-2xl font-black font-display text-slate-900">€{totalMonthlySpend.toFixed(2)}</p>
            <p className="text-[11px] text-slate-500 font-semibold">{currentMonthExpenses.length} entries in {new Date().toLocaleString('default', { month: 'long' })}</p>
          </div>
          <div className="bg-violet-100 text-violet-600 p-3 rounded-2xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-white border-4 border-slate-900 rounded-3xl p-6 flex items-center justify-between shadow-[5px_5px_0px_0px_rgba(15,23,42,1)]">
          <div className="space-y-1">
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest font-mono">Your Spend Contribution</p>
            <p className="text-2xl font-black font-display text-emerald-600">€{userPaidThisMonth.toFixed(2)}</p>
            <p className="text-[11px] text-slate-500 font-semibold">
              {totalMonthlySpend > 0 
                ? `${((userPaidThisMonth / totalMonthlySpend) * 100).toFixed(0)}% of monthly total` 
                : 'No household spending logged'
              }
            </p>
          </div>
          <div className="bg-emerald-100 text-emerald-600 p-3 rounded-2xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
            <Wallet className="w-6 h-6" />
          </div>
        </div>
      </div>
    </div>
  );
}
