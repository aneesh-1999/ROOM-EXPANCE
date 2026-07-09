import React, { useState, useEffect } from 'react';
import { Roommate, Profile, Expense, Category, LoginLog } from '../types';
import { 
  getProfile, 
  updateProfile, 
  addExpense, 
  deleteExpense, 
  confirmExpense, 
  cancelDeleteExpense,
  subscribeLoginLogs
} from '../dbService';
import CustomConfirmModal from './CustomConfirmModal';
import { 
  X, 
  Wrench, 
  ShieldAlert, 
  Users, 
  Key, 
  Database, 
  Trash2, 
  PlusCircle, 
  RefreshCw, 
  Check, 
  AlertCircle, 
  Eye, 
  EyeOff, 
  Coins,
  ArrowRightLeft,
  Search,
  SlidersHorizontal,
  Clock,
  Lock,
  Unlock,
  Tag,
  CheckCircle,
  BellRing,
  Send,
  Copy,
  Download,
  Menu
} from 'lucide-react';
import { 
  getDiscordSettings, 
  saveDiscordSettings, 
  testDiscordWebhook, 
  DiscordSettings,
  DEFAULT_DISCORD_SETTINGS
} from '../discordService';

interface AdminPanelModalProps {
  expenses: Expense[];
  currentUser?: Roommate;
  onClose: () => void;
  onRefreshNicknames: () => void;
  isStandalone?: boolean;
}

type AdminTab = 'ledger' | 'profiles' | 'discord' | 'security' | 'maintenance';

