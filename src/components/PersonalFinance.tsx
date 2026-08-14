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
  payRecurringBill,
  updateAccount,
  deleteAccount,
  transferFunds
} from '../personalFinanceService';
import { 
  Wallet, 
  CreditCard, 
  Coins, 
  Plus, 
  Trash2,
  Edit2,
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
  UploadCloud,
  Eye,
  EyeOff
} from 'lucide-react';

interface PersonalFinanceProps {
  currentUser: Roommate;
  isUnlocked: boolean;
  onPromptUnlock: () => void;
  onBackToWorkspace: () => void;
  nicknames: Record<Roommate, string>;
  profiles: Record<Roommate, { id: Roommate; avatar?: string; accentColor?: string; nickname?: string }>;
  activeSection?: 'dashboard' | 'transactions' | 'savings' | 'recurring';
  setActiveSection?: (section: 'dashboard' | 'transactions' | 'savings' | 'recurring') => void;
  isAddTxOpen?: boolean;
  setIsAddTxOpen?: (open: boolean) => void;
}

const DEFAULT_EXCHANGE_RATES = {
  EUR: 1.0,
  NPR: 175.72, // 1 EUR = 175.72 NPR (Accurate live rate fallback)
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
  profiles,
  activeSection: propsActiveSection,
  setActiveSection: propsSetActiveSection,
  isAddTxOpen: propsIsAddTxOpen,
  setIsAddTxOpen: propsSetIsAddTxOpen
}: PersonalFinanceProps) {
  // Database States
  const [accounts, setAccounts] = useState<PersonalAccount[]>([]);
  const [transactions, setTransactions] = useState<PersonalTransaction[]>([]);
  const [savingsGoals, setSavingsGoals] = useState<SavingsGoal[]>([]);
  const [recurringBills, setRecurringBills] = useState<RecurringBill[]>([]);

  // Subscriptions management
  const [exchangeRates, setExchangeRates] = useState(DEFAULT_EXCHANGE_RATES);
  const [isFetchingRates, setIsFetchingRates] = useState(false);

  useEffect(() => {
    let isMounted = true;
    const fetchLiveRates = async () => {
      setIsFetchingRates(true);
      try {
        const response = await fetch('https://open.er-api.com/v6/latest/EUR');
        if (!response.ok) throw new Error('API request failed');
        const data = await response.json();
        if (data && data.rates && isMounted) {
          const fetchedNPR = data.rates.NPR || DEFAULT_EXCHANGE_RATES.NPR;
          const fetchedUSD = data.rates.USD || DEFAULT_EXCHANGE_RATES.USD;
          setExchangeRates({
            EUR: 1.0,
            NPR: parseFloat(fetchedNPR.toFixed(4)),
            USD: parseFloat(fetchedUSD.toFixed(4))
          });
          console.log('Successfully fetched live exchange rates from open.er-api.com:', data.rates);
        }
      } catch (err) {
        console.error('Failed to fetch live exchange rates, falling back to static default rates:', err);
      } finally {
        if (isMounted) setIsFetchingRates(false);
      }
    };
    fetchLiveRates();
    return () => {
      isMounted = false;
    };
  }, []);

  // Transfer Funds State
  const [isTransferOpen, setIsTransferOpen] = useState(false);
  const [transferSourceId, setTransferSourceId] = useState('');
  const [transferDestId, setTransferDestId] = useState('');
  const [transferAmount, setTransferAmount] = useState('');
  const [transferDate, setTransferDate] = useState(() => new Date().toISOString().split('T')[0]);

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

  // Tab State (Supports Controlled vs Internal)
  const [internalActiveSection, setInternalActiveSection] = useState<'dashboard' | 'transactions' | 'savings' | 'recurring'>('dashboard');
  const activeSection = propsActiveSection !== undefined ? propsActiveSection : internalActiveSection;
  const setActiveSection = (sec: 'dashboard' | 'transactions' | 'savings' | 'recurring') => {
    if (propsSetActiveSection) propsSetActiveSection(sec);
    setInternalActiveSection(sec);
  };

  // Privacy State
  const [privacyMode, setPrivacyMode] = useState(true);

  // Input states for new items (Supports Controlled vs Internal)
  const [internalIsAddTxOpen, setInternalIsAddTxOpen] = useState(false);
  const isAddTxOpen = propsIsAddTxOpen !== undefined ? propsIsAddTxOpen : internalIsAddTxOpen;
  const setIsAddTxOpen = (open: boolean) => {
    if (propsSetIsAddTxOpen) propsSetIsAddTxOpen(open);
    setInternalIsAddTxOpen(open);
  };
  const [isAddAccountOpen, setIsAddAccountOpen] = useState(false);
  const [isEditAccountOpen, setIsEditAccountOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<PersonalAccount | null>(null);
  const [selectedStatementAccount, setSelectedStatementAccount] = useState<PersonalAccount | null>(null);
  const [statementSearchQuery, setStatementSearchQuery] = useState('');
  const [isAddGoalOpen, setIsAddGoalOpen] = useState(false);
  const [isAddBillOpen, setIsAddBillOpen] = useState(false);

  // State for receipt lightbox viewer
  const [viewingReceipt, setViewingReceipt] = useState<{ url: string; title: string } | null>(null);

  // Custom Confirmation and Alert Dialog states
  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void | Promise<void>;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {},
  });

  const [alertDialog, setAlertDialog] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
  }>({
    isOpen: false,
    title: '',
    message: '',
  });

  const requestConfirm = (title: string, message: string, onConfirm: () => void | Promise<void>) => {
    setConfirmDialog({
      isOpen: true,
      title,
      message,
      onConfirm,
    });
  };

  const triggerAlert = (title: string, message: string) => {
    setAlertDialog({
      isOpen: true,
      title,
      message,
    });
  };

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
  const [txDate, setTxDate] = useState(() => new Date().toISOString().split('T')[0]);

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

  // Automatically select transfer source and destination accounts
  useEffect(() => {
    if (accounts.length > 0) {
      if (!transferSourceId) {
        setTransferSourceId(accounts[0].id);
      }
      if (!transferDestId && accounts.length > 1) {
        setTransferDestId(accounts[1].id);
      }
    }
  }, [accounts, transferSourceId, transferDestId]);

  // Convert given currency to EUR equivalent
  const convertToEUR = (amount: number, from: 'EUR' | 'NPR' | 'USD'): number => {
    const rate = exchangeRates[from];
    return amount / rate;
  };

  // Convert EUR to target currency
  const convertFromEUR = (amountInEUR: number, to: 'EUR' | 'NPR' | 'USD'): number => {
    const rate = exchangeRates[to];
    return amountInEUR * rate;
  };

  // Total balance in EUR
  const totalNetWorthEUR = useMemo(() => {
    return accounts.reduce((sum, acc) => {
      const valueInEUR = convertToEUR(acc.balance, acc.currency);
      return sum + valueInEUR;
    }, 0);
  }, [accounts, exchangeRates]);

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
  }, [transactions, exchangeRates]);

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
  }, [transactions, exchangeRates]);

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
  const renderCurrency = (amount: number, curr: 'EUR' | 'NPR' | 'USD' = 'EUR', ignorePrivacy = false) => {
    if (privacyMode && !ignorePrivacy) return '••••••';
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
  }, [convAmount, convFrom, convTo, exchangeRates]);

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

  const handleDeleteAccount = (e: React.MouseEvent, id: string, name: string) => {
    e.stopPropagation();
    requestConfirm(
      'Delete Wallet Account',
      `Are you sure you want to delete the wallet "${name}"? Transactions associated with it might be orphaned.`,
      async () => {
        try {
          await deleteAccount(id);
        } catch (err) {
          console.error(err);
        }
      }
    );
  };

  const openEditAccount = (e: React.MouseEvent, acc: PersonalAccount) => {
    e.stopPropagation();
    setEditingAccount(acc);
    setAccName(acc.name);
    setAccType(acc.type);
    setAccCurrency(acc.currency);
    setAccBalance(acc.balance.toString());
    setIsEditAccountOpen(true);
  };

  const handleEditAccountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accName.trim() || !accBalance || !editingAccount) return;
    try {
      await updateAccount(editingAccount.id, {
        name: accName.trim(),
        type: accType,
        balance: parseFloat(accBalance),
        currency: accCurrency
      });
      // Reset
      setAccName('');
      setAccBalance('');
      setEditingAccount(null);
      setIsEditAccountOpen(false);
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
        exchangeRate: exchangeRates[txCurrency],
        receiptUrl: receiptBase64 || undefined,
        receiptName: receiptName || undefined,
        timestamp: txDate ? new Date(txDate) : undefined
      }, sourceAccount);

      // Reset
      setTxTitle('');
      setTxAmount('');
      setTxNotes('');
      setTxTags('');
      setReceiptBase64(null);
      setReceiptName(null);
      setTxDate(new Date().toISOString().split('T')[0]);
      setIsAddTxOpen(false);
    } catch (err) {
      console.error(err);
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferSourceId || !transferDestId || !transferAmount) return;

    const sourceAccount = accounts.find(a => a.id === transferSourceId);
    const destAccount = accounts.find(a => a.id === transferDestId);

    if (!sourceAccount || !destAccount) {
      triggerAlert('Transfer Error', 'Invalid source or destination account.');
      return;
    }

    if (sourceAccount.id === destAccount.id) {
      triggerAlert('Transfer Error', 'Source and destination accounts must be different.');
      return;
    }

    const amountNum = parseFloat(transferAmount);
    if (isNaN(amountNum) || amountNum <= 0) {
      triggerAlert('Transfer Error', 'Please enter a valid amount greater than zero.');
      return;
    }

    if (sourceAccount.balance < amountNum) {
      triggerAlert('Insufficient Funds', `You do not have enough funds in "${sourceAccount.name}" to transfer ${renderCurrency(amountNum, sourceAccount.currency, true)}. Current balance is ${renderCurrency(sourceAccount.balance, sourceAccount.currency, true)}.`);
      return;
    }

    // Calculate conversion rate
    const rateSource = exchangeRates[sourceAccount.currency];
    const rateDest = exchangeRates[destAccount.currency];
    const conversionRate = rateDest / rateSource;
    const convertedAmount = amountNum * conversionRate;

    requestConfirm(
      'Confirm Wallet-to-Wallet Transfer',
      `Are you sure you want to transfer ${renderCurrency(amountNum, sourceAccount.currency, true)} from "${sourceAccount.name}" to "${destAccount.name}"? This will credit ${renderCurrency(convertedAmount, destAccount.currency, true)} using the live rate (1 ${sourceAccount.currency} = ${conversionRate.toFixed(4)} ${destAccount.currency}).`,
      async () => {
        try {
          await transferFunds(
            sourceAccount,
            destAccount,
            amountNum,
            convertedAmount,
            conversionRate,
            currentUser,
            transferDate
          );
          // Reset
          setTransferAmount('');
          setTransferDate(new Date().toISOString().split('T')[0]);
          setIsTransferOpen(false);
          triggerAlert('Transfer Successful', `Transferred ${renderCurrency(amountNum, sourceAccount.currency, true)} to ${destAccount.name} successfully.`);
        } catch (err) {
          console.error(err);
          triggerAlert('Transfer Failed', 'An error occurred while executing the transfer. Please try again.');
        }
      }
    );
  };

  const handleDeleteTransaction = (tx: PersonalTransaction) => {
    const sourceAccount = accounts.find(a => a.id === tx.accountId);

    const message = sourceAccount 
      ? `Are you sure you want to delete "${tx.title}"? Your account balance will be reverted.`
      : `Are you sure you want to delete "${tx.title}"? (Note: The associated account wallet has been deleted, so only this ledger entry will be removed).`;

    requestConfirm(
      'Delete Transaction Entry',
      message,
      async () => {
        try {
          await deleteTransaction(tx, sourceAccount);
        } catch (err) {
          console.error(err);
        }
      }
    );
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

  const handleDeleteSavingsGoal = (id: string) => {
    requestConfirm(
      'Delete Savings Goal',
      'Are you sure you want to delete this savings goal?',
      async () => {
        try {
          await deleteSavingsGoal(id);
        } catch (err) {
          console.error(err);
        }
      }
    );
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

  const handleDeleteRecurringBill = (id: string) => {
    requestConfirm(
      'Delete Recurring Bill',
      'Are you sure you want to remove this recurring payment entry?',
      async () => {
        try {
          await deleteRecurringBill(id);
        } catch (err) {
          console.error(err);
        }
      }
    );
  };

  const handlePayBill = (bill: RecurringBill, sourceAccountId: string) => {
    const account = accounts.find(a => a.id === sourceAccountId);
    if (!account) return;

    const todayStr = new Date().toISOString().split('T')[0];
    requestConfirm(
      'Pay Recurring Bill',
      `Deduct ${renderCurrency(bill.amount, bill.currency, true)} from ${account.name} and mark "${bill.name}" as paid for this month?`,
      async () => {
        try {
          await payRecurringBill(bill, account, todayStr);
        } catch (err) {
          console.error(err);
        }
      }
    );
  };

  // CSV Report Export Generator
  const handleExportCSV = () => {
    if (transactions.length === 0) {
      triggerAlert("No Data to Export", "No transactions logged to export!");
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
          <h2 className="text-2xl font-black text-slate-900 font-display uppercase tracking-tight">Locked Vault</h2>
          <p className="text-xs text-slate-500 font-semibold leading-relaxed">
            Enter your PIN to access your private account.
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
      </div>
    );
  }

  return (
    <div className="space-y-4 font-sans pb-12">
      
      {/* HEADER SECTION WITH NAVIGATION */}
      <div className="bg-emerald-100 border-2 border-slate-900 rounded-2xl p-3 sm:p-4 shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)] flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-white border border-slate-900 rounded-xl shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] shrink-0 text-xl">
            {profiles[currentUser]?.avatar || '👤'}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <h2 className="text-base sm:text-lg font-black text-slate-900 font-display uppercase tracking-tight truncate">{nicknames[currentUser] || currentUser}'s Vault</h2>
              <button 
                onClick={() => setPrivacyMode(!privacyMode)}
                className="p-1 bg-white border border-slate-900 rounded-lg hover:bg-slate-50 transition shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] text-slate-700 cursor-pointer flex items-center gap-1 text-[9px] font-mono font-bold px-1.5"
                title={privacyMode ? "Show Balances" : "Hide Balances"}
              >
                {privacyMode ? <EyeOff className="w-3 h-3 text-slate-500" /> : <Eye className="w-3 h-3 text-emerald-600" />}
                <span>{privacyMode ? 'Hidden' : 'Visible'}</span>
              </button>
            </div>
            <p className="text-[9px] text-slate-600 font-bold hidden sm:block">Private accounts, remittance logs, and savings benchmarks</p>
          </div>
        </div>
      </div>

      {/* DESKTOP-ONLY INNER VIEW SELECTOR BAR (Hidden on mobile where bottom app nav bar handles navigation) */}
      <div className="hidden md:grid grid-cols-4 gap-1.5 bg-slate-100 p-1.5 border-2 border-slate-900 rounded-2xl shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
        <button
          id="btn-subtab-dashboard"
          onClick={() => setActiveSection('dashboard')}
          className={`py-2 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer flex items-center justify-center gap-1 truncate ${
            activeSection === 'dashboard' 
              ? 'bg-emerald-600 text-white shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] border border-slate-900 font-black' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 font-bold'
          }`}
        >
          <TrendingUp className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Wallets</span>
        </button>
        <button
          id="btn-subtab-transactions"
          onClick={() => setActiveSection('transactions')}
          className={`py-2 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer flex items-center justify-center gap-1 truncate ${
            activeSection === 'transactions' 
              ? 'bg-emerald-600 text-white shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] border border-slate-900 font-black' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 font-bold'
          }`}
        >
          <FileText className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Ledger</span>
        </button>
        <button
          id="btn-subtab-savings"
          onClick={() => setActiveSection('savings')}
          className={`py-2 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer flex items-center justify-center gap-1 truncate ${
            activeSection === 'savings' 
              ? 'bg-emerald-600 text-white shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] border border-slate-900 font-black' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 font-bold'
          }`}
        >
          <Goal className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Savings</span>
        </button>
        <button
          id="btn-subtab-recurring"
          onClick={() => setActiveSection('recurring')}
          className={`py-2 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-150 cursor-pointer flex items-center justify-center gap-1 truncate ${
            activeSection === 'recurring' 
              ? 'bg-emerald-600 text-white shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] border border-slate-900 font-black' 
              : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/80 font-bold'
          }`}
        >
          <CalendarIcon className="w-3.5 h-3.5 shrink-0" />
          <span className="truncate">Bills</span>
        </button>
      </div>

      {/* ---------------------------------------------
          SUB-TAB A: OVERVIEW DASHBOARD & WALLETS
          --------------------------------------------- */}
      {activeSection === 'dashboard' && (
        <div className="space-y-4 animate-fade-in">
          
          {/* NET WORTH HEADER BANNER */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-stretch">
            {/* Total Balance Card */}
            <div className="bg-white border-2 border-slate-900 p-3.5 sm:p-4 rounded-2xl shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)] flex flex-col justify-between md:col-span-1">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-500 uppercase font-mono tracking-wider">Total Net Assets</span>
                <span className="p-1 bg-emerald-50 border border-emerald-200 text-emerald-650 rounded-lg">
                  <Wallet className="w-3.5 h-3.5" />
                </span>
              </div>
              <div className="mt-2">
                <h3 className="text-2xl font-black tracking-tight font-mono text-slate-900">{renderCurrency(totalNetWorthEUR, 'EUR')}</h3>
                <p className="text-[8px] font-bold text-slate-400 mt-0.5 uppercase font-mono">Base currency (EUR)</p>
              </div>
              
              <div className="border-t border-slate-100 pt-2 mt-2 flex items-center justify-between text-[10px] font-mono">
                <span className="text-slate-500 font-bold">NPR Approx</span>
                <span className="text-slate-800 font-black">{renderCurrency(totalNetWorthEUR * exchangeRates.NPR, 'NPR')}</span>
              </div>
            </div>

            {/* Income Expense Monthly Box */}
            <div className="bg-white border-2 border-slate-900 p-3.5 sm:p-4 rounded-2xl shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)] md:col-span-2 grid grid-cols-3 gap-2 items-center">
              
              {/* Income */}
              <div className="space-y-0.5 pl-2 border-l-2 border-emerald-400">
                <div className="flex items-center gap-1 text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-wider font-mono truncate">
                  <TrendingUp className="w-3 h-3 text-emerald-500 shrink-0" />
                  <span className="truncate">Income</span>
                </div>
                <h4 className="text-base sm:text-lg font-black font-mono text-slate-900">{renderCurrency(personalStats.income, 'EUR')}</h4>
                <p className="text-[8px] text-slate-400 font-bold hidden sm:block">Earnings & Salary</p>
              </div>

              {/* Expense */}
              <div className="space-y-0.5 pl-2 border-l-2 border-rose-400">
                <div className="flex items-center gap-1 text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-wider font-mono truncate">
                  <TrendingDown className="w-3 h-3 text-rose-500 shrink-0" />
                  <span className="truncate">Expense</span>
                </div>
                <h4 className="text-base sm:text-lg font-black font-mono text-slate-900">{renderCurrency(personalStats.expense, 'EUR')}</h4>
                <p className="text-[8px] text-slate-400 font-bold hidden sm:block">Private bills</p>
              </div>

              {/* Remittance Nepal */}
              <div className="space-y-0.5 pl-2 border-l-2 border-indigo-400">
                <div className="flex items-center gap-1 text-[8px] sm:text-[9px] font-black text-slate-500 uppercase tracking-wider font-mono truncate">
                  <Send className="w-3 h-3 text-indigo-500 shrink-0" />
                  <span className="truncate">Nepal</span>
                </div>
                <h4 className="text-base sm:text-lg font-black font-mono text-slate-900">{renderCurrency(personalStats.remittance, 'EUR')}</h4>
                <p className="text-[8px] text-slate-400 font-bold hidden sm:block">Remittances sent 🇳🇵</p>
              </div>

            </div>
          </div>

          {/* PERSONAL ACCOUNTS GRID */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-1.5">
              <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight font-display flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-emerald-600" /> Account Portfolios
              </h4>
              
              <div className="flex items-center gap-1.5">
                {accounts.length > 1 && (
                  <button
                    id="btn-transfer-funds-open"
                    onClick={() => setIsTransferOpen(true)}
                    className="px-2.5 py-1 bg-indigo-600 text-white border border-slate-900 rounded-xl text-[9px] font-black uppercase tracking-wider shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] hover:bg-indigo-700 transition cursor-pointer flex items-center gap-1 min-h-[30px]"
                  >
                    <ArrowLeftRight className="w-3 h-3 stroke-[3px]" />
                    <span>Transfer</span>
                  </button>
                )}
                
                <button
                  id="btn-add-account-open"
                  onClick={() => setIsAddAccountOpen(true)}
                  className="px-2.5 py-1 bg-white text-slate-900 border border-slate-900 rounded-xl text-[9px] font-black uppercase tracking-wider shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] hover:bg-slate-50 transition cursor-pointer flex items-center gap-1 min-h-[30px]"
                >
                  <Plus className="w-3 h-3 stroke-[3px]" />
                  <span>New Wallet</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              {accounts.map((acc) => {
                const isCash = acc.type === 'Cash';
                const isBank = acc.type === 'Bank Account';
                const isRevolut = acc.type === 'Revolut';

                return (
                  <div 
                    key={acc.id}
                    onClick={() => {
                      setSelectedStatementAccount(acc);
                      setStatementSearchQuery('');
                    }}
                    className={`border-2 border-slate-900 p-3 rounded-2xl shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] flex flex-col justify-between hover:translate-y-[-1px] transition-all relative overflow-hidden cursor-pointer group ${
                      isCash ? 'bg-amber-50' : isBank ? 'bg-indigo-50' : isRevolut ? 'bg-rose-50' : 'bg-emerald-50'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2 relative z-10">
                      <div className="min-w-0">
                        <h5 className="text-xs font-black text-slate-900 truncate group-hover:underline">{acc.name}</h5>
                        <span className="text-[8px] font-mono font-black text-slate-400 uppercase tracking-wider">{acc.type}</span>
                      </div>

                      <span className={`p-1 rounded-lg border border-slate-900/20 shrink-0 ${
                        isCash ? 'bg-amber-100 text-amber-700' : isBank ? 'bg-indigo-100 text-indigo-700' : isRevolut ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                      }`}>
                        {isCash ? (
                          <Coins className="w-3.5 h-3.5" />
                        ) : isBank ? (
                          <CreditCard className="w-3.5 h-3.5" />
                        ) : isRevolut ? (
                          <Wallet className="w-3.5 h-3.5" />
                        ) : (
                          <Send className="w-3.5 h-3.5" />
                        )}
                      </span>
                    </div>

                    <div className="flex items-end justify-between relative z-10 mt-2">
                      <div>
                        <h3 className="text-base sm:text-lg font-black font-mono text-slate-900">
                          {renderCurrency(acc.balance, acc.currency)}
                        </h3>
                        {acc.currency !== 'EUR' && (
                          <p className="text-[8px] text-slate-500 font-mono">
                            ≈ {renderCurrency(convertToEUR(acc.balance, acc.currency), 'EUR')} EUR
                          </p>
                        )}
                      </div>
                      
                      <div className="flex gap-1 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                        <button
                          type="button"
                          onClick={(e) => openEditAccount(e, acc)}
                          className="p-1 bg-white border border-slate-900 rounded-md text-slate-700 hover:bg-indigo-50 transition"
                          title="Edit Account"
                        >
                          <Edit2 className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={(e) => handleDeleteAccount(e, acc.id, acc.name)}
                          className="p-1 bg-white border border-slate-900 rounded-md text-slate-700 hover:bg-rose-50 transition"
                          title="Delete Account"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* TWO COLUMN ANALYTICS & WIDGETS SECTION */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
            {/* Category spending bar chart list */}
            <div className="bg-white border-2 border-slate-900 rounded-2xl p-3.5 sm:p-4 shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)] lg:col-span-2 space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <h5 className="text-xs font-black text-slate-900 uppercase tracking-tight font-display flex items-center gap-1.5">
                  <TrendingDown className="w-3.5 h-3.5 text-rose-600" /> Spending Breakdown
                </h5>
                <span className="text-[8px] font-mono font-black text-slate-400 uppercase">This Month</span>
              </div>

              {categorySummary.length === 0 ? (
                <div className="py-8 text-center text-slate-400 text-xs font-semibold">
                  No personal transactions found.
                </div>
              ) : (
                <div className="space-y-3">
                  {categorySummary.map((item) => {
                    const maxVal = Math.max(...categorySummary.map(c => c.value), 1);
                    const percentOfMax = (item.value / maxVal) * 100;
                    const totalPersonalSpend = categorySummary.reduce((s, c) => s + c.value, 0);
                    const overallPercent = totalPersonalSpend > 0 ? (item.value / totalPersonalSpend) * 100 : 0;

                    return (
                      <div key={item.name} className="space-y-1">
                        <div className="flex items-center justify-between text-[10px] font-mono font-black text-slate-900">
                          <span className="truncate max-w-[150px] sm:max-w-[200px]">{item.name}</span>
                          <div className="space-x-1 shrink-0">
                            <span className="text-slate-700">{renderCurrency(item.value, 'EUR')}</span>
                            <span className="text-slate-400 bg-slate-100 px-1 rounded text-[8px]">{overallPercent.toFixed(0)}%</span>
                          </div>
                        </div>

                        <div className="w-full bg-slate-100 h-2.5 rounded-lg border border-slate-200 overflow-hidden relative">
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
            <div className="bg-amber-100 border-2 border-slate-900 rounded-2xl p-3.5 sm:p-4 shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)] space-y-3">
              <div className="flex items-center justify-between border-b border-amber-200 pb-1.5">
                <h5 className="text-xs font-black text-slate-900 uppercase tracking-tight font-display flex items-center gap-1.5">
                  <Send className="w-3.5 h-3.5 text-pink-600" /> FX Calculator
                </h5>
                <span className="text-[8px] font-mono font-black text-amber-700 bg-amber-200 px-1 rounded">Live Rates</span>
              </div>

              <div className="space-y-2.5 text-xs">
                {/* Amount input */}
                <div className="space-y-0.5">
                  <label className="text-[9px] font-bold text-slate-700 block uppercase font-mono">Source Amount</label>
                  <input
                    type="number"
                    value={convAmount}
                    onChange={(e) => setConvAmount(e.target.value)}
                    className="w-full p-2 bg-white border border-slate-900 rounded-xl font-mono text-xs shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] focus:outline-none"
                    placeholder="Enter amount..."
                  />
                </div>

                {/* Conversion selectors */}
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="space-y-0.5">
                    <label className="text-[8px] font-bold text-slate-600 block uppercase font-mono">From</label>
                    <select
                      value={convFrom}
                      onChange={(e) => setConvFrom(e.target.value as any)}
                      className="w-full p-1.5 bg-white border border-slate-900 rounded-lg font-mono text-[10px] focus:outline-none"
                    >
                      <option value="EUR">EUR (€)</option>
                      <option value="NPR">NPR (रू)</option>
                      <option value="USD">USD ($)</option>
                    </select>
                  </div>

                  <div className="space-y-0.5">
                    <label className="text-[8px] font-bold text-slate-600 block uppercase font-mono">To</label>
                    <select
                      value={convTo}
                      onChange={(e) => setConvTo(e.target.value as any)}
                      className="w-full p-1.5 bg-white border border-slate-900 rounded-lg font-mono text-[10px] focus:outline-none"
                    >
                      <option value="EUR">EUR (€)</option>
                      <option value="NPR">NPR (रू)</option>
                      <option value="USD">USD ($)</option>
                    </select>
                  </div>
                </div>

                {/* Conversion display result */}
                <div className="bg-white border border-slate-900 p-2 rounded-xl text-center space-y-0.5 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]">
                  <span className="text-[8px] font-black text-slate-400 uppercase font-mono block">Result</span>
                  <span className="text-base font-black text-slate-900 font-mono">
                    {renderCurrency(computedConversion, convTo)}
                  </span>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* ---------------------------------------------
          SUB-TAB B: PRIVATE TRANSACTION LEDGER
          --------------------------------------------- */}
      {activeSection === 'transactions' && (
        <div className="space-y-4 animate-fade-in">
          
          {/* LEDGER HEADER & QUICK ACTIONS */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b-2 border-slate-200">
            <div>
              <h3 className="text-sm font-black uppercase tracking-tight text-slate-900 font-display flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-600" />
                <span>Private Ledger Logs</span>
              </h3>
              <p className="text-[10px] text-slate-500 font-medium">Complete record of income, expenses, and remittances</p>
            </div>

            <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
              <button
                id="btn-export-csv"
                onClick={handleExportCSV}
                className="px-2.5 py-1.5 bg-white hover:bg-slate-50 text-slate-900 border-2 border-slate-900 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition cursor-pointer flex items-center gap-1"
                title="Export CSV / Excel Report"
              >
                <Download className="w-3.5 h-3.5 text-slate-700" />
                <span>Export CSV</span>
              </button>

              <button
                onClick={() => setIsAddTxOpen(true)}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border-2 border-slate-900 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition cursor-pointer flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5 stroke-[3px]" />
                <span>Log Entry</span>
              </button>
            </div>
          </div>

          {/* QUICK SUMMARY CARDS */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {/* Inflow */}
            <div className="bg-emerald-50 border-2 border-slate-900 rounded-xl p-3 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-black text-emerald-800 uppercase tracking-wider font-mono">Inflow (Income)</span>
                <TrendingUp className="w-3.5 h-3.5 text-emerald-700 stroke-[2.5]" />
              </div>
              <span className="text-base sm:text-lg font-black text-emerald-900 font-mono block">
                +{renderCurrency(
                  filteredTransactions.filter(t => t.type === 'income').reduce((s, t) => s + (t.amount || 0), 0),
                  'EUR'
                )}
              </span>
            </div>

            {/* Outflow */}
            <div className="bg-rose-50 border-2 border-slate-900 rounded-xl p-3 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-black text-rose-800 uppercase tracking-wider font-mono">Outflow (Spend)</span>
                <TrendingDown className="w-3.5 h-3.5 text-rose-700 stroke-[2.5]" />
              </div>
              <span className="text-base sm:text-lg font-black text-rose-900 font-mono block">
                -{renderCurrency(
                  filteredTransactions.filter(t => t.type === 'expense' || t.type === 'remittance').reduce((s, t) => s + (t.amount || 0), 0),
                  'EUR'
                )}
              </span>
            </div>

            {/* Filtered Count */}
            <div className="bg-white border-2 border-slate-900 rounded-xl p-3 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] col-span-2 sm:col-span-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider font-mono">Ledger Records</span>
                <span className="text-[9px] font-mono font-bold px-1.5 py-0.5 bg-slate-100 border border-slate-300 rounded">
                  {filteredTransactions.length} items
                </span>
              </div>
              <span className="text-sm font-black text-slate-800 font-mono block truncate">
                {filterType === 'all' ? 'All Types' : filterType.toUpperCase()}
                {filterCategory !== 'all' ? ` • ${filterCategory}` : ''}
              </span>
            </div>
          </div>

          {/* SEARCH & FILTERS BAR */}
          <div className="bg-white border-2 border-slate-900 p-3 rounded-2xl shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)] space-y-2.5">
            {/* Search Input */}
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-8 py-2 bg-slate-50 border-2 border-slate-900 rounded-xl text-xs font-medium focus:bg-white focus:outline-none"
                placeholder="Search by title, category, or note..."
              />
              {searchQuery && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 p-1"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filters Row */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {/* Type Switcher Pills */}
              <div className="grid grid-cols-4 bg-slate-100 p-1 rounded-xl border-2 border-slate-900 gap-0.5 text-center">
                <button
                  type="button"
                  onClick={() => setFilterType('all')}
                  className={`py-1 text-[9px] font-black uppercase rounded-lg transition ${
                    filterType === 'all' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  All
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('expense')}
                  className={`py-1 text-[9px] font-black uppercase rounded-lg transition ${
                    filterType === 'expense' ? 'bg-slate-900 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Expense
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('income')}
                  className={`py-1 text-[9px] font-black uppercase rounded-lg transition ${
                    filterType === 'income' ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Income
                </button>
                <button
                  type="button"
                  onClick={() => setFilterType('remittance')}
                  className={`py-1 text-[9px] font-black uppercase rounded-lg transition ${
                    filterType === 'remittance' ? 'bg-indigo-600 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Nepal
                </button>
              </div>

              {/* Category Filter */}
              <div className="min-w-0">
                <select
                  value={filterCategory}
                  onChange={(e) => setFilterCategory(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border-2 border-slate-900 rounded-xl text-xs font-bold focus:outline-none"
                >
                  <option value="all">All Categories</option>
                  {PERSONAL_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              {/* Wallet Filter */}
              <div className="min-w-0">
                <select
                  value={filterAccount}
                  onChange={(e) => setFilterAccount(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-slate-50 border-2 border-slate-900 rounded-xl text-xs font-bold focus:outline-none"
                >
                  <option value="all">All Wallets</option>
                  {accounts.map(acc => (
                    <option key={acc.id} value={acc.id}>{acc.name}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* TRANSACTION FEED CARDS */}
          {filteredTransactions.length === 0 ? (
            <div className="py-12 px-4 text-center bg-white border-2 border-slate-900 rounded-2xl shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)] space-y-3">
              <div className="w-12 h-12 bg-slate-100 border-2 border-slate-900 rounded-2xl flex items-center justify-center mx-auto shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] text-slate-500">
                <Search className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h5 className="text-sm font-black text-slate-900 uppercase font-display">No Entries Found</h5>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">No personal transactions match your current search query or filter selection.</p>
              </div>
              <button
                onClick={() => {
                  setSearchQuery('');
                  setFilterType('all');
                  setFilterCategory('all');
                  setFilterAccount('all');
                }}
                className="px-3.5 py-1.5 bg-slate-100 border-2 border-slate-900 rounded-xl text-xs font-black uppercase tracking-wider hover:bg-slate-200 transition cursor-pointer"
              >
                Reset Filters
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {filteredTransactions.map((tx) => {
                const isExpense = tx.type === 'expense';
                const isIncome = tx.type === 'income';
                const isRemittance = tx.type === 'remittance';
                
                const accName = accounts.find(a => a.id === tx.accountId)?.name || 'Deleted Wallet';

                const formattedDate = new Date(tx.timestamp).toLocaleDateString('en-IE', {
                  day: '2-digit',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit'
                });

                return (
                  <div 
                    key={tx.id} 
                    className="p-3 sm:p-3.5 bg-white hover:bg-slate-50/80 border-2 border-slate-900 rounded-xl transition shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5"
                  >
                    {/* Left Details */}
                    <div className="flex items-start gap-3 min-w-0">
                      {/* Icon */}
                      <span className={`p-2.5 rounded-xl border-2 border-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] shrink-0 mt-0.5 ${
                        isIncome 
                          ? 'bg-emerald-100 text-emerald-800' 
                          : isRemittance 
                            ? 'bg-indigo-100 text-indigo-800' 
                            : 'bg-slate-100 text-slate-800'
                      }`}>
                        {isIncome ? (
                          <TrendingUp className="w-4 h-4 stroke-[2.5]" />
                        ) : isRemittance ? (
                          <Send className="w-4 h-4 stroke-[2.5]" />
                        ) : (
                          <TrendingDown className="w-4 h-4 stroke-[2.5]" />
                        )}
                      </span>

                      {/* Content */}
                      <div className="min-w-0 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h5 className="text-xs sm:text-sm font-black text-slate-900 truncate">{tx.title}</h5>
                          
                          <span className="px-1.5 py-0.2 bg-slate-100 text-slate-700 border border-slate-300 rounded text-[8px] font-black uppercase tracking-wider shrink-0 font-mono">
                            {tx.category}
                          </span>

                          <span className="px-1.5 py-0.2 bg-emerald-50 text-emerald-800 border border-emerald-200 rounded text-[8px] font-black uppercase shrink-0 font-mono">
                            {accName}
                          </span>
                        </div>

                        <p className="text-[10px] text-slate-500 font-medium">
                          {formattedDate}
                        </p>

                        {tx.notes && (
                          <p className="text-[10px] text-slate-600 bg-slate-50 border border-slate-200 px-2 py-0.5 rounded-lg inline-block truncate max-w-full">
                            {tx.notes}
                          </p>
                        )}

                        {tx.receiptUrl && (
                          <div className="pt-0.5">
                            <button
                              type="button"
                              onClick={() => setViewingReceipt({ url: tx.receiptUrl!, title: tx.title })}
                              className="inline-flex items-center gap-1 px-2 py-0.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-300 rounded-lg text-[9px] font-black uppercase cursor-pointer transition"
                            >
                              <Camera className="w-3 h-3 text-indigo-600" />
                              <span>View Attached Receipt</span>
                            </button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Right Amount & Delete */}
                    <div className="flex items-center justify-between sm:justify-end gap-3 shrink-0 pt-2 sm:pt-0 border-t sm:border-t-0 border-slate-100">
                      <div className="text-left sm:text-right">
                        <span className={`text-sm sm:text-base font-black font-mono block ${
                          isIncome ? 'text-emerald-700' : isRemittance ? 'text-indigo-700' : 'text-slate-900'
                        }`}>
                          {isIncome ? '+' : '-'}{renderCurrency(tx.amount, tx.currency)}
                        </span>
                        <span className="text-[8px] font-mono font-bold text-slate-400 uppercase block">
                          {tx.type}
                        </span>
                      </div>

                      <button
                        id={`btn-delete-tx-${tx.id}`}
                        onClick={() => handleDeleteTransaction(tx)}
                        className="p-1.5 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border-2 border-slate-900 rounded-lg transition shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] cursor-pointer"
                        title="Delete entry"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
          SUB-TAB C: SAVINGS BENCHMARKS & GOALS
          --------------------------------------------- */}
      {activeSection === 'savings' && (
        <div className="space-y-4 animate-fade-in">
          
          {/* HEADER & ADD BUTTON */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b-2 border-slate-200">
            <div>
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight font-display flex items-center gap-1.5">
                <Goal className="w-4 h-4 text-emerald-600" /> Savings Targets & Goals
              </h4>
              <p className="text-[10px] text-slate-500 font-medium">Set financial benchmarks, track progress, and allocate funds towards milestones</p>
            </div>
            
            <button
              id="btn-add-goal-open"
              onClick={() => setIsAddGoalOpen(true)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border-2 border-slate-900 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0 self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3px]" />
              <span>New Target Goal</span>
            </button>
          </div>

          {/* QUICK SAVINGS SUMMARY STATS */}
          {savingsGoals.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {(() => {
                const totalCurrent = savingsGoals.reduce((sum, g) => sum + g.currentAmount, 0);
                const totalTarget = savingsGoals.reduce((sum, g) => sum + g.targetAmount, 0);
                const completedCount = savingsGoals.filter(g => g.currentAmount >= g.targetAmount).length;
                const overallPercent = totalTarget > 0 ? Math.min((totalCurrent / totalTarget) * 100, 100) : 0;

                return (
                  <>
                    <div className="bg-emerald-50 border-2 border-slate-900 rounded-xl p-3 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                      <span className="text-[9px] font-black text-emerald-800 uppercase tracking-wider font-mono block">Total Accumulated</span>
                      <span className="text-base sm:text-lg font-black text-emerald-900 font-mono">
                        {renderCurrency(totalCurrent, 'EUR')}
                      </span>
                    </div>

                    <div className="bg-white border-2 border-slate-900 rounded-xl p-3 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider font-mono block">Target Capital</span>
                      <span className="text-base sm:text-lg font-black text-slate-900 font-mono">
                        {renderCurrency(totalTarget, 'EUR')}
                      </span>
                    </div>

                    <div className="bg-indigo-50 border-2 border-slate-900 rounded-xl p-3 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] col-span-2 sm:col-span-1">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[9px] font-black text-indigo-800 uppercase tracking-wider font-mono">Goal Status</span>
                        <span className="text-[9px] font-mono font-bold text-indigo-900">
                          {completedCount}/{savingsGoals.length} Done ({overallPercent.toFixed(0)}%)
                        </span>
                      </div>
                      
                      {/* Overall Progress bar */}
                      <div className="w-full bg-indigo-200 h-2 rounded-full border border-indigo-300 overflow-hidden mt-1">
                        <div 
                          className="bg-indigo-600 h-full rounded-full transition-all duration-500" 
                          style={{ width: `${overallPercent}%` }}
                        />
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* MAIN SAVINGS GOALS GRID */}
          {savingsGoals.length === 0 ? (
            <div className="py-12 px-4 text-center bg-white border-2 border-slate-900 rounded-2xl shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)] space-y-3">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 border-2 border-slate-900 rounded-2xl flex items-center justify-center mx-auto shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                <Goal className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h5 className="text-sm font-black text-slate-900 uppercase font-display">No Active Targets Set</h5>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">Create savings goals like emergency reserve, travel, electronics, or remittance targets to track your progress.</p>
              </div>
              <button
                onClick={() => setIsAddGoalOpen(true)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:bg-slate-800 transition cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4 stroke-[3px]" />
                <span>Create First Target</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {savingsGoals.map((goal) => {
                const percent = Math.min((goal.currentAmount / goal.targetAmount) * 100, 100);
                const isCompleted = goal.currentAmount >= goal.targetAmount;

                return (
                  <div 
                    key={goal.id} 
                    className={`p-3.5 sm:p-4 border-2 border-slate-900 rounded-2xl shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)] space-y-3 flex flex-col justify-between transition ${
                      isCompleted ? 'bg-emerald-50/70 border-emerald-900' : 'bg-white hover:bg-slate-50/60'
                    }`}
                  >
                    <div className="space-y-2.5">
                      {/* Top Header info */}
                      <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-2">
                        <div className="min-w-0">
                          <h5 className="text-xs sm:text-sm font-black text-slate-900 truncate">{goal.name}</h5>
                          <span className="text-[9px] font-mono font-bold text-slate-500 block mt-0.5">
                            Target Deadline: {goal.deadline || 'No Deadline'}
                          </span>
                        </div>
                        {isCompleted ? (
                          <span className="px-2 py-0.5 bg-emerald-100 text-emerald-800 text-[8px] font-black uppercase rounded-lg border border-emerald-300 shrink-0">
                            Goal Reached 🎉
                          </span>
                        ) : (
                          <span className="px-2 py-0.5 bg-slate-900 text-white text-[8px] font-black uppercase rounded-lg shrink-0">
                            In Progress 🎯
                          </span>
                        )}
                      </div>

                      {/* Amount Numbers */}
                      <div className="flex items-baseline justify-between font-mono">
                        <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">Accumulated</span>
                        <div className="text-right">
                          <span className="text-base font-black text-slate-900">
                            {renderCurrency(goal.currentAmount, goal.currency)}
                          </span>
                          <span className="text-slate-400 text-[10px] font-bold">
                            {' '}/ {renderCurrency(goal.targetAmount, goal.currency)}
                          </span>
                        </div>
                      </div>

                      {/* Visual Progress Bar */}
                      <div className="space-y-1">
                        <div className="w-full bg-slate-100 h-3 rounded-full border-2 border-slate-900 overflow-hidden p-0.5">
                          <div 
                            className={`h-full rounded-full transition-all duration-500 ${
                              isCompleted ? 'bg-emerald-500' : 'bg-indigo-600'
                            }`}
                            style={{ width: `${percent}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[9px] font-mono text-slate-500">
                          <span>Completion</span>
                          <span className="font-bold text-slate-900">{percent.toFixed(1)}%</span>
                        </div>
                      </div>

                      {goal.notes && (
                        <p className="text-[10px] text-slate-600 italic bg-slate-50 p-2 rounded-xl border border-slate-200 truncate">
                          {goal.notes}
                        </p>
                      )}
                    </div>

                    {/* Action Controls */}
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-200/80">
                      <button
                        id={`btn-contribute-goal-${goal.id}`}
                        onClick={() => {
                          setSelectedGoalForContribution(goal);
                          if (accounts.length > 0) {
                            setContribAccountId(accounts[0].id);
                          }
                        }}
                        className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border-2 border-slate-900 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] transition cursor-pointer flex items-center justify-center gap-1.5 min-h-[32px]"
                      >
                        <Plus className="w-3.5 h-3.5 stroke-[3px]" />
                        <span>Deposit Funds</span>
                      </button>

                      <button
                        id={`btn-delete-goal-${goal.id}`}
                        onClick={() => handleDeleteSavingsGoal(goal.id)}
                        className="p-2 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border-2 border-slate-900 rounded-xl transition cursor-pointer shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]"
                        title="Delete goal target"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
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
        <div className="space-y-4 animate-fade-in">
          
          {/* HEADER & ADD BUTTON */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-2 border-b-2 border-slate-200">
            <div>
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight font-display flex items-center gap-1.5">
                <CalendarIcon className="w-4 h-4 text-emerald-600" /> Recurring Bills &amp; Subscriptions
              </h4>
              <p className="text-[10px] text-slate-500 font-medium">Manage monthly bills, track due dates, and record payments</p>
            </div>
            
            <button
              id="btn-add-bill-open"
              onClick={() => setIsAddBillOpen(true)}
              className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border-2 border-slate-900 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition cursor-pointer flex items-center justify-center gap-1.5 shrink-0 self-start sm:self-auto"
            >
              <Plus className="w-3.5 h-3.5 stroke-[3px]" />
              <span>Add Bill Schedule</span>
            </button>
          </div>

          {/* QUICK BILLS SUMMARY STATS */}
          {recurringBills.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              <div className="bg-white border-2 border-slate-900 rounded-xl p-3 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider font-mono block">Active Schedules</span>
                <span className="text-base sm:text-lg font-black text-slate-900 font-mono">{recurringBills.length} Bills</span>
              </div>

              {(() => {
                const currentMonthYear = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
                const paidCount = recurringBills.filter(b => b.lastPaid && b.lastPaid.startsWith(currentMonthYear)).length;
                const pendingCount = recurringBills.length - paidCount;

                return (
                  <>
                    <div className="bg-emerald-50 border-2 border-slate-900 rounded-xl p-3 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                      <span className="text-[9px] font-black text-emerald-700 uppercase tracking-wider font-mono block">Paid This Month</span>
                      <span className="text-base sm:text-lg font-black text-emerald-800 font-mono">{paidCount} Settled</span>
                    </div>

                    <div className="bg-amber-50 border-2 border-slate-900 rounded-xl p-3 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] col-span-2 sm:col-span-1">
                      <span className="text-[9px] font-black text-amber-700 uppercase tracking-wider font-mono block">Pending Payments</span>
                      <span className="text-base sm:text-lg font-black text-amber-800 font-mono">{pendingCount} Due</span>
                    </div>
                  </>
                );
              })()}
            </div>
          )}

          {/* MAIN BILLS GRID & REMINDERS */}
          {recurringBills.length === 0 ? (
            <div className="py-12 px-4 text-center bg-white border-2 border-slate-900 rounded-2xl shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)] space-y-3">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 border-2 border-slate-900 rounded-2xl flex items-center justify-center mx-auto shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                <CalendarIcon className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h5 className="text-sm font-black text-slate-900 uppercase font-display">No Bill Schedules Yet</h5>
                <p className="text-xs text-slate-500 max-w-sm mx-auto">Set up recurring bills like rent, wifi, streaming, or mobile plans to get due date reminders.</p>
              </div>
              <button
                onClick={() => setIsAddBillOpen(true)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:bg-slate-800 transition cursor-pointer inline-flex items-center gap-1.5"
              >
                <Plus className="w-4 h-4 stroke-[3px]" />
                <span>Create First Schedule</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 items-start">
              
              {/* Active Schedules List */}
              <div className="bg-white border-2 border-slate-900 rounded-2xl p-3 sm:p-4 shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)] lg:col-span-2 space-y-3">
                <div className="border-b border-slate-100 pb-2 flex items-center justify-between">
                  <h5 className="text-xs font-black text-slate-900 uppercase font-display flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 text-slate-700" />
                    <span>Active Schedule List</span>
                  </h5>
                  <span className="text-[9px] font-mono text-slate-500 font-bold bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                    Sorted by Due Date
                  </span>
                </div>

                <div className="space-y-2.5">
                  {recurringBills.map((bill) => {
                    const currentMonthYear = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
                    const isPaidThisMonth = bill.lastPaid && bill.lastPaid.startsWith(currentMonthYear);

                    return (
                      <div key={bill.id} className="p-3 bg-slate-50 hover:bg-white border-2 border-slate-900 rounded-xl transition shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] space-y-2.5">
                        
                        {/* Top Row: Date Badge, Info & Amount */}
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-center gap-2.5 min-w-0">
                            {/* Date Badge */}
                            <div className="bg-slate-900 text-amber-400 border border-slate-900 rounded-xl p-1.5 shrink-0 font-mono text-center w-11 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]">
                              <span className="text-[7px] uppercase block font-black leading-none mb-0.5">Day</span>
                              <span className="text-sm font-black leading-none">{bill.dueDate}</span>
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <h5 className="text-xs sm:text-sm font-black text-slate-900 truncate">{bill.name}</h5>
                                <span className="px-1.5 py-0.2 bg-slate-200 text-slate-700 rounded text-[8px] font-black uppercase font-mono shrink-0">
                                  {bill.frequency}
                                </span>
                              </div>
                              <p className="text-[10px] text-slate-500 font-medium truncate mt-0.5">
                                {bill.category} {bill.notes ? `• ${bill.notes}` : ''}
                              </p>
                            </div>
                          </div>

                          {/* Amount */}
                          <div className="text-right shrink-0">
                            <span className="text-sm sm:text-base font-black font-mono text-slate-900 block">
                              {renderCurrency(bill.amount, bill.currency)}
                            </span>
                          </div>
                        </div>

                        {/* Bottom Row: Payment Status & Controls */}
                        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-200/80">
                          {/* Payment Status Pill */}
                          {isPaidThisMonth ? (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[9px] font-black uppercase">
                              <Check className="w-3 h-3 stroke-[3]" />
                              <span>Paid ({bill.lastPaid})</span>
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-100 text-amber-800 border border-amber-300 rounded-lg text-[9px] font-black uppercase">
                              <Clock className="w-3 h-3" />
                              <span>Due Day {bill.dueDate}</span>
                            </span>
                          )}

                          {/* Actions */}
                          <div className="flex items-center gap-2 ml-auto">
                            {!isPaidThisMonth && (
                              <select
                                defaultValue=""
                                onChange={(e) => {
                                  if (e.target.value) {
                                    handlePayBill(bill, e.target.value);
                                    e.target.value = '';
                                  }
                                }}
                                className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white border border-slate-900 rounded-lg text-[10px] font-black uppercase tracking-wider focus:outline-none transition cursor-pointer shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]"
                              >
                                <option value="" disabled className="bg-white text-slate-900">Pay Bill...</option>
                                {accounts.map(a => (
                                  <option key={a.id} value={a.id} className="bg-white text-slate-900">
                                    Pay from {a.name} ({renderCurrency(a.balance, a.currency, true)})
                                  </option>
                                ))}
                              </select>
                            )}

                            <button
                              id={`btn-delete-bill-${bill.id}`}
                              onClick={() => handleDeleteRecurringBill(bill.id)}
                              className="p-1.5 bg-white hover:bg-rose-50 text-slate-400 hover:text-rose-600 border border-slate-900 rounded-lg transition cursor-pointer shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]"
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

              {/* Payment Reminders Side Card */}
              <div className="bg-white border-2 border-slate-900 rounded-2xl p-3 sm:p-4 shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)] space-y-3">
                <div className="border-b border-slate-100 pb-2">
                  <h5 className="text-xs font-black text-slate-900 uppercase font-display flex items-center gap-1.5">
                    <Bell className="w-3.5 h-3.5 text-pink-500" />
                    <span>Payment Reminders</span>
                  </h5>
                </div>

                {(() => {
                  const unpaidUpcoming = recurringBills.filter(bill => {
                    const currentMonthYear = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;
                    return !bill.lastPaid || !bill.lastPaid.startsWith(currentMonthYear);
                  });

                  if (unpaidUpcoming.length === 0) {
                    return (
                      <div className="py-6 px-3 text-center bg-emerald-50 border border-emerald-200 rounded-xl space-y-1">
                        <span className="text-xl">🎉</span>
                        <p className="text-xs font-bold text-emerald-900">All Settled!</p>
                        <p className="text-[10px] text-emerald-700">All bill schedules are paid for this month.</p>
                      </div>
                    );
                  }

                  return (
                    <div className="space-y-2">
                      <p className="text-[10px] text-slate-500 font-bold">
                        Pending bills for this cycle ({unpaidUpcoming.length}):
                      </p>
                      
                      <div className="space-y-2">
                        {unpaidUpcoming.map(bill => (
                          <div key={bill.id} className="p-2.5 bg-amber-50 border-2 border-slate-900 rounded-xl flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <span className="text-xs font-black text-slate-900 block truncate">{bill.name}</span>
                              <span className="text-[9px] font-mono text-slate-500 block">Due Day {bill.dueDate}</span>
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
          1.5. MODAL: TRANSFER FUNDS BETWEEN WALLETS
          ============================================= */}
      {isTransferOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border-4 border-slate-900 rounded-[32px] max-w-lg w-full p-6 shadow-[10px_10px_0px_0px_rgba(15,23,42,1)] space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b-2 border-slate-100 pb-3">
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight font-display flex items-center gap-1.5">
                <ArrowLeftRight className="w-5 h-5 text-indigo-600" /> Transfer Funds Between Wallets
              </h4>
              <button 
                onClick={() => setIsTransferOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-lg border border-slate-200 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleTransferSubmit} className="space-y-4 text-xs">
              
              {/* Date of Transfer */}
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Transfer Date</label>
                <input
                  type="date"
                  required
                  value={transferDate}
                  onChange={(e) => setTransferDate(e.target.value)}
                  className="w-full p-2.5 border-2 border-slate-900 rounded-xl focus:outline-none font-mono"
                />
              </div>

              {/* Source & Destination Wallets */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Source Wallet</label>
                  <select
                    value={transferSourceId}
                    onChange={(e) => {
                      setTransferSourceId(e.target.value);
                      // If same as dest, clear dest
                      if (e.target.value === transferDestId) {
                        const other = accounts.find(a => a.id !== e.target.value);
                        if (other) setTransferDestId(other.id);
                      }
                    }}
                    className="w-full p-2.5 border-2 border-slate-900 rounded-xl bg-white font-medium focus:outline-none"
                  >
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({renderCurrency(acc.balance, acc.currency, true)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Destination Wallet</label>
                  <select
                    value={transferDestId}
                    onChange={(e) => setTransferDestId(e.target.value)}
                    className="w-full p-2.5 border-2 border-slate-900 rounded-xl bg-white font-medium focus:outline-none"
                  >
                    {accounts
                      .filter(acc => acc.id !== transferSourceId)
                      .map(acc => (
                        <option key={acc.id} value={acc.id}>
                          {acc.name} ({renderCurrency(acc.balance, acc.currency, true)})
                        </option>
                      ))}
                  </select>
                </div>
              </div>

              {/* Transfer Amount */}
              <div className="space-y-1">
                <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">
                  Amount to Send ({accounts.find(a => a.id === transferSourceId)?.currency || 'EUR'})
                </label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value)}
                  className="w-full p-2.5 border-2 border-slate-900 rounded-xl focus:outline-none font-mono font-bold"
                  placeholder="0.00"
                />
              </div>

              {/* Live Conversions & Exchange Rate Display */}
              {(() => {
                const srcAcc = accounts.find(a => a.id === transferSourceId);
                const dstAcc = accounts.find(a => a.id === transferDestId);
                if (!srcAcc || !dstAcc) return null;

                const isCrossCurrency = srcAcc.currency !== dstAcc.currency;
                const srcRate = exchangeRates[srcAcc.currency];
                const dstRate = exchangeRates[dstAcc.currency];
                const convRate = dstRate / srcRate;
                const amt = parseFloat(transferAmount) || 0;
                const received = amt * convRate;

                return (
                  <div className="p-4 bg-slate-50 border-2 border-slate-900 rounded-2xl space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black text-slate-500 uppercase tracking-wider">Exchange Rate</span>
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                        <span className="text-[8px] font-mono font-bold bg-emerald-100 text-emerald-800 px-1.5 py-0.5 rounded-md uppercase">
                          {isFetchingRates ? 'Fetching Rate...' : 'Live Rate'}
                        </span>
                      </div>
                    </div>

                    <div className="flex justify-between items-baseline border-b border-slate-100 pb-2">
                      <span className="text-[10px] font-medium text-slate-600">Rate Applied:</span>
                      <span className="text-xs font-mono font-bold text-slate-900">
                        1 {srcAcc.currency} = {convRate.toFixed(4)} {dstAcc.currency}
                      </span>
                    </div>

                    <div className="flex justify-between items-baseline pt-1">
                      <span className="text-[10px] font-black text-slate-900 uppercase">Destination Receives:</span>
                      <span className="text-sm font-mono font-black text-slate-900">
                        {renderCurrency(received, dstAcc.currency, true)}
                      </span>
                    </div>
                  </div>
                );
              })()}

              <button
                type="submit"
                className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white border-2 border-slate-900 rounded-xl font-black uppercase tracking-wider text-[11px] shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] cursor-pointer flex items-center justify-center gap-2"
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>Confirm Transfer</span>
              </button>
            </form>
          </div>
        </div>
      )}


      {/* =============================================
          1. MODAL: ADD PERSONAL TRANSACTION ENTRY
          ============================================= */}
      {isAddTxOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-[100] animate-fade-in overflow-y-auto">
          <div className="bg-white border-t-3 sm:border-3 border-slate-900 rounded-t-3xl sm:rounded-2xl max-w-lg w-full p-4 sm:p-5 shadow-[0px_-4px_0px_0px_rgba(15,23,42,1)] sm:shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] flex flex-col max-h-[92vh] sm:max-h-[85vh] my-0 sm:my-auto transition-all">
            
            {/* Header (Fixed Top) */}
            <div className="flex items-center justify-between border-b-2 border-slate-100 pb-2.5 shrink-0">
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight font-display flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-600" /> New Transaction
              </h4>
              <button 
                type="button"
                onClick={() => setIsAddTxOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-xl border border-slate-200 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleCreateTransaction} className="flex flex-col flex-1 min-h-0 pt-2">
              <div className="overflow-y-auto flex-1 space-y-3 text-xs pr-1 py-1">
                
                {/* Entry Type Switcher */}
                <div className="grid grid-cols-3 bg-slate-100 p-1 rounded-xl border-2 border-slate-900 w-full gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setTxType('expense');
                      setTxCategory(PERSONAL_CATEGORIES[0]);
                    }}
                    className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      txType === 'expense' 
                        ? 'bg-slate-900 text-white shadow-sm' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <TrendingDown className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Expense</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTxType('income');
                      setTxCategory('Salary/Earnings');
                    }}
                    className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      txType === 'income' 
                        ? 'bg-emerald-600 text-white shadow-sm' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <TrendingUp className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span>Income</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTxType('remittance');
                      setTxCategory('Nepal Remittance');
                    }}
                    className={`py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1 ${
                      txType === 'remittance' 
                        ? 'bg-indigo-600 text-white shadow-sm' 
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <Send className="w-3.5 h-3.5 stroke-[2.5]" />
                    <span className="truncate">Remittance</span>
                  </button>
                </div>

                {/* Title & Amount */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Title / Note</label>
                    <input
                      type="text"
                      required
                      value={txTitle}
                      onChange={(e) => setTxTitle(e.target.value)}
                      className="w-full p-2.5 border-2 border-slate-900 rounded-xl focus:outline-none focus:bg-slate-50 font-medium"
                      placeholder="e.g., Grocery, Rent, Salary"
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-1.5 items-end">
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
                        className="w-full p-2.5 border-2 border-slate-900 rounded-xl bg-white font-mono focus:outline-none text-xs"
                      >
                        <option value="EUR">EUR (€)</option>
                        <option value="NPR">NPR (रू)</option>
                        <option value="USD">USD ($)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Wallet & Category */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Wallet Account</label>
                    {accounts.length === 0 ? (
                      <p className="text-[10px] text-rose-500 font-bold p-2 bg-rose-50 rounded-xl border border-rose-200">Please add a wallet account first.</p>
                    ) : (
                      <select
                        required
                        value={txAccountId}
                        onChange={(e) => setTxAccountId(e.target.value)}
                        className="w-full p-2.5 border-2 border-slate-900 rounded-xl bg-white focus:outline-none"
                      >
                        {accounts.map(acc => (
                          <option key={acc.id} value={acc.id}>
                            {acc.name} ({renderCurrency(acc.balance, acc.currency, true)})
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

                {/* Date & Optional Notes */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Date</label>
                    <input
                      type="date"
                      required
                      value={txDate}
                      onChange={(e) => setTxDate(e.target.value)}
                      className="w-full p-2.5 border-2 border-slate-900 rounded-xl focus:outline-none font-mono"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Notes (Optional)</label>
                    <input
                      type="text"
                      value={txNotes}
                      onChange={(e) => setTxNotes(e.target.value)}
                      className="w-full p-2.5 border-2 border-slate-900 rounded-xl focus:outline-none"
                      placeholder="Optional details..."
                    />
                  </div>
                </div>

                {/* Optional Receipt Attachment */}
                <div className="border border-slate-200 rounded-xl p-2.5 bg-slate-50 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Camera className="w-4 h-4 text-slate-600 shrink-0" />
                    <div className="min-w-0">
                      <span className="text-[10px] font-bold text-slate-700 block truncate">
                        {receiptName ? receiptName : 'Attach Receipt / Photo'}
                      </span>
                      <span className="text-[8px] text-slate-400 font-mono block">JPG, PNG, PDF</span>
                    </div>
                  </div>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    id="personal-receipt-file-input"
                    onChange={handleReceiptChange}
                    className="hidden"
                  />
                  <label 
                    htmlFor="personal-receipt-file-input"
                    className="px-2.5 py-1 bg-white text-slate-900 border border-slate-900 rounded-lg text-[9px] font-black uppercase cursor-pointer hover:bg-slate-100 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] shrink-0"
                  >
                    {receiptName ? 'Change' : 'Browse'}
                  </label>
                </div>
              </div>

              {/* Sticky Action Footer (Always Visible at Bottom) */}
              <div className="flex gap-2 pt-3 border-t border-slate-100 bg-white shrink-0 mt-2">
                <button
                  type="button"
                  onClick={() => setIsAddTxOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border-2 border-slate-900 rounded-xl font-black uppercase tracking-wider cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={accounts.length === 0}
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white border-2 border-slate-900 rounded-xl font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] cursor-pointer disabled:opacity-50 text-xs"
                >
                  Save Entry
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
          3. MODAL: EDIT CUSTOM ACCOUNT WALLET
          ============================================= */}
      {isEditAccountOpen && editingAccount && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white border-4 border-slate-900 rounded-[32px] max-w-sm w-full p-6 shadow-[10px_10px_0px_0px_rgba(15,23,42,1)] space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2">
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight font-display">Edit Account Wallet</h4>
              <button 
                onClick={() => {
                  setIsEditAccountOpen(false);
                  setEditingAccount(null);
                }}
                className="p-1.5 hover:bg-slate-100 rounded-lg transition border border-slate-200 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleEditAccountSubmit} className="space-y-4 text-xs">
              
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
                <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Current balance</label>
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
                  onClick={() => {
                    setIsEditAccountOpen(false);
                    setEditingAccount(null);
                  }}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border-2 border-slate-900 rounded-xl font-black uppercase tracking-wider cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white border-2 border-slate-900 rounded-xl font-black uppercase tracking-wider shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] cursor-pointer"
                >
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =============================================
          2.6. MODAL: INDIVIDUAL BANK STATEMENT
          ============================================= */}
      {selectedStatementAccount && (() => {
        const activeAcc = accounts.find(a => a.id === selectedStatementAccount.id) || selectedStatementAccount;
        const accountTxs = transactions.filter(t => t.accountId === activeAcc.id);
        const searchedTxs = accountTxs.filter(t => 
          t.title.toLowerCase().includes(statementSearchQuery.toLowerCase()) || 
          t.category.toLowerCase().includes(statementSearchQuery.toLowerCase()) ||
          (t.notes && t.notes.toLowerCase().includes(statementSearchQuery.toLowerCase()))
        );

        const totalMoneyIn = accountTxs
          .filter(t => t.type === 'income')
          .reduce((sum, t) => sum + t.amount, 0);

        const totalMoneyOut = accountTxs
          .filter(t => t.type === 'expense' || t.type === 'remittance')
          .reduce((sum, t) => sum + t.amount, 0);

        const isCash = activeAcc.type === 'Cash';
        const isBank = activeAcc.type === 'Bank Account';
        const isRevolut = activeAcc.type === 'Revolut';

        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
            <div className="bg-white border-4 border-slate-900 rounded-[32px] max-w-2xl w-full p-6 shadow-[10px_10px_0px_0px_rgba(15,23,42,1)] space-y-5">
              
              {/* Header */}
              <div className="flex items-center justify-between border-b-2 border-slate-100 pb-3">
                <div>
                  <h4 className="text-sm sm:text-base font-black text-slate-900 uppercase tracking-tight font-display flex items-center gap-2">
                    <span className={`p-1.5 rounded-lg border border-slate-900/20 ${
                      isCash ? 'bg-amber-100 text-amber-700' : isBank ? 'bg-indigo-100 text-indigo-700' : isRevolut ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {isCash ? <Coins className="w-4 h-4" /> : isBank ? <CreditCard className="w-4 h-4" /> : isRevolut ? <Wallet className="w-4 h-4" /> : <Send className="w-4 h-4" />}
                    </span>
                    <span>{activeAcc.name} Statement</span>
                  </h4>
                  <p className="text-[10px] text-slate-400 font-mono font-bold mt-1 uppercase tracking-wide">
                    {activeAcc.type} • Base Currency: {activeAcc.currency}
                  </p>
                </div>
                <button 
                  onClick={() => setSelectedStatementAccount(null)}
                  className="p-1.5 hover:bg-slate-100 rounded-lg transition border-2 border-slate-900 cursor-pointer shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]"
                >
                  <X className="w-4 h-4 stroke-[2.5]" />
                </button>
              </div>

              {/* Quick Summary Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="p-3.5 bg-slate-50 border-2 border-slate-900 rounded-2xl shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
                  <span className="text-[9px] font-black uppercase text-slate-500 block font-mono">Current Balance</span>
                  <span className="text-base sm:text-lg font-black text-slate-900 font-mono">
                    {renderCurrency(activeAcc.balance, activeAcc.currency)}
                  </span>
                  {activeAcc.currency !== 'EUR' && (
                    <span className="text-[9px] font-mono text-slate-400 block mt-0.5">
                      ≈ {renderCurrency(convertToEUR(activeAcc.balance, activeAcc.currency), 'EUR')} EUR
                    </span>
                  )}
                </div>

                <div className="p-3.5 bg-emerald-50 border-2 border-slate-900 rounded-2xl shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
                  <span className="text-[9px] font-black uppercase text-emerald-700 block font-mono flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 stroke-[3]" /> Money In
                  </span>
                  <span className="text-base sm:text-lg font-black text-emerald-800 font-mono">
                    + {renderCurrency(totalMoneyIn, activeAcc.currency)}
                  </span>
                  <span className="text-[9px] font-mono text-emerald-600/70 block mt-0.5">
                    Total Income Added
                  </span>
                </div>

                <div className="p-3.5 bg-rose-50 border-2 border-slate-900 rounded-2xl shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
                  <span className="text-[9px] font-black uppercase text-rose-700 block font-mono flex items-center gap-1">
                    <TrendingDown className="w-3 h-3 stroke-[3]" /> Money Out
                  </span>
                  <span className="text-base sm:text-lg font-black text-rose-800 font-mono">
                    - {renderCurrency(totalMoneyOut, activeAcc.currency)}
                  </span>
                  <span className="text-[9px] font-mono text-rose-600/70 block mt-0.5">
                    Total Spent/Transferred
                  </span>
                </div>
              </div>

              {/* Action Toolbar */}
              <div className="bg-indigo-50/50 p-3 rounded-2xl border-2 border-slate-900 flex flex-wrap gap-2.5 items-center justify-between">
                <span className="text-[9px] sm:text-[10px] font-black text-indigo-900 uppercase tracking-wide font-mono">
                  Wallet Controls:
                </span>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      openEditAccount(e, activeAcc);
                      setSelectedStatementAccount(null);
                    }}
                    className="px-2.5 py-1.5 bg-white hover:bg-indigo-50 text-slate-800 border-2 border-slate-900 rounded-xl text-[10px] font-extrabold flex items-center gap-1 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] cursor-pointer"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>Edit Wallet</span>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      handleDeleteAccount(e, activeAcc.id, activeAcc.name);
                      setSelectedStatementAccount(null);
                    }}
                    className="px-2.5 py-1.5 bg-rose-500 hover:bg-rose-600 text-white border-2 border-slate-900 rounded-xl text-[10px] font-extrabold flex items-center gap-1 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] cursor-pointer"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Delete Wallet</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveSection('transactions');
                      setFilterAccount(activeAcc.id);
                      setSelectedStatementAccount(null);
                    }}
                    className="px-2.5 py-1.5 bg-indigo-600 hover:bg-indigo-700 text-white border-2 border-slate-900 rounded-xl text-[10px] font-extrabold flex items-center gap-1 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] cursor-pointer"
                  >
                    <Filter className="w-3.5 h-3.5" />
                    <span>Show in Ledger</span>
                  </button>
                </div>
              </div>

              {/* Transactions list */}
              <div className="space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h5 className="text-[10px] font-black uppercase text-slate-800 tracking-wider font-mono">
                    Ledger Statement Entries ({searchedTxs.length})
                  </h5>
                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
                    <input
                      type="text"
                      placeholder="Search statement..."
                      value={statementSearchQuery}
                      onChange={(e) => setStatementSearchQuery(e.target.value)}
                      className="w-full bg-slate-50 border-2 border-slate-900 rounded-lg pl-8 pr-2.5 py-1 text-[11px] font-bold outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="border-4 border-slate-900 rounded-2xl overflow-hidden bg-white">
                  <div className="max-h-56 overflow-y-auto divide-y-2 divide-slate-100">
                    {searchedTxs.length === 0 ? (
                      <p className="text-center text-[11px] text-slate-400 py-8 font-medium">
                        No transactions registered under this account wallet.
                      </p>
                    ) : (
                      searchedTxs.map((tx) => {
                        const isIncome = tx.type === 'income';
                        const dateObj = new Date(tx.timestamp);
                        const formattedDate = dateObj.toLocaleDateString('default', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric'
                        });

                        return (
                          <div key={tx.id} className="p-3 flex items-center justify-between gap-4 hover:bg-slate-50 transition duration-150">
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className={`w-2 h-2 rounded-full ${isIncome ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                <span className="text-xs font-black text-slate-900 truncate block">{tx.title}</span>
                              </div>
                              <div className="flex items-center gap-2 mt-0.5 text-[10px] text-slate-400 font-medium">
                                <span className="font-semibold bg-slate-100 px-1.5 py-0.5 rounded text-slate-600">{tx.category}</span>
                                <span>•</span>
                                <span className="font-mono">{formattedDate}</span>
                              </div>
                              {tx.notes && (
                                <p className="text-[10px] text-slate-500 mt-1 italic pl-4 border-l-2 border-slate-200">{tx.notes}</p>
                              )}
                            </div>

                            <div className="flex items-center gap-3">
                              <span className={`text-xs font-black font-mono ${isIncome ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {isIncome ? '+' : '-'} {renderCurrency(tx.amount, tx.currency)}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDeleteTransaction(tx)}
                                className="p-1 hover:bg-rose-50 hover:text-rose-600 text-slate-400 rounded transition cursor-pointer border border-transparent hover:border-rose-200"
                                title="Delete entry"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>

            </div>
          </div>
        );
      })()}

      {/* =============================================
          4. MODAL: ADD SAVINGS GOAL TARGET
          ============================================= */}
      {isAddGoalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-[100] animate-fade-in overflow-y-auto">
          <div className="bg-white border-t-3 sm:border-3 border-slate-900 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-4 sm:p-5 shadow-[0px_-4px_0px_0px_rgba(15,23,42,1)] sm:shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] flex flex-col max-h-[92vh] sm:max-h-[85vh] my-0 sm:my-auto transition-all">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b-2 border-slate-100 pb-2.5 shrink-0">
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight font-display flex items-center gap-1.5">
                <Goal className="w-4 h-4 text-emerald-600" /> New Savings Goal
              </h4>
              <button 
                type="button"
                onClick={() => setIsAddGoalOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-xl border border-slate-200 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form */}
            <form onSubmit={handleCreateSavingsGoal} className="flex flex-col flex-1 min-h-0 pt-2">
              <div className="overflow-y-auto flex-1 space-y-3 text-xs pr-1 py-1">
                
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Goal Title / Milestone</label>
                  <input
                    type="text"
                    required
                    value={goalName}
                    onChange={(e) => setGoalName(e.target.value)}
                    className="w-full p-2.5 border-2 border-slate-900 rounded-xl focus:outline-none font-medium text-xs"
                    placeholder="e.g., Summer Trip, Emergency Reserve, New Bike"
                  />
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Target Amount</label>
                    <input
                      type="number"
                      step="1"
                      required
                      value={goalTarget}
                      onChange={(e) => setGoalTarget(e.target.value)}
                      className="w-full p-2.5 border-2 border-slate-900 rounded-xl focus:outline-none font-mono font-bold text-xs"
                      placeholder="e.g., 2000"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Currency</label>
                    <select
                      value={goalCurrency}
                      onChange={(e) => setGoalCurrency(e.target.value as any)}
                      className="w-full p-2.5 border-2 border-slate-900 rounded-xl bg-white focus:outline-none font-mono text-xs"
                    >
                      <option value="EUR">EUR (€)</option>
                      <option value="NPR">NPR (रू)</option>
                      <option value="USD">USD ($)</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Starting Saved Amount</label>
                    <input
                      type="number"
                      value={goalCurrent}
                      onChange={(e) => setGoalCurrent(e.target.value)}
                      className="w-full p-2.5 border-2 border-slate-900 rounded-xl focus:outline-none font-mono text-xs"
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
                      className="w-full p-2.5 border-2 border-slate-900 rounded-xl focus:outline-none font-mono text-xs"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Private Notes (Optional)</label>
                  <input
                    type="text"
                    value={goalNotes}
                    onChange={(e) => setGoalNotes(e.target.value)}
                    className="w-full p-2.5 border-2 border-slate-900 rounded-xl focus:outline-none text-xs"
                    placeholder="e.g., plan to save 100 EUR monthly"
                  />
                </div>

              </div>

              {/* Action Footer */}
              <div className="flex gap-2 pt-3 border-t border-slate-100 bg-white shrink-0 mt-2">
                <button
                  type="button"
                  onClick={() => setIsAddGoalOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border-2 border-slate-900 rounded-xl font-black uppercase tracking-wider cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white border-2 border-slate-900 rounded-xl font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] cursor-pointer text-xs"
                >
                  Create Target
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-[100] animate-fade-in overflow-y-auto">
          <div className="bg-white border-t-3 sm:border-3 border-slate-900 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-4 sm:p-5 shadow-[0px_-4px_0px_0px_rgba(15,23,42,1)] sm:shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] flex flex-col max-h-[92vh] sm:max-h-[85vh] my-0 sm:my-auto transition-all">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b-2 border-slate-100 pb-2.5 shrink-0">
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight font-display flex items-center gap-1.5 truncate">
                <Goal className="w-4 h-4 text-emerald-600 shrink-0" /> Deposit to {selectedGoalForContribution.name}
              </h4>
              <button 
                type="button"
                onClick={() => setSelectedGoalForContribution(null)}
                className="p-1.5 hover:bg-slate-100 rounded-xl border border-slate-200 transition cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleContributeGoalSubmit} className="flex flex-col flex-1 min-h-0 pt-2">
              <div className="overflow-y-auto flex-1 space-y-3 text-xs pr-1 py-1">
                
                {/* Goal Info Card */}
                <div className="p-3 bg-emerald-50 border-2 border-slate-900 rounded-xl flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[9px] font-black text-emerald-800 uppercase block font-mono">Current Goal Progress</span>
                    <span className="text-sm font-black text-slate-900 font-mono">
                      {renderCurrency(selectedGoalForContribution.currentAmount, selectedGoalForContribution.currency)} / {renderCurrency(selectedGoalForContribution.targetAmount, selectedGoalForContribution.currency)}
                    </span>
                  </div>
                  {(() => {
                    const remaining = Math.max(0, selectedGoalForContribution.targetAmount - selectedGoalForContribution.currentAmount);
                    return (
                      <button
                        type="button"
                        onClick={() => setContribAmount(remaining.toString())}
                        className="px-2 py-1 bg-emerald-600 text-white rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-emerald-700 transition"
                      >
                        Fill Remaining
                      </button>
                    );
                  })()}
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Source Wallet / Account</label>
                  <select
                    required
                    value={contribAccountId}
                    onChange={(e) => setContribAccountId(e.target.value)}
                    className="w-full p-2.5 border-2 border-slate-900 rounded-xl bg-white focus:outline-none font-medium"
                  >
                    {accounts.map(acc => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name} ({renderCurrency(acc.balance, acc.currency, true)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Deposit Amount ({selectedGoalForContribution.currency})</label>
                  <input
                    type="number"
                    step="1"
                    required
                    value={contribAmount}
                    onChange={(e) => setContribAmount(e.target.value)}
                    className="w-full p-2.5 border-2 border-slate-900 rounded-xl focus:outline-none font-mono font-bold text-sm"
                    placeholder="0.00"
                  />
                </div>

                <div className="p-3 bg-slate-50 border-2 border-slate-900 rounded-xl flex items-start gap-2 text-[10px] text-slate-600 font-bold leading-normal">
                  <Info className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                  <span>Deducts amount from selected wallet, credits goal, and records an entry in your ledger automatically.</span>
                </div>

              </div>

              {/* Action Footer */}
              <div className="flex gap-2 pt-3 border-t border-slate-100 bg-white shrink-0 mt-2">
                <button
                  type="button"
                  onClick={() => setSelectedGoalForContribution(null)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border-2 border-slate-900 rounded-xl font-black uppercase tracking-wider cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white border-2 border-slate-900 rounded-xl font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] cursor-pointer text-xs"
                >
                  Confirm Deposit
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
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4 z-[100] animate-fade-in overflow-y-auto">
          <div className="bg-white border-t-3 sm:border-3 border-slate-900 rounded-t-3xl sm:rounded-2xl max-w-md w-full p-4 sm:p-5 shadow-[0px_-4px_0px_0px_rgba(15,23,42,1)] sm:shadow-[6px_6px_0px_0px_rgba(15,23,42,1)] flex flex-col max-h-[92vh] sm:max-h-[85vh] my-0 sm:my-auto transition-all">
            
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b-2 border-slate-100 pb-2.5 shrink-0">
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight font-display flex items-center gap-1.5">
                <CalendarIcon className="w-4 h-4 text-emerald-600" /> New Bill Schedule
              </h4>
              <button 
                type="button"
                onClick={() => setIsAddBillOpen(false)}
                className="p-1.5 hover:bg-slate-100 rounded-xl border border-slate-200 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Scrollable Form Body */}
            <form onSubmit={handleCreateRecurringBill} className="flex flex-col flex-1 min-h-0 pt-2">
              <div className="overflow-y-auto flex-1 space-y-3 text-xs pr-1 py-1">
                
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Bill Name / Provider</label>
                  <input
                    type="text"
                    required
                    value={billName}
                    onChange={(e) => setBillName(e.target.value)}
                    className="w-full p-2.5 border-2 border-slate-900 rounded-xl focus:outline-none font-medium"
                    placeholder="e.g., Netflix, Rent, Wifi, Insurance"
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="grid grid-cols-3 gap-1.5 items-end">
                    <div className="col-span-2 space-y-1">
                      <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Amount</label>
                      <input
                        type="number"
                        step="0.01"
                        required
                        value={billAmount}
                        onChange={(e) => setBillAmount(e.target.value)}
                        className="w-full p-2.5 border-2 border-slate-900 rounded-xl focus:outline-none font-mono font-bold"
                        placeholder="0.00"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Currency</label>
                      <select
                        value={billCurrency}
                        onChange={(e) => setBillCurrency(e.target.value as any)}
                        className="w-full p-2.5 border-2 border-slate-900 rounded-xl bg-white focus:outline-none font-mono text-xs"
                      >
                        <option value="EUR">EUR (€)</option>
                        <option value="NPR">NPR (रू)</option>
                        <option value="USD">USD ($)</option>
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Due Day</label>
                      <input
                        type="number"
                        min="1"
                        max="31"
                        required
                        value={billDueDate}
                        onChange={(e) => setBillDueDate(e.target.value)}
                        className="w-full p-2.5 border-2 border-slate-900 rounded-xl focus:outline-none font-mono font-bold"
                        placeholder="e.g. 5"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Frequency</label>
                      <select
                        value={billFrequency}
                        onChange={(e) => setBillFrequency(e.target.value as any)}
                        className="w-full p-2.5 border-2 border-slate-900 rounded-xl bg-white focus:outline-none text-xs"
                      >
                        <option value="Monthly">Monthly</option>
                        <option value="Weekly">Weekly</option>
                        <option value="Yearly">Yearly</option>
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
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
                    <label className="text-[9px] font-black text-slate-500 block uppercase font-mono">Notes (Optional)</label>
                    <input
                      type="text"
                      value={billNotes}
                      onChange={(e) => setBillNotes(e.target.value)}
                      className="w-full p-2.5 border-2 border-slate-900 rounded-xl focus:outline-none"
                      placeholder="e.g., account #, details"
                    />
                  </div>
                </div>

              </div>

              {/* Sticky Action Footer */}
              <div className="flex gap-2 pt-3 border-t border-slate-100 bg-white shrink-0 mt-2">
                <button
                  type="button"
                  onClick={() => setIsAddBillOpen(false)}
                  className="flex-1 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 border-2 border-slate-900 rounded-xl font-black uppercase tracking-wider cursor-pointer text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white border-2 border-slate-900 rounded-xl font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] cursor-pointer text-xs"
                >
                  Save Schedule
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* =============================================
          RECEIPT LIGHTBOX PREVIEW MODAL
          ============================================= */}
      {viewingReceipt && (
        <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md flex items-center justify-center p-4 z-[110] animate-fade-in">
          <div className="bg-white border-3 border-slate-900 rounded-2xl max-w-lg w-full p-4 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] space-y-3 flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between border-b-2 border-slate-100 pb-2">
              <div className="flex items-center gap-2 min-w-0">
                <Camera className="w-4 h-4 text-indigo-600 shrink-0" />
                <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight truncate">
                  {viewingReceipt.title || 'Receipt Image'}
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setViewingReceipt(null)}
                className="p-1.5 hover:bg-slate-100 rounded-xl border border-slate-200 transition cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 overflow-auto flex items-center justify-center bg-slate-900/5 rounded-xl border-2 border-slate-900 p-2 min-h-[250px]">
              <img
                src={viewingReceipt.url}
                alt="Receipt Document"
                className="max-w-full max-h-[60vh] object-contain rounded-lg shadow-md"
              />
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="button"
                onClick={() => setViewingReceipt(null)}
                className="px-4 py-2 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:bg-slate-800 transition cursor-pointer"
              >
                Close Preview
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =============================================
          CUSTOM CONFIRMATION DIALOG MODAL
          ============================================= */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-fade-in">
          <div className="bg-white border-4 border-slate-900 rounded-[32px] max-w-sm w-full p-6 shadow-[10px_10px_0px_0px_rgba(15,23,42,1)] space-y-4">
            <div className="flex items-center gap-2.5 text-rose-600 border-b border-slate-100 pb-2">
              <AlertTriangle className="w-5 h-5 stroke-[2.5]" />
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight font-display">{confirmDialog.title}</h4>
            </div>
            
            <p className="text-xs text-slate-600 font-medium leading-relaxed font-mono">
              {confirmDialog.message}
            </p>

            <div className="flex gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setConfirmDialog(prev => ({ ...prev, isOpen: false }))}
                className="flex-1 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 border-2 border-slate-900 rounded-xl font-black uppercase tracking-wider text-[11px] cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={async () => {
                  const action = confirmDialog.onConfirm;
                  setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                  if (action) {
                    await action();
                  }
                }}
                className="flex-1 py-2 bg-rose-600 hover:bg-rose-700 text-white border-2 border-slate-900 rounded-xl font-black uppercase tracking-wider text-[11px] shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] cursor-pointer"
              >
                Confirm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =============================================
          CUSTOM ALERT DIALOG MODAL
          ============================================= */}
      {alertDialog.isOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4 z-[60] animate-fade-in">
          <div className="bg-white border-4 border-slate-900 rounded-[32px] max-w-sm w-full p-6 shadow-[10px_10px_0px_0px_rgba(15,23,42,1)] space-y-4">
            <div className="flex items-center gap-2.5 text-indigo-600 border-b border-slate-100 pb-2">
              <Info className="w-5 h-5 stroke-[2.5]" />
              <h4 className="text-sm font-black text-slate-900 uppercase tracking-tight font-display">{alertDialog.title}</h4>
            </div>
            
            <p className="text-xs text-slate-600 font-medium leading-relaxed font-mono">
              {alertDialog.message}
            </p>

            <div className="flex pt-2">
              <button
                type="button"
                onClick={() => setAlertDialog(prev => ({ ...prev, isOpen: false }))}
                className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 text-white border-2 border-slate-900 rounded-xl font-black uppercase tracking-wider text-[11px] shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] cursor-pointer"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
