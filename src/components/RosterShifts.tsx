import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { Roommate, Profile, Shift, Expense, RecurringBill } from '../types';
import { addShift, updateShift, deleteShift, subscribeShifts } from '../dbService';
import { 
  Calendar, Clock, Plus, Trash2, Bell, BellRing, Check, CheckCircle2, X, 
  ChevronLeft, ChevronRight, ChevronDown, ChevronUp, AlertCircle, Sparkles, Coffee, Moon, Sun, Briefcase, 
  DollarSign, TrendingUp, HelpCircle, CheckSquare, Square, Pencil, FileText, Image, Download,
  Lock, Eye, EyeOff, User, UserCheck, Sunrise, Sunset, RotateCcw, Building2, Euro, CalendarDays
} from 'lucide-react';
import { showNotification } from '../notificationService';
import CustomConfirmModal from './CustomConfirmModal';
import CalendarBook from './CalendarBook';

interface RosterShiftsProps {
  currentUser: Roommate;
  nicknames: Record<Roommate, string>;
  profiles: Record<Roommate, Profile>;
  expenses?: Expense[];
  recurringBills?: RecurringBill[];
  onOpenAddExpense?: () => void;
}

const parseLocalDate = (dateStr: string) => {
  if (!dateStr) return new Date();
  const parts = dateStr.split('-');
  if (parts.length !== 3) return new Date(dateStr);
  const yyyy = parseInt(parts[0], 10);
  const mm = parseInt(parts[1], 10) - 1; // 0-based month
  const dd = parseInt(parts[2], 10);
  return new Date(yyyy, mm, dd, 0, 0, 0, 0);
};

function UserAvatarIcon({ user, size = "md" }: { user: Roommate; size?: "sm" | "md" | "lg" }) {
  const isOzric = user === 'Ozric';
  const sizeClasses = size === 'sm' 
    ? 'w-5 h-5' 
    : size === 'lg' 
      ? 'w-8 h-8' 
      : 'w-6 h-6';
  
  return (
    <div 
      className={`inline-flex items-center justify-center rounded-lg border-1.5 border-slate-900 shrink-0 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] ${
        isOzric ? 'bg-indigo-600 text-white' : 'bg-amber-400 text-slate-950'
      } ${sizeClasses}`}
      title={user}
    >
      <User className="w-[60%] h-[60%] stroke-[2.5]" />
    </div>
  );
}

