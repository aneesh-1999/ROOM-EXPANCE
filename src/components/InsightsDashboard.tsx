import React, { useState, useMemo } from 'react';
import { Expense, Category, Roommate } from '../types';
import { 
  TrendingUp, 
  ArrowUpRight, 
  ShieldCheck, 
  PieChart, 
  BarChart3, 
  Activity, 
  Coins, 
  ArrowRight, 
  Layers, 
  Calendar, 
  Users, 
  Wallet, 
  Zap, 
  Sparkles,
  ArrowDownRight,
  TrendingDown,
  Info
} from 'lucide-react';

interface InsightsDashboardProps {
  expenses: Expense[];
  onEnterWorkspace: () => void;
  nicknames: Record<Roommate, string>;
  profiles: Record<Roommate, { id: Roommate; avatar?: string; accentColor?: string; nickname?: string }>;
}

export default function InsightsDashboard({ 
  expenses, 
  onEnterWorkspace, 
  nicknames, 
  profiles 
}: InsightsDashboardProps) {
  // Navigation / Interactive state
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<Category | 'all'>('all');
  const [activeCompareMode, setActiveCompareMode] = useState<'payer' | 'responsible'>('payer');
  const [tickerCount, setTickerCount] = useState<number>(5);

  const ozricLabel = nicknames.Ozric || 'Ozric';
  const pawanLabel = nicknames.Pawan || 'Pawan';

  // Robust date parser
  const parseExpenseDate = (timestamp: any): Date => {
    if (!timestamp) return new Date();
    if (timestamp.seconds) return new Date(timestamp.seconds * 1000);
    if (timestamp.toDate && typeof timestamp.toDate === 'function') return timestamp.toDate();
    const d = new Date(timestamp);
    return isNaN(d.getTime()) ? new Date() : d;
  };

  // Helper to format currency
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(amount);
  };

  // 1. FILTER VALID EXPENSES
  // We ignore settlements for raw spending totals, but track loans separately.
  const confirmedExpenses = useMemo(() => {
    return expenses.filter(e => e.status !== 'pending');
  }, [expenses]);

  const spendingExpenses = useMemo(() => {
    return confirmedExpenses.filter(e => !e.isSettlement && !e.isLendBorrow);
  }, [confirmedExpenses]);

  // 2. METRICS COMPUTATIONS
  const totalSpend = useMemo(() => {
    return spendingExpenses.reduce((sum, e) => sum + e.amount, 0);
  }, [spendingExpenses]);

  const totalBillsCount = useMemo(() => {
    return spendingExpenses.length;
  }, [spendingExpenses]);

  const averageBillAmount = useMemo(() => {
    return totalBillsCount > 0 ? totalSpend / totalBillsCount : 0;
  }, [totalSpend, totalBillsCount]);

  const totalCoinsLogged = useMemo(() => {
    return confirmedExpenses
      .filter(e => e.isCoin)
      .reduce((sum, e) => sum + e.amount, 0);
  }, [confirmedExpenses]);

  // Net roommate standing
  const currentStandings = useMemo(() => {
    let ozricOwes = 0;
    let pawanOwes = 0;

    confirmedExpenses.forEach((exp) => {
      if (exp.isCoin || exp.isSettlement) return;
      
      let payOzric = 0;
      let payPawan = 0;
      if (exp.paymentDistribution) {
        payOzric = exp.paymentDistribution.OzricAmount ?? 0;
        payPawan = exp.paymentDistribution.PawanAmount ?? 0;
      } else {
        if (exp.paidBy === 'Ozric') {
          payOzric = exp.amount;
        } else if (exp.paidBy === 'Pawan') {
          payPawan = exp.amount;
        }
      }

      const shareOzric = exp.splitDetails?.OzricAmount ?? 0;
      const sharePawan = exp.splitDetails?.PawanAmount ?? 0;

      const pawanOwedDiff = sharePawan - payPawan;
      if (pawanOwedDiff > 0) {
        pawanOwes += pawanOwedDiff;
      } else if (pawanOwedDiff < 0) {
        ozricOwes += Math.abs(pawanOwedDiff);
      }
    });

    const diff = pawanOwes - ozricOwes; // positive Pawan owes Ozric, negative Ozric owes Pawan
    return {
      diff,
      ozricOwes,
      pawanOwes
    };
  }, [confirmedExpenses]);

  // 3. CATEGORY AGGREGATION
  const categoryStats = useMemo(() => {
    const stats: Record<Category, { total: number; count: number; OzricPaid: number; PawanPaid: number; OzricShare: number; PawanShare: number }> = {
      'Rent': { total: 0, count: 0, OzricPaid: 0, PawanPaid: 0, OzricShare: 0, PawanShare: 0 },
      'Electricity (Coins)': { total: 0, count: 0, OzricPaid: 0, PawanPaid: 0, OzricShare: 0, PawanShare: 0 },
      'Shared Groceries': { total: 0, count: 0, OzricPaid: 0, PawanPaid: 0, OzricShare: 0, PawanShare: 0 },
      'Household Supplies': { total: 0, count: 0, OzricPaid: 0, PawanPaid: 0, OzricShare: 0, PawanShare: 0 },
      'Internet/Wi-Fi': { total: 0, count: 0, OzricPaid: 0, PawanPaid: 0, OzricShare: 0, PawanShare: 0 },
      'Takeout/Delivery': { total: 0, count: 0, OzricPaid: 0, PawanPaid: 0, OzricShare: 0, PawanShare: 0 },
      'Other': { total: 0, count: 0, OzricPaid: 0, PawanPaid: 0, OzricShare: 0, PawanShare: 0 }
    };

    spendingExpenses.forEach((e) => {
      const cat = e.category;
      if (stats[cat]) {
        stats[cat].total += e.amount;
        stats[cat].count += 1;
        let payOzric = 0;
        let payPawan = 0;
        if (e.paymentDistribution) {
          payOzric = e.paymentDistribution.OzricAmount ?? 0;
          payPawan = e.paymentDistribution.PawanAmount ?? 0;
        } else {
          if (e.paidBy === 'Ozric') {
            payOzric = e.amount;
          } else {
            payPawan = e.amount;
          }
        }
        stats[cat].OzricPaid += payOzric;
        stats[cat].PawanPaid += payPawan;
        stats[cat].OzricShare += e.splitDetails?.OzricAmount || 0;
        stats[cat].PawanShare += e.splitDetails?.PawanAmount || 0;
      }
    });

    return stats;
  }, [spendingExpenses]);

  // Ordered list of categories by spending amount
  const sortedCategories = useMemo(() => {
    return (Object.keys(categoryStats) as Category[]).map(cat => ({
      name: cat,
      ...categoryStats[cat],
      percentage: totalSpend > 0 ? (categoryStats[cat].total / totalSpend) * 100 : 0
    })).sort((a, b) => b.total - a.total);
  }, [categoryStats, totalSpend]);

  const highestSpendingCategory = useMemo(() => {
    return sortedCategories[0] || { name: 'None', total: 0, percentage: 0 };
  }, [sortedCategories]);

  // 4. MONTHLY TREND AGGREGATION
  const monthlyTrends = useMemo(() => {
    const monthsData: Record<string, { total: number; coins: number; bills: number; index: number }> = {};
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    confirmedExpenses.forEach((e) => {
      if (e.isSettlement || e.isLendBorrow) return;
      const date = parseExpenseDate(e.timestamp);
      const mLabel = `${monthNames[date.getMonth()]} ${date.getFullYear()}`;
      
      if (!monthsData[mLabel]) {
        // Approximate sorting key based on year & month
        const idx = date.getFullYear() * 12 + date.getMonth();
        monthsData[mLabel] = { total: 0, coins: 0, bills: 0, index: idx };
      }

      monthsData[mLabel].total += e.amount;
      if (e.isCoin) {
        monthsData[mLabel].coins += e.amount;
      } else {
        monthsData[mLabel].bills += e.amount;
      }
    });

    // Sort chronologically and take up to last 6 months
    return Object.entries(monthsData)
      .map(([month, data]) => ({ month, ...data }))
      .sort((a, b) => a.index - b.index)
      .slice(-6);
  }, [confirmedExpenses]);

  // Max spending in a single month for scaling the trend chart
  const maxMonthlySpend = useMemo(() => {
    const maxVal = Math.max(...monthlyTrends.map(m => m.total), 0);
    return maxVal > 0 ? maxVal * 1.15 : 100; // Pad slightly for visual clearance
  }, [monthlyTrends]);

  // 5. ROOMMATE OVERALL TOTALS
  const roommateTotals = useMemo(() => {
    let ozricPaid = 0;
    let pawanPaid = 0;
    let ozricShare = 0;
    let pawanShare = 0;

    spendingExpenses.forEach(e => {
      let payOzric = 0;
      let payPawan = 0;
      if (e.paymentDistribution) {
        payOzric = e.paymentDistribution.OzricAmount ?? 0;
        payPawan = e.paymentDistribution.PawanAmount ?? 0;
      } else {
        if (e.paidBy === 'Ozric') {
          payOzric = e.amount;
        } else {
          payPawan = e.amount;
        }
      }
      ozricPaid += payOzric;
      pawanPaid += payPawan;

      ozricShare += e.splitDetails?.OzricAmount || 0;
      pawanShare += e.splitDetails?.PawanAmount || 0;
    });

    return {
      paid: { Ozric: ozricPaid, Pawan: pawanPaid },
      share: { Ozric: ozricShare, Pawan: pawanShare }
    };
  }, [spendingExpenses]);

  // 6. CATEGORY COLOR PALETTE (Neo-brutalist vibrant shades)
  const categoryColors: Record<Category, { bg: string; border: string; text: string; fill: string }> = {
    'Rent': { bg: 'bg-indigo-100', border: 'border-indigo-600', text: 'text-indigo-700', fill: '#818cf8' },
    'Electricity (Coins)': { bg: 'bg-pink-100', border: 'border-pink-600', text: 'text-pink-700', fill: '#f472b6' },
    'Shared Groceries': { bg: 'bg-emerald-100', border: 'border-emerald-600', text: 'text-emerald-700', fill: '#34d399' },
    'Household Supplies': { bg: 'bg-amber-100', border: 'border-amber-600', text: 'text-amber-700', fill: '#fbbf24' },
    'Internet/Wi-Fi': { bg: 'bg-sky-100', border: 'border-sky-600', text: 'text-sky-700', fill: '#38bdf8' },
    'Takeout/Delivery': { bg: 'bg-rose-100', border: 'border-rose-600', text: 'text-rose-700', fill: '#fb7185' },
    'Other': { bg: 'bg-slate-100', border: 'border-slate-500', text: 'text-slate-600', fill: '#94a3b8' }
  };

  // Detailed view of selected category or highest category
  const activeDetailCategory = selectedCategory === 'all' ? highestSpendingCategory.name : selectedCategory;
  const activeDetailData = categoryStats[activeDetailCategory as Category] || { total: 0, count: 0, OzricPaid: 0, PawanPaid: 0, OzricShare: 0, PawanShare: 0 };
  const activeDetailPercentage = totalSpend > 0 ? (activeDetailData.total / totalSpend) * 100 : 0;

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      
      {/* SECTION A: HERO ACTION COVER */}
      <div className="bg-amber-100 border-4 border-slate-900 rounded-[32px] p-6 md:p-8 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] relative overflow-hidden flex flex-col md:flex-row items-center justify-between gap-6">
        {/* Background decorative neo-pattern */}
        <div className="absolute right-0 top-0 w-32 h-32 bg-amber-200/50 rounded-full blur-2xl pointer-events-none"></div>
        <div className="absolute left-10 bottom-0 w-24 h-24 bg-pink-200/30 rounded-full blur-xl pointer-events-none"></div>

        <div className="space-y-3 flex-1 text-center md:text-left">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-slate-900 text-amber-400 rounded-full text-[10px] font-black uppercase tracking-wider font-mono shadow-[2px_2px_0px_0px_rgba(245,158,11,1)]">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Co-Living Intelligent Analytics</span>
          </div>
          <h2 className="text-3xl font-black tracking-tight leading-none text-slate-900 font-display">
            Shared Household Finances <br className="hidden sm:inline" />
            &amp; Consumption Trends
          </h2>
          <p className="text-xs text-slate-700 font-medium max-w-lg leading-relaxed">
            Shared household spending analytics for <strong className="text-slate-900 font-black">{ozricLabel}</strong> &amp; <strong className="text-slate-900 font-black">{pawanLabel}</strong>.
          </p>
        </div>

        <div className="shrink-0 w-full md:w-auto">
          <button
            id="btn-home-enter-workspace"
            onClick={onEnterWorkspace}
            className="w-full md:w-auto px-8 py-5 bg-pink-500 hover:bg-pink-600 text-white border-4 border-slate-900 rounded-[20px] font-black uppercase text-sm tracking-widest shadow-[5px_5px_0px_0px_rgba(15,23,42,1)] hover:shadow-[7px_7px_0px_0px_rgba(15,23,42,1)] transition-all duration-150 cursor-pointer active:translate-x-[1px] active:translate-y-[1px] flex items-center justify-center gap-3"
          >
            <span>Enter Roommate Ledger</span>
            <ArrowRight className="w-5 h-5 stroke-[3px]" />
          </button>
        </div>
      </div>

      {/* SECTION B: CORE METRICS GRID */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Metric 1 */}
        <div className="bg-white border-4 border-slate-900 p-5 rounded-3xl shadow-[5px_5px_0px_0px_rgba(15,23,42,1)] flex flex-col justify-between hover:translate-y-[-2px] transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider font-mono">Gross Household Spend</span>
            <span className="p-1.5 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-lg">
              <Wallet className="w-4 h-4" />
            </span>
          </div>
          <div>
            <h3 className="text-2xl font-black tracking-tight font-mono text-slate-900">{formatCurrency(totalSpend)}</h3>
            <p className="text-[10px] text-slate-500 font-bold mt-1">Accumulated across {totalBillsCount} confirmed bills</p>
          </div>
        </div>

        {/* Metric 2 */}
        <div className="bg-white border-4 border-slate-900 p-5 rounded-3xl shadow-[5px_5px_0px_0px_rgba(15,23,42,1)] flex flex-col justify-between hover:translate-y-[-2px] transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider font-mono">Average Bill Cost</span>
            <span className="p-1.5 bg-pink-50 border border-pink-200 text-pink-600 rounded-lg">
              <TrendingUp className="w-4 h-4" />
            </span>
          </div>
          <div>
            <h3 className="text-2xl font-black tracking-tight font-mono text-slate-900">{formatCurrency(averageBillAmount)}</h3>
            <p className="text-[10px] text-slate-500 font-bold mt-1">Mean expenditure per shared transaction</p>
          </div>
        </div>

        {/* Metric 3 */}
        <div className="bg-white border-4 border-slate-900 p-5 rounded-3xl shadow-[5px_5px_0px_0px_rgba(15,23,42,1)] flex flex-col justify-between hover:translate-y-[-2px] transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider font-mono">Electricity Coins</span>
            <span className="p-1.5 bg-amber-50 border border-amber-200 text-amber-600 rounded-lg">
              <Coins className="w-4 h-4" />
            </span>
          </div>
          <div>
            <h3 className="text-2xl font-black tracking-tight font-mono text-slate-900">{formatCurrency(totalCoinsLogged)}</h3>
            <p className="text-[10px] text-slate-500 font-bold mt-1">Coins deposited directly into utility meter</p>
          </div>
        </div>

        {/* Metric 4 */}
        <div className="bg-white border-4 border-slate-900 p-5 rounded-3xl shadow-[5px_5px_0px_0px_rgba(15,23,42,1)] flex flex-col justify-between hover:translate-y-[-2px] transition-all">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-slate-500 font-black uppercase tracking-wider font-mono">Ledger Standing</span>
            <span className="p-1.5 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-lg">
              <Users className="w-4 h-4" />
            </span>
          </div>
          <div>
            {currentStandings.diff === 0 ? (
              <h3 className="text-lg font-black leading-tight text-emerald-600 font-display uppercase tracking-tight">Fully Settled Up</h3>
            ) : currentStandings.diff > 0 ? (
              <h3 className="text-xl font-black tracking-tight text-slate-900 leading-none">
                {pawanLabel} <span className="text-indigo-600 text-xs font-bold block">owes {ozricLabel}</span>
                <span className="font-mono text-2xl block mt-0.5">{formatCurrency(currentStandings.diff)}</span>
              </h3>
            ) : (
              <h3 className="text-xl font-black tracking-tight text-slate-900 leading-none">
                {ozricLabel} <span className="text-rose-600 text-xs font-bold block">owes {pawanLabel}</span>
                <span className="font-mono text-2xl block mt-0.5">{formatCurrency(Math.abs(currentStandings.diff))}</span>
              </h3>
            )}
            <p className="text-[10px] text-slate-500 font-bold mt-1">Net confirmed financial balance</p>
          </div>
        </div>
      </div>

      {/* SECTION C: CHART PANELS BLOCK */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        
        {/* PANEL 1: MONTHLY TRENDS BAR CHART */}
        <div className="bg-white border-4 border-slate-900 rounded-3xl p-5 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] lg:col-span-2 space-y-5">
          <div className="flex items-center justify-between border-b-2 border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-indigo-50 border border-indigo-200 text-indigo-600 rounded-xl">
                <BarChart3 className="w-5 h-5" />
              </span>
              <div>
                <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight font-display">Monthly Spending Trend</h4>
                <p className="text-[10px] text-slate-500 font-bold">Confirmed household bills &amp; coins last 6 months</p>
              </div>
            </div>
            <span className="px-2 py-1 bg-indigo-100 text-indigo-700 text-[9px] font-black rounded-lg uppercase tracking-wider font-mono">
              Timeline View
            </span>
          </div>

          {monthlyTrends.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400 gap-2 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50">
              <Calendar className="w-8 h-8 animate-pulse text-indigo-300" />
              <p className="text-xs font-bold">No historical data found</p>
              <p className="text-[10px] text-slate-400">Log some confirmed bills to view chart trends.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {/* Interactive chart display stage */}
              <div className="h-64 flex items-end justify-between px-4 pt-6 border-b-4 border-slate-900 relative">
                
                {/* Horizontal reference lines */}
                <div className="absolute inset-x-0 top-1/4 border-t-2 border-slate-100 pointer-events-none"></div>
                <div className="absolute inset-x-0 top-2/4 border-t-2 border-slate-100 pointer-events-none"></div>
                <div className="absolute inset-x-0 top-3/4 border-t-2 border-slate-100 pointer-events-none"></div>

                {monthlyTrends.map((data) => {
                  const billHeightPercent = (data.bills / maxMonthlySpend) * 100;
                  const coinHeightPercent = (data.coins / maxMonthlySpend) * 100;
                  const totalHeightPercent = (data.total / maxMonthlySpend) * 100;

                  const isHovered = hoveredMonth === data.month;

                  return (
                    <div 
                      key={data.month} 
                      className="flex-1 flex flex-col items-center group relative h-full justify-end px-2"
                      onMouseEnter={() => setHoveredMonth(data.month)}
                      onMouseLeave={() => setHoveredMonth(null)}
                    >
                      {/* Active tooltip on hover */}
                      {isHovered && (
                        <div className="absolute bottom-[105%] bg-slate-900 text-white text-[10px] font-mono p-3 rounded-xl border-2 border-slate-950 shadow-md z-30 w-44 animate-fade-in pointer-events-none text-left">
                          <p className="font-bold border-b border-slate-700 pb-1 text-indigo-400 mb-1.5 uppercase font-display tracking-wider">{data.month}</p>
                          <div className="space-y-1">
                            <div className="flex justify-between">
                              <span className="text-slate-450 text-[9px] font-bold">Bills:</span>
                              <span className="font-bold">{formatCurrency(data.bills)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-slate-450 text-[9px] font-bold">Coins:</span>
                              <span className="font-bold">{formatCurrency(data.coins)}</span>
                            </div>
                            <div className="flex justify-between border-t border-slate-850 pt-1 text-white font-black">
                              <span>Total:</span>
                              <span>{formatCurrency(data.total)}</span>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Stacked Bar Container */}
                      <div className="w-10 sm:w-14 relative group cursor-pointer flex flex-col justify-end h-full">
                        {/* Coin stack (drawn at the top of the bar) */}
                        <div 
                          className="w-full bg-pink-400 border-x-3 border-t-3 border-slate-900 group-hover:bg-pink-500 transition-colors"
                          style={{ height: `${coinHeightPercent}%` }}
                          title={`Coins: ${formatCurrency(data.coins)}`}
                        ></div>
                        {/* Shared bills stack (drawn at the bottom) */}
                        <div 
                          className="w-full bg-indigo-400 border-x-3 border-b-0 border-slate-900 group-hover:bg-indigo-500 transition-colors border-t-3"
                          style={{ height: `${billHeightPercent}%` }}
                          title={`Shared Bills: ${formatCurrency(data.bills)}`}
                        ></div>
                      </div>

                      {/* Bottom Label */}
                      <span className="text-[9px] font-black text-slate-800 tracking-tight mt-2 rotate-[-12deg] xs:rotate-0 whitespace-nowrap font-mono">
                        {data.month}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Chart Legend */}
              <div className="flex items-center justify-center gap-6 pt-3 text-[10px] font-mono">
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 bg-indigo-400 border-2 border-slate-900 rounded"></span>
                  <span className="font-bold text-slate-700">Shared Bills</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-3.5 h-3.5 bg-pink-400 border-2 border-slate-900 rounded"></span>
                  <span className="font-bold text-slate-700">Meter Coins</span>
                </div>
                <div className="flex items-center gap-1.5 text-slate-400 font-bold ml-4">
                  <Info className="w-3.5 h-3.5" />
                  <span>Hover bars to inspect exact shares</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* PANEL 2: COMPACT HIGHEST CATEGORY OR NOTIFICATION CARD */}
        <div className="bg-slate-900 text-white border-4 border-slate-900 rounded-3xl p-5 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <span className="text-[10px] text-amber-400 font-mono font-black uppercase tracking-wider flex items-center gap-1">
              <Sparkles className="w-3.5 h-3.5" /> Core Insight
            </span>
            <span className="text-[9px] text-slate-400 font-bold font-mono">Real-time</span>
          </div>

          <div className="space-y-3">
            <h5 className="text-xs text-slate-400 font-bold uppercase tracking-widest font-mono">Top Household Expense Category</h5>
            {highestSpendingCategory.total > 0 ? (
              <div className="space-y-4">
                <div className="flex items-baseline gap-2">
                  <h3 className="text-3xl font-black text-white leading-none font-display">
                    {highestSpendingCategory.name}
                  </h3>
                </div>
                <p className="text-xs text-slate-300 font-medium leading-relaxed">
                  This single category claims <strong className="text-amber-400 font-black">{highestSpendingCategory.percentage.toFixed(1)}%</strong> of the total cohabitation budget, accumulating a total of <strong className="text-white font-black">{formatCurrency(highestSpendingCategory.total)}</strong>.
                </p>

                {/* Meter visual bar */}
                <div className="space-y-1">
                  <div className="flex justify-between text-[10px] font-mono text-slate-400">
                    <span>Category Share</span>
                    <span className="font-bold text-amber-400">{highestSpendingCategory.percentage.toFixed(1)}%</span>
                  </div>
                  <div className="w-full bg-slate-800 h-3 rounded-full overflow-hidden border border-slate-700">
                    <div 
                      className="bg-amber-400 h-full rounded-full" 
                      style={{ width: `${highestSpendingCategory.percentage}%` }}
                    ></div>
                  </div>
                </div>

                <div className="p-3 bg-slate-850 rounded-xl border border-slate-800 flex items-start gap-2.5">
                  <Info className="w-4 h-4 text-pink-400 shrink-0 mt-0.5" />
                  <p className="text-[10px] text-slate-450 font-medium leading-normal">
                    Tip: Discuss monthly caps on takeout or discretionary household purchases to optimize co-living budgets.
                  </p>
                </div>
              </div>
            ) : (
              <div className="py-6 text-center text-slate-500 text-xs">
                Not enough budget data. Log roommate expenditures to extract dynamic insights.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* SECTION D: INTERACTIVE CATEGORY BREAKDOWN & COMPARISONS */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-stretch">
        
        {/* PANEL 3: SPENDING BY CATEGORY DONUT CHART / DETAILED LIST */}
        <div className="bg-white border-4 border-slate-900 rounded-3xl p-5 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] space-y-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b-2 border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-pink-50 border border-pink-200 text-pink-600 rounded-xl">
                  <PieChart className="w-5 h-5" />
                </span>
                <div>
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight font-display">Spending by Category</h4>
                  <p className="text-[10px] text-slate-500 font-bold">Relative percentage and volume of household bills</p>
                </div>
              </div>
            </div>

            {totalSpend === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs font-bold bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl">
                No categorical distributions logged.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Custom Donut Chart SVG and Interactive Category Selection Grid */}
                <div className="grid grid-cols-1 xs:grid-cols-2 gap-4 items-center">
                  
                  {/* SVG Donut Chart */}
                  <div className="flex justify-center relative">
                    <svg width="150" height="150" viewBox="0 0 100 100" className="rotate-[-90deg]">
                      {/* Base Gray circle */}
                      <circle cx="50" cy="50" r="38" fill="transparent" stroke="#f1f5f9" strokeWidth="12" />
                      
                      {/* Computed Pie Slices */}
                      {(() => {
                        let accumulatedPercent = 0;
                        return sortedCategories.map((cat, i) => {
                          if (cat.total === 0) return null;
                          const percent = cat.percentage;
                          
                          // Circumference is 2 * pi * r = 2 * 3.14159 * 38 = 238.76
                          const circumference = 238.76;
                          const strokeDasharray = `${(percent / 100) * circumference} ${circumference}`;
                          const strokeDashoffset = -((accumulatedPercent / 100) * circumference);
                          
                          accumulatedPercent += percent;

                          const isSelected = selectedCategory === cat.name;

                          return (
                            <circle
                              key={cat.name}
                              cx="50"
                              cy="50"
                              r="38"
                              fill="transparent"
                              stroke={categoryColors[cat.name as Category]?.fill || '#94a3b8'}
                              strokeWidth={isSelected ? '14' : '10'}
                              strokeDasharray={strokeDasharray}
                              strokeDashoffset={strokeDashoffset}
                              className="transition-all duration-350 cursor-pointer hover:stroke-[14px]"
                              onClick={() => setSelectedCategory(cat.name as Category)}
                              style={{ transformOrigin: '50% 50%' }}
                            />
                          );
                        });
                      })()}
                    </svg>

                    {/* Donut Center Label */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                      <span className="text-[10px] font-black uppercase text-slate-400 font-mono">Total Bills</span>
                      <span className="text-sm font-black text-slate-900 font-mono">{formatCurrency(totalSpend)}</span>
                    </div>
                  </div>

                  {/* Top categories checklist list */}
                  <div className="space-y-2">
                    <button
                      id="btn-category-select-all"
                      onClick={() => setSelectedCategory('all')}
                      className={`w-full text-left px-3 py-1.5 rounded-xl border-2 text-[10px] font-black uppercase tracking-wider flex items-center justify-between cursor-pointer transition-colors ${
                        selectedCategory === 'all' 
                          ? 'bg-slate-900 text-white border-slate-900 shadow-[2px_2px_0px_0px_rgba(245,158,11,1)]' 
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-800'
                      }`}
                    >
                      <span>Show All</span>
                      <span className="font-mono text-[9px] opacity-75">{totalBillsCount} Items</span>
                    </button>

                    <div className="max-h-40 overflow-y-auto space-y-1 pr-1">
                      {sortedCategories.filter(cat => cat.total > 0).map((cat) => {
                        const isSelected = selectedCategory === cat.name;
                        const cTheme = categoryColors[cat.name as Category];

                        return (
                          <button
                            key={cat.name}
                            id={`btn-category-select-${cat.name.replace(/\s+/g, '-').toLowerCase()}`}
                            onClick={() => setSelectedCategory(cat.name as Category)}
                            className={`w-full text-left px-3 py-1.5 rounded-xl border-2 text-[10px] font-black uppercase tracking-wider flex items-center justify-between cursor-pointer transition-all ${
                              isSelected 
                                ? 'bg-slate-900 text-white border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,0.15)]' 
                                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-800'
                            }`}
                          >
                            <div className="flex items-center gap-2 truncate">
                              <span 
                                className="w-2.5 h-2.5 rounded-full shrink-0 border border-slate-900/30"
                                style={{ backgroundColor: cTheme?.fill }}
                              ></span>
                              <span className="truncate">{cat.name}</span>
                            </div>
                            <span className="font-mono font-bold text-[9px] opacity-75 shrink-0 ml-2">
                              {cat.percentage.toFixed(0)}%
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Quick informational caption */}
                <p className="text-[10px] text-slate-400 font-bold font-mono text-center">
                  💡 Hint: Select a category above to load individual roommate split histories.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* PANEL 4: CATEGORY SPLIT & ROOMMATE COMPARE */}
        <div className="bg-white border-4 border-slate-900 rounded-3xl p-5 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] space-y-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between border-b-2 border-slate-100 pb-3 mb-4">
              <div className="flex items-center gap-2">
                <span className="p-2 bg-emerald-50 border border-emerald-200 text-emerald-600 rounded-xl">
                  <Users className="w-5 h-5" />
                </span>
                <div>
                  <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight font-display">
                    {activeDetailCategory} Contribution
                  </h4>
                  <p className="text-[10px] text-slate-500 font-bold">
                    How much each roommate paid vs their split responsibility
                  </p>
                </div>
              </div>
            </div>

            {/* Mode Selector Toggle */}
            <div className="flex bg-slate-100 p-1 rounded-xl border-2 border-slate-900 w-full mb-5">
              <button
                id="btn-compare-mode-payer"
                onClick={() => setActiveCompareMode('payer')}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer ${
                  activeCompareMode === 'payer' 
                    ? 'bg-slate-900 text-white shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Payer (Who Paid)
              </button>
              <button
                id="btn-compare-mode-responsible"
                onClick={() => setActiveCompareMode('responsible')}
                className={`flex-1 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer ${
                  activeCompareMode === 'responsible' 
                    ? 'bg-slate-900 text-white shadow-sm' 
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Share (Split Responsibility)
              </button>
            </div>

            {/* Roommate Compare Visualizer */}
            <div className="space-y-6">
              {/* Value comparison */}
              {(() => {
                const ozricValue = activeCompareMode === 'payer' ? activeDetailData.OzricPaid : activeDetailData.OzricShare;
                const pawanValue = activeCompareMode === 'payer' ? activeDetailData.PawanPaid : activeDetailData.PawanShare;
                const combined = ozricValue + pawanValue;
                const ozricPercent = combined > 0 ? (ozricValue / combined) * 100 : 0;
                const pawanPercent = combined > 0 ? (pawanValue / combined) * 100 : 0;

                const oAvatar = profiles.Ozric?.avatar || '🐼';
                const pAvatar = profiles.Pawan?.avatar || '🦊';

                return (
                  <div className="space-y-5">
                    {/* Ozric Bar */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-black text-slate-900 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{oAvatar}</span>
                          <span>{ozricLabel}</span>
                        </div>
                        <span className="text-indigo-600">{formatCurrency(ozricValue)}</span>
                      </div>
                      <div className="w-full bg-slate-100 h-6 rounded-xl border-2 border-slate-900 overflow-hidden relative shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                        <div 
                          className="bg-indigo-500 h-full transition-all duration-500" 
                          style={{ width: `${combined > 0 ? ozricPercent : 0}%` }}
                        ></div>
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-mono font-black text-slate-900 bg-white/70 px-1.5 rounded border border-slate-900">
                          {ozricPercent.toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    {/* Pawan Bar */}
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs font-black text-slate-900 font-mono">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm">{pAvatar}</span>
                          <span>{pawanLabel}</span>
                        </div>
                        <span className="text-rose-600">{formatCurrency(pawanValue)}</span>
                      </div>
                      <div className="w-full bg-slate-100 h-6 rounded-xl border-2 border-slate-900 overflow-hidden relative shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                        <div 
                          className="bg-rose-500 h-full transition-all duration-500" 
                          style={{ width: `${combined > 0 ? pawanPercent : 0}%` }}
                        ></div>
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] font-mono font-black text-slate-900 bg-white/70 px-1.5 rounded border border-slate-900">
                          {pawanPercent.toFixed(0)}%
                        </span>
                      </div>
                    </div>

                    {/* Comparative Standout Box */}
                    <div className="bg-amber-50 border-2 border-slate-900 p-3.5 rounded-2xl flex items-center gap-3">
                      <span className="p-1.5 bg-amber-400 border border-slate-900 text-slate-900 rounded-lg shadow-sm">
                        <TrendingUp className="w-4 h-4" />
                      </span>
                      <p className="text-[10px] text-slate-700 font-bold leading-normal">
                        {combined === 0 ? (
                          <span>No spending registered in <strong className="text-slate-900">{activeDetailCategory}</strong>. Log some bills to see who spends more!</span>
                        ) : activeCompareMode === 'payer' ? (
                          ozricValue === pawanValue ? (
                            <span>Both roommates paid the exact same amount towards <strong className="text-slate-900">{activeDetailCategory}</strong>! Perfect balance.</span>
                          ) : ozricValue > pawanValue ? (
                            <span><strong>{ozricLabel}</strong> has paid <strong className="text-indigo-700">{formatCurrency(ozricValue - pawanValue)}</strong> more out-of-pocket for <strong className="text-slate-900">{activeDetailCategory}</strong> than {pawanLabel}.</span>
                          ) : (
                            <span><strong>{pawanLabel}</strong> has paid <strong className="text-rose-700">{formatCurrency(pawanValue - ozricValue)}</strong> more out-of-pocket for <strong className="text-slate-900">{activeDetailCategory}</strong> than {ozricLabel}.</span>
                          )
                        ) : (
                          ozricValue === pawanValue ? (
                            <span>Both roommates share equal responsibility (50/50 split) for <strong className="text-slate-900">{activeDetailCategory}</strong>!</span>
                          ) : ozricValue > pawanValue ? (
                            <span><strong>{ozricLabel}</strong> is responsible for <strong className="text-indigo-700">{(ozricPercent - pawanPercent).toFixed(0)}%</strong> more of the <strong className="text-slate-900">{activeDetailCategory}</strong> bills than {pawanLabel}.</span>
                          ) : (
                            <span><strong>{pawanLabel}</strong> is responsible for <strong className="text-rose-700">{(pawanPercent - ozricPercent).toFixed(0)}%</strong> more of the <strong className="text-slate-900">{activeDetailCategory}</strong> bills than {ozricLabel}.</span>
                          )
                        )}
                      </p>
                    </div>
                  </div>
                );
              })()}
            </div>
          </div>
        </div>
      </div>

      {/* SECTION E: RECENT ACTIVITY LEDGER TICKER */}
      <div className="bg-white border-4 border-slate-900 rounded-[32px] p-6 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-slate-100 pb-4 gap-3">
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 bg-indigo-50 border-2 border-slate-900 text-indigo-600 rounded-2xl shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
              <Activity className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-base font-black text-slate-900 uppercase tracking-tight font-display">Recent Activity Ledger Feed</h3>
              <p className="text-xs text-slate-500 font-medium">Dynamic timeline of the latest logged roommate transactions</p>
            </div>
          </div>

          <div className="text-[10px] text-slate-500 font-black uppercase tracking-wider font-mono">
            {confirmedExpenses.length} Total items confirmed
          </div>
        </div>

        {confirmedExpenses.length === 0 ? (
          <div className="py-12 text-center text-slate-400 text-xs font-bold bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl">
            The ledger is completely clean. No transactions have been finalized yet.
          </div>
        ) : (
          <div className="space-y-3.5">
            <div className="divide-y-2 divide-slate-100 max-h-[360px] overflow-y-auto pr-1">
              {confirmedExpenses.slice(0, tickerCount).map((exp) => {
                const isCoin = exp.isCoin;
                const isSettlement = exp.isSettlement;
                const isLendBorrow = exp.isLendBorrow;
                const payer = nicknames[exp.paidBy] || exp.paidBy;

                const formattedDate = parseExpenseDate(exp.timestamp).toLocaleDateString('en-IE', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric'
                });

                return (
                  <div key={exp.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      {/* Icon */}
                      <span className={`p-2.5 rounded-xl border-2 border-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] shrink-0 ${
                        isSettlement 
                          ? 'bg-emerald-100 text-emerald-600' 
                          : isCoin 
                            ? 'bg-pink-100 text-pink-600' 
                            : isLendBorrow 
                              ? 'bg-amber-100 text-amber-600' 
                              : 'bg-indigo-100 text-indigo-600'
                      }`}>
                        {isSettlement ? (
                          <ShieldCheck className="w-4 h-4" />
                        ) : isCoin ? (
                          <Coins className="w-4 h-4" />
                        ) : isLendBorrow ? (
                          <Users className="w-4 h-4" />
                        ) : (
                          <Wallet className="w-4 h-4" />
                        )}
                      </span>

                      {/* Info */}
                      <div className="min-w-0">
                        <p className="text-xs font-black text-slate-900 truncate">{exp.title}</p>
                        <p className="text-[10px] text-slate-500 font-bold mt-0.5 whitespace-nowrap">
                          {formattedDate} • Paid by <strong className="text-slate-800 font-black">{payer}</strong>
                        </p>
                      </div>
                    </div>

                    {/* Amount */}
                    <div className="text-right shrink-0">
                      <p className="text-xs font-black font-mono text-slate-900">
                        {formatCurrency(exp.amount)}
                      </p>
                      <span className="text-[9px] font-black uppercase tracking-wider text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                        {isSettlement ? 'Settlement' : isLendBorrow ? 'Loan' : isCoin ? 'Meter Coin' : exp.category}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Pagination See More Button */}
            {confirmedExpenses.length > 5 && (
              <div className="flex justify-center pt-2 border-t-2 border-slate-100">
                <button
                  id="btn-ticker-toggle-more"
                  onClick={() => setTickerCount(prev => prev >= confirmedExpenses.length ? 5 : confirmedExpenses.length)}
                  className="px-6 py-2.5 bg-white text-slate-900 border-3 border-slate-900 rounded-2xl text-[10px] font-black uppercase tracking-wider shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:bg-slate-50 hover:shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] transition-all duration-150 cursor-pointer flex items-center gap-1.5"
                >
                  {tickerCount >= confirmedExpenses.length ? (
                    <span>Show Less</span>
                  ) : (
                    <span>See More ({confirmedExpenses.length - tickerCount} more)</span>
                  )}
                </button>
              </div>
            )}
          </div>
        )}
      </div>

    </div>
  );
}
