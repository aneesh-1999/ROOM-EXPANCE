import React, { useState, useEffect } from 'react';
import { Expense, Category, Roommate } from '../types';
import { deleteExpense, confirmExpense, requestDeleteExpense, cancelDeleteExpense } from '../dbService';
import CustomConfirmModal from './CustomConfirmModal';
import { 
  Trash2, 
  ShoppingCart, 
  Home, 
  Zap, 
  Wifi, 
  Utensils, 
  MoreHorizontal, 
  Sparkles, 
  Filter,
  Calendar,
  Coins,
  Check,
  X,
  Clock,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';

interface ExpenseHistoryProps {
  expenses: Expense[];
  currentUser: Roommate;
  onDeleteSuccess: () => void;
  nicknames: Record<Roommate, string>;
}

const CATEGORY_MAP: Record<Category, { icon: React.ComponentType<any>; bg: string; text: string }> = {
  'Shared Groceries': { icon: ShoppingCart, bg: 'bg-emerald-100 text-emerald-850 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]', text: 'text-emerald-800' },
  'Household Supplies': { icon: Sparkles, bg: 'bg-sky-100 text-sky-850 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]', text: 'text-sky-850' },
  'Rent': { icon: Home, bg: 'bg-indigo-100 text-indigo-850 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]', text: 'text-indigo-850' },
  'Electricity (Coins)': { icon: Zap, bg: 'bg-amber-100 text-amber-850 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]', text: 'text-amber-850' },
  'Internet/Wi-Fi': { icon: Wifi, bg: 'bg-violet-100 text-violet-850 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]', text: 'text-violet-850' },
  'Takeout/Delivery': { icon: Utensils, bg: 'bg-rose-100 text-rose-850 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]', text: 'text-rose-850' },
  'Other': { icon: MoreHorizontal, bg: 'bg-slate-100 text-slate-800 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]', text: 'text-slate-800' },
};

export default function ExpenseHistory({ expenses, currentUser, onDeleteSuccess, nicknames }: ExpenseHistoryProps) {
  const [filterMonth, setFilterMonth] = useState<string>('all');
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(5);

  // Reset pagination on filter change
  useEffect(() => {
    setVisibleCount(5);
  }, [filterMonth, filterCategory]);

  // State for Custom Confirmation Modal
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const showConfirm = (options: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }) => {
    setConfirmState({
      isOpen: true,
      ...options
    });
  };

  const closeConfirm = () => {
    setConfirmState(prev => ({ ...prev, isOpen: false }));
  };

  const handleApprove = async (id: string) => {
    setApprovingId(id);
    try {
      await confirmExpense(id, currentUser);
      onDeleteSuccess();
    } catch (error) {
      console.error("Failed to confirm: ", error);
    } finally {
      setApprovingId(null);
    }
  };

  // Parse list of unique months for the dropdown (e.g., "July 2026")
  const getMonthYearString = (date: Date) => {
    return date.toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  const getMonthYearValue = (date: Date) => {
    return `${date.getMonth()}-${date.getFullYear()}`;
  };

  const uniqueMonthsMap = new Map<string, string>();
  expenses.forEach((exp) => {
    const d = new Date(exp.timestamp);
    uniqueMonthsMap.set(getMonthYearValue(d), getMonthYearString(d));
  });

  const uniqueMonths = Array.from(uniqueMonthsMap.entries()).map(([value, label]) => ({ value, label }));

  // Apply filters
  const filteredExpenses = expenses.filter((exp) => {
    const d = new Date(exp.timestamp);
    const monthVal = getMonthYearValue(d);
    
    const monthMatch = filterMonth === 'all' || monthVal === filterMonth;
    const categoryMatch = filterCategory === 'all' || exp.category === filterCategory;

    return monthMatch && categoryMatch;
  });

  // Calculate monthly stats for the active filter set (visual bento distribution)
  const categoryTotals: Record<string, number> = {};
  let totalForBreakdown = 0;

  filteredExpenses.forEach((exp) => {
    if (exp.isSettlement || exp.isLendBorrow || exp.status === 'pending') return; // skip settlements and cash loans in distribution charts
    categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
    totalForBreakdown += exp.amount;
  });

  const categoryDistribution = Object.entries(categoryTotals)
    .map(([cat, amount]) => ({
      category: cat as Category,
      amount,
      percentage: totalForBreakdown > 0 ? (amount / totalForBreakdown) * 100 : 0
    }))
    .sort((a, b) => b.amount - a.amount);

  const handleDelete = async (exp: Expense) => {
    if (!exp.id) return;
    
    // If it's a pending creation, we can delete it immediately (either cancel or reject)
    if (exp.status === 'pending') {
      const confirmMsg = exp.createdBy === currentUser 
        ? 'Are you sure you want to cancel this pending transaction request?' 
        : 'Are you sure you want to reject this transaction request?';
      
      showConfirm({
        title: exp.createdBy === currentUser ? 'Cancel Request' : 'Reject Request',
        message: confirmMsg,
        confirmLabel: exp.createdBy === currentUser ? 'Cancel Request' : 'Reject Request',
        isDestructive: true,
        onConfirm: async () => {
          setDeletingId(exp.id!);
          try {
            await deleteExpense(exp.id!, currentUser);
            onDeleteSuccess();
          } catch (error) {
            alert("Failed to delete transaction: " + error);
          } finally {
            setDeletingId(null);
          }
        }
      });
      return;
    }

    // If it's already requested for deletion
    if (exp.deleteRequested) {
      if (exp.deleteRequestedBy === currentUser) {
        // Current user requested delete, clicking trash can cancels it
        setDeletingId(exp.id);
        try {
          await cancelDeleteExpense(exp.id, currentUser);
          onDeleteSuccess();
        } catch (error) {
          alert("Failed to cancel deletion request: " + error);
        } finally {
          setDeletingId(null);
        }
      } else {
        // Other user requested delete, current user clicks trash can / approve delete
        showConfirm({
          title: 'Approve Deletion',
          message: 'Are you sure you want to approve the deletion of this transaction? It will be removed permanently.',
          confirmLabel: 'Approve & Delete',
          isDestructive: true,
          onConfirm: async () => {
            setDeletingId(exp.id!);
            try {
              await deleteExpense(exp.id!, currentUser);
              onDeleteSuccess();
            } catch (error) {
              alert("Failed to approve deletion: " + error);
            } finally {
              setDeletingId(null);
            }
          }
        });
      }
      return;
    }

    // Standard confirmed transaction - request deletion
    const otherUser = currentUser === 'Ozric' ? 'Pawan' : 'Ozric';
    const otherNickname = nicknames[otherUser] || otherUser;
    
    showConfirm({
      title: 'Request Deletion',
      message: `This will request the deletion of this transaction. ${otherNickname} will have to approve the deletion before it is removed. Proceed?`,
      confirmLabel: 'Request Deletion',
      isDestructive: true,
      onConfirm: async () => {
        setDeletingId(exp.id!);
        try {
          await requestDeleteExpense(exp.id!, currentUser);
          onDeleteSuccess();
        } catch (error) {
          alert("Failed to request deletion: " + error);
        } finally {
          setDeletingId(null);
        }
      }
    });
  };

  const handleApproveDelete = async (id: string) => {
    showConfirm({
      title: 'Confirm Deletion Approval',
      message: 'Are you sure you want to approve this deletion? The transaction will be permanently removed from the ledger.',
      confirmLabel: 'Yes, Delete Permanently',
      isDestructive: true,
      onConfirm: async () => {
        setDeletingId(id);
        try {
          await deleteExpense(id, currentUser);
          onDeleteSuccess();
        } catch (error) {
          alert("Failed to approve deletion: " + error);
        } finally {
          setDeletingId(null);
        }
      }
    });
  };

  const handleRejectDelete = async (id: string) => {
    setDeletingId(id);
    try {
      await cancelDeleteExpense(id, currentUser);
      onDeleteSuccess();
    } catch (error) {
      alert("Failed to reject deletion request: " + error);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* FILTER PANEL */}
      <div className="bg-white border-4 border-slate-900 rounded-3xl p-5 shadow-[5px_5px_0px_0px_rgba(15,23,42,1)] space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-slate-900" />
            <h4 className="text-xs font-black font-display uppercase tracking-widest text-slate-900">Filters & Insights</h4>
          </div>
          {expenses.length > 0 && (
            <span className="text-[10px] text-slate-500 font-mono font-bold">
              Showing {filteredExpenses.length} of {expenses.length} entries
            </span>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest font-mono flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 stroke-[2.5]" /> Filter by Month
            </label>
            <select
              id="select-filter-month"
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-900 rounded-xl px-3 py-2.5 text-xs text-slate-800 outline-none focus:bg-white transition font-bold"
            >
              <option value="all">All Calendar Months</option>
              {uniqueMonths.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="text-[10px] text-slate-500 font-black uppercase tracking-widest font-mono flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 stroke-[2.5]" /> Filter by Category
            </label>
            <select
              id="select-filter-category"
              value={filterCategory}
              onChange={(e) => setFilterCategory(e.target.value)}
              className="w-full bg-slate-50 border-2 border-slate-900 rounded-xl px-3 py-2.5 text-xs text-slate-800 outline-none focus:bg-white transition font-bold"
            >
              <option value="all">All Expense Categories</option>
              <option value="Shared Groceries">Shared Groceries</option>
              <option value="Household Supplies">Household Supplies</option>
              <option value="Rent">Rent</option>
              <option value="Electricity (Coins)">Electricity (Coins)</option>
              <option value="Internet/Wi-Fi">Internet/Wi-Fi</option>
              <option value="Takeout/Delivery">Takeout/Delivery</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        {/* VISUAL CATEGORY BREAKDOWN BARS */}
        {totalForBreakdown > 0 && (
          <div className="pt-3.5 border-t-2 border-slate-100 space-y-3">
            <span className="text-[10px] text-slate-500 font-black uppercase tracking-widest font-mono block">Category Spend Share</span>
            
            {/* Horizontal Stacked Bar */}
            <div className="h-4 bg-slate-100 rounded-full overflow-hidden flex border-2 border-slate-900">
              {categoryDistribution.map((dist, idx) => {
                const colors = ['bg-indigo-400', 'bg-emerald-400', 'bg-pink-400', 'bg-amber-400', 'bg-violet-400', 'bg-rose-400', 'bg-sky-400'];
                const color = colors[idx % colors.length];
                return (
                  <div
                    key={dist.category}
                    className={`h-full ${color}`}
                    style={{ width: `${dist.percentage}%` }}
                    title={`${dist.category}: €${dist.amount.toFixed(2)} (${dist.percentage.toFixed(0)}%)`}
                  />
                );
              })}
            </div>

            {/* Legend grid */}
            <div className="flex flex-col gap-2 pt-1">
              {categoryDistribution.map((dist, idx) => {
                const colors = ['bg-indigo-400', 'bg-emerald-400', 'bg-pink-400', 'bg-amber-400', 'bg-violet-400', 'bg-rose-400', 'bg-sky-400'];
                const color = colors[idx % colors.length];
                return (
                  <div key={dist.category} className="flex items-center justify-between text-[11px] text-slate-600 font-bold bg-slate-50 border border-slate-200 p-2 rounded-xl">
                    <div className="flex items-center gap-1.5 truncate">
                      <span className={`w-2.5 h-2.5 rounded-full border border-slate-900 ${color}`} />
                      <span className="truncate">{dist.category.replace(' (Coins)', '')}</span>
                    </div>
                    <span className="font-extrabold text-slate-900 font-mono shrink-0 ml-1 bg-white border border-slate-200 px-1.5 py-0.5 rounded">
                      €{dist.amount.toFixed(0)} ({dist.percentage.toFixed(0)}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* CHRONOLOGICAL FEED */}
      <div className="space-y-3">
        <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono px-1">
          Activity ledger Feed
        </h4>

        <div className="space-y-4">
          {filteredExpenses.length === 0 ? (
            <div className="bg-white border-4 border-slate-900 rounded-3xl p-8 text-center text-slate-500 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
              <Calendar className="w-10 h-10 mx-auto mb-3 text-slate-400" />
              <p className="font-black text-slate-900 text-sm">No matching activities found</p>
              <p className="text-xs text-slate-500 font-medium mt-1">Try relaxing filters or log a new shared expense.</p>
            </div>
          ) : (
            filteredExpenses.slice(0, visibleCount).map((exp) => {
              const isSettlement = exp.isSettlement;
              const isCoin = exp.isCoin;
              const isLendBorrow = exp.isLendBorrow;
              const formattedDate = new Date(exp.timestamp).toLocaleDateString('default', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit'
              });

              // Category mapping configurations
              const catConfig = CATEGORY_MAP[exp.category] || CATEGORY_MAP['Other'];
              const Icon = catConfig.icon;

              return (
                <div 
                  id={`expense-card-${exp.id}`}
                  key={exp.id} 
                  className={`border-4 border-slate-900 rounded-3xl p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] relative group overflow-hidden ${
                    isSettlement 
                      ? 'bg-emerald-50' 
                      : isCoin
                        ? 'bg-amber-50'
                        : isLendBorrow
                          ? 'bg-violet-50/75'
                          : 'bg-white hover:shadow-[5px_5px_0px_0px_rgba(15,23,42,1)] transition-all'
                  }`}
                >
                  <div className="flex items-start gap-3.5">
                    {/* ICON CONTAINER */}
                    <div className={`p-2.5 rounded-2xl border-2 border-slate-900 shrink-0 ${
                      isSettlement 
                        ? 'bg-emerald-200 text-emerald-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]' 
                        : isCoin
                          ? 'bg-amber-200 text-amber-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]'
                          : isLendBorrow
                            ? 'bg-violet-200 text-violet-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]'
                            : catConfig.bg
                    }`}>
                      {isLendBorrow ? <Coins className="w-5 h-5 stroke-[2.5px]" /> : <Icon className="w-5 h-5 stroke-[2.5px]" />}
                    </div>

                    {/* DETAILS */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <h5 className="font-black text-slate-900 text-sm tracking-tight truncate">
                          {exp.title}
                        </h5>
                        <div className="text-right shrink-0">
                          <span className={`text-base font-black font-mono tracking-tight block ${
                            isSettlement ? 'text-emerald-700' : isLendBorrow ? 'text-violet-700' : 'text-slate-900'
                          }`}>
                            €{exp.amount.toFixed(2)}
                          </span>
                        </div>
                      </div>

                      {/* SUBDETAILS */}
                      <p className="text-[10px] text-slate-500 font-bold flex flex-wrap items-center gap-x-1.5 gap-y-0.5 mt-1">
                        <span>{isLendBorrow ? 'Lent' : 'Paid'} by <strong className="text-slate-900 underline decoration-2">{nicknames[exp.paidBy] || exp.paidBy}</strong></span>
                        <span className="text-slate-300">•</span>
                        <span>{formattedDate}</span>
                        {!isSettlement && !isLendBorrow && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="bg-slate-100 px-1.5 py-0.5 rounded-md border-2 border-slate-900 font-mono text-[9px] font-black text-slate-800 uppercase tracking-wider">
                              {exp.splitType}
                            </span>
                          </>
                        )}
                        {isLendBorrow && (
                          <>
                            <span className="text-slate-300">•</span>
                            <span className="bg-violet-100 text-violet-800 px-1.5 py-0.5 rounded-md border-2 border-slate-900 font-mono text-[9px] font-black uppercase tracking-wider">
                              {exp.paymentMethod || 'Lend/Borrow'}
                            </span>
                          </>
                        )}
                      </p>

                      {/* SPLIT BREAKDOWN ROW */}
                      {!isSettlement && (
                        <div className="mt-3 bg-slate-50 rounded-2xl p-2.5 border-2 border-slate-900 flex justify-between gap-3 text-[10px] font-mono shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            <span className="text-slate-500 font-bold">{nicknames.Ozric}:</span>
                            <span className="text-slate-900 font-black">€{exp.splitDetails.OzricAmount.toFixed(2)}</span>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                            <span className="text-slate-500 font-bold">{nicknames.Pawan}:</span>
                            <span className="text-slate-900 font-black">€{exp.splitDetails.PawanAmount.toFixed(2)}</span>
                          </div>
                        </div>
                      )}

                      {/* NOTES SUMMARY */}
                      {exp.notes && (
                        <p className="mt-2.5 text-[11px] text-slate-600 leading-relaxed font-medium italic bg-indigo-50/50 p-2 rounded-xl border border-indigo-100">
                          "{exp.notes}"
                        </p>
                      )}

                      {/* ITEMIZED SPECIFIC LOG INFO */}
                      {exp.splitType === 'itemized' && exp.itemizedDetails && (
                        <p className="mt-2 text-[10px] text-indigo-600 font-black bg-indigo-50 border border-indigo-200 px-2 py-1 rounded-lg inline-block">
                          ℹ️ Includes €{exp.itemizedDetails.personalAmount.toFixed(2)} personal for {nicknames[exp.itemizedDetails.personalUser] || exp.itemizedDetails.personalUser}
                        </p>
                      )}

                      {/* PENDING DELETION WORKFLOW BANNER */}
                      {exp.deleteRequested && (
                        <div className="mt-3.5 bg-rose-50 border-2 border-dashed border-rose-400 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[1px_1px_0px_0px_rgba(225,29,72,1)]">
                          <div className="flex items-center gap-2 text-rose-800">
                            <Clock className="w-4 h-4 shrink-0 text-rose-650 animate-pulse" />
                            <div className="text-[10px] font-bold leading-tight">
                              <span className="block font-black text-rose-900 uppercase tracking-wider text-[8px] mb-0.5">Pending Deletion Approval</span>
                              {exp.deleteRequestedBy === currentUser ? (
                                <span>Waiting for {nicknames[currentUser === 'Ozric' ? 'Pawan' : 'Ozric']} to approve your deletion request</span>
                              ) : (
                                <span>{nicknames[exp.deleteRequestedBy!] || exp.deleteRequestedBy} has requested to delete this. Action required!</span>
                              )}
                            </div>
                          </div>
                          
                          {/* DELETION ACTION BUTTONS */}
                          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                            {exp.deleteRequestedBy !== currentUser ? (
                              <>
                                <button
                                  id={`btn-approve-delete-${exp.id}`}
                                  disabled={deletingId === exp.id}
                                  onClick={() => exp.id && handleApproveDelete(exp.id)}
                                  className="bg-rose-600 text-white border-2 border-slate-900 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-rose-700 transition duration-150 disabled:opacity-50 cursor-pointer flex items-center gap-1 font-sans"
                                >
                                  <Check className="w-3.5 h-3.5" /> Approve Deletion
                                </button>
                                <button
                                  id={`btn-reject-delete-${exp.id}`}
                                  disabled={deletingId === exp.id}
                                  onClick={() => exp.id && handleRejectDelete(exp.id)}
                                  className="bg-slate-100 text-slate-850 border-2 border-slate-900 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-slate-200 transition duration-150 disabled:opacity-50 cursor-pointer flex items-center gap-1 font-sans"
                                >
                                  <X className="w-3.5 h-3.5" /> Reject Deletion
                                </button>
                              </>
                            ) : (
                              <button
                                id={`btn-cancel-delete-${exp.id}`}
                                disabled={deletingId === exp.id}
                                onClick={() => exp.id && handleRejectDelete(exp.id)}
                                className="bg-slate-100 text-slate-750 border-2 border-slate-900 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-slate-200 transition duration-150 disabled:opacity-50 cursor-pointer flex items-center gap-1 font-sans"
                              >
                                <X className="w-3.5 h-3.5" /> Cancel Request
                              </button>
                            )}
                          </div>
                        </div>
                      )}

                      {/* PENDING APPROVAL WORKFLOW BANNER */}
                      {exp.status === 'pending' && (
                        <div className="mt-3.5 bg-amber-50 border-2 border-dashed border-amber-400 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-[1px_1px_0px_0px_rgba(217,119,6,1)]">
                          <div className="flex items-center gap-2 text-amber-800">
                            <Clock className="w-4 h-4 shrink-0 text-amber-600 animate-pulse" />
                            <div className="text-[10px] font-bold leading-tight">
                              <span className="block font-black text-amber-900 uppercase tracking-wider text-[8px] mb-0.5">On Hold / Pending Confirmation</span>
                              {exp.createdBy === currentUser ? (
                                <span>Waiting for {nicknames[currentUser === 'Ozric' ? 'Pawan' : 'Ozric']} to approve</span>
                              ) : (
                                <span>Action required: confirm or reject this transaction</span>
                              )}
                            </div>
                          </div>
                          
                          {/* ACTION BUTTONS */}
                          <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                            {exp.createdBy !== currentUser ? (
                              <>
                                <button
                                  id={`btn-approve-${exp.id}`}
                                  disabled={approvingId === exp.id || deletingId === exp.id}
                                  onClick={() => exp.id && handleApprove(exp.id)}
                                  className="bg-emerald-600 text-white border-2 border-slate-900 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-emerald-700 transition duration-150 disabled:opacity-50 cursor-pointer flex items-center gap-1"
                                >
                                  <Check className="w-3.5 h-3.5" /> Approve
                                </button>
                                <button
                                  id={`btn-reject-${exp.id}`}
                                  disabled={approvingId === exp.id || deletingId === exp.id}
                                  onClick={() => exp.id && handleDelete(exp)}
                                  className="bg-rose-100 text-rose-800 border-2 border-slate-900 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-rose-200 transition duration-150 disabled:opacity-50 cursor-pointer flex items-center gap-1"
                                >
                                  <X className="w-3.5 h-3.5" /> Reject
                                </button>
                              </>
                            ) : (
                              <button
                                id={`btn-cancel-${exp.id}`}
                                disabled={deletingId === exp.id}
                                onClick={() => exp.id && handleDelete(exp)}
                                className="bg-slate-100 text-slate-700 border-2 border-slate-900 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-slate-200 transition duration-150 disabled:opacity-50 cursor-pointer flex items-center gap-1"
                              >
                                <X className="w-3.5 h-3.5" /> Cancel Request
                              </button>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* DELETE BUTTON */}
                    <button
                      id={`btn-delete-expense-${exp.id}`}
                      disabled={deletingId === exp.id || exp.deleteRequested}
                      onClick={() => exp.id && handleDelete(exp)}
                      className={`p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 border-2 border-transparent hover:border-rose-200 rounded-xl transition duration-200 shrink-0 self-start cursor-pointer ${
                        exp.deleteRequested ? 'opacity-35 cursor-not-allowed' : 'opacity-100'
                      }`}
                      title={exp.deleteRequested ? "Deletion requested and pending approval" : "Delete entry"}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
          {filteredExpenses.length > 5 && (
            <div className="flex justify-center pt-2">
              <button
                id="btn-toggle-see-more"
                onClick={() => setVisibleCount(prev => prev >= filteredExpenses.length ? 5 : filteredExpenses.length)}
                className="px-6 py-2.5 bg-white text-slate-900 border-3 border-slate-900 rounded-2xl text-xs font-black uppercase tracking-wider shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:bg-slate-50 hover:shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] transition-all duration-150 cursor-pointer flex items-center gap-1.5"
              >
                {visibleCount >= filteredExpenses.length ? (
                  <>
                    <ChevronUp className="w-4 h-4 text-slate-950 stroke-[3px]" />
                    <span>Show Less</span>
                  </>
                ) : (
                  <>
                    <ChevronDown className="w-4 h-4 text-slate-950 stroke-[3px]" />
                    <span>See More ({filteredExpenses.length - visibleCount} more)</span>
                  </>
                )}
              </button>
            </div>
          )}
        </div>
      </div>

      <CustomConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        cancelLabel={confirmState.cancelLabel}
        isDestructive={confirmState.isDestructive}
        onConfirm={() => {
          confirmState.onConfirm();
          closeConfirm();
        }}
        onCancel={closeConfirm}
      />
    </div>
  );
}
