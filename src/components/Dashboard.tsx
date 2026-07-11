import React from 'react';
import { Expense, Roommate, Profile, RecurringBill } from '../types';
import { ArrowUpRight, ArrowDownLeft, CheckCircle2, DollarSign, Wallet, Coins, Target, Sparkles, Phone, MessageSquare, Check, X, Clock, AlertCircle, Camera, Bell, Zap, Calendar } from 'lucide-react';
import { confirmExpense, deleteExpense, cancelDeleteExpense } from '../dbService';

interface DashboardProps {
  expenses: Expense[];
  currentUser: Roommate;
  onOpenAddExpense: () => void;
  onOpenSettleUp: () => void;
  onOpenLendBorrow: () => void;
  onOpenReceiptScanner?: () => void;
  nicknames: Record<Roommate, string>;
  profiles?: Record<Roommate, Profile>;
  recurringBills?: RecurringBill[];
}

export default function Dashboard({ 
  expenses, 
  currentUser, 
  onOpenAddExpense, 
  onOpenSettleUp, 
  onOpenLendBorrow, 
  onOpenReceiptScanner,
  nicknames,
  profiles,
  recurringBills
}: DashboardProps) {
  const [actionLoading, setActionLoading] = React.useState<string | null>(null);
  const [errorMsg, setErrorMsg] = React.useState<string>('');

  const handleApproveCreation = async (id: string) => {
    setActionLoading(id);
    setErrorMsg('');
    try {
      await confirmExpense(id, currentUser);
    } catch (err: any) {
      setErrorMsg('Failed to approve transaction: ' + (err.message || err));
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectCreation = async (exp: Expense) => {
    if (!exp.id) return;
    setActionLoading(exp.id);
    setErrorMsg('');
    try {
      await deleteExpense(exp.id, currentUser);
    } catch (err: any) {
      setErrorMsg('Failed to reject transaction: ' + (err.message || err));
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveDeletion = async (id: string) => {
    setActionLoading(id);
    setErrorMsg('');
    try {
      await deleteExpense(id, currentUser);
    } catch (err: any) {
      setErrorMsg('Failed to approve deletion: ' + (err.message || err));
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectDeletion = async (id: string) => {
    setActionLoading(id);
    setErrorMsg('');
    try {
      await cancelDeleteExpense(id, currentUser);
    } catch (err: any) {
      setErrorMsg('Failed to reject deletion request: ' + (err.message || err));
    } finally {
      setActionLoading(null);
    }
  };

  // Find all items needing current user's approval
  const pendingApprovals = expenses.filter((exp) => {
    const isCreatedByOther = exp.createdBy ? exp.createdBy !== currentUser : exp.paidBy !== currentUser;
    const needsCreationApproval = exp.status === 'pending' && isCreatedByOther;
    
    const isDeleteRequestedByOther = exp.deleteRequestedBy ? exp.deleteRequestedBy !== currentUser : false;
    const needsDeletionApproval = exp.deleteRequested && isDeleteRequestedByOther;
    
    return needsCreationApproval || needsDeletionApproval;
  });

  // Compute balances
  // Net Balance = (Sum of Pawan's share of expenses paid by Ozric) - (Sum of Ozric's share of expenses paid by Pawan)
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

  const [customMsg, setCustomMsg] = React.useState('');

  React.useEffect(() => {
    setCustomMsg(`Hey ${otherUserLabel}! I want to settle my roommate balance of €${perspectiveBalance.toFixed(2)}. Could you please send me your bank or payment details? Thanks!`);
  }, [perspectiveBalance, otherUserLabel]);

  // Monthly active stats (for items created this calendar month)
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const currentMonthExpenses = expenses.filter(exp => {
    if (exp.isSettlement || exp.isLendBorrow || exp.status === 'pending') return false;
    const date = new Date(exp.timestamp);
    return date.getMonth() === currentMonth && date.getFullYear() === currentYear;
  });

  const totalMonthlySpend = currentMonthExpenses.reduce((sum, exp) => sum + exp.amount, 0);
  const userPaidThisMonth = currentMonthExpenses.reduce((sum, exp) => {
    let amtPaid = 0;
    if (exp.paymentDistribution) {
      amtPaid = currentUser === 'Ozric' ? (exp.paymentDistribution.OzricAmount ?? 0) : (exp.paymentDistribution.PawanAmount ?? 0);
    } else {
      if (exp.paidBy === currentUser) {
        amtPaid = exp.amount;
      }
    }
    return sum + amtPaid;
  }, 0);

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
              id="btn-scan-receipt-quick"
              onClick={onOpenReceiptScanner}
              className="w-full sm:w-auto px-6 py-3.5 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-300 bg-emerald-500 text-white border-3 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] flex items-center justify-center gap-2 cursor-pointer"
            >
              <Camera className="w-4 h-4" />
              Scan Receipt (OCR)
            </button>

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

      {/* SMART NOTIFICATIONS BOX */}
      {(() => {
        const pendingCount = pendingApprovals.length;

        // Electricity wallet difference
        const confirmedCoins = expenses.filter((exp) => exp.isCoin && exp.status !== 'pending');
        const ozricCoinTotal = confirmedCoins
          .filter((exp) => exp.paidBy === 'Ozric')
          .reduce((sum, exp) => sum + exp.amount, 0);
        const pawanCoinTotal = confirmedCoins
          .filter((exp) => exp.paidBy === 'Pawan')
          .reduce((sum, exp) => sum + exp.amount, 0);
        const coinDiff = Math.abs(ozricCoinTotal - pawanCoinTotal);
        const lowerCoinContributor = ozricCoinTotal < pawanCoinTotal ? 'Ozric' : 'Pawan';
        const hasCoinDiff = coinDiff > 0.01;

        // Rent & Recurring Bills Due Tomorrow
        const today = new Date();
        const tomorrow = new Date(today.getTime() + 24 * 60 * 60 * 1000);
        const tomorrowDay = tomorrow.getDate();
        
        const billsDueTomorrow = recurringBills?.filter(bill => bill.dueDate === tomorrowDay) || [];
        
        // Show fallback if they don't have recurring bills initialized in the DB yet
        const showRentFallback = !recurringBills || recurringBills.length === 0;
        
        const totalNotificationCount = pendingCount + (hasCoinDiff ? 1 : 0) + billsDueTomorrow.length + (showRentFallback ? 1 : 0);

        const mapCategoryLabel = (category: string) => {
          if (category === 'Shared Groceries') return 'Grocery';
          if (category === 'Electricity (Coins)') return 'Electricity';
          if (category === 'Household Supplies') return 'Household';
          if (category === 'Takeout/Delivery') return 'Takeout';
          return category;
        };

        return (
          <div className="bg-indigo-50 border-4 border-slate-900 rounded-3xl p-6 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] space-y-4 transition-all">
            <div className="flex items-center justify-between border-b-2 border-slate-200 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                  <Bell className="w-4 h-4 text-white" />
                </div>
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-wider font-display">
                  Smart Notifications
                </h4>
              </div>
              {totalNotificationCount > 0 && (
                <span className="bg-rose-500 text-white text-xs font-black px-2.5 py-1 rounded-full border-2 border-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]">
                  {totalNotificationCount}
                </span>
              )}
            </div>

            {errorMsg && (
              <div className="p-2.5 bg-red-100 border-2 border-red-500 rounded-xl text-xs text-red-800 font-bold flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-red-600 animate-bounce" />
                <span>{errorMsg}</span>
              </div>
            )}

            <div className="divide-y-2 divide-slate-200/60 space-y-4">
              {/* 1. Pending Roommate Approvals */}
              {pendingApprovals.length > 0 ? (
                pendingApprovals.map((exp, index) => {
                  const isDeletion = exp.deleteRequested;
                  const requester = isDeletion ? exp.deleteRequestedBy : (exp.createdBy || exp.paidBy);
                  const requesterNick = nicknames[requester as Roommate] || requester;
                  
                  return (
                    <div key={exp.id} className={`${index > 0 ? 'pt-4' : ''} flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
                      <div className="space-y-1">
                        <h5 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-2">
                          <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-ping"></span>
                          {requesterNick} added {mapCategoryLabel(exp.category)} €{exp.amount.toFixed(0)}
                        </h5>
                        <p className="text-xs font-bold text-amber-600 uppercase tracking-wider font-mono">
                          Approve?
                        </p>
                        {exp.title !== exp.category && (
                          <p className="text-[10px] text-slate-500 font-medium">
                            Description: <strong className="text-slate-700 font-semibold">{exp.title}</strong>
                          </p>
                        )}
                      </div>

                      <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                        {isDeletion ? (
                          <>
                            <button
                              type="button"
                              id={`dash-btn-approve-del-${exp.id}`}
                              disabled={actionLoading === exp.id}
                              onClick={() => exp.id && handleApproveDeletion(exp.id)}
                              className="bg-rose-500 hover:bg-rose-600 text-white border-2 border-slate-900 px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] cursor-pointer disabled:opacity-50 flex items-center gap-1 font-sans"
                            >
                              <Check className="w-3.5 h-3.5" /> Approve Delete
                            </button>
                            <button
                              type="button"
                              id={`dash-btn-reject-del-${exp.id}`}
                              disabled={actionLoading === exp.id}
                              onClick={() => exp.id && handleRejectDeletion(exp.id)}
                              className="bg-slate-100 hover:bg-slate-200 text-slate-800 border-2 border-slate-900 px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] cursor-pointer disabled:opacity-50 flex items-center gap-1 font-sans"
                            >
                              <X className="w-3.5 h-3.5" /> Reject
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              id={`dash-btn-approve-new-${exp.id}`}
                              disabled={actionLoading === exp.id}
                              onClick={() => exp.id && handleApproveCreation(exp.id)}
                              className="bg-emerald-500 hover:bg-emerald-600 text-white border-2 border-slate-900 px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] cursor-pointer disabled:opacity-50 flex items-center gap-1 font-sans"
                            >
                              <Check className="w-3.5 h-3.5" /> Approve
                            </button>
                            <button
                              type="button"
                              id={`dash-btn-reject-new-${exp.id}`}
                              disabled={actionLoading === exp.id}
                              onClick={() => handleRejectCreation(exp)}
                              className="bg-rose-100 hover:bg-rose-200 text-rose-800 border-2 border-slate-900 px-3.5 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] cursor-pointer disabled:opacity-50 flex items-center gap-1 font-sans"
                            >
                              <X className="w-3.5 h-3.5" /> Reject
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })
              ) : null}

              {/* 2. Electricity Wallet Difference */}
              {hasCoinDiff && (
                <div className={`pt-4 ${pendingCount === 0 ? 'first:pt-0 border-t-0' : 'border-t-2 border-slate-200/60'} flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
                  <div className="space-y-1">
                    <h5 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                      <Zap className="w-4 h-4 text-amber-500 fill-amber-400" />
                      Electricity wallet difference
                    </h5>
                    <p className="text-2xl font-black text-slate-900 font-display">
                      €{coinDiff.toFixed(0)}
                    </p>
                    <p className="text-xs text-slate-500 font-semibold leading-tight">
                      {currentUser === lowerCoinContributor ? (
                        <>
                          You are behind on electricity coin contributions. Add €{coinDiff.toFixed(0)} to balance the meter.
                        </>
                      ) : (
                        <>
                          {nicknames[lowerCoinContributor] || lowerCoinContributor} is behind on electricity coin contributions by €{coinDiff.toFixed(0)}.
                        </>
                      )}
                    </p>
                  </div>
                  
                  {currentUser === lowerCoinContributor && (
                    <button
                      type="button"
                      onClick={() => {
                        const coinSection = document.getElementById('coin-meter-card');
                        if (coinSection) {
                          coinSection.scrollIntoView({ behavior: 'smooth' });
                        }
                      }}
                      className="bg-amber-400 hover:bg-amber-500 text-slate-900 border-2 border-slate-900 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] cursor-pointer flex items-center gap-1.5 self-start sm:self-auto font-sans"
                    >
                      <Coins className="w-3.5 h-3.5" /> Insert Coin
                    </button>
                  )}
                </div>
              )}

              {/* 3. Rent & Recurring Bills Due Tomorrow */}
              {billsDueTomorrow.length > 0 ? (
                billsDueTomorrow.map((bill, idx) => (
                  <div key={bill.id} className={`pt-4 ${(!hasCoinDiff && pendingCount === 0 && idx === 0) ? 'first:pt-0 border-t-0' : 'border-t-2 border-slate-200/60'} flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
                    <div className="space-y-1">
                      <h5 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                        <Calendar className="w-4 h-4 text-indigo-500" />
                        {bill.name} due tomorrow
                      </h5>
                      <p className="text-2xl font-black text-slate-900 font-display">
                        €{bill.amount.toFixed(0)}
                      </p>
                      <p className="text-xs text-slate-500 font-semibold leading-tight">
                        Keep your private vault funded to auto-deduct recurring {bill.name.toLowerCase()} payments.
                      </p>
                    </div>
                  </div>
                ))
              ) : null}

              {/* Fallback Rent reminder if they haven't set up recurring rent in their vault yet */}
              {showRentFallback && (
                <div className={`pt-4 ${(!hasCoinDiff && pendingCount === 0) ? 'first:pt-0 border-t-0' : 'border-t-2 border-slate-200/60'} flex flex-col sm:flex-row sm:items-center justify-between gap-4`}>
                  <div className="space-y-1">
                    <h5 className="text-sm font-black text-slate-900 tracking-tight flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-indigo-500 animate-pulse" />
                      Rent due tomorrow
                    </h5>
                    <p className="text-2xl font-black text-slate-900 font-display">
                      €350
                    </p>
                    <p className="text-xs text-slate-500 font-semibold leading-tight">
                      Please make sure your private account has sufficient funds to cover the upcoming rent cycle.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })()}

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
              <div className="bg-emerald-50 border-3 border-slate-900 rounded-2xl p-5 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] space-y-3.5">
                <div className="flex items-start gap-2.5">
                  <span className="p-2.5 bg-emerald-100 text-emerald-800 rounded-xl border-2 border-slate-900 shrink-0">
                    <MessageSquare className="w-5 h-5 stroke-[2.5]" />
                  </span>
                  <div>
                    <h5 className="text-[10px] font-black uppercase tracking-widest text-emerald-900 font-mono">Reimbursement Request via WhatsApp</h5>
                    <p className="text-xs text-slate-600 font-medium mt-0.5">Customize and send a direct message to {otherUserLabel} to coordinate settling your balance.</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <textarea
                    value={customMsg}
                    onChange={(e) => setCustomMsg(e.target.value)}
                    rows={2}
                    className="w-full bg-white border-2 border-slate-900 rounded-xl p-3 text-xs text-slate-800 font-medium outline-none focus:ring-0 resize-none shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]"
                    placeholder="Enter custom message..."
                  />
                  <div className="flex justify-end">
                    <a 
                      href={`https://wa.me/${otherUserProfile.phone.replace(/\D/g, '')}?text=${encodeURIComponent(customMsg)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-black tracking-wide uppercase border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] transition-all duration-200 inline-flex items-center gap-1.5"
                    >
                      <span>💬 Send WhatsApp</span>
                    </a>
                  </div>
                </div>
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
