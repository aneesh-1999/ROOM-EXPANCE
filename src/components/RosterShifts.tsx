import React, { useState, useEffect } from 'react';
import { jsPDF } from 'jspdf';
import { Roommate, Profile, Shift } from '../types';
import { addShift, updateShift, deleteShift, subscribeShifts } from '../dbService';
import { 
  Calendar, Clock, Plus, Trash2, Bell, BellRing, Check, CheckCircle2, X, 
  ChevronLeft, ChevronRight, AlertCircle, Sparkles, Coffee, Moon, Sun, Briefcase, 
  DollarSign, TrendingUp, HelpCircle, CheckSquare, Square, Pencil, FileText, Image, Download,
  Lock
} from 'lucide-react';
import { showNotification } from '../notificationService';
import CustomConfirmModal from './CustomConfirmModal';

interface RosterShiftsProps {
  currentUser: Roommate;
  nicknames: Record<Roommate, string>;
  profiles: Record<Roommate, Profile>;
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

export default function RosterShifts({ currentUser, nicknames, profiles }: RosterShiftsProps) {
  const [shifts, setShifts] = useState<Shift[]>([]);
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
  const [filterMode, setFilterMode] = useState<'all' | 'mine' | 'roommate'>('mine');
  const [statsPeriod, setStatsPeriod] = useState<'week' | 'month'>('week');

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
  const applyTemplate = (type: 'morning' | 'midday' | 'evening' | 'night' | 'custom') => {
    if (type === 'morning') {
      setTitle('Morning Shift');
      setStartTime('07:00');
      setEndTime('15:30');
      setUnpaidBreakMinutes(30);
    } else if (type === 'midday') {
      setTitle('Midday Shift');
      setStartTime('09:00');
      setEndTime('17:30');
      setUnpaidBreakMinutes(30);
    } else if (type === 'evening') {
      setTitle('Evening Shift');
      setStartTime('15:00');
      setEndTime('23:30');
      setUnpaidBreakMinutes(30);
    } else if (type === 'night') {
      setTitle('Night Shift');
      setStartTime('00:00');
      setEndTime('08:00');
      setUnpaidBreakMinutes(30);
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

  // Filter shifts based on selections
  const filteredShifts = shifts.filter(s => {
    if (filterMode === 'mine') return s.user === currentUser;
    if (filterMode === 'roommate') return s.user !== currentUser;
    return true;
  });

  // Get shifts specifically for a given date
  const getShiftsForDate = (dateStr: string) => {
    return filteredShifts.filter(s => s.date === dateStr);
  };

  const otherUser: Roommate = currentUser === 'Ozric' ? 'Pawan' : 'Ozric';

  // Helper calculations for durations & wages
  const getShiftDurationHours = (start: string, end: string, unpaidBreakMins: number = 30) => {
    if (!start || !end) return 0;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    
    let startMins = sh * 60 + sm;
    let endMins = eh * 60 + em;
    
    if (endMins <= startMins) {
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

  // Filtered week shifts based on active visual filters
  const filteredWeekShifts = React.useMemo(() => {
    return visibleWeekShifts.filter(s => {
      if (filterMode === 'mine') return s.user === currentUser;
      if (filterMode === 'roommate') return s.user !== currentUser;
      return true;
    });
  }, [visibleWeekShifts, filterMode, currentUser]);

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

  // Filtered month shifts based on active visual filters
  const filteredMonthShifts = React.useMemo(() => {
    return visibleMonthShifts.filter(s => {
      if (filterMode === 'mine') return s.user === currentUser;
      if (filterMode === 'roommate') return s.user !== currentUser;
      return true;
    });
  }, [visibleMonthShifts, filterMode, currentUser]);

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
      {/* HEADER SECTION */}
      <div className="bg-white border-4 border-slate-900 p-6 rounded-2xl shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-indigo-500 rounded-xl border-2 border-slate-900 flex items-center justify-center shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] text-white shrink-0">
              <Calendar className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-black text-slate-900 tracking-tight font-display">Cohabitation Roster & Work Shifts</h2>
              <p className="text-xs text-slate-500 font-bold font-mono uppercase tracking-wide">
                Plan weekly routines, track wages, unpaid breaks, and receive 1-2h reminders
              </p>
            </div>
          </div>
          <button
            id="btn-add-shift-toggle"
            onClick={() => {
              setShowAddForm(!showAddForm);
              setEditingShiftId(null);
              setErrorMsg('');
              setSuccessMsg('');
              // Reset values to safe defaults on toggle
              setTitle('');
              setStartTime('07:00');
              setEndTime('15:30');
              setUnpaidBreakMinutes(30);
              setHourlyRate('15.00');
              setEmployerName('');
              setCompleted(false);
            }}
            className="flex items-center justify-center gap-2 px-4 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase border-2 border-slate-900 rounded-xl shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] transition-all active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] cursor-pointer self-start sm:self-auto"
          >
            {showAddForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
            {showAddForm ? 'Close Editor' : 'Add Work Shift'}
          </button>
        </div>
      </div>

      {/* STATS TIME-PERIOD SELECTOR & METRICS GRID */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 bg-slate-50 border-4 border-slate-900 p-4 rounded-2xl shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-indigo-600 shrink-0" />
            <div>
              <h3 className="font-black text-sm uppercase tracking-wider font-mono text-slate-800">
                {statsPeriod === 'week' ? '📅 Weekly' : '🗓️ Monthly'} Earnings & Analytics
              </h3>
              <p className="text-[10px] text-slate-500 font-bold font-mono uppercase">
                {statsPeriod === 'week' 
                  ? `Week of ${weekDays[0].toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })} – ${weekDays[6].toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })}` 
                  : `Month of ${monthName}`}
              </p>
            </div>
          </div>
          <div className="flex bg-slate-200/85 border-2 border-slate-900 p-1 rounded-xl shrink-0 self-start sm:self-auto">
            <button
              onClick={() => setStatsPeriod('week')}
              className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider font-black rounded-lg transition-all cursor-pointer ${
                statsPeriod === 'week'
                  ? 'bg-indigo-600 text-white border-2 border-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]'
                  : 'text-slate-650 hover:text-slate-950'
              }`}
            >
              Weekly View
            </button>
            <button
              onClick={() => setStatsPeriod('month')}
              className={`px-3 py-1.5 text-xs font-mono uppercase tracking-wider font-black rounded-lg transition-all cursor-pointer ${
                statsPeriod === 'month'
                  ? 'bg-indigo-600 text-white border-2 border-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]'
                  : 'text-slate-650 hover:text-slate-950'
              }`}
            >
              Monthly View ({currentWeekStart.toLocaleString('en-IE', { month: 'short' })})
            </button>
          </div>
        </div>

        {/* METRICS & INCOME WIDGET */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-white border-4 border-slate-900 p-4 rounded-2xl shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
            <p className="text-[10px] font-black text-slate-400 uppercase font-mono tracking-wider">
              {statsPeriod === 'week' ? 'Weekly' : 'Monthly'} Work hours
            </p>
            <div className="flex items-baseline gap-1.5 mt-1">
              <span className="text-2xl font-black text-slate-900 font-mono">
                {activeStats.totalHours.toFixed(1)}h
              </span>
              <span className="text-xs text-slate-500 font-bold">
                ({activeStats.totalShifts} shifts)
              </span>
            </div>
            <p className="text-[10px] text-slate-500 font-bold mt-1.5">
              Excludes {(activeStats.totalBreakMins / 60).toFixed(1)}h of unpaid breaks
            </p>
          </div>

          <div className="bg-emerald-50 border-4 border-slate-900 p-4 rounded-2xl shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
            <p className="text-[10px] font-black text-emerald-700 uppercase font-mono tracking-wider">
              {statsPeriod === 'week' ? 'Confirmed Earned Income' : 'Confirmed Month Income'}
            </p>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-black text-emerald-950 font-mono">
                €{activeStats.earnedIncome.toFixed(2)}
              </span>
            </div>
            <p className="text-[10px] text-emerald-650 font-black font-mono mt-1.5 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {activeStats.completedShifts} completed shifts
            </p>
          </div>

          <div className="bg-amber-50 border-4 border-slate-900 p-4 rounded-2xl shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
            <p className="text-[10px] font-black text-amber-700 uppercase font-mono tracking-wider">
              {statsPeriod === 'week' ? 'Expected Future Income' : 'Expected Month Future Income'}
            </p>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-black text-amber-950 font-mono">
                €{activeStats.expectedIncome.toFixed(2)}
              </span>
            </div>
            <p className="text-[10px] text-amber-650 font-black font-mono mt-1.5 flex items-center gap-1">
              <Clock className="w-3.5 h-3.5" />
              {activeStats.pendingShifts} scheduled shifts
            </p>
          </div>

          <div className="bg-indigo-50 border-4 border-slate-900 p-4 rounded-2xl shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
            <p className="text-[10px] font-black text-indigo-700 uppercase font-mono tracking-wider">
              Total Combined Wage
            </p>
            <div className="flex items-baseline gap-1 mt-1">
              <span className="text-2xl font-black text-indigo-950 font-mono">
                €{(activeStats.earnedIncome + activeStats.expectedIncome).toFixed(2)}
              </span>
            </div>
            <p className="text-[10px] text-indigo-600 font-bold mt-1.5">
              Active view: <span className="font-black uppercase">{filterMode}</span>
            </p>
          </div>
        </div>
      </div>

      {/* ERROR & SUCCESS ALERTS */}
      {errorMsg && (
        <div className="bg-rose-100 border-2 border-slate-900 rounded-xl p-3.5 flex items-start gap-2.5 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] animate-fade-in">
          <AlertCircle className="w-4 h-4 text-rose-650 shrink-0 mt-0.5" />
          <p className="text-xs text-rose-800 font-bold">{errorMsg}</p>
        </div>
      )}
      {successMsg && (
        <div className="bg-emerald-100 border-2 border-slate-900 rounded-xl p-3.5 flex items-start gap-2.5 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] animate-fade-in">
          <CheckCircle2 className="w-4 h-4 text-emerald-650 shrink-0 mt-0.5" />
          <p className="text-xs text-emerald-800 font-bold">{successMsg}</p>
        </div>
      )}

      {/* SHIFT CREATOR / EDITOR FORM */}
      {showAddForm && (
        <div className="bg-amber-50/50 border-4 border-slate-900 p-6 rounded-2xl shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] space-y-4 animate-fade-in">
          <div className="flex items-center justify-between border-b-2 border-slate-350 pb-3">
            <h3 className="font-black text-sm uppercase tracking-wider font-mono text-slate-800">
              {editingShiftId ? '✏️ Edit Work Shift Details' : '🕒 Log New Work Shift'}
            </h3>
            <button 
              onClick={() => setShowAddForm(false)} 
              className="p-1 hover:bg-slate-200 rounded-lg text-slate-500 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          <form onSubmit={handleAddShift} className="space-y-4">
            {/* Quick shift templates updated to the user's direct routine */}
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-slate-500 uppercase tracking-wider font-mono block">
                Quick Shift Schedules (Includes 30-min unpaid break)
              </label>
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <button
                  type="button"
                  onClick={() => applyTemplate('morning')}
                  className="p-2 text-[11px] font-black bg-white border-2 border-slate-900 rounded-lg text-center hover:bg-indigo-50 transition cursor-pointer"
                >
                  ☀️ Morning (07:00 – 15:30)
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate('midday')}
                  className="p-2 text-[11px] font-black bg-white border-2 border-slate-900 rounded-lg text-center hover:bg-sky-50 transition cursor-pointer"
                >
                  ⛅ Midday (09:00 – 17:30)
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate('evening')}
                  className="p-2 text-[11px] font-black bg-white border-2 border-slate-900 rounded-lg text-center hover:bg-rose-50 transition cursor-pointer"
                >
                  🌇 Evening (15:00 – 23:30)
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate('night')}
                  className="p-2 text-[11px] font-black bg-white border-2 border-slate-900 rounded-lg text-center hover:bg-violet-50 transition cursor-pointer"
                >
                  🌙 Night (00:00 – 08:00)
                </button>
                <button
                  type="button"
                  onClick={() => applyTemplate('custom')}
                  className="p-2 text-[11px] font-black bg-white border-2 border-slate-900 rounded-lg text-center hover:bg-amber-100 transition cursor-pointer col-span-2 sm:col-span-1"
                >
                  ⚙️ Clear Form
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="shift-title" className="text-xs font-black text-slate-900">
                  Shift Title / Role <span className="text-rose-500">*</span>
                </label>
                <input
                  id="shift-title"
                  type="text"
                  placeholder="e.g., Morning Shift, General Duty, Clinic"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full p-2.5 bg-white border-2 border-slate-900 rounded-xl text-xs font-bold focus:outline-none"
                  maxLength={50}
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="shift-employer" className="text-xs font-black text-slate-900 flex justify-between">
                  <span>Employer / Company Name <span className="text-slate-400">(Optional)</span></span>
                  {Object.keys(allPresets).length > 0 && (
                    <span className="text-[10px] text-indigo-600 font-bold font-mono">Auto-fills hourly rate!</span>
                  )}
                </label>
                <input
                  id="shift-employer"
                  type="text"
                  placeholder="e.g., NHS Trust, Amazon, TechCorp"
                  value={employerName}
                  onChange={(e) => handleEmployerNameChange(e.target.value)}
                  className="w-full p-2.5 bg-white border-2 border-slate-900 rounded-xl text-xs font-bold focus:outline-none"
                  maxLength={50}
                  list="employer-presets-list"
                />
                <datalist id="employer-presets-list">
                  {Object.keys(allPresets).map(name => (
                    <option key={name} value={name} />
                  ))}
                </datalist>

                {Object.keys(allPresets).length > 0 && (
                  <div className="mt-1.5 flex flex-wrap gap-1 max-h-[70px] overflow-y-auto pr-1">
                    <span className="text-[9px] font-mono font-bold text-slate-500 self-center mr-1">Saved:</span>
                    {Object.keys(allPresets).map((name) => {
                      const data = allPresets[name];
                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => {
                            setEmployerName(name);
                            setHourlyRate(String(data.hourlyRate));
                            setUnpaidBreakMinutes(data.unpaidBreakMinutes);
                            if (data.title) {
                              setTitle(data.title);
                            }
                          }}
                          className={`px-2 py-0.5 border rounded-full text-[9px] font-mono font-black transition cursor-pointer ${
                            employerName.trim().toLowerCase() === name.toLowerCase()
                              ? 'bg-indigo-600 text-white border-slate-900 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]'
                              : 'bg-white hover:bg-indigo-50 border-slate-300 text-slate-700'
                          }`}
                          title={`Click to fill: €${data.hourlyRate}/h, ${data.unpaidBreakMinutes}m break`}
                        >
                          🏢 {name} (€{data.hourlyRate})
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="space-y-1.5">
                <label htmlFor="shift-date" className="text-xs font-black text-slate-900">
                  Shift Date <span className="text-rose-500">*</span>
                </label>
                <input
                  id="shift-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full p-2.5 bg-white border-2 border-slate-900 rounded-xl text-xs font-bold focus:outline-none"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <label htmlFor="shift-start" className="text-xs font-black text-slate-900">
                  Start Time <span className="text-rose-500">*</span>
                </label>
                <input
                  id="shift-start"
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full p-2.5 bg-white border-2 border-slate-900 rounded-xl text-xs font-bold focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="shift-end" className="text-xs font-black text-slate-900">
                  End Time <span className="text-rose-500">*</span>
                </label>
                <input
                  id="shift-end"
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full p-2.5 bg-white border-2 border-slate-900 rounded-xl text-xs font-bold focus:outline-none"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="shift-hourly-rate" className="text-xs font-black text-slate-900">
                  Hourly Rate (€ / hr)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs text-slate-400 font-black font-mono">€</span>
                  <input
                    id="shift-hourly-rate"
                    type="number"
                    step="0.01"
                    placeholder="15.00"
                    value={hourlyRate}
                    onChange={(e) => setHourlyRate(e.target.value)}
                    className="w-full p-2.5 pl-7 bg-white border-2 border-slate-900 rounded-xl text-xs font-bold focus:outline-none font-mono"
                    min="0"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="shift-unpaid-break" className="text-xs font-black text-slate-900">
                  Unpaid Break (minutes)
                </label>
                <input
                  id="shift-unpaid-break"
                  type="number"
                  placeholder="30"
                  value={unpaidBreakMinutes}
                  onChange={(e) => setUnpaidBreakMinutes(Number(e.target.value))}
                  className="w-full p-2.5 bg-white border-2 border-slate-900 rounded-xl text-xs font-bold focus:outline-none font-mono"
                  min="0"
                />
              </div>
            </div>

            {/* Income Preview Widget inside form */}
            {(() => {
              const hours = getShiftDurationHours(startTime, endTime, unpaidBreakMinutes);
              const rateVal = parseFloat(hourlyRate) || 0;
              const earnings = hours * rateVal;
              return (
                <div className="bg-white border-2 border-slate-900 p-3 rounded-xl flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-700">
                      Calculated Shift Duration: <strong className="text-slate-950 font-mono">{hours.toFixed(2)} hours</strong> (Break excluded)
                    </span>
                  </div>
                  {rateVal > 0 && (
                    <span className="text-xs font-black text-emerald-700">
                      Estimated Earnings: <strong className="font-mono text-sm bg-emerald-100 border border-emerald-400 px-2 py-0.5 rounded">€{earnings.toFixed(2)}</strong>
                    </span>
                  )}
                </div>
              );
            })()}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="col-span-2 flex flex-col sm:flex-row gap-3">
                <div className="flex-1 flex items-center gap-2 bg-white/70 border-2 border-slate-900 p-3 rounded-xl">
                  <input
                    id="checkbox-shift-reminder"
                    type="checkbox"
                    checked={reminderActive}
                    onChange={(e) => setReminderActive(e.target.checked)}
                    className="w-4 h-4 text-indigo-600 border-2 border-slate-900 rounded focus:ring-indigo-500 cursor-pointer"
                  />
                  <label htmlFor="checkbox-shift-reminder" className="text-xs font-black text-slate-950 cursor-pointer select-none">
                    Notify Me 1-2h before on shift day
                  </label>
                </div>

                <div className="flex-1 flex items-center gap-2 bg-emerald-50 border-2 border-slate-900 p-3 rounded-xl">
                  <input
                    id="checkbox-shift-completed"
                    type="checkbox"
                    checked={completed}
                    onChange={(e) => setCompleted(e.target.checked)}
                    className="w-4 h-4 text-emerald-600 border-2 border-slate-900 rounded focus:ring-emerald-500 cursor-pointer"
                  />
                  <label htmlFor="checkbox-shift-completed" className="text-xs font-black text-emerald-950 cursor-pointer select-none flex items-center gap-1.5">
                    Shift is Completed
                  </label>
                </div>
              </div>

              <div className="space-y-1.5">
                <select
                  id="shift-reminder-hours"
                  value={reminderHoursBefore}
                  onChange={(e) => setReminderHoursBefore(Number(e.target.value))}
                  className="w-full p-2.5 bg-white border-2 border-slate-900 rounded-xl text-xs font-bold focus:outline-none"
                  disabled={!reminderActive}
                >
                  <option value={1}>1 Hour Before Shift</option>
                  <option value={2}>2 Hours Before Shift</option>
                  <option value={3}>3 Hours Before Shift</option>
                </select>
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="shift-notes" className="text-xs font-black text-slate-900">
                Notes / Handover Details <span className="text-slate-400">(Optional)</span>
              </label>
              <textarea
                id="shift-notes"
                placeholder="e.g., Pawan covering final hour, bring keys, check coin meters, handover task status"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                className="w-full p-2.5 bg-white border-2 border-slate-900 rounded-xl text-xs font-bold focus:outline-none h-16 resize-none"
                maxLength={200}
              />
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  setEditingShiftId(null);
                }}
                className="px-4 py-2 bg-white hover:bg-slate-100 border-2 border-slate-900 rounded-xl text-xs font-black uppercase transition shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white border-2 border-slate-900 rounded-xl text-xs font-black uppercase transition shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] disabled:opacity-55 cursor-pointer"
              >
                {isSubmitting ? 'Saving...' : editingShiftId ? 'Update Shift' : 'Add Shift'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* WEEK NAVIGATION AND FILTER HEADER */}
      <div className="bg-white border-4 border-slate-900 p-4 rounded-2xl shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] flex flex-col md:flex-row md:items-center justify-between gap-4">
        {/* Week controls */}
        <div className="flex items-center gap-2 self-center md:self-auto">
          <button
            onClick={() => navigateWeek('prev')}
            className="p-2 border-2 border-slate-900 rounded-lg bg-white text-slate-900 hover:bg-indigo-50 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition active:translate-x-[1px] cursor-pointer"
            title="Previous Week"
          >
            <ChevronLeft className="w-4 h-4 stroke-[2.5px]" />
          </button>
          
          <button
            onClick={() => navigateWeek('current')}
            className="px-3 py-1.5 border-2 border-slate-900 rounded-lg bg-indigo-50 hover:bg-indigo-100 text-xs font-black uppercase tracking-wider font-mono shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] cursor-pointer"
          >
            This Week
          </button>

          <button
            onClick={() => navigateWeek('next')}
            className="p-2 border-2 border-slate-900 rounded-lg bg-white text-slate-900 hover:bg-indigo-50 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition active:translate-x-[1px] cursor-pointer"
            title="Next Week"
          >
            <ChevronRight className="w-4 h-4 stroke-[2.5px]" />
          </button>
        </div>

        {/* Display Current Week Range */}
        <div className="text-center font-black text-sm text-slate-800 font-mono">
          📅 {weekDays[0].toLocaleDateString('en-IE', { day: 'numeric', month: 'short' })} – {weekDays[6].toLocaleDateString('en-IE', { day: 'numeric', month: 'short', year: 'numeric' })}
        </div>

        {/* Private View Indicator */}
        <div className="flex items-center justify-center gap-2 bg-indigo-50 border-2 border-indigo-600 p-2 rounded-xl">
          <Lock className="w-3.5 h-3.5 text-indigo-600 stroke-[2.5px]" />
          <span className="text-[10px] font-mono uppercase tracking-wider font-black text-indigo-950">
            Private View: Only Your Shifts Shown (Logged in as {nicknames[currentUser]})
          </span>
        </div>
      </div>

      {/* WEEKLY CALENDAR GRID */}
      {loading ? (
        <div className="bg-white border-4 border-slate-900 p-12 rounded-2xl shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] flex flex-col items-center justify-center gap-3">
          <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-xs font-black text-slate-600 uppercase font-mono">Syncing work schedules...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-7 gap-4 items-stretch">
          {weekDays.map((day, idx) => {
            const dateStr = formatDateKey(day);
            const dateShifts = getShiftsForDate(dateStr);
            const today = new Date();
            const isToday = today.getDate() === day.getDate() && 
                            today.getMonth() === day.getMonth() && 
                            today.getFullYear() === day.getFullYear();

            return (
              <div 
                key={dateStr}
                className={`border-4 rounded-2xl p-3.5 flex flex-col min-h-[190px] transition-all relative ${
                  isToday 
                    ? 'bg-indigo-50 border-indigo-600 shadow-[4px_4px_0px_0px_rgba(79,70,229,1)]' 
                    : 'bg-white border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]'
                }`}
              >
                {/* Day Header */}
                <div className="flex items-center justify-between border-b-2 border-slate-200 pb-2 mb-2">
                  <div className="flex flex-col">
                    <span className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-wider">
                      {day.toLocaleDateString('en-IE', { weekday: 'short' })}
                    </span>
                    <span className="text-sm font-black text-slate-950 font-mono">
                      {day.getDate()}
                    </span>
                  </div>
                  {isToday && (
                    <span className="text-[8px] font-black tracking-widest uppercase font-mono bg-indigo-600 text-white px-1.5 py-0.5 rounded">
                      Today
                    </span>
                  )}
                </div>

                {/* Day Shifts */}
                <div className="flex-1 space-y-2 overflow-y-auto max-h-[220px]">
                  {dateShifts.length === 0 ? (
                    <div className="h-full flex items-center justify-center py-6">
                      <p className="text-[9px] text-slate-400 font-bold font-mono uppercase text-center italic">
                        No shifts
                      </p>
                    </div>
                  ) : (
                    dateShifts.map(shift => {
                      const isMine = shift.user === currentUser;
                      const userProf = profiles[shift.user];
                      const accentColor = userProf?.accentColor || 'indigo';

                      // Calculations
                      const hours = getShiftDurationHours(shift.startTime, shift.endTime, shift.unpaidBreakMinutes ?? 30);
                      const earnings = getShiftEarnings(shift);

                      // Shift icon helper based on title content
                      const lowerTitle = shift.title.toLowerCase();
                      let ShiftIcon = Briefcase;
                      if (lowerTitle.includes('morning') || lowerTitle.includes('day') || lowerTitle.includes('sun')) {
                        ShiftIcon = Sun;
                      } else if (lowerTitle.includes('evening') || lowerTitle.includes('afternoon')) {
                        ShiftIcon = Coffee;
                      } else if (lowerTitle.includes('night') || lowerTitle.includes('dark') || lowerTitle.includes('sleep')) {
                        ShiftIcon = Moon;
                      }

                      return (
                        <div 
                          key={shift.id}
                          className={`p-2 rounded-xl border-2 border-slate-900 text-left relative flex flex-col gap-1 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] ${
                            shift.completed 
                              ? 'bg-emerald-50/70 border-emerald-800' 
                              : isMine 
                                ? 'bg-amber-50/70' 
                                : 'bg-slate-50'
                          }`}
                        >
                          {/* Shift User & Status Badge */}
                          <div className="flex items-center justify-between gap-1">
                            <span className="text-[9px] font-black font-mono flex items-center gap-1">
                              <span>{userProf?.avatar || (isMine ? '🐼' : '🦊')}</span>
                              <span className={isMine ? 'text-indigo-700' : 'text-slate-650'}>
                                {isMine ? 'Me' : nicknames[shift.user]}
                              </span>
                            </span>
                            <div className="flex items-center gap-1 shrink-0">
                              {/* Alarm Indicator */}
                              {shift.reminderActive && (
                                <button
                                  disabled={!isMine}
                                  onClick={() => handleToggleReminder(shift)}
                                  className={`p-0.5 rounded hover:bg-slate-200 transition shrink-0 ${
                                    shift.notified 
                                      ? 'text-emerald-600' 
                                      : 'text-rose-500'
                                  }`}
                                  title={shift.notified ? "Reminder fired" : `Reminder active (${shift.reminderHoursBefore}h before)`}
                                >
                                  {shift.notified ? <CheckCircle2 className="w-3 h-3" /> : <BellRing className="w-3 h-3" />}
                                </button>
                              )}

                              {/* Toggle Completion directly */}
                              {isMine && (
                                <button
                                  onClick={() => handleToggleCompleted(shift)}
                                  className={`p-0.5 rounded hover:bg-slate-200 transition shrink-0 ${
                                    shift.completed ? 'text-emerald-700' : 'text-slate-400'
                                  }`}
                                  title={shift.completed ? "Mark incomplete" : "Mark shift completed"}
                                >
                                  {shift.completed ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
                                </button>
                              )}
                            </div>
                          </div>

                          {/* Shift details */}
                          <div className="space-y-0.5">
                            <h4 className="text-[10px] font-black text-slate-950 truncate flex items-center gap-1" title={shift.title}>
                              <ShiftIcon className="w-3 h-3 shrink-0 text-slate-600" />
                              {shift.title}
                            </h4>
                            {shift.employerName && (
                              <p className="text-[8px] font-mono font-black text-slate-500 uppercase tracking-tight truncate">
                                🏢 {shift.employerName}
                              </p>
                            )}
                            <div className="flex items-center gap-1 text-[9px] font-bold text-slate-500 font-mono">
                              <Clock className="w-2.5 h-2.5 shrink-0 stroke-[2.5px]" />
                              <span>{shift.startTime} – {shift.endTime}</span>
                            </div>
                          </div>

                          {/* Wage Breakdown */}
                          {earnings > 0 && (
                            <div className="mt-1 border-t border-dashed border-slate-300 pt-1 flex items-center justify-between text-[9px] font-mono">
                              <span className="text-slate-500">{hours.toFixed(1)}h @ €{shift.hourlyRate}</span>
                              <span className={`font-black ${shift.completed ? 'text-emerald-700' : 'text-amber-800'}`}>
                                {shift.completed ? 'Earned:' : 'Exp:'} €{earnings.toFixed(1)}
                              </span>
                            </div>
                          )}

                          {shift.notes && (
                            <p className="text-[8px] text-slate-500 font-medium line-clamp-1 border-t border-dotted border-slate-300 pt-1">
                              💡 {shift.notes}
                            </p>
                          )}

                          {/* Actions (Only on own shifts) */}
                          {isMine && (
                            <div className="flex items-center justify-end gap-1.5 pt-1.5 border-t border-slate-200 mt-1">
                              <button
                                onClick={() => handleEditClick(shift)}
                                className="p-0.5 hover:bg-indigo-100 rounded text-slate-600 hover:text-indigo-700 transition"
                                title="Edit Shift"
                              >
                                <Pencil className="w-2.5 h-2.5" />
                              </button>
                              <button
                                onClick={() => handleDeleteClick(shift.id!, shift.user)}
                                className="p-0.5 hover:bg-rose-100 rounded text-slate-650 hover:text-rose-600 transition"
                                title="Delete Shift"
                              >
                                <Trash2 className="w-2.5 h-2.5" />
                              </button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* DETAILED SCHEDULE TIMELINE LIST */}
      <div className="bg-white border-4 border-slate-900 p-6 rounded-2xl shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b-2 border-slate-900 pb-3 gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="font-black text-sm uppercase tracking-wider font-mono text-slate-800">
              📊 Agenda View & Earned Income breakdown
            </h3>
            <span className="text-[10px] font-mono bg-indigo-50 border-2 border-slate-900 px-2 py-0.5 rounded font-black">
              {filteredWeekShifts.length} Shifts This Week
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border-2 border-slate-900 text-slate-900 text-[10px] font-black uppercase font-mono rounded-lg shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] transition active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-[0.5px_0.5px_0px_0px_rgba(15,23,42,1)] cursor-pointer"
              title="Export filtered roster shifts as a formal PDF document"
            >
              <FileText className="w-3.5 h-3.5 text-indigo-600 stroke-[2.5px]" />
              PDF Report
            </button>
            <button
              onClick={handleExportPNG}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-slate-100 border-2 border-slate-900 text-slate-900 text-[10px] font-black uppercase font-mono rounded-lg shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] transition active:translate-x-[0.5px] active:translate-y-[0.5px] active:shadow-[0.5px_0.5px_0px_0px_rgba(15,23,42,1)] cursor-pointer"
              title="Export filtered roster shifts as an infographic PNG image"
            >
              <Image className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5px]" />
              PNG Infographic
            </button>
          </div>
        </div>

        {filteredWeekShifts.length === 0 ? (
          <div className="py-12 text-center text-slate-400 space-y-2">
            <Calendar className="w-8 h-8 mx-auto stroke-[1.5px] text-slate-300" />
            <p className="text-xs font-mono font-black uppercase">No shifts found this week</p>
            <p className="text-[10px] text-slate-400">Add a work shift using the "Add Work Shift" button above!</p>
          </div>
        ) : (
          <div className="divide-y-2 divide-slate-100 max-h-[400px] overflow-y-auto pr-2 space-y-2.5">
            {filteredWeekShifts.map((shift) => {
              const isMine = shift.user === currentUser;
              const userProf = profiles[shift.user];
              const shiftDate = parseLocalDate(shift.date);
              
              // Formatting day string nicely
              const formattedDay = shiftDate.toLocaleDateString('en-IE', {
                weekday: 'short',
                day: 'numeric',
                month: 'short'
              });

              const hours = getShiftDurationHours(shift.startTime, shift.endTime, shift.unpaidBreakMinutes ?? 30);
              const earnings = getShiftEarnings(shift);

              return (
                <div 
                  key={shift.id}
                  className={`pt-2.5 first:pt-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-3 rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all hover:bg-slate-50 ${
                    shift.completed
                      ? 'bg-emerald-50/30 border-emerald-950'
                      : isMine 
                        ? 'bg-amber-50/20' 
                        : 'bg-white'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl mt-0.5">{userProf?.avatar || (isMine ? '🐼' : '🦊')}</span>
                    <div>
                      <div className="flex items-center flex-wrap gap-2">
                        <h4 className="font-black text-sm text-slate-950">{shift.title}</h4>
                        <span className="text-[9px] font-mono font-black bg-slate-100 border border-slate-400 px-1.5 py-0.2 rounded text-slate-650">
                          {isMine ? 'Me' : nicknames[shift.user]}
                        </span>
                        {shift.completed ? (
                          <span className="text-[9px] font-mono font-black bg-emerald-100 border border-emerald-400 text-emerald-800 px-1.5 py-0.2 rounded flex items-center gap-1">
                            <Check className="w-3 h-3" /> Completed
                          </span>
                        ) : (
                          <span className="text-[9px] font-mono font-black bg-amber-100 border border-amber-400 text-amber-800 px-1.5 py-0.2 rounded">
                            Scheduled
                          </span>
                        )}
                        {shift.employerName && (
                          <span className="text-[9px] font-mono font-black bg-slate-100 border border-slate-300 px-1.5 py-0.2 rounded text-slate-500">
                            🏢 {shift.employerName}
                          </span>
                        )}
                      </div>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500 font-bold font-mono mt-1">
                        <span>📅 {formattedDay}</span>
                        <span className="flex items-center gap-1 text-slate-600">
                          <Clock className="w-3 h-3 stroke-[2.5px]" />
                          {shift.startTime} – {shift.endTime} 
                          {shift.unpaidBreakMinutes !== undefined && shift.unpaidBreakMinutes > 0 && (
                            <span className="text-slate-400 text-[10px]">({shift.unpaidBreakMinutes}m break)</span>
                          )}
                        </span>
                        {shift.reminderActive && (
                          <span className="flex items-center gap-1 text-indigo-600 text-[10px]">
                            <Bell className="w-3 h-3" />
                            Alert {shift.reminderHoursBefore}h before
                          </span>
                        )}
                      </div>

                      {/* Earnings calculation feedback row */}
                      {earnings > 0 && (
                        <p className="text-xs font-mono text-slate-500 mt-1 font-black">
                          💰 Duration: <strong className="text-slate-800">{hours.toFixed(2)}h</strong> paid hours @ €{shift.hourlyRate}/hr. 
                          {shift.completed ? (
                            <span className="text-emerald-700 ml-1 bg-emerald-100/70 border border-emerald-300 px-1.5 py-0.2 rounded">Earned: €{earnings.toFixed(2)}</span>
                          ) : (
                            <span className="text-amber-800 ml-1 bg-amber-100/70 border border-amber-300 px-1.5 py-0.2 rounded">Expected: €{earnings.toFixed(2)}</span>
                          )}
                        </p>
                      )}

                      {shift.notes && (
                        <p className="text-xs text-slate-650 font-medium mt-1.5 bg-slate-50 border border-slate-200 p-1.5 rounded-lg max-w-lg">
                          💡 {shift.notes}
                        </p>
                      )}
                    </div>
                  </div>

                  {isMine && (
                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      <button
                        onClick={() => handleToggleCompleted(shift)}
                        className={`px-2.5 py-1.5 border-2 border-slate-900 rounded-lg text-xs font-black uppercase tracking-wider font-mono shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] transition ${
                          shift.completed 
                            ? 'bg-emerald-300 text-emerald-950 hover:bg-emerald-400' 
                            : 'bg-white text-slate-600 hover:bg-slate-100'
                        }`}
                        title={shift.completed ? "Mark incomplete" : "Mark completed"}
                      >
                        {shift.completed ? 'Completed ✓' : 'Complete ✓'}
                      </button>
                      <button
                        onClick={() => handleToggleReminder(shift)}
                        className={`p-1.5 border-2 border-slate-900 rounded-lg shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] transition ${
                          shift.reminderActive 
                            ? 'bg-amber-300 text-slate-950 hover:bg-amber-400' 
                            : 'bg-white text-slate-400 hover:bg-slate-100'
                        }`}
                        title={shift.reminderActive ? "Mute Reminder" : "Activate Alarm Reminder"}
                      >
                        <Bell className={`w-3.5 h-3.5 ${shift.reminderActive ? 'animate-bounce' : ''}`} />
                      </button>
                      <button
                        onClick={() => handleEditClick(shift)}
                        className="p-1.5 border-2 border-slate-900 bg-white hover:bg-slate-100 rounded-lg shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]"
                        title="Edit Shift"
                      >
                        <Pencil className="w-3.5 h-3.5 text-slate-700" />
                      </button>
                      <button
                        onClick={() => handleDeleteClick(shift.id!, shift.user)}
                        className="p-1.5 border-2 border-slate-900 bg-white hover:bg-rose-50 text-rose-600 hover:text-rose-700 rounded-lg shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]"
                        title="Delete Shift"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

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
    </div>
  );
}
