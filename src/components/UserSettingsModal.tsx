import React, { useState, useEffect } from 'react';
import { Roommate, Profile, Category } from '../types';
import { getProfile, updateProfile } from '../dbService';
import { 
  X, 
  ShieldCheck, 
  Key, 
  UserCheck, 
  LogOut, 
  Check, 
  AlertCircle, 
  Sparkles, 
  RefreshCw, 
  Smile, 
  Palette, 
  Landmark, 
  PiggyBank, 
  PhoneCall, 
  Zap, 
  Lock, 
  Bell, 
  Fingerprint, 
  Database, 
  Download, 
  Smartphone, 
  LayoutGrid,
  User,
  Shield,
  Sliders,
  ChevronRight,
  Sun
} from 'lucide-react';
import { 
  isNotificationSupported, 
  getNotificationPermission, 
  requestNotificationPermission, 
  showNotification, 
  registerWebPushSubscription 
} from '../notificationService';
import { useAuthStore } from '../authStore';
import { isPlatformAuthenticatorAvailable, registerPlatformCredential } from '../biometricService';
import BackupRestoreModal from './BackupRestoreModal';

interface UserSettingsModalProps {
  currentUser: Roommate;
  onClose: () => void;
  onLockProfile: () => void;
  onProfileUpdated: () => void;
  onOpenDetailedReport: () => void;
  onOpenPrivateVault: () => void;
  navLayout?: 'mobile_app' | 'classic';
  onToggleNavLayout?: () => void;
  onOpenDailyMotivation?: () => void;
}

