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
  ChevronRight
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
}

export default function UserSettingsModal({ 
  currentUser, 
  onClose, 
  onLockProfile,
  onProfileUpdated,
  onOpenDetailedReport,
  onOpenPrivateVault,
  navLayout = 'mobile_app',
  onToggleNavLayout
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
    <div className="fixed inset-0 bg-indigo-50 z-40 flex flex-col justify-between animate-fade-in font-sans pb-16 md:pb-0 overflow-hidden">
      <div className="w-full max-w-3xl mx-auto bg-white border-x-0 md:border-x-3 border-slate-900 h-full flex flex-col shadow-xl overflow-hidden">
        
        {/* MOBILE APP HEADER BAR */}
        <div className="p-4 border-b-3 border-slate-900 flex items-center justify-between bg-indigo-50/80 sticky top-0 z-20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-600 rounded-2xl border-2 border-slate-900 flex items-center justify-center shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] text-white">
              <Sliders className="w-5 h-5 stroke-[2.5px]" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black tracking-tight text-slate-900">
                Account & Preferences
              </h3>
              <p className="text-[10px] sm:text-xs text-indigo-700 font-bold uppercase tracking-wider font-mono">
                {currentUser}'s Settings
              </p>
            </div>
          </div>
          <button 
            id="btn-close-settings-modal"
            onClick={onClose}
            className="px-3 py-1.5 rounded-xl text-slate-900 bg-white hover:bg-slate-100 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[0.5px] active:translate-y-[0.5px] flex items-center gap-1.5 text-xs font-black transition cursor-pointer"
            title="Close Settings"
          >
            <X className="w-4 h-4 stroke-[2.5px]" />
            <span>Close</span>
          </button>
        </div>

        {/* PROFILE HERO SUMMARY CARD */}
        {!loading && profile && (
          <div className="p-4 bg-slate-900 text-white border-b-3 border-slate-900 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-white border-2 border-slate-900 flex items-center justify-center text-2xl shadow-[2px_2px_0px_0px_rgba(255,255,255,0.2)] shrink-0">
                {avatar}
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="text-sm font-black text-white">{nickname || currentUser}</h4>
                  <span className="text-[9px] font-mono font-black uppercase px-2 py-0.5 bg-indigo-500 text-white rounded border border-white/20">
                    {currentUser}
                  </span>
                </div>
                <p className="text-[10px] text-slate-300 font-medium font-mono mt-0.5">
                  Payout: <span className="text-amber-300 font-bold">{preferredPaymentMethod}</span>
                  {phone ? ` • ${phone}` : ''}
                </p>
              </div>
            </div>

            <div className="text-right">
              <span className="inline-flex items-center gap-1 text-[9px] font-mono font-black uppercase px-2 py-1 bg-emerald-500 text-slate-950 rounded-lg border border-slate-900 shadow-[1px_1px_0px_0px_rgba(255,255,255,0.2)]">
                <ShieldCheck className="w-3 h-3 stroke-[3px]" />
                Unlocked
              </span>
            </div>
          </div>
        )}

        {/* MOBILE APP CATEGORY SEGMENT TABS */}
        <div className="bg-slate-100 border-b-3 border-slate-900 p-1.5 flex items-center justify-between gap-1 overflow-x-auto no-scrollbar">
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
                className={`flex-1 min-w-[75px] py-2 px-2 rounded-xl text-[10px] font-mono font-black uppercase tracking-wider flex flex-col sm:flex-row items-center justify-center gap-1 transition-all cursor-pointer border-2 ${
                  isActive
                    ? 'bg-white text-indigo-900 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] scale-[1.02]'
                    : 'bg-transparent text-slate-600 border-transparent hover:bg-slate-200/60'
                }`}
              >
                <Icon className={`w-3.5 h-3.5 stroke-[2.5px] ${isActive ? 'text-indigo-600' : 'text-slate-500'}`} />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* MAIN SETTINGS SCROLL CONTENT */}
        <div className="p-4 sm:p-5 space-y-5 overflow-y-auto flex-1">
          {errorMsg && (
            <div className="bg-rose-100 border-2 border-slate-900 text-slate-900 text-xs rounded-2xl p-3.5 flex items-start gap-2.5 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] font-bold">
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5 stroke-[2.5px]" />
              <p className="leading-relaxed">{errorMsg}</p>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-100 border-2 border-slate-900 text-slate-900 text-xs rounded-2xl p-3.5 flex items-start gap-2.5 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] font-bold">
              <Check className="w-4 h-4 text-emerald-800 shrink-0 mt-0.5 stroke-[3px]" />
              <p className="leading-relaxed">{successMsg}</p>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-slate-500">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 stroke-[2.5px]" />
              <p className="text-xs font-bold font-mono">Loading preferences...</p>
            </div>
          ) : (
            <div>
              {/* TAB 1: PROFILE & PERSONALIZATION */}
              {activeTab === 'profile' && (
                <form onSubmit={handleSaveSettings} className="space-y-4">
                  <div className="flex items-center justify-between pb-1 border-b-2 border-slate-100">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 font-mono flex items-center gap-1.5">
                      <UserCheck className="w-4 h-4 text-indigo-600 stroke-[2.5px]" />
                      Profile Details
                    </h4>
                  </div>

                  {/* Nickname Input */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-black uppercase tracking-wider text-slate-600">
                      Display Name
                    </label>
                    <input
                      id="input-settings-nickname"
                      type="text"
                      placeholder="Display Name"
                      value={nickname}
                      onChange={(e) => setNickname(e.target.value)}
                      required
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border-2 border-slate-900 focus:bg-white focus:outline-none text-xs text-slate-900 font-bold"
                    />
                  </div>

                  {/* Avatar Picker */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono font-black uppercase tracking-wider text-slate-600 flex items-center gap-1">
                      <Smile className="w-3.5 h-3.5 text-indigo-600" /> Avatar Emoji
                    </label>
                    <div className="flex flex-wrap gap-2 p-2.5 bg-slate-50 border-2 border-slate-900 rounded-2xl max-h-28 overflow-y-auto">
                      {['🐼', '🦊', '🦁', '🐨', '🐱', '🐶', '🐯', '🐰', '🐸', '🐙', '🥑', '🍕', '🎮', '💡', '🚀', '🏡'].map((emoji) => (
                        <button
                          key={emoji}
                          type="button"
                          onClick={() => setAvatar(emoji)}
                          className={`w-9 h-9 text-base flex items-center justify-center rounded-xl border-2 transition-all cursor-pointer ${
                            avatar === emoji 
                              ? 'bg-indigo-100 border-indigo-900 scale-110 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]' 
                              : 'bg-white border-slate-200 hover:border-slate-400'
                          }`}
                        >
                          {emoji}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Accent Color Picker */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-mono font-black uppercase tracking-wider text-slate-600 flex items-center gap-1">
                      <Palette className="w-3.5 h-3.5 text-indigo-600" /> Theme Accent
                    </label>
                    <div className="flex flex-wrap gap-2 p-2.5 bg-slate-50 border-2 border-slate-900 rounded-2xl">
                      {[
                        { name: 'indigo', label: 'Indigo', bg: 'bg-indigo-600' },
                        { name: 'rose', label: 'Rose', bg: 'bg-rose-600' },
                        { name: 'amber', label: 'Amber', bg: 'bg-amber-500' },
                        { name: 'emerald', label: 'Emerald', bg: 'bg-emerald-600' },
                        { name: 'violet', label: 'Violet', bg: 'bg-violet-600' },
                        { name: 'sky', label: 'Sky', bg: 'bg-sky-500' }
                      ].map((col) => (
                        <button
                          key={col.name}
                          type="button"
                          onClick={() => setAccentColor(col.name as any)}
                          className={`px-2.5 py-1.5 rounded-xl border-2 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all ${
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

                  <div className="grid grid-cols-2 gap-3">
                    {/* Monthly Budget Target */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono font-black uppercase tracking-wider text-slate-600 flex items-center gap-1">
                        <PiggyBank className="w-3.5 h-3.5 text-amber-600" /> Monthly Target (€)
                      </label>
                      <input
                        type="number"
                        placeholder="500"
                        value={monthlyBudget}
                        onChange={(e) => setMonthlyBudget(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border-2 border-slate-900 focus:bg-white focus:outline-none text-xs text-slate-900 font-bold"
                      />
                    </div>

                    {/* Contact Phone Number */}
                    <div className="space-y-1">
                      <label className="text-[10px] font-mono font-black uppercase tracking-wider text-slate-600 flex items-center gap-1">
                        <PhoneCall className="w-3.5 h-3.5 text-emerald-600" /> Phone
                      </label>
                      <input
                        type="text"
                        placeholder="+353..."
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border-2 border-slate-900 focus:bg-white focus:outline-none text-xs text-slate-900 font-bold"
                      />
                    </div>
                  </div>

                  {/* Preferred Reimbursement Method */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-black uppercase tracking-wider text-slate-600 flex items-center gap-1">
                      <Landmark className="w-3.5 h-3.5 text-indigo-600" /> Preferred Reimbursement
                    </label>
                    <div className="flex bg-slate-100 p-1 rounded-xl border-2 border-slate-900">
                      {['Revolut', 'Cash', 'Bank Transfer'].map((pm) => (
                        <button
                          key={pm}
                          type="button"
                          onClick={() => setPreferredPaymentMethod(pm as any)}
                          className={`flex-1 py-2 text-[10px] font-black uppercase tracking-wide rounded-lg transition-all cursor-pointer ${
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

                  {/* Quick Log Coin Category */}
                  <div className="space-y-1">
                    <label className="text-[10px] font-mono font-black uppercase tracking-wider text-slate-600 flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5 text-amber-500" /> Quick Add Category
                    </label>
                    <select
                      value={quickCoinCategory}
                      onChange={(e) => setQuickCoinCategory(e.target.value as Category)}
                      className="w-full px-3.5 py-2.5 rounded-xl bg-slate-50 border-2 border-slate-900 focus:bg-white focus:outline-none text-xs text-slate-900 font-bold appearance-none cursor-pointer"
                      style={{ backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'black\' stroke-width=\'3\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 0.8rem center', backgroundSize: '1em' }}
                    >
                      {[
                        'Rent',
                        'Electricity (Coins)',
                        'Shared Groceries',
                        'Household Supplies',
                        'Internet/Wi-Fi',
                        'Takeout/Delivery',
                        'Other'
                      ].map((cat) => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  </div>

                  <button
                    id="btn-save-profile-details"
                    type="submit"
                    disabled={isSaving}
                    className="w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] flex items-center justify-center gap-2 cursor-pointer transition-all mt-2"
                  >
                    {isSaving ? 'Saving...' : 'Save Preferences'}
                  </button>
                </form>
              )}

              {/* TAB 2: SECURITY & APP LOCK */}
              {activeTab === 'security' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-1 border-b-2 border-slate-100">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 font-mono flex items-center gap-1.5">
                      <Shield className="w-4 h-4 text-indigo-600 stroke-[2.5px]" />
                      Security & Passcode
                    </h4>
                  </div>

                  {/* Biometric Lock Switch Card */}
                  <div className="bg-indigo-50 border-2 border-slate-900 p-4 rounded-2xl shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)] space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-100 rounded-xl border border-slate-900">
                          <Fingerprint className="w-5 h-5 text-indigo-700 stroke-[2.5px]" />
                        </div>
                        <div>
                          <h5 className="text-xs font-black text-slate-900 uppercase font-mono">Biometric Lock</h5>
                          <p className="text-[10px] text-slate-600 font-medium">Face ID / Touch ID</p>
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
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-slate-900 after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-900 after:border-2 after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600 border-2 border-slate-900"></div>
                      </label>
                    </div>

                    {biometricEnabled && (
                      <button
                        id="btn-settings-lock-now"
                        type="button"
                        onClick={() => {
                          onClose();
                          setUnlocked(false);
                          showNotification('Roommate Wallet Locked', {
                            body: 'App locked successfully.',
                            tag: 'biometric-lock-now'
                          });
                        }}
                        className="w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-slate-900 hover:bg-slate-800 text-white border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[0.5px] active:translate-y-[0.5px] flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Lock className="w-3.5 h-3.5 text-indigo-400 stroke-[2.5px]" />
                        Lock App Now
                      </button>
                    )}
                  </div>

                  {/* Password Change Form */}
                  <form onSubmit={handleChangePassword} className="space-y-3 bg-slate-50 border-2 border-slate-900 p-4 rounded-2xl shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)]">
                    <h5 className="text-xs font-black text-slate-900 uppercase font-mono flex items-center gap-1.5">
                      <Key className="w-4 h-4 text-indigo-600" />
                      Change Password
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
                        className="w-full px-3.5 py-2.5 rounded-xl bg-white border-2 border-slate-900 focus:outline-none text-xs text-slate-900 font-bold"
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
                          className="w-full px-3 py-2 rounded-xl bg-white border-2 border-slate-900 focus:outline-none text-xs text-slate-900 font-bold"
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
                          className="w-full px-3 py-2 rounded-xl bg-white border-2 border-slate-900 focus:outline-none text-xs text-slate-900 font-bold"
                        />
                      </div>
                    </div>

                    <button
                      id="btn-change-password-submit"
                      type="submit"
                      disabled={isSaving}
                      className="w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-slate-900 text-white border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:bg-slate-800 active:translate-x-[1px] active:translate-y-[1px] flex items-center justify-center gap-1.5 cursor-pointer mt-1"
                    >
                      Update Password
                    </button>
                  </form>

                  {/* Lock Profile Logout Card */}
                  <div className="pt-2">
                    <button
                      id="btn-lock-session"
                      type="button"
                      onClick={onLockProfile}
                      className="w-full py-3 rounded-xl text-xs font-black uppercase tracking-wider bg-rose-50 text-rose-700 border-2 border-rose-900 shadow-[3px_3px_0px_0px_rgba(225,29,72,1)] hover:bg-rose-100 active:translate-x-[1px] active:translate-y-[1px] flex items-center justify-center gap-2 cursor-pointer transition-all"
                    >
                      <LogOut className="w-4 h-4 stroke-[2.5px]" />
                      Lock & Exit Profile
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 3: TOOLS & VAULT */}
              {activeTab === 'tools' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-1 border-b-2 border-slate-100">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 font-mono flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-emerald-600 stroke-[2.5px]" />
                      Tools & Private Vault
                    </h4>
                  </div>

                  {/* DETAILED FINANCIAL REPORT */}
                  <div className="space-y-2.5 bg-emerald-50/60 border-2 border-emerald-900 p-4 rounded-2xl shadow-[3px_3px_0px_0px_rgba(16,185,129,1)]">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-emerald-100 rounded-xl border border-emerald-900">
                        <Sparkles className="w-5 h-5 text-emerald-700 stroke-[2.5px]" />
                      </div>
                      <div>
                        <h5 className="text-xs font-black text-emerald-950 uppercase font-mono">Statement Reports</h5>
                        <p className="text-[10px] text-emerald-800 font-medium">Export PDF financial reports</p>
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
                  <div className="space-y-2.5 bg-purple-50/60 border-2 border-purple-900 p-4 rounded-2xl shadow-[3px_3px_0px_0px_rgba(147,51,234,1)]">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-purple-100 rounded-xl border border-purple-900">
                        <Lock className="w-5 h-5 text-purple-700 stroke-[2.5px]" />
                      </div>
                      <div>
                        <h5 className="text-xs font-black text-purple-950 uppercase font-mono">Private Vault</h5>
                        <p className="text-[10px] text-purple-800 font-medium">Encrypted personal savings & cash</p>
                      </div>
                    </div>
                    <button
                      id="btn-settings-private-vault"
                      type="button"
                      onClick={() => {
                        onClose();
                        onOpenPrivateVault();
                      }}
                      className="w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-purple-600 hover:bg-purple-700 text-white border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] flex items-center justify-center gap-2 cursor-pointer transition-all"
                    >
                      Enter Private Vault
                    </button>
                  </div>
                </div>
              )}

              {/* TAB 4: APP SYSTEM, NOTIFICATIONS & BACKUP */}
              {activeTab === 'system' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-1 border-b-2 border-slate-100">
                    <h4 className="text-xs font-black uppercase tracking-wider text-slate-900 font-mono flex items-center gap-1.5">
                      <Smartphone className="w-4 h-4 text-indigo-600 stroke-[2.5px]" />
                      App System
                    </h4>
                  </div>

                  {/* NAVIGATION LAYOUT SWITCHER */}
                  <div className="space-y-2.5 bg-slate-50 border-2 border-slate-900 p-4 rounded-2xl shadow-[2.5px_2.5px_0px_0px_rgba(15,23,42,1)]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-100 rounded-xl border border-slate-900">
                          <LayoutGrid className="w-5 h-5 text-indigo-700 stroke-[2.5px]" />
                        </div>
                        <div>
                          <h5 className="text-xs font-black text-slate-900 uppercase font-mono">App Layout</h5>
                          <p className="text-[10px] text-slate-600 font-medium">{navLayout === 'mobile_app' ? 'Mobile App Mode' : 'Classic Top Nav'}</p>
                        </div>
                      </div>
                    </div>

                    {onToggleNavLayout && (
                      <button
                        type="button"
                        onClick={onToggleNavLayout}
                        className="w-full py-2.5 bg-white hover:bg-slate-100 text-slate-900 font-black text-xs uppercase tracking-wider rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[0.5px] active:translate-y-[0.5px] flex items-center justify-center gap-2 cursor-pointer transition-all"
                      >
                        <Smartphone className="w-4 h-4 text-indigo-600 stroke-[2.5px]" />
                        {navLayout === 'mobile_app' ? 'Switch to Classic Navigation' : 'Switch to Mobile App Layout'}
                      </button>
                    )}
                  </div>

                  {/* FCM PUSH NOTIFICATIONS CARD */}
                  <div className="space-y-3 bg-indigo-50 border-2 border-slate-900 p-4 rounded-2xl shadow-[2.5px_2.5px_0px_0px_rgba(79,70,229,1)]">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="p-2 bg-indigo-100 rounded-xl border border-slate-900">
                          <Bell className="w-5 h-5 text-indigo-700 stroke-[2.5px]" />
                        </div>
                        <div>
                          <h5 className="text-xs font-black text-slate-900 uppercase font-mono">Push Notifications</h5>
                          <p className="text-[10px] text-slate-600 font-medium">Real-time alerts</p>
                        </div>
                      </div>
                      {notifPermission === 'granted' ? (
                        <span className="bg-emerald-500 text-white text-[8px] font-mono font-black px-1.5 py-0.5 rounded border border-slate-900 uppercase shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]">
                          Active
                        </span>
                      ) : (
                        <span className="bg-amber-400 text-slate-900 text-[8px] font-mono font-black px-1.5 py-0.5 rounded border border-slate-900 uppercase shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]">
                          Setup
                        </span>
                      )}
                    </div>

                    {!notifSupported ? (
                      <div className="p-2 bg-rose-50 border border-rose-300 rounded-xl text-[10px] text-rose-700 font-bold">
                        Browser does not support notifications.
                      </div>
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
                        className="w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-indigo-600 hover:bg-indigo-700 text-white border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        Enable Push Notifications
                      </button>
                    ) : notifPermission === 'denied' ? (
                      <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-xl text-[10px] text-rose-700 font-bold">
                        Permission Denied in browser settings.
                      </div>
                    ) : (
                      <div className="space-y-2">
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
                          className="w-full py-2 rounded-xl text-[10px] font-black uppercase tracking-wider bg-indigo-100 hover:bg-indigo-200 text-indigo-900 border-2 border-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] flex items-center justify-center gap-1 cursor-pointer"
                        >
                          🔄 Sync Push Notifications
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
                          className="w-full py-2 rounded-xl text-[10px] font-black uppercase tracking-wider bg-white hover:bg-slate-50 text-slate-900 border-2 border-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] flex items-center justify-center gap-1 cursor-pointer"
                        >
                          🧪 Send Test Notification
                        </button>
                      </div>
                    )}
                  </div>

                  {/* DATA BACKUP & RESTORE */}
                  <div className="space-y-2.5 bg-emerald-50/60 border-2 border-emerald-900 p-4 rounded-2xl shadow-[2.5px_2.5px_0px_0px_rgba(5,150,105,1)]">
                    <div className="flex items-center gap-2">
                      <div className="p-2 bg-emerald-100 rounded-xl border border-emerald-900">
                        <Database className="w-5 h-5 text-emerald-700 stroke-[2.5px]" />
                      </div>
                      <div>
                        <h5 className="text-xs font-black text-emerald-950 uppercase font-mono">Backup & Restore</h5>
                        <p className="text-[10px] text-emerald-800 font-medium">Data export & import</p>
                      </div>
                    </div>
                    <button
                      id="btn-settings-open-backup-modal"
                      type="button"
                      onClick={() => setShowBackupModal(true)}
                      className="w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider bg-emerald-600 hover:bg-emerald-700 text-white border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] flex items-center justify-center gap-2 cursor-pointer transition-all"
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

        {/* BOTTOM FIXED ACTION BAR */}
        <div className="p-3 bg-slate-50 border-t-3 border-slate-900 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 px-4 rounded-xl text-xs font-black uppercase tracking-wider bg-white hover:bg-slate-100 text-slate-800 border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[0.5px] active:translate-y-[0.5px] cursor-pointer text-center"
          >
            Close Settings
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
