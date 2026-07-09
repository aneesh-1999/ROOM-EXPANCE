import React, { useState, useEffect, useMemo } from 'react';
import { 
  PersonalAccount, 
  PersonalTransaction, 
  SavingsGoal, 
  RecurringBill, 
  Roommate,
  PersonalAccountType,
  PersonalTxType
} from '../types';
import { 
  subscribeAccounts, 
  subscribeTransactions, 
  subscribeSavingsGoals, 
  subscribeRecurringBills, 
  addAccount, 
  addTransaction, 
  deleteTransaction, 
  addSavingsGoal, 
  contributeToSavingsGoal, 
  deleteSavingsGoal, 
  addRecurringBill, 
  deleteRecurringBill, 
  payRecurringBill 
} from '../personalFinanceService';
import { 
  Wallet, 
  CreditCard, 
  Coins, 
  Plus, 
  Trash2, 
  Search, 
  Filter, 
  Calendar as CalendarIcon, 
  ArrowLeftRight, 
  Download, 
  Sparkles, 
  Check, 
  Clock, 
  Goal, 
  Bell, 
  FileText, 
  Camera, 
  Send, 
  Lock, 
  ShieldCheck, 
  Info,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  DollarSign,
  AlertTriangle,
  RefreshCw,
  X,
  UploadCloud
} from 'lucide-react';

interface PersonalFinanceProps {
  currentUser: Roommate;
  isUnlocked: boolean;
  onPromptUnlock: () => void;
  onBackToWorkspace: () => void;
  nicknames: Record<Roommate, string>;
  profiles: Record<Roommate, { id: Roommate; avatar?: string; accentColor?: string; nickname?: string }>;
}

const EXCHANGE_RATES = {
  EUR: 1.0,
  NPR: 142.50, // 1 EUR = 142.50 NPR
  USD: 1.09,   // 1 EUR = 1.09 USD
};

const PERSONAL_CATEGORIES = [
  'Food & Cafes',
  'Groceries',
  'Cinema & Entertainment',
  'Shopping',
  'Fuel & Transport',
  'Nepal Remittance',
  'Salary/Earnings',
  'Mobile & Subscriptions',
  'Rent & Personal Utilities',
  'Savings Contribution',
  'Other Discretionary'
];