export default function UserSettingsModal({ 
  currentUser, 
  onClose, 
  onLockProfile,
  onProfileUpdated,
  onOpenDetailedReport,
  onOpenPrivateVault,
  navLayout = 'mobile_app',
  onToggleNavLayout,
  onOpenDailyMotivation
}: UserSettingsModalProps) {
  // Biometric state from Zustand
  const { biometricEnabled, setBiometricEnabled, setUnlocked } = useAuthStore();
  const [biometricSettingUp, setBiometricSettingUp] = useState(false);

  // Active Settings Tab for App UI
  const [activeTab, setActiveTab] = useState<'profile' | 'security' | 'tools' | 'system'>('profile');

  // Profile settings
  const [profile, setProfile] = useState<Profile | null>(null);
  const [nickname, setNickname] = useState('');
  const [avatar, setAvatar] = useState('🐼');
  const [accentColor, setAccentColor] = useState<'indigo' | 'rose' | 'amber' | 'emerald' | 'violet' | 'sky'>('indigo');
  const [monthlyBudget, setMonthlyBudget] = useState('');
  const [preferredPaymentMethod, setPreferredPaymentMethod] = useState<'Cash' | 'Revolut' | 'Bank Transfer'>('Revolut');
  const [quickCoinCategory, setQuickCoinCategory] = useState<Category>('Electricity (Coins)');
  const [phone, setPhone] = useState('');

  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  
  // FCM / Push Notifications state
  const [notifSupported, setNotifSupported] = useState(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
  const [showBackupModal, setShowBackupModal] = useState(false);
  const [showPwaGuide, setShowPwaGuide] = useState(false);

  useEffect(() => {
    setNotifSupported(isNotificationSupported());
    setNotifPermission(getNotificationPermission());
  }, []);

  // UI States
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Fetch profile on open
  useEffect(() => {
    async function loadProfile() {
      setLoading(true);
      setErrorMsg('');
      try {
        const data = await getProfile(currentUser);
        if (data) {
          setProfile(data);
          setNickname(data.nickname || currentUser);
          setAvatar(data.avatar || (currentUser === 'Ozric' ? '🐼' : '🦊'));
          setAccentColor(data.accentColor || (currentUser === 'Ozric' ? 'indigo' : 'rose'));
          setMonthlyBudget(data.monthlyBudget ? String(data.monthlyBudget) : '');
          setPreferredPaymentMethod(data.preferredPaymentMethod || 'Revolut');
          setQuickCoinCategory(data.quickCoinCategory || 'Electricity (Coins)');
          setPhone(data.phone || '');
        }
      } catch (err: any) {
        setErrorMsg('Failed to load profile settings: ' + err.message);
      } finally {
        setLoading(false);
      }
    }
    loadProfile();
  }, [currentUser]);

  // Handle Save Profile Settings
  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!profile) return;

    const trimmedNickname = nickname.trim();
    if (!trimmedNickname) {
      setErrorMsg('Display name cannot be empty.');
      return;
    }

    setIsSaving(true);
    try {
      const parsedBudget = monthlyBudget.trim() ? parseFloat(monthlyBudget) : undefined;
      const budgetValue = (parsedBudget !== undefined && !isNaN(parsedBudget)) ? parsedBudget : null;

      const updates = {
        nickname: trimmedNickname,
        avatar,
        accentColor,
        monthlyBudget: budgetValue,
        preferredPaymentMethod,
        quickCoinCategory,
        phone: phone.trim()
      };

      await updateProfile(currentUser, updates, currentUser);
      setSuccessMsg('Profile settings updated successfully!');
      onProfileUpdated();
      setProfile({ ...profile, ...updates });
    } catch (err: any) {
      setErrorMsg('Failed to update settings: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Password Change
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!profile) return;

    if (!oldPassword) {
      setErrorMsg('Please enter your current password.');
      return;
    }

    if (oldPassword !== profile.password) {
      setErrorMsg('Current password is incorrect.');
      return;
    }

    if (!newPassword) {
      setErrorMsg('New password cannot be empty.');
      return;
    }

    if (newPassword.length < 4) {
      setErrorMsg('New password must be at least 4 characters.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('New passwords do not match.');
      return;
    }

    setIsSaving(true);
    try {
      await updateProfile(currentUser, { password: newPassword }, currentUser);
      setSuccessMsg('Password changed successfully!');
      
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      setProfile({ ...profile, password: newPassword });
      onProfileUpdated();
    } catch (err: any) {
      setErrorMsg('Failed to change password: ' + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Biometric lock activation and registration
  const handleBiometricToggle = async () => {
    setErrorMsg('');
    setSuccessMsg('');
    
    if (biometricEnabled) {
      localStorage.removeItem('roommate_biometric_enabled');
      localStorage.removeItem('roommate_biometric_credential_id');
      localStorage.removeItem('zindagi_biometric_enabled');
      localStorage.removeItem('zindagi_biometric_credential_id');
      setBiometricEnabled(false);
      setUnlocked(true);
      setSuccessMsg('Biometric lock disabled.');
    } else {
      setBiometricSettingUp(true);
      try {
        const isAvailable = await isPlatformAuthenticatorAvailable();
        if (!isAvailable) {
          setErrorMsg('Biometric authentication not available on this device/browser.');
          setBiometricSettingUp(false);
          return;
        }

        const credentialId = await registerPlatformCredential(currentUser);
        localStorage.setItem('roommate_biometric_credential_id', credentialId);
        localStorage.setItem('roommate_biometric_enabled', 'true');
        
        setBiometricEnabled(true);
        setSuccessMsg('Biometric authentication lock enabled successfully!');
      } catch (err: any) {
        console.error('Biometric setup failed:', err);
        setErrorMsg(`Biometric setup failed: ${err.message || err}`);
      } finally {
        setBiometricSettingUp(false);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-md z-[120] flex items-center justify-center p-2 sm:p-4 animate-fade-in font-sans overflow-y-auto">
      <div className="bg-white border-3 border-slate-900 rounded-3xl max-w-2xl w-full flex flex-col shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] overflow-hidden max-h-[92vh] sm:max-h-[88vh] my-auto">
        
        {/* HEADER BAR */}
        <div className="p-3.5 sm:p-4 border-b-2 border-slate-900 flex items-center justify-between bg-slate-50 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 bg-emerald-600 rounded-2xl border-2 border-slate-900 flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] text-white">
              <Sliders className="w-5 h-5 stroke-[2.5px]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-black tracking-tight text-slate-900 uppercase font-display">
                  Account Settings
                </h3>
                <span className="text-[10px] font-mono font-black uppercase px-2 py-0.5 bg-emerald-100 text-emerald-800 rounded-lg border border-emerald-300">
                  {avatar} {currentUser}
                </span>
              </div>
              <p className="text-[10px] text-slate-500 font-medium">
                Manage profile, security lock, tools, and notification preferences
              </p>
            </div>
          </div>

          <button 
            id="btn-close-settings-modal"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-900 bg-white hover:bg-slate-100 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[0.5px] active:translate-y-[0.5px] transition cursor-pointer shrink-0"
            title="Close Settings"
          >
            <X className="w-4 h-4 stroke-[2.5px]" />
          </button>
        </div>

        {/* TAB SEGMENT NAVIGATION */}
        <div className="bg-slate-100 border-b-2 border-slate-900 p-1.5 flex items-center gap-1 overflow-x-auto no-scrollbar shrink-0">
          {[
            { id: 'profile', label: 'Profile', icon: User },
            { id: 'security', label: 'Security', icon: Shield },
            { id: 'tools', label: 'Tools & Vault', icon: Sparkles },
            { id: 'system', label: 'System', icon: Smartphone }
          ].map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-1 min-w-[90px] py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 transition-all cursor-pointer border-2 ${
                  isActive
                    ? 'bg-slate-900 text-white border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]'
                    : 'bg-white text-slate-600 border-transparent hover:border-slate-300 hover:text-slate-900'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 stroke-[2.5px] ${isActive ? 'text-emerald-400' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* MAIN SETTINGS BODY */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto flex-1 min-h-0">
          {errorMsg && (
            <div className="bg-rose-50 border-2 border-slate-900 text-rose-900 text-xs rounded-xl p-3 flex items-start gap-2 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] font-bold">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5 stroke-[2.5px]" />
              <p className="leading-relaxed">{errorMsg}</p>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-50 border-2 border-slate-900 text-emerald-900 text-xs rounded-xl p-3 flex items-start gap-2 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] font-bold">
              <Check className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5 stroke-[3px]" />
              <p className="leading-relaxed">{successMsg}</p>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
              <RefreshCw className="w-8 h-8 animate-spin text-emerald-600 stroke-[2.5px]" />
              <p className="text-xs font-bold font-mono">Loading settings...</p>
            </div>
          ) : (
            <div>
              {/* TAB 1: PROFILE & PERSONALIZATION */}
              {activeTab === 'profile' && (
                <form onSubmit={handleSaveSettings} className="space-y-4">
                  
                  {/* Avatar Picker & Name */}
                  <div className="bg-slate-50 border-2 border-slate-900 p-3.5 rounded-2xl shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)] space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-[10px] font-mono font-black uppercase tracking-wider text-slate-600 flex items-center gap-1">
                        <Smile className="w-3.5 h-3.5 text-emerald-600" /> Choose Avatar Emoji
                      </label>
                      <span className="text-2xl p-1 bg-white border-2 border-slate-900 rounded-xl shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]">
                        {avatar}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 overflow-x-auto no-scrollbar py-1">
                      {['🐼', '🦊', '🦁', '🐨', '🐱', '🐶', '🐯', '🐰', '🐸', '🐙', '🥑', '🍕', '🎮', '💡', '🚀', '🏡'].map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setAvatar(emoji)}
                          className={`w-9 h-9 text-base flex items-center justify-center rounded-xl border-2 transition-all cursor-pointer shrink-0 ${
                            avatar === emoji 
                              ? 'bg-emerald-100 border-slate-900 scale-105 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]' 
                              : 'bg-white border-slate-300 hover:border-slate-500'
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>

                    <div className="space-y-1 pt-1">
                      <label className="text-[10px] font-mono font-black uppercase tracking-wider text-slate-600 block">
                        Display Name / Nickname
                      </label>
                      <input
                        id="input-settings-nickname"
                        type="text"
                        placeholder="Display Name"
                        value={nickname}
                        onChange={(e) => setNickname(e.target.value)}
                        required
                        className="w-full px-3 py-2 rounded-xl bg-white border-2 border-slate-900 focus:outline-none text-xs text-slate-900 font-bold"
                      />
                    </div>
                  </div>

                  {/* Finance & Contact Info */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono font-black uppercase tracking-wider text-slate-600 flex items-center gap-1">
                        <PiggyBank className="w-3.5 h-3.5 text-amber-600" /> Monthly Spend Target (€)
                      </label>
                      <input
                        type="number"
                        placeholder="500"
                        value={monthlyBudget}
                        onChange={(e) => setMonthlyBudget(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border-2 border-slate-900 focus:bg-white focus:outline-none text-xs text-slate-900 font-bold font-mono"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-mono font-black uppercase tracking-wider text-slate-600 flex items-center gap-1">
                        <PhoneCall className="w-3.5 h-3.5 text-emerald-600" /> Phone Number
                      </label>
                      <input
                        type="text"
                        placeholder="+353..."
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border-2 border-slate-900 focus:bg-white focus:outline-none text-xs text-slate-900 font-bold"
                      />
                    </div>
                  </div>

                  {/* Preferred Reimbursement Method */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-black uppercase tracking-wider text-slate-600 flex items-center gap-1">
                      <Landmark className="w-3.5 h-3.5 text-emerald-600" /> Preferred Payout Method
                    </label>
                    <div className="grid grid-cols-3 bg-slate-100 p-1 rounded-xl border-2 border-slate-900 gap-1">
                      {['Revolut', 'Cash', 'Bank Transfer'].map((pm) => (
                        <button
                          key={pm}
                          type="button"
                          onClick={() => setPreferredPaymentMethod(pm as any)}
                          className={`py-2 text-[10px] font-black uppercase tracking-wide rounded-lg transition-all cursor-pointer ${
                            preferredPaymentMethod === pm
                              ? 'bg-slate-900 text-white shadow-sm'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {pm}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Theme Accent Color */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono font-black uppercase tracking-wider text-slate-600 flex items-center gap-1">
                      <Palette className="w-3.5 h-3.5 text-indigo-600" /> Accent Color Theme
                    </label>
                    <div className="flex flex-wrap gap-2 p-2.5 bg-slate-50 border-2 border-slate-900 rounded-2xl">
                      {[
                        { name: 'emerald', label: 'Emerald', bg: 'bg-emerald-600' },
                        { name: 'indigo', label: 'Indigo', bg: 'bg-indigo-600' },
                        { name: 'rose', label: 'Rose', bg: 'bg-rose-600' },
                        { name: 'amber', label: 'Amber', bg: 'bg-amber-500' },
                        { name: 'violet', label: 'Violet', bg: 'bg-violet-600' },
                        { name: 'sky', label: 'Sky', bg: 'bg-sky-500' }
                      ].map((col) => (
                        <button
                          key={col.name}
                          type="button"
                          onClick={() => setAccentColor(col.name as any)}
                          className={`px-3 py-1.5 rounded-xl border-2 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all ${
                            accentColor === col.name
                              ? 'bg-white border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]'
                              : 'bg-white/60 border-slate-200 text-slate-500 hover:border-slate-300'
                          }`}
                        >
                          <span className={`w-3 h-3 rounded-full ${col.bg} border border-slate-900`} />
                          {col.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Daily AI Inspiration Trigger */}
                  {onOpenDailyMotivation && (
                    <button
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenDailyMotivation();
                      }}
                      className="w-full p-3 bg-amber-50 hover:bg-amber-100 text-slate-900 border-2 border-slate-900 rounded-2xl shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] transition-all cursor-pointer flex items-center justify-between mt-2"
                    >
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 bg-amber-400 text-slate-950 rounded-xl border-1.5 border-slate-900 flex items-center justify-center shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]">
                          <Sun className="w-4 h-4 stroke-[2.5px]" />
                        </div>
                        <div className="text-left">
                          <span className="text-xs font-black uppercase text-slate-900 block leading-tight">Daily AI Inspiration</span>
                          <span className="text-[10px] font-bold text-slate-600">Open today's motivational quote & feelings reflection</span>
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 stroke-[2.5px] text-slate-900" />
                    </button>
                  )}

                  {/* Save Button */}
                  <button
                    id="btn-save-profile-details"
                    type="submit"
                    disabled={isSaving}
                    className="w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] flex items-center justify-center gap-2 cursor-pointer transition-all mt-3"
                  >
                    {isSaving ? 'Saving Changes...' : 'Save Preferences'}
                  </button>
                </form>
              )}

              {/* TAB 2: SECURITY & APP LOCK */}
              {activeTab === 'security' && (
                <div className="space-y-4">
                  
                  {/* Biometric Lock Switch Card */}
                  <div className="bg-slate-50 border-2 border-slate-900 p-4 rounded-2xl shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-emerald-100 rounded-xl border-2 border-slate-900 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]">
                          <Fingerprint className="w-5 h-5 text-emerald-800 stroke-[2.5px]" />
                        </div>
                        <div>
                          <h5 className="text-xs font-black text-slate-900 uppercase font-mono">Biometric Lock</h5>
                          <p className="text-[10px] text-slate-500 font-medium">Require Face ID / Touch ID on launch</p>
                        </div>
                      </div>

                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={biometricEnabled}
                          onChange={handleBiometricToggle}
                          disabled={biometricSettingUp}
                          className="sr-only peer"
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-slate-900 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-900 after:border-2 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-600 border-2 border-slate-900"></div>
                      </label>
                    </div>
                  </div>

                  {/* Password Change Form */}
                  <form onSubmit={handleChangePassword} className="space-y-3 bg-white border-2 border-slate-900 p-4 rounded-2xl shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)]">
                    <h5 className="text-xs font-black text-slate-900 uppercase font-mono flex items-center gap-1.5 border-b border-slate-100 pb-2">
                      <Key className="w-4 h-4 text-emerald-600" />
                      Change Account Passcode
                    </h5>

                    <div className="space-y-1">
                      <label className="text-[10px] font-mono font-black uppercase tracking-wider text-slate-600">
                        Current Password
                      </label>
                      <input
                        id="input-old-password"
                        type="password"
                        placeholder="••••"
                        value={oldPassword}
                        onChange={(e) => setOldPassword(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl bg-slate-50 border-2 border-slate-900 focus:outline-none text-xs text-slate-900 font-bold"
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-2.5">
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono font-black uppercase tracking-wider text-slate-600">
                          New Password
                        </label>
                        <input
                          id="input-new-password"
                          type="password"
                          placeholder="••••"
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border-2 border-slate-900 focus:outline-none text-xs text-slate-900 font-bold"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-mono font-black uppercase tracking-wider text-slate-600">
                          Confirm Password
                        </label>
                        <input
                          id="input-confirm-password"
                          type="password"
                          placeholder="••••"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          className="w-full px-3 py-2 rounded-xl bg-slate-50 border-2 border-slate-900 focus:outline-none text-xs text-slate-900 font-bold"
                        />
                      </div>
                    </div>

                    <button
                      id="btn-change-password-submit"
                      type="submit"
                      disabled={isSaving}
                      className="w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-slate-900 hover:bg-slate-800 text-white border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                    >
                      Update Passcode
                    </button>
                  </form>

                  {/* Lock Profile Logout Card */}
                  <div className="pt-1">
                    <button
                      id="btn-lock-session"
                      type="button"
                      onClick={onLockProfile}
                      className="w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider bg-rose-50 hover:bg-rose-100 text-rose-700 border-2 border-rose-900 shadow-[2.5px_2.5px_0px_0px_rgba(225,29,72,1)] active:translate-x-[1px] active:translate-y-[1px] flex items-center justify-center gap-2 cursor-pointer transition-all"
                    >
                      <LogOut className="w-4 h-4 stroke-[2.5px]" />
                      Lock & Switch User Profile
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: TOOLS & VAULT */}
              {activeTab === 'tools' && (
                <div className="space-y-3">
                  
                  {/* DETAILED FINANCIAL REPORT */}
                  <div className="bg-white border-2 border-slate-900 p-4 rounded-2xl shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)] space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-emerald-100 rounded-xl border-2 border-slate-900 text-emerald-800 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]">
                        <Sparkles className="w-5 h-5 stroke-[2.5px]" />
                      </div>
                      <div>
                        <h5 className="text-xs font-black text-slate-900 uppercase font-display">Statement Reports</h5>
                        <p className="text-[10px] text-slate-500 font-medium">Export detailed breakdowns & PDF expense statements</p>
                      </div>
                    </div>
                    <button
                      id="btn-settings-financial-report"
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenDetailedReport();
                      }}
                      className="w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] flex items-center justify-center gap-2 cursor-pointer transition-all"
                    >
                      Generate Statement Report
                    </button>
                  </div>

                  {/* PRIVATE FINANCIAL VAULT */}
                  <div className="bg-white border-2 border-slate-900 p-4 rounded-2xl shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)] space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 bg-indigo-100 rounded-xl border-2 border-slate-900 text-indigo-800 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]">
                        <Lock className="w-5 h-5 stroke-[2.5px]" />
                      </div>
                      <div>
                        <h5 className="text-xs font-black text-slate-900 uppercase font-display">Private Ledger & Vault</h5>
                        <p className="text-[10px] text-slate-500 font-medium">Access encrypted personal accounts, goals & transfers</p>
                      </div>
                    </div>
                    <button
                      id="btn-settings-private-vault"
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenPrivateVault();
                      }}
                      className="w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-slate-900 hover:bg-slate-800 text-white border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] flex items-center justify-center gap-2 cursor-pointer transition-all"
                    >
                      Enter Private Vault
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 4: APP SYSTEM, NOTIFICATIONS & BACKUP */}
              {activeTab === 'system' && (
                <div className="space-y-3">
                  
                  {/* NAVIGATION LAYOUT SWITCHER */}
                  <div className="bg-white border-2 border-slate-900 p-4 rounded-2xl shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-slate-100 rounded-xl border-2 border-slate-900">
                          <LayoutGrid className="w-5 h-5 text-slate-800 stroke-[2.5px]" />
                        </div>
                        <div>
                          <h5 className="text-xs font-black text-slate-900 uppercase font-display">Navigation Layout</h5>
                          <p className="text-[10px] text-slate-500 font-medium">Current: {navLayout === 'mobile_app' ? 'Mobile Bottom Bar' : 'Classic Top Nav'}</p>
                        </div>
                      </div>
                    </div>

                    {onToggleNavLayout && (
                      <button
                        type="button"
                        onClick={onToggleNavLayout}
                        className="w-full py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-900 font-black text-xs uppercase tracking-wider rounded-xl border-2 border-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] flex items-center justify-center gap-2 cursor-pointer transition-all"
                      >
                        <Smartphone className="w-4 h-4 text-emerald-600 stroke-[2.5px]" />
                        {navLayout === 'mobile_app' ? 'Switch to Classic Navigation' : 'Switch to Mobile App Layout'}
                      </button>
                    )}
                  </div>

                  {/* PUSH NOTIFICATIONS CARD */}
                  <div className="bg-white border-2 border-slate-900 p-4 rounded-2xl shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="p-2 bg-indigo-100 rounded-xl border-2 border-slate-900">
                          <Bell className="w-5 h-5 text-indigo-800 stroke-[2.5px]" />
                        </div>
                        <div>
                          <h5 className="text-xs font-black text-slate-900 uppercase font-display">Push Notifications</h5>
                          <p className="text-[10px] text-slate-500 font-medium">Instant alerts on shared expenses</p>
                        </div>
                      </div>
                      {notifPermission === 'granted' ? (
                        <span className="bg-emerald-500 text-white text-[8px] font-mono font-black px-2 py-0.5 rounded-md border border-slate-900 uppercase">
                          Active
                        </span>
                      ) : (
                        <span className="bg-amber-400 text-slate-900 text-[8px] font-mono font-black px-2 py-0.5 rounded-md border border-slate-900 uppercase">
                          Inactive
                        </span>
                      )}
                    </div>

                    {!notifSupported ? (
                      <p className="text-[10px] text-rose-600 font-bold bg-rose-50 p-2 rounded-lg border border-rose-200">
                        Browser does not support web notifications.
                      </p>
                    ) : notifPermission === 'default' ? (
                      <button
                        id="btn-settings-request-fcm"
                        type="button"
                        onClick={async () => {
                          const permission = await requestNotificationPermission();
                          setNotifPermission(permission);
                          if (permission === 'granted') {
                            await registerWebPushSubscription(currentUser);
                            showNotification('🏠 Roommate Wallet', {
                              body: 'Notifications enabled.',
                              tag: 'fcm-activated'
                            });
                          }
                        }}
                        className="w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        Enable Push Notifications
                      </button>
                    ) : notifPermission === 'denied' ? (
                      <p className="text-[10px] text-rose-600 font-bold bg-rose-50 p-2 rounded-lg border border-rose-200">
                        Blocked in browser site settings.
                      </p>
                    ) : (
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          id="btn-settings-sync-push"
                          type="button"
                          onClick={async () => {
                            try {
                              await registerWebPushSubscription(currentUser);
                              showNotification('🏠 Roommate Wallet', {
                                body: 'Push notifications synced.',
                                tag: 'webpush-synced'
                              });
                            } catch (err) {
                              console.error('[Push API] Error re-registering push:', err);
                            }
                          }}
                          className="py-2 rounded-xl text-[10px] font-black uppercase tracking-wider bg-slate-100 hover:bg-slate-200 text-slate-900 border-2 border-slate-900 flex items-center justify-center gap-1 cursor-pointer"
                        >
                          🔄 Sync Alerts
                        </button>
                        <button
                          id="btn-settings-test-fcm"
                          type="button"
                          onClick={() => {
                            const otherRoommate = currentUser === 'Ozric' ? 'Pawan' : 'Ozric';
                            showNotification('🏠 Roommate Wallet', {
                              body: `Test notification from ${otherRoommate}.`,
                              tag: 'test-expense'
                            });
                          }}
                          className="py-2 rounded-xl text-[10px] font-black uppercase tracking-wider bg-emerald-100 hover:bg-emerald-200 text-emerald-900 border-2 border-slate-900 flex items-center justify-center gap-1 cursor-pointer"
                        >
                          🧪 Test Alert
                        </button>
                      </div>
                    )}
                  </div>

                  {/* DATA BACKUP & RESTORE */}
                  <div className="bg-white border-2 border-slate-900 p-4 rounded-2xl shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)] space-y-3">
                    <div className="flex items-center gap-2.5">
                      <div className="p-2 bg-emerald-100 rounded-xl border-2 border-slate-900">
                        <Database className="w-5 h-5 text-emerald-800 stroke-[2.5px]" />
                      </div>
                      <div>
                        <h5 className="text-xs font-black text-slate-900 uppercase font-display">Backup & Restore</h5>
                        <p className="text-[10px] text-slate-500 font-medium">Export JSON backups or restore previous states</p>
                      </div>
                    </div>
                    <button
                      id="btn-settings-open-backup-modal"
                      type="button"
                      onClick={() => setShowBackupModal(true)}
                      className="w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] flex items-center justify-center gap-2 cursor-pointer transition-all"
                    >
                      <Download className="w-4 h-4 stroke-[2.5px]" />
                      <span>Backup & Restore Data</span>
                    </button>
                  </div>

                </div>
              )}
            </div>
          )}
        </div>

        {/* BOTTOM ACTION BAR */}
        <div className="p-3 bg-slate-50 border-t-2 border-slate-900 flex items-center justify-end shrink-0">
          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl text-xs font-black uppercase tracking-wider bg-slate-900 hover:bg-slate-800 text-white border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] cursor-pointer text-center"
          >
            Done
          </button>
        </div>

      </div>

      {showBackupModal && (
        <BackupRestoreModal 
          onClose={() => setShowBackupModal(false)} 
          onRestoreComplete={() => {
            setShowBackupModal(false);
            onClose();
          }}
        />
      )}
    </div>
  );

}