export default function AdminPanelModal({ expenses, currentUser: propCurrentUser, onClose, onRefreshNicknames, isStandalone = false }: AdminPanelModalProps) {
  const currentUser = isStandalone ? 'Ozric' : propCurrentUser;
  const isSuperAdmin = currentUser === 'Ozric';
  const [activeTab, setActiveTab] = useState<AdminTab>('ledger');
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Discord Settings State
  const [discordSettings, setDiscordSettings] = useState<DiscordSettings>(DEFAULT_DISCORD_SETTINGS);
  const [testLoading, setTestLoading] = useState(false);

  // Profiles
  const [ozricProfile, setOzricProfile] = useState<Profile | null>(null);
  const [pawanProfile, setPawanProfile] = useState<Profile | null>(null);
  const [adminProfile, setAdminProfile] = useState<any>(null);
  const [adminNewPass, setAdminNewPass] = useState('');
  const [showAdminPass, setShowAdminPass] = useState(false);
  const [isGeneratingCodes, setIsGeneratingCodes] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Security Audit Log & Controls State
  const [loginLogs, setLoginLogs] = useState<LoginLog[]>([]);
  const [securitySearchQuery, setSecuritySearchQuery] = useState('');
  const [securityStatusFilter, setSecurityStatusFilter] = useState<'all' | 'Success' | 'Failed' | 'Locked'>('all');
  const [securityUserFilter, setSecurityUserFilter] = useState<'all' | 'Ozric' | 'Pawan'>('all');

  useEffect(() => {
    const unsubscribe = subscribeLoginLogs(
      (data) => {
        setLoginLogs(data);
      },
      (err) => {
        console.error("Failed to load security logs:", err);
      }
    );
    return () => unsubscribe();
  }, []);
  
  // Nicknames & Passwords Form
  const [ozricNick, setOzricNick] = useState('');
  const [ozricPass, setOzricPass] = useState('');
  const [pawanNick, setPawanNick] = useState('');
  const [pawanPass, setPawanPass] = useState('');

  // Password View Visibility
  const [showOzricPass, setShowOzricPass] = useState(false);
  const [showPawanPass, setShowPawanPass] = useState(false);

  // Ledger Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'confirmed' | 'pending' | 'deleteRequested'>('all');
  const [typeFilter, setTypeFilter] = useState<'all' | 'regular' | 'coin' | 'loan' | 'settlement'>('all');

  // Pruning Safety Input
  const [confirmInput, setConfirmInput] = useState('');

  // State for Custom Confirmation Modal
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }>({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => {}
  });

  const showConfirm = (options: {
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    isDestructive?: boolean;
    onConfirm: () => void;
  }) => {
    setConfirmState({
      isOpen: true,
      ...options
    });
  };

  const closeConfirm = () => {
    setConfirmState(prev => ({ ...prev, isOpen: false }));
  };

  // Fetch Roommate Nicknames mapping
  const roommatesNicknames: Record<Roommate, string> = {
    Ozric: ozricNick || 'Ozric',
    Pawan: pawanNick || 'Pawan'
  };

  useEffect(() => {
    async function loadAllProfilesAndSettings() {
      setLoading(true);
      setErrorMsg('');
      try {
        const ozricData = await getProfile('Ozric');
        const pawanData = await getProfile('Pawan');
        const adminData = await getProfile('admin');
        const discSettings = await getDiscordSettings();

        if (ozricData) {
          setOzricProfile(ozricData);
          setOzricNick(ozricData.nickname || 'Ozric');
          setOzricPass(ozricData.password || '1234');
        }
        if (pawanData) {
          setPawanProfile(pawanData);
          setPawanNick(pawanData.nickname || 'Pawan');
          setPawanPass(pawanData.password || '1234');
        }
        if (adminData) {
          setAdminProfile(adminData);
        }
        if (discSettings) {
          setDiscordSettings(discSettings);
        }
      } catch (err: any) {
        setErrorMsg('Failed to load roommate profiles and configurations: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
    loadAllProfilesAndSettings();
  }, []);

  // Compute Metrics
  const coinExpenses = expenses.filter(e => e.isCoin);
  const settlementExpenses = expenses.filter(e => e.isSettlement);
  const lendBorrowExpenses = expenses.filter(e => e.isLendBorrow);
  const regularExpenses = expenses.filter(e => !e.isCoin && !e.isSettlement && !e.isLendBorrow);
  const totalAmount = expenses.reduce((sum, e) => sum + e.amount, 0);

  // Filtered expenses for Administration
  const filteredExpenses = expenses.filter(exp => {
    // Search query matches title, notes, or creator/payer
    const matchesSearch = 
      exp.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (exp.notes && exp.notes.toLowerCase().includes(searchQuery.toLowerCase())) ||
      exp.paidBy.toLowerCase().includes(searchQuery.toLowerCase());

    // Status Filter
    let matchesStatus = true;
    if (statusFilter === 'confirmed') matchesStatus = exp.status === 'confirmed' && !exp.deleteRequested;
    else if (statusFilter === 'pending') matchesStatus = exp.status === 'pending';
    else if (statusFilter === 'deleteRequested') matchesStatus = exp.deleteRequested === true;

    // Type Filter
    let matchesType = true;
    if (typeFilter === 'coin') matchesType = exp.isCoin === true;
    else if (typeFilter === 'loan') matchesType = exp.isLendBorrow === true;
    else if (typeFilter === 'settlement') matchesType = exp.isSettlement === true;
    else if (typeFilter === 'regular') matchesType = !exp.isCoin && !exp.isLendBorrow && !exp.isSettlement;

    return matchesSearch && matchesStatus && matchesType;
  });

  // Action: Override roommate profile
  const handleUpdateUser = async (user: Roommate, nickname: string, pass: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    if (!nickname.trim()) {
      setErrorMsg(`${user} nickname cannot be empty.`);
      return;
    }
    if (!pass.trim()) {
      setErrorMsg(`${user} password cannot be empty.`);
      return;
    }

    setActionLoading(true);
    try {
      await updateProfile(user, {
        nickname: nickname.trim(),
        password: pass.trim()
      }, `${currentUser} (Admin)`);
      setSuccessMsg(`Updated ${user}'s profile successfully!`);
      onRefreshNicknames();
    } catch (err: any) {
      setErrorMsg(`Failed to update ${user}: ` + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Reset both passwords
  const handleResetPasswords = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setActionLoading(true);
    try {
      await updateProfile('Ozric', { password: '1234' }, `${currentUser} (Admin)`);
      await updateProfile('Pawan', { password: '1234' }, `${currentUser} (Admin)`);
      setOzricPass('1234');
      setPawanPass('1234');
      setSuccessMsg('Both profiles have been reset to default password: "1234"');
    } catch (err: any) {
      setErrorMsg('Failed to reset passwords: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Admin force approve pending transaction
  const handleAdminConfirm = async (id: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    setActionLoading(true);
    try {
      await confirmExpense(id, `${currentUser} (Admin)`);
      setSuccessMsg('Transaction approved successfully via Admin override.');
    } catch (err: any) {
      setErrorMsg('Failed to approve transaction: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Admin unilateral direct delete
  const handleAdminDelete = async (id: string, title: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    
    showConfirm({
      title: 'Admin Unilateral Delete',
      message: `Are you sure you want to UNILATERALLY and permanently delete "${title}"? This bypasses roommate approval.`,
      confirmLabel: 'Force Delete',
      isDestructive: true,
      onConfirm: async () => {
        setActionLoading(true);
        try {
          await deleteExpense(id, `${currentUser} (Admin)`);
          setSuccessMsg('Transaction removed permanently via Admin override.');
        } catch (err: any) {
          setErrorMsg('Failed to delete transaction: ' + err.message);
        } finally {
          setActionLoading(false);
        }
      }
    });
  };

  // Action: Admin reject deletion request
  const handleAdminRejectDelete = async (id: string) => {
    setErrorMsg('');
    setSuccessMsg('');
    setActionLoading(true);
    try {
      await cancelDeleteExpense(id, `${currentUser} (Admin)`);
      setSuccessMsg('Deletion request rejected. Transaction preserved.');
    } catch (err: any) {
      setErrorMsg('Failed to reject deletion: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Clean/Prune database
  const handlePruneLedger = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    
    if (confirmInput !== 'PRUNE') {
      setErrorMsg('Please type "PRUNE" correctly to clear the database.');
      return;
    }

    setActionLoading(true);
    try {
      let count = 0;
      for (const expense of expenses) {
        if (expense.id) {
          await deleteExpense(expense.id, `${currentUser} (Admin)`);
          count++;
        }
      }
      setConfirmInput('');
      setSuccessMsg(`Pruned successfully! Deleted ${count} ledger documents.`);
    } catch (err: any) {
      setErrorMsg('Failed during pruning operation: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Action: Seed Diverse testing data
  const handleSeedMockData = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    setActionLoading(true);
    try {
      await addExpense({
        title: 'Supermarket weekly groceries',
        amount: 48.60,
        paidBy: 'Ozric',
        splitType: '50/50',
        category: 'Shared Groceries',
        splitDetails: { OzricAmount: 24.30, PawanAmount: 24.30 },
        notes: 'Includes eggs, bread, milk, and household cleaner.',
        status: 'confirmed'
      });

      await addExpense({
        title: 'Emergency taxi cash',
        amount: 20.00,
        paidBy: 'Pawan',
        splitType: 'custom',
        category: 'Other',
        isLendBorrow: true,
        paymentMethod: 'Cash',
        splitDetails: { OzricAmount: 20.00, PawanAmount: 0 },
        notes: 'Lent physical cash for return transit.',
        status: 'confirmed'
      });

      await addExpense({
        title: 'Electricity Coin €2.00',
        amount: 2.00,
        paidBy: 'Ozric',
        splitType: '50/50',
        category: 'Electricity (Coins)',
        isCoin: true,
        splitDetails: { OzricAmount: 1.00, PawanAmount: 1.00 },
        notes: 'Coin inserted physically into electricity meter',
        status: 'confirmed'
      });

      setSuccessMsg('Successfully injected 3 diverse roommate test transactions!');
    } catch (err: any) {
      setErrorMsg('Failed to seed transactions: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  // Helper: Categorized styling
  const getCategoryTheme = (category: Category | string) => {
    switch (category) {
      case 'Shared Groceries': return 'bg-emerald-100 text-emerald-800 border-emerald-300';
      case 'Electricity (Coins)': return 'bg-amber-100 text-amber-800 border-amber-300';
      case 'Internet WiFi': return 'bg-sky-100 text-sky-800 border-sky-300';
      case 'Bins & Rubbish': return 'bg-indigo-100 text-indigo-800 border-indigo-300';
      case 'Rent': return 'bg-rose-100 text-rose-800 border-rose-300';
      default: return 'bg-slate-100 text-slate-800 border-slate-300';
    }
  };

  // Admin Self-Service credentials updates
  const handleAdminPasswordChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (adminNewPass.length < 4) {
      setErrorMsg('Admin password must be at least 4 characters long.');
      return;
    }
    setActionLoading(true);
    try {
      await updateProfile('admin', { password: adminNewPass }, 'Super Admin (Self)');
      setSuccessMsg('Successfully updated Super Admin passcode!');
      setAdminNewPass('');
      // Reload updated profile
      const updated = await getProfile('admin');
      setAdminProfile(updated);
    } catch (err: any) {
      setErrorMsg('Failed to update admin password: ' + err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleGenerateRecoveryCodes = async () => {
    setActionLoading(true);
    setIsGeneratingCodes(true);
    try {
      const generateRandomCode = () => {
        const chars = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
        let p1 = '';
        let p2 = '';
        for (let i = 0; i < 4; i++) {
          p1 += chars.charAt(Math.floor(Math.random() * chars.length));
          p2 += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return `${p1}-${p2}`;
      };

      const newCodes: string[] = [];
      for (let i = 0; i < 10; i++) {
        newCodes.push(generateRandomCode());
      }
      await updateProfile('admin', { recoveryCodes: newCodes }, 'Super Admin (Self)');
      const updated = await getProfile('admin');
      setAdminProfile(updated);
      setSuccessMsg('Successfully generated 10 fresh emergency recovery codes! Copy them below.');
    } catch (err: any) {
      setErrorMsg('Failed to generate recovery codes: ' + err.message);
    } finally {
      setActionLoading(false);
      setIsGeneratingCodes(false);
    }
  };

  const handleDownloadAllCodes = () => {
    const codes: string[] = adminProfile?.recoveryCodes || [];
    if (codes.length === 0) return;
    
    const content = `Super Admin Emergency Offline Recovery Keys
===========================================
Generated on: ${new Date().toLocaleString()}

Active Keys:
${codes.map((code, idx) => `${idx + 1}. ${code}`).join('\n')}

Warning: Keep these keys completely offline and secure.
Each key can be used exactly once to reset the administrator passcode.
Upon successful use, the specific token will be permanently de-authorized.`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'admin-all-recovery-keys.txt');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadSingleCode = (code: string) => {
    const content = `Super Admin Single Recovery Key
-------------------------------
Recovery Key: ${code}
Status: Active, One-Time Use Only.
Generated on: ${new Date().toLocaleString()}

Warning: Save this securely offline. This code will be burned forever upon usage.`;

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `admin-recovery-code-${code}.txt`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className={isStandalone ? "min-h-screen bg-slate-50 flex flex-col w-full animate-fade-in" : "fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in"}>
      <div className={isStandalone ? "bg-white border-4 border-slate-900 rounded-3xl w-full max-w-5xl mx-auto my-6 shadow-[10px_10px_0px_0px_rgba(15,23,42,1)] overflow-hidden flex flex-col h-[92vh]" : "bg-white border-4 border-slate-900 rounded-3xl w-full max-w-3xl shadow-[10px_10px_0px_0px_rgba(15,23,42,1)] overflow-hidden my-auto flex flex-col h-[85vh]"}>
        
        {/* HEADER */}
        <div className="p-5 border-b-4 border-slate-950 flex items-center justify-between bg-amber-100 shrink-0">
          <div className="flex items-center gap-2.5">
            <button
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="md:hidden p-2.5 rounded-xl border-2 border-slate-900 bg-white hover:bg-slate-100 transition-all duration-200 cursor-pointer shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] mr-1"
              title="Toggle Sidebar Menu"
            >
              <Menu className="w-4 h-4 stroke-[2.5px] text-slate-900" />
            </button>
            <span className="p-2.5 bg-amber-250 text-slate-900 rounded-2xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
              <Wrench className="w-5 h-5 stroke-[2.5px]" />
            </span>
            <div>
              <h3 className="text-sm sm:text-lg font-black tracking-tight text-slate-900 uppercase">Super Admin Engine</h3>
              <p className="text-[9px] sm:text-xs text-amber-900 font-bold font-mono">AUTHORIZED OVERRIDE • COMPREHENSIVE CONTROL BOARD</p>
            </div>
          </div>
          {isStandalone ? (
            <button 
              id="btn-close-admin-panel"
              onClick={onClose}
              className="px-3 sm:px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white font-black text-[10px] sm:text-xs uppercase tracking-wider border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition duration-200 cursor-pointer flex items-center gap-1.5 rounded-xl"
            >
              <span>🚪 Sign Out</span>
            </button>
          ) : (
            <button 
              id="btn-close-admin-panel"
              onClick={onClose}
              className="p-2 rounded-xl text-slate-700 hover:text-slate-950 hover:bg-amber-200/50 border-2 border-slate-900 transition duration-200 cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* INNER WRAPPER FOR SIDEBAR AND CONTENT */}
        <div className="flex flex-1 overflow-hidden relative">
          
          {/* SIDEBAR BACKDROP OVERLAY FOR MOBILE */}
          {isSidebarOpen && (
            <div 
              onClick={() => setIsSidebarOpen(false)}
              className="md:hidden absolute inset-0 bg-slate-950/50 backdrop-blur-xs z-30 transition-opacity duration-300"
            />
          )}

          {/* COLLAPSIBLE SIDEBAR */}
          <aside className={`
            absolute md:static inset-y-0 left-0 z-40 w-64 bg-slate-100 border-r-4 border-slate-950 p-4 flex flex-col gap-3 shrink-0 transition-transform duration-300 ease-in-out
            ${isSidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}
          `}>
            <div className="flex items-center justify-between pb-3 mb-1 border-b-2 border-slate-250">
              <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono">Navigation Menu</span>
              <button 
                className="md:hidden p-1 rounded-lg border-2 border-slate-900 text-slate-700 hover:text-slate-900 bg-white"
                onClick={() => setIsSidebarOpen(false)}
              >
                <X className="w-3.5 h-3.5 stroke-[2.5px]" />
              </button>
            </div>

            <button
              id="tab-admin-ledger"
              onClick={() => {
                setErrorMsg('');
                setSuccessMsg('');
                setActiveTab('ledger');
                setIsSidebarOpen(false);
              }}
              className={`w-full text-left px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-150 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] cursor-pointer flex items-center gap-2.5 ${
                activeTab === 'ledger'
                  ? 'bg-indigo-600 text-white translate-x-[1px] translate-y-[1px] shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]'
                  : 'bg-white text-slate-800 hover:bg-indigo-50'
              }`}
            >
              <Database className="w-4 h-4" />
              <span>Ledger Override ({filteredExpenses.length})</span>
            </button>

            <button
              id="tab-admin-profiles"
              onClick={() => {
                setErrorMsg('');
                setSuccessMsg('');
                setActiveTab('profiles');
                setIsSidebarOpen(false);
              }}
              className={`w-full text-left px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-150 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] cursor-pointer flex items-center gap-2.5 ${
                activeTab === 'profiles'
                  ? 'bg-pink-600 text-white translate-x-[1px] translate-y-[1px] shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]'
                  : 'bg-white text-slate-800 hover:bg-pink-50'
              }`}
            >
              <Users className="w-4 h-4" />
              <span>Roommates</span>
            </button>

            <button
              id="tab-admin-discord"
              onClick={() => {
                setErrorMsg('');
                setSuccessMsg('');
                setActiveTab('discord');
                setIsSidebarOpen(false);
              }}
              className={`w-full text-left px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-150 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] cursor-pointer flex items-center gap-2.5 ${
                activeTab === 'discord'
                  ? 'bg-blue-600 text-white translate-x-[1px] translate-y-[1px] shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]'
                  : 'bg-white text-slate-800 hover:bg-blue-50'
              }`}
            >
              <BellRing className="w-4 h-4" />
              <span>Discord Hook</span>
            </button>

            <button
              id="tab-admin-security"
              onClick={() => {
                setErrorMsg('');
                setSuccessMsg('');
                setActiveTab('security');
                setIsSidebarOpen(false);
              }}
              className={`w-full text-left px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-150 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] cursor-pointer flex items-center gap-2.5 ${
                activeTab === 'security'
                  ? 'bg-rose-600 text-white translate-x-[1px] translate-y-[1px] shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]'
                  : 'bg-white text-slate-800 hover:bg-rose-50'
              }`}
            >
              <ShieldAlert className="w-4 h-4" />
              <span>Security Logs</span>
            </button>

            <button
              id="tab-admin-maintenance"
              onClick={() => {
                setErrorMsg('');
                setSuccessMsg('');
                setActiveTab('maintenance');
                setIsSidebarOpen(false);
              }}
              className={`w-full text-left px-4 py-3 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-150 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] cursor-pointer flex items-center gap-2.5 ${
                activeTab === 'maintenance'
                  ? 'bg-emerald-600 text-white translate-x-[1px] translate-y-[1px] shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]'
                  : 'bg-white text-slate-800 hover:bg-emerald-50'
              }`}
            >
              <Wrench className="w-4 h-4" />
              <span>Maintenance</span>
            </button>
          </aside>

          {/* MAIN CONTENT AREA */}
          <div className="flex-1 overflow-y-auto p-4 md:p-6 space-y-5">
            
            {errorMsg && (
              <div className="bg-rose-100 border-2 border-slate-900 text-slate-900 text-xs rounded-2xl p-4 flex items-start gap-2.5 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] font-bold animate-fade-in">
                <AlertCircle className="w-4 h-4 text-rose-650 shrink-0 mt-0.5" />
                <p className="leading-relaxed">{errorMsg}</p>
              </div>
            )}

          {successMsg && (
            <div className="bg-emerald-150 border-2 border-slate-900 text-slate-900 text-xs rounded-2xl p-4 flex items-start gap-2.5 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] font-bold animate-fade-in">
              <Check className="w-4 h-4 text-emerald-800 shrink-0 mt-0.5" />
              <p className="leading-relaxed">{successMsg}</p>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-slate-500">
              <RefreshCw className="w-8 h-8 animate-spin text-amber-500" />
              <p className="text-xs font-bold font-mono">Querying system endpoints & data nodes...</p>
            </div>
          ) : (
            <div className="space-y-6">

              {/* TAB 1: LEDGER OVERRIDES COMPREHENSIVE VIEW */}
              {activeTab === 'ledger' && (
                <div className="space-y-4">
                  
                  {/* FILTERS PANEL */}
                  <div className="bg-white border-2 border-slate-900 rounded-2xl p-4 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] flex flex-col md:flex-row gap-3">
                    
                    {/* Search Bar */}
                    <div className="relative flex-1">
                      <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                      <input
                        id="admin-ledger-search"
                        type="text"
                        placeholder="Search logs by Title, Roommate..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-50 border-2 border-slate-900 rounded-xl pl-9 pr-4 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      />
                    </div>

                    {/* Status Filter */}
                    <div className="w-full md:w-44">
                      <select
                        id="admin-ledger-status-filter"
                        value={statusFilter}
                        onChange={(e: any) => setStatusFilter(e.target.value)}
                        className="w-full bg-white border-2 border-slate-900 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="all">All Statuses</option>
                        <option value="confirmed">Confirmed Logs</option>
                        <option value="pending">Pending Approval</option>
                        <option value="deleteRequested">Pending Deletion</option>
                      </select>
                    </div>

                    {/* Type Filter */}
                    <div className="w-full md:w-40">
                      <select
                        id="admin-ledger-type-filter"
                        value={typeFilter}
                        onChange={(e: any) => setTypeFilter(e.target.value)}
                        className="w-full bg-white border-2 border-slate-900 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="all">All Types</option>
                        <option value="regular">Regular Shared</option>
                        <option value="coin">Meter Coins</option>
                        <option value="loan">Lends / Loans</option>
                        <option value="settlement">Settlements</option>
                      </select>
                    </div>
                  </div>

                  {/* ACTIVE LEDGER RECORDS LIST */}
                  <div className="space-y-3.5">
                    {filteredExpenses.length === 0 ? (
                      <div className="text-center py-16 border-2 border-dashed border-slate-300 rounded-2xl bg-slate-50">
                        <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                        <p className="text-xs font-bold text-slate-500">No matching logs found under admin filters.</p>
                      </div>
                    ) : (
                      filteredExpenses.map((exp) => {
                        const dateFormatted = exp.timestamp 
                          ? new Date(exp.timestamp).toLocaleDateString('en-IE', { day: '2-digit', month: 'short', year: 'numeric' })
                          : 'Recent';

                        const payerNick = roommatesNicknames[exp.paidBy] || exp.paidBy;

                        // Identify record type strings
                        let typeLabel = 'Regular';
                        if (exp.isCoin) typeLabel = 'Meter Coin';
                        else if (exp.isLendBorrow) typeLabel = 'Direct Loan';
                        else if (exp.isSettlement) typeLabel = 'Settlement';

                        return (
                          <div 
                            key={exp.id}
                            className={`border-2 border-slate-900 rounded-2xl p-4 bg-white shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] flex flex-col md:flex-row md:items-center justify-between gap-4 transition duration-150 ${
                              exp.deleteRequested ? 'bg-rose-50/20 border-rose-900 shadow-[2px_2px_0px_0px_rgba(225,29,72,1)]' : ''
                            }`}
                          >
                            {/* Left Info Column */}
                            <div className="space-y-1.5 flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border border-slate-900 font-mono ${getCategoryTheme(exp.category)}`}>
                                  {exp.category}
                                </span>
                                <span className="text-[9px] font-black uppercase text-slate-500 font-mono">
                                  {typeLabel} • {dateFormatted}
                                </span>

                                {/* Badges */}
                                {exp.status === 'pending' && (
                                  <span className="text-[8px] font-bold uppercase bg-amber-100 text-amber-800 border border-amber-300 px-1.5 py-0.5 rounded flex items-center gap-1 font-mono">
                                    <Clock className="w-2.5 h-2.5" /> Pending Approval
                                  </span>
                                )}
                                {exp.deleteRequested && (
                                  <span className="text-[8px] font-bold uppercase bg-rose-100 text-rose-850 border border-rose-350 px-1.5 py-0.5 rounded flex items-center gap-1 font-mono animate-pulse">
                                    <ShieldAlert className="w-2.5 h-2.5 text-rose-600" /> Pending Deletion
                                  </span>
                                )}
                                {exp.status === 'confirmed' && !exp.deleteRequested && (
                                  <span className="text-[8px] font-bold uppercase bg-emerald-100 text-emerald-800 border border-emerald-300 px-1.5 py-0.5 rounded flex items-center gap-1 font-mono">
                                    <CheckCircle className="w-2.5 h-2.5" /> Confirmed
                                  </span>
                                )}
                              </div>

                              <h4 className="text-sm font-black text-slate-900 tracking-tight">{exp.title}</h4>
                              
                              {exp.notes && (
                                <p className="text-[10px] text-slate-500 font-medium leading-relaxed bg-slate-50 border border-slate-200 rounded-lg p-2 max-w-prose">
                                  {exp.notes}
                                </p>
                              )}

                              <div className="text-[10px] font-bold text-slate-600 font-mono">
                                Document ID: <span className="text-indigo-600">{exp.id}</span> • Paid By: <span className="font-sans font-black text-slate-900">{payerNick}</span>
                              </div>
                            </div>

                            {/* Right Amount & Override Actions Column */}
                            <div className="flex flex-col items-start md:items-end gap-3 shrink-0">
                              <div className="text-right">
                                <span className="text-base font-black text-slate-900 font-mono">€{exp.amount.toFixed(2)}</span>
                              </div>

                              {/* Action Overrides Container */}
                              <div className="flex items-center gap-1.5 flex-wrap">
                                
                                {/* 1. Pending Creation Approvals */}
                                {exp.status === 'pending' && (
                                  <>
                                    <button
                                      id={`admin-btn-confirm-${exp.id}`}
                                      onClick={() => exp.id && handleAdminConfirm(exp.id)}
                                      disabled={actionLoading}
                                      className="bg-emerald-600 text-white border-2 border-slate-900 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-emerald-700 transition duration-150 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] cursor-pointer flex items-center gap-1 font-sans"
                                      title="Unilaterally approve this transaction"
                                    >
                                      <Check className="w-3 h-3" /> Approve
                                    </button>
                                    <button
                                      id={`admin-btn-reject-creation-${exp.id}`}
                                      onClick={() => exp.id && handleAdminDelete(exp.id, exp.title)}
                                      disabled={actionLoading}
                                      className="bg-rose-100 text-rose-800 border-2 border-slate-900 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-rose-200 transition duration-150 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] cursor-pointer flex items-center gap-1 font-sans"
                                      title="Unilaterally reject and delete document"
                                    >
                                      <Trash2 className="w-3 h-3" /> Reject
                                    </button>
                                  </>
                                )}

                                {/* 2. Deletion Request Approvals */}
                                {exp.deleteRequested && (
                                  <>
                                    <button
                                      id={`admin-btn-approve-delete-${exp.id}`}
                                      onClick={() => exp.id && handleAdminDelete(exp.id, exp.title)}
                                      disabled={actionLoading}
                                      className="bg-rose-600 text-white border-2 border-slate-900 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-rose-700 transition duration-150 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] cursor-pointer flex items-center gap-1 font-sans"
                                      title="Unilaterally approve deletion request"
                                    >
                                      <Trash2 className="w-3 h-3 animate-pulse" /> Confirm Delete
                                    </button>
                                    <button
                                      id={`admin-btn-reject-delete-${exp.id}`}
                                      onClick={() => exp.id && handleAdminRejectDelete(exp.id)}
                                      disabled={actionLoading}
                                      className="bg-slate-100 text-slate-800 border-2 border-slate-900 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider hover:bg-slate-200 transition duration-150 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] cursor-pointer flex items-center gap-1 font-sans"
                                      title="Unilaterally reject deletion request"
                                    >
                                      <X className="w-3 h-3" /> Preserve Log
                                    </button>
                                  </>
                                )}

                                {/* 3. Standard Confirmed Direct Deletion */}
                                {exp.status === 'confirmed' && !exp.deleteRequested && (
                                  <button
                                    id={`admin-btn-direct-delete-${exp.id}`}
                                    onClick={() => exp.id && handleAdminDelete(exp.id, exp.title)}
                                    disabled={actionLoading}
                                    className="bg-slate-100 text-rose-600 border-2 border-slate-900 hover:bg-rose-50 hover:text-rose-700 px-2.5 py-1 rounded-xl text-[9px] font-black uppercase tracking-wider transition duration-150 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] cursor-pointer flex items-center gap-1 font-sans"
                                    title="Unilaterally delete instantly from database"
                                  >
                                    <Trash2 className="w-3 h-3" /> Force Delete
                                  </button>
                                )}

                              </div>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}

              {/* TAB 2: ROOMMATE SECURITY OVERRIDES */}
              {activeTab === 'profiles' && (
                <div className="border-3 border-slate-900 rounded-2xl p-5 bg-indigo-50/20 space-y-4 animate-fade-in">
                  <h4 className="text-xs font-black uppercase tracking-widest text-slate-950 font-mono flex items-center gap-1.5 border-b-2 border-slate-200 pb-2">
                    <Users className="w-4 h-4" />
                    Security Credentials & Profiles
                  </h4>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                    {/* OZRIC PROFILE */}
                    <div className="space-y-3 p-3.5 bg-white border-2 border-slate-900 rounded-xl shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                      <span className="text-[10px] font-black uppercase tracking-wider font-mono text-indigo-600">Ozric Profile Configuration</span>
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 font-mono">Nickname</label>
                          <input
                            id="admin-input-ozric-nick"
                            type="text"
                            value={ozricNick}
                            onChange={(e) => setOzricNick(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border-2 border-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 font-mono">Raw Plaintext Password</label>
                          <div className="relative">
                            <input
                              id="admin-input-ozric-pass"
                              type={showOzricPass ? 'text' : 'password'}
                              value={ozricPass}
                              onChange={(e) => setOzricPass(e.target.value)}
                              className="w-full px-2.5 py-1.5 pr-8 rounded-lg border-2 border-slate-900 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <button
                              type="button"
                              onClick={() => setShowOzricPass(!showOzricPass)}
                              className="absolute right-2 top-2 text-slate-400 hover:text-slate-800"
                            >
                              {showOzricPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleUpdateUser('Ozric', ozricNick, ozricPass)}
                          disabled={actionLoading}
                          className="w-full mt-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider border border-slate-950 cursor-pointer shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]"
                        >
                          Override Ozric Profile
                        </button>
                      </div>
                    </div>

                    {/* PAWAN PROFILE */}
                    <div className="space-y-3 p-3.5 bg-white border-2 border-slate-900 rounded-xl shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                      <span className="text-[10px] font-black uppercase tracking-wider font-mono text-pink-600">Pawan Profile Configuration</span>
                      <div className="space-y-2">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 font-mono">Nickname</label>
                          <input
                            id="admin-input-pawan-nick"
                            type="text"
                            value={pawanNick}
                            onChange={(e) => setPawanNick(e.target.value)}
                            className="w-full px-2.5 py-1.5 rounded-lg border-2 border-slate-900 text-xs font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase tracking-widest text-slate-500 font-mono">Raw Plaintext Password</label>
                          <div className="relative">
                            <input
                              id="admin-input-pawan-pass"
                              type={showPawanPass ? 'text' : 'password'}
                              value={pawanPass}
                              onChange={(e) => setPawanPass(e.target.value)}
                              className="w-full px-2.5 py-1.5 pr-8 rounded-lg border-2 border-slate-900 text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPawanPass(!showPawanPass)}
                              className="absolute right-2 top-2 text-slate-400 hover:text-slate-800"
                            >
                              {showPawanPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleUpdateUser('Pawan', pawanNick, pawanPass)}
                          disabled={actionLoading}
                          className="w-full mt-2 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-[10px] font-black uppercase tracking-wider border border-slate-950 cursor-pointer shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]"
                        >
                          Override Pawan Profile
                        </button>
                      </div>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={handleResetPasswords}
                    disabled={actionLoading}
                    className="w-full py-2.5 rounded-xl border-2 border-slate-900 bg-white hover:bg-slate-50 text-slate-900 text-[10px] font-black uppercase tracking-wider shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[0.5px] active:translate-y-[0.5px] transition-all flex items-center justify-center gap-2 cursor-pointer font-sans"
                  >
                    <Key className="w-4 h-4 text-indigo-650" />
                    Wipe & Reset Both Passwords to Default ("1234")
                  </button>
                </div>
              )}

              {/* TAB: DISCORD WEBHOOKS MANAGEMENT */}
              {activeTab === 'discord' && (
                <div className="border-3 border-slate-900 rounded-2xl p-5 bg-blue-50/15 space-y-4 animate-fade-in">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-slate-200 pb-3">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-950 font-mono flex items-center gap-1.5">
                      <BellRing className="w-4 h-4 text-blue-650" />
                      Discord Push Notifications Engine
                    </h4>
                    {!isSuperAdmin ? (
                      <span className="text-[9px] font-black uppercase bg-rose-100 text-rose-800 border-2 border-rose-400 px-2.5 py-1 rounded-xl font-mono flex items-center gap-1">
                        <Lock className="w-3 h-3" /> READ-ONLY ACCESS
                      </span>
                    ) : (
                      <span className="text-[9px] font-black uppercase bg-emerald-100 text-emerald-800 border-2 border-emerald-400 px-2.5 py-1 rounded-xl font-mono flex items-center gap-1">
                        <Unlock className="w-3 h-3" /> SUPER ADMIN MODE
                      </span>
                    )}
                  </div>

                  {!isSuperAdmin && (
                    <div className="bg-amber-50 border-2 border-amber-300 text-amber-900 text-xs rounded-2xl p-4 flex items-start gap-2.5 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] font-bold">
                      <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
                      <div>
                        <p>Permission Level Restrained</p>
                        <p className="text-[10px] text-amber-700 font-medium mt-0.5 font-mono">Only a Super Admin is authorized to modify Discord push notification webhooks and preferences. You can view the current configuration below in Read-Only mode.</p>
                      </div>
                    </div>
                  )}

                  {/* SETTINGS CARDS */}
                  <div className="space-y-4">
                    
                    {/* CARD 1: GLOBAL TOGGLE & MAIN WEBHOOK */}
                    <div className="bg-white border-2 border-slate-900 rounded-xl p-4 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] space-y-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h5 className="text-xs font-black uppercase text-slate-900">Global Notification Toggle</h5>
                          <p className="text-[10px] text-slate-500 font-medium">Turn Discord push notifications on or off globally across the ledger application.</p>
                        </div>
                        <button
                          type="button"
                          disabled={currentUser !== 'Ozric' || actionLoading}
                          onClick={() => setDiscordSettings(prev => ({ ...prev, enabled: !prev.enabled }))}
                          className={`px-3 py-1.5 rounded-xl border-2 border-slate-900 text-xs font-black uppercase tracking-wider shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] transition-all cursor-pointer ${
                            discordSettings.enabled
                              ? 'bg-emerald-500 text-white hover:bg-emerald-600'
                              : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                          }`}
                        >
                          {discordSettings.enabled ? '🟢 ENABLED' : '🔴 DISABLED'}
                        </button>
                      </div>

                      <div className="border-t border-slate-150 pt-3 space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono">
                          Default Discord Webhook URL
                        </label>
                        <input
                          id="discord-input-webhook-url"
                          type="text"
                          disabled={currentUser !== 'Ozric' || actionLoading}
                          placeholder="https://discord.com/api/webhooks/..."
                          value={discordSettings.webhookUrl}
                          onChange={(e) => setDiscordSettings(prev => ({ ...prev, webhookUrl: e.target.value }))}
                          className="w-full px-3 py-2 text-xs border-2 border-slate-900 rounded-xl font-mono focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 disabled:opacity-75"
                        />
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono">
                          Custom Message Title Prefix
                        </label>
                        <input
                          id="discord-input-prefix"
                          type="text"
                          disabled={currentUser !== 'Ozric' || actionLoading}
                          placeholder="🏠 [Roommate Ledger]"
                          value={discordSettings.customPrefix}
                          onChange={(e) => setDiscordSettings(prev => ({ ...prev, customPrefix: e.target.value }))}
                          className="w-full px-3 py-2 text-xs border-2 border-slate-900 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50 disabled:opacity-75"
                        />
                      </div>

                      <div className="flex gap-2.5 pt-1.5 flex-wrap">
                        <button
                          type="button"
                          id="btn-test-discord-webhook"
                          disabled={testLoading || !discordSettings.webhookUrl}
                          onClick={async () => {
                            setTestLoading(true);
                            setErrorMsg('');
                            setSuccessMsg('');
                            const ok = await testDiscordWebhook(discordSettings.webhookUrl, discordSettings.customPrefix);
                            setTestLoading(false);
                            if (ok) {
                              setSuccessMsg('Test notification successfully transmitted to Discord webhook!');
                            } else {
                              setErrorMsg('Failed to transmit test webhook. Ensure the URL is valid.');
                            }
                          }}
                          className="px-4 py-2 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 text-slate-800 border-2 border-slate-900 rounded-xl text-[10px] font-black uppercase tracking-wider cursor-pointer shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] flex items-center gap-1.5"
                        >
                          <Send className="w-3.5 h-3.5" />
                          {testLoading ? 'Testing...' : 'Test Connection'}
                        </button>
                      </div>
                    </div>

                    {/* CARD 2: CATEGORY SPECIFIC OVERRIDES (OPTIONAL/ADVANCED) */}
                    <div className="bg-white border-2 border-slate-900 rounded-xl p-4 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] space-y-3.5">
                      <div>
                        <h5 className="text-xs font-black uppercase text-slate-900">Category-Specific Webhook Routing (Optional)</h5>
                        <p className="text-[10px] text-slate-500 font-medium">Route notifications of different modules to distinct Discord channels (defaults to main webhook if left empty).</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3 border-t border-slate-150 pt-3">
                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-indigo-600 font-mono">Transactions Webhook</label>
                          <input
                            id="discord-custom-transactions"
                            type="text"
                            disabled={currentUser !== 'Ozric' || actionLoading}
                            placeholder="Default Webhook fallback"
                            value={discordSettings.customWebhooks?.transactions || ''}
                            onChange={(e) => setDiscordSettings(prev => ({
                              ...prev,
                              customWebhooks: { ...prev.customWebhooks, transactions: e.target.value }
                            }))}
                            className="w-full px-2.5 py-1.5 text-xs border-2 border-slate-900 rounded-xl font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50 disabled:opacity-75"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-rose-600 font-mono">Security Webhook</label>
                          <input
                            id="discord-custom-security"
                            type="text"
                            disabled={currentUser !== 'Ozric' || actionLoading}
                            placeholder="Default Webhook fallback"
                            value={discordSettings.customWebhooks?.security || ''}
                            onChange={(e) => setDiscordSettings(prev => ({
                              ...prev,
                              customWebhooks: { ...prev.customWebhooks, security: e.target.value }
                            }))}
                            className="w-full px-2.5 py-1.5 text-xs border-2 border-slate-900 rounded-xl font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50 disabled:opacity-75"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-emerald-600 font-mono">Savings Goals Webhook</label>
                          <input
                            id="discord-custom-savings"
                            type="text"
                            disabled={currentUser !== 'Ozric' || actionLoading}
                            placeholder="Default Webhook fallback"
                            value={discordSettings.customWebhooks?.savings || ''}
                            onChange={(e) => setDiscordSettings(prev => ({
                              ...prev,
                              customWebhooks: { ...prev.customWebhooks, savings: e.target.value }
                            }))}
                            className="w-full px-2.5 py-1.5 text-xs border-2 border-slate-900 rounded-xl font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50 disabled:opacity-75"
                          />
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-black uppercase text-amber-600 font-mono">Recurring Bills Webhook</label>
                          <input
                            id="discord-custom-bills"
                            type="text"
                            disabled={currentUser !== 'Ozric' || actionLoading}
                            placeholder="Default Webhook fallback"
                            value={discordSettings.customWebhooks?.bills || ''}
                            onChange={(e) => setDiscordSettings(prev => ({
                              ...prev,
                              customWebhooks: { ...prev.customWebhooks, bills: e.target.value }
                            }))}
                            className="w-full px-2.5 py-1.5 text-xs border-2 border-slate-900 rounded-xl font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 bg-slate-50 disabled:opacity-75"
                          />
                        </div>
                      </div>
                    </div>

                    {/* CARD 3: EVENT SUBSCRIPTIONS SELECTOR */}
                    <div className="bg-white border-2 border-slate-900 rounded-xl p-4 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] space-y-3.5">
                      <div>
                        <h5 className="text-xs font-black uppercase text-slate-900">Event Notifications Subscription</h5>
                        <p className="text-[10px] text-slate-500 font-medium">Select exactly which activities within the ledger engine should trigger a push notification.</p>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 border-t border-slate-150 pt-3 text-xs font-bold text-slate-700">
                        
                        <label className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                          <input
                            id="discord-evt-new-transaction"
                            type="checkbox"
                            disabled={currentUser !== 'Ozric' || actionLoading}
                            checked={discordSettings.events.newTransaction}
                            onChange={(e) => setDiscordSettings(prev => ({
                              ...prev,
                              events: { ...prev.events, newTransaction: e.target.checked }
                            }))}
                            className="mt-0.5 rounded border-2 border-slate-900 text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                            <p className="text-slate-900 text-[11px] font-black uppercase tracking-wide">New Transactions</p>
                            <p className="text-[9px] text-slate-455 font-semibold leading-tight">Shared expenses, quick coins, direct loan entries, settlements.</p>
                          </div>
                        </label>

                        <label className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                          <input
                            id="discord-evt-update-delete"
                            type="checkbox"
                            disabled={currentUser !== 'Ozric' || actionLoading}
                            checked={discordSettings.events.updateDeleteTransaction}
                            onChange={(e) => setDiscordSettings(prev => ({
                              ...prev,
                              events: { ...prev.events, updateDeleteTransaction: e.target.checked }
                            }))}
                            className="mt-0.5 rounded border-2 border-slate-900 text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                            <p className="text-slate-900 text-[11px] font-black uppercase tracking-wide">Updates & Deletions</p>
                            <p className="text-[9px] text-slate-455 font-semibold leading-tight">Deletion requests, transaction editing, or full removal.</p>
                          </div>
                        </label>

                        <label className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                          <input
                            id="discord-evt-login-logout"
                            type="checkbox"
                            disabled={currentUser !== 'Ozric' || actionLoading}
                            checked={discordSettings.events.userLoginLogout}
                            onChange={(e) => setDiscordSettings(prev => ({
                              ...prev,
                              events: { ...prev.events, userLoginLogout: e.target.checked }
                            }))}
                            className="mt-0.5 rounded border-2 border-slate-900 text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                            <p className="text-slate-900 text-[11px] font-black uppercase tracking-wide">Logins & Logouts</p>
                            <p className="text-[9px] text-slate-455 font-semibold leading-tight">Roommate unlocks dashboard profile or locks it.</p>
                          </div>
                        </label>

                        <label className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                          <input
                            id="discord-evt-security"
                            type="checkbox"
                            disabled={currentUser !== 'Ozric' || actionLoading}
                            checked={discordSettings.events.passwordSecurityChanges}
                            onChange={(e) => setDiscordSettings(prev => ({
                              ...prev,
                              events: { ...prev.events, passwordSecurityChanges: e.target.checked }
                            }))}
                            className="mt-0.5 rounded border-2 border-slate-900 text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                            <p className="text-slate-900 text-[11px] font-black uppercase tracking-wide">Security Changes</p>
                            <p className="text-[9px] text-slate-455 font-semibold leading-tight">Password modifications and admin wipes/resets.</p>
                          </div>
                        </label>

                        <label className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                          <input
                            id="discord-evt-accounts"
                            type="checkbox"
                            disabled={currentUser !== 'Ozric' || actionLoading}
                            checked={discordSettings.events.accountChanges}
                            onChange={(e) => setDiscordSettings(prev => ({
                              ...prev,
                              events: { ...prev.events, accountChanges: e.target.checked }
                            }))}
                            className="mt-0.5 rounded border-2 border-slate-900 text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                            <p className="text-slate-900 text-[11px] font-black uppercase tracking-wide">Private Accounts</p>
                            <p className="text-[9px] text-slate-455 font-semibold leading-tight">Creation, updates, or deletions of private budget vaults.</p>
                          </div>
                        </label>

                        <label className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                          <input
                            id="discord-evt-savings"
                            type="checkbox"
                            disabled={currentUser !== 'Ozric' || actionLoading}
                            checked={discordSettings.events.savingsGoalsChanges}
                            onChange={(e) => setDiscordSettings(prev => ({
                              ...prev,
                              events: { ...prev.events, savingsGoalsChanges: e.target.checked }
                            }))}
                            className="mt-0.5 rounded border-2 border-slate-900 text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                            <p className="text-slate-900 text-[11px] font-black uppercase tracking-wide">Savings Benchmarks</p>
                            <p className="text-[9px] text-slate-455 font-semibold leading-tight">Goal creation, contributions, deletion, and goal completions.</p>
                          </div>
                        </label>

                        <label className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                          <input
                            id="discord-evt-receipts"
                            type="checkbox"
                            disabled={currentUser !== 'Ozric' || actionLoading}
                            checked={discordSettings.events.receiptUploads}
                            onChange={(e) => setDiscordSettings(prev => ({
                              ...prev,
                              events: { ...prev.events, receiptUploads: e.target.checked }
                            }))}
                            className="mt-0.5 rounded border-2 border-slate-900 text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                            <p className="text-slate-900 text-[11px] font-black uppercase tracking-wide">Receipt Uploads</p>
                            <p className="text-[9px] text-slate-455 font-semibold leading-tight">Personal transactions file receipt attachments.</p>
                          </div>
                        </label>

                        <label className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                          <input
                            id="discord-evt-settings"
                            type="checkbox"
                            disabled={currentUser !== 'Ozric' || actionLoading}
                            checked={discordSettings.events.settingsChanges}
                            onChange={(e) => setDiscordSettings(prev => ({
                              ...prev,
                              events: { ...prev.events, settingsChanges: e.target.checked }
                            }))}
                            className="mt-0.5 rounded border-2 border-slate-900 text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                            <p className="text-slate-900 text-[11px] font-black uppercase tracking-wide">Preferences & Settings</p>
                            <p className="text-[9px] text-slate-455 font-semibold leading-tight">Updates to budgets, nicknames, accent colors, and emoji avatars.</p>
                          </div>
                        </label>

                        <label className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                          <input
                            id="discord-evt-finance"
                            type="checkbox"
                            disabled={currentUser !== 'Ozric' || actionLoading}
                            checked={discordSettings.events.financeUpdates}
                            onChange={(e) => setDiscordSettings(prev => ({
                              ...prev,
                              events: { ...prev.events, financeUpdates: e.target.checked }
                            }))}
                            className="mt-0.5 rounded border-2 border-slate-900 text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                            <p className="text-slate-900 text-[11px] font-black uppercase tracking-wide">Business / Personal Finance</p>
                            <p className="text-[9px] text-slate-455 font-semibold leading-tight">Private ledger transaction entries, bill payment events.</p>
                          </div>
                        </label>

                        <label className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                          <input
                            id="discord-evt-approvals"
                            type="checkbox"
                            disabled={currentUser !== 'Ozric' || actionLoading}
                            checked={discordSettings.events.approvalRejectionActions}
                            onChange={(e) => setDiscordSettings(prev => ({
                              ...prev,
                              events: { ...prev.events, approvalRejectionActions: e.target.checked }
                            }))}
                            className="mt-0.5 rounded border-2 border-slate-900 text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                            <p className="text-slate-900 text-[11px] font-black uppercase tracking-wide">Approvals & Rejections</p>
                            <p className="text-[9px] text-slate-455 font-semibold leading-tight">Roommate or Admin confirmation / cancelation actions.</p>
                          </div>
                        </label>

                        <label className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-slate-50 cursor-pointer">
                          <input
                            id="discord-evt-failed-logins"
                            type="checkbox"
                            disabled={currentUser !== 'Ozric' || actionLoading}
                            checked={discordSettings.events.failedLogins}
                            onChange={(e) => setDiscordSettings(prev => ({
                              ...prev,
                              events: { ...prev.events, failedLogins: e.target.checked }
                            }))}
                            className="mt-0.5 rounded border-2 border-slate-900 text-blue-600 focus:ring-blue-500"
                          />
                          <div>
                            <p className="text-slate-900 text-[11px] font-black uppercase tracking-wide">Failed Login Alerts</p>
                            <p className="text-[9px] text-slate-455 font-semibold leading-tight">Security alerts when an incorrect passcode is entered.</p>
                          </div>
                        </label>

                      </div>

                      {/* MESSAGE FORMAT SELECTOR */}
                      <div className="border-t border-slate-150 pt-3.5 flex items-center justify-between">
                        <div>
                          <h5 className="text-[11px] font-black uppercase text-slate-900">Message Layout Format</h5>
                          <p className="text-[9px] text-slate-400 font-semibold leading-none mt-0.5">Choose between rich neobrutalist Embed structures or standard compact Markdown text formats.</p>
                        </div>
                        <select
                          disabled={currentUser !== 'Ozric' || actionLoading}
                          value={discordSettings.messageFormat}
                          onChange={(e) => setDiscordSettings(prev => ({ ...prev, messageFormat: e.target.value as 'embed' | 'text' }))}
                          className="bg-white border-2 border-slate-900 rounded-xl px-3 py-1.5 text-xs font-bold font-mono focus:outline-none focus:ring-1 focus:ring-blue-500 cursor-pointer bg-slate-50"
                        >
                          <option value="embed">Styled Embeds</option>
                          <option value="text">Plain Markdown Text</option>
                        </select>
                      </div>
                    </div>

                    {/* SAVE BUTTON FOR SUPER ADMIN */}
                    {currentUser === 'Ozric' && (
                      <button
                        type="button"
                        id="btn-save-discord-settings"
                        disabled={actionLoading}
                        onClick={async () => {
                          setActionLoading(true);
                          setErrorMsg('');
                          setSuccessMsg('');
                          try {
                            await saveDiscordSettings(discordSettings);
                            setSuccessMsg('Discord Push configurations updated and synchronized successfully!');
                          } catch (err: any) {
                            setErrorMsg('Failed to persist Discord settings: ' + err.message);
                          } finally {
                            setActionLoading(false);
                          }
                        }}
                        className="w-full py-3 rounded-xl border-2 border-slate-900 bg-blue-600 hover:bg-blue-700 text-white text-[10px] font-black uppercase tracking-wider shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-x-[0.5px] active:translate-y-[0.5px] transition-all flex items-center justify-center gap-2 cursor-pointer font-sans"
                      >
                        <Check className="w-4 h-4 text-white" />
                        Save Discord Settings
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* TAB: SECURITY AUDIT & CONTROLS */}
              {activeTab === 'security' && (
                <div className="space-y-6 animate-fade-in">
                  
                  {/* ROOMMATE PROFILES SECURITY CONFIGURATIONS */}
                  <div className="border-3 border-slate-900 rounded-2xl p-5 bg-indigo-50/10 space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-950 font-mono flex items-center gap-1.5 border-b-2 border-slate-200 pb-2">
                      <Key className="w-4 h-4 text-indigo-600" />
                      Roommate Security Controls
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {/* PROFILE OZRIC */}
                      {(() => {
                        const p = ozricProfile;
                        if (!p) return null;
                        const failedCount = p.failedAttemptsCount || 0;
                        const isManual = p.manualLocked;
                        const isPerm = p.permanentLock;
                        const isTemp = p.lockedUntil && new Date(p.lockedUntil.toDate ? p.lockedUntil.toDate() : p.lockedUntil) > new Date();
                        
                        let stateBadge = <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] px-2.5 py-0.5 rounded-full font-bold">🟢 Active & Secured</span>;
                        if (isManual) stateBadge = <span className="bg-rose-100 text-rose-800 border border-rose-300 text-[10px] px-2.5 py-0.5 rounded-full font-bold">🔒 Suspended</span>;
                        else if (isPerm) stateBadge = <span className="bg-rose-100 text-rose-800 border border-rose-300 text-[10px] px-2.5 py-0.5 rounded-full font-bold">🔴 Permanently Locked</span>;
                        else if (isTemp) stateBadge = <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[10px] px-2.5 py-0.5 rounded-full font-bold">🟡 Temporarily Locked</span>;

                        return (
                          <div className="border-2 border-slate-900 rounded-xl p-4 bg-white flex flex-col justify-between space-y-4">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2.5">
                                <span className="text-2xl">{p.avatar || '🐼'}</span>
                                <div>
                                  <h5 className="text-sm font-black text-slate-900">{p.nickname || 'Ozric'} (Admin)</h5>
                                  <p className="text-[10px] font-mono text-slate-400">Failed attempts: {failedCount}/3</p>
                                </div>
                              </div>
                              {stateBadge}
                            </div>

                            {p.recoveryRequest && (
                              <div className="text-[10px] font-mono bg-amber-50 p-2 rounded border border-amber-200 text-amber-800 leading-normal">
                                ⚠️ Quarantine Reset Requested.<br/>
                                Activates: {new Date(p.recoveryRequest.activeAt).toLocaleString('en-IE', { hour: '2-digit', minute: '2-digit', second: '2-digit' })} 
                                ({Math.max(0, Math.ceil((new Date(p.recoveryRequest.activeAt).getTime() - Date.now()) / 60000))}m remaining)
                              </div>
                            )}

                            {currentUser === 'Ozric' && (
                              <div className="pt-2 border-t border-slate-100 flex gap-2">
                                {(failedCount > 0 || isManual || isPerm || isTemp || p.recoveryRequest) && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      setActionLoading(true);
                                      try {
                                        await updateProfile('Ozric', {
                                          failedAttemptsCount: 0,
                                          lockoutType: 'none',
                                          lockedUntil: null,
                                          permanentLock: false,
                                          manualLocked: false,
                                          recoveryRequest: null
                                        }, 'Ozric (Admin)');
                                        const updated = await getProfile('Ozric');
                                        setOzricProfile(updated);
                                        setSuccessMsg('Successfully restored and unlocked profile for Ozric!');
                                      } catch (err: any) {
                                        setErrorMsg('Unlocking failed: ' + err.message);
                                      } finally {
                                        setActionLoading(false);
                                      }
                                    }}
                                    className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border border-slate-900 rounded-lg text-[10px] font-black uppercase tracking-wide cursor-pointer"
                                  >
                                    Unlock / Reset
                                  </button>
                                )}
                                
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setActionLoading(true);
                                    try {
                                      await updateProfile('Ozric', { manualLocked: !isManual }, 'Ozric (Admin)');
                                      const updated = await getProfile('Ozric');
                                      setOzricProfile(updated);
                                      setSuccessMsg(`Successfully ${isManual ? 'restored' : 'manually suspended'} Ozric!`);
                                    } catch (err: any) {
                                      setErrorMsg('Action failed: ' + err.message);
                                    } finally {
                                      setActionLoading(false);
                                    }
                                  }}
                                  className={`flex-1 py-1.5 border border-slate-900 rounded-lg text-[10px] font-black uppercase tracking-wide cursor-pointer ${
                                    isManual ? 'bg-indigo-50 text-indigo-750' : 'bg-rose-50 text-rose-750'
                                  }`}
                                >
                                  {isManual ? 'Lift Suspension' : 'Suspend Profile'}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })()}

                      {/* PROFILE PAWAN */}
                      {(() => {
                        const p = pawanProfile;
                        if (!p) return null;
                        const failedCount = p.failedAttemptsCount || 0;
                        const isManual = p.manualLocked;
                        const isPerm = p.permanentLock;
                        const isTemp = p.lockedUntil && new Date(p.lockedUntil.toDate ? p.lockedUntil.toDate() : p.lockedUntil) > new Date();
                        
                        let stateBadge = <span className="bg-emerald-100 text-emerald-800 border border-emerald-300 text-[10px] px-2.5 py-0.5 rounded-full font-bold">🟢 Active & Secured</span>;
                        if (isManual) stateBadge = <span className="bg-rose-100 text-rose-800 border border-rose-300 text-[10px] px-2.5 py-0.5 rounded-full font-bold">🔒 Suspended</span>;
                        else if (isPerm) stateBadge = <span className="bg-rose-100 text-rose-800 border border-rose-300 text-[10px] px-2.5 py-0.5 rounded-full font-bold">🔴 Permanently Locked</span>;
                        else if (isTemp) stateBadge = <span className="bg-amber-100 text-amber-800 border border-amber-300 text-[10px] px-2.5 py-0.5 rounded-full font-bold">🟡 Temporarily Locked</span>;

                        return (
                          <div className="border-2 border-slate-900 rounded-xl p-4 bg-white flex flex-col justify-between space-y-4">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-2.5">
                                <span className="text-2xl">{p.avatar || '🦊'}</span>
                                <div>
                                  <h5 className="text-sm font-black text-slate-900">{p.nickname || 'Pawan'}</h5>
                                  <p className="text-[10px] font-mono text-slate-400">Failed attempts: {failedCount}/3</p>
                                </div>
                              </div>
                              {stateBadge}
                            </div>

                            {currentUser === 'Ozric' && (
                              <div className="pt-2 border-t border-slate-100 flex gap-2">
                                {(failedCount > 0 || isManual || isPerm || isTemp) && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      setActionLoading(true);
                                      try {
                                        await updateProfile('Pawan', {
                                          failedAttemptsCount: 0,
                                          lockoutType: 'none',
                                          lockedUntil: null,
                                          permanentLock: false,
                                          manualLocked: false
                                        }, 'Ozric (Admin)');
                                        const updated = await getProfile('Pawan');
                                        setPawanProfile(updated);
                                        setSuccessMsg('Successfully restored and unlocked profile for Pawan!');
                                      } catch (err: any) {
                                        setErrorMsg('Unlocking failed: ' + err.message);
                                      } finally {
                                        setActionLoading(false);
                                      }
                                    }}
                                    className="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white border border-slate-900 rounded-lg text-[10px] font-black uppercase tracking-wide cursor-pointer"
                                  >
                                    Unlock / Reset
                                  </button>
                                )}
                                
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setActionLoading(true);
                                    try {
                                      await updateProfile('Pawan', { manualLocked: !isManual }, 'Ozric (Admin)');
                                      const updated = await getProfile('Pawan');
                                      setPawanProfile(updated);
                                      setSuccessMsg(`Successfully ${isManual ? 'restored' : 'manually suspended'} Pawan!`);
                                    } catch (err: any) {
                                      setErrorMsg('Action failed: ' + err.message);
                                    } finally {
                                      setActionLoading(false);
                                    }
                                  }}
                                  className={`flex-1 py-1.5 border border-slate-900 rounded-lg text-[10px] font-black uppercase tracking-wide cursor-pointer ${
                                    isManual ? 'bg-indigo-50 text-indigo-750' : 'bg-rose-50 text-rose-750'
                                  }`}
                                >
                                  {isManual ? 'Lift Suspension' : 'Suspend Profile'}
                                </button>
                              </div>
                            )}
                          </div>
                        );
                      })()}
                    </div>
                  </div>

                  {/* ACTIVE SESSIONS PANEL */}
                  <div className="border-3 border-slate-900 rounded-2xl p-5 bg-pink-50/10 space-y-3">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-950 font-mono flex items-center gap-1.5 border-b-2 border-slate-200 pb-2">
                      <Users className="w-4 h-4 text-pink-600" />
                      Active Dashboard Sessions
                    </h4>

                    {(() => {
                      const now = new Date().getTime();
                      const activeSessions = loginLogs.filter(log => {
                        const logTime = new Date(log.timestamp).getTime();
                        return log.status === 'Success' && !log.logoutTime && (now - logTime) < 24 * 3600 * 1000;
                      });

                      if (activeSessions.length === 0) {
                        return (
                          <div className="text-center py-6 border-2 border-dashed border-slate-250 rounded-xl bg-slate-50">
                            <p className="text-xs text-slate-550 font-mono">No active real-time roommate sessions logged in the last 24 hours.</p>
                          </div>
                        );
                      }

                      return (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                          {activeSessions.map((sess) => (
                            <div key={sess.id} className="bg-white border-2 border-slate-900 rounded-xl p-3.5 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] flex items-center justify-between gap-3">
                              <div className="space-y-1">
                                <div className="flex items-center gap-1.5">
                                  <span className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping"></span>
                                  <span className="text-xs font-black text-slate-900">{sess.fullName}</span>
                                  <span className="text-[9px] font-mono text-indigo-600 bg-indigo-50 border border-indigo-200 px-1 py-0.5 rounded font-bold">{sess.sessionId}</span>
                                </div>
                                <p className="text-[10px] text-slate-500 font-medium">Device: {sess.deviceName}</p>
                                <p className="text-[10px] text-slate-500 font-medium">Location: {sess.city}, {sess.country} • {sess.ipAddress}</p>
                                <p className="text-[9px] text-slate-400 font-mono">Online since: {new Date(sess.timestamp).toLocaleTimeString()}</p>
                              </div>

                              {currentUser === 'Ozric' && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setActionLoading(true);
                                    try {
                                      const duration = Math.floor((Date.now() - new Date(sess.timestamp).getTime()) / 1000);
                                      const { updateLoginLogLogout } = await import('../dbService');
                                      await updateLoginLogLogout(sess.id!, duration);
                                      setSuccessMsg(`Successfully terminated active session ${sess.sessionId}!`);
                                    } catch (err: any) {
                                      setErrorMsg('Session termination failed: ' + err.message);
                                    } finally {
                                      setActionLoading(false);
                                    }
                                  }}
                                  className="py-1 px-2.5 bg-rose-100 hover:bg-rose-200 text-rose-800 border-2 border-slate-900 rounded-lg text-[9px] font-black uppercase tracking-wide cursor-pointer"
                                >
                                  Kill
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* IMMUTABLE LOGIN ACTIVITY AUDITS */}
                  <div className="border-3 border-slate-900 rounded-2xl p-5 bg-slate-50 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b-2 border-slate-200 pb-3">
                      <h4 className="text-xs font-black uppercase tracking-widest text-slate-950 font-mono flex items-center gap-1.5">
                        <SlidersHorizontal className="w-4 h-4 text-indigo-650" />
                        Immutable Login Security Audit Logs
                      </h4>

                      <div className="flex items-center gap-2 flex-wrap">
                        {/* Search Security */}
                        <input
                          id="input-sec-search"
                          type="text"
                          placeholder="Search Audits..."
                          value={securitySearchQuery}
                          onChange={(e) => setSecuritySearchQuery(e.target.value)}
                          className="px-2.5 py-1 text-xs border-2 border-slate-900 rounded-lg bg-white"
                        />

                        {/* Status Filter */}
                        <select
                          id="select-sec-status"
                          value={securityStatusFilter}
                          onChange={(e) => setSecurityStatusFilter(e.target.value as any)}
                          className="px-2.5 py-1 text-xs border-2 border-slate-900 rounded-lg bg-white"
                        >
                          <option value="all">All Statuses</option>
                          <option value="Success">Success</option>
                          <option value="Failed">Failed</option>
                          <option value="Locked">Locked / Cooldown</option>
                        </select>

                        {/* User Filter */}
                        <select
                          id="select-sec-user"
                          value={securityUserFilter}
                          onChange={(e) => setSecurityUserFilter(e.target.value as any)}
                          className="px-2.5 py-1 text-xs border-2 border-slate-900 rounded-lg bg-white"
                        >
                          <option value="all">All Profiles</option>
                          <option value="Ozric">Ozric (Admin)</option>
                          <option value="Pawan">Pawan</option>
                        </select>
                      </div>
                    </div>

                    <div className="space-y-3.5 max-h-[350px] overflow-y-auto pr-1">
                      {(() => {
                        const filtered = loginLogs.filter(log => {
                          const matchesQuery = !securitySearchQuery ? true : (
                            log.fullName.toLowerCase().includes(securitySearchQuery.toLowerCase()) ||
                            log.ipAddress.includes(securitySearchQuery) ||
                            log.city.toLowerCase().includes(securitySearchQuery.toLowerCase()) ||
                            log.country.toLowerCase().includes(securitySearchQuery.toLowerCase()) ||
                            log.deviceName.toLowerCase().includes(securitySearchQuery.toLowerCase())
                          );

                          const matchesStatus = securityStatusFilter === 'all' ? true : log.status === securityStatusFilter;
                          const matchesUser = securityUserFilter === 'all' ? true : log.userId === securityUserFilter;

                          return matchesQuery && matchesStatus && matchesUser;
                        });

                        if (filtered.length === 0) {
                          return (
                            <div className="text-center py-10">
                              <p className="text-xs text-slate-500 font-bold font-mono">No security logs match your search parameters.</p>
                            </div>
                          );
                        }

                        return filtered.map((log) => {
                          let badgeStyle = "bg-emerald-50 text-emerald-800 border-emerald-300";
                          if (log.status === 'Failed') badgeStyle = "bg-amber-50 text-amber-800 border-amber-300";
                          else if (log.status === 'Locked') badgeStyle = "bg-rose-50 text-rose-800 border-rose-300";

                          const logTime = new Date(log.timestamp).toLocaleString();
                          const sessionDesc = log.status === 'Success' 
                            ? (log.logoutTime ? `Session duration: ${Math.floor(log.sessionDuration! / 60)}m ${log.sessionDuration! % 60}s` : 'Active Session') 
                            : `Failure Reason: ${log.failureReason || 'N/A'}`;

                          return (
                            <div key={log.id} className="bg-white border border-slate-300 rounded-xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-slate-800 transition duration-150 text-[11px] font-sans">
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded border ${badgeStyle} font-mono`}>
                                    {log.status}
                                  </span>
                                  <span className="font-black text-slate-900">{log.fullName} ({log.userRole})</span>
                                  <span className="text-slate-400 font-mono">{logTime}</span>
                                </div>
                                <p className="text-slate-650 font-medium">Device: <span className="text-slate-850 font-semibold">{log.deviceName}</span> • Screen: {log.screenResolution} • Locale: {log.language}</p>
                                <p className="text-slate-650 font-medium">Location: <span className="text-slate-850 font-semibold">{log.city}, {log.country}</span> • IP: <span className="text-indigo-650 font-mono font-bold">{log.ipAddress}</span></p>
                              </div>
                              <div className="text-left sm:text-right font-mono text-[10px] text-slate-500 bg-slate-50 border border-slate-200 rounded p-2 sm:max-w-xs shrink-0 self-start sm:self-center">
                                <div className="font-bold text-slate-800">Session ID: {log.sessionId}</div>
                                <div className="text-[9px] mt-0.5 leading-tight">{sessionDesc}</div>
                              </div>
                            </div>
                          );
                        });
                      })()}
                    </div>
                  </div>

                  {/* SUPER ADMIN VAULT SELF-SERVICE CREDENTIALS & RECOVERY */}
                  <div className="border-3 border-slate-900 rounded-2xl p-5 bg-amber-50/10 space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-950 font-mono flex items-center gap-1.5 border-b-2 border-slate-200 pb-2">
                      <ShieldAlert className="w-4 h-4 text-amber-600" />
                      Super Admin Credentials & Recovery Vault
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* PASSWORD MANAGEMENT */}
                      <div className="border-2 border-slate-900 rounded-xl p-4 bg-white space-y-3 flex flex-col justify-between">
                        <div className="space-y-2">
                          <h5 className="text-xs font-black uppercase text-slate-900 font-mono flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-indigo-650" />
                            Update Admin Passcode
                          </h5>
                          <form onSubmit={handleAdminPasswordChange} className="space-y-2 pt-1.5">
                            <div className="relative">
                              <input
                                id="admin-panel-new-pass"
                                type={showAdminPass ? 'text' : 'password'}
                                placeholder="Enter new passcode"
                                value={adminNewPass}
                                onChange={(e) => setAdminNewPass(e.target.value)}
                                className="w-full px-3 py-2 text-xs font-mono border-2 border-slate-900 rounded-lg bg-white"
                              />
                              <button
                                type="button"
                                onClick={() => setShowAdminPass(!showAdminPass)}
                                className="absolute right-2 top-2 p-1 text-slate-400 hover:text-slate-800"
                              >
                                {showAdminPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                              </button>
                            </div>
                            <button
                              type="submit"
                              disabled={actionLoading || !adminNewPass}
                              className="w-full py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 disabled:cursor-not-allowed text-white text-[10px] font-black uppercase tracking-wide border-2 border-slate-900 rounded-lg shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] transition-all cursor-pointer"
                            >
                              Commit New Passcode
                            </button>
                          </form>
                        </div>
                      </div>

                      {/* EMERGENCY RECOVERY KEYS */}
                      <div className="border-2 border-slate-900 rounded-xl p-4 bg-white space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-0.5">
                            <h5 className="text-xs font-black uppercase text-slate-900 font-mono flex items-center gap-1.5">
                              <Key className="w-3.5 h-3.5 text-amber-500" />
                              Offline Recovery Keys
                            </h5>
                          </div>
                          <button
                            type="button"
                            onClick={handleGenerateRecoveryCodes}
                            disabled={actionLoading || isGeneratingCodes}
                            className="p-1.5 bg-amber-100 hover:bg-amber-200 text-amber-950 border border-slate-900 rounded-lg text-[9px] font-mono font-bold uppercase cursor-pointer flex items-center justify-center"
                            title="Regenerate all recovery keys"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${isGeneratingCodes ? 'animate-spin' : ''}`} />
                          </button>
                        </div>

                        {adminProfile?.recoveryCodes && adminProfile.recoveryCodes.length > 0 ? (
                          <div className="space-y-3">
                            <div className="grid grid-cols-2 gap-1.5 max-h-[140px] overflow-y-auto pr-0.5 font-mono text-[9px] font-bold">
                              {adminProfile.recoveryCodes.map((code: string, idx: number) => {
                                const isCopied = copiedCode === code;
                                return (
                                  <div
                                    key={idx}
                                    className="border border-slate-300 rounded px-2 py-1 bg-slate-50 flex items-center justify-between transition-colors"
                                  >
                                    <span className="text-slate-850 select-all font-mono font-black">{code}</span>
                                    <div className="flex items-center gap-1 shrink-0">
                                      <button
                                        type="button"
                                        onClick={() => {
                                          navigator.clipboard.writeText(code);
                                          setCopiedCode(code);
                                          setTimeout(() => setCopiedCode(null), 2000);
                                        }}
                                        className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-indigo-650 transition-colors"
                                        title="Copy token to clipboard"
                                      >
                                        {isCopied ? (
                                          <Check className="w-3 h-3 text-emerald-600" />
                                        ) : (
                                          <Copy className="w-3 h-3" />
                                        )}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleDownloadSingleCode(code)}
                                        className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-emerald-600 transition-colors"
                                        title="Download token as file"
                                      >
                                        <Download className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                            
                            <button
                              type="button"
                              onClick={handleDownloadAllCodes}
                              className="w-full py-1.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-950 text-[10px] font-black uppercase tracking-wide border-2 border-slate-900 rounded-lg shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                            >
                              <Download className="w-3.5 h-3.5 text-emerald-700" />
                              Download All Keys (.txt)
                            </button>
                          </div>
                        ) : (
                          <div className="text-center py-6 border-2 border-dashed border-slate-200 bg-slate-50 rounded-lg">
                            <p className="text-[10px] text-slate-500 font-mono">No active emergency tokens found. Click regenerate icon above.</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              )}

              {/* TAB 3: MAINTENANCE, METRICS & TESTING */}
              {activeTab === 'maintenance' && (
                <div className="space-y-5 animate-fade-in">
                  
                  {/* COHABITATION DATA NODE METRICS */}
                  <div className="border-3 border-slate-900 rounded-2xl p-5 bg-pink-50/10 space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-widest text-slate-950 font-mono flex items-center gap-1.5 border-b-2 border-slate-200 pb-2">
                      <Database className="w-4 h-4" />
                      Cohabitation Database Node Metrics
                    </h4>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-slate-50 border-2 border-slate-900 rounded-xl p-3 text-center shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]">
                        <p className="text-[9px] font-black text-slate-450 uppercase font-mono">Total Documents</p>
                        <p className="text-xl font-black font-mono text-slate-900">{expenses.length}</p>
                      </div>
                      <div className="bg-slate-50 border-2 border-slate-900 rounded-xl p-3 text-center shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]">
                        <p className="text-[9px] font-black text-slate-450 uppercase font-mono">Electric Coins</p>
                        <p className="text-xl font-black font-mono text-slate-900">{coinExpenses.length}</p>
                      </div>
                      <div className="bg-slate-50 border-2 border-slate-900 rounded-xl p-3 text-center shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]">
                        <p className="text-[9px] font-black text-slate-450 uppercase font-mono">Direct Loans</p>
                        <p className="text-xl font-black font-mono text-slate-900">{lendBorrowExpenses.length}</p>
                      </div>
                      <div className="bg-slate-50 border-2 border-slate-900 rounded-xl p-3 text-center shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]">
                        <p className="text-[9px] font-black text-slate-450 uppercase font-mono">Overall Volume</p>
                        <p className="text-xl font-black font-mono text-slate-900">€{totalAmount.toFixed(1)}</p>
                      </div>
                    </div>

                    <div className="bg-white border-2 border-slate-900 rounded-xl p-3.5 space-y-2">
                      <p className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono">Transaction Log Sub-Structure</p>
                      <div className="space-y-1 text-xs font-bold text-slate-700">
                        <div className="flex justify-between">
                          <span>Regular Shared Bills (Groceries, Rent, Utilities):</span>
                          <span className="font-mono text-slate-900">{regularExpenses.length} items</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Balances Settle-Ups:</span>
                          <span className="font-mono text-slate-900">{settlementExpenses.length} items</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Pending Roommate Confirmation:</span>
                          <span className="font-mono text-amber-600">{expenses.filter(e => e.status === 'pending').length} items</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Pending Roommate Deletion:</span>
                          <span className="font-mono text-rose-600">{expenses.filter(e => e.deleteRequested).length} items</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* DESTRUCTIVE & SIMULATION OVERRIDES */}
                  <div className="border-3 border-rose-900 rounded-2xl p-5 bg-rose-50/20 space-y-4">
                    <h4 className="text-xs font-black uppercase tracking-widest text-rose-950 font-mono flex items-center gap-1.5 border-b-2 border-rose-200 pb-2">
                      <ShieldAlert className="w-4 h-4 text-rose-650" />
                      Destructive Maintenance Overrides
                    </h4>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                      {/* SEED DATA PANEL */}
                      <div className="space-y-2.5 p-3.5 bg-white border-2 border-slate-900 rounded-xl shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] flex flex-col justify-between">
                        <div>
                          <h5 className="text-[10px] font-black uppercase text-slate-800">Seed Simulation Logs</h5>
                          <p className="text-[10px] text-slate-500 font-semibold leading-relaxed mt-1">Inserts a diverse preset of sample roommate transaction logs (groceries split, Revolut direct loan, and coin insertion) to easily seed your ledger.</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleSeedMockData}
                          disabled={actionLoading}
                          className="w-full mt-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-2 border-slate-900 rounded-lg text-[10px] font-black uppercase tracking-wide flex items-center justify-center gap-1.5 cursor-pointer shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]"
                        >
                          <PlusCircle className="w-3.5 h-3.5" />
                          Seed Mock Ledger Data
                        </button>
                      </div>

                      {/* PRUNE LEDGER PANEL */}
                      <div className="space-y-2.5 p-3.5 bg-white border-2 border-slate-900 rounded-xl shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                        <h5 className="text-[10px] font-black uppercase text-rose-800">Prune Complete Ledger</h5>
                        <p className="text-[10px] text-slate-500 font-semibold leading-relaxed mt-1">WARNING: This completely deletes all bills, coins, direct loans, and settlements. This action is final and irreversible.</p>
                        
                        <div className="space-y-1.5 mt-2">
                          <input
                            id="admin-input-prune-confirm"
                            type="text"
                            placeholder='Type "PRUNE" here to unlock'
                            value={confirmInput}
                            onChange={(e) => setConfirmInput(e.target.value)}
                            className="w-full px-2.5 py-1.5 text-[10px] font-mono font-bold border-2 border-slate-900 rounded bg-rose-50/40 text-center uppercase"
                          />
                          <button
                            type="button"
                            onClick={handlePruneLedger}
                            disabled={actionLoading || confirmInput !== 'PRUNE'}
                            className="w-full py-2 bg-rose-500 hover:bg-rose-600 disabled:bg-rose-200 disabled:opacity-50 text-white border-2 border-slate-900 rounded-lg text-[10px] font-black uppercase tracking-wide flex items-center justify-center gap-1.5 cursor-pointer shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            Prune Ledger Documents
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>

                </div>
              )}

            </div>
          )}

        </div>
      </div>

      </div>

      <CustomConfirmModal
        isOpen={confirmState.isOpen}
        title={confirmState.title}
        message={confirmState.message}
        confirmLabel={confirmState.confirmLabel}
        cancelLabel={confirmState.cancelLabel}
        isDestructive={confirmState.isDestructive}
        onConfirm={() => {
          confirmState.onConfirm();
          closeConfirm();
        }}
        onCancel={closeConfirm}
      />
    </div>
  );
}
