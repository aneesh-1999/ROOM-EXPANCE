import React, { useState } from 'react';
import { Roommate, Expense, Category } from '../types';
import { jsPDF } from 'jspdf';
import { 
  X, 
  FileText, 
  Download, 
  Search, 
  Filter, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  ArrowUpRight, 
  ArrowDownLeft, 
  DollarSign, 
  Coins 
} from 'lucide-react';

interface DetailedReportModalProps {
  expenses: Expense[];
  currentUser: Roommate;
  onClose: () => void;
  nicknames: Record<Roommate, string>;
}

type TypeFilter = 'all' | 'shared' | 'coins' | 'loans' | 'settlements';
type StatusFilter = 'all' | 'confirmed' | 'pending';
type DateFilter = 'all' | 'current-month' | 'last-month' | 'ytd' | 'custom';

export default function DetailedReportModal({ expenses, currentUser, onClose, nicknames }: DetailedReportModalProps) {
  // Filters
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [dateFilter, setDateFilter] = useState<DateFilter>('all');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [payerFilter, setPayerFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');

  const otherUser: Roommate = currentUser === 'Ozric' ? 'Pawan' : 'Ozric';
  const otherUserLabel = nicknames[otherUser] || otherUser;
  const currentUserLabel = nicknames[currentUser] || currentUser;

  // Format dates elegantly
  const formatDate = (timestamp: any) => {
    if (!timestamp) return 'No Date';
    try {
      const date = timestamp.seconds 
        ? new Date(timestamp.seconds * 1000) 
        : new Date(timestamp);
      return date.toLocaleDateString('en-IE', {
        day: '2-digit',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return 'No Date';
    }
  };

  // Filter processing
  const filteredExpenses = expenses.filter((exp) => {
    // 1. Search term match (Title or Notes)
    const matchesSearch = 
      exp.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (exp.notes && exp.notes.toLowerCase().includes(searchTerm.toLowerCase()));
    
    if (!matchesSearch) return false;

    // 2. Type Filter
    if (typeFilter === 'shared' && (exp.isCoin || exp.isLendBorrow || exp.isSettlement)) return false;
    if (typeFilter === 'coins' && !exp.isCoin) return false;
    if (typeFilter === 'loans' && !exp.isLendBorrow) return false;
    if (typeFilter === 'settlements' && !exp.isSettlement) return false;

    // 3. Status Filter
    if (statusFilter === 'confirmed' && exp.status === 'pending') return false;
    if (statusFilter === 'pending' && exp.status !== 'pending') return false;

    // 4. Date Filter
    if (dateFilter !== 'all') {
      const date = exp.timestamp?.seconds 
        ? new Date(exp.timestamp.seconds * 1000) 
        : new Date(exp.timestamp);
      const now = new Date();
      
      if (dateFilter === 'current-month') {
        if (date.getMonth() !== now.getMonth() || date.getFullYear() !== now.getFullYear()) return false;
      } else if (dateFilter === 'last-month') {
        const lastMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const lastMonthYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        if (date.getMonth() !== lastMonth || date.getFullYear() !== lastMonthYear) return false;
      } else if (dateFilter === 'ytd') {
        if (date.getFullYear() !== now.getFullYear()) return false;
      } else if (dateFilter === 'custom') {
        if (startDate) {
          const start = new Date(startDate);
          start.setHours(0, 0, 0, 0);
          if (date < start) return false;
        }
        if (endDate) {
          const end = new Date(endDate);
          end.setHours(23, 59, 59, 999);
          if (date > end) return false;
        }
      }
    }

    // 5. Payer Filter
    if (payerFilter !== 'all') {
      if (exp.paymentDistribution) {
        const amountPaid = payerFilter === 'Ozric' ? exp.paymentDistribution.OzricAmount : exp.paymentDistribution.PawanAmount;
        if ((amountPaid ?? 0) <= 0) return false;
      } else {
        if (exp.paidBy !== payerFilter) return false;
      }
    }

    // 6. Category Filter
    if (categoryFilter !== 'all' && exp.category !== categoryFilter) return false;

    return true;
  });

  // METRICS (BASED ON ALL CONFIRMED TRANSACTIONS IN FIREBASE)
  let totalConfirmedPawanOwesOzric = 0;
  let totalConfirmedOzricOwesPawan = 0;

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
      totalConfirmedPawanOwesOzric += pawanOwedDiff;
    } else if (pawanOwedDiff < 0) {
      totalConfirmedOzricOwesPawan += Math.abs(pawanOwedDiff);
    }
  });

  // Net standing (positive Pawan owes Ozric, negative Ozric owes Pawan)
  const netConfirmedBalance = totalConfirmedPawanOwesOzric - totalConfirmedOzricOwesPawan;

  // LEND/BORROW CONFIRMED STANDING
  let totalLent = 0;
  let totalBorrowed = 0;
  expenses.forEach((exp) => {
    if (!exp.isLendBorrow || exp.status === 'pending') return;
    const isCurrentUserPayer = exp.paidBy === currentUser;
    if (isCurrentUserPayer) {
      totalLent += exp.amount;
    } else {
      totalBorrowed += exp.amount;
    }
  });
  const netLendBorrowStanding = totalLent - totalBorrowed; // positive means other owes you, negative means you owe other

  // Household spend metrics (confirmed only)
  const totalSpendFiltered = filteredExpenses
    .filter(exp => !exp.isSettlement && !exp.isLendBorrow && exp.status !== 'pending')
    .reduce((sum, exp) => sum + exp.amount, 0);

  const totalCoinsFiltered = filteredExpenses
    .filter(exp => exp.isCoin && exp.status !== 'pending')
    .reduce((sum, exp) => sum + exp.amount, 0);

  // Generate and Download PDF using jsPDF
  const handleDownloadPDF = () => {
    const doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    const pageHeight = doc.internal.pageSize.height;
    const pageWidth = doc.internal.pageSize.width;
    let pageNum = 1;

    // Standard styling values
    const primaryColor = [15, 23, 42]; // Slate 900
    const secondaryColor = [79, 70, 229]; // Indigo 600
    const alertColor = [217, 119, 6]; // Amber 600
    const softBg = [248, 250, 252]; // Slate 50
    const accentLine = [236, 72, 153]; // Pink 500

    // Header drawing function
    const drawPageHeader = (pageNumber: number) => {
      // Background Accent Line
      doc.setFillColor(accentLine[0], accentLine[1], accentLine[2]);
      doc.rect(15, 12, pageWidth - 30, 1.5, 'F');

      // Title
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(16);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('ROOMMATE FINANCIAL ENGINE STATEMENT', 15, 20);

      // Subtitle
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139); // Slate 500
      const nowStr = new Date().toLocaleString('en-IE', { 
        day: '2-digit', 
        month: 'short', 
        year: 'numeric', 
        hour: '2-digit', 
        minute: '2-digit' 
      });
      doc.text(`Generated by: ${currentUserLabel}  |  Date: ${nowStr}  |  Page ${pageNumber}`, 15, 25);

      // Solid divider
      doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setLineWidth(0.6);
      doc.line(15, 28, pageWidth - 15, 28);
    };

    // Draw page footer
    const drawPageFooter = (pageNumber: number) => {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184); // Slate 400
      doc.text('CONFIDENTIAL • FOR HOUSEHOLD REFERENCE ONLY', 15, pageHeight - 12);
      doc.text(`Page ${pageNumber}`, pageWidth - 25, pageHeight - 12);
      
      // Fine footer divider
      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.3);
      doc.line(15, pageHeight - 16, pageWidth - 15, pageHeight - 16);
    };

    // Start with page 1 header
    drawPageHeader(pageNum);

    // 1. SUMMARY CARDS & STANDINGS (Page 1)
    doc.setFillColor(softBg[0], softBg[1], softBg[2]);
    doc.rect(15, 34, pageWidth - 30, 28, 'F');
    doc.setDrawColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.setLineWidth(0.8);
    doc.rect(15, 34, pageWidth - 30, 28, 'S');

    // Net Roommate Standing Text
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(secondaryColor[0], secondaryColor[1], secondaryColor[2]);
    doc.text('HOUSEHOLD STANDINGS (CONFIRMED BALANCE)', 19, 40);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    
    let balanceText = '';
    if (netConfirmedBalance === 0) {
      balanceText = `You and ${otherUserLabel} are fully settled up!`;
    } else {
      const pawanNick = nicknames.Pawan;
      const ozricNick = nicknames.Ozric;
      if (netConfirmedBalance > 0) {
        balanceText = `${pawanNick} owes ${ozricNick} €${netConfirmedBalance.toFixed(2)} for shared expenses`;
      } else {
        balanceText = `${ozricNick} owes ${pawanNick} €${Math.abs(netConfirmedBalance).toFixed(2)} for shared expenses`;
      }
    }
    doc.text(balanceText, 19, 46);

    // Direct Cash Loan text
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    let loanText = '';
    if (netLendBorrowStanding === 0) {
      loanText = 'No active direct cash loans / transfers pending.';
    } else if (netLendBorrowStanding > 0) {
      loanText = `Direct Cash Loan: ${otherUserLabel} owes you €${netLendBorrowStanding.toFixed(2)} directly`;
    } else {
      loanText = `Direct Cash Loan: You owe ${otherUserLabel} €${Math.abs(netLendBorrowStanding).toFixed(2)} directly`;
    }
    doc.text(loanText, 19, 52);

    // Filter status text
    let dateFilterLabel = dateFilter.toUpperCase();
    if (dateFilter === 'custom') {
      const startFormatted = startDate ? new Date(startDate).toLocaleDateString('en-IE', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Start';
      const endFormatted = endDate ? new Date(endDate).toLocaleDateString('en-IE', { day: '2-digit', month: 'short', year: 'numeric' }) : 'End';
      dateFilterLabel = `CUSTOM (${startFormatted} - ${endFormatted})`;
    }
    const activeFilters = `Active Filters -> Date: ${dateFilterLabel} | Type: ${typeFilter.toUpperCase()} | Status: ${statusFilter.toUpperCase()} | Payer: ${payerFilter === 'all' ? 'ALL' : nicknames[payerFilter as Roommate] || payerFilter}`;
    doc.setFont('helvetica', 'italic');
    doc.setFontSize(8);
    doc.setTextColor(156, 163, 175);
    doc.text(activeFilters, 19, 58);

    // Metrics Row below summary
    let y = 72;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('STATEMENT FINANCIAL SUMMARY', 15, y);
    
    y += 5;
    doc.setLineWidth(0.4);
    doc.line(15, y, pageWidth - 15, y);

    y += 6;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text('TOTAL HOUSEHOLD BILLS LOGGED', 15, y);
    doc.text('COIN INSERTIONS DETECTED', 85, y);
    doc.text('TOTAL TRANSACTIONS RETRIEVED', 150, y);

    y += 5;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text(`€${totalSpendFiltered.toFixed(2)}`, 15, y);
    doc.text(`€${totalCoinsFiltered.toFixed(2)}`, 85, y);
    doc.text(`${filteredExpenses.length} Items`, 150, y);

    // Draw the main Ledger Table Header
    y += 12;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.text('DETAILED LEDGER ENTRIES', 15, y);

    y += 5;
    // Table Header rect
    doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
    doc.rect(15, y, pageWidth - 30, 8, 'F');
    doc.setLineWidth(0.5);
    doc.rect(15, y, pageWidth - 30, 8, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(255, 255, 255);
    doc.text('Date', 18, y + 5.5);
    doc.text('Title / Notes', 38, y + 5.5);
    doc.text('Category', 95, y + 5.5);
    doc.text('Paid By', 135, y + 5.5);
    doc.text('Status', 160, y + 5.5);
    doc.text('Amount', 180, y + 5.5);

    y += 8;

    // Loop through expenses and draw table rows
    filteredExpenses.forEach((exp) => {
      // Check if we need to pagination
      const rowHeight = 12; // Base row height, might adjust if we have notes
      if (y + rowHeight > pageHeight - 25) {
        // Draw footer of current page before shifting
        drawPageFooter(pageNum);
        
        // Add page
        doc.addPage();
        pageNum += 1;
        y = 35;
        
        // Header for new page
        drawPageHeader(pageNum);

        // Sub header rect on next page
        doc.setFillColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.rect(15, y, pageWidth - 30, 8, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(8);
        doc.setTextColor(255, 255, 255);
        doc.text('Date', 18, y + 5.5);
        doc.text('Title / Notes', 38, y + 5.5);
        doc.text('Category', 95, y + 5.5);
        doc.text('Paid By', 135, y + 5.5);
        doc.text('Status', 160, y + 5.5);
        doc.text('Amount', 180, y + 5.5);
        y += 8;
      }

      // Draw subtle alternating background
      if (y % 2 === 0) {
        doc.setFillColor(252, 253, 254);
        doc.rect(15, y, pageWidth - 30, rowHeight, 'F');
      }
      doc.setDrawColor(241, 245, 249);
      doc.setLineWidth(0.3);
      doc.line(15, y + rowHeight, pageWidth - 15, y + rowHeight);

      // Render cells
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);

      // Column 1: Date
      const dateStr = formatDate(exp.timestamp);
      doc.text(dateStr, 18, y + 5);

      // Column 2: Title and notes wrapped
      const titleText = exp.title;
      const notesText = exp.notes ? `(${exp.notes})` : '';
      let descCombined = titleText;
      if (notesText) {
        descCombined += ` ${notesText}`;
      }
      const splitDesc = doc.splitTextToSize(descCombined, 52);
      doc.text(splitDesc, 38, y + 5);

      // Column 3: Category
      const catText = exp.isSettlement ? 'Settlement' : (exp.isLendBorrow ? 'Loan Transfer' : exp.category);
      doc.text(catText, 95, y + 5);

      // Column 4: Paid By
      let payerLabel = nicknames[exp.paidBy] || exp.paidBy;
      if (exp.paymentDistribution) {
        if (exp.paymentDistribution.OzricAmount > 0 && exp.paymentDistribution.PawanAmount > 0) {
          payerLabel = 'Shared';
        } else if (exp.paymentDistribution.OzricAmount > 0) {
          payerLabel = nicknames.Ozric;
        } else {
          payerLabel = nicknames.Pawan;
        }
      }
      doc.text(payerLabel, 135, y + 5);

      // Column 5: Status
      const isPending = exp.status === 'pending';
      if (isPending) {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(alertColor[0], alertColor[1], alertColor[2]);
        doc.text('ON HOLD', 160, y + 5);
      } else {
        doc.setFont('helvetica', 'normal');
        doc.setTextColor(16, 185, 129); // Emerald 500
        doc.text('CONFIRMED', 160, y + 5);
      }
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.setFont('helvetica', 'normal');

      // Column 6: Amount
      doc.setFont('courier', 'bold');
      doc.text(`EUR ${exp.amount.toFixed(2)}`, 180, y + 5);

      y += rowHeight;
    });

    // Draw footer of the final page
    drawPageFooter(pageNum);

    // Save PDF
    const safeDate = new Date().toISOString().split('T')[0];
    doc.save(`roommate_statement_${safeDate}.pdf`);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white border-4 border-slate-900 rounded-3xl w-full max-w-4xl shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] overflow-hidden my-auto flex flex-col max-h-[92vh]">
        {/* HEADER */}
        <div className="p-5 border-b-4 border-slate-100 flex items-center justify-between bg-indigo-50/25">
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 bg-indigo-100 text-indigo-600 rounded-2xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
              <FileText className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-lg font-black tracking-tight text-slate-900">Detailed Financial Report</h3>
              <p className="text-xs text-slate-500 font-medium font-sans">Filter, inspect, and export complete roommate ledgers to PDF</p>
            </div>
          </div>
          <button 
            id="btn-close-detailed-report"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 border-2 border-slate-200 hover:border-slate-900 transition duration-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CONTROLS BAR */}
        <div className="p-5 border-b-2 border-slate-100 bg-slate-50 flex flex-col gap-4">
          {/* Row 1: Search & PDF button */}
          <div className="flex flex-col sm:flex-row gap-3 items-stretch justify-between">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                id="report-search"
                type="text"
                placeholder="Search description, notes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border-2 border-slate-900 rounded-xl font-medium text-xs focus:ring-2 focus:ring-indigo-500 focus:outline-none"
              />
            </div>
            
            <button
              id="btn-download-pdf-report"
              onClick={handleDownloadPDF}
              className="bg-indigo-600 text-white hover:bg-indigo-700 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] px-4 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 cursor-pointer transition-all hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]"
            >
              <Download className="w-4 h-4" /> Download Statement PDF
            </button>
          </div>

          {/* Row 2: Grid of Filters */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5">
            {/* Filter Date */}
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Calendar className="w-3 h-3" /> Timeframe
              </label>
              <select
                id="filter-date-select"
                value={dateFilter}
                onChange={(e) => setDateFilter(e.target.value as DateFilter)}
                className="w-full bg-white border-2 border-slate-900 rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none"
              >
                <option value="all">All Time</option>
                <option value="current-month">Current Month</option>
                <option value="last-month">Last Month</option>
                <option value="ytd">Year to Date (YTD)</option>
                <option value="custom">Custom Date Range</option>
              </select>
            </div>

            {/* Filter Type */}
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Filter className="w-3 h-3" /> Type
              </label>
              <select
                id="filter-type-select"
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value as TypeFilter)}
                className="w-full bg-white border-2 border-slate-900 rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none"
              >
                <option value="all">All Types</option>
                <option value="shared">Shared Bills</option>
                <option value="coins">Coins Logged</option>
                <option value="loans">Direct Loans</option>
                <option value="settlements">Settlements</option>
              </select>
            </div>

            {/* Filter Status */}
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Clock className="w-3 h-3" /> Status
              </label>
              <select
                id="filter-status-select"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
                className="w-full bg-white border-2 border-slate-900 rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none"
              >
                <option value="all">All Status</option>
                <option value="confirmed">Confirmed Only</option>
                <option value="pending">On Hold (Pending)</option>
              </select>
            </div>

            {/* Filter Payer */}
            <div className="space-y-1">
              <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <DollarSign className="w-3 h-3" /> Payer
              </label>
              <select
                id="filter-payer-select"
                value={payerFilter}
                onChange={(e) => setPayerFilter(e.target.value)}
                className="w-full bg-white border-2 border-slate-900 rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none"
              >
                <option value="all">Everyone</option>
                <option value="Ozric">{nicknames.Ozric}</option>
                <option value="Pawan">{nicknames.Pawan}</option>
              </select>
            </div>

            {/* Filter Category */}
            <div className="space-y-1 col-span-2 md:col-span-1">
              <label className="text-[9px] font-black uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <Coins className="w-3 h-3" /> Category
              </label>
              <select
                id="filter-category-select"
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="w-full bg-white border-2 border-slate-900 rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none"
              >
                <option value="all">All Categories</option>
                <option value="Rent">Rent</option>
                <option value="Electricity (Coins)">Electricity (Coins)</option>
                <option value="Shared Groceries">Shared Groceries</option>
                <option value="Household Supplies">Household Supplies</option>
                <option value="Internet/Wi-Fi">Internet/Wi-Fi</option>
                <option value="Takeout/Delivery">Takeout/Delivery</option>
                <option value="Other">Other</option>
              </select>
            </div>
          </div>

          {/* Custom Date Inputs */}
          {dateFilter === 'custom' && (
            <div className="bg-white border-2 border-slate-900 p-3.5 rounded-2xl flex flex-col sm:flex-row items-center gap-3.5 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] animate-fade-in mt-1">
              <div className="flex-1 w-full space-y-1">
                <label className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                  Start Date (From)
                </label>
                <input
                  id="report-custom-start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-900 rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div className="text-slate-400 font-bold text-xs self-end pb-2 hidden sm:block">to</div>

              <div className="flex-1 w-full space-y-1">
                <label className="text-[9px] font-black uppercase tracking-wider text-slate-500">
                  End Date (To)
                </label>
                <input
                  id="report-custom-end-date"
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-900 rounded-xl px-2.5 py-1.5 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              {/* Clear dates button */}
              {(startDate || endDate) && (
                <button
                  id="btn-clear-custom-dates"
                  onClick={() => {
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="self-end pb-1.5 px-3 py-1.5 border border-slate-300 hover:border-slate-900 rounded-lg text-[10px] font-bold text-slate-500 hover:text-slate-900 cursor-pointer transition-colors"
                >
                  Clear Range
                </button>
              )}
            </div>
          )}
        </div>

        {/* LEDGER CONTENT TABLE */}
        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Quick statement snapshot boxes */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="bg-indigo-50 border-2 border-slate-900 p-4 rounded-2xl shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
              <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block mb-1">Filtered Shared Total</span>
              <p className="text-xl font-black font-mono text-slate-900">€{totalSpendFiltered.toFixed(2)}</p>
              <span className="text-[10px] text-slate-500 font-bold">Household bills sum</span>
            </div>

            <div className="bg-pink-50 border-2 border-slate-900 p-4 rounded-2xl shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
              <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block mb-1">Electricity Coins</span>
              <p className="text-xl font-black font-mono text-slate-900">€{totalCoinsFiltered.toFixed(2)}</p>
              <span className="text-[10px] text-slate-500 font-bold">Total meter coin deposits</span>
            </div>

            <div className="bg-amber-50 border-2 border-slate-900 p-4 rounded-2xl shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
              <span className="text-[9px] text-slate-500 font-black uppercase tracking-wider block mb-1">Direct Loans Balance</span>
              <p className="text-xl font-black font-mono text-slate-900">
                {netLendBorrowStanding === 0 ? '€0.00' : `€${Math.abs(netLendBorrowStanding).toFixed(2)}`}
              </p>
              <span className="text-[10px] text-slate-500 font-bold">
                {netLendBorrowStanding === 0 
                  ? 'All settled up' 
                  : netLendBorrowStanding > 0 
                    ? `${otherUserLabel} owes you directly` 
                    : `You owe ${otherUserLabel} directly`
                }
              </span>
            </div>
          </div>

          {/* Ledger Table */}
          <div className="bg-white border-3 border-slate-900 rounded-2xl overflow-hidden shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-slate-900 text-white text-[10px] font-black uppercase tracking-wider border-b-2 border-slate-900">
                    <th className="px-4 py-3.5">Date</th>
                    <th className="px-4 py-3.5">Title & Notes</th>
                    <th className="px-4 py-3.5">Category</th>
                    <th className="px-4 py-3.5">Paid By</th>
                    <th className="px-4 py-3.5 text-center">Status</th>
                    <th className="px-4 py-3.5 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y-2 divide-slate-100 text-xs font-sans">
                  {filteredExpenses.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-10 text-center text-slate-500 font-medium">
                        No transactions found matching the selected filters. Try adjusting them.
                      </td>
                    </tr>
                  ) : (
                    filteredExpenses.map((exp) => {
                      const isPending = exp.status === 'pending';
                      return (
                        <tr 
                          key={exp.id} 
                          className={`hover:bg-slate-50/50 transition-colors ${
                            isPending ? 'bg-amber-50/35' : ''
                          }`}
                        >
                          <td className="px-4 py-3.5 font-bold font-mono text-slate-500 whitespace-nowrap">
                            {formatDate(exp.timestamp)}
                          </td>
                          <td className="px-4 py-3.5">
                            <p className="font-black text-slate-900">{exp.title}</p>
                            {exp.notes && (
                              <p className="text-[10px] text-slate-500 font-medium mt-0.5 max-w-xs">{exp.notes}</p>
                            )}
                          </td>
                          <td className="px-4 py-3.5">
                            <span className="px-2.5 py-1 rounded-lg border border-slate-200 bg-slate-50 text-[10px] font-black uppercase tracking-wider text-slate-600">
                              {exp.isSettlement ? 'Settlement' : (exp.isLendBorrow ? 'Direct Loan' : exp.category)}
                            </span>
                          </td>
                          <td className="px-4 py-3.5 font-bold text-slate-800">
                            {exp.paymentDistribution ? (
                              exp.paymentDistribution.OzricAmount > 0 && exp.paymentDistribution.PawanAmount > 0 ? (
                                <div className="text-xs">
                                  <div>{nicknames.Ozric}: <span className="font-mono font-black">€{exp.paymentDistribution.OzricAmount.toFixed(2)}</span></div>
                                  <div>{nicknames.Pawan}: <span className="font-mono font-black">€{exp.paymentDistribution.PawanAmount.toFixed(2)}</span></div>
                                </div>
                              ) : exp.paymentDistribution.OzricAmount > 0 ? (
                                `${nicknames.Ozric} (€${exp.paymentDistribution.OzricAmount.toFixed(2)})`
                              ) : (
                                `${nicknames.Pawan} (€${exp.paymentDistribution.PawanAmount.toFixed(2)})`
                              )
                            ) : (
                              nicknames[exp.paidBy] || exp.paidBy
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-center">
                            {isPending ? (
                              <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider text-amber-700 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-md">
                                <Clock className="w-3 h-3 shrink-0" /> On Hold
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider text-emerald-700 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-md">
                                <CheckCircle2 className="w-3 h-3 shrink-0" /> Confirmed
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3.5 text-right font-black font-mono text-slate-950">
                            €{exp.amount.toFixed(2)}
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

        {/* FOOTER */}
        <div className="p-5 border-t-4 border-slate-100 bg-slate-50 flex items-center justify-between">
          <p className="text-[10px] text-slate-500 font-bold">
            Showing <strong className="text-slate-900">{filteredExpenses.length}</strong> of <strong className="text-slate-900">{expenses.length}</strong> total transactions
          </p>
          <button
            id="btn-close-report-modal-footer"
            onClick={onClose}
            className="px-5 py-2.5 bg-slate-200 hover:bg-slate-300 text-slate-900 border-2 border-slate-900 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer"
          >
            Close Report
          </button>
        </div>
      </div>
    </div>
  );
}
