import React from 'react';
import { 
  KeyRound, 
  Calendar, 
  ShoppingBag, 
  BarChart3, 
  Plus, 
  Lock, 
  Settings,
  LayoutGrid
} from 'lucide-react';

interface MobileBottomNavProps {
  activeTab: 'workspace' | 'insights' | 'personal' | 'roster' | 'shopping';
  setActiveTab: (tab: 'workspace' | 'insights' | 'personal' | 'roster' | 'shopping') => void;
  onOpenAddExpense: () => void;
  onOpenSettings: () => void;
  isSettingsOpen: boolean;
  isUnlocked: boolean;
  onRestoreClassicNav?: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeTab,
  setActiveTab,
  onOpenAddExpense,
  onOpenSettings,
  isSettingsOpen,
  isUnlocked,
}) => {
  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-white border-t-3 border-slate-900 shadow-[0px_-4px_0px_0px_rgba(15,23,42,1)] font-sans pb-safe">
      <div className="max-w-md mx-auto px-2 py-1.5 flex items-center justify-between relative">
        
        {/* 1. Ledger Tab */}
        <button
          onClick={() => setActiveTab('workspace')}
          className={`flex-1 flex flex-col items-center py-1.5 px-1 rounded-xl transition-all cursor-pointer ${
            activeTab === 'workspace' && !isSettingsOpen
              ? 'text-indigo-700 bg-indigo-50 font-black scale-105 border-2 border-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]' 
              : 'text-slate-600 hover:text-slate-900 font-bold'
          }`}
        >
          <KeyRound className="w-5 h-5 stroke-[2.5px]" />
          <span className="text-[10px] uppercase tracking-wider mt-0.5 font-mono">Ledger</span>
        </button>

        {/* 2. Roster Tab */}
        <button
          onClick={() => setActiveTab('roster')}
          disabled={!isUnlocked}
          className={`flex-1 flex flex-col items-center py-1.5 px-1 rounded-xl transition-all cursor-pointer ${
            activeTab === 'roster' && !isSettingsOpen
              ? 'text-pink-700 bg-pink-50 font-black scale-105 border-2 border-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]' 
              : 'text-slate-600 hover:text-slate-900 font-bold opacity-90'
          }`}
        >
          <Calendar className="w-5 h-5 stroke-[2.5px]" />
          <span className="text-[10px] uppercase tracking-wider mt-0.5 font-mono">Shifts</span>
        </button>

        {/* 3. Center FAB - Quick Add Expense */}
        <div className="flex-1 flex justify-center -mt-5">
          <button
            onClick={onOpenAddExpense}
            className="w-13 h-13 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white border-3 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] transition-all cursor-pointer flex items-center justify-center group"
            title="Add New Expense"
          >
            <Plus className="w-7 h-7 stroke-[3px] group-hover:scale-110 transition-transform" />
          </button>
        </div>

        {/* 4. Grocery / Shopping Tab */}
        <button
          onClick={() => setActiveTab('shopping')}
          disabled={!isUnlocked}
          className={`flex-1 flex flex-col items-center py-1.5 px-1 rounded-xl transition-all cursor-pointer ${
            activeTab === 'shopping' && !isSettingsOpen
              ? 'text-emerald-800 bg-emerald-50 font-black scale-105 border-2 border-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]' 
              : 'text-slate-600 hover:text-slate-900 font-bold opacity-90'
          }`}
        >
          <ShoppingBag className="w-5 h-5 stroke-[2.5px]" />
          <span className="text-[10px] uppercase tracking-wider mt-0.5 font-mono">Grocery</span>
        </button>

        {/* 5. Settings Tab */}
        <button
          onClick={onOpenSettings}
          className={`flex-1 flex flex-col items-center py-1.5 px-1 rounded-xl transition-all cursor-pointer ${
            isSettingsOpen
              ? 'text-indigo-900 bg-indigo-100 font-black scale-105 border-2 border-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]' 
              : 'text-slate-600 hover:text-slate-900 font-bold'
          }`}
        >
          <Settings className="w-5 h-5 stroke-[2.5px]" />
          <span className="text-[10px] uppercase tracking-wider mt-0.5 font-mono">Settings</span>
        </button>

      </div>
    </div>
  );
};
