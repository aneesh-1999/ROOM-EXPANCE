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
        className="p-3.5 sm:p-4 bg-violet-100 border-b-3 border-slate-900 flex items-center justify-between cursor-pointer select-none hover:bg-violet-200/80 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="p-2 bg-violet-200 text-violet-900 rounded-xl border-2 border-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] shrink-0">
            <Coins className="w-4 h-4 stroke-[2.5px]" />
          </span>
          <div>
            <h3 className="text-xs sm:text-sm font-black tracking-tight text-slate-900 uppercase">Lend & Borrow Report</h3>
            <p className="text-[10px] text-slate-600 font-bold font-mono">Direct transfers & cash loans</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <span className="text-[10px] font-black font-mono bg-white px-2 py-0.5 rounded-lg border border-slate-900">
            {lendBorrowExpenses.length} Logs
          </span>
          {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-900" /> : <ChevronDown className="w-4 h-4 text-slate-900" />}
        </div>
      </div>

      {isExpanded && (
        <div className="p-3.5 sm:p-4 space-y-4">
          {/* LEND/BORROW STANDINGS SUMMARY BAR */}
          <div className={`border-2 border-slate-900 rounded-2xl p-3.5 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] ${
            isEven 
              ? 'bg-amber-50' 
              : isOwed 
                ? 'bg-emerald-50' 
                : 'bg-rose-50'
          }`}>
            <div className="flex flex-row items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
              <div>
                <span className="text-[9px] font-black uppercase tracking-wider font-mono text-slate-500 block">
                  Net Balance
                </span>
                <span className="text-2xl sm:text-3xl font-black font-mono text-slate-900">
                  €{Math.abs(netLendBorrowStanding).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center gap-2 text-xs font-black text-slate-900">
                {isEven ? (
                  <span className="bg-amber-200 border border-slate-900 px-2.5 py-1 rounded-xl shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] flex items-center gap-1.5 text-xs">
                    <ArrowRightLeft className="w-3.5 h-3.5 text-slate-800 shrink-0" />
                    <span>Settled Up!</span>
                  </span>
                ) : isOwed ? (
                  <span className="bg-emerald-200 border border-slate-900 px-2.5 py-1 rounded-xl shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] flex items-center gap-1.5 text-xs">
                    <ArrowUpRight className="w-3.5 h-3.5 text-emerald-800 shrink-0" />
                    <span>{otherUserLabel} owes you €{Math.abs(netLendBorrowStanding).toFixed(2)}</span>
                  </span>
                ) : (
                  <span className="bg-rose-200 border border-slate-900 px-2.5 py-1 rounded-xl shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] flex items-center gap-1.5 text-xs">
                    <ArrowDownLeft className="w-3.5 h-3.5 text-rose-800 shrink-0" />
                    <span>You owe {otherUserLabel} €{Math.abs(netLendBorrowStanding).toFixed(2)}</span>
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* TOTAL LENT VS BORROWED BOXES */}
          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-emerald-50 border-2 border-slate-900 rounded-xl p-2.5 sm:p-3 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
              <div className="flex items-center gap-1 text-emerald-700 mb-0.5">
                <ArrowUpRight className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
                <span className="text-[9px] font-black uppercase tracking-wider font-mono truncate">Lent</span>
              </div>
              <p className="text-lg sm:text-xl font-black font-mono text-slate-900">€{totalLent.toFixed(2)}</p>
              <p className="text-[9px] text-slate-500 font-bold truncate">To {otherUserLabel}</p>
            </div>

            <div className="bg-rose-50 border-2 border-slate-900 rounded-xl p-2.5 sm:p-3 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
              <div className="flex items-center gap-1 text-rose-700 mb-0.5">
                <ArrowDownLeft className="w-3.5 h-3.5 shrink-0 stroke-[2.5]" />
                <span className="text-[9px] font-black uppercase tracking-wider font-mono truncate">Borrowed</span>
              </div>
              <p className="text-lg sm:text-xl font-black font-mono text-slate-900">€{totalBorrowed.toFixed(2)}</p>
              <p className="text-[9px] text-slate-500 font-bold truncate">From {otherUserLabel}</p>
            </div>
          </div>

          {/* METHODWISE BREAKDOWN */}
          <div className="space-y-1.5">
            <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-500 font-mono flex items-center gap-1">
              <Layers className="w-3 h-3 text-slate-400" />
              By Payment Method
            </h4>
            
            <div className="grid grid-cols-3 gap-2">
              {/* REVOLUT */}
              <div className="bg-slate-50 border border-slate-900 rounded-xl p-2 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-black text-slate-800">Revolut</span>
                  <Smartphone className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                </div>
                <div className="text-[10px] font-mono leading-tight space-y-0.5">
                  <p className="text-slate-500">L: <strong className="text-slate-900">€{revolutLent.toFixed(0)}</strong></p>
                  <p className="text-slate-500">B: <strong className="text-slate-900">€{revolutBorrowed.toFixed(0)}</strong></p>
                </div>
              </div>

              {/* CASH */}
              <div className="bg-slate-50 border border-slate-900 rounded-xl p-2 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-black text-slate-800">Cash</span>
                  <DollarSign className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                </div>
                <div className="text-[10px] font-mono leading-tight space-y-0.5">
                  <p className="text-slate-500">L: <strong className="text-slate-900">€{cashLent.toFixed(0)}</strong></p>
                  <p className="text-slate-500">B: <strong className="text-slate-900">€{cashBorrowed.toFixed(0)}</strong></p>
                </div>
              </div>

              {/* BANK TRANSFER */}
              <div className="bg-slate-50 border border-slate-900 rounded-xl p-2 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[9px] font-black text-slate-800">Bank</span>
                  <CreditCard className="w-3.5 h-3.5 text-indigo-500 shrink-0" />
                </div>
                <div className="text-[10px] font-mono leading-tight space-y-0.5">
                  <p className="text-slate-500">L: <strong className="text-slate-900">€{bankLent.toFixed(0)}</strong></p>
                  <p className="text-slate-500">B: <strong className="text-slate-900">€{bankBorrowed.toFixed(0)}</strong></p>
                </div>
              </div>
            </div>
          </div>

          {/* SEARCH & DETAILED FEED */}
          <div className="space-y-2 pt-1">
            <div className="flex flex-row items-center justify-between gap-2">
              <h4 className="text-[9px] font-black uppercase tracking-widest text-slate-500 font-mono">
                Direct Loan Logs
              </h4>
              <div className="relative w-36 sm:w-48">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                <input
                  id="input-lend-search"
                  type="text"
                  placeholder="Search..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-7 pr-2 py-1 rounded-lg border border-slate-900 text-xs bg-slate-50 focus:bg-white focus:outline-none font-bold text-slate-800"
                />
              </div>
            </div>

            {filteredLogs.length === 0 ? (
              <div className="text-center py-6 border border-dashed border-slate-300 rounded-xl bg-slate-50/50">
                <Coins className="w-6 h-6 text-slate-300 mx-auto mb-1" />
                <p className="text-xs font-black text-slate-600">No direct loans found</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {filteredLogs.map((exp) => {
                  const isLender = exp.paidBy === currentUser;
                  const formattedDate = new Date(exp.timestamp).toLocaleDateString('default', {
                    month: 'short',
                    day: 'numeric'
                  });

                  return (
                    <div 
                      key={exp.id} 
                      className={`p-2.5 border border-slate-900 rounded-xl shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] flex flex-col justify-between gap-1.5 transition-all ${
                        isLender ? 'bg-emerald-50/40' : 'bg-rose-50/40'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-start gap-2 min-w-0">
                          <span className={`p-1 rounded-lg border border-slate-900 shrink-0 mt-0.5 ${
                            isLender ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'
                          }`}>
                            {isLender ? <ArrowUpRight className="w-3.5 h-3.5 stroke-[2.5px]" /> : <ArrowDownLeft className="w-3.5 h-3.5 stroke-[2.5px]" />}
                          </span>
                          <div className="min-w-0">
                            <h5 className="text-xs font-black text-slate-900 truncate leading-tight">
                              {exp.title}
                            </h5>
                            {exp.notes && (
                              <p className="text-[9px] text-slate-600 font-medium truncate mt-0.5">
                                "{exp.notes}"
                              </p>
                            )}
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="text-xs font-black font-mono text-slate-900 block">
                            €{exp.amount.toFixed(2)}
                          </span>
                          <span className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded border text-[8px] font-black uppercase font-mono ${getMethodBadgeClass(exp.paymentMethod)}`}>
                            {exp.paymentMethod || 'Revolut'}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between border-t border-slate-200/60 pt-1 text-[9px] text-slate-500 font-bold font-mono">
                        <span className="flex items-center gap-1">
                          <Calendar className="w-2.5 h-2.5 text-slate-400" />
                          {formattedDate}
                        </span>
                        <span>
                          {isLender ? `Owed by ${otherUserLabel}` : `Owed to ${otherUserLabel}`}
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
