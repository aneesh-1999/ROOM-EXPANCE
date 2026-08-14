import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Plus, 
  Clock, 
  TrendingUp, 
  TrendingDown, 
  Briefcase, 
  Filter, 
  Sparkles,
  CalendarDays,
  X,
  CreditCard,
  List,
  ArrowUpRight,
  ArrowDownRight,
  CheckCircle2,
  Euro,
  Share2
} from 'lucide-react';
import { Roommate, Profile, Shift, Expense, RecurringBill, PersonalTransaction } from '../types';
import { subscribeTransactions } from '../personalFinanceService';
import ShareCalendarModal from './ShareCalendarModal';

interface CalendarBookProps {
  currentUser: Roommate;
  nicknames: Record<Roommate, string>;
  profiles: Record<Roommate, Profile>;
  shifts: Shift[];
  expenses: Expense[];
  recurringBills: RecurringBill[];
  onOpenAddShift?: (defaultDate?: string) => void;
  onOpenAddExpense?: () => void;
}

export type EventType = 'shift' | 'expense' | 'income' | 'bill';

export interface UnifiedCalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD
  type: EventType;
  title: string;
  amount?: number; // Positive for earnings/income, negative for expense
  timeStr?: string;
  category?: string;
  user?: Roommate;
  subtext?: string;
  isCompleted?: boolean;
  originalData?: any;
}

const parseLocalDate = (dateStr: string) => {
  if (!dateStr) return new Date();
  const parts = dateStr.split('-');
  if (parts.length !== 3) return new Date(dateStr);
  const yyyy = parseInt(parts[0], 10);
  const mm = parseInt(parts[1], 10) - 1;
  const dd = parseInt(parts[2], 10);
  return new Date(yyyy, mm, dd, 0, 0, 0, 0);
};

