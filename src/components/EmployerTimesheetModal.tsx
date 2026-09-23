import React, { useState, useMemo } from 'react';
import { jsPDF } from 'jspdf';
import { Shift, Roommate, Profile } from '../types';
import { 
  X, Briefcase, Calendar, Clock, Download, FileText, Image, Copy, Check, 
  Building2, ShieldCheck, UserCheck, Coffee, ChevronDown, Sparkles, Filter, FileSpreadsheet, Share2,
  HeartPulse
} from 'lucide-react';
import { showNotification } from '../notificationService';

interface EmployerTimesheetModalProps {
  isOpen: boolean;
  onClose: () => void;
  shifts: Shift[];
  currentUser: Roommate;
  nicknames: Record<Roommate, string>;
  profiles: Record<Roommate, Profile>;
}

export default function EmployerTimesheetModal({
  isOpen,
  onClose,
  shifts,
  currentUser,
  nicknames,
  profiles
}: EmployerTimesheetModalProps) {
  if (!isOpen) return null;

  // Default Employee Name
  const defaultFullName = currentUser === 'Ozric' 
    ? (profiles.Ozric?.nickname ? `${profiles.Ozric.nickname} (Aneesh Dallakoti)` : 'Aneesh Dallakoti')
    : (profiles.Pawan?.nickname ? `${profiles.Pawan.nickname} (Pawan Sharma)` : 'Pawan Sharma');

  const [employeeName, setEmployeeName] = useState(defaultFullName);
  const [departmentOrRole, setDepartmentOrRole] = useState('Staff Member');
  const [periodType, setPeriodType] = useState<'week' | 'month' | 'custom' | 'all'>('month');
  
  // Date range filters
  const today = new Date();
  const currentMonthStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;
  const [selectedMonth, setSelectedMonth] = useState(currentMonthStr);
  
  // Custom range
  const sevenDaysAgo = new Date();
  sevenDaysAgo.setDate(today.getDate() - 7);
  const [customStartDate, setCustomStartDate] = useState(sevenDaysAgo.toISOString().split('T')[0]);
  const [customEndDate, setCustomEndDate] = useState(today.toISOString().split('T')[0]);

  // Employer Filter
  const [selectedEmployer, setSelectedEmployer] = useState<string>('ALL');

  // Options
  const [includeDaysOff, setIncludeDaysOff] = useState(true);
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeSignatureBox, setIncludeSignatureBox] = useState(true);
  const [copiedText, setCopiedText] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // Extract unique employers
  const uniqueEmployers = useMemo(() => {
    const set = new Set<string>();
    shifts.forEach(s => {
      if (s.employerName && s.employerName.trim()) {
        set.add(s.employerName.trim());
      }
    });
    return Array.from(set).sort();
  }, [shifts]);

  // Helper: Check Sick Leave
  const isSickLeave = (s: Shift) => {
    const titleLower = (s.title || '').trim().toLowerCase();
    return (
      titleLower.includes('sick') ||
      titleLower.includes('medical') ||
      titleLower.includes('illness') ||
      titleLower.includes('doctor') ||
      titleLower.includes('hospital') ||
      titleLower.includes('unwell') ||
      titleLower === 'sick leave' ||
      titleLower === 'sickleave'
    );
  };

  // Helper: Check Day Off
  const isDayOff = (s: Shift) => {
    if (isSickLeave(s)) return false;
    const titleLower = (s.title || '').trim().toLowerCase();
    return (
      titleLower.includes('day off') ||
      titleLower === 'off' ||
      titleLower === 'dayoff' ||
      titleLower === 'rest day' ||
      titleLower === 'holiday' ||
      titleLower === 'vacation' ||
      titleLower === 'leave' ||
      (s.startTime && s.endTime && s.startTime === s.endTime)
    );
  };

  // Helper: Calculate Hours
  const getShiftDurationHours = (start: string, end: string, unpaidBreakMins: number = 30) => {
    if (!start || !end || start === end) return 0;
    const [sh, sm] = start.split(':').map(Number);
    const [eh, em] = end.split(':').map(Number);
    let startMins = sh * 60 + sm;
    let endMins = eh * 60 + em;
    if (endMins < startMins) endMins += 24 * 60; // Overnight
    const totalMins = endMins - startMins - Number(unpaidBreakMins);
    return Math.max(0, totalMins / 60);
  };

  // Filtered shifts for employer timesheet
  const filteredShifts = useMemo(() => {
    return shifts.filter(s => {
      // 1. User check
      if (s.user !== currentUser) return false;

      // 2. Employer filter
      if (selectedEmployer !== 'ALL') {
        const emp = (s.employerName || '').trim().toLowerCase();
        if (emp !== selectedEmployer.toLowerCase()) return false;
      }

      // 3. Days Off inclusion check
      if (!includeDaysOff && (isDayOff(s) || isSickLeave(s))) return false;

      // 4. Date filtering
      if (periodType === 'month') {
        if (!s.date.startsWith(selectedMonth)) return false;
      } else if (periodType === 'week') {
        // Current week (Monday to Sunday)
        const d = new Date(today);
        const day = d.getDay();
        const diff = d.getDate() - day + (day === 0 ? -6 : 1);
        const monday = new Date(d.setDate(diff));
        monday.setHours(0, 0, 0, 0);
        const sunday = new Date(monday);
        sunday.setDate(monday.getDate() + 6);
        sunday.setHours(23, 59, 59, 999);

        const sDate = new Date(s.date);
        if (sDate < monday || sDate > sunday) return false;
      } else if (periodType === 'custom') {
        if (customStartDate && s.date < customStartDate) return false;
        if (customEndDate && s.date > customEndDate) return false;
      }

      return true;
    }).sort((a, b) => {
      const d = a.date.localeCompare(b.date);
      if (d !== 0) return d;
      return a.startTime.localeCompare(b.startTime);
    });
  }, [shifts, currentUser, selectedEmployer, includeDaysOff, periodType, selectedMonth, customStartDate, customEndDate]);

  // Statistics for this timesheet (NO wages or rates)
  const timesheetStats = useMemo(() => {
    let totalWorkHours = 0;
    let totalGrossHours = 0;
    let totalBreakMinutes = 0;
    let workShiftsCount = 0;
    let daysOffCount = 0;
    let sickLeaveCount = 0;
    let completedShiftsCount = 0;

    filteredShifts.forEach(s => {
      if (isSickLeave(s)) {
        sickLeaveCount += 1;
      } else if (isDayOff(s)) {
        daysOffCount += 1;
      } else {
        const netHrs = getShiftDurationHours(s.startTime, s.endTime, Number(s.unpaidBreakMinutes ?? 30));
        const breakM = Number(s.unpaidBreakMinutes ?? 30);
        
        const [sh, sm] = s.startTime.split(':').map(Number);
        const [eh, em] = s.endTime.split(':').map(Number);
        let startM = sh * 60 + sm;
        let endM = eh * 60 + em;
        if (endM < startM) endM += 24 * 60;
        const grossHrs = (endM - startM) / 60;

        totalWorkHours += netHrs;
        totalGrossHours += grossHrs;
        totalBreakMinutes += breakM;
        workShiftsCount += 1;
        if (s.completed) completedShiftsCount += 1;
      }
    });

    return {
      totalWorkHours,
      totalGrossHours,
      totalBreakMinutes,
      workShiftsCount,
      daysOffCount,
      sickLeaveCount,
      completedShiftsCount,
      totalEntries: filteredShifts.length
    };
  }, [filteredShifts]);

  // Period label for report
  const periodLabel = useMemo(() => {
    if (periodType === 'month') {
      const [y, m] = selectedMonth.split('-');
      const d = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
      return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    } else if (periodType === 'week') {
      const d = new Date(today);
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const mon = new Date(d.setDate(diff));
      const sun = new Date(mon);
      sun.setDate(mon.getDate() + 6);
      return `Week of ${mon.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${sun.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;
    } else if (periodType === 'custom') {
      return `${customStartDate || 'Start'} to ${customEndDate || 'End'}`;
    }
    return 'All Time Shift Records';
  }, [periodType, selectedMonth, customStartDate, customEndDate]);

  // ==========================================
  // 1. EXPORT AS DETAILED PDF FOR EMPLOYER
  // ==========================================
  const handleExportPDF = () => {
    try {
      setIsExporting(true);
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      // Page dimensions
      const pageWidth = 210;
      const pageHeight = 297;
      let y = 12;

      // Outer Clean Border
      doc.setLineWidth(0.8);
      doc.setDrawColor(15, 23, 42); // slate-900
      doc.rect(8, 8, pageWidth - 16, pageHeight - 16);

      // Header Container
      doc.setFillColor(15, 23, 42); // slate-900
      doc.rect(10, 10, pageWidth - 20, 26, 'F');

      // Title
      doc.setTextColor(255, 255, 255);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.text('OFFICIAL EMPLOYEE WORK TIMESHEET', 14, 20);

      // Subtitle
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(203, 213, 225); // slate-300
      doc.text('Shift Hours, Attendance & Verification Log (Confidential Working Record)', 14, 26);
      doc.text(`Generated: ${new Date().toLocaleDateString('en-GB')} at ${new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}`, 14, 31);

      // Employer & Employee Metadata Section
      y = 40;
      doc.setFillColor(248, 250, 252); // slate-50
      doc.rect(10, y, pageWidth - 20, 20, 'F');
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.4);
      doc.rect(10, y, pageWidth - 20, 20, 'D');

      // Col 1: Employee Name
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('EMPLOYEE NAME', 14, y + 6);
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(employeeName || 'Aneesh Dallakoti', 14, y + 13);

      // Col 2: Workplace / Employer
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('WORKPLACE / EMPLOYER', 75, y + 6);
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(selectedEmployer === 'ALL' ? 'All Workplace Stations' : selectedEmployer, 75, y + 13);

      // Col 3: Pay / Work Period
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text('TIMESHEET PERIOD', 140, y + 6);
      doc.setFontSize(10);
      doc.setTextColor(79, 70, 229); // indigo-600
      doc.text(periodLabel, 140, y + 13);

      // Summary KPI Stat Cards
      y = 64;
      const cardW = (pageWidth - 20 - 9) / 4;
      
      // Card 1: Total Net Work Hours
      doc.setFillColor(238, 242, 255); // indigo-50
      doc.rect(10, y, cardW, 16, 'F');
      doc.setDrawColor(199, 210, 254);
      doc.rect(10, y, cardW, 16, 'D');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(67, 56, 202);
      doc.text('TOTAL NET HOURS', 13, y + 5);
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text(`${timesheetStats.totalWorkHours.toFixed(1)} hrs`, 13, y + 12);

      // Card 2: Total Working Shifts
      doc.setFillColor(240, 253, 244); // emerald-50
      doc.rect(10 + cardW + 3, y, cardW, 16, 'F');
      doc.setDrawColor(187, 247, 208);
      doc.rect(10 + cardW + 3, y, cardW, 16, 'D');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(21, 128, 61);
      doc.text('TOTAL WORK SHIFTS', 13 + cardW + 3, y + 5);
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      doc.text(`${timesheetStats.workShiftsCount} shifts`, 13 + cardW + 3, y + 12);

      // Card 3: Break Time
      doc.setFillColor(254, 243, 199); // amber-50
      doc.rect(10 + (cardW + 3) * 2, y, cardW, 16, 'F');
      doc.setDrawColor(253, 230, 138);
      doc.rect(10 + (cardW + 3) * 2, y, cardW, 16, 'D');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(180, 83, 9);
      doc.text('TOTAL UNPAID BREAKS', 13 + (cardW + 3) * 2, y + 5);
      doc.setFontSize(12);
      doc.setTextColor(15, 23, 42);
      const breakHrs = (timesheetStats.totalBreakMinutes / 60).toFixed(1);
      doc.text(`${breakHrs} hrs (${timesheetStats.totalBreakMinutes}m)`, 13 + (cardW + 3) * 2, y + 12);

      // Card 4: Days Off & Sick Leave
      doc.setFillColor(241, 245, 249); // slate-100
      doc.rect(10 + (cardW + 3) * 3, y, cardW, 16, 'F');
      doc.setDrawColor(203, 213, 225);
      doc.rect(10 + (cardW + 3) * 3, y, cardW, 16, 'D');
      doc.setFontSize(7);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(71, 85, 105);
      doc.text('DAYS OFF & SICK LEAVE', 13 + (cardW + 3) * 3, y + 5);
      doc.setFontSize(11);
      doc.setTextColor(15, 23, 42);
      const leaveText = timesheetStats.sickLeaveCount > 0 
        ? `${timesheetStats.daysOffCount} Off • ${timesheetStats.sickLeaveCount} Sick` 
        : `${timesheetStats.daysOffCount} days`;
      doc.text(leaveText, 13 + (cardW + 3) * 3, y + 12);

      // Timesheet Table Header
      y = 86;
      doc.setFillColor(15, 23, 42);
      doc.rect(10, y, pageWidth - 20, 8, 'F');
      
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(7.5);
      doc.setTextColor(255, 255, 255);
      doc.text('DATE / DAY', 13, y + 5.5);
      doc.text('SHIFT TITLE / ROLE', 45, y + 5.5);
      doc.text('WORKPLACE', 88, y + 5.5);
      doc.text('HOURS & TIMING', 125, y + 5.5);
      doc.text('BREAK', 158, y + 5.5);
      doc.text('NET WORK', 178, y + 5.5);

      // Draw Rows
      y = 98;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);

      if (filteredShifts.length === 0) {
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(148, 163, 184);
        doc.text('No shifts found matching the selected period or filters.', 14, y);
        y += 10;
      } else {
        filteredShifts.forEach((shift, index) => {
          const shiftSick = isSickLeave(shift);
          const shiftOff = isDayOff(shift);
          const netHrs = getShiftDurationHours(shift.startTime, shift.endTime, Number(shift.unpaidBreakMinutes ?? 30));
          const breakMins = Number(shift.unpaidBreakMinutes ?? 30);
          
          const sDate = new Date(shift.date);
          const dayName = sDate.toLocaleDateString('en-GB', { weekday: 'short' });
          const formattedDate = `${dayName}, ${sDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}`;

          // Page overflow check
          if (y > 248) {
            doc.addPage();
            // Re-draw border
            doc.setLineWidth(0.8);
            doc.setDrawColor(15, 23, 42);
            doc.rect(8, 8, pageWidth - 16, pageHeight - 16);

            // Table mini-header on next page
            y = 15;
            doc.setFillColor(15, 23, 42);
            doc.rect(10, y, pageWidth - 20, 7, 'F');
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(7.5);
            doc.setTextColor(255, 255, 255);
            doc.text('DATE / DAY', 13, y + 5);
            doc.text('SHIFT TITLE / ROLE', 45, y + 5);
            doc.text('WORKPLACE', 88, y + 5);
            doc.text('HOURS & TIMING', 125, y + 5);
            doc.text('BREAK', 158, y + 5);
            doc.text('NET WORK', 178, y + 5);
            y += 10;
          }

          // Background row striping
          if (shiftSick) {
            doc.setFillColor(255, 241, 242); // light rose for sick leave
            doc.rect(10, y - 4, pageWidth - 20, 6.5, 'F');
          } else if (shiftOff) {
            doc.setFillColor(240, 253, 244); // light green for day off
            doc.rect(10, y - 4, pageWidth - 20, 6.5, 'F');
          } else if (index % 2 === 1) {
            doc.setFillColor(248, 250, 252);
            doc.rect(10, y - 4, pageWidth - 20, 6.5, 'F');
          }

          // Date
          doc.setFont('helvetica', 'bold');
          doc.setTextColor(15, 23, 42);
          doc.text(formattedDate, 13, y);

          if (shiftSick) {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(190, 18, 60); // rose-700
            doc.text('SICK LEAVE (MEDICAL ABSENCE)', 45, y);
            
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 116, 139);
            doc.text('-', 88, y);
            doc.text('Medical Leave', 125, y);
            doc.text('-', 158, y);
            doc.text('0.0h', 178, y);
          } else if (shiftOff) {
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(22, 101, 52); // green-800
            doc.text('DAY OFF (REST DAY)', 45, y);
            
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(100, 116, 139);
            doc.text('-', 88, y);
            doc.text('Off Duty', 125, y);
            doc.text('-', 158, y);
            doc.text('0.0h', 178, y);
          } else {
            // Title
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(15, 23, 42);
            const truncatedTitle = shift.title.length > 25 ? shift.title.substring(0, 22) + '...' : shift.title;
            doc.text(truncatedTitle, 45, y);

            // Workplace
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(71, 85, 105);
            const empName = shift.employerName || '-';
            const truncatedEmp = empName.length > 22 ? empName.substring(0, 19) + '...' : empName;
            doc.text(truncatedEmp, 88, y);

            // Timings
            doc.setFont('helvetica', 'normal');
            doc.setTextColor(15, 23, 42);
            doc.text(`${shift.startTime} – ${shift.endTime}`, 125, y);

            // Break
            doc.setTextColor(100, 116, 139);
            doc.text(`${breakMins}m`, 158, y);

            // Net Hours
            doc.setFont('helvetica', 'bold');
            doc.setTextColor(15, 23, 42);
            doc.text(`${netHrs.toFixed(1)} hrs`, 178, y);
          }

          // Notes if enabled and present
          if (includeNotes && shift.notes && shift.notes.trim()) {
            y += 4;
            doc.setFont('helvetica', 'italic');
            doc.setFontSize(7);
            doc.setTextColor(100, 116, 139);
            const cleanNote = `Duty Note: ${shift.notes.trim()}`;
            const truncatedNote = cleanNote.length > 95 ? cleanNote.substring(0, 92) + '...' : cleanNote;
            doc.text(truncatedNote, 45, y);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'normal');
          }

          y += 6.5;
        });
      }

      // Total summary line
      y += 2;
      doc.setDrawColor(15, 23, 42);
      doc.setLineWidth(0.5);
      doc.line(10, y, pageWidth - 10, y);
      y += 5;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text('TOTAL VERIFIED WORKING HOURS:', 100, y);
      doc.setTextColor(79, 70, 229);
      doc.setFontSize(11);
      doc.text(`${timesheetStats.totalWorkHours.toFixed(1)} HOURS`, 165, y);

      // Sign-off verification box
      if (includeSignatureBox) {
        y += 10;
        if (y > 240) {
          doc.addPage();
          doc.setLineWidth(0.8);
          doc.setDrawColor(15, 23, 42);
          doc.rect(8, 8, pageWidth - 16, pageHeight - 16);
          y = 20;
        }

        doc.setFillColor(248, 250, 252);
        doc.rect(10, y, pageWidth - 20, 28, 'F');
        doc.setDrawColor(203, 213, 225);
        doc.rect(10, y, pageWidth - 20, 28, 'D');

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(7.5);
        doc.setTextColor(100, 116, 139);
        doc.text('TIMESHEET VERIFICATION & APPROVAL SIGN-OFF', 14, y + 6);

        // Employee Signature Line
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.setTextColor(15, 23, 42);
        doc.text('Employee Signature: _______________________', 14, y + 16);
        doc.text('Date: _______________', 14, y + 23);

        // Supervisor Signature Line
        doc.text('Supervisor / Manager Approval: _______________________', 105, y + 16);
        doc.text('Date: _______________', 105, y + 23);
      }

      // Footer
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.text('Verified Employee Timesheet • Generated securely with exact shift timings and attendance logs.', 10, 285);
      doc.text(`Page 1 of ${doc.getNumberOfPages()}`, 185, 285);

      const fileName = `Timesheet_${employeeName.replace(/\s+/g, '_')}_${periodLabel.replace(/\s+/g, '_')}.pdf`;
      doc.save(fileName);
      showNotification('Timesheet Exported', { body: `PDF Timesheet successfully saved: ${fileName}` });
    } catch (err: any) {
      console.error('Failed to export timesheet PDF', err);
      alert('Error exporting PDF timesheet: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // ==========================================
  // 2. EXPORT AS DETAILED PNG IMAGE
  // ==========================================
  const handleExportPNG = () => {
    try {
      setIsExporting(true);
      if (filteredShifts.length === 0) {
        alert('No shifts found for this timesheet period!');
        return;
      }

      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Could not initialize canvas context');

      const width = 1000;
      const headerH = 120;
      const metaH = 80;
      const statsH = 90;
      const rowH = includeNotes ? 65 : 48;
      const tableH = filteredShifts.length * rowH + 60;
      const signH = includeSignatureBox ? 130 : 0;
      const footerH = 60;
      const totalH = headerH + metaH + statsH + tableH + signH + footerH;

      const scale = 2; // High DPI crisp
      canvas.width = width * scale;
      canvas.height = totalH * scale;
      ctx.scale(scale, scale);

      // Background
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, totalH);

      // Border
      ctx.lineWidth = 4;
      ctx.strokeStyle = '#0f172a';
      ctx.strokeRect(10, 10, width - 20, totalH - 20);

      // Header Block
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(20, 20, width - 40, 90);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 22px system-ui, -apple-system, sans-serif';
      ctx.fillText('OFFICIAL EMPLOYEE WORK TIMESHEET', 40, 58);

      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 12px monospace';
      ctx.fillText('ATTENDANCE, SHIFT TIMINGS & BREAK LOG (NO PRIVATE RATES INCLUDED)', 40, 85);

      // Employee Metadata Box
      let curY = 125;
      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(20, curY, width - 40, 65);
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#e2e8f0';
      ctx.strokeRect(20, curY, width - 40, 65);

      ctx.fillStyle = '#64748b';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.fillText('EMPLOYEE NAME', 40, curY + 22);
      ctx.fillText('WORKPLACE / EMPLOYER', 360, curY + 22);
      ctx.fillText('TIMESHEET PERIOD', 680, curY + 22);

      ctx.fillStyle = '#0f172a';
      ctx.font = '900 15px system-ui, sans-serif';
      ctx.fillText(employeeName || 'Aneesh Dallakoti', 40, curY + 45);
      ctx.fillText(selectedEmployer === 'ALL' ? 'All Workplaces' : selectedEmployer, 360, curY + 45);
      
      ctx.fillStyle = '#4f46e5';
      ctx.fillText(periodLabel, 680, curY + 45);

      // Stats KPI Cards
      curY = 205;
      const cardW = (width - 40 - 30) / 4;

      // Box 1: Total Hours
      ctx.fillStyle = '#eef2ff';
      ctx.fillRect(20, curY, cardW, 70);
      ctx.strokeStyle = '#c7d2fe';
      ctx.strokeRect(20, curY, cardW, 70);
      ctx.fillStyle = '#4338ca';
      ctx.font = '900 10px monospace';
      ctx.fillText('TOTAL NET HOURS', 35, curY + 24);
      ctx.fillStyle = '#0f172a';
      ctx.font = '900 20px monospace';
      ctx.fillText(`${timesheetStats.totalWorkHours.toFixed(1)} hrs`, 35, curY + 54);

      // Box 2: Work Shifts
      ctx.fillStyle = '#f0fdf4';
      ctx.fillRect(20 + cardW + 10, curY, cardW, 70);
      ctx.strokeStyle = '#bbf7d0';
      ctx.strokeRect(20 + cardW + 10, curY, cardW, 70);
      ctx.fillStyle = '#15803d';
      ctx.font = '900 10px monospace';
      ctx.fillText('TOTAL WORK SHIFTS', 35 + cardW + 10, curY + 24);
      ctx.fillStyle = '#0f172a';
      ctx.font = '900 20px monospace';
      ctx.fillText(`${timesheetStats.workShiftsCount} shifts`, 35 + cardW + 10, curY + 54);

      // Box 3: Total Breaks
      ctx.fillStyle = '#fef3c7';
      ctx.fillRect(20 + (cardW + 10) * 2, curY, cardW, 70);
      ctx.strokeStyle = '#fde68a';
      ctx.strokeRect(20 + (cardW + 10) * 2, curY, cardW, 70);
      ctx.fillStyle = '#b45309';
      ctx.font = '900 10px monospace';
      ctx.fillText('UNPAID BREAKS', 35 + (cardW + 10) * 2, curY + 24);
      ctx.fillStyle = '#0f172a';
      ctx.font = '900 20px monospace';
      ctx.fillText(`${(timesheetStats.totalBreakMinutes / 60).toFixed(1)}h (${timesheetStats.totalBreakMinutes}m)`, 35 + (cardW + 10) * 2, curY + 54);

      // Box 4: Days Off & Sick Leave
      ctx.fillStyle = '#f1f5f9';
      ctx.fillRect(20 + (cardW + 10) * 3, curY, cardW, 70);
      ctx.strokeStyle = '#cbd5e1';
      ctx.strokeRect(20 + (cardW + 10) * 3, curY, cardW, 70);
      ctx.fillStyle = '#475569';
      ctx.font = '900 10px monospace';
      ctx.fillText('DAYS OFF & SICK LEAVE', 35 + (cardW + 10) * 3, curY + 24);
      ctx.fillStyle = '#0f172a';
      ctx.font = '900 16px monospace';
      const canvasLeaveText = timesheetStats.sickLeaveCount > 0
        ? `${timesheetStats.daysOffCount} Off • ${timesheetStats.sickLeaveCount} Sick`
        : `${timesheetStats.daysOffCount} days`;
      ctx.fillText(canvasLeaveText, 35 + (cardW + 10) * 3, curY + 54);

      // Table Header
      curY = 295;
      ctx.fillStyle = '#0f172a';
      ctx.fillRect(20, curY, width - 40, 36);

      ctx.fillStyle = '#ffffff';
      ctx.font = '900 11px system-ui, sans-serif';
      ctx.fillText('DATE / DAY', 35, curY + 23);
      ctx.fillText('SHIFT TITLE / ROLE', 200, curY + 23);
      ctx.fillText('WORKPLACE', 450, curY + 23);
      ctx.fillText('TIMING (START – END)', 630, curY + 23);
      ctx.fillText('BREAK', 810, curY + 23);
      ctx.fillText('NET WORK', 890, curY + 23);

      // Table Rows
      curY = 331;
      filteredShifts.forEach((shift, index) => {
        const shiftSick = isSickLeave(shift);
        const shiftOff = isDayOff(shift);
        const netHrs = getShiftDurationHours(shift.startTime, shift.endTime, Number(shift.unpaidBreakMinutes ?? 30));
        const breakMins = Number(shift.unpaidBreakMinutes ?? 30);
        const sDate = new Date(shift.date);
        const dayStr = sDate.toLocaleDateString('en-GB', { weekday: 'short', day: '2-digit', month: 'short' });

        // Stripe
        if (shiftSick) {
          ctx.fillStyle = '#fff1f2';
          ctx.fillRect(20, curY, width - 40, rowH);
        } else if (shiftOff) {
          ctx.fillStyle = '#ecfdf5';
          ctx.fillRect(20, curY, width - 40, rowH);
        } else if (index % 2 === 1) {
          ctx.fillStyle = '#f8fafc';
          ctx.fillRect(20, curY, width - 40, rowH);
        }

        // Date
        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.fillText(dayStr, 35, curY + 25);

        if (shiftSick) {
          ctx.fillStyle = '#be123c';
          ctx.font = '900 12px system-ui, sans-serif';
          ctx.fillText('🤒 SICK LEAVE (MEDICAL ABSENCE)', 200, curY + 25);
          ctx.fillStyle = '#64748b';
          ctx.font = 'normal 11px monospace';
          ctx.fillText('-', 450, curY + 25);
          ctx.fillText('Medical Leave', 630, curY + 25);
          ctx.fillText('-', 810, curY + 25);
          ctx.fillText('0.0h', 890, curY + 25);
        } else if (shiftOff) {
          ctx.fillStyle = '#166534';
          ctx.font = '900 12px system-ui, sans-serif';
          ctx.fillText('🌴 DAY OFF (REST DAY)', 200, curY + 25);
          ctx.fillStyle = '#64748b';
          ctx.font = 'normal 11px monospace';
          ctx.fillText('-', 450, curY + 25);
          ctx.fillText('Off Duty', 630, curY + 25);
          ctx.fillText('-', 810, curY + 25);
          ctx.fillText('0.0h', 890, curY + 25);
        } else {
          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 12px system-ui, sans-serif';
          ctx.fillText(shift.title, 200, curY + 25);

          ctx.fillStyle = '#475569';
          ctx.font = 'normal 11px system-ui, sans-serif';
          ctx.fillText(shift.employerName || '-', 450, curY + 25);

          ctx.fillStyle = '#0f172a';
          ctx.font = 'bold 12px monospace';
          ctx.fillText(`${shift.startTime} – ${shift.endTime}`, 630, curY + 25);

          ctx.fillStyle = '#64748b';
          ctx.font = 'normal 11px monospace';
          ctx.fillText(`${breakMins}m`, 810, curY + 25);

          ctx.fillStyle = '#0f172a';
          ctx.font = '900 13px monospace';
          ctx.fillText(`${netHrs.toFixed(1)} hrs`, 890, curY + 25);
        }

        // Notes row
        if (includeNotes && shift.notes && shift.notes.trim()) {
          ctx.fillStyle = '#64748b';
          ctx.font = 'italic 10px system-ui, sans-serif';
          ctx.fillText(`Duty Note: ${shift.notes.trim()}`, 200, curY + 44);
        }

        curY += rowH;
      });

      // Signature Box
      if (includeSignatureBox) {
        curY += 15;
        ctx.fillStyle = '#f8fafc';
        ctx.fillRect(20, curY, width - 40, 100);
        ctx.strokeStyle = '#cbd5e1';
        ctx.strokeRect(20, curY, width - 40, 100);

        ctx.fillStyle = '#64748b';
        ctx.font = 'bold 10px system-ui, sans-serif';
        ctx.fillText('TIMESHEET VERIFICATION & APPROVAL SIGN-OFF', 40, curY + 22);

        ctx.fillStyle = '#0f172a';
        ctx.font = 'bold 12px system-ui, sans-serif';
        ctx.fillText('Employee Signature: _______________________________', 40, curY + 55);
        ctx.fillText('Date: _______________', 40, curY + 80);

        ctx.fillText('Supervisor / Manager Approval: _______________________________', 520, curY + 55);
        ctx.fillText('Date: _______________', 520, curY + 80);

        curY += 100;
      }

      // Footer
      curY += 25;
      ctx.fillStyle = '#94a3b8';
      ctx.font = 'bold 10px system-ui, sans-serif';
      ctx.fillText('OFFICIAL EMPLOYEE TIMESHEET LOG • GENERATED ACCURATELY FOR PAYROLL & ATTENDANCE VERIFICATION', 40, curY);

      const fileName = `Timesheet_${employeeName.replace(/\s+/g, '_')}_${periodLabel.replace(/\s+/g, '_')}.png`;
      const link = document.createElement('a');
      link.download = fileName;
      link.href = canvas.toDataURL('image/png');
      link.click();
      showNotification('PNG Timesheet Exported', { body: `Image timesheet downloaded: ${fileName}` });
    } catch (err: any) {
      console.error('Failed to export timesheet PNG', err);
      alert('Could not export PNG timesheet: ' + err.message);
    } finally {
      setIsExporting(false);
    }
  };

  // ==========================================
  // 3. EXPORT AS CSV / EXCEL SPREADSHEET
  // ==========================================
  const handleExportCSV = () => {
    try {
      const headers = ['Date', 'Day', 'Employee Name', 'Shift Title', 'Workplace / Employer', 'Start Time', 'End Time', 'Break (Minutes)', 'Net Working Hours', 'Status', 'Duty Notes'];
      const rows = filteredShifts.map(s => {
        const sDate = new Date(s.date);
        const dayName = sDate.toLocaleDateString('en-GB', { weekday: 'long' });
        const shiftSick = isSickLeave(s);
        const shiftOff = isDayOff(s);
        const netHrs = getShiftDurationHours(s.startTime, s.endTime, Number(s.unpaidBreakMinutes ?? 30));

        return [
          s.date,
          dayName,
          `"${employeeName.replace(/"/g, '""')}"`,
          shiftSick ? '"Sick Leave (Medical Absence)"' : shiftOff ? '"Day Off (Rest Day)"' : `"${(s.title || '').replace(/"/g, '""')}"`,
          `"${(s.employerName || '-').replace(/"/g, '""')}"`,
          (shiftSick || shiftOff) ? '00:00' : s.startTime,
          (shiftSick || shiftOff) ? '00:00' : s.endTime,
          (shiftSick || shiftOff) ? 0 : Number(s.unpaidBreakMinutes ?? 30),
          (shiftSick || shiftOff) ? '0.00' : netHrs.toFixed(2),
          shiftSick ? 'Sick Leave' : shiftOff ? 'Day Off' : (s.completed ? 'Completed' : 'Scheduled'),
          `"${(s.notes || '').replace(/"/g, '""')}"`
        ];
      });

      // Total Row
      const leaveSummary = `${timesheetStats.workShiftsCount} Work Shifts, ${timesheetStats.daysOffCount} Days Off${timesheetStats.sickLeaveCount > 0 ? `, ${timesheetStats.sickLeaveCount} Sick Days` : ''}`;
      rows.push([
        'TOTALS',
        '',
        '',
        leaveSummary,
        '',
        '',
        '',
        `${timesheetStats.totalBreakMinutes} mins`,
        timesheetStats.totalWorkHours.toFixed(2),
        '',
        ''
      ]);

      const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement('a');
      link.setAttribute('href', encodedUri);
      const fileName = `Timesheet_${employeeName.replace(/\s+/g, '_')}_${periodLabel.replace(/\s+/g, '_')}.csv`;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      showNotification('CSV Exported', { body: `Timesheet CSV downloaded: ${fileName}` });
    } catch (err: any) {
      alert('Failed to export CSV: ' + err.message);
    }
  };

  // ==========================================
  // 4. COPY CLEAN FORMATTED TEXT FOR WHATSAPP/EMAIL
  // ==========================================
  const handleCopyText = () => {
    let text = `📋 *WORK TIMESHEET & SHIFT LOG*\n`;
    text += `👤 *Employee:* ${employeeName}\n`;
    text += `🏢 *Workplace:* ${selectedEmployer === 'ALL' ? 'All Workplaces' : selectedEmployer}\n`;
    text += `📅 *Period:* ${periodLabel}\n`;
    text += `⏱️ *Total Net Hours:* ${timesheetStats.totalWorkHours.toFixed(1)} hrs (${timesheetStats.workShiftsCount} work shifts)\n`;
    text += `☕ *Total Breaks:* ${(timesheetStats.totalBreakMinutes / 60).toFixed(1)} hrs\n`;
    text += `🌴 *Days Off:* ${timesheetStats.daysOffCount} days\n`;
    if (timesheetStats.sickLeaveCount > 0) {
      text += `🤒 *Sick Leave:* ${timesheetStats.sickLeaveCount} days\n`;
    }
    text += `------------------------------------\n\n`;

    filteredShifts.forEach(s => {
      const sDate = new Date(s.date);
      const dayName = sDate.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
      const shiftSick = isSickLeave(s);
      const shiftOff = isDayOff(s);

      if (shiftSick) {
        text += `🤒 *${dayName}:* SICK LEAVE (Medical Absence)\n`;
      } else if (shiftOff) {
        text += `🌴 *${dayName}:* DAY OFF (Rest Day)\n`;
      } else {
        const netHrs = getShiftDurationHours(s.startTime, s.endTime, Number(s.unpaidBreakMinutes ?? 30));
        text += `💼 *${dayName}:* ${s.title} (${s.startTime} - ${s.endTime})\n`;
        text += `   ⏳ Net: ${netHrs.toFixed(1)} hrs | Break: ${s.unpaidBreakMinutes ?? 30}m\n`;
        if (s.employerName) text += `   🏢 Location: ${s.employerName}\n`;
        if (s.notes && s.notes.trim()) text += `   📝 Note: ${s.notes.trim()}\n`;
      }
      text += `\n`;
    });

    text += `------------------------------------\n`;
    text += `✅ *Grand Total:* ${timesheetStats.totalWorkHours.toFixed(1)} working hours verified.`;

    navigator.clipboard.writeText(text);
    setCopiedText(true);
    setTimeout(() => setCopiedText(false), 3000);
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 z-50 animate-fade-in overflow-y-auto">
      <div className="bg-white border-4 border-slate-900 rounded-3xl max-w-4xl w-full max-h-[92vh] flex flex-col shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] overflow-hidden my-auto">
        
        {/* MODAL HEADER */}
        <div className="bg-slate-900 text-white p-4 sm:p-5 flex items-center justify-between border-b-4 border-slate-900 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 bg-indigo-500 text-white rounded-2xl border-2 border-white flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(255,255,255,1)] shrink-0">
              <Briefcase className="w-6 h-6 stroke-[2.5]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg sm:text-xl font-black font-display tracking-tight text-white uppercase">
                  Official Employer Timesheet Export
                </h2>
                <span className="text-[10px] font-mono font-black uppercase bg-indigo-400 text-slate-950 px-2 py-0.5 rounded border border-white">
                  No Wages / Hourly Rates
                </span>
              </div>
              <p className="text-xs text-slate-300 font-medium">
                Generate professional attendance & work hour reports ready for your boss, HR & payroll
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 bg-slate-800 hover:bg-slate-700 text-white rounded-xl border-2 border-white transition cursor-pointer"
            title="Close modal"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>

        {/* MODAL CONTENT BODY */}
        <div className="p-4 sm:p-6 overflow-y-auto space-y-6 flex-1 bg-slate-50/50">

          {/* PRIVACY NOTICE BANNER */}
          <div className="bg-emerald-50 border-3 border-emerald-900 rounded-2xl p-3.5 flex items-center gap-3 text-xs text-emerald-950 shadow-[3px_3px_0px_0px_rgba(6,78,59,1)]">
            <ShieldCheck className="w-6 h-6 text-emerald-700 shrink-0 stroke-[2.5]" />
            <div>
              <span className="font-black font-display uppercase tracking-wide block text-emerald-900">
                🔒 Privacy Guaranteed for Employer Sharing:
              </span>
              <p className="font-medium text-emerald-900/90 leading-relaxed">
                This export <strong>strictly excludes</strong> your private hourly rates, wage earnings, and financial accounts. It contains only official attendance, shift timings, break durations, and verified working hours.
              </p>
            </div>
          </div>

          {/* CONFIGURATION CONTROLS */}
          <div className="bg-white border-3 border-slate-900 rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] space-y-4">
            <h3 className="text-sm font-black font-display uppercase tracking-wide text-slate-900 flex items-center gap-2">
              <Filter className="w-4 h-4 text-indigo-600 stroke-[2.5]" />
              <span>Timesheet Configuration & Filters</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
              
              {/* Employee Full Name */}
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-900 font-mono">Employee Full Name</label>
                <input
                  type="text"
                  value={employeeName}
                  onChange={(e) => setEmployeeName(e.target.value)}
                  placeholder="e.g. Aneesh Dallakoti"
                  className="w-full p-2.5 bg-white border-2 border-slate-900 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Employer / Workplace Filter */}
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-900 font-mono flex items-center justify-between">
                  <span>Workplace / Employer</span>
                  {uniqueEmployers.length > 0 && <span className="text-[10px] text-slate-500">({uniqueEmployers.length} found)</span>}
                </label>
                <select
                  value={selectedEmployer}
                  onChange={(e) => setSelectedEmployer(e.target.value)}
                  className="w-full p-2.5 bg-white border-2 border-slate-900 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="ALL">🏢 All Workplaces ({shifts.length} shifts)</option>
                  {uniqueEmployers.map(emp => (
                    <option key={emp} value={emp}>🏢 {emp}</option>
                  ))}
                </select>
              </div>

              {/* Period Type */}
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-900 font-mono">Time Period</label>
                <select
                  value={periodType}
                  onChange={(e) => setPeriodType(e.target.value as any)}
                  className="w-full p-2.5 bg-white border-2 border-slate-900 rounded-xl text-xs font-bold text-slate-900 focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="week">📅 Current Week (Mon - Sun)</option>
                  <option value="month">🗓️ Specific Month</option>
                  <option value="custom">⏱️ Custom Date Range</option>
                  <option value="all">📁 All Recorded Shifts</option>
                </select>
              </div>

              {/* Month Picker if month selected */}
              {periodType === 'month' && (
                <div className="space-y-1 sm:col-span-2 md:col-span-3">
                  <label className="text-xs font-black text-slate-900 font-mono">Select Month</label>
                  <input
                    type="month"
                    value={selectedMonth}
                    onChange={(e) => setSelectedMonth(e.target.value)}
                    className="w-full p-2.5 bg-white border-2 border-slate-900 rounded-xl text-xs font-bold font-mono text-slate-900"
                  />
                </div>
              )}

              {/* Custom Date Range if custom selected */}
              {periodType === 'custom' && (
                <div className="grid grid-cols-2 gap-2 sm:col-span-2 md:col-span-3">
                  <div className="space-y-1">
                    <label className="text-xs font-black text-slate-900 font-mono">Start Date</label>
                    <input
                      type="date"
                      value={customStartDate}
                      onChange={(e) => setCustomStartDate(e.target.value)}
                      className="w-full p-2.5 bg-white border-2 border-slate-900 rounded-xl text-xs font-bold font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-black text-slate-900 font-mono">End Date</label>
                    <input
                      type="date"
                      value={customEndDate}
                      onChange={(e) => setCustomEndDate(e.target.value)}
                      className="w-full p-2.5 bg-white border-2 border-slate-900 rounded-xl text-xs font-bold font-mono"
                    />
                  </div>
                </div>
              )}

            </div>

            {/* Checkbox Options */}
            <div className="flex flex-wrap items-center gap-4 pt-2 border-t-2 border-slate-100">
              <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeDaysOff}
                  onChange={(e) => setIncludeDaysOff(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 border-2 border-slate-900"
                />
                <span>🌴 Include Days Off (Rest Days)</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeNotes}
                  onChange={(e) => setIncludeNotes(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 border-2 border-slate-900"
                />
                <span>📝 Include Duty & Handover Notes</span>
              </label>

              <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeSignatureBox}
                  onChange={(e) => setIncludeSignatureBox(e.target.checked)}
                  className="w-4 h-4 rounded text-indigo-600 border-2 border-slate-900"
                />
                <span>✍️ Include Approval Sign-Off Block</span>
              </label>
            </div>

          </div>

          {/* LIVE TIMESHEET SUMMARY & PREVIEW */}
          <div className="bg-white border-3 border-slate-900 rounded-2xl p-4 sm:p-5 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] space-y-4">
            
            <div className="flex items-center justify-between border-b-2 border-slate-900 pb-3 flex-wrap gap-2">
              <div>
                <h3 className="text-sm font-black font-display uppercase tracking-wide text-slate-900 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
                  <span>Timesheet Live Summary & Breakdown</span>
                </h3>
                <p className="text-xs text-slate-500 font-mono font-bold">
                  {periodLabel} • {timesheetStats.totalEntries} total entries found
                </p>
              </div>

              <span className="text-xs font-mono font-black uppercase bg-indigo-100 text-indigo-950 px-2.5 py-1 rounded-xl border border-slate-900">
                Net Work: {timesheetStats.totalWorkHours.toFixed(1)} Hours
              </span>
            </div>

            {/* Metric KPI Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <div className="bg-indigo-50 border-2 border-slate-900 rounded-xl p-3 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                <span className="text-[10px] font-mono font-black uppercase text-indigo-900 block">Total Net Work</span>
                <span className="text-lg font-black font-mono text-indigo-950 block mt-0.5">
                  {timesheetStats.totalWorkHours.toFixed(1)} hrs
                </span>
                <span className="text-[10px] font-mono text-indigo-800 font-bold">
                  {timesheetStats.workShiftsCount} working shifts
                </span>
              </div>

              <div className="bg-emerald-50 border-2 border-slate-900 rounded-xl p-3 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                <span className="text-[10px] font-mono font-black uppercase text-emerald-900 block">Attendance</span>
                <span className="text-lg font-black font-mono text-emerald-950 block mt-0.5">
                  {timesheetStats.completedShiftsCount} / {timesheetStats.workShiftsCount}
                </span>
                <span className="text-[10px] font-mono text-emerald-800 font-bold">
                  Completed shifts
                </span>
              </div>

              <div className="bg-amber-50 border-2 border-slate-900 rounded-xl p-3 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                <span className="text-[10px] font-mono font-black uppercase text-amber-900 block">Unpaid Breaks</span>
                <span className="text-lg font-black font-mono text-amber-950 block mt-0.5">
                  {(timesheetStats.totalBreakMinutes / 60).toFixed(1)} hrs
                </span>
                <span className="text-[10px] font-mono text-amber-800 font-bold">
                  {timesheetStats.totalBreakMinutes} mins total
                </span>
              </div>

              <div className="bg-slate-100 border-2 border-slate-900 rounded-xl p-3 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                <span className="text-[10px] font-mono font-black uppercase text-slate-700 block">Days Off & Sick</span>
                <span className="text-lg font-black font-mono text-slate-950 block mt-0.5">
                  {timesheetStats.daysOffCount} {timesheetStats.sickLeaveCount > 0 ? `+ ${timesheetStats.sickLeaveCount} Sick` : 'days'}
                </span>
                <span className="text-[10px] font-mono text-slate-600 font-bold">
                  {timesheetStats.sickLeaveCount > 0 ? `${timesheetStats.daysOffCount} Off / ${timesheetStats.sickLeaveCount} Sick` : 'Scheduled rest'}
                </span>
              </div>
            </div>

            {/* Detailed Table Preview */}
            <div className="border-2 border-slate-900 rounded-xl overflow-hidden">
              <div className="max-h-56 overflow-y-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-900 text-white font-mono sticky top-0 uppercase text-[10px]">
                    <tr>
                      <th className="p-2.5">Date / Day</th>
                      <th className="p-2.5">Shift Title</th>
                      <th className="p-2.5">Workplace</th>
                      <th className="p-2.5">Timings</th>
                      <th className="p-2.5">Break</th>
                      <th className="p-2.5 text-right">Net Hours</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 font-medium">
                    {filteredShifts.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-slate-400 font-mono italic">
                          No shifts found for this selection.
                        </td>
                      </tr>
                    ) : (
                      filteredShifts.map((shift) => {
                        const shiftSick = isSickLeave(shift);
                        const shiftOff = isDayOff(shift);
                        const netHrs = getShiftDurationHours(shift.startTime, shift.endTime, Number(shift.unpaidBreakMinutes ?? 30));
                        const sDate = new Date(shift.date);
                        const dayName = sDate.toLocaleDateString('en-GB', { weekday: 'short' });

                        return (
                          <tr 
                            key={shift.id} 
                            className={
                              shiftSick 
                                ? 'bg-rose-50/80 text-rose-950 font-semibold' 
                                : shiftOff 
                                  ? 'bg-emerald-50/70' 
                                  : 'hover:bg-slate-50'
                            }
                          >
                            <td className="p-2.5 font-bold font-mono whitespace-nowrap">
                              {dayName}, {sDate.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })}
                            </td>
                            <td className="p-2.5 font-black text-slate-900">
                              {shiftSick ? (
                                <span className="flex items-center gap-1.5 text-rose-700">
                                  <HeartPulse className="w-3.5 h-3.5 text-rose-600 stroke-[2.5]" />
                                  <span>Sick Leave (Medical Absence)</span>
                                </span>
                              ) : shiftOff ? (
                                '🌴 Day Off (Rest Day)'
                              ) : (
                                shift.title
                              )}
                              {includeNotes && shift.notes && (
                                <span className="block text-[10px] text-slate-500 font-normal italic">
                                  Note: {shift.notes}
                                </span>
                              )}
                            </td>
                            <td className="p-2.5 font-mono text-slate-600">
                              {shift.employerName || '-'}
                            </td>
                            <td className="p-2.5 font-mono">
                              {shiftSick ? 'Medical Leave' : shiftOff ? 'Off Duty' : `${shift.startTime} – ${shift.endTime}`}
                            </td>
                            <td className="p-2.5 font-mono text-slate-500">
                              {(shiftSick || shiftOff) ? '-' : `${shift.unpaidBreakMinutes ?? 30}m`}
                            </td>
                            <td className="p-2.5 font-mono font-black text-right text-slate-950">
                              {(shiftSick || shiftOff) ? '0.0h' : `${netHrs.toFixed(1)}h`}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>

        </div>

        {/* MODAL ACTION BAR */}
        <div className="bg-slate-100 p-4 sm:p-5 border-t-4 border-slate-900 flex flex-wrap items-center justify-between gap-3 shrink-0">
          
          <div className="flex items-center gap-2">
            <button
              onClick={handleCopyText}
              className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-900 font-mono font-black text-xs uppercase rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[0.5px] cursor-pointer flex items-center gap-1.5"
              title="Copy clean timesheet text to clipboard for WhatsApp or Email"
            >
              {copiedText ? <Check className="w-4 h-4 text-emerald-600 stroke-[3]" /> : <Copy className="w-4 h-4 stroke-[2.5]" />}
              <span>{copiedText ? 'Copied to Clipboard!' : 'Copy for WhatsApp / Email'}</span>
            </button>
            
            <button
              onClick={handleExportCSV}
              className="px-3.5 py-2.5 bg-white hover:bg-slate-50 text-slate-900 font-mono font-black text-xs uppercase rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[0.5px] cursor-pointer flex items-center gap-1.5"
              title="Export as Excel / CSV spreadsheet"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 stroke-[2.5]" />
              <span>CSV Spreadsheet</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleExportPNG}
              disabled={isExporting}
              className="px-4 py-2.5 bg-amber-400 hover:bg-amber-500 text-slate-950 font-black text-xs uppercase rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[0.5px] cursor-pointer flex items-center gap-1.5"
              title="Export formatted Timesheet Image"
            >
              <Image className="w-4 h-4 stroke-[2.5]" />
              <span>PNG Timesheet</span>
            </button>

            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[0.5px] cursor-pointer flex items-center gap-2"
              title="Download official PDF Timesheet document"
            >
              <Download className="w-4 h-4 stroke-[3]" />
              <span>Download PDF Timesheet</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
}
