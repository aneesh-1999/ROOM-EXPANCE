import React, { useState, useEffect } from 'react';
import { Roommate, Profile, Category } from '../types';
import { getProfile, updateProfile } from '../dbService';
import { X, ShieldCheck, Key, UserCheck, LogOut, Check, AlertCircle, Sparkles, RefreshCw, Smile, Palette, Landmark, PiggyBank, PhoneCall, Zap, Lock, Bell, Fingerprint } from 'lucide-react';
import { isNotificationSupported, getNotificationPermission, requestNotificationPermission, showNotification } from '../notificationService';
import { useAuthStore } from '../authStore';
import { isPlatformAuthenticatorAvailable, registerPlatformCredential } from '../biometricService';

interface UserSettingsModalProps {
  currentUser: Roommate;
  onClose: () => void;
  onLockProfile: () => void;
  onProfileUpdated: () => void;
  onOpenDetailedReport: () => void;
  onOpenPrivateVault: () => void;
}

export default function UserSettingsModal({ 
  currentUser, 
  onClose, 
  onLockProfile,
  onProfileUpdated,
  onOpenDetailedReport,
  onOpenPrivateVault
}: UserSettingsModalProps) {
  // Biometric state from Zustand
  const { biometricEnabled, setBiometricEnabled, setUnlocked } = useAuthStore();
  const [biometricSettingUp, setBiometricSettingUp] = useState(false);

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
      // Update local state
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
      
      // Clear password form
      setOldPassword('');
      setNewPassword('');
      setConfirmPassword('');
      
      // Update local profile state
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
      // Disable biometrics
      localStorage.removeItem('roommate_biometric_enabled');
      localStorage.removeItem('roommate_biometric_credential_id');
      localStorage.removeItem('zindagi_biometric_enabled');
      localStorage.removeItem('zindagi_biometric_credential_id');
      setBiometricEnabled(false);
      setUnlocked(true); // Fail-safe: ensure unlocked when disabled
      setSuccessMsg('Biometric lock disabled.');
    } else {
      // Enable biometrics
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
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="bg-white border-4 border-slate-900 rounded-3xl w-full max-w-md shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] overflow-hidden my-auto flex flex-col">
        {/* HEADER */}
        <div className="p-5 border-b-4 border-slate-100 flex items-center justify-between bg-indigo-50/25">
          <div className="flex items-center gap-2.5">
            <span className="p-2.5 bg-indigo-100 text-indigo-600 rounded-2xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
              <ShieldCheck className="w-5 h-5" />
            </span>
            <div>
              <h3 className="text-lg font-black tracking-tight text-slate-900">{currentUser}'s Settings</h3>
              <p className="text-xs text-slate-500 font-medium font-sans">Manage security and roommate profile</p>
            </div>
          </div>
          <button 
            id="btn-close-settings-modal"
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-900 hover:bg-slate-100 border-2 border-slate-200 hover:border-slate-900 transition duration-200 cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* CONTENT */}
        <div className="p-6 space-y-6 max-h-[80vh] overflow-y-auto">
          {errorMsg && (
            <div className="bg-rose-100 border-2 border-slate-900 text-slate-900 text-xs rounded-2xl p-4 flex items-start gap-2.5 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] font-bold">
              <AlertCircle className="w-4 h-4 text-rose-650 shrink-0 mt-0.5" />
              <p className="leading-relaxed">{errorMsg}</p>
            </div>
          )}

          {successMsg && (
            <div className="bg-emerald-150 border-2 border-slate-900 text-slate-900 text-xs rounded-2xl p-4 flex items-start gap-2.5 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] font-bold">
              <Check className="w-4 h-4 text-emerald-800 shrink-0 mt-0.5" />
              <p className="leading-relaxed">{successMsg}</p>
            </div>
          )}

          {loading ? (
            <div className="flex flex-col items-center justify-center py-12 gap-3 text-slate-500">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
              <p className="text-xs font-bold">Fetching profile security...</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* PROFILE SETTINGS FORM */}
              <form onSubmit={handleSaveSettings} className="space-y-5">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-mono flex items-center gap-1">
                  <UserCheck className="w-4 h-4 text-slate-500" />
                  Roommate Profile Details
                </h4>

                {/* Nickname Input */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono">
                    Custom Display Name (Nickname)
                  </label>
                  <input
                    id="input-settings-nickname"
                    type="text"
                    placeholder="E.g. Captain Ozric"
                    value={nickname}
                    onChange={(e) => setNickname(e.target.value)}
                    required
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-900 focus:bg-white focus:outline-none text-xs text-slate-900 font-bold"
                  />
                </div>

                {/* Avatar Selection */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono flex items-center gap-1">
                    <Smile className="w-3.5 h-3.5" /> Roommate Avatar Emoji
                  </label>
                  <div className="flex flex-wrap gap-2 p-3 bg-slate-50 border-2 border-slate-900 rounded-2xl">
                    {['🐼', '🦊', '🦁', '🐨', '🐱', '🐶', '🐯', '🐰', '🐸', '🐙', '🥑', '🍕', '🎮', '💡', '🚀', '🏡'].map((emoji) => (
                      <button
                        key={emoji}
                        type="button"
                        onClick={() => setAvatar(emoji)}
                        className={`w-9 h-9 text-base flex items-center justify-center rounded-xl border-2 transition-all cursor-pointer ${
                          avatar === emoji 
                            ? 'bg-indigo-100 border-indigo-600 scale-110 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]' 
                            : 'bg-white border-slate-200 hover:border-slate-400'
                        }`}
                      >
                        {emoji}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Accent Color Selection */}
                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono flex items-center gap-1">
                    <Palette className="w-3.5 h-3.5" /> Roommate Accent Theme
                  </label>
                  <div className="flex flex-wrap gap-3 p-3 bg-slate-50 border-2 border-slate-900 rounded-2xl">
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
                        className={`px-3 py-1.5 rounded-xl border-2 text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 cursor-pointer transition-all ${
                          accentColor === col.name
                            ? 'bg-white border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]'
                            : 'bg-white/50 border-slate-200 text-slate-500 hover:border-slate-300'
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
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono flex items-center gap-1">
                      <PiggyBank className="w-3.5 h-3.5" /> Spend Goal (€/mo)
                    </label>
                    <input
                      type="number"
                      placeholder="E.g. 500"
                      value={monthlyBudget}
                      onChange={(e) => setMonthlyBudget(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border-2 border-slate-900 focus:bg-white focus:outline-none text-xs text-slate-900 font-bold"
                    />
                  </div>

                  {/* Contact Phone Number */}
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono flex items-center gap-1">
                      <PhoneCall className="w-3.5 h-3.5" /> Contact Number
                    </label>
                    <input
                      type="text"
                      placeholder="+353 87 123..."
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-xl bg-slate-50 border-2 border-slate-900 focus:bg-white focus:outline-none text-xs text-slate-900 font-bold"
                    />
                  </div>
                </div>

                {/* Preferred Payment Method */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono flex items-center gap-1">
                    <Landmark className="w-3.5 h-3.5" /> Preferred Reimbursement
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
                            : 'text-slate-500 hover:text-slate-800'
                        }`}
                      >
                        {pm}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Quick Log Coin Category */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono flex items-center gap-1">
                    <Zap className="w-3.5 h-3.5" /> Quick-Log Coin Category
                  </label>
                  <select
                    value={quickCoinCategory}
                    onChange={(e) => setQuickCoinCategory(e.target.value as Category)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-900 focus:bg-white focus:outline-none text-xs text-slate-900 font-bold appearance-none cursor-pointer"
                    style={{ backgroundImage: 'url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns=\'http://www.w3.org/2000/svg\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'black\' stroke-width=\'3\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3e%3cpolyline points=\'6 9 12 15 18 9\'%3e%3c/polyline%3e%3c/svg%3e")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 1rem center', backgroundSize: '1em' }}
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
                  className="w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 bg-slate-900 text-white border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:bg-slate-800 active:translate-x-[1px] active:translate-y-[1px] flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  {isSaving ? 'Saving details...' : 'Save Profile Details'}
                </button>
              </form>

              <hr className="border-t-2 border-slate-100" />

              {/* CHANGE PASSWORD FORM */}
              <form onSubmit={handleChangePassword} className="space-y-4">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-400 font-mono flex items-center gap-1">
                  <Key className="w-4 h-4 text-slate-500" />
                  Security & Password
                </h4>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono">
                    Current Password
                  </label>
                  <input
                    id="input-old-password"
                    type="password"
                    placeholder="••••"
                    value={oldPassword}
                    onChange={(e) => setOldPassword(e.target.value)}
                    className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-900 focus:bg-white focus:outline-none text-xs text-slate-900 font-bold"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono">
                      New Password
                    </label>
                    <input
                      id="input-new-password"
                      type="password"
                      placeholder="••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-900 focus:bg-white focus:outline-none text-xs text-slate-900 font-bold"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono">
                      Confirm Password
                    </label>
                    <input
                      id="input-confirm-password"
                      type="password"
                      placeholder="••••"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl bg-slate-50 border-2 border-slate-900 focus:bg-white focus:outline-none text-xs text-slate-900 font-bold"
                    />
                  </div>
                </div>

                <button
                  id="btn-change-password-submit"
                  type="submit"
                  disabled={isSaving}
                  className="w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 bg-indigo-650 text-white border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:bg-indigo-750 active:translate-x-[1px] active:translate-y-[1px] flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  Update Profile Password
                </button>
              </form>

              <hr className="border-t-2 border-slate-100" />

              {/* DETAILED FINANCIAL REPORT */}
              <div className="space-y-2.5 bg-emerald-50/40 border-2 border-emerald-900 p-4 rounded-2xl shadow-[2px_2px_0px_0px_rgba(16,185,129,1)]">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-800 font-mono flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                  Detailed Financial Report
                </h4>
                <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
                  Generate, customize, filter, and download a comprehensive PDF statement report of all roommate shared expenses, coins, and ledger history.
                </p>
                <button
                  id="btn-settings-financial-report"
                  type="button"
                  onClick={() => {
                    onClose(); // close settings modal first
                    onOpenDetailedReport();
                  }}
                  className="w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 bg-emerald-600 text-white border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:bg-emerald-700 active:translate-x-[1px] active:translate-y-[1px] flex items-center justify-center gap-2 cursor-pointer font-sans"
                >
                  Generate Statement Report
                </button>
              </div>

              <hr className="border-t-2 border-slate-100" />

              {/* PRIVATE FINANCIAL VAULT */}
              <div className="space-y-2.5 bg-purple-50/40 border-2 border-purple-900 p-4 rounded-2xl shadow-[2px_2px_0px_0px_rgba(147,51,234,1)]">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-purple-800 font-mono flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-purple-600 animate-pulse" />
                  Private Financial Vault
                </h4>
                <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
                  Access your encrypted, secure vault to track non-shared bank balances, cash, remittance transfers 🇳🇵, and personal savings goals.
                </p>
                <button
                  id="btn-settings-private-vault"
                  type="button"
                  onClick={() => {
                    onClose(); // close settings modal first
                    onOpenPrivateVault();
                  }}
                  className="w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 bg-purple-600 text-white border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] hover:bg-purple-700 active:translate-x-[1px] active:translate-y-[1px] flex items-center justify-center gap-2 cursor-pointer font-sans"
                >
                  Enter Private Vault
                </button>
              </div>

              <hr className="border-t-2 border-slate-100" />

              {/* FCM & WEB PUSH NOTIFICATIONS */}
              <div className="space-y-3 bg-indigo-50 border-2 border-slate-900 p-4 rounded-2xl shadow-[2px_2px_0px_0px_rgba(79,70,229,1)]">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-indigo-900 font-mono flex items-center gap-1.5">
                    <Bell className="w-4 h-4 text-indigo-600" />
                    FCM Push Notifications
                  </h4>
                  {notifPermission === 'granted' ? (
                    <span className="bg-emerald-500 text-white text-[8px] font-black px-1.5 py-0.5 rounded border border-slate-900 uppercase font-mono shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]">
                      Active (FCM)
                    </span>
                  ) : (
                    <span className="bg-amber-400 text-slate-900 text-[8px] font-black px-1.5 py-0.5 rounded border border-slate-900 uppercase font-mono shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]">
                      Pending Setup
                    </span>
                  )}
                </div>

                <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
                  Connect device with Firebase Cloud Messaging (FCM). When your roommate logs a transaction or requests deletion, you will instantly receive standard operating system push notifications on your phone or desktop.
                </p>

                {!notifSupported ? (
                  <div className="p-2 bg-rose-50 border border-rose-300 rounded-xl text-[9px] text-rose-700 font-bold">
                    ⚠️ Browser does not support Web Push / Notification APIs.
                  </div>
                ) : notifPermission === 'default' ? (
                  <button
                    id="btn-settings-request-fcm"
                    type="button"
                    onClick={async () => {
                      const permission = await requestNotificationPermission();
                      setNotifPermission(permission);
                      if (permission === 'granted') {
                        showNotification('🏠 Roommate Wallet', {
                          body: 'FCM Push Notifications activated successfully!',
                          tag: 'fcm-activated'
                        });
                      }
                    }}
                    className="w-full py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 bg-indigo-600 hover:bg-indigo-700 text-white border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] flex items-center justify-center gap-1.5 cursor-pointer font-sans"
                  >
                    Enable FCM Push Notifications
                  </button>
                ) : notifPermission === 'denied' ? (
                  <div className="p-2.5 bg-rose-50 border border-rose-300 rounded-xl text-[9px] text-rose-700 font-bold leading-normal">
                    ❌ Permission Denied. Please clear permission blocks in your browser's address bar settings to allow notifications from this web application.
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="p-2.5 bg-emerald-50 border border-emerald-300 rounded-xl text-[9px] text-emerald-800 font-bold flex items-center gap-1.5">
                      <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>FCM service worker is active & listening.</span>
                    </div>
                    <button
                      id="btn-settings-test-fcm"
                      type="button"
                      onClick={() => {
                        const otherRoommate = currentUser === 'Ozric' ? 'Pawan' : 'Ozric';
                        showNotification('🏠 Roommate Wallet', {
                          body: `New Grocery Expense: ${otherRoommate} added €22.50. Tap to approve.`,
                          tag: 'test-expense'
                        });
                      }}
                      className="w-full py-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 bg-white hover:bg-slate-50 text-slate-800 border-2 border-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] active:translate-x-[0.5px] active:translate-y-[0.5px] flex items-center justify-center gap-1 cursor-pointer font-sans"
                    >
                      🧪 Trigger Test FCM Notification
                    </button>
                  </div>
                )}
              </div>

              <hr className="border-t-2 border-slate-100" />

              {/* BIOMETRIC LOCK SECTION */}
              <div className="space-y-3 bg-[#fcfcff] border-2 border-slate-900 p-4 rounded-2xl shadow-[2px_2px_0px_0px_rgba(91,79,207,1)]">
                <div className="flex items-center justify-between">
                  <h4 className="text-[10px] font-black uppercase tracking-widest text-[#5B4FCF] font-mono flex items-center gap-1.5">
                    <Fingerprint className="w-4 h-4 text-[#5B4FCF]" />
                    Biometric App-Lock
                  </h4>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input 
                      type="checkbox" 
                      checked={biometricEnabled}
                      onChange={handleBiometricToggle}
                      disabled={biometricSettingUp}
                      className="sr-only peer"
                    />
                    <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-[#5B4FCF] border-2 border-slate-900 animate-pulse-subtle"></div>
                  </label>
                </div>

                <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
                  Lock and unlock the entire application with Face ID, Touch ID, or fingerprint. Once enabled, standard WebAuthn verification is required on app load or when returning to this tab.
                </p>

                {biometricEnabled && (
                  <div className="space-y-2 pt-1">
                    <button
                      id="btn-settings-lock-now"
                      type="button"
                      onClick={() => {
                        onClose(); // close settings modal
                        setUnlocked(false); // instantly lock the app
                        showNotification('Zindagi Locked', {
                          body: 'Application locked successfully via security controls.',
                          tag: 'biometric-lock-now'
                        });
                      }}
                      className="w-full py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all duration-300 bg-[#0A0A0F] hover:bg-slate-800 text-white border-2 border-slate-900 shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] active:translate-x-[0.5px] active:translate-y-[0.5px] flex items-center justify-center gap-1.5 cursor-pointer font-mono"
                    >
                      <Lock className="w-3.5 h-3.5 text-[#5B4FCF]" />
                      Lock App Now
                    </button>
                  </div>
                )}
              </div>

              <hr className="border-t-2 border-slate-100" />

              {/* LOCK PROFILE SESSION */}
              <div className="space-y-2.5">
                <h4 className="text-[10px] font-black uppercase tracking-widest text-rose-500 font-mono">
                  Logout & Session Control
                </h4>
                <p className="text-[10px] text-slate-500 font-semibold leading-relaxed">
                  Logging out will instantly lock your roommate profile on this device. You will need to enter your password to access it again.
                </p>
                <button
                  id="btn-lock-session"
                  type="button"
                  onClick={onLockProfile}
                  className="w-full py-3.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all duration-300 bg-rose-50 text-rose-750 border-2 border-rose-900 shadow-[2px_2px_0px_0px_rgba(225,29,72,1)] hover:bg-rose-100 active:translate-x-[1px] active:translate-y-[1px] flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                  Lock & Exit Profile
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