const formatDateKey = (d: Date) => {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

export const CalendarBook: React.FC<CalendarBookProps> = ({
  currentUser,
  nicknames,
  profiles,
  shifts,
  expenses,
  recurringBills,
  onOpenAddShift,
  onOpenAddExpense
}) => {
  // Calendar View Mode: 'grid' (Month Calendar) or 'agenda' (List View)
  const [viewMode, setViewMode] = useState<'grid' | 'agenda'>('grid');
  const [showShareModal, setShowShareModal] = useState(false);
  
  // Selected Month state
  const [currentMonth, setCurrentMonth] = useState<Date>(() => new Date());

  // Active filter category
  const [activeFilter, setActiveFilter] = useState<'all' | 'shift' | 'income' | 'expense' | 'bill'>('all');

  // Personal Vault Transactions
  const [personalTx, setPersonalTx] = useState<PersonalTransaction[]>([]);

  // Selected Day String
  const [selectedDateStr, setSelectedDateStr] = useState<string>(() => formatDateKey(new Date()));

  // Subscribe to personal transactions
  useEffect(() => {
    const unsub = subscribeTransactions(currentUser, (txs) => {
      setPersonalTx(txs);
    });
    return () => unsub();
  }, [currentUser]);

  // Month navigation helper
  const navigateMonth = (dir: 'prev' | 'next' | 'today') => {
    if (dir === 'today') {
      const today = new Date();
      setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1));
      setSelectedDateStr(formatDateKey(today));
    } else {
      setCurrentMonth(prev => {
        const next = new Date(prev);
        next.setMonth(prev.getMonth() + (dir === 'next' ? 1 : -1));
        return next;
      });
    }
  };

  // Helper for shift duration
  const getShiftDurationHours = (start: string, end: string, unpaidBreakMins: number = 30) => {
    if (!start || !end || start === end) return 0;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let startMins = sh * 60 + sm;
    let endMins = eh * 60 + em;
    if (endMins < startMins) endMins += 24 * 60;
    const totalMins = endMins - startMins - Number(unpaidBreakMins);
    return Math.max(0, totalMins / 60);
  };

  // Consolidate all events into unified array
  const allEvents = useMemo(() => {
    const events: UnifiedCalendarEvent[] = [];

    // 1. Shifts
    shifts.forEach(s => {
      const hours = getShiftDurationHours(s.startTime, s.endTime, Number(s.unpaidBreakMinutes ?? 30));
      const pay = hours * Number(s.hourlyRate ?? 0);
      events.push({
        id: `shift-${s.id}`,
        date: s.date,
        type: 'shift',
        title: s.title || `${s.employerName || 'Work'} Shift`,
        amount: pay,
        timeStr: `${s.startTime} - ${s.endTime}`,
        category: s.employerName || 'Work',
        user: s.user,
        subtext: `${hours.toFixed(1)} hrs • €${s.hourlyRate || 0}/hr`,
        isCompleted: s.completed,
        originalData: s
      });
    });

    // 2. Shared Expenses
    expenses.forEach(e => {
      let dKey = '';
      if (e.timestamp) {
        const d = e.timestamp.toDate ? e.timestamp.toDate() : new Date(e.timestamp);
        dKey = formatDateKey(d);
      }
      if (dKey) {
        events.push({
          id: `exp-${e.id}`,
          date: dKey,
          type: 'expense',
          title: e.title,
          amount: -Math.abs(e.amount),
          category: e.category,
          user: e.paidBy,
          subtext: `Paid by ${nicknames[e.paidBy] || e.paidBy}`,
          originalData: e
        });
      }
    });

    // 3. Vault Personal Transactions
    personalTx.forEach(pt => {
      const dKey = formatDateKey(new Date(pt.timestamp));
      const isIncome = pt.type === 'INCOME';
      events.push({
        id: `ptx-${pt.id}`,
        date: dKey,
        type: isIncome ? 'income' : 'expense',
        title: pt.title,
        amount: isIncome ? Math.abs(pt.amount) : -Math.abs(pt.amount),
        category: pt.category,
        user: pt.user,
        subtext: pt.notes || `Vault ${pt.type.toLowerCase()}`,
        originalData: pt
      });
    });

    // 4. Recurring Bills
    recurringBills.forEach(b => {
      if (b.user === currentUser) {
        const year = currentMonth.getFullYear();
        const month = currentMonth.getMonth();
        const dueDay = Math.min(b.dueDay || 1, new Date(year, month + 1, 0).getDate());
        const dKey = formatDateKey(new Date(year, month, dueDay));
        events.push({
          id: `bill-${b.id}`,
          date: dKey,
          type: 'bill',
          title: b.title,
          amount: -Math.abs(b.amount),
          category: b.category,
          user: b.user,
          subtext: `Monthly Bill • Due Day ${b.dueDay}`,
          isCompleted: b.autoPaid,
          originalData: b
        });
      }
    });

    return events;
  }, [shifts, expenses, personalTx, recurringBills, currentUser, nicknames, currentMonth]);

  // Filter events
  const filteredEvents = useMemo(() => {
    if (activeFilter === 'all') return allEvents;
    return allEvents.filter(e => e.type === activeFilter);
  }, [allEvents, activeFilter]);

  // Group by date key
  const eventsByDate = useMemo(() => {
    const map: Record<string, UnifiedCalendarEvent[]> = {};
    filteredEvents.forEach(e => {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    });
    return map;
  }, [filteredEvents]);

  // Generate Calendar Days for Current Month
  const calendarDays = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);

    let startDayOfWeek = firstDay.getDay(); // 0 = Sun
    let paddingDays = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1; // Mon = 0

    const days: { date: Date; dateStr: string; isCurrentMonth: boolean }[] = [];

    // Prev month padding
    const prevLastDay = new Date(year, month, 0).getDate();
    for (let i = paddingDays - 1; i >= 0; i--) {
      const d = new Date(year, month - 1, prevLastDay - i);
      days.push({ date: d, dateStr: formatDateKey(d), isCurrentMonth: false });
    }

    // Current month days
    for (let d = 1; d <= lastDay.getDate(); d++) {
      const curr = new Date(year, month, d);
      days.push({ date: curr, dateStr: formatDateKey(curr), isCurrentMonth: true });
    }

    // Next month padding
    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const d = new Date(year, month + 1, i);
      days.push({ date: d, dateStr: formatDateKey(d), isCurrentMonth: false });
    }

    return days;
  }, [currentMonth]);

  // Monthly stats calculation
  const monthStats = useMemo(() => {
    const year = currentMonth.getFullYear();
    const month = currentMonth.getMonth();

    let shiftEarnings = 0;
    let vaultIncome = 0;
    let expensesTotal = 0;
    let shiftCount = 0;

    allEvents.forEach(e => {
      const eDate = parseLocalDate(e.date);
      if (eDate.getFullYear() === year && eDate.getMonth() === month) {
        if (e.type === 'shift') {
          shiftEarnings += (e.amount || 0);
          shiftCount++;
        } else if (e.type === 'income') {
          vaultIncome += Math.abs(e.amount || 0);
        } else if (e.type === 'expense' || e.type === 'bill') {
          expensesTotal += Math.abs(e.amount || 0);
        }
      }
    });

    const net = (shiftEarnings + vaultIncome) - expensesTotal;

    return { shiftEarnings, vaultIncome, expensesTotal, shiftCount, net };
  }, [allEvents, currentMonth]);

  const todayStr = formatDateKey(new Date());

  const selectedDateEvents = eventsByDate[selectedDateStr] || [];
  const selectedDateObj = parseLocalDate(selectedDateStr);

  return (
    <div className="space-y-4 font-sans animate-fade-in max-w-5xl mx-auto">
      
      {/* 1. TOP HEADER & MONTH SUMMARY HERO CARD */}
      <div className="bg-white border-2 sm:border-3 border-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] space-y-4">
        
        {/* Title & Quick Actions */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-slate-100 pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-11 sm:h-11 bg-emerald-400 rounded-xl border-2 border-slate-900 flex items-center justify-center text-slate-950 font-black shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] shrink-0">
              <CalendarDays className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black tracking-tight uppercase font-display text-slate-900">
                  Calendar Book
                </h2>
                <span className="text-[10px] font-mono font-black uppercase bg-emerald-100 text-emerald-950 px-2 py-0.5 rounded-md border border-slate-900">
                  {nicknames[currentUser] || currentUser}
                </span>
              </div>
              <p className="text-xs text-slate-500 font-bold">
                Shifts, Income, Expenses & Monthly Bills
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowShareModal(true)}
              className="flex-1 sm:flex-none px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[0.5px] active:translate-y-[0.5px] transition cursor-pointer flex items-center justify-center gap-1.5"
              title="Share shift calendar link with family & friends"
            >
              <Share2 className="w-4 h-4 stroke-[2.5]" />
              <span>Share Link</span>
            </button>

            <button
              onClick={() => onOpenAddShift?.(selectedDateStr)}
              className="flex-1 sm:flex-none px-3.5 py-2 bg-emerald-400 hover:bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[0.5px] active:translate-y-[0.5px] transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Shift</span>
            </button>
            <button
              onClick={onOpenAddExpense}
              className="flex-1 sm:flex-none px-3.5 py-2 bg-amber-300 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[0.5px] active:translate-y-[0.5px] transition cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Plus className="w-4 h-4 stroke-[3]" />
              <span>Expense</span>
            </button>
          </div>
        </div>

        {/* Financial Stat Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <div className="bg-emerald-50/90 p-3 rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
            <span className="text-[10px] font-mono font-black uppercase text-slate-600 flex items-center gap-1">
              <Briefcase className="w-3.5 h-3.5 text-emerald-800" /> Shift Earnings
            </span>
            <span className="text-base sm:text-lg font-black font-mono text-emerald-900 block mt-1">
              +€{monthStats.shiftEarnings.toFixed(2)}
            </span>
            <span className="text-[10px] font-mono text-emerald-800 font-bold block mt-0.5">
              {monthStats.shiftCount} work shifts
            </span>
          </div>

          <div className="bg-teal-50/90 p-3 rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
            <span className="text-[10px] font-mono font-black uppercase text-slate-600 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5 text-teal-800" /> Vault Income
            </span>
            <span className="text-base sm:text-lg font-black font-mono text-teal-900 block mt-1">
              +€{monthStats.vaultIncome.toFixed(2)}
            </span>
            <span className="text-[10px] font-mono text-teal-800 font-bold block mt-0.5">
              Deposits & Income
            </span>
          </div>

          <div className="bg-rose-50/90 p-3 rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
            <span className="text-[10px] font-mono font-black uppercase text-slate-600 flex items-center gap-1">
              <TrendingDown className="w-3.5 h-3.5 text-rose-800" /> Total Outflow
            </span>
            <span className="text-base sm:text-lg font-black font-mono text-rose-900 block mt-1">
              -€{monthStats.expensesTotal.toFixed(2)}
            </span>
            <span className="text-[10px] font-mono text-rose-800 font-bold block mt-0.5">
              Expenses & Bills
            </span>
          </div>

          <div className="bg-indigo-50/90 p-3 rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
            <span className="text-[10px] font-mono font-black uppercase text-slate-600 flex items-center gap-1">
              <CreditCard className="w-3.5 h-3.5 text-indigo-800" /> Net Flow
            </span>
            <span className={`text-base sm:text-lg font-black font-mono block mt-1 ${
              monthStats.net >= 0 ? 'text-emerald-900' : 'text-rose-900'
            }`}>
              {monthStats.net >= 0 ? '+' : ''}€{monthStats.net.toFixed(2)}
            </span>
            <span className="text-[10px] font-mono text-indigo-800 font-bold block mt-0.5">
              Monthly Balance
            </span>
          </div>
        </div>

      </div>

      {/* 2. CALENDAR CONTROLS & FILTER ROW */}
      <div className="bg-white border-2 sm:border-3 border-slate-900 rounded-2xl p-3 sm:p-4 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] space-y-3">
        
        {/* Navigation & View Toggle */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          
          {/* Month Switcher */}
          <div className="flex items-center justify-between sm:justify-start gap-2 w-full sm:w-auto">
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => navigateMonth('prev')}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-xl border-2 border-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] transition cursor-pointer"
                title="Previous Month"
              >
                <ChevronLeft className="w-4 h-4 stroke-[3]" />
              </button>

              <button
                onClick={() => navigateMonth('today')}
                className="px-3 py-1.5 bg-amber-300 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl border-2 border-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] transition cursor-pointer"
              >
                Today
              </button>

              <button
                onClick={() => navigateMonth('next')}
                className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-900 rounded-xl border-2 border-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] transition cursor-pointer"
                title="Next Month"
              >
                <ChevronRight className="w-4 h-4 stroke-[3]" />
              </button>
            </div>

            <h3 className="text-base sm:text-lg font-black text-slate-900 font-display uppercase tracking-tight ml-2">
              {currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
            </h3>
          </div>

          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-xl border-2 border-slate-900 w-full sm:w-auto">
            <button
              onClick={() => setViewMode('grid')}
              className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 border-2 ${
                viewMode === 'grid'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'text-slate-700 border-transparent hover:text-slate-900'
              }`}
            >
              <CalendarIcon className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Grid View</span>
            </button>

            <button
              onClick={() => setViewMode('agenda')}
              className={`flex-1 sm:flex-none px-4 py-1.5 rounded-lg text-xs font-black uppercase tracking-wider transition cursor-pointer flex items-center justify-center gap-1.5 border-2 ${
                viewMode === 'agenda'
                  ? 'bg-slate-900 text-white border-slate-900 shadow-xs'
                  : 'text-slate-700 border-transparent hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Agenda Feed</span>
            </button>
          </div>

        </div>

        {/* Filter Chips Bar */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2 border-t border-slate-100">
          <span className="text-[10px] font-mono font-black uppercase text-slate-500 shrink-0 mr-1 flex items-center gap-1">
            <Filter className="w-3 h-3 text-slate-600" /> Filter:
          </span>
          {[
            { id: 'all', label: 'All Items', icon: Filter },
            { id: 'shift', label: 'Work Shifts', icon: Briefcase },
            { id: 'income', label: 'Vault Income', icon: TrendingUp },
            { id: 'expense', label: 'Expenses', icon: TrendingDown },
            { id: 'bill', label: 'Recurring Bills', icon: CalendarDays }
          ].map(f => {
            const IconComp = f.icon;
            return (
              <button
                key={f.id}
                onClick={() => setActiveFilter(f.id as any)}
                className={`px-3 py-1 rounded-xl text-[11px] font-black uppercase tracking-wider border-2 transition-all cursor-pointer shrink-0 flex items-center gap-1.5 ${
                  activeFilter === f.id
                    ? 'bg-slate-900 text-white border-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]'
                    : 'bg-white text-slate-700 border-slate-200 hover:border-slate-900'
                }`}
              >
                <IconComp className="w-3 h-3 stroke-[2.5]" />
                <span>{f.label}</span>
              </button>
            );
          })}
        </div>

      </div>

      {/* 3. CALENDAR MONTH GRID VIEW */}
      {viewMode === 'grid' && (
        <div className="bg-white border-2 sm:border-3 border-slate-900 rounded-2xl sm:rounded-3xl p-2 sm:p-4 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] space-y-2">
          
          {/* Days of Week Header */}
          <div className="grid grid-cols-7 gap-1 text-center font-mono font-black text-[10px] sm:text-xs text-slate-500 uppercase tracking-wider pb-2 border-b-2 border-slate-100">
            <span>Mon</span>
            <span>Tue</span>
            <span>Wed</span>
            <span>Thu</span>
            <span>Fri</span>
            <span className="text-indigo-600">Sat</span>
            <span className="text-indigo-600">Sun</span>
          </div>

          {/* Calendar Grid Days */}
          <div className="grid grid-cols-7 gap-1 sm:gap-2">
            {calendarDays.map((cd, idx) => {
              const dayEvents = eventsByDate[cd.dateStr] || [];
              const isToday = cd.dateStr === todayStr;
              const isSelected = cd.dateStr === selectedDateStr;

              // Calculate day metrics
              let dayIncome = 0;
              let dayExpense = 0;
              let hasShift = false;

              dayEvents.forEach(e => {
                if (e.type === 'shift' || e.type === 'income') {
                  dayIncome += Math.abs(e.amount || 0);
                  if (e.type === 'shift') hasShift = true;
                } else if (e.type === 'expense' || e.type === 'bill') {
                  dayExpense += Math.abs(e.amount || 0);
                }
              });

              return (
                <div
                  key={`${cd.dateStr}-${idx}`}
                  onClick={() => setSelectedDateStr(cd.dateStr)}
                  className={`min-h-[70px] sm:min-h-[110px] p-1 sm:p-2 rounded-xl sm:rounded-2xl border-2 transition-all cursor-pointer flex flex-col justify-between relative ${
                    !cd.isCurrentMonth
                      ? 'bg-slate-50/50 border-slate-200 text-slate-300'
                      : isToday
                        ? 'bg-amber-200/90 border-slate-900 text-slate-950 font-black shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] ring-2 ring-amber-400'
                        : isSelected
                          ? 'bg-emerald-100/90 border-slate-900 text-slate-950 shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)] ring-2 ring-emerald-500'
                          : 'bg-white border-slate-200 hover:border-slate-900 text-slate-800'
                  }`}
                >
                  {/* Day Cell Header */}
                  <div className="flex items-center justify-between w-full">
                    <span className={`text-xs font-mono font-black px-1.5 py-0.5 rounded-md ${
                      isToday
                        ? 'bg-slate-950 text-white'
                        : isSelected
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-800'
                    }`}>
                      {cd.date.getDate()}
                    </span>

                    {/* Today Badge on Desktop */}
                    {isToday && (
                      <span className="hidden sm:inline-block text-[8px] font-mono font-black uppercase bg-slate-950 text-amber-300 px-1 py-0.5 rounded border border-slate-900">
                        Today
                      </span>
                    )}
                  </div>

                  {/* Mobile Compact View (< sm) */}
                  <div className="sm:hidden my-1 flex flex-col items-center justify-center gap-0.5">
                    {/* Event Dot Badges */}
                    {dayEvents.length > 0 && (
                      <div className="flex items-center gap-1 justify-center flex-wrap">
                        {hasShift && <span className="w-2 h-2 rounded-full bg-emerald-600 border border-slate-900" title="Shift" />}
                        {dayIncome > 0 && !hasShift && <span className="w-2 h-2 rounded-full bg-teal-500 border border-slate-900" title="Income" />}
                        {dayExpense > 0 && <span className="w-2 h-2 rounded-full bg-rose-500 border border-slate-900" title="Expense" />}
                      </div>
                    )}

                    {/* Day Net Summary Pill */}
                    {(dayIncome > 0 || dayExpense > 0) && (
                      <span className={`text-[8.5px] font-mono font-black ${
                        dayIncome >= dayExpense ? 'text-emerald-800' : 'text-rose-800'
                      }`}>
                        {dayIncome >= dayExpense ? `+€${(dayIncome - dayExpense).toFixed(0)}` : `-€${(dayExpense - dayIncome).toFixed(0)}`}
                      </span>
                    )}
                  </div>

                  {/* Desktop Event Badges (sm and up) */}
                  <div className="hidden sm:block flex-1 space-y-1 my-1 overflow-hidden">
                    {dayEvents.slice(0, 2).map(e => (
                      <div
                        key={e.id}
                        className={`text-[9.5px] font-black px-1.5 py-0.5 rounded-md border truncate flex items-center justify-between gap-1 ${
                          e.type === 'shift'
                            ? 'bg-emerald-200 text-slate-950 border-emerald-900 font-mono'
                            : e.type === 'income'
                              ? 'bg-teal-100 text-teal-950 border-teal-900 font-mono'
                              : e.type === 'expense'
                                ? 'bg-rose-200 text-rose-950 border-rose-900 font-mono'
                                : 'bg-indigo-200 text-indigo-950 border-indigo-900 font-mono'
                        }`}
                      >
                        <span className="truncate">{e.title}</span>
                        {e.amount !== undefined && (
                          <span className="shrink-0">
                            {e.amount >= 0 ? '+' : ''}€{Math.abs(e.amount).toFixed(0)}
                          </span>
                        )}
                      </div>
                    ))}

                    {/* Overflow Tag */}
                    {dayEvents.length > 2 && (
                      <span className="text-[8.5px] font-mono font-black text-slate-500 block text-right">
                        +{dayEvents.length - 2} more
                      </span>
                    )}
                  </div>

                  {/* Desktop Bottom Totals */}
                  <div className="hidden sm:flex pt-0.5 border-t border-slate-100 items-center justify-between text-[8.5px] font-mono font-bold">
                    {dayIncome > 0 && <span className="text-emerald-800 font-black">+€{dayIncome.toFixed(0)}</span>}
                    {dayExpense > 0 && <span className="text-rose-800 font-black">-€{dayExpense.toFixed(0)}</span>}
                  </div>

                </div>
              );
            })}
          </div>

        </div>
      )}

      {/* 4. SELECTED DAY INLINE DETAIL BOOK PANEL (SIMPLE, CLEAN, ALWAYS PRECISE) */}
      <div className="bg-white border-2 sm:border-3 border-slate-900 rounded-2xl sm:rounded-3xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] space-y-3">
        
        {/* Day Card Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b-2 border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-300 rounded-xl border-2 border-slate-900 shadow-xs">
              <CalendarIcon className="w-4 h-4 text-slate-950 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-[10px] font-mono font-black uppercase text-slate-400 block">
                Selected Day Entries
              </span>
              <h4 className="text-sm sm:text-base font-black text-slate-900 uppercase font-display">
                {selectedDateObj.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}
              </h4>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => onOpenAddShift?.(selectedDateStr)}
              className="px-3 py-1.5 bg-emerald-400 hover:bg-emerald-500 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl border-2 border-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Shift</span>
            </button>
            <button
              onClick={onOpenAddExpense}
              className="px-3 py-1.5 bg-amber-300 hover:bg-amber-400 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl border-2 border-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3]" />
              <span>Expense</span>
            </button>
          </div>
        </div>

        {/* Selected Day Items Feed */}
        {selectedDateEvents.length === 0 ? (
          <div className="text-center py-6 text-slate-500 font-mono text-xs space-y-1 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
            <Sparkles className="w-5 h-5 mx-auto text-slate-400" />
            <p className="font-bold">No entries logged on this date</p>
            <p className="text-[10px] text-slate-400">Tap + Shift or + Expense above to record a new entry</p>
          </div>
        ) : (
          <div className="space-y-2">
            {selectedDateEvents.map(e => (
              <div
                key={e.id}
                className="p-3 bg-slate-50 hover:bg-emerald-50 border-2 border-slate-900 rounded-xl flex items-center justify-between gap-3 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] transition"
              >
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg border-2 border-slate-900 shrink-0 ${
                    e.type === 'shift' ? 'bg-emerald-300 text-slate-950' :
                    e.type === 'income' ? 'bg-teal-200 text-teal-950' :
                    e.type === 'expense' ? 'bg-rose-200 text-slate-950' :
                    'bg-indigo-200 text-slate-950'
                  }`}>
                    {e.type === 'shift' ? <Briefcase className="w-4 h-4 stroke-[2.5]" /> :
                     e.type === 'income' ? <TrendingUp className="w-4 h-4 stroke-[2.5]" /> :
                     e.type === 'expense' ? <TrendingDown className="w-4 h-4 stroke-[2.5]" /> :
                     <CalendarIcon className="w-4 h-4 stroke-[2.5]" />}
                  </div>

                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-[9px] font-mono font-black uppercase px-2 py-0.5 bg-slate-200 text-slate-900 rounded border border-slate-900">
                        {e.type}
                      </span>
                      <h5 className="text-xs font-black text-slate-900 uppercase font-display">{e.title}</h5>
                    </div>
                    <p className="text-[10px] text-slate-600 font-bold mt-0.5">
                      {e.subtext} {e.timeStr ? `• ${e.timeStr}` : ''}
                    </p>
                  </div>
                </div>

                {e.amount !== undefined && (
                  <span className={`text-sm font-black font-mono shrink-0 ${
                    e.amount >= 0 ? 'text-emerald-800' : 'text-rose-800'
                  }`}>
                    {e.amount >= 0 ? '+' : ''}€{e.amount.toFixed(2)}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

      </div>

      {/* 5. AGENDA FEED VIEW */}
      {viewMode === 'agenda' && (
        <div className="bg-white border-2 sm:border-3 border-slate-900 rounded-2xl sm:rounded-3xl p-4 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] space-y-3">
          <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 font-mono border-b-2 border-slate-100 pb-2">
            Chronological Month Agenda ({filteredEvents.length} items)
          </h4>

          {filteredEvents.length === 0 ? (
            <div className="text-center py-10 text-slate-500 font-mono text-xs space-y-1">
              <CalendarIcon className="w-8 h-8 mx-auto text-slate-300 stroke-[2]" />
              <p>No events found for this period.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[500px] overflow-y-auto pr-1">
              {filteredEvents.map(e => (
                <div
                  key={e.id}
                  onClick={() => setSelectedDateStr(e.date)}
                  className="p-3 bg-slate-50 hover:bg-emerald-50 border-2 border-slate-900 rounded-xl flex items-center justify-between gap-3 cursor-pointer transition shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]"
                >
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg border-2 border-slate-900 shrink-0 ${
                      e.type === 'shift' ? 'bg-emerald-300 text-slate-950' :
                      e.type === 'income' ? 'bg-teal-200 text-teal-950' :
                      e.type === 'expense' ? 'bg-rose-200 text-slate-950' :
                      'bg-indigo-200 text-slate-950'
                    }`}>
                      {e.type === 'shift' ? <Briefcase className="w-4 h-4 stroke-[2.5]" /> :
                       e.type === 'income' ? <TrendingUp className="w-4 h-4 stroke-[2.5]" /> :
                       e.type === 'expense' ? <TrendingDown className="w-4 h-4 stroke-[2.5]" /> :
                       <CalendarIcon className="w-4 h-4 stroke-[2.5]" />}
                    </div>

                    <div>
                      <div className="flex items-center gap-2">
                        <h5 className="text-xs font-black text-slate-900 uppercase font-display">{e.title}</h5>
                        <span className="text-[9px] font-mono font-black uppercase px-2 py-0.5 bg-slate-200 text-slate-900 rounded border border-slate-900">
                          {e.date}
                        </span>
                      </div>
                      <p className="text-[10px] text-slate-600 font-bold mt-0.5">
                        {e.subtext} {e.timeStr ? `• ${e.timeStr}` : ''}
                      </p>
                    </div>
                  </div>

                  {e.amount !== undefined && (
                    <span className={`text-sm font-black font-mono shrink-0 ${
                      e.amount >= 0 ? 'text-emerald-800' : 'text-rose-800'
                    }`}>
                      {e.amount >= 0 ? '+' : ''}€{e.amount.toFixed(2)}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* SHARE CALENDAR MODAL */}
      {showShareModal && (
        <ShareCalendarModal
          currentUser={currentUser}
          userNickname={nicknames[currentUser]}
          onClose={() => setShowShareModal(false)}
        />
      )}

    </div>
  );
};

export default CalendarBook;