function UserBadge({ user, nickname }: { user: Roommate; nickname?: string }) {
  const isOzric = user === 'Ozric';
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg text-xs font-mono font-black border-2 border-slate-900 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] ${
      isOzric ? 'bg-indigo-600 text-white' : 'bg-amber-400 text-slate-950'
    }`}>
      <User className="w-3.5 h-3.5 stroke-[2.5]" />
      <span>{nickname || user}</span>
    </span>
  );
}

export default function RosterShifts({ 
  currentUser, 
  nicknames, 
  profiles,
  expenses = [],
  recurringBills = [],
  onOpenAddExpense
}: RosterShiftsProps) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [mainMode, setMainMode] = useState<'calendar' | 'roster'>('calendar');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Navigation for weeks
  const [currentWeekStart, setCurrentWeekStart] = useState<Date>(() => {
    const today = new Date();
    const day = today.getDay();
    const diff = today.getDate() - day + (day === 0 ? -6 : 1); // Adjust to Monday
    const monday = new Date(today.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    return monday;
  });

  // Filter state
  const [statsPeriod, setStatsPeriod] = useState<'week' | 'month'>('week');
  const [hideCompleted, setHideCompleted] = useState<boolean>(true);
  const [showAllDetails, setShowAllDetails] = useState<boolean>(false);
  const [expandedShiftIds, setExpandedShiftIds] = useState<Record<string, boolean>>({});

  const toggleShiftDetails = (id: string) => {
    setExpandedShiftIds(prev => ({
      ...prev,
      [id]: prev[id] !== undefined ? !prev[id] : !showAllDetails
    }));
  };

  // Form State
  const [showAddForm, setShowAddForm] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });
  const [startTime, setStartTime] = useState('07:00');
  const [endTime, setEndTime] = useState('15:30');
  const [reminderActive, setReminderActive] = useState(true);
  const [reminderHoursBefore, setReminderHoursBefore] = useState<number>(2);
  const [notes, setNotes] = useState('');
  
  // Custom employer, break & rate states
  const [employerName, setEmployerName] = useState('');
  const [hourlyRate, setHourlyRate] = useState('15.00');
  const [unpaidBreakMinutes, setUnpaidBreakMinutes] = useState(30);
  const [completed, setCompleted] = useState(false);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit State
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);

  // Delete Confirm Modal State
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [shiftToDelete, setShiftToDelete] = useState<{ id: string; user: Roommate } | null>(null);

  // Interactive Calendar Modal State
  const [showCalendarModal, setShowCalendarModal] = useState(false);
  const [calendarMonth, setCalendarMonth] = useState<Date>(() => new Date());
  const [selectedCalendarDate, setSelectedCalendarDate] = useState<string>(() => {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, '0');
    const dd = String(today.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  });

  const navigateCalendarMonth = (direction: 'prev' | 'next' | 'today') => {
    if (direction === 'today') {
      const today = new Date();
      setCalendarMonth(new Date(today.getFullYear(), today.getMonth(), 1));
      setSelectedCalendarDate(formatDateKey(today));
    } else {
      setCalendarMonth(prev => {
        const next = new Date(prev);
        next.setMonth(prev.getMonth() + (direction === 'next' ? 1 : -1));
        return next;
      });
    }
  };

  const jumpToDateWeek = (targetDateStr: string) => {
    const targetDate = parseLocalDate(targetDateStr);
    const day = targetDate.getDay();
    const diff = targetDate.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(targetDate.setDate(diff));
    monday.setHours(0, 0, 0, 0);
    setCurrentWeekStart(monday);
  };

  const getCalendarDaysForMonth = (year: number, month: number) => {
    const firstDayOfMonth = new Date(year, month, 1);
    const lastDayOfMonth = new Date(year, month + 1, 0);
    
    let startDayOfWeek = firstDayOfMonth.getDay();
    let paddingDays = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

    const days: { date: Date; dateStr: string; isCurrentMonth: boolean }[] = [];

    const prevMonthLastDay = new Date(year, month, 0).getDate();
    for (let i = paddingDays - 1; i >= 0; i--) {
      const prevDate = new Date(year, month - 1, prevMonthLastDay - i);
      days.push({
        date: prevDate,
        dateStr: formatDateKey(prevDate),
        isCurrentMonth: false
      });
    }

    for (let d = 1; d <= lastDayOfMonth.getDate(); d++) {
      const currDate = new Date(year, month, d);
      days.push({
        date: currDate,
        dateStr: formatDateKey(currDate),
        isCurrentMonth: true
      });
    }

    const remaining = (7 - (days.length % 7)) % 7;
    for (let i = 1; i <= remaining; i++) {
      const nextDate = new Date(year, month + 1, i);
      days.push({
        date: nextDate,
        dateStr: formatDateKey(nextDate),
        isCurrentMonth: false
      });
    }

    return days;
  };

  // Load and store manual employer presets to persist them
  const [localEmployerPresets, setLocalEmployerPresets] = useState<Record<string, { hourlyRate: number; unpaidBreakMinutes: number; title?: string }>>(() => {
    try {
      const saved = localStorage.getItem(`cohabit_employer_presets_${currentUser}`);
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  // Combine custom stored presets and auto-extracted presets from history
  const allPresets = React.useMemo(() => {
    const presets: Record<string, { hourlyRate: number; unpaidBreakMinutes: number; title: string }> = {};
    
    // 1. Start with auto-extracted shifts history
    const sortedMyShifts = [...shifts]
      .filter(s => s.user === currentUser && s.employerName && s.employerName.trim() !== '')
      .sort((a, b) => a.date.localeCompare(b.date));

    sortedMyShifts.forEach(s => {
      const name = s.employerName!.trim();
      presets[name] = {
        hourlyRate: s.hourlyRate !== undefined ? s.hourlyRate : 15.00,
        unpaidBreakMinutes: s.unpaidBreakMinutes !== undefined ? s.unpaidBreakMinutes : 30,
        title: s.title || ''
      };
    });

    // 2. Overwrite / merge with custom localEmployerPresets
    Object.keys(localEmployerPresets).forEach((name) => {
      const data = localEmployerPresets[name];
      presets[name] = {
        hourlyRate: data.hourlyRate,
        unpaidBreakMinutes: data.unpaidBreakMinutes,
        title: data.title || presets[name]?.title || ''
      };
    });

    return presets;
  }, [shifts, currentUser, localEmployerPresets]);

  // Save/update preset
  const saveEmployerPreset = (name: string, rate: number, breakMins: number, shiftTitle?: string) => {
    if (!name.trim()) return;
    const cleanName = name.trim();
    setLocalEmployerPresets(prev => {
      const updated = {
        ...prev,
        [cleanName]: {
          hourlyRate: rate,
          unpaidBreakMinutes: breakMins,
          title: shiftTitle || prev[cleanName]?.title || ''
        }
      };
      localStorage.setItem(`cohabit_employer_presets_${currentUser}`, JSON.stringify(updated));
      return updated;
    });
  };

  const handleEmployerNameChange = (name: string) => {
    setEmployerName(name);
    const cleanName = name.trim();
    let preset = allPresets[cleanName];
    if (!preset) {
      const lowerName = cleanName.toLowerCase();
      const matchKey = Object.keys(allPresets).find(k => k.toLowerCase() === lowerName);
      if (matchKey) {
        preset = allPresets[matchKey];
      }
    }
    if (preset) {
      setHourlyRate(String(preset.hourlyRate));
      setUnpaidBreakMinutes(preset.unpaidBreakMinutes);
      if (preset.title && !title.trim()) {
        setTitle(preset.title);
      }
    }
  };

  // Subscribe to only current user shifts to enforce complete privacy as requested
  useEffect(() => {
    setLoading(true);
    const unsubscribeUser = subscribeShifts(currentUser, (userShifts) => {
      // Sort shifts by date then start time
      const sorted = [...userShifts].sort((a, b) => {
        const dateComp = a.date.localeCompare(b.date);
        if (dateComp !== 0) return dateComp;
        return a.startTime.localeCompare(b.startTime);
      });
      setShifts(sorted);
      setLoading(false);
    });

    return () => unsubscribeUser();
  }, [currentUser]);

  // Handle shift template selections
  const applyTemplate = (type: 'morning' | 'midday' | 'evening' | 'night' | 'off' | 'custom') => {
    if (type === 'morning') {
      setTitle('Morning Shift');
      setStartTime('07:00');
      setEndTime('15:30');
      setUnpaidBreakMinutes(30);
      setHourlyRate('15.00');
    } else if (type === 'midday') {
      setTitle('Midday Shift');
      setStartTime('09:00');
      setEndTime('17:30');
      setUnpaidBreakMinutes(30);
      setHourlyRate('15.00');
    } else if (type === 'evening') {
      setTitle('Evening Shift');
      setStartTime('15:00');
      setEndTime('23:30');
      setUnpaidBreakMinutes(30);
      setHourlyRate('15.00');
    } else if (type === 'night') {
      setTitle('Night Shift');
      setStartTime('00:00');
      setEndTime('08:00');
      setUnpaidBreakMinutes(30);
      setHourlyRate('15.00');
    } else if (type === 'off') {
      setTitle('Day Off');
      setStartTime('00:00');
      setEndTime('00:00');
      setHourlyRate('0');
      setUnpaidBreakMinutes(0);
      setReminderActive(false);
    } else {
      setTitle('');
      setStartTime('09:00');
      setEndTime('17:00');
      setUnpaidBreakMinutes(30);
    }
  };

  const handleAddShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !date || !startTime || !endTime) {
      setErrorMsg('Please fill out all required fields.');
      return;
    }

    setErrorMsg('');
    setSuccessMsg('');
    setIsSubmitting(true);

    try {
      const shiftData: Omit<Shift, 'id'> = {
        user: currentUser,
        date,
        startTime,
        endTime,
        title: title.trim(),
        reminderHoursBefore,
        reminderActive,
        notified: false,
        notes: notes.trim(),
        employerName: employerName.trim(),
        hourlyRate: parseFloat(hourlyRate) || 0,
        unpaidBreakMinutes: Number(unpaidBreakMinutes),
        completed
      };

      if (editingShiftId) {
        await updateShift(editingShiftId, shiftData, currentUser);
        setSuccessMsg('Shift updated successfully!');
        setEditingShiftId(null);
      } else {
        await addShift(shiftData);
        setSuccessMsg('Shift added to roster successfully!');
      }

      // Save the employer rate preset so it is immediately remembered and prefilled next time
      if (employerName.trim()) {
        saveEmployerPreset(
          employerName,
          parseFloat(hourlyRate) || 0,
          Number(unpaidBreakMinutes),
          title.trim()
        );
      }

      // Reset Form
      setTitle('');
      setNotes('');
      setEmployerName('');
      setCompleted(false);
      setShowAddForm(false);
    } catch (err: any) {
      setErrorMsg('Failed to save shift: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditClick = (shift: Shift) => {
    if (shift.user !== currentUser) {
      setErrorMsg('You can only edit your own shifts!');
      return;
    }
    setEditingShiftId(shift.id || null);
    setTitle(shift.title);
    setDate(shift.date);
    setStartTime(shift.startTime);
    setEndTime(shift.endTime);
    setReminderActive(shift.reminderActive);
    setReminderHoursBefore(shift.reminderHoursBefore);
    setNotes(shift.notes || '');
    setEmployerName(shift.employerName || '');
    setHourlyRate(shift.hourlyRate !== undefined ? String(shift.hourlyRate) : '15.00');
    setUnpaidBreakMinutes(shift.unpaidBreakMinutes !== undefined ? shift.unpaidBreakMinutes : 30);
    setCompleted(!!shift.completed);
    setShowAddForm(true);
    setErrorMsg('');
    setSuccessMsg('');

    // Smooth scroll to the editor form container at the top so they see it instantly!
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDeleteClick = (id: string, user: Roommate) => {
    if (user !== currentUser) {
      setErrorMsg('You can only delete your own shifts!');
      return;
    }
    setShiftToDelete({ id, user });
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!shiftToDelete) return;
    const { id } = shiftToDelete;
    setErrorMsg('');
    setSuccessMsg('');
    setDeleteModalOpen(false);
    try {
      await deleteShift(id, currentUser);
      setSuccessMsg('Shift deleted successfully.');
    } catch (err: any) {
      setErrorMsg('Failed to delete shift: ' + err.message);
    } finally {
      setShiftToDelete(null);
    }
  };

  const handleToggleReminder = async (shift: Shift) => {
    if (shift.user !== currentUser) return;
    if (!shift.id) return;

    try {
      await updateShift(shift.id, {
        reminderActive: !shift.reminderActive,
        // Reset notified status if enabling reminders
        notified: !shift.reminderActive ? false : shift.notified
      });
    } catch (err: any) {
      console.error('Failed to toggle reminder status', err);
    }
  };

  const handleToggleCompleted = async (shift: Shift) => {
    if (shift.user !== currentUser) return;
    if (!shift.id) return;

    try {
      await updateShift(shift.id, {
        completed: !shift.completed
      }, currentUser);
    } catch (err: any) {
      console.error('Failed to toggle completion status', err);
    }
  };

  // Helper: Get dates of the selected week (Monday to Sunday)
  const getWeekDays = () => {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(currentWeekStart);
      d.setDate(currentWeekStart.getDate() + i);
      days.push(d);
    }
    return days;
  };

  const weekDays = getWeekDays();

  // Helper: Format Date string YYYY-MM-DD
  const formatDateKey = (d: Date) => {
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    return `${yyyy}-${mm}-${dd}`;
  };

  // Navigate weeks
  const navigateWeek = (direction: 'prev' | 'next' | 'current') => {
    setErrorMsg('');
    setSuccessMsg('');
    if (direction === 'current') {
      const today = new Date();
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(today.setDate(diff));
      monday.setHours(0, 0, 0, 0);
      setCurrentWeekStart(monday);
    } else {
      const nextWeek = new Date(currentWeekStart);
      nextWeek.setDate(currentWeekStart.getDate() + (direction === 'next' ? 7 : -7));
      setCurrentWeekStart(nextWeek);
    }
  };

  // Filter shifts
  const filteredShifts = shifts;

  // Get shifts specifically for a given date
  const getShiftsForDate = (dateStr: string) => {
    return filteredShifts.filter(s => s.date === dateStr);
  };

  const otherUser: Roommate = currentUser === 'Ozric' ? 'Pawan' : 'Ozric';

  // Helper calculations for durations & wages
  const getShiftDurationHours = (start: string, end: string, unpaidBreakMins: number = 30) => {
    if (!start || !end) return 0;
    if (start === end) return 0; // Equal start and end time (e.g. Day Off / 00:00 - 00:00)
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    
    let startMins = sh * 60 + sm;
    let endMins = eh * 60 + em;
    
    if (endMins < startMins) {
      endMins += 24 * 60; // Overnight shifts wrap
    }
    
    const totalMins = endMins - startMins - Number(unpaidBreakMins);
    return Math.max(0, totalMins / 60);
  };

  const getShiftEarnings = (shift: Shift) => {
    const hours = getShiftDurationHours(shift.startTime, shift.endTime, Number(shift.unpaidBreakMinutes ?? 30));
    return hours * Number(shift.hourlyRate ?? 0);
  };

  // Export Roster & Shifts as PDF
  const handleExportPDF = () => {
    try {
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Page outline & Neobrutalist design border
      doc.setLineWidth(1);
      doc.setDrawColor(15, 23, 42); // slate-900
      doc.rect(5, 5, 200, 287); // Page border
      
      // Header neobrutalist container
      doc.setFillColor(238, 242, 255); // indigo-50
      doc.rect(10, 10, 190, 25, 'F');
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.8);
      doc.rect(10, 10, 190, 25, 'D');
      
      // Header text
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(15);
      doc.text(`${nicknames[currentUser].toUpperCase()}'S PERSONAL WORK SHIFTS`, 15, 18);
      
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(71, 85, 105);
      const dateRangeStr = statsPeriod === 'week'
        ? `Week: ${weekDays[0].toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })} - ${weekDays[6].toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })}`
        : `Month: ${monthName}`;
      const filterStr = `Access Level: Private Report (${nicknames[currentUser]}'s Shifts Only)`;
      doc.text(`${dateRangeStr}  |  ${filterStr}`, 15, 24);
      doc.text(`Generated on: ${new Date().toLocaleDateString('en-IE')} ${new Date().toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })}`, 15, 30);
      
      // Statistics section container
      doc.setFillColor(255, 255, 255);
      doc.rect(10, 40, 190, 24, 'F');
      doc.rect(10, 40, 190, 24, 'D');
      
      // Col 1: Total Shifts
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('TOTAL SHIFTS', 15, 46);
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text(`${activeStats.totalShifts} shifts`, 15, 54);
      
      // Col 2: Total Hours
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('TOTAL HOURS', 60, 46);
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text(`${activeStats.totalHours.toFixed(1)} hrs`, 60, 54);
      
      // Col 3: Earned Income
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('CONFIRMED EARNED', 110, 46);
      doc.setFontSize(12);
      doc.setTextColor(16, 185, 129); // emerald-500
      doc.text(`€${activeStats.earnedIncome.toFixed(2)}`, 110, 54);
      
      // Col 4: Expected Future Income
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('EXPECTED FUTURE', 155, 46);
      doc.setFontSize(12);
      doc.setTextColor(245, 158, 11); // amber-500
      doc.text(`€${activeStats.expectedIncome.toFixed(2)}`, 155, 54);
      
      // Shift list table header
      doc.setFillColor(15, 23, 42); // slate-900 header
      doc.rect(10, 70, 190, 8, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(255, 255, 255);
      doc.text('DATE / DAY', 13, 75);
      doc.text('ROOMMATE', 45, 75);
      doc.text('SHIFT TITLE & EMPLOYER', 70, 75);
      doc.text('HOURS', 135, 75);
      doc.text('RATE', 158, 75);
      doc.text('EARNINGS', 178, 75);
      
      // Draw shifts list
      let y = 84;
      const targetShifts = statsPeriod === 'week' ? filteredWeekShifts : filteredMonthShifts;
      
      doc.setTextColor(15, 23, 42);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      
      if (targetShifts.length === 0) {
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(148, 163, 184);
        doc.text('No shifts registered for this period.', 15, y + 5);
      } else {
        targetShifts.forEach((shift, index) => {
          // Check for overflow - add page
          if (y > 270) {
            doc.addPage();
            // Redraw border
            doc.setLineWidth(1);
            doc.setDrawColor(15, 23, 42);
            doc.rect(5, 5, 200, 287);
            
            // Redraw table header
            doc.setFillColor(15, 23, 42);
            doc.rect(10, 15, 190, 8, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(255, 255, 255);
            doc.text('DATE / DAY', 13, 20);
            doc.text('ROOMMATE', 45, 20);
            doc.text('SHIFT TITLE & EMPLOYER', 70, 20);
            doc.text('HOURS', 135, 20);
            doc.text('RATE', 158, 20);
            doc.text('EARNINGS', 178, 20);
            
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(15, 23, 42);
            y = 29;
          }
          
          const sDate = parseLocalDate(shift.date);
          const dayName = sDate.toLocaleDateString('en-IE', { weekday: 'short' });
          const dateStr = sDate.toLocaleDateString('en-IE', { day: '2-digit', month: 'short' });
          const formattedDate = `${dayName} ${dateStr}`;
          
          const rName = nicknames[shift.user] || shift.user;
          const hours = getShiftDurationHours(shift.startTime, shift.endTime, Number(shift.unpaidBreakMinutes ?? 30));
          const earnings = getShiftEarnings(shift);
          
          // Zebra stripe rows
          if (index % 2 === 1) {
            doc.setFillColor(248, 250, 252); // slate-50
            doc.rect(10, y - 4, 190, 6.5, 'F');
          }
          
          doc.setFont('helvetica', 'bold');
          doc.text(formattedDate, 13, y);
          
          doc.setFont('helvetica', 'normal');
          doc.text(rName, 45, y);
          
          // Title + Employer name
          const employerSuffix = shift.employerName ? ` (${shift.employerName})` : '';
          const fullTitleStr = `${shift.title}${employerSuffix}`;
          const truncatedTitle = fullTitleStr.length > 33 
            ? fullTitleStr.substring(0, 30) + '...' 
            : fullTitleStr;
          doc.text(truncatedTitle, 70, y);
          
          // Hours and shift times
          doc.text(`${hours.toFixed(1)}h (${shift.startTime}-${shift.endTime})`, 135, y);
          
          // Rate
          doc.text(`€${Number(shift.hourlyRate ?? 0).toFixed(2)}`, 158, y);
          
          // Earnings + status color
          if (shift.completed) {
            doc.setTextColor(16, 185, 129); // emerald
            doc.setFont('helvetica', 'bold');
            doc.text(`€${earnings.toFixed(2)}`, 178, y);
          } else {
            doc.setTextColor(245, 158, 11); // amber
            doc.setFont('helvetica', 'bold');
            doc.text(`€${earnings.toFixed(2)}*`, 178, y);
          }
          
          // Reset style
          doc.setTextColor(15, 23, 42);
          doc.setFont('helvetica', 'normal');
          
          // Note if present
          if (shift.notes && shift.notes.trim()) {
            y += 4.5;
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(7);
            doc.setTextColor(100, 116, 139);
            doc.text(`Note: ${shift.notes}`, 70, y);
            // Reset
            doc.setFont('helvetica', 'normal');
            doc.setFontSize(8);
            doc.setTextColor(15, 23, 42);
          }
          
          y += 6.5;
        });
      }
      
      // Footer/Note helper
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('* Asterisk indicates expected future income from scheduled, uncompleted work shifts.', 10, y + 8);
      
      // Branding footer
      doc.text('Cohabitation Roster & Work Shift Log', 10, 285);
      doc.text('Roommate Finance Hub Applet', 160, 285);
      
      const fileName = statsPeriod === 'week' 
        ? `${nicknames[currentUser].toLowerCase()}_shifts_week_${weekDays[0].toISOString().split('T')[0]}.pdf`
        : `${nicknames[currentUser].toLowerCase()}_shifts_month_${visibleMonthYear.year}_${visibleMonthYear.month + 1}.pdf`;
      
      doc.save(fileName);
      setSuccessMsg(`PDF compiled successfully! File downloaded: ${fileName}`);
      showNotification('PDF Export Complete', { body: `Downloaded ${fileName} containing your ${targetShifts.length} shifts.` });
    } catch (err: any) {
      console.error('PDF generation failed:', err);
      setErrorMsg('Could not export PDF: ' + err.message);
    }
  };

  // Export Roster & Shifts as PNG
  const handleExportPNG = () => {
    try {
      const targetShifts = statsPeriod === 'week' ? filteredWeekShifts : filteredMonthShifts;
      
      if (targetShifts.length === 0) {
        setErrorMsg('No shifts available to export as PNG for this period!');
        return;
      }
      
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Could not get 2D canvas context');
      }
      
      // Calculate layout sizes
      const width = 1000;
      const headerHeight = 130;
      const statsHeight = 110;
      const shiftRowHeight = 78;
      const footerHeight = 60;
      const totalHeight = headerHeight + statsHeight + (targetShifts.length * shiftRowHeight) + footerHeight;
      
      // Scale up for high-DPI retina display support (crisp text)
      const scale = 2;
      canvas.width = width * scale;
      canvas.height = totalHeight * scale;
      ctx.scale(scale, scale);
      
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      
      // Background slate-50
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, 0, width, totalHeight);
      
      // Neobrutalist main border
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#0f172a';
      ctx.strokeRect(10, 10, width - 20, totalHeight - 20);
      
      // --- HEADER SECTION ---
      // Colored header box
      ctx.fillStyle = '#6366f1'; // indigo-500
      ctx.fillRect(25, 25, width - 50, 85);
      ctx.lineWidth = 3;
      ctx.strokeStyle = '#0f172a';
      ctx.strokeRect(25, 25, width - 50, 85);
      
      // Text
      ctx.fillStyle = '#ffffff';
      ctx.font = '900 22px system-ui, -apple-system, sans-serif';
      ctx.fillText(`${nicknames[currentUser].toUpperCase()}'S PERSONAL WORK SHIFTS`, 45, 60);
      
      ctx.fillStyle = '#e0e7ff'; // indigo-100
      ctx.font = 'bold 12px monospace';
      const rangeStr = statsPeriod === 'week'
        ? `WEEK: ${weekDays[0].toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })} - ${weekDays[6].toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })}`
        : `MONTH: ${monthName}`;
      ctx.fillText(rangeStr.toUpperCase(), 45, 80);
      
      // Filter metadata info
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
      const filterLabel = `PRIVATE REPORT: ${nicknames[currentUser].toUpperCase()}'S SHIFTS ONLY`;
      ctx.fillText(`ACCESS LEVEL: ${filterLabel}  |  GENERATED ON: ${new Date().toLocaleDateString('en-IE')} ${new Date().toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' })}`, 45, 96);
      
      // --- STATISTICS CARDS SECTION ---
      const statCardWidth = (width - 50 - 30) / 4; // 4 boxes with 10px spacing
      const statsY = 125;
      
      const statsConfigs = [
        { title: 'TOTAL WORK SHIFTS', value: `${activeStats.totalShifts} shifts`, sub: `Active roster filter`, bg: '#ffffff', text: '#0f172a' },
        { title: 'TOTAL WORK HOURS', value: `${activeStats.totalHours.toFixed(1)}h`, sub: `Break hours excluded`, bg: '#ffffff', text: '#0f172a' },
        { title: 'CONFIRMED INCOME', value: `€${activeStats.earnedIncome.toFixed(2)}`, sub: `${activeStats.completedShifts} completed shifts`, bg: '#ecfdf5', text: '#047857' },
        { title: 'EXPECTED INCOME', value: `€${activeStats.expectedIncome.toFixed(2)}`, sub: `${activeStats.pendingShifts} scheduled shifts`, bg: '#fffbeb', text: '#b45309' }
      ];
      
      statsConfigs.forEach((stat, i) => {
        const x = 25 + i * (statCardWidth + 10);
        
        // Shadow offset box
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(x + 3, statsY + 3, statCardWidth, 80);
        
        // Background card
        ctx.fillStyle = stat.bg;
        ctx.fillRect(x, statsY, statCardWidth, 80);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#0f172a';
        ctx.strokeRect(x, statsY, statCardWidth, 80);
        
        // Label/Title
        ctx.fillStyle = '#64748b'; // slate-500
        ctx.font = '800 8.5px system-ui, -apple-system, sans-serif';
        ctx.fillText(stat.title, x + 12, statsY + 22);
        
        // Value Text
        ctx.fillStyle = stat.text;
        ctx.font = '900 16px monospace';
        ctx.fillText(stat.value, x + 12, statsY + 46);
        
        // Subtext details
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 8.5px system-ui, -apple-system, sans-serif';
        ctx.fillText(stat.sub, x + 12, statsY + 66);
      });
      
      // --- SHIFT TABLE COLUMN HEADERS ---
      const listStartY = 225;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(25, listStartY, width - 50, 30);
      ctx.lineWidth = 2.5;
      ctx.strokeStyle = '#0f172a';
      ctx.strokeRect(25, listStartY, width - 50, 30);
      
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
      ctx.fillText('DATE / DAY', 40, listStartY + 19);
      ctx.fillText('ROOMMATE', 160, listStartY + 19);
      ctx.fillText('SHIFT TITLE & EMPLOYER', 290, listStartY + 19);
      ctx.fillText('HOURS & TIMINGS', 590, listStartY + 19);
      ctx.fillText('HOURLY RATE', 760, listStartY + 19);
      ctx.fillText('EARNINGS', 885, listStartY + 19);
      
      // --- DRAW WORK SHIFTS ---
      targetShifts.forEach((shift, index) => {
        const rowY = listStartY + 30 + 10 + (index * shiftRowHeight);
        
        // Neobrutalist row shadow
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(25 + 3, rowY + 3, width - 50, shiftRowHeight - 10);
        
        // Row background card
        ctx.fillStyle = index % 2 === 1 ? '#f8fafc' : '#ffffff';
        ctx.fillRect(25, rowY, width - 50, shiftRowHeight - 10);
        ctx.lineWidth = 2.5;
        ctx.strokeStyle = '#0f172a';
        ctx.strokeRect(25, rowY, width - 50, shiftRowHeight - 10);
        
        // Date parse & format
        const sDate = parseLocalDate(shift.date);
        const dayStr = sDate.toLocaleDateString('en-IE', { weekday: 'short' }).toUpperCase();
        const dateStr = sDate.toLocaleDateString('en-IE', { day: '2-digit', month: 'short' }).toUpperCase();
        
        // Draw Date Text
        ctx.fillStyle = '#0f172a';
        ctx.font = '900 12px system-ui, -apple-system, sans-serif';
        ctx.fillText(`${dayStr} ${dateStr}`, 40, rowY + 32);
        
        // Roommate tag pill
        const rName = nicknames[shift.user] || shift.user;
        const pillColor = shift.user === 'Ozric' ? '#6366f1' : '#f43f5e'; // indigo vs rose
        
        ctx.fillStyle = pillColor;
        const pillX = 160;
        const pillY = rowY + 16;
        const pillW = 85;
        const pillH = 22;
        
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(pillX, pillY, pillW, pillH, 5);
        } else {
          ctx.rect(pillX, pillY, pillW, pillH);
        }
        ctx.fill();
        ctx.lineWidth = 1.5;
        ctx.strokeStyle = '#0f172a';
        ctx.stroke();
        
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(rName.toUpperCase(), pillX + (pillW / 2), pillY + 14);
        ctx.textAlign = 'left'; // Reset alignment
        
        // Shift title & employer details
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
        ctx.fillText(shift.title, 290, rowY + 26);
        
        if (shift.employerName) {
          ctx.fillStyle = '#64748b'; // slate-500
          ctx.font = 'bold 10px monospace';
          ctx.fillText(`🏢 ${shift.employerName.toUpperCase()}`, 290, rowY + 42);
        }
        
        // Duration hours & timings
        const hours = getShiftDurationHours(shift.startTime, shift.endTime, Number(shift.unpaidBreakMinutes ?? 30));
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 11px system-ui, -apple-system, sans-serif';
        ctx.fillText(`${hours.toFixed(1)} hrs`, 590, rowY + 26);
        
        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 9.5px monospace';
        ctx.fillText(`${shift.startTime} - ${shift.endTime} (${shift.unpaidBreakMinutes}m break)`, 590, rowY + 42);
        
        // Hourly wage rate
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 11px monospace';
        ctx.fillText(`€${Number(shift.hourlyRate ?? 0).toFixed(2)}/h`, 760, rowY + 30);
        
        // Earnings value
        const earnings = getShiftEarnings(shift);
        ctx.fillStyle = shift.completed ? '#10b981' : '#f59e0b'; // emerald vs amber
        ctx.font = '900 13px monospace';
        ctx.fillText(`€${earnings.toFixed(2)}`, 885, rowY + 24);
        
        // Status Badge
        const statusText = shift.completed ? 'COMPLETED' : 'SCHEDULED';
        const statusBg = shift.completed ? '#ecfdf5' : '#fffbeb';
        const statusColor = shift.completed ? '#10b981' : '#f59e0b';
        
        const badgeX = 885;
        const badgeY = rowY + 32;
        const badgeW = 75;
        const badgeH = 16;
        
        ctx.fillStyle = statusBg;
        ctx.beginPath();
        if (ctx.roundRect) {
          ctx.roundRect(badgeX, badgeY, badgeW, badgeH, 3);
        } else {
          ctx.rect(badgeX, badgeY, badgeW, badgeH);
        }
        ctx.fill();
        ctx.lineWidth = 1;
        ctx.strokeStyle = statusColor;
        ctx.stroke();
        
        ctx.fillStyle = statusColor;
        ctx.font = '900 8px system-ui, -apple-system, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(statusText, badgeX + (badgeW / 2), badgeY + 11);
        ctx.textAlign = 'left'; // Reset
        
        // Shift note if available
        if (shift.notes && shift.notes.trim()) {
          ctx.fillStyle = '#94a3b8'; // slate-400
          ctx.font = 'italic 8px system-ui, -apple-system, sans-serif';
          ctx.fillText(`Note: ${shift.notes}`, 290, rowY + 54);
        }
      });
      
      // --- FOOTER AND COPYRIGHT ---
      const footerY = totalHeight - 30;
      ctx.fillStyle = '#94a3b8'; // slate-400
      ctx.font = 'bold 10px system-ui, -apple-system, sans-serif';
      ctx.fillText('COHABITATION ROSTER & WAGE TRACKER', 25, footerY);
      
      ctx.textAlign = 'right';
      ctx.fillText('GENERATED SECURELY FROM COHABIT HUB', width - 25, footerY);
      ctx.textAlign = 'left'; // Reset
      
      // Trigger instant PNG image download
      const fileName = statsPeriod === 'week'
        ? `${nicknames[currentUser].toLowerCase()}_shifts_week_${weekDays[0].toISOString().split('T')[0]}.png`
        : `${nicknames[currentUser].toLowerCase()}_shifts_month_${visibleMonthYear.year}_${visibleMonthYear.month + 1}.png`;
        
      const link = document.createElement('a');
      link.download = fileName;
      link.href = canvas.toDataURL('image/png');
      link.click();
      
      setSuccessMsg(`PNG successfully compiled! File downloaded: ${fileName}`);
      showNotification('PNG Export Complete', { body: `Downloaded your infographic PNG file successfully: ${fileName}` });
    } catch (err: any) {
      console.error('PNG export failed:', err);
      setErrorMsg('Could not export PNG: ' + err.message);
    }
  };

  // Filter shifts for the CURRENT VISIBLE week using robust string comparison
  const visibleWeekShifts = React.useMemo(() => {
    const weekKeys = weekDays.map(d => formatDateKey(d));
    return shifts.filter(s => weekKeys.includes(s.date));
  }, [shifts, weekDays]);

  // Filtered week shifts
  const filteredWeekShifts = visibleWeekShifts;

  // Get current visible month and year based on currentWeekStart
  const visibleMonthYear = React.useMemo(() => {
    const year = currentWeekStart.getFullYear();
    const month = currentWeekStart.getMonth(); // 0-based index
    return { year, month };
  }, [currentWeekStart]);

  // Helper to check if a YYYY-MM-DD shift date falls within the target month and year
  const isShiftInMonth = (shiftDateStr: string, targetYear: number, targetMonth: number) => {
    if (!shiftDateStr) return false;
    const parts = shiftDateStr.split('-');
    if (parts.length !== 3) return false;
    const y = parseInt(parts[0], 10);
    const m = parseInt(parts[1], 10) - 1; // 0-based
    return y === targetYear && m === targetMonth;
  };

  // Filter shifts for the CURRENT VISIBLE month using robust string comparison
  const visibleMonthShifts = React.useMemo(() => {
    const { year, month } = visibleMonthYear;
    return shifts.filter(s => isShiftInMonth(s.date, year, month));
  }, [shifts, visibleMonthYear]);

  // Filtered month shifts
  const filteredMonthShifts = visibleMonthShifts;

  // Month Name for display
  const monthName = React.useMemo(() => {
    return currentWeekStart.toLocaleString('en-IE', { month: 'long', year: 'numeric' });
  }, [currentWeekStart]);

  // Calculate high quality weekly metrics
  const weekStats = React.useMemo(() => {
    return filteredWeekShifts.reduce((acc, shift) => {
      const hours = getShiftDurationHours(shift.startTime, shift.endTime, Number(shift.unpaidBreakMinutes ?? 30));
      const earnings = getShiftEarnings(shift);
      
      acc.totalHours += hours;
      acc.totalShifts += 1;
      acc.totalBreakMins += Number(shift.unpaidBreakMinutes ?? 30);
      if (shift.completed) {
        acc.earnedIncome += earnings;
        acc.completedShifts += 1;
      } else {
        acc.expectedIncome += earnings;
        acc.pendingShifts += 1;
      }
      return acc;
    }, { totalHours: 0, totalShifts: 0, totalBreakMins: 0, earnedIncome: 0, expectedIncome: 0, completedShifts: 0, pendingShifts: 0 });
  }, [filteredWeekShifts]);

  // Calculate high quality monthly metrics
  const monthStats = React.useMemo(() => {
    return filteredMonthShifts.reduce((acc, shift) => {
      const hours = getShiftDurationHours(shift.startTime, shift.endTime, Number(shift.unpaidBreakMinutes ?? 30));
      const earnings = getShiftEarnings(shift);
      
      acc.totalHours += hours;
      acc.totalShifts += 1;
      acc.totalBreakMins += Number(shift.unpaidBreakMinutes ?? 30);
      if (shift.completed) {
        acc.earnedIncome += earnings;
        acc.completedShifts += 1;
      } else {
        acc.expectedIncome += earnings;
        acc.pendingShifts += 1;
      }
      return acc;
    }, { totalHours: 0, totalShifts: 0, totalBreakMins: 0, earnedIncome: 0, expectedIncome: 0, completedShifts: 0, pendingShifts: 0 });
  }, [filteredMonthShifts]);

  // Select the active statistics based on period toggle
  const activeStats = statsPeriod === 'week' ? weekStats : monthStats;

  return (
    <div className="space-y-6">
      {/* TOP VIEW MODE SELECTOR SWITCHER */}
      <div className="bg-white p-1.5 rounded-2xl border-3 border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] flex items-center gap-2">
        <button
          onClick={() => setMainMode('calendar')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer border-2 ${
            mainMode === 'calendar'
              ? 'bg-emerald-400 text-slate-950 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] font-display'
              : 'bg-transparent text-slate-700 border-transparent hover:bg-slate-100'
          }`}
        >
          <CalendarDays className="w-4 h-4 stroke-[2.5]" />
          <span>Calendar Book</span>
        </button>

        <button
          onClick={() => setMainMode('roster')}
          className={`flex-1 py-2.5 px-3 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer border-2 ${
            mainMode === 'roster'
              ? 'bg-slate-900 text-white border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] font-display'
              : 'bg-transparent text-slate-700 border-transparent hover:bg-slate-100'
          }`}
        >
          <Briefcase className="w-4 h-4 stroke-[2.5]" />
          <span>Shifts & Earnings</span>
        </button>
      </div>

      {mainMode === 'calendar' ? (
        <CalendarBook 
          currentUser={currentUser}
          nicknames={nicknames}
          profiles={profiles}
          shifts={shifts}
          expenses={expenses}
          recurringBills={recurringBills}
          onOpenAddShift={(defaultDate) => {
            setMainMode('roster');
            setShowAddForm(true);
            if (defaultDate) setDate(defaultDate);
          }}
          onOpenAddExpense={onOpenAddExpense}
        />
      ) : (
        <>
      {/* CLEAN HEADER BAR */}
      <div className="bg-white border-4 border-slate-900 p-5 rounded-2xl shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-indigo-600 rounded-xl border-2 border-slate-900 flex items-center justify-center shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)] text-white shrink-0">
              <Calendar className="w-5 h-5 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-black text-slate-900 tracking-tight font-display">Work Shifts</h2>
                <UserBadge user={currentUser} nickname={nicknames[currentUser]} />
              </div>
              <p className="text-xs text-slate-500 font-medium">Manage schedules, track hours & total earnings</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              id="btn-add-shift-toggle"
              onClick={() => {
                setShowAddForm(!showAddForm);
                setEditingShiftId(null);
                setErrorMsg('');
                setSuccessMsg('');
                setTitle('');
                setStartTime('07:00');
                setEndTime('15:30');
                setUnpaidBreakMinutes(30);
                setHourlyRate('15.00');
                setEmployerName('');
                setCompleted(false);
              }}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase border-2 border-slate-900 rounded-xl shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)] transition active:translate-x-[0.5px] active:translate-y-[0.5px] cursor-pointer"
            >
              {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
              <span>{showAddForm ? 'Close Editor' : 'Add Shift'}</span>
            </button>

            <button
              id="btn-open-calendar-modal"
              onClick={() => setShowCalendarModal(true)}
              className="flex items-center gap-1.5 px-3.5 py-2 bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs uppercase border-2 border-slate-900 rounded-xl shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)] transition active:translate-x-[0.5px] active:translate-y-[0.5px] cursor-pointer"
            >
              <Calendar className="w-4 h-4 stroke-[2.5]" />
              <span>Calendar</span>
            </button>

            <button
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-900 text-xs font-black uppercase font-mono border-2 border-slate-900 rounded-xl shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)] transition active:translate-x-[0.5px] cursor-pointer"
              title="Export shift report as PDF"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-600 stroke-[2.5]" />
              <span>PDF</span>
            </button>

            <button
              onClick={handleExportPNG}
              className="flex items-center gap-1.5 px-3 py-2 bg-white hover:bg-slate-100 text-slate-900 text-xs font-black uppercase font-mono border-2 border-slate-900 rounded-xl shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)] transition active:translate-x-[0.5px] cursor-pointer"
              title="Export shift report as PNG image"
            >
              <Image className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
              <span>PNG</span>
            </button>
          </div>
        </div>
      </div>

      {/* FILTER & STATS SUMMARY */}
      <div className="space-y-4">
        {/* Filter Controls Bar */}
        <div className="bg-slate-50 border-4 border-slate-900 p-3 rounded-2xl shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {/* Hide / Show Completed Toggle */}
            <button
              onClick={() => setHideCompleted(!hideCompleted)}
              className={`px-3 py-1 text-xs font-mono font-black uppercase rounded-xl border-2 border-slate-900 transition flex items-center gap-1.5 cursor-pointer shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] ${
                hideCompleted
                  ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-950 border-indigo-900'
                  : 'bg-emerald-300 hover:bg-emerald-400 text-slate-950'
              }`}
              title={hideCompleted ? "Show all days including completed ones" : "Hide completed/empty days for a clean view"}
            >
              {hideCompleted ? (
                <>
                  <EyeOff className="w-3.5 h-3.5 text-indigo-600 stroke-[2.5]" />
                  <span>Clean View (Done Days Hidden)</span>
                </>
              ) : (
                <>
                  <Eye className="w-3.5 h-3.5 text-slate-900 stroke-[2.5]" />
                  <span>Showing All Days</span>
                </>
              )}
            </button>

            {/* Shift Details Expand Toggle */}
            <button
              onClick={() => setShowAllDetails(!showAllDetails)}
              className={`px-3 py-1 text-xs font-mono font-black uppercase rounded-xl border-2 border-slate-900 transition flex items-center gap-1.5 cursor-pointer shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] ${
                showAllDetails
                  ? 'bg-amber-300 hover:bg-amber-400 text-slate-950'
                  : 'bg-white hover:bg-slate-100 text-slate-700'
              }`}
              title={showAllDetails ? "Collapse shift details for simple look" : "Expand all shift details (pay, notes, actions)"}
            >
              {showAllDetails ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5 text-slate-900 stroke-[2.5]" />
                  <span>Details Expanded</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5 text-slate-600 stroke-[2.5]" />
                  <span>Simple Look</span>
                </>
              )}
            </button>
          </div>

          {/* Period Toggle */}
            <div className="flex bg-slate-200/90 border-2 border-slate-900 p-1 rounded-xl">
              <button
                onClick={() => setStatsPeriod('week')}
                className={`px-3 py-1 text-xs font-mono font-black uppercase rounded-lg transition cursor-pointer ${
                  statsPeriod === 'week'
                    ? 'bg-indigo-600 text-white border-2 border-slate-900 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]'
                    : 'text-slate-650 hover:text-slate-950'
                }`}
              >
                Weekly
              </button>
              <button
                onClick={() => setStatsPeriod('month')}
                className={`px-3 py-1 text-xs font-mono font-black uppercase rounded-lg transition cursor-pointer ${
                  statsPeriod === 'month'
                    ? 'bg-indigo-600 text-white border-2 border-slate-900 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]'
                    : 'text-slate-650 hover:text-slate-950'
                }`}
              >
                Monthly ({currentWeekStart.toLocaleString('en-IE', { month: 'short' })})
              </button>
            </div>
          </div>

        {/* 3 Clean Stat Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="bg-white border-3 border-slate-900 p-3.5 rounded-2xl shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase font-mono tracking-wider">Total Work Hours</p>
              <p className="text-xl font-black text-slate-950 font-mono mt-0.5">{activeStats.totalHours.toFixed(1)} hrs</p>
              <p className="text-[10px] text-slate-500 font-bold">{activeStats.totalShifts} shift{activeStats.totalShifts === 1 ? '' : 's'}</p>
            </div>
            <div className="p-2.5 bg-indigo-50 border-2 border-slate-900 rounded-xl text-indigo-600">
              <Clock className="w-5 h-5 stroke-[2.5]" />
            </div>
          </div>

          <div className="bg-emerald-50 border-3 border-slate-900 p-3.5 rounded-2xl shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-emerald-700 uppercase font-mono tracking-wider">Earned Income</p>
              <p className="text-xl font-black text-emerald-950 font-mono mt-0.5">€{activeStats.earnedIncome.toFixed(2)}</p>
              <p className="text-[10px] text-emerald-700 font-bold">{activeStats.completedShifts} completed</p>
            </div>
            <div className="p-2.5 bg-emerald-200 border-2 border-slate-900 rounded-xl text-emerald-900">
              <CheckCircle2 className="w-5 h-5 stroke-[2.5]" />
            </div>
          </div>

          <div className="bg-amber-50 border-3 border-slate-900 p-3.5 rounded-2xl shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] flex items-center justify-between">
            <div>
              <p className="text-[10px] font-black text-amber-700 uppercase font-mono tracking-wider">Scheduled Income</p>
              <p className="text-xl font-black text-amber-950 font-mono mt-0.5">€{activeStats.expectedIncome.toFixed(2)}</p>
              <p className="text-[10px] text-amber-700 font-bold">{activeStats.pendingShifts} upcoming</p>
            </div>
            <div className="p-2.5 bg-amber-200 border-2 border-slate-900 rounded-xl text-amber-900">
              <TrendingUp className="w-5 h-5 stroke-[2.5]" />
            </div>
          </div>
        </div>
      </div>

      {/* ALERTS */}
      {errorMsg && (
        <div className="bg-rose-100 border-2 border-slate-900 rounded-xl p-3 flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] animate-fade-in text-xs font-bold text-rose-900">
          <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
          <span>{errorMsg}</span>
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-100 border-2 border-slate-900 rounded-xl p-3 flex items-center gap-2 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] animate-fade-in text-xs font-bold text-emerald-900">
          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
          <span>{successMsg}</span>
        </div>
      )}

      {/* SHIFT CREATOR / EDITOR FORM */}
      {showAddForm && (
        <div className="bg-amber-50/90 border-4 border-slate-900 p-4 sm:p-5 rounded-2xl shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] space-y-4 animate-fade-in">
          <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3">
            <div className="flex items-center gap-2">
              <div className="p-1.5 bg-indigo-600 text-white border-2 border-slate-900 rounded-lg shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]">
                <Briefcase className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div>
                <h3 className="font-black text-sm uppercase font-mono text-slate-950">
                  {editingShiftId ? 'Edit Work Shift' : 'New Work Shift'}
                </h3>
                <p className="text-[10px] text-slate-600 font-bold font-mono">
                  {editingShiftId ? 'Modify shift parameters' : 'Schedule a new shift for your roster'}
                </p>
              </div>
            </div>
            <button 
              onClick={() => {
                setShowAddForm(false);
                setEditingShiftId(null);
              }} 
              className="p-1.5 bg-white hover:bg-rose-100 border-2 border-slate-900 rounded-xl text-slate-800 transition cursor-pointer shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]"
              title="Close Form"
            >
              <X className="w-4 h-4 stroke-[2.5]" />
            </button>
          </div>

          <form onSubmit={handleAddShift} className="space-y-4">
            {/* Quick Shift Templates */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-600 uppercase tracking-wider font-mono block">
                Quick Shift Templates
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2">
                <button
                  type="button"
                  onClick={() => applyTemplate('morning')}
                  className="p-2.5 text-xs font-mono font-black bg-white border-2 border-slate-900 rounded-xl text-slate-900 flex items-center justify-center gap-1.5 hover:bg-amber-100 transition cursor-pointer shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] active:translate-x-[0.5px]"
                >
                  <Sunrise className="w-4 h-4 text-amber-500 shrink-0 stroke-[2.5]" />
                  <span>Morning</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate('midday')}
                  className="p-2.5 text-xs font-mono font-black bg-white border-2 border-slate-900 rounded-xl text-slate-900 flex items-center justify-center gap-1.5 hover:bg-sky-100 transition cursor-pointer shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] active:translate-x-[0.5px]"
                >
                  <Sun className="w-4 h-4 text-sky-500 shrink-0 stroke-[2.5]" />
                  <span>Midday</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate('evening')}
                  className="p-2.5 text-xs font-mono font-black bg-white border-2 border-slate-900 rounded-xl text-slate-900 flex items-center justify-center gap-1.5 hover:bg-orange-100 transition cursor-pointer shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] active:translate-x-[0.5px]"
                >
                  <Sunset className="w-4 h-4 text-orange-500 shrink-0 stroke-[2.5]" />
                  <span>Evening</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate('night')}
                  className="p-2.5 text-xs font-mono font-black bg-white border-2 border-slate-900 rounded-xl text-slate-900 flex items-center justify-center gap-1.5 hover:bg-indigo-100 transition cursor-pointer shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] active:translate-x-[0.5px]"
                >
                  <Moon className="w-4 h-4 text-indigo-500 shrink-0 stroke-[2.5]" />
                  <span>Night</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate('off')}
                  className="p-2.5 text-xs font-mono font-black bg-white border-2 border-slate-900 rounded-xl text-slate-900 flex items-center justify-center gap-1.5 hover:bg-emerald-100 transition cursor-pointer shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] active:translate-x-[0.5px]"
                >
                  <Coffee className="w-4 h-4 text-emerald-600 shrink-0 stroke-[2.5]" />
                  <span>Day Off</span>
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate('custom')}
                  className="p-2.5 text-xs font-mono font-black bg-white border-2 border-slate-900 rounded-xl text-slate-700 flex items-center justify-center gap-1.5 hover:bg-slate-100 transition cursor-pointer shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] col-span-2 sm:col-span-1 active:translate-x-[0.5px]"
                >
                  <RotateCcw className="w-3.5 h-3.5 text-slate-500 shrink-0 stroke-[2.5]" />
                  <span>Reset</span>
                </button>
              </div>
            </div>

            {/* Inputs Section 1: Title, Employer, Date */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label htmlFor="shift-title" className="text-xs font-black text-slate-950 font-mono flex items-center justify-between">
                  <span>Shift Title <span className="text-rose-500">*</span></span>
                </label>
                <input
                  id="shift-title"
                  type="text"
                  placeholder="e.g. Morning Duty, Overtime"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-3 bg-white border-2 border-slate-900 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 h-11"
                  maxLength={50}
                  required
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="shift-employer" className="text-xs font-black text-slate-950 font-mono flex items-center gap-1">
                  <Building2 className="w-3.5 h-3.5 text-slate-600" />
                  <span>Employer / Company</span>
                </label>
                <input
                  id="shift-employer"
                  type="text"
                  placeholder="e.g. Hospital, Retail, Tech"
                  value={employerName}
                  onChange={(e) => handleEmployerNameChange(e.target.value)}
                  className="w-full p-3 bg-white border-2 border-slate-900 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 h-11"
                  maxLength={50}
                  list="employer-presets-list"
                />
                <datalist id="employer-presets-list">
                  {Object.keys(allPresets).map(name => (
                    <option key={name} value={name} />
                  ))}
                </datalist>
              </div>

              <div className="space-y-1 sm:col-span-2 md:col-span-1">
                <label htmlFor="shift-date" className="text-xs font-black text-slate-950 font-mono flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5 text-slate-600" />
                  <span>Shift Date <span className="text-rose-500">*</span></span>
                </label>
                <input
                  id="shift-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full p-3 bg-white border-2 border-slate-900 rounded-xl text-xs font-bold text-slate-900 focus:outline-none font-mono h-11"
                  required
                />
              </div>
            </div>

            {/* Inputs Section 2: Start, End, Hourly Rate, Break */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="space-y-1">
                <label htmlFor="shift-start" className="text-xs font-black text-slate-950 font-mono flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-indigo-600 stroke-[2.5]" />
                  <span>Start <span className="text-rose-500">*</span></span>
                </label>
                <input
                  id="shift-start"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full p-3 bg-white border-2 border-slate-900 rounded-xl text-xs font-bold text-slate-900 focus:outline-none font-mono h-11"
                  required
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="shift-end" className="text-xs font-black text-slate-950 font-mono flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-rose-600 stroke-[2.5]" />
                  <span>End <span className="text-rose-500">*</span></span>
                </label>
                <input
                  id="shift-end"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full p-3 bg-white border-2 border-slate-900 rounded-xl text-xs font-bold text-slate-900 focus:outline-none font-mono h-11"
                  required
                />
              </div>

              <div className="space-y-1">
                <label htmlFor="shift-hourly-rate" className="text-xs font-black text-slate-950 font-mono">
                  Hourly Rate (€)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-3 text-xs text-slate-400 font-black font-mono">€</span>
                  <input
                    id="shift-hourly-rate"
                    type="number"
                    step="0.01"
                    inputMode="decimal"
                    placeholder="15.00"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    className="w-full p-3 pl-7 bg-white border-2 border-slate-900 rounded-xl text-xs font-bold text-slate-900 focus:outline-none font-mono h-11"
                    min="0"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label htmlFor="shift-unpaid-break" className="text-xs font-black text-slate-950 font-mono">
                  Break (mins)
                </label>
                <input
                  id="shift-unpaid-break"
                  type="number"
                  inputMode="numeric"
                  placeholder="30"
                  value={unpaidBreakMinutes}
                  onChange={(e) => setUnpaidBreakMinutes(Number(e.target.value))}
                  className="w-full p-3 bg-white border-2 border-slate-900 rounded-xl text-xs font-bold text-slate-900 focus:outline-none font-mono h-11"
                  min="0"
                />
              </div>
            </div>

            {/* Calculated Earnings Banner */}
            {(() => {
              const hours = getShiftDurationHours(startTime, endTime, unpaidBreakMinutes);
              const rateVal = parseFloat(hourlyRate) || 0;
              const earnings = hours * rateVal;
              return (
                <div className="bg-white border-2 border-slate-900 p-3 rounded-xl flex items-center justify-between gap-2 text-xs font-mono shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]">
                  <div className="flex items-center gap-1.5 text-slate-700">
                    <Clock className="w-4 h-4 text-indigo-600 stroke-[2.5]" />
                    <span>Paid Hours: <strong className="text-slate-950 font-black">{hours.toFixed(2)}h</strong></span>
                  </div>
                  {rateVal > 0 && (
                    <div className="flex items-center gap-1 font-black text-emerald-800">
                      <span>Total:</span>
                      <strong className="text-xs bg-emerald-100 border border-emerald-400 px-2 py-0.5 rounded text-emerald-950">€{earnings.toFixed(2)}</strong>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Toggles & Notes */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Reminder Toggle Card */}
              <button
                type="button"
                onClick={() => setReminderActive(!reminderActive)}
                className={`p-3 rounded-xl border-2 border-slate-900 flex items-center justify-between transition cursor-pointer shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] active:translate-x-[0.5px] ${
                  reminderActive ? 'bg-indigo-50 text-slate-950' : 'bg-white text-slate-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <Bell className={`w-4 h-4 stroke-[2.5] ${reminderActive ? 'text-indigo-600' : 'text-slate-400'}`} />
                  <span className="text-xs font-mono font-black">Shift Reminder</span>
                </div>
                <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded border ${
                  reminderActive ? 'bg-indigo-600 text-white border-indigo-900' : 'bg-slate-200 text-slate-600 border-slate-300'
                }`}>
                  {reminderActive ? 'ACTIVE' : 'OFF'}
                </span>
              </button>

              {/* Completed Toggle Card */}
              <button
                type="button"
                onClick={() => setCompleted(!completed)}
                className={`p-3 rounded-xl border-2 border-slate-900 flex items-center justify-between transition cursor-pointer shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] active:translate-x-[0.5px] ${
                  completed ? 'bg-emerald-100 text-slate-950' : 'bg-white text-slate-600'
                }`}
              >
                <div className="flex items-center gap-2">
                  <CheckCircle2 className={`w-4 h-4 stroke-[2.5] ${completed ? 'text-emerald-700' : 'text-slate-400'}`} />
                  <span className="text-xs font-mono font-black">Mark Completed</span>
                </div>
                <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded border ${
                  completed ? 'bg-emerald-700 text-white border-emerald-900' : 'bg-slate-200 text-slate-600 border-slate-300'
                }`}>
                  {completed ? 'DONE' : 'PENDING'}
                </span>
              </button>
            </div>

            {/* Notes */}
            <div className="space-y-1">
              <label htmlFor="shift-notes" className="text-xs font-black text-slate-950 font-mono flex items-center gap-1">
                <FileText className="w-3.5 h-3.5 text-slate-600" />
                <span>Shift Notes (Optional)</span>
              </label>
              <textarea
                id="shift-notes"
                placeholder="Optional shift notes, instructions or reminders..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-3 bg-white border-2 border-slate-900 rounded-xl text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500 h-16 resize-none"
                maxLength={200}
              />
            </div>

            {/* Form Actions */}
            <div className="flex flex-col-reverse sm:flex-row justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingShiftId(null);
                }}
                className="w-full sm:w-auto px-5 py-3 bg-white hover:bg-slate-100 border-2 border-slate-900 rounded-xl text-xs font-mono font-black uppercase transition shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[0.5px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full sm:w-auto px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white border-2 border-slate-900 rounded-xl text-xs font-mono font-black uppercase transition shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] disabled:opacity-55 cursor-pointer flex items-center justify-center gap-2"
              >
                {isSubmitting ? (
                  <span>Saving...</span>
                ) : (
                  <>
                    <Plus className="w-4 h-4 stroke-[2.5]" />
                    <span>{editingShiftId ? 'Update Shift' : 'Save Shift'}</span>
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* WEEK NAVIGATION BAR */}
      <div className="bg-white border-4 border-slate-900 p-3.5 rounded-2xl shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] flex items-center justify-between gap-2">
        <button
          onClick={() => navigateWeek('prev')}
          className="p-2 border-2 border-slate-900 rounded-xl bg-white hover:bg-indigo-50 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] transition active:translate-x-[0.5px] cursor-pointer"
          title="Previous Week"
        >
          <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs sm:text-sm font-black text-slate-900 font-mono text-center flex items-center justify-center gap-1.5">
            <Calendar className="w-4 h-4 text-indigo-600 shrink-0 stroke-[2.5]" />
            <span>{weekDays[0].toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })} – {weekDays[6].toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
          </span>
          <button
            onClick={() => navigateWeek('current')}
            className="hidden sm:inline-block px-2.5 py-1 border-2 border-slate-900 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-[10px] font-black uppercase font-mono shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] cursor-pointer"
          >
            Today
          </button>
        </div>

        <button
          onClick={() => navigateWeek('next')}
          className="p-2 border-2 border-slate-900 rounded-lg bg-white hover:bg-indigo-50 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] transition active:translate-x-[0.5px] cursor-pointer"
          title="Next Week"
        >
          <ChevronRight className="w-4 h-4 stroke-[2.5]" />
        </button>
      </div>

      {/* CLEAN DAY-BY-DAY SHIFT SCHEDULE LIST */}
      {loading ? (
        <div className="bg-white border-4 border-slate-900 p-12 rounded-2xl shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-black text-slate-600 uppercase font-mono">Syncing work schedules...</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(() => {
            const nowObj = new Date();
            nowObj.setHours(0, 0, 0, 0);

            // Filter days to show when hideCompleted is true
            const visibleDays = weekDays.filter((day) => {
              if (!hideCompleted) return true; // Show all days if user turned off clean view

              const d = new Date(day);
              d.setHours(0, 0, 0, 0);
              const isToday = d.getTime() === nowObj.getTime();

              // Always show Today tab so user instantly sees Today's status (shift or no shift)
              if (isToday) return true;

              const dateStr = formatDateKey(day);
              const dateShifts = getShiftsForDate(dateStr);
              const pendingShifts = dateShifts.filter(s => !s.completed);

              // Show day tab if it has pending/uncompleted shifts
              return pendingShifts.length > 0;
            });

            const hiddenDaysCount = weekDays.length - visibleDays.length;

            if (visibleDays.length === 0) {
              return (
                <div className="bg-emerald-50 border-3 border-emerald-600 p-6 rounded-2xl shadow-[3px_3px_0px_0px_rgba(16,185,129,1)] text-center space-y-2">
                  <p className="text-sm font-black font-mono text-emerald-950">
                    🎉 All shifts for this week are completed or none scheduled!
                  </p>
                  <p className="text-xs font-mono text-emerald-800">
                    Your schedule is clear. Tap below to inspect past or completed days.
                  </p>
                  <button
                    onClick={() => setHideCompleted(false)}
                    className="px-4 py-2 bg-white hover:bg-emerald-100 border-2 border-slate-900 rounded-xl text-xs font-black font-mono shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] cursor-pointer"
                  >
                    Show All {weekDays.length} Days & Past Shifts
                  </button>
                </div>
              );
            }

            return (
              <div className="space-y-3">
                {visibleDays.map((day) => {
                  const dateStr = formatDateKey(day);
                  const dateShifts = getShiftsForDate(dateStr);
                  const completedShifts = dateShifts.filter(s => s.completed);
                  const pendingShifts = dateShifts.filter(s => !s.completed);

                  const today = new Date();
                  const isToday = today.getDate() === day.getDate() && 
                                  today.getMonth() === day.getMonth() && 
                                  today.getFullYear() === day.getFullYear();

                  const dayNameStr = day.toLocaleDateString('en-IE', { weekday: 'long', day: 'numeric', month: 'short' });

                  // For Today when hideCompleted is active:
                  // If Today has pending shifts, show pending shifts.
                  // If Today has ONLY completed shifts, displayedShifts will be empty, but we show a special "Today's shift completed ✓" card!
                  // If Today has 0 shifts, displayedShifts will be empty, and we show "No shifts scheduled for Today".
                  const displayedShifts = hideCompleted ? pendingShifts : dateShifts;

                  return (
                    <div 
                      key={dateStr}
                      className={`border-3 rounded-2xl p-3.5 transition-all ${
                        isToday 
                          ? 'bg-indigo-50/70 border-indigo-600 shadow-[3px_3px_0px_0px_rgba(79,70,229,1)]' 
                          : 'bg-white border-slate-900 shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)]'
                      }`}
                    >
                      {/* Day Header */}
                      <div className="flex items-center justify-between border-b-2 border-slate-200 pb-2 mb-2.5">
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-black font-mono text-slate-900 uppercase">
                            {dayNameStr}
                          </span>
                          {isToday && (
                            <span className="text-[9px] font-black uppercase font-mono bg-indigo-600 text-white px-2 py-0.5 rounded-full animate-pulse">
                              Today
                            </span>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono font-bold text-slate-500">
                            {displayedShifts.length === 0 && isToday && completedShifts.length > 0 
                              ? '✓ Shift Completed'
                              : `${displayedShifts.length} ${displayedShifts.length === 1 ? 'shift' : 'shifts'}`
                            }
                          </span>
                        </div>
                      </div>

                      {/* Day Shifts */}
                      {displayedShifts.length === 0 ? (
                        isToday ? (
                          completedShifts.length > 0 ? (
                            <div className="py-2 px-3 bg-emerald-50 border-2 border-emerald-300 rounded-xl flex flex-col sm:flex-row items-center justify-between gap-2">
                              <p className="text-xs text-emerald-900 font-mono font-bold flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
                                Today's shift is marked as completed!
                              </p>
                              <button
                                onClick={() => setHideCompleted(false)}
                                className="text-[11px] font-mono font-black text-indigo-700 hover:text-indigo-900 underline cursor-pointer"
                              >
                                View completed shift
                              </button>
                            </div>
                          ) : (
                            <div className="py-2 text-center">
                              <p className="text-xs text-slate-500 font-mono font-bold flex items-center justify-center gap-1.5">
                                <Calendar className="w-3.5 h-3.5 text-indigo-500 stroke-[2.5]" />
                                No shifts scheduled for Today.
                              </p>
                            </div>
                          )
                        ) : (
                          <p className="text-[11px] text-slate-400 font-mono py-1.5 italic text-center">
                            No shifts scheduled for this day.
                          </p>
                        )
                      ) : (
                        <div className="space-y-2">
                          {displayedShifts.map((shift) => {
                            const isMine = shift.user === currentUser;
                            const hours = getShiftDurationHours(shift.startTime, shift.endTime, shift.unpaidBreakMinutes ?? 30);
                            const earnings = getShiftEarnings(shift);
                            const isExpanded = expandedShiftIds[shift.id!] ?? showAllDetails;
                            const isOffShift = shift.title.toLowerCase().includes('off') || (shift.startTime === shift.endTime);

                            return (
                              <div 
                                key={shift.id}
                                className={`p-3 rounded-xl border-2 border-slate-900 transition-all ${
                                  shift.completed 
                                    ? 'bg-emerald-50/80 border-emerald-900' 
                                    : isOffShift
                                      ? 'bg-teal-50/60 border-teal-900'
                                      : isMine 
                                        ? 'bg-amber-50/60' 
                                        : 'bg-slate-50'
                                }`}
                              >
                                {/* Primary Clean Row */}
                                <div className="flex items-center justify-between gap-2 flex-wrap sm:flex-nowrap">
                                  <div className="flex items-center gap-2 flex-wrap min-w-0">
                                    <UserAvatarIcon user={shift.user} size="sm" />
                                    <h4 className="font-black text-sm text-slate-950 truncate">{shift.title}</h4>
                                    
                                    {isOffShift ? (
                                      <span className="text-xs font-mono font-bold text-teal-950 bg-teal-100/90 border border-teal-300 px-2 py-0.5 rounded-lg flex items-center gap-1 shrink-0">
                                        <Coffee className="w-3.5 h-3.5 text-teal-700 stroke-[2.5]" />
                                        <span>Day Off</span>
                                      </span>
                                    ) : (
                                      <span className="text-xs font-mono font-bold text-slate-800 bg-white/90 border border-slate-300 px-2 py-0.5 rounded-lg flex items-center gap-1 shrink-0">
                                        <Clock className="w-3.5 h-3.5 text-indigo-600 stroke-[2.5]" />
                                        <span>{shift.startTime} – {shift.endTime} ({hours.toFixed(1)}h)</span>
                                      </span>
                                    )}

                                    <span className={`text-[10px] font-mono font-black px-2 py-0.5 rounded-full border shrink-0 ${
                                      shift.completed
                                        ? 'bg-emerald-100 border-emerald-400 text-emerald-900'
                                        : 'bg-amber-100 border-amber-400 text-amber-900'
                                    }`}>
                                      {shift.completed ? '✓ Done' : 'Scheduled'}
                                    </span>
                                  </div>

                                  {/* Right side quick controls */}
                                  <div className="flex items-center gap-1.5 shrink-0 ml-auto">
                                    {isMine && (
                                      <button
                                        onClick={() => handleToggleCompleted(shift)}
                                        className={`px-2.5 py-1 border-2 border-slate-900 rounded-lg text-xs font-black font-mono shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] cursor-pointer ${
                                          shift.completed
                                            ? 'bg-emerald-300 hover:bg-emerald-400 text-slate-950'
                                            : 'bg-white hover:bg-slate-100 text-slate-700'
                                        }`}
                                        title={shift.completed ? "Mark shift incomplete" : "Mark shift completed"}
                                      >
                                        {shift.completed ? '✓ Done' : 'Complete'}
                                      </button>
                                    )}

                                    <button
                                      onClick={() => toggleShiftDetails(shift.id!)}
                                      className="px-2 py-1 bg-white hover:bg-slate-100 border border-slate-400 rounded-lg text-[11px] font-mono font-bold text-slate-700 flex items-center gap-1 cursor-pointer"
                                      title={isExpanded ? "Hide shift details" : "Show shift details"}
                                    >
                                      <span>{isExpanded ? 'Less' : 'Details'}</span>
                                      {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-slate-600" /> : <ChevronDown className="w-3.5 h-3.5 text-slate-600" />}
                                    </button>
                                  </div>
                                </div>

                                {/* Expanded Details Drawer */}
                                {isExpanded && (
                                  <div className="mt-2.5 pt-2.5 border-t border-slate-200/80 space-y-2 text-xs font-mono text-slate-700 animate-fade-in">
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 font-bold">
                                      {shift.employerName && (
                                        <span className="bg-white border border-slate-300 px-2 py-0.5 rounded text-slate-700 flex items-center gap-1">
                                          <Building2 className="w-3.5 h-3.5 text-slate-500 shrink-0 stroke-[2]" />
                                          <span>Employer: <strong>{shift.employerName}</strong></span>
                                        </span>
                                      )}

                                      {earnings > 0 && (
                                        <span className="bg-white border border-slate-300 px-2 py-0.5 rounded text-slate-800 flex items-center gap-1">
                                          <Euro className="w-3.5 h-3.5 text-emerald-600 shrink-0 stroke-[2]" />
                                          <span>Pay: €{shift.hourlyRate}/h → <strong className={shift.completed ? 'text-emerald-700' : 'text-amber-800'}>€{earnings.toFixed(2)}</strong></span>
                                        </span>
                                      )}

                                      {shift.reminderActive && (
                                        <span className="flex items-center gap-1 text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded">
                                          <Bell className="w-3 h-3 stroke-[2.5]" />
                                          Reminder ({shift.reminderHoursBefore}h before)
                                        </span>
                                      )}
                                    </div>

                                    {shift.notes && (
                                      <p className="text-xs text-slate-600 font-medium bg-white/90 border border-slate-200 p-2 rounded-lg flex items-start gap-1.5">
                                        <FileText className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5 stroke-[2]" />
                                        <span>{shift.notes}</span>
                                      </p>
                                    )}

                                    {isMine && (
                                      <div className="flex items-center gap-2 pt-1">
                                        <button
                                          onClick={() => handleEditClick(shift)}
                                          className="px-2.5 py-1 bg-white hover:bg-slate-100 border-2 border-slate-900 rounded-lg shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] text-xs font-bold font-mono text-slate-700 flex items-center gap-1 cursor-pointer"
                                          title="Edit Shift"
                                        >
                                          <Pencil className="w-3 h-3" /> Edit
                                        </button>

                                        <button
                                          onClick={() => handleDeleteClick(shift.id!, shift.user)}
                                          className="px-2.5 py-1 bg-white hover:bg-rose-50 border-2 border-slate-900 rounded-lg shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] text-xs font-bold font-mono text-rose-600 flex items-center gap-1 cursor-pointer"
                                          title="Delete Shift"
                                        >
                                          <Trash2 className="w-3 h-3" /> Delete
                                        </button>
                                      </div>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })}

                          {hideCompleted && completedShifts.length > 0 && !isToday && (
                            <div className="pt-2 flex items-center justify-between text-[10px] font-mono text-slate-500 font-bold border-t border-slate-200">
                              <span>✓ {completedShifts.length} completed shift{completedShifts.length === 1 ? '' : 's'} hidden</span>
                              <button
                                onClick={() => setHideCompleted(false)}
                                className="text-indigo-600 hover:text-indigo-800 font-black underline cursor-pointer"
                              >
                                Show completed
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Footer indicator if days are hidden */}
                {hideCompleted && hiddenDaysCount > 0 && (
                  <div className="bg-slate-100 border-2 border-dashed border-slate-300 p-2.5 rounded-xl flex items-center justify-between gap-2 text-xs font-mono font-bold text-slate-600">
                    <span className="flex items-center gap-1.5">
                      <EyeOff className="w-3.5 h-3.5 text-slate-500" />
                      <span>{hiddenDaysCount} completed / empty day tab{hiddenDaysCount === 1 ? '' : 's'} hidden</span>
                    </span>
                    <button
                      onClick={() => setHideCompleted(false)}
                      className="px-2.5 py-1 bg-white hover:bg-slate-200 border-2 border-slate-900 rounded-lg text-slate-900 font-black text-[11px] shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] cursor-pointer"
                    >
                      Show All Days
                    </button>
                  </div>
                )}
              </div>
            );
          })()}
        </div>
      )}

      {/* MOBILE & DESKTOP INTERACTIVE CALENDAR MODAL / SHEET */}
      {showCalendarModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-end sm:items-center justify-center p-0 sm:p-4 animate-fade-in">
          <div className="bg-white border-4 border-slate-900 rounded-t-3xl sm:rounded-3xl shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] w-full max-w-lg max-h-[92vh] flex flex-col overflow-hidden animate-slide-up">
            
            {/* Modal Header */}
            <div className="p-4 bg-indigo-600 border-b-4 border-slate-900 text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-white/10 rounded-xl border border-white/20">
                  <Calendar className="w-5 h-5 text-amber-300 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base font-black uppercase tracking-tight font-mono">Shift Calendar</h3>
                  <p className="text-[10px] text-indigo-100 font-bold">Tap any date to view or add work shifts</p>
                </div>
              </div>
              <button
                onClick={() => setShowCalendarModal(false)}
                className="p-1.5 bg-white text-slate-900 hover:bg-slate-100 rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[0.5px] cursor-pointer"
                title="Close Calendar"
              >
                <X className="w-4 h-4 stroke-[2.5]" />
              </button>
            </div>

            {/* Month Navigation & Today Shortcut */}
            <div className="p-3 bg-indigo-50 border-b-2 border-slate-900 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => navigateCalendarMonth('prev')}
                  className="p-1.5 bg-white border-2 border-slate-900 rounded-lg shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] hover:bg-indigo-100 active:translate-x-[0.5px] cursor-pointer"
                >
                  <ChevronLeft className="w-4 h-4 stroke-[2.5]" />
                </button>
                <span className="text-sm font-black text-slate-900 font-mono min-w-[120px] text-center">
                  {calendarMonth.toLocaleString('en-IE', { month: 'long', year: 'numeric' })}
                </span>
                <button
                  onClick={() => navigateCalendarMonth('next')}
                  className="p-1.5 bg-white border-2 border-slate-900 rounded-lg shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] hover:bg-indigo-100 active:translate-x-[0.5px] cursor-pointer"
                >
                  <ChevronRight className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>

              <button
                onClick={() => navigateCalendarMonth('today')}
                className="px-3 py-1 bg-white hover:bg-amber-100 text-slate-900 border-2 border-slate-900 rounded-lg text-xs font-black uppercase font-mono shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] cursor-pointer"
              >
                Today
              </button>
            </div>

            {/* Calendar Grid Body */}
            <div className="p-3 overflow-y-auto flex-1 space-y-3">
              {/* Legend for Shift Types */}
              <div className="flex items-center justify-center gap-4 text-[10px] font-mono font-black text-slate-600 bg-slate-50 border border-slate-200 p-2 rounded-xl">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-400 border border-slate-900"></span>
                  <span>Work Shift</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 border border-slate-900"></span>
                  <span>Completed</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-rose-500 border border-slate-900"></span>
                  <span className="text-rose-700">Day Off</span>
                </div>
              </div>

              {/* Day Name Headers */}
              <div className="grid grid-cols-7 text-center border-b-2 border-slate-200 pb-1">
                {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((dayName) => (
                  <span key={dayName} className="text-[10px] font-mono font-black text-slate-400 uppercase">
                    {dayName}
                  </span>
                ))}
              </div>

              {/* Month Date Cells */}
              <div className="grid grid-cols-7 gap-1.5">
                {getCalendarDaysForMonth(calendarMonth.getFullYear(), calendarMonth.getMonth()).map(({ date: dayDate, dateStr, isCurrentMonth }) => {
                  const dayShifts = getShiftsForDate(dateStr);
                  const isSelected = selectedCalendarDate === dateStr;
                  const todayStr = formatDateKey(new Date());
                  const isToday = todayStr === dateStr;

                  const hasOffShift = dayShifts.some(s => s.title.toLowerCase().includes('off') || (s.startTime === s.endTime));
                  const hasRegularShift = dayShifts.some(s => !(s.title.toLowerCase().includes('off') || (s.startTime === s.endTime)));

                  return (
                    <button
                      key={dateStr}
                      type="button"
                      onClick={() => {
                        setSelectedCalendarDate(dateStr);
                      }}
                      className={`p-1.5 min-h-[54px] rounded-xl border-2 flex flex-col justify-between transition cursor-pointer relative text-left ${
                        isSelected
                          ? 'bg-amber-300 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] scale-[1.02] z-10'
                          : isToday
                            ? 'bg-indigo-100 border-indigo-600 font-bold'
                            : hasOffShift && !hasRegularShift
                              ? 'bg-rose-50/90 border-rose-400 hover:bg-rose-100'
                              : isCurrentMonth
                                ? 'bg-white border-slate-300 hover:bg-slate-50'
                                : 'bg-slate-100/50 border-transparent text-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className={`text-xs font-mono font-black ${
                          isSelected ? 'text-slate-950' : hasOffShift && !hasRegularShift ? 'text-rose-950' : isCurrentMonth ? 'text-slate-800' : 'text-slate-300'
                        }`}>
                          {dayDate.getDate()}
                        </span>
                        {isToday && !isSelected && (
                          <span className="w-1.5 h-1.5 rounded-full bg-indigo-600"></span>
                        )}
                      </div>

                      {/* Shift Count / Badges */}
                      <div className="flex flex-wrap gap-0.5 mt-1">
                        {dayShifts.slice(0, 3).map((s, idx) => {
                          const isOff = s.title.toLowerCase().includes('off') || (s.startTime === s.endTime);
                          return (
                            <span
                              key={s.id || idx}
                              className={`w-2.5 h-2.5 rounded-full border border-slate-900 ${
                                isOff 
                                  ? 'bg-rose-500 ring-1 ring-rose-300' 
                                  : s.completed 
                                    ? 'bg-emerald-500' 
                                    : 'bg-amber-400'
                              }`}
                              title={`${s.title}${isOff ? ' (Day Off)' : ` (${s.startTime} - ${s.endTime})`}`}
                            />
                          );
                        })}
                        {dayShifts.length > 3 && (
                          <span className="text-[8px] font-black font-mono text-slate-600">
                            +{dayShifts.length - 3}
                          </span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected Date Details & Actions */}
              {selectedCalendarDate && (
                <div className="bg-slate-50 border-2 border-slate-900 rounded-2xl p-3 space-y-2 mt-2">
                  <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
                    <span className="text-xs font-black font-mono text-slate-900 flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-indigo-600 stroke-[2.5]" />
                      <span>{parseLocalDate(selectedCalendarDate).toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span>
                    </span>
                    <span className="text-[10px] font-mono font-black text-indigo-700 bg-indigo-100 border border-indigo-300 px-2 py-0.5 rounded-full">
                      {getShiftsForDate(selectedCalendarDate).length} {getShiftsForDate(selectedCalendarDate).length === 1 ? 'Shift' : 'Shifts'}
                    </span>
                  </div>

                  {/* Shift items for selected date */}
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {getShiftsForDate(selectedCalendarDate).length === 0 ? (
                      <p className="text-[10px] text-slate-400 font-mono text-center py-2 italic">
                        No work shifts or day-off logged for this date.
                      </p>
                    ) : (
                      getShiftsForDate(selectedCalendarDate).map((shift) => {
                        const isOff = shift.title.toLowerCase().includes('off') || (shift.startTime === shift.endTime);
                        return (
                          <div
                            key={shift.id}
                            className={`p-2.5 rounded-xl border-2 flex items-center justify-between text-xs transition ${
                              isOff
                                ? 'bg-rose-50/90 border-rose-500 text-rose-950'
                                : 'bg-white border-slate-900 text-slate-900'
                            }`}
                          >
                            <div>
                              <div className="flex items-center gap-1.5">
                                <p className="font-black text-[11px]">{shift.title}</p>
                                {isOff && (
                                  <span className="text-[9px] font-mono font-black text-white bg-rose-600 border border-rose-900 px-1.5 py-0.2 rounded flex items-center gap-1">
                                    <Coffee className="w-2.5 h-2.5 stroke-[2.5]" />
                                    DAY OFF
                                  </span>
                                )}
                              </div>
                              <p className={`text-[9px] font-mono font-bold ${isOff ? 'text-rose-700' : 'text-slate-500'}`}>
                                {isOff ? 'No work scheduled' : `⏰ ${shift.startTime} – ${shift.endTime}`}
                              </p>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => {
                                  handleEditClick(shift);
                                  setShowCalendarModal(false);
                                }}
                                className={`px-2 py-1 border rounded-lg text-[9px] font-black font-mono uppercase cursor-pointer ${
                                  isOff
                                    ? 'bg-rose-100 hover:bg-rose-200 text-rose-950 border-rose-400'
                                    : 'bg-indigo-50 hover:bg-indigo-100 text-indigo-900 border-slate-900'
                                }`}
                              >
                                Edit
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Actions for selected date */}
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => {
                        setDate(selectedCalendarDate);
                        setShowAddForm(true);
                        setEditingShiftId(null);
                        setTitle('');
                        setStartTime('07:00');
                        setEndTime('15:30');
                        setShowCalendarModal(false);
                      }}
                      className="py-2 px-2 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[10px] uppercase font-mono rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
                      Add Shift
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setDate(selectedCalendarDate);
                        setShowAddForm(true);
                        setEditingShiftId(null);
                        applyTemplate('off');
                        setShowCalendarModal(false);
                      }}
                      className="py-2 px-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 font-black text-[10px] uppercase font-mono rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Coffee className="w-3.5 h-3.5 stroke-[2.5] text-emerald-700" />
                      Day Off
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        jumpToDateWeek(selectedCalendarDate);
                        setShowCalendarModal(false);
                      }}
                      className="py-2 px-2 bg-white hover:bg-slate-100 text-slate-900 font-black text-[10px] uppercase font-mono rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] flex items-center justify-center gap-1 cursor-pointer"
                    >
                      <Calendar className="w-3.5 h-3.5 stroke-[2.5] text-indigo-600" />
                      View Week
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom Modal Close Bar */}
            <div className="p-3 bg-slate-100 border-t-2 border-slate-900 flex justify-end">
              <button
                onClick={() => setShowCalendarModal(false)}
                className="w-full py-2 bg-slate-900 text-white text-xs font-black uppercase font-mono rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] cursor-pointer"
              >
                Close Calendar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* CUSTOM CONFIRMATION MODAL FOR DELETIONS */}
      <CustomConfirmModal
        isOpen={deleteModalOpen}
        title="Delete Work Shift"
        message="Are you sure you want to permanently delete this work shift from the weekly roster? This action is irreversible."
        confirmLabel="Yes, Delete"
        cancelLabel="Keep Shift"
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteModalOpen(false);
          setShiftToDelete(null);
        }}
        isDestructive={true}
      />
      </>
      )}
    </div>
  );
}
