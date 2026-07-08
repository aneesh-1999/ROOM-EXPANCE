import React, { useState } from 'react';
import { Expense, Roommate } from '../types';
import { 
  Coins, 
  ArrowUpRight, 
  ArrowDownLeft, 
  CreditCard, 
  DollarSign, 
  Smartphone, 
  TrendingUp, 
  Search, 
  Calendar,
  Layers,
  ArrowRightLeft,
  ChevronDown,
  ChevronUp
} from 'lucide-react';

interface LendBorrowReportProps {
  expenses: Expense[];
  currentUser: Roommate;
  nicknames: Record<Roommate, string>;
}

export default function LendBorrowReport({ expenses, currentUser, nicknames }: LendBorrowReportProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isExpanded, setIsExpanded] = useState(true);
  const otherUser: Roommate = currentUser === 'Ozric' ? 'Pawan' : 'Ozric';
  const otherUserLabel = nicknames[otherUser] || otherUser;

  // Filter only Lend/Borrow transactions
  const lendBorrowExpenses = expenses.filter(exp => exp.isLendBorrow);

  // Compute stats
  let totalLent = 0;
  let totalBorrowed = 0;
  
  let revolutLent = 0;
  let revolutBorrowed = 0;
  let cashLent = 0;
  let cashBorrowed = 0;
  let bankLent = 0;
  let bankBorrowed = 0;

  lendBorrowExpenses.forEach((exp) => {
    if (exp.status === 'pending') return;
    const isCurrentUserPayer = exp.paidBy === currentUser;
    const amount = exp.amount;
    const method = exp.paymentMethod || 'Revolut';

    if (isCurrentUserPayer) {
      totalLent += amount;
      if (method === 'Revolut') revolutLent += amount;
      else if (method === 'Cash') cashLent += amount;
      else if (method === 'Bank Transfer') bankLent += amount;
    } else {
      totalBorrowed += amount;
      if (method === 'Revolut') revolutBorrowed += amount;
      else if (method === 'Cash') cashBorrowed += amount;
      else if (method === 'Bank Transfer') bankBorrowed += amount;
    }
  });

  // Net standing from direct cash lend/borrow only
  const netLendBorrowStanding = totalLent - totalBorrowed;
  const isOwed = netLendBorrowStanding > 0;
  const isEven = Math.abs(netLendBorrowStanding) < 0.01;

  // Filter logs by search term
  const filteredLogs = lendBorrowExpenses.filter(exp => {
    const term = searchTerm.toLowerCase();
    const matchesTitle = exp.title.toLowerCase().includes(term);
    const matchesNotes = (exp.notes || '').toLowerCase().includes(term);
    const matchesMethod = (exp.paymentMethod || '').toLowerCase().includes(term);
    const matchesLender = exp.paidBy.toLowerCase().includes(term);
    return matchesTitle || matchesNotes || matchesMethod || matchesLender;
  });

  // Helper for Payment Method Icon
  const getMethodIcon = (method?: 'Cash' | 'Revolut' | 'Bank Transfer') => {
    switch (method) {
      case 'Revolut':
        return <Smartphone className="w-4 h-4 text-sky-600" />;
      case 'Bank Transfer':
        return <CreditCard className="w-4 h-4 text-indigo-600" />;
      case 'Cash':
      default:
        return <DollarSign className="w-4 h-4 text-emerald-600" />;
    }
  };

  // Helper for Payment Method BG
  const getMethodBadgeClass = (method?: 'Cash' | 'Revolut' | 'Bank Transfer') => {
    switch (method) {
      case 'Revolut':
        return 'bg-sky-50 text-sky-700 border-sky-300';
      case 'Bank Transfer':
        return 'bg-indigo-50 text-indigo-700 border-indigo-300';
      case 'Cash':
      default:
        return 'bg-emerald-50 text-emerald-700 border-emerald-300';
    }
  };

  return (
    <div id="lend-borrow-report-container" className="bg-white border-4 border-slate-900 rounded-3xl shadow-[5px_5px_0px_0px_rgba(15,23,42,1)] overflow-hidden transition-all duration-300">
      {/* CARD HEADER WITH TOGGLE */}
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        className="p-5 bg-violet-100 border-b-4 border-slate-900 flex items-center justify-between cursor-pointer select-none hover:bg-violet-200/80 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className="p-2.5 bg-violet-200 text-violet-800 rounded-2xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
            <Coins className="w-5 h-5 stroke-[2.5px]" />
          </span>
          <div>
            <h3 className="text-base font-black tracking-tight text-slate-900 uppercase">Lend & Borrow Report</h3>
            <p className="text-[10px] text-slate-600 font-bold font-mono">Detailed standings for direct cash, Revolut & bank transfers</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-black font-mono bg-white px-2 py-1 rounded-md border-2 border-slate-900">
            {lendBorrowExpenses.length} Total Logs
          </span>
          {isExpanded ? <ChevronUp className="w-5 h-5 text-slate-900" /> : <ChevronDown className="w-5 h-5 text-slate-900" />}
        </div>
      </div>

      {isExpanded && (
        <div className="p-6 space-y-6">
          {/* LEND/BORROW STANDINGS SUMMARY BAR */}
          <div className={`border-3 border-slate-900 rounded-2xl p-5 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] ${
            isEven 
              ? 'bg-amber-50' 
              : isOwed 
                ? 'bg-emerald-50' 
                : 'bg-rose-50'
          }`}>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <span className="text-[9px] font-black uppercase tracking-wider font-mono text-slate-500 block mb-1">
                  Net Direct Loan Standing
                </span>
                <span className="text-3xl font-black font-mono text-slate-900">
                  €{Math.abs(netLendBorrowStanding).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs font-black text-slate-900">
                {isEven ? (
                  <span className="bg-amber-200 border-2 border-slate-900 px-3 py-1.5 rounded-xl shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] flex items-center gap-1.5">
                    <ArrowRightLeft className="w-4 h-4 text-slate-800" />
                    All cash loans are settled!
                  </span>
                ) : isOwed ? (
                  <span className="bg-emerald-200 border-2 border-slate-900 px-3 py-1.5 rounded-xl shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] flex items-center gap-1.5">
                    <ArrowUpRight className="w-4 h-4 text-emerald-800" />
                    {otherUserLabel} owes you €{Math.abs(netLendBorrowStanding).toFixed(2)} directly
                  </span>
                ) : (
                  <span className="bg-rose-200 border-2 border-slate-900 px-3 py-1.5 rounded-xl shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] flex items-center gap-1.5">
                    <ArrowDownLeft className="w-4 h-4 text-rose-800" />
                    You owe {otherUserLabel} €{Math.abs(netLendBorrowStanding).toFixed(2)} directly
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* TOTAL LENT VS BORROWED BOXES */}
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-emerald-50 border-3 border-slate-900 rounded-2xl p-4 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
              <div className="flex items-center gap-1.5 text-emerald-700 mb-1">
                <ArrowUpRight className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-wider font-mono">Total You Lent</span>
              </div>
              <p className="text-xl font-black font-mono text-slate-900">€{totalLent.toFixed(2)}</p>
              <p className="text-[9px] text-slate-500 font-bold mt-1">Given to {otherUserLabel}</p>
            </div>

            <div className="bg-rose-50 border-3 border-slate-900 rounded-2xl p-4 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
              <div className="flex items-center gap-1.5 text-rose-700 mb-1">
                <ArrowDownLeft className="w-4 h-4" />
                <span className="text-[10px] font-black uppercase tracking-wider font-mono">Total You Borrowed</span>
              </div>
              <p className="text-xl font-black font-mono text-slate-900">€{totalBorrowed.toFixed(2)}</p>
              <p className="text-[9px] text-slate-500 font-bold mt-1">Received from {otherUserLabel}</p>
            </div>
          </div>

          {/* METHODWISE BREAKDOWN */}
          <div className="space-y-2">
            <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono flex items-center gap-1">
              <Layers className="w-3.5 h-3.5" />
              Breakdown by Payment Method
            </h4>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* REVOLUT */}
              <div className="bg-slate-50 border-2 border-slate-900 rounded-xl p-3 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-black text-slate-800">Revolut</span>
                  <Smartphone className="w-4 h-4 text-sky-500" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-slate-500">Lent: <strong className="text-slate-800 font-mono">€{revolutLent.toFixed(2)}</strong></p>
                  <p className="text-xs font-semibold text-slate-500">Borrowed: <strong className="text-slate-800 font-mono">€{revolutBorrowed.toFixed(2)}</strong></p>
                </div>
              </div>

              {/* CASH */}
              <div className="bg-slate-50 border-2 border-slate-900 rounded-xl p-3 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-black text-slate-800">Physical Cash</span>
                  <DollarSign className="w-4 h-4 text-emerald-500" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-slate-500">Lent: <strong className="text-slate-800 font-mono">€{cashLent.toFixed(2)}</strong></p>
                  <p className="text-xs font-semibold text-slate-500">Borrowed: <strong className="text-slate-800 font-mono">€{cashBorrowed.toFixed(2)}</strong></p>
                </div>
              </div>

              {/* BANK TRANSFER */}
              <div className="bg-slate-50 border-2 border-slate-900 rounded-xl p-3 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-black text-slate-800">Bank Transfer</span>
                  <CreditCard className="w-4 h-4 text-indigo-500" />
                </div>
                <div className="space-y-0.5">
                  <p className="text-xs font-semibold text-slate-500">Lent: <strong className="text-slate-800 font-mono">€{bankLent.toFixed(2)}</strong></p>
                  <p className="text-xs font-semibold text-slate-500">Borrowed: <strong className="text-slate-800 font-mono">€{bankBorrowed.toFixed(2)}</strong></p>
                </div>
              </div>
            </div>
          </div>

          {/* SEARCH & DETAILED FEED */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono">
                Direct Loan Feed
              </h4>
              <div className="relative w-full sm:w-60">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  id="input-lend-search"
                  type="text"
                  placeholder="Search direct loans..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-9 pr-3 py-1.5 rounded-xl border-2 border-slate-900 text-xs bg-slate-50 focus:bg-white focus:outline-none font-bold text-slate-800"
                />
              </div>
            </div>

            {filteredLogs.length === 0 ? (
              <div className="text-center py-8 border-2 border-dashed border-slate-350 rounded-2xl bg-slate-50/50">
                <Coins className="w-8 h-8 text-slate-300 mx-auto mb-2" />
                <p className="text-xs font-black text-slate-600">No lend/borrow entries found</p>
                <p className="text-[10px] text-slate-400 font-medium">Use the "Lend / Borrow" button above to register transactions</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-72 overflow-y-auto pr-1">
                {filteredLogs.map((exp) => {
                  const isLender = exp.paidBy === currentUser;
                  const formattedDate = new Date(exp.timestamp).toLocaleDateString('default', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric'
                  });

                  return (
                    <div 
                      key={exp.id} 
                      className={`p-3.5 border-2 border-slate-900 rounded-xl shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] flex flex-col justify-between gap-2 transition-all hover:bg-slate-50 ${
                        isLender ? 'bg-emerald-50/30' : 'bg-rose-50/30'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2.5">
                        <div className="flex items-start gap-2.5">
                          <span className={`p-1.5 rounded-lg border-2 border-slate-900 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] shrink-0 ${
                            isLender ? 'bg-emerald-200 text-emerald-800' : 'bg-rose-200 text-rose-850'
                          }`}>
                            {isLender ? <ArrowUpRight className="w-4 h-4 stroke-[2.5px]" /> : <ArrowDownLeft className="w-4 h-4 stroke-[2.5px]" />}
                          </span>
                          <div>
                            <h5 className="text-xs font-black text-slate-900 leading-tight">
                              {exp.title}
                            </h5>
                            {exp.notes && (
                              <p className="text-[10px] text-slate-600 font-bold bg-white/70 px-2 py-0.5 rounded border border-slate-200 mt-1 inline-block">
                                {exp.notes}
                              </p>
                            )}
                            {exp.status === 'pending' && (
                              <div className="mt-1.5 text-[8px] font-extrabold uppercase tracking-wider text-amber-700 bg-amber-50 border border-amber-300 px-1.5 py-0.5 rounded-md inline-flex items-center gap-1">
                                ⏳ On Hold (Pending)
                              </div>
                            )}
                          </div>
                        </div>

                        <div className="text-right">
                          <span className="text-xs font-black font-mono text-slate-900 block">
                            €{exp.amount.toFixed(2)}
                          </span>
                          <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded border border-slate-900 text-[8px] font-black uppercase tracking-wider font-mono mt-1 ${getMethodBadgeClass(exp.paymentMethod)}`}>
                            {getMethodIcon(exp.paymentMethod)}
                            {exp.paymentMethod || 'Revolut'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-100 pt-1.5 text-[9px] text-slate-400 font-bold font-mono">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3 text-slate-400" />
                          {formattedDate}
                        </span>
                        <span className="text-slate-500">
                          {isLender 
                            ? `Owed by ${otherUserLabel}` 
                            : `Owed to ${otherUserLabel}`
                          }
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
