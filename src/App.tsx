import React, { useState, useEffect } from 'react';
import { Roommate, Expense, Profile } from './types';
import { subscribeExpenses, getProfile } from './dbService';
import UserSelector from './components/UserSelector';
import Dashboard from './components/Dashboard';
import CoinMeter from './components/CoinMeter';
import ExpenseForm from './components/ExpenseForm';
import SettleUpModal from './components/SettleUpModal';
import LendBorrowModal from './components/LendBorrowModal';
import LendBorrowReport from './components/LendBorrowReport';
import ExpenseHistory from './components/ExpenseHistory';
import ProfileLockScreen from './components/ProfileLockScreen';
import UserSettingsModal from './components/UserSettingsModal';
import AdminPanelModal from './components/AdminPanelModal';
import DetailedReportModal from './components/DetailedReportModal';
import { Wallet, Zap, Calendar, HeartHandshake, RefreshCw, AlertCircle, Settings } from 'lucide-react';

export default function App() {
  const [currentUser, setCurrentUser] = useState<Roommate>(() => {
    // Persistent profile selection
    const saved = localStorage.getItem('activeRoommate');
    return (saved as Roommate) || 'Ozric';
  });

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  
  // Modals/Drawers
  const [isAddExpenseOpen, setIsAddExpenseOpen] = useState(false);
  const [isSettleUpOpen, setIsSettleUpOpen] = useState(false);
  const [isLendBorrowOpen, setIsLendBorrowOpen] = useState(false);
  const [isDetailedReportOpen, setIsDetailedReportOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);

  // Security Unlocked sessions (stored in sessionStorage so closing the browser tab locks it)
  const [unlockedUsers, setUnlockedUsers] = useState<Record<Roommate, boolean>>(() => {
    return {
      Ozric: sessionStorage.getItem('unlocked_Ozric') === 'true',
      Pawan: sessionStorage.getItem('unlocked_Pawan') === 'true',
    };
  });

  // Display name nicknames
  const [nicknames, setNicknames] = useState<Record<Roommate, string>>({
    Ozric: 'Ozric',
    Pawan: 'Pawan',
  });

  // Full Roommate Profiles config state
  const [profiles, setProfiles] = useState<Record<Roommate, Profile>>({
    Ozric: { id: 'Ozric', nickname: 'Ozric', avatar: '🐼', accentColor: 'indigo' },
    Pawan: { id: 'Pawan', nickname: 'Pawan', avatar: '🦊', accentColor: 'rose' }
  });

  // Fetch profiles for custom nicknames
  const loadNicknames = async () => {
    try {
      const ozricProf = await getProfile('Ozric');
      const pawanProf = await getProfile('Pawan');
      
      setProfiles({
        Ozric: ozricProf,
        Pawan: pawanProf,
      });

      setNicknames({
        Ozric: ozricProf?.nickname || 'Ozric',
        Pawan: pawanProf?.nickname || 'Pawan',
      });
    } catch (e) {
      console.error('Error loading profiles', e);
    }
  };

  useEffect(() => {
    loadNicknames();
  }, []);

  // Sync profile selector with localStorage
  const handleUserChange = (user: Roommate) => {
    setCurrentUser(user);
    localStorage.setItem('activeRoommate', user);
  };

  const handleUnlockUser = (user: Roommate) => {
    setUnlockedUsers((prev) => {
      const updated = { ...prev, [user]: true };
      sessionStorage.setItem(`unlocked_${user}`, 'true');
      return updated;
    });
  };

  const handleLockUser = (user: Roommate) => {
    setUnlockedUsers((prev) => {
      const updated = { ...prev, [user]: false };
      sessionStorage.removeItem(`unlocked_${user}`);
      return updated;
    });
    setIsSettingsOpen(false);
  };

  const handleLogoDoubleClick = () => {
    // Only allow when Ozric profile is active and unlocked
    if (currentUser === 'Ozric' && unlockedUsers['Ozric']) {
      setIsAdminOpen(true);
    }
  };

  // Real-time Firestore sync
  useEffect(() => {
    setLoading(true);
    const unsubscribe = subscribeExpenses(
      (data) => {
        setExpenses(data);
        setLoading(false);
      },
      (err) => {
        setErrorMsg('Database connection issue: ' + err.message);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, []);

  return (
    <div className="min-h-screen bg-indigo-50 text-slate-900 flex flex-col antialiased">
      {/* APP TOP NAVIGATION HEADER */}
      <header className="sticky top-0 z-40 bg-white border-b-4 border-slate-900 px-4 py-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div 
            className="flex items-center gap-2.5 cursor-pointer select-none" 
            onDoubleClick={handleLogoDoubleClick}
            title={currentUser === 'Ozric' && unlockedUsers['Ozric'] ? "Double-click to open Admin Panel" : undefined}
          >
            <div className="w-10 h-10 bg-pink-500 rounded-xl border-2 border-slate-900 flex items-center justify-center shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] text-white">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-xl font-black tracking-tighter text-slate-900 font-display">
                {nicknames.Ozric} & {nicknames.Pawan}
              </h1>
              <p className="text-[10px] text-indigo-600 font-black uppercase tracking-widest font-mono">
                Roommate Expense Engine
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            {unlockedUsers[currentUser] && (
              <button
                id="btn-settings-open"
                onClick={() => setIsSettingsOpen(true)}
                className="px-3 py-1.5 bg-indigo-55 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 hover:text-indigo-900 border-2 border-slate-900 rounded-xl shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all flex items-center gap-1 text-[10px] font-black uppercase tracking-wide cursor-pointer"
                title="Profile Settings"
              >
                <Settings className="w-3.5 h-3.5" />
                <span>Settings</span>
              </button>
            )}

            <div className="flex items-center gap-1.5">
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              <span className="text-[9px] font-black text-slate-900 bg-amber-400 border-2 border-slate-900 px-2 py-0.5 rounded-full font-mono tracking-wide uppercase shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] hidden xs:inline">
                PWA Sync Live
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* CORE WRAPPER */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 md:py-8 space-y-6">
        {errorMsg && (
          <div className="bg-rose-100 border-2 border-slate-900 rounded-2xl p-4 flex items-start gap-3 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] text-slate-900">
            <AlertCircle className="w-5 h-5 shrink-0 text-rose-600 mt-0.5" />
            <div>
              <h5 className="font-bold text-sm">Sync Error</h5>
              <p className="mt-0.5 text-xs text-slate-600 font-medium">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* ACTIVE PROFILE SELECTOR */}
        <UserSelector currentUser={currentUser} onUserChange={handleUserChange} nicknames={nicknames} profiles={profiles} />

        {!unlockedUsers[currentUser] ? (
          <ProfileLockScreen 
            selectedUser={currentUser} 
            onUnlock={() => handleUnlockUser(currentUser)} 
            onSwitchUser={handleUserChange}
          />
        ) : loading ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-slate-500">
            <RefreshCw className="w-8 h-8 animate-spin text-indigo-600" />
            <p className="text-sm font-black text-slate-850">Loading ledger data...</p>
            <p className="text-xs text-slate-500">Syncing database via Firestore Cache</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
            {/* LEFT COLUMN: BALANCE AND COIN METER */}
            <div className="md:col-span-2 space-y-6">
              <Dashboard 
                expenses={expenses} 
                currentUser={currentUser}
                onOpenAddExpense={() => setIsAddExpenseOpen(true)}
                onOpenSettleUp={() => setIsSettleUpOpen(true)}
                onOpenLendBorrow={() => setIsLendBorrowOpen(true)}
                nicknames={nicknames}
                profiles={profiles}
              />

              <LendBorrowReport 
                expenses={expenses}
                currentUser={currentUser}
                nicknames={nicknames}
              />

              <CoinMeter 
                expenses={expenses} 
                currentUser={currentUser} 
                onLogSuccess={() => {}}
                nicknames={nicknames}
                profiles={profiles}
              />
            </div>

            {/* RIGHT COLUMN: HISTORY */}
            <div className="md:col-span-1 space-y-6">
              <ExpenseHistory 
                expenses={expenses} 
                currentUser={currentUser}
                onDeleteSuccess={() => {}}
                nicknames={nicknames}
              />
            </div>
          </div>
        )}
      </main>

      {/* MODAL WRAPPERS */}
      {isAddExpenseOpen && (
        <ExpenseForm 
          currentUser={currentUser}
          onClose={() => setIsAddExpenseOpen(false)}
          onSuccess={() => setIsAddExpenseOpen(false)}
          nicknames={nicknames}
        />
      )}

      {isLendBorrowOpen && (
        <LendBorrowModal 
          currentUser={currentUser}
          onClose={() => setIsLendBorrowOpen(false)}
          onSuccess={() => setIsLendBorrowOpen(false)}
          nicknames={nicknames}
        />
      )}

      {isSettleUpOpen && (
        <SettleUpModal 
          expenses={expenses}
          currentUser={currentUser}
          onClose={() => setIsSettleUpOpen(false)}
          onSuccess={() => setIsSettleUpOpen(false)}
          nicknames={nicknames}
        />
      )}

      {isDetailedReportOpen && (
        <DetailedReportModal 
          expenses={expenses}
          currentUser={currentUser}
          onClose={() => setIsDetailedReportOpen(false)}
          nicknames={nicknames}
        />
      )}

      {isSettingsOpen && (
        <UserSettingsModal 
          currentUser={currentUser}
          onClose={() => setIsSettingsOpen(false)}
          onLockProfile={() => handleLockUser(currentUser)}
          onProfileUpdated={loadNicknames}
          onOpenDetailedReport={() => setIsDetailedReportOpen(true)}
        />
      )}

      {isAdminOpen && (
        <AdminPanelModal 
          expenses={expenses}
          onClose={() => setIsAdminOpen(false)}
          onRefreshNicknames={loadNicknames}
        />
      )}

      {/* SUBTLE FOOTER CREDIT */}
      <footer className="py-6 text-center text-[10px] text-slate-500 font-mono tracking-wider border-t-2 border-indigo-100 max-w-4xl mx-auto w-full">
        Shared Cohabitation PWA • Designed for Pawan & Ozric
      </footer>
    </div>
  );
}