export default function PersonalFinance({ 
  currentUser, 
  isUnlocked, 
  onPromptUnlock, 
  onBackToWorkspace,
  nicknames, 
  profiles 
}: PersonalFinanceProps) {
  // Database States
  const [accounts, setAccounts] = useState<PersonalAccount[]>([]);
  const [transactions, setTransactions] = useState<PersonalTransaction[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [recurringBills, setRecurringBills] = useState<RecurringBill[]>([]);

  // Subscriptions management
  useEffect(() => {
    if (!isUnlocked) return;

    const unsubAccounts = subscribeAccounts(currentUser, (data) => setAccounts(data));
    const unsubTx = subscribeTransactions(currentUser, (data) => setTransactions(data));
    const unsubGoals = subscribeSavingsGoals(currentUser, (data) => setSavingsGoals(data));
    const unsubBills = subscribeRecurringBills(currentUser, (data) => setRecurringBills(data));

    return () => {
      unsubAccounts();
      unsubTx();
      unsubGoals();
      unsubBills();
    };
  }, [currentUser, isUnlocked]);

  // Tab State
  const [activeSection, setActiveSection] = useState<'dashboard' | 'transactions' | 'savings' | 'recurring'>('dashboard');

  // Input states for new items
  const [isAddTxOpen, setIsAddTxOpen] = useState(false);
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [isAddGoalOpen, setIsAddGoalOpen] = useState(false);
  const [isAddBillOpen, setIsAddBillOpen] = useState(false);

  // New Transaction Form state
  const [txTitle, setTxTitle] = useState('');
  const [txAmount, setTxAmount] = useState('');
  const [txType, setTxType] = useState<PersonalTxType>('expense');
  const [txCategory, setTxCategory] = useState(PERSONAL_CATEGORIES[0]);
  const [txAccountId, setTxAccountId] = useState('');
  const [txNotes, setTxNotes] = useState('');
  const [txCurrency, setTxCurrency] = useState<'EUR' | 'NPR' | 'USD'>('EUR');
  const [txTags, setTxTags] = useState('');
  const [receiptBase64, setReceiptBase64] = useState<string | null>(null);
  const [receiptName, setReceiptName] = useState<string | null>(null);

  // New Account Form state
  const [accName, setAccName] = useState('');
  const [accType, setAccType] = useState<PersonalAccountType>('Cash');
  const [accBalance, setAccBalance] = useState('');
  const [accCurrency, setAccCurrency] = useState<'EUR' | 'NPR' | 'USD'>('EUR');

  // New Savings Goal Form state
  const [goalName, setGoalName] = useState('');
  const [goalTarget, setGoalTarget] = useState('');
  const [goalCurrent, setGoalCurrent] = useState('0');
  const [goalCurrency, setGoalCurrency] = useState<'EUR' | 'NPR' | 'USD'>('EUR');
  const [goalDeadline, setGoalDeadline] = useState('');
  const [goalNotes, setGoalNotes] = useState('');

  // New Recurring Bill Form state
  const [billName, setBillName] = useState('');
  const [billAmount, setBillAmount] = useState('');
  const [billCategory, setBillCategory] = useState(PERSONAL_CATEGORIES[0]);
  const [billDueDate, setBillDueDate] = useState('5');
  const [billFrequency, setBillFrequency] = useState<'Monthly' | 'Weekly' | 'Yearly'>('Monthly');
  const [billCurrency, setBillCurrency] = useState<'EUR' | 'NPR' | 'USD'>('EUR');
  const [billNotes, setBillNotes] = useState('');

  // Transaction Search & Filtering states
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | PersonalTxType>('all');
  const [filterCategory, setFilterCategory] = useState('all');
  const [filterAccount, setFilterAccount] = useState('all');

  // Savings Goal quick contribution modal state
  const [selectedGoalForContribution, setSelectedGoalForContribution] = useState<SavingsGoal | null>(null);
  const [contribAmount, setContribAmount] = useState('');
  const [contribAccountId, setContribAccountId] = useState('');

  // Currency Converter Quick Calculator Widget State
  const [convAmount, setConvAmount] = useState('100');
  const [convFrom, setConvFrom] = useState<'EUR' | 'NPR' | 'USD'>('EUR');
  const [convTo, setConvTo] = useState<'EUR' | 'NPR' | 'USD'>('NPR');

  // Automatically select first account if available
  useEffect(() => {
    if (accounts.length > 0 && !txAccountId) {
      setTxAccountId(accounts[0].id);
    }
  }, [accounts, txAccountId]);

  // Convert given currency to EUR equivalent
  const convertToEUR = (amount: number, from: 'EUR' | 'NPR' | 'USD'): number => {
    const rate = EXCHANGE_RATES[from];
    return amount / rate;
  };

  // Convert EUR to target currency
  const convertFromEUR = (amountInEUR: number, to: 'EUR' | 'NPR' | 'USD'): number => {
    const rate = EXCHANGE_RATES[to];
    return amountInEUR * rate;
  };

  // Total balance in EUR
  const totalNetWorthEUR = useMemo(() => {
    return accounts.reduce((sum, acc) => {
      const valueInEUR = convertToEUR(acc.balance, acc.currency);
      return sum + valueInEUR;
    }, 0);
  }, [accounts]);

  // Stats - Income vs Expense this month
  const personalStats = useMemo(() => {
    let income = 0;
    let expense = 0;
    let remittance = 0;

    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();

    transactions.forEach((tx) => {
      const txDate = new Date(tx.timestamp);
      if (txDate.getMonth() === currentMonth && txDate.getFullYear() === currentYear) {
        const amtEUR = convertToEUR(tx.amount, tx.currency);
        if (tx.type === 'income') {
          income += amtEUR;
        } else if (tx.type === 'expense') {
          expense += amtEUR;
        } else if (tx.type === 'remittance') {
          remittance += amtEUR;
        }
      }
    });

    return { income, expense, remittance };
  }, [transactions]);

  // Category summary for charting
  const categorySummary = useMemo(() => {
    const summary: Record<string, number> = {};
    transactions.forEach((tx) => {
      if (tx.type === 'expense') {
        const amtEUR = convertToEUR(tx.amount, tx.currency);
        summary[tx.category] = (summary[tx.category] || 0) + amtEUR;
      }
    });

    return Object.entries(summary)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [transactions]);

  // Filtered transactions for Transaction Ledger tab
  const filteredTransactions = useMemo(() => {
    return transactions.filter((tx) => {
      const matchesSearch = tx.title.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            tx.notes?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                            tx.tags.some(t => t.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesType = filterType === 'all' || tx.type === filterType;
      const matchesCategory = filterCategory === 'all' || tx.category === filterCategory;
      const matchesAccount = filterAccount === 'all' || tx.accountId === filterAccount;

      return matchesSearch && matchesType && matchesCategory && matchesAccount;
    });
  }, [transactions, searchQuery, filterType, filterCategory, filterAccount]);

  // Format currency output
  const renderCurrency = (amount: number, curr: 'EUR' | 'NPR' | 'USD' = 'EUR') => {
    if (curr === 'EUR') {
      return new Intl.NumberFormat('en-IE', { style: 'currency', currency: 'EUR' }).format(amount);
    } else if (curr === 'NPR') {
      return `रू ${new Intl.NumberFormat('en-NP').format(Math.round(amount))}`;
    } else {
      return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
    }
  };

  // Convert Currency Converter Calculator values
  const computedConversion = useMemo(() => {
    const amt = parseFloat(convAmount);
    if (isNaN(amt) || amt <= 0) return 0;
    const baseInEUR = convertToEUR(amt, convFrom);
    return convertFromEUR(baseInEUR, convTo);
  }, [convAmount, convFrom, convTo]);

  // Handle Receipt Mock Upload file selection
  const handleReceiptChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setReceiptName(file.name);
      const reader = new FileReader();
      reader.onloadend = () => {
        setReceiptBase64(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  // ---------------------------------------------
  // FORM SUBMISSION ACTIONS
  // ---------------------------------------------

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim() || !accBalance) return;

    try {
      await addAccount({
        user: currentUser,
        name: accName.trim(),
        type: accType,
        balance: parseFloat(accBalance),
        currency: accCurrency
      });

      // Reset
      setAccName('');
      setAccBalance('');
      setIsAddAccountOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateTransaction = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!txTitle.trim() || !txAmount || !txAccountId) return;

    const sourceAccount = accounts.find(a => a.id === txAccountId);
    if (!sourceAccount) return;

    try {
      const amountNum = parseFloat(txAmount);
      const tagsArray = txTags.split(',').map(t => t.trim()).filter(t => t !== '');

      await addTransaction({
        user: currentUser,
        title: txTitle.trim(),
        amount: amountNum,
        type: txType,
        category: txCategory,
        accountId: txAccountId,
        tags: tagsArray,
        notes: txNotes.trim(),
        currency: txCurrency,
        exchangeRate: EXCHANGE_RATES[txCurrency],
        receiptUrl: receiptBase64 || undefined,
        receiptName: receiptName || undefined
      }, sourceAccount);

      // Reset
      setTxTitle('');
      setTxAmount('');
      setTxNotes('');
      setTxTags('');
      setReceiptBase64(null);
      setReceiptName(null);
      setIsAddTxOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteTransaction = async (tx: PersonalTransaction) => {
    const sourceAccount = accounts.find(a => a.id === tx.accountId);
    if (!sourceAccount) return;

    if (window.confirm(`Are you sure you want to delete "${tx.title}"? Your account balance will be reverted.`)) {
      try {
        await deleteTransaction(tx, sourceAccount);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleCreateSavingsGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalName.trim() || !goalTarget || !goalDeadline) return;

    try {
      await addSavingsGoal({
        user: currentUser,
        name: goalName.trim(),
        targetAmount: parseFloat(goalTarget),
        currentAmount: parseFloat(goalCurrent || '0'),
        currency: goalCurrency,
        deadline: goalDeadline,
        notes: goalNotes.trim()
      });

      setGoalName('');
      setGoalTarget('');
      setGoalCurrent('0');
      setGoalDeadline('');
      setGoalNotes('');
      setIsAddGoalOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleContributeGoalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedGoalForContribution || !contribAmount || !contribAccountId) return;

    const sourceAccount = accounts.find(a => a.id === contribAccountId);
    if (!sourceAccount) return;

    try {
      const amountNum = parseFloat(contribAmount);
      await contributeToSavingsGoal(selectedGoalForContribution, amountNum, sourceAccount);

      setSelectedGoalForContribution(null);
      setContribAmount('');
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteSavingsGoal = async (id: string) => {
    if (window.confirm("Are you sure you want to delete this savings goal?")) {
      try {
        await deleteSavingsGoal(id);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handleCreateRecurringBill = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!billName.trim() || !billAmount) return;

    try {
      await addRecurringBill({
        user: currentUser,
        name: billName.trim(),
        amount: parseFloat(billAmount),
        category: billCategory,
        dueDate: parseInt(billDueDate),
        frequency: billFrequency,
        currency: billCurrency,
        reminderActive: true,
        notes: billNotes.trim()
      });

      setBillName('');
      setBillAmount('');
      setBillNotes('');
      setIsAddBillOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleDeleteRecurringBill = async (id: string) => {
    if (window.confirm("Are you sure you want to remove this recurring payment entry?")) {
      try {
        await deleteRecurringBill(id);
      } catch (err) {
        console.error(err);
      }
    }
  };

  const handlePayBill = async (bill: RecurringBill, sourceAccountId: string) => {
    const account = accounts.find(a => a.id === sourceAccountId);
    if (!account) return;

    const todayStr = new Date().toISOString().split('T')[0];
    if (window.confirm(`Deduct ${renderCurrency(bill.amount, bill.currency)} from ${account.name} and mark "${bill.name}" as paid for this month?`)) {
      try {
        await payRecurringBill(bill, account, todayStr);
      } catch (err) {
        console.error(err);
      }
    }
  };

  // CSV Report Export Generator
  const handleExportCSV = () => {
    if (transactions.length === 0) {
      alert("No transactions logged to export!");
      return;
    }

    const headers = ['Date', 'Title', 'Type', 'Category', 'Account', 'Amount', 'Currency', 'Notes', 'Tags'];
    const rows = transactions.map((tx) => {
      const accName = accounts.find(a => a.id === tx.accountId)?.name || 'Unknown Account';
      const formattedDate = new Date(tx.timestamp).toISOString().split('T')[0];
      return [
        formattedDate,
        `"${tx.title.replace(/"/g, '""')}"`,
        tx.type.toUpperCase(),
        tx.category,
        `"${accName.replace(/"/g, '""')}"`,
        tx.amount,
        tx.currency,
        `"${(tx.notes || '').replace(/"/g, '""')}"`,
        `"${tx.tags.join(', ')}"`
      ];
    });

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Personal_Finance_${currentUser}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // ---------------------------------------------
  // SECURITY LOCK GATEWAY
  // ---------------------------------------------
  if (!isUnlocked) {
    return (
      <div className="bg-white border-4 border-slate-900 rounded-[32px] p-8 md:p-12 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] text-center max-w-lg mx-auto my-12 space-y-6">
        <div className="inline-flex p-4 bg-rose-100 border-2 border-slate-900 text-rose-600 rounded-3xl shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
          <Lock className="w-10 h-10 stroke-[2.5]" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black text-slate-900 font-display uppercase tracking-tight">Privately Locked Panel</h2>
          <p className="text-xs text-slate-500 font-semibold leading-relaxed">
            Your personal finance data is 100% private and encrypted within your secure locked profile. Choose and unlock your roommate profile on the Ledger to view.
          </p>
        </div>

        <div className="pt-2">
          <button
            id="btn-personal-finance-auth"
            onClick={onPromptUnlock}
            className="w-full px-6 py-4 bg-indigo-600 hover:bg-indigo-700 text-white border-4 border-slate-900 rounded-[20px] font-black uppercase text-xs tracking-wider shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] cursor-pointer transition-all flex items-center justify-center gap-2"
          >
            <ShieldCheck className="w-4 h-4" />
            <span>Unlock Roommate Profile PIN</span>
          </button>
        </div>

        <div className="p-3 bg-indigo-50 border-2 border-slate-900 rounded-xl flex items-start gap-2.5 text-left text-[10px] text-slate-650 font-bold leading-normal">
          <Info className="w-4 h-4 text-indigo-600 shrink-0" />
          <span>Ozric and Pawan each have their own insulated personal records. Logging out or locking your screen prevents anyone else from viewing your metrics.</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-16">
      
      {/* HEADER SECTION WITH NAVIGATION */}
      <div className="bg-emerald-100 border-4 border-slate-900 rounded-[32px] p-6 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] flex flex-col md:flex-row items-center justify-between gap-6">
        <div className="flex items-center gap-4 text-center md:text-left">
          <div className="p-3 bg-white border-2 border-slate-900 rounded-2xl shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)] shrink-0 text-2xl">
            {profiles[currentUser]?.avatar || '👤'}
          </div>
          <div>
            <div className="flex items-center justify-center md:justify-start gap-1.5">
              <h2 className="text-xl font-black text-slate-900 font-display uppercase tracking-tight">{nicknames[currentUser] || currentUser}'s Private Vault</h2>
              <span className="px-2 py-0.5 bg-slate-900 text-emerald-400 text-[8px] font-mono font-black uppercase rounded border border-emerald-500 shadow-[1px_1px_0px_0px_rgba(16,185,129,1)]">
                Secure 100% Private
              </span>
            </div>
            <p className="text-[10px] text-slate-600 font-bold">Unshared assets, remittance histories, personal expenses, and saving benchmarks</p>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-center md:justify-end gap-2">
          <button
            id="btn-personal-back-workspace"
            onClick={onBackToWorkspace}
            className="px-4 py-2 bg-slate-900 text-white border-2 border-slate-900 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)] hover:bg-slate-850 transition cursor-pointer flex items-center gap-1.5"
          >
            <ArrowLeftRight className="w-3.5 h-3.5" />
            <span>Shared Workspace</span>
          </button>

          <button
            id="btn-export-csv"
            onClick={handleExportCSV}
            className="px-4 py-2 bg-white text-slate-900 border-2 border-slate-900 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)] hover:bg-slate-50 transition cursor-pointer flex items-center gap-1.5"
            title="Download Excel/CSV Report"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export Report</span>
          </button>
          
          <button
            id="btn-personal-add-tx"
            onClick={() => setIsAddTxOpen(true)}
            className="px-5 py-2.5 bg-pink-500 text-white border-2 border-slate-900 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)] hover:bg-pink-600 transition cursor-pointer flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4 stroke-[3px]" />
            <span>Add Entry</span>
          </button>
        </div>
      </div>

      {/* INNER VIEW SELECTOR BAR */}
      <div className="flex flex-wrap gap-2.5 bg-slate-100 p-1.5 border-3 border-slate-900 rounded-2xl shadow-[4px_4px_0px_0px_rgba(15,23,42,1)]">
        <button
          id="btn-subtab-dashboard"
          onClick={() => setActiveSection('dashboard')}
          className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5 ${
            activeSection === 'dashboard' 
              ? 'bg-slate-900 text-white shadow-sm border border-slate-950' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5" />
          <span>Stats &amp; Wallets</span>
        </button>
        <button
          id="btn-subtab-transactions"
          onClick={() => setActiveSection('transactions')}
          className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5 ${
            activeSection === 'transactions' 
              ? 'bg-slate-900 text-white shadow-sm border border-slate-950' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
          }`}
        >
          <FileText className="w-3.5 h-3.5" />
          <span>Private Ledger</span>
        </button>
        <button
          id="btn-subtab-savings"
          onClick={() => setActiveSection('savings')}
          className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5 ${
            activeSection === 'savings' 
              ? 'bg-slate-900 text-white shadow-sm border border-slate-950' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
          }`}
        >
          <Goal className="w-3.5 h-3.5" />
          <span>Savings Benchmarks</span>
        </button>
        <button
          id="btn-subtab-recurring"
          onClick={() => setActiveSection('recurring')}
          className={`flex-1 py-3 px-4 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer flex items-center justify-center gap-1.5 ${
            activeSection === 'recurring' 
              ? 'bg-slate-900 text-white shadow-sm border border-slate-950' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200'
          }`}
        >
          <CalendarIcon className="w-3.5 h-3.5" />
          <span>Recurring Bills Calendar</span>
        </button>
      </div>

      {/* ---------------------------------------------
          SUB-TAB A: OVERVIEW DASHBOARD & WALLETS
          --------------------------------------------- */}
      {activeSection === 'dashboard' && (
        <div className="space-y-8 animate-fade-in">
          
          {/* NET WORTH HEADER BANNER */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {/* Total Balance Card */}
            <div className="bg-white border-4 border-slate-900 p-6 rounded-3xl shadow-[5px_5px_0px_0px_rgba(15,23,42,1)] flex flex-col justify-between md:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-450 uppercase font-mono tracking-wider">Total Net Assets</span>
                <span className="p-1.5 bg-emerald-50 border border-emerald-200 text-emerald-650 rounded-lg">
                  <Wallet className="w-4 h-4" />
                </span>
              </div>
              <div className="mt-4">
                <h3 className="text-3xl font-black tracking-tight font-mono text-slate-900">{renderCurrency(totalNetWorthEUR, 'EUR')}</h3>
                <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase font-mono">Consolidated base currency (EUR)</p>
              </div>
              
              <div className="border-t border-slate-100 pt-3 mt-4 flex items-center justify-between text-[10px] font-mono">
                <span className="text-slate-500 font-bold">NPR Equivalent</span>
                <span className="text-slate-800 font-black">{renderCurrency(totalNetWorthEUR * EXCHANGE_RATES.NPR, 'NPR')}</span>
              </div>
            </div>

            {/* Income Expense Monthly Box */}
            <div className="bg-white border-4 border-slate-900 p-6 rounded-3xl shadow-[5px_5px_0px_0px_rgba(15,23,42,1)] md:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4 items-center">
              
              {/* Income */}
              <div className="space-y-1 pl-4 border-l-3 border-emerald-400">
                <div className="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono">
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
                  <span>Income This Month</span>
                </div>
                <h4 className="text-xl font-black font-mono text-slate-900">{renderCurrency(personalStats.income, 'EUR')}</h4>
                <p className="text-[9px] text-slate-400 font-bold">Earnings, Cashbacks &amp; Salary</p>
              </div>

              {/* Expense */}
              <div className="space-y-1 pl-4 border-l-3 border-rose-400">
                <div className="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono">
                  <TrendingDown className="w-3.5 h-3.5 text-rose-500" />
                  <span>Expense This Month</span>
                </div>
                <h4 className="text-xl font-black font-mono text-slate-900">{renderCurrency(personalStats.expense, 'EUR')}</h4>
                <p className="text-[9px] text-slate-400 font-bold">Private spending &amp; sub bills</p>
              </div>

              {/* Remittance Nepal */}
              <div className="space-y-1 pl-4 border-l-3 border-indigo-400">
                <div className="flex items-center gap-1 text-[9px] font-black text-slate-400 uppercase tracking-widest font-mono">
                  <Send className="w-3.5 h-3.5 text-indigo-500" />
                  <span>Nepal Remittance</span>
                </div>
                <h4 className="text-xl font-black font-mono text-slate-900">{renderCurrency(personalStats.remittance, 'EUR')}</h4>
                <p className="text-[9px] text-slate-400 font-bold">Transfers sent back home 🇳🇵</p>
              </div>

            </div>
          </div>

          {/* PERSONAL ACCOUNTS GRID */}
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b-2 border-slate-100 pb-2">
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight font-display flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-emerald-600" /> Account Portfolios
              </h4>
              
              <button
                id="btn-add-account-open"
                onClick={() => setIsAddAccountOpen(true)}
                className="px-3.5 py-1.5 bg-white text-slate-900 border-2 border-slate-900 rounded-xl text-[9px] font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:bg-slate-50 transition cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3px]" />
                <span>Create Wallet</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {accounts.map((acc) => {
                const isCash = acc.type === 'Cash';
                const isBank = acc.type === 'Bank Account';
                const isRevolut = acc.type === 'Revolut';
                const isWallet = acc.type === 'Digital Wallet';

                return (
                  <div 
                    key={acc.id} 
                    className={`border-4 border-slate-900 p-5 rounded-3xl shadow-[5px_5px_0px_0px_rgba(15,23,42,1)] flex flex-col justify-between hover:translate-y-[-2px] transition-all relative overflow-hidden ${
                      isCash ? 'bg-amber-50' : isBank ? 'bg-indigo-50' : isRevolut ? 'bg-rose-50' : 'bg-emerald-50'
                    }`}
                  >
                    {/* Tiny watermark for premium feel */}
                    <div className="absolute right-[-10px] bottom-[-10px] text-slate-900/5 font-mono text-4xl font-black select-none pointer-events-none uppercase">
                      {acc.type.split(' ')[0]}
                    </div>

                    <div className="flex items-center justify-between mb-4">
                      <div>
                        <h5 className="text-xs font-black text-slate-900 truncate max-w-[130px]">{acc.name}</h5>
                        <span className="text-[8px] font-mono font-black text-slate-400 uppercase tracking-wider">{acc.type}</span>
                      </div>

                      <span className={`p-1.5 rounded-lg border border-slate-900/20 ${
                        isCash ? 'bg-amber-100 text-amber-700' : isBank ? 'bg-indigo-100 text-indigo-700' : isRevolut ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {isCash ? (
                          <Coins className="w-4 h-4" />
                        ) : isBank ? (
                          <CreditCard className="w-4 h-4" />
                        ) : isRevolut ? (
                          <Wallet className="w-4 h-4" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-2xl font-black font-mono text-slate-900">
                        {renderCurrency(acc.balance, acc.currency)}
                      </h3>
                      {acc.currency !== 'EUR' && (
                        <p className="text-[9px] text-slate-500 font-mono mt-0.5">
                          ≈ {renderCurrency(convertToEUR(acc.balance, acc.currency), 'EUR')} EUR
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* TWO COLUMN ANALYTICS & WIDGETS SECTION */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            {/* Category spending bar chart list */}
            <div className="bg-white border-4 border-slate-900 rounded-[28px] p-5 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] lg:col-span-2 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
                <h5 className="text-xs font-black text-slate-900 uppercase tracking-tight font-display flex items-center gap-1.5">
                  <TrendingDown className="w-4 h-4 text-rose-600" /> Private Spending Distribution
                </h5>
                <span className="text-[8px] font-mono font-black text-slate-400 uppercase">This Month</span>
              </div>

              {categorySummary.length === 0 ? (
                <div className="py-12 text-center text-slate-400 text-xs font-semibold">
                  No personal transactions found. Log an expense above to view charts.
                </div>
              ) : (
                <div className="space-y-4.5">
                  {categorySummary.map((item, idx) => {
                    const maxVal = Math.max(...categorySummary.map(c => c.value), 1);
                    const percentOfMax = (item.value / maxVal) * 100;
                    const totalPersonalSpend = categorySummary.reduce((s, c) => s + c.value, 0);
                    const overallPercent = totalPersonalSpend > 0 ? (item.value / totalPersonalSpend) * 100 : 0;

                    return (
                      <div key={item.name} className="space-y-1.5">
                        <div className="flex items-center justify-between text-[10px] font-mono font-black text-slate-900">
                          <span className="truncate max-w-[200px]">{item.name}</span>
                          <div className="space-x-1.5 shrink-0">
                            <span className="text-slate-700">{renderCurrency(item.value, 'EUR')}</span>
                            <span className="text-slate-400 bg-slate-100 px-1 rounded text-[9px]">{overallPercent.toFixed(0)}%</span>
                          </div>
                        </div>

                        <div className="w-full bg-slate-100 h-3 rounded-lg border border-slate-200 overflow-hidden relative">
                          <div 
                            className="bg-indigo-500 h-full rounded-lg transition-all duration-500"
                            style={{ width: `${percentOfMax}%` }}
                          ></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* NPR Remittance Quick Conversion Helper */}
            <div className="bg-amber-100 border-4 border-slate-900 rounded-[28px] p-5 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] space-y-4">
              <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                <h5 className="text-xs font-black text-slate-900 uppercase tracking-tight font-display flex items-center gap-1.5">
                  <Send className="w-4 h-4 text-pink-600" /> Currency Quick Calculator
                </h5>
                <span className="text-[8px] font-mono font-black text-amber-700 bg-amber-200 px-1 rounded">Live Rates</span>
              </div>

              <div className="space-y-3 text-xs">
                {/* Amount input */}
                <div className="space-y-1">
                  <label className="text-[10px] font-bold text-slate-700 block uppercase font-mono">Source Amount</label>
                  <input
                    type="number"
                    value={convAmount}
                    onChange={(e) => setConvAmount(e.target.value)}
                    className="w-full p-2.5 bg-white border-2 border-slate-900 rounded-xl font-mono text-sm shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] focus:outline-none"
                    placeholder="Enter amount..."
                  />
                </div>

                {/* Conversion selectors */}
                <div className="grid grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-600 block uppercase font-mono">From</label>
                    <select
                      value={convFrom}
                      onChange={(e) => setConvFrom(e.target.value as any)}
                      className="w-full p-2 bg-white border-2 border-slate-900 rounded-xl font-mono text-[10px] focus:outline-none"
                    >
                      <option value="EUR">EUR (€)</option>
                      <option value="NPR">NPR (रू)</option>
                      <option value="USD">USD ($)</option>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-bold text-slate-600 block uppercase font-mono">To</label>
                    <select
                      value={convTo}
                      onChange={(e) => setConvTo(e.target.value as any)}
                      className="w-full p-2 bg-white border-2 border-slate-900 rounded-xl font-mono text-[10px] focus:outline-none"
                    >
                      <option value="EUR">EUR (€)</option>
                      <option value="NPR">NPR (रू)</option>
                      <option value="USD">USD ($)</option>
                    </select>
                  </div>
                </div>

                {/* Conversion display result */}
                <div className="bg-white border-2 border-slate-900 p-3 rounded-2xl text-center space-y-1 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                  <span className="text-[8px] font-black text-slate-400 uppercase font-mono block">Converted Sum</span>
                  <span className="text-lg font-black text-slate-900 font-mono">
                    {renderCurrency(computedConversion, convTo)}
                  </span>
                </div>

                {/* Exchange Rates info */}
                <p className="text-[9px] text-amber-800 font-mono text-center leading-tight">
                  Exchange reference:<br />
                  1 EUR = 142.50 NPR • 1 EUR = 1.09 USD
                </p>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ---------------------------------------------
          SUB-TAB B: PRIVATE TRANSACTION LEDGER
          --------------------------------------------- */}
      {activeSection === 'transactions' && (
        <div className="space-y-6 animate-fade-in">
          
          {/* SEARCH AND FILTERS */}
          <div className="bg-white border-4 border-slate-900 p-4 rounded-3xl shadow-[5px_5px_0px_0px_rgba(15,23,42,1)] grid grid-cols-1 md:grid-cols-4 gap-3 items-center">
            
            {/* Text Search */}
            <div className="relative min-w-0 md:col-span-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-450" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2.5 bg-slate-50 border-2 border-slate-900 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                placeholder="Search transactions, notes, tags..."
              />
            </div>

            {/* Type Filter */}
            <div className="min-w-0">
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="w-full px-3 py-2.5 bg-slate-50 border-2 border-slate-900 rounded-xl text-xs font-black uppercase tracking-wider focus:outline-none"
              >
                <option value="all">All Types</option>
                <option value="expense">Expense</option>
                <option value="income">Income</option>
                <option value="remittance">Nepal Remittance</option>
              </select>
            </div>

            {/* Category Filter */}
            <div className="min-w-0">
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border-2 border-slate-900 rounded-xl text-xs font-black uppercase tracking-wider focus:outline-none"
              >
                <option value="all">All Categories</option>
                {PERSONAL_CATEGORIES.map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            {/* Account Filter */}
            <div className="min-w-0">
              <select
                value={filterAccount}
                onChange={(e) => setFilterAccount(e.target.value)}
                className="w-full px-3 py-2.5 bg-slate-50 border-2 border-slate-900 rounded-xl text-xs font-black uppercase tracking-wider focus:outline-none"
              >
                <option value="all">All Wallets</option>
                {accounts.map(acc => (
                  <option key={acc.id} value={acc.id}>{acc.name} ({acc.currency})</option>
                ))}
              </select>
            </div>

          </div>

          {/* PRIVATE TRANSACTIONS TIMELINE */}
          <div className="bg-white border-4 border-slate-900 rounded-[32px] p-6 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] space-y-4">
            
            {filteredTransactions.length === 0 ? (
              <div className="py-16 text-center text-slate-400 text-xs font-bold bg-slate-50 border-2 border-dashed border-slate-200 rounded-2xl">
                No personal transactions matched your filter.
              </div>
            ) : (
              <div className="divide-y-2 divide-slate-100">
                {filteredTransactions.map((tx) => {
                  const isExpense = tx.type === 'expense';
                  const isIncome = tx.type === 'income';
                  const isRemittance = tx.type === 'remittance';
                  
                  const accName = accounts.find(a => a.id === tx.accountId)?.name || 'Deleted Account';

                  const formattedDate = new Date(tx.timestamp).toLocaleDateString('en-IE', {
                    day: '2-digit',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                  });

                  return (
                    <div key={tx.id} className="py-4 first:pt-0 last:pb-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3.5 min-w-0">
                        {/* Transaction Icon */}
                        <span className={`p-3 rounded-2xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] shrink-0 mt-0.5 ${
                          isIncome 
                            ? 'bg-emerald-100 text-emerald-600' 
                            : isRemittance 
                              ? 'bg-pink-100 text-pink-600' 
                              : 'bg-indigo-100 text-indigo-600'
                        }`}>
                          {isIncome ? (
                            <TrendingUp className="w-4 h-4 stroke-[2.5]" />
                          ) : isRemittance ? (
                            <Send className="w-4 h-4 stroke-[2.5]" />
                          ) : (
                            <TrendingDown className="w-4 h-4 stroke-[2.5]" />
                          )}
                        </span>

                        {/* Text and tags */}
                        <div className="min-w-0">
                          <h5 className="text-xs font-black text-slate-900 truncate flex items-center gap-1.5 flex-wrap">
                            <span>{tx.title}</span>
                            {tx.receiptUrl && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-slate-100 text-slate-600 rounded text-[8px] border border-slate-200 font-mono font-bold" title={tx.receiptName || 'Attached receipt'}>
                                <FileText className="w-2.5 h-2.5" /> Receipt
                              </span>
                            )}
                          </h5>
                          
                          <p className="text-[10px] text-slate-400 font-bold mt-1">
                            {formattedDate} • via <strong className="text-slate-700">{accName}</strong>
                          </p>

                          {tx.notes && (
                            <p className="text-[10px] text-slate-500 font-medium italic mt-1 bg-slate-50 p-1.5 rounded-lg border border-slate-150 inline-block max-w-full truncate">
                              {tx.notes}
                            </p>
                          )}

                          {tx.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {tx.tags.map(tag => (
                                <span key={tag} className="px-1.5 py-0.5 bg-indigo-50 text-indigo-700 rounded text-[8px] font-black border border-indigo-100 font-mono uppercase">
                                  #{tag}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Right amount and deletes */}
                      <div className="flex items-center gap-4 self-end sm:self-center shrink-0">
                        <div className="text-right">
                          <p className={`text-sm font-black font-mono ${
                            isIncome ? 'text-emerald-600' : isRemittance ? 'text-pink-600' : 'text-slate-900'
                          }`}>
                            {isIncome ? '+' : '-'}{renderCurrency(tx.amount, tx.currency)}
                          </p>
                          <span className="text-[9px] font-black uppercase text-slate-400 bg-slate-50 border border-slate-200 px-1.5 rounded-md">
                            {tx.category}
                          </span>
                        </div>

                        {/* Delete entry trigger */}
                        <button
                          id={`btn-delete-tx-${tx.id}`}
                          onClick={() => handleDeleteTransaction(tx)}
                          className="p-1.5 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-300 rounded-lg transition"
                          title="Delete transaction entry"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

          </div>

        </div>
      )}

      {/* ---------------------------------------------
          SUB-TAB C: SAVINGS BENCHMARKS & GOALS
          --------------------------------------------- */}
      {activeSection === 'savings' && (
        <div className="space-y-6 animate-fade-in">
          
          <div className="flex items-center justify-between border-b-2 border-slate-100 pb-2">
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight font-display flex items-center gap-1.5">
              <Goal className="w-5 h-5 text-indigo-600" /> Savings Targets &amp; Milestones
            </h4>
            
            <button
              id="btn-add-goal-open"
              onClick={() => setIsAddGoalOpen(true)}
              className="px-3.5 py-1.5 bg-white text-slate-900 border-2 border-slate-900 rounded-xl text-[9px] font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:bg-slate-50 transition cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3px]" />
              <span>New Target Goal</span>
            </button>
          </div>

          {savingsGoals.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs font-bold bg-white border-4 border-slate-900 rounded-3xl shadow-[5px_5px_0px_0px_rgba(15,23,42,1)]">
              No active savings targets set. Establish a new target to monitor progress!
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {savingsGoals.map((goal) => {
                const percent = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
                const isCompleted = goal.currentAmount >= goal.targetAmount;

                return (
                  <div 
                    key={goal.id} 
                    className={`bg-white border-4 border-slate-900 p-5 rounded-3xl shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] space-y-4 relative overflow-hidden flex flex-col justify-between ${
                      isCompleted ? 'bg-emerald-50/50' : ''
                    }`}
                  >
                    <div>
                      {/* Top banner info */}
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2 mb-2">
                        <div>
                          <h5 className="text-xs font-black text-slate-900">{goal.name}</h5>
                          <span className="text-[8px] font-mono font-bold text-slate-400">Target Deadline: {goal.deadline}</span>
                        </div>
                        {isCompleted ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-700 text-[8px] font-black uppercase rounded border border-emerald-300">
                            Goal Completed
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-900 text-white text-[8px] font-black uppercase rounded">
                            Active Goal
                          </span>
                        )}
                      </div>

                      {/* Progress Metrics */}
                      <div className="flex items-baseline justify-between font-mono">
                        <span className="text-xs text-slate-500 font-bold">Progress Status:</span>
                        <div className="text-right">
                          <span className="text-base font-black text-slate-900">
                            {renderCurrency(goal.currentAmount, goal.currency)}
                          </span>
                          <span className="text-slate-400 text-[10px] font-bold">
                            {' '}/ {renderCurrency(goal.targetAmount, goal.currency)}
                          </span>
                        </div>
                      </div>

                      {/* Progress Bar visualizer */}
                      <div className="space-y-1 mt-2">
                        <div className="w-full bg-slate-100 h-3 rounded-full border border-slate-200 overflow-hidden relative">
                          <div 
                            className="bg-indigo-500 h-full rounded-full transition-all duration-500" 
                            style={{ width: `${percent}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-[9px] font-mono text-slate-400">
                          <span>Progress ratio</span>
                          <span className="font-bold text-indigo-600">{percent.toFixed(1)}%</span>
                        </div>
                      </div>

                      {goal.notes && (
                        <p className="text-[10px] text-slate-500 italic bg-slate-50 p-2 rounded-xl border mt-3">
                          {goal.notes}
                        </p>
                      )}
                    </div>

                    {/* Actions panel */}
                    <div className="flex items-center gap-2 pt-4 border-t border-slate-100 mt-2">
                      <button
                        id={`btn-contribute-goal-${goal.id}`}
                        onClick={() => {
                          setSelectedGoalForContribution(goal);
                          if (accounts.length > 0) {
                            setContribAccountId(accounts[0].id);
                          }
                        }}
                        className="flex-1 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-2 border-indigo-300 rounded-xl text-[9px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer flex items-center justify-center gap-1"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add Savings Funds</span>
                      </button>

                      <button
                        id={`btn-delete-goal-${goal.id}`}
                        onClick={() => handleDeleteSavingsGoal(goal.id)}
                        className="p-2 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-300 rounded-xl transition cursor-pointer"
                        title="Delete goal target"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

        </div>
      )}

      {/* ---------------------------------------------
          SUB-TAB D: RECURRING BILLS CALENDAR / REMINDERS
          --------------------------------------------- */}
      {activeSection === 'recurring' && (
        <div className="space-y-6 animate-fade-in">
          
          <div className="flex items-center justify-between border-b-2 border-slate-100 pb-2">
            <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight font-display flex items-center gap-1.5">
              <CalendarIcon className="w-5 h-5 text-indigo-600" /> Recurring Bills &amp; Subscription Commitments
            </h4>
            
            <button
              id="btn-add-bill-open"
              onClick={() => setIsAddBillOpen(true)}
              className="px-3.5 py-1.5 bg-white text-slate-900 border-2 border-slate-900 rounded-xl text-[9px] font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:bg-slate-50 transition cursor-pointer flex items-center gap-1"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3px]" />
              <span>Create Schedule</span>
            </button>
          </div>

          {/* DYNAMIC DUE DATE TIMELINE / CALENDAR view */}
          {recurringBills.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs font-bold bg-white border-4 border-slate-900 rounded-3xl shadow-[5px_5px_0px_0px_rgba(15,23,42,1)]">
              No recurring payments configured. Set up automatic schedules for phone, rent, netflix, or utilities.
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
              
              {/* Due Date Linear Calendar List */}
              <div className="bg-white border-4 border-slate-900 rounded-[32px] p-5 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] lg:col-span-2 space-y-4">
                <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
                  <h5 className="text-xs font-black text-slate-900 uppercase font-display">Active Schedules</h5>
                  <span className="text-[8px] font-mono text-slate-400 font-bold">Chronological by Day of Month</span>
                </div>

                <div className="divide-y divide-slate-150 space-y-2">
                  {recurringBills.map((bill) => {
                    const currentMonthYear = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
                    const isPaidThisMonth = bill.lastPaid && bill.lastPaid.startsWith(currentMonthYear);

                    return (
                      <div key={bill.id} className="pt-3 pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-start gap-3">
                          {/* Calendar badge style */}
                          <div className="bg-slate-900 text-amber-400 border-2 border-slate-900 rounded-xl p-2 shrink-0 font-mono text-center w-12 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]">
                            <span className="text-[8px] uppercase block font-black leading-none mb-1">Day</span>
                            <span className="text-base font-black leading-none">{bill.dueDate}</span>
                          </div>

                          <div>
                            <h5 className="text-xs font-black text-slate-900 flex items-center gap-1.5 flex-wrap">
                              <span>{bill.name}</span>
                              <span className="px-1.5 py-0.5 bg-slate-100 text-slate-500 rounded text-[7px] font-black uppercase font-mono tracking-wider">
                                {bill.frequency}
                              </span>
                            </h5>
                            
                            <p className="text-[9px] text-slate-400 font-bold mt-0.5">
                              Due every month on the {bill.dueDate}th • {bill.category}
                            </p>

                            {bill.lastPaid ? (
                              <p className="text-[9px] text-emerald-600 font-bold mt-1 flex items-center gap-0.5">
                                <Check className="w-3 h-3 text-emerald-500 stroke-[3px]" /> Last Paid: {bill.lastPaid}
                              </p>
                            ) : (
                              <p className="text-[9px] text-amber-600 font-bold mt-1 flex items-center gap-0.5">
                                <Clock className="w-3 h-3 text-amber-500" /> Never logged via app
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Bill Amount, Pay Now triggers */}
                        <div className="flex items-center gap-3.5 self-end sm:self-center shrink-0">
                          <div className="text-right">
                            <p className="text-sm font-black font-mono text-slate-900">
                              {renderCurrency(bill.amount, bill.currency)}
                            </p>
                            <span className="text-[8px] font-black uppercase text-slate-400">Recurring bill</span>
                          </div>

                          <div className="flex items-center gap-1.5">
                            {/* Fast payment button */}
                            {isPaidThisMonth ? (
                              <span className="px-2 py-1 bg-emerald-100 text-emerald-700 border border-emerald-300 text-[8px] font-black uppercase rounded-lg">
                                Settled Up
                              </span>
                            ) : (
                              <select
                                defaultValue=""
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handlePayBill(bill, e.target.value);
                                    e.target.value = ''; // Reset selector
                                  }
                                }}
                                className="px-2.5 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border-2 border-indigo-300 rounded-xl text-[8px] font-black uppercase tracking-wider focus:outline-none transition cursor-pointer"
                              >
                                <option value="" disabled>Pay now...</option>
                                {accounts.map(a => (
                                  <option key={a.id} value={a.id}>{a.name}</option>
                                ))}
                              </select>
                            )}

                            <button
                              id={`btn-delete-bill-${bill.id}`}
                              onClick={() => handleDeleteRecurringBill(bill.id)}
                              className="p-1.5 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-200 hover:border-rose-300 rounded-xl transition cursor-pointer"
                              title="Delete recurring payment"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Upcomming bill notifications */}
              <div className="bg-white border-4 border-slate-900 rounded-[32px] p-5 shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] space-y-4">
                <div className="border-b border-slate-100 pb-2">
                  <h5 className="text-xs font-black text-slate-900 uppercase font-display flex items-center gap-1">
                    <Bell className="w-4 h-4 text-pink-500" /> Payment Reminders
                  </h5>
                </div>

                {(() => {
                  const unpaidUpcoming = recurringBills.filter(bill => {
                    const currentMonthYear = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
                    return !bill.lastPaid || !bill.lastPaid.startsWith(currentMonthYear);
                  });

                  if (unpaidUpcoming.length === 0) {
                    return (
                      <div className="py-6 text-center text-slate-400 text-xs">
                        🎉 All configured schedules are settled for this calendar month. Nice job!
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-3">
                      <p className="text-[10px] text-slate-500 font-bold">
                        The following bills are pending payment logs for the current cycle:
                      </p>
                      
                      <div className="space-y-2">
                        {unpaidUpcoming.map(bill => (
                          <div key={bill.id} className="p-3 bg-amber-50 border-2 border-slate-900 rounded-2xl flex items-center justify-between">
                            <div>
                              <span className="text-[10px] font-black text-slate-900">{bill.name}</span>
                              <span className="text-[8px] font-mono text-slate-400 block">Due Day: {bill.dueDate}</span>
                            </div>
                            <span className="text-xs font-black font-mono text-slate-900 shrink-0">
                              {renderCurrency(bill.amount, bill.currency)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}
              </div>

            </div>
          )}

        </div>
      )}


      {/* =============================================
          1. MODAL: ADD PERSONAL TRANSACTION ENTRY
          ============================================= */}
      {isAddTxOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border-4 border-slate-900 rounded-[32px] max-w-lg w-full p-6 shadow-[10px_10px_0px_0px_rgba(15,23,42,1)] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b-2 border-slate-100 pb-3">
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight font-display flex items-center gap-1.5">
                <Sparkles className="w-5 h-5 text-indigo-600" /> Log Personal Finance Entry
              </h4>
              <button 
                onClick={() => setIsAddTxOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg border border-slate-200 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateTransaction} className="space-y-4 text-xs">
              
              {/* Entry Type Switcher */}
              <div className="grid grid-cols-3 bg-slate-100 p-1 rounded-xl border-2 border-slate-900 w-full">
                <button
                  type="button"
                  onClick={() => {
                    setTxType('expense');
                    setTxCategory(PERSONAL_CATEGORIES[0]);
                  }}
                  className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                    txType === 'expense' 
                      ? 'bg-slate-900 text-white shadow-sm' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <TrendingDown className="w-3.5 h-3.5 inline mr-1 stroke-[2.5]" /> Expense
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTxType('income');
                    setTxCategory('Salary/Earnings');
                  }}
                  className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    txType === 'income' 
                      ? 'bg-slate-900 text-white shadow-sm' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <TrendingUp className="w-3.5 h-3.5 inline mr-1 stroke-[2.5]" /> Income
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setTxType('remittance');
                    setTxCategory('Nepal Remittance');
                  }}
                  className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1 ${
                    txType === 'remittance' 
                      ? 'bg-slate-900 text-white shadow-sm' 
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Send className="w-3.5 h-3.5 inline mr-1 stroke-[2.5]" /> Nepal Send
                </button>
              </div>

              {/* Title & Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Title / Description</label>
                  <input
                    type="text"
                    required
                    value={txTitle}
                    onChange={(e) => setTxTitle(e.target.value)}
                    className="w-full p-2.5 border-2 border-slate-900 rounded-xl focus:outline-none focus:bg-slate-50 font-medium"
                    placeholder="e.g., Cinema tickets, Mobile bill, salary"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2 items-end">
                  <div className="col-span-2 space-y-1">
                    <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Amount</label>
                    <input
                      type="number"
                      step="0.01"
                      required
                      value={txAmount}
                      onChange={(e) => setTxAmount(e.target.value)}
                      className="w-full p-2.5 border-2 border-slate-900 rounded-xl focus:outline-none focus:bg-slate-50 font-mono font-bold"
                      placeholder="0.00"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Currency</label>
                    <select
                      value={txCurrency}
                      onChange={(e) => setTxCurrency(e.target.value as any)}
                      className="w-full p-2.5 border-2 border-slate-900 rounded-xl bg-white font-mono focus:outline-none"
                    >
                      <option value="EUR">EUR (€)</option>
                      <option value="NPR">NPR (रू)</option>
                      <option value="USD">USD ($)</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Wallet / Source account and Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Select Wallet / Source Account</label>
                  {accounts.length === 0 ? (
                    <p className="text-[10px] text-rose-500 font-bold">Please create a wallet account first.</p>
                  ) : (
                    <select
                      required
                      value={txAccountId}
                      onChange={(e) => setTxAccountId(e.target.value)}
                      className="w-full p-2.5 border-2 border-slate-900 rounded-xl bg-white focus:outline-none"
                    >
                      {accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} (Bal: {renderCurrency(acc.balance, acc.currency)})
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Category</label>
                  <select
                    value={txCategory}
                    onChange={(e) => setTxCategory(e.target.value)}
                    className="w-full p-2.5 border-2 border-slate-900 rounded-xl bg-white focus:outline-none"
                  >
                    {PERSONAL_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Notes and tags */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Custom tags (comma separated)</label>
                  <input
                    type="text"
                    value={txTags}
                    onChange={(e) => setTxTags(e.target.value)}
                    className="w-full p-2.5 border-2 border-slate-900 rounded-xl focus:outline-none font-mono"
                    placeholder="e.g., fun, cinema, leisure"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Private Notes</label>
                  <input
                    type="text"
                    value={txNotes}
                    onChange={(e) => setTxNotes(e.target.value)}
                    className="w-full p-2.5 border-2 border-slate-900 rounded-xl focus:outline-none"
                    placeholder="Optional details..."
                  />
                </div>
              </div>

              {/* Receipt mockup attachment upload */}
              <div className="space-y-1 border-2 border-dashed border-slate-200 rounded-2xl p-4 bg-slate-50 hover:bg-slate-100/50 transition relative">
                <label className="text-[9px] font-black text-slate-500 block uppercase font-mono mb-2">Attach Receipt / Invoice (Optional)</label>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white border-2 border-slate-900 rounded-xl shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] text-slate-500">
                    <Camera className="w-6 h-6 text-slate-700" />
                  </div>
                  <div className="space-y-1">
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      id="personal-receipt-file-input"
                      onChange={handleReceiptChange}
                      className="hidden"
                    />
                    <label 
                      htmlFor="personal-receipt-file-input"
                      className="inline-block px-3 py-1.5 bg-white text-slate-900 border border-slate-300 rounded-lg text-[9px] font-black uppercase cursor-pointer hover:bg-slate-50 shadow-sm"
                    >
                      {receiptName ? 'Change Receipt' : 'Upload File'}
                    </label>
                    <p className="text-[9px] text-slate-400 font-bold">
                      {receiptName ? `Selected: ${receiptName.slice(0, 20)}...` : 'Supports invoices, JPG, PNG up to 5MB'}
                    </p>
                  </div>
                </div>

                {receiptBase64 && (
                  <div className="mt-3 flex items-center gap-2 bg-indigo-50 border border-indigo-200 p-2 rounded-xl">
                    <div className="w-10 h-10 border border-slate-900 rounded-lg overflow-hidden bg-white shrink-0">
                      <img src={receiptBase64} alt="Receipt thumbnail" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    </div>
                    <span className="text-[8px] font-mono font-bold text-indigo-700">Receipt image encoded securely!</span>
                  </div>
                )}
              </div>

              {/* Submit triggers */}
              <div className="flex gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddTxOpen(false)}
                  className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-800 border-2 border-slate-900 rounded-xl font-black uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={accounts.length === 0}
                  className="flex-1 py-3 bg-pink-500 hover:bg-pink-600 text-white border-2 border-slate-900 rounded-xl font-black uppercase tracking-wider shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] cursor-pointer"
                >
                  Commit Log
                </button>
              </div>

            </form>
          </div>
        </div>
      )}


      {/* =============================================
          2. MODAL: CREATE CUSTOM ACCOUNT WALLET
          ============================================= */}
      {isAddAccountOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border-4 border-slate-900 rounded-[32px] max-w-sm w-full p-6 shadow-[10px_10px_0px_0px_rgba(15,23,42,1)] space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight font-display">Create Account Wallet</h4>
              <button 
                onClick={() => setIsAddAccountOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition border border-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-4 text-xs">
              
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Account / Wallet Name</label>
                <input
                  type="text"
                  required
                  value={accName}
                  onChange={(e) => setAccName(e.target.value)}
                  className="w-full p-2.5 border-2 border-slate-900 rounded-xl focus:outline-none"
                  placeholder="e.g., AIB Card, Revolut, eSewa Wallet"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Type</label>
                  <select
                    value={accType}
                    onChange={(e) => setAccType(e.target.value as any)}
                    className="w-full p-2.5 border-2 border-slate-900 rounded-xl bg-white focus:outline-none"
                  >
                    <option value="Cash">Cash</option>
                    <option value="Bank Account">Bank Account</option>
                    <option value="Revolut">Revolut</option>
                    <option value="Digital Wallet">Digital Wallet</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Base Currency</label>
                  <select
                    value={accCurrency}
                    onChange={(e) => setAccCurrency(e.target.value as any)}
                    className="w-full p-2.5 border-2 border-slate-900 rounded-xl bg-white focus:outline-none"
                  >
                    <option value="EUR">EUR (€)</option>
                    <option value="NPR">NPR (रू)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Starting balance</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={accBalance}
                  onChange={(e) => setAccBalance(e.target.value)}
                  className="w-full p-2.5 border-2 border-slate-900 rounded-xl focus:outline-none font-mono"
                  placeholder="0.00"
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddAccountOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border-2 border-slate-900 rounded-xl font-black uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white border-2 border-slate-900 rounded-xl font-black uppercase tracking-wider shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] cursor-pointer"
                >
                  Create
                </button>
              </div>

            </form>
          </div>
        </div>
      )}


      {/* =============================================
          3. MODAL: ADD SAVINGS GOAL TARGET
          ============================================= */}
      {isAddGoalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border-4 border-slate-900 rounded-[32px] max-w-sm w-full p-6 shadow-[10px_10px_0px_0px_rgba(15,23,42,1)] space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight font-display">New Savings Target Goal</h4>
              <button 
                onClick={() => setIsAddGoalOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg border border-slate-200 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateSavingsGoal} className="space-y-4 text-xs">
              
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Goal / Milestone Name</label>
                <input
                  type="text"
                  required
                  value={goalName}
                  onChange={(e) => setGoalName(e.target.value)}
                  className="w-full p-2.5 border-2 border-slate-900 rounded-xl focus:outline-none"
                  placeholder="e.g., Summer Holiday, Laptop, Bike, Remittance Reserve"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Target Amount</label>
                  <input
                    type="number"
                    step="1"
                    required
                    value={goalTarget}
                    onChange={(e) => setGoalTarget(e.target.value)}
                    className="w-full p-2.5 border-2 border-slate-900 rounded-xl focus:outline-none font-mono"
                    placeholder="e.g., 2000"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Currency</label>
                  <select
                    value={goalCurrency}
                    onChange={(e) => setGoalCurrency(e.target.value as any)}
                    className="w-full p-2.5 border-2 border-slate-900 rounded-xl bg-white focus:outline-none"
                  >
                    <option value="EUR">EUR (€)</option>
                    <option value="NPR">NPR (रू)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Current savings</label>
                  <input
                    type="number"
                    value={goalCurrent}
                    onChange={(e) => setGoalCurrent(e.target.value)}
                    className="w-full p-2.5 border-2 border-slate-900 rounded-xl focus:outline-none font-mono"
                    placeholder="0"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Deadline Date</label>
                  <input
                    type="date"
                    required
                    value={goalDeadline}
                    onChange={(e) => setGoalDeadline(e.target.value)}
                    className="w-full p-2.5 border-2 border-slate-900 rounded-xl focus:outline-none font-mono text-[10px]"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Private description</label>
                <input
                  type="text"
                  value={goalNotes}
                  onChange={(e) => setGoalNotes(e.target.value)}
                  className="w-full p-2.5 border-2 border-slate-900 rounded-xl focus:outline-none"
                  placeholder="Notes or reasons for saving..."
                />
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddGoalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border-2 border-slate-900 rounded-xl font-black uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white border-2 border-slate-900 rounded-xl font-black uppercase tracking-wider shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] cursor-pointer"
                >
                  Create
                </button>
              </div>

            </form>
          </div>
        </div>
      )}


      {/* =============================================
          4. MODAL: QUICK ADD SAVINGS GOAL FUNDS
          ============================================= */}
      {selectedGoalForContribution && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border-4 border-slate-900 rounded-[32px] max-w-sm w-full p-6 shadow-[10px_10px_0px_0px_rgba(15,23,42,1)] space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight font-display">Add Funds to: {selectedGoalForContribution.name}</h4>
              <button 
                onClick={() => setSelectedGoalForContribution(null)}
                className="p-1.5 hover:bg-slate-100 rounded-lg border border-slate-200 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleContributeGoalSubmit} className="space-y-4 text-xs">
              
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Deduct from Account/Wallet</label>
                <select
                  required
                  value={contribAccountId}
                  onChange={(e) => setContribAccountId(e.target.value)}
                  className="w-full p-2.5 border-2 border-slate-900 rounded-xl bg-white focus:outline-none"
                >
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name} (Bal: {renderCurrency(acc.balance, acc.currency)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Transfer Amount ({selectedGoalForContribution.currency})</label>
                <input
                  type="number"
                  step="1"
                  required
                  value={contribAmount}
                  onChange={(e) => setContribAmount(e.target.value)}
                  className="w-full p-2.5 border-2 border-slate-900 rounded-xl focus:outline-none font-mono"
                  placeholder="0.00"
                />
              </div>

              <div className="p-3 bg-indigo-50 border-2 border-slate-900 rounded-2xl flex items-start gap-2.5 text-[9px] text-slate-600 font-bold leading-normal">
                <Info className="w-4 h-4 text-indigo-600 shrink-0 mt-0.5" />
                <span>This will subtract the amount from the selected wallet, update the target goal progress, and create an automated log in your private ledger.</span>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setSelectedGoalForContribution(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border-2 border-slate-900 rounded-xl font-black uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-65 bg-indigo-600 hover:bg-indigo-700 text-white border-2 border-slate-900 rounded-xl font-black uppercase tracking-wider shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] cursor-pointer"
                >
                  Confirm
                </button>
              </div>

            </form>
          </div>
        </div>
      )}


      {/* =============================================
          5. MODAL: CREATE RECURRING BILL SCHEDULE
          ============================================= */}
      {isAddBillOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border-4 border-slate-900 rounded-[32px] max-w-sm w-full p-6 shadow-[10px_10px_0px_0px_rgba(15,23,42,1)] space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight font-display">New Recurring Bill Schedule</h4>
              <button 
                onClick={() => setIsAddBillOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg border border-slate-200 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateRecurringBill} className="space-y-4 text-xs">
              
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Bill Description / Provider</label>
                <input
                  type="text"
                  required
                  value={billName}
                  onChange={(e) => setBillName(e.target.value)}
                  className="w-full p-2.5 border-2 border-slate-900 rounded-xl focus:outline-none"
                  placeholder="e.g., Netflix, Spotify, LycaMobile, Private Insurance"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Amount</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={billAmount}
                    onChange={(e) => setBillAmount(e.target.value)}
                    className="w-full p-2.5 border-2 border-slate-900 rounded-xl focus:outline-none font-mono"
                    placeholder="e.g., 14.99"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Currency</label>
                  <select
                    value={billCurrency}
                    onChange={(e) => setBillCurrency(e.target.value as any)}
                    className="w-full p-2.5 border-2 border-slate-900 rounded-xl bg-white focus:outline-none"
                  >
                    <option value="EUR">EUR (€)</option>
                    <option value="NPR">NPR (रू)</option>
                    <option value="USD">USD ($)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Due Day of Month</label>
                  <input
                    type="number"
                    min="1"
                    max="31"
                    required
                    value={billDueDate}
                    onChange={(e) => setBillDueDate(e.target.value)}
                    className="w-full p-2.5 border-2 border-slate-900 rounded-xl focus:outline-none font-mono"
                    placeholder="e.g., 5"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Frequency</label>
                  <select
                    value={billFrequency}
                    onChange={(e) => setBillFrequency(e.target.value as any)}
                    className="w-full p-2.5 border-2 border-slate-900 rounded-xl bg-white focus:outline-none"
                  >
                    <option value="Monthly">Monthly</option>
                    <option value="Weekly">Weekly</option>
                    <option value="Yearly">Yearly</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Category</label>
                  <select
                    value={billCategory}
                    onChange={(e) => setBillCategory(e.target.value)}
                    className="w-full p-2.5 border-2 border-slate-900 rounded-xl bg-white focus:outline-none"
                  >
                    {PERSONAL_CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Private Notes</label>
                  <input
                    type="text"
                    value={billNotes}
                    onChange={(e) => setBillNotes(e.target.value)}
                    className="w-full p-2.5 border-2 border-slate-900 rounded-xl focus:outline-none"
                    placeholder="e.g., account details"
                  />
                </div>
              </div>

              <div className="flex gap-2.5 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAddBillOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border-2 border-slate-900 rounded-xl font-black uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-65 bg-indigo-600 hover:bg-indigo-700 text-white border-2 border-slate-900 rounded-xl font-black uppercase tracking-wider shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] cursor-pointer"
                >
                  Settle Schedule
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

    </div>
  );
}
