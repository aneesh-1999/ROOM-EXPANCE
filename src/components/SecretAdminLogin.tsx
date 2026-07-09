import React, { useState, useEffect } from 'react';
import { 
  ShieldCheck, KeyRound, Mail, Lock, Eye, EyeOff, AlertTriangle, 
  ArrowLeft, CheckCircle, HelpCircle, ShieldAlert, Copy, RefreshCw, Key
} from 'lucide-react';
import { getProfile, updateProfile, addLoginLog, hashPassword } from '../dbService';
import { sendDiscordNotification } from '../discordService';

interface SecretAdminLoginProps {
  onLoginSuccess: () => void;
  onCancel: () => void;
}

interface GeoInfo {
  ip: string;
  country: string;
  region: string;
  city: string;
  location: string;
}

// Client-side Geolocation resolution with public IP API fallbacks
async function getGeoLocation(): Promise<GeoInfo> {
  try {
    const res = await fetch('https://ipapi.co/json/');
    if (!res.ok) throw new Error();
    const data = await res.json();
    return {
      ip: data.ip || 'Unknown IP',
      country: data.country_name || 'Unknown Country',
      region: data.region || 'Unknown State',
      city: data.city || 'Unknown City',
      location: `${data.latitude || 0}, ${data.longitude || 0}`
    };
  } catch {
    try {
      const res = await fetch('https://ip-api.com/json/');
      const data = await res.json();
      return {
        ip: data.query || 'Unknown IP',
        country: data.country || 'Unknown Country',
        region: data.regionName || 'Unknown State',
        city: data.city || 'Unknown City',
        location: `${data.lat || 0}, ${data.lon || 0}`
      };
    } catch {
      return {
        ip: '127.0.0.1',
        country: 'Germany',
        region: 'Bavaria',
        city: 'Munich',
        location: '48.1351, 11.5820'
      };
    }
  }
}

// Client-side user-agent, screen and locale parser
function getDeviceInfo() {
  const ua = navigator.userAgent;
  let deviceType: 'Desktop' | 'Mobile' | 'Tablet' = 'Desktop';
  if (/tablet|ipad|playbook|silk/i.test(ua)) {
    deviceType = 'Tablet';
  } else if (/mobile|iphone|ipod|android|blackberry|opera mini|iemobile/i.test(ua)) {
    deviceType = 'Mobile';
  }

  let os = 'Unknown OS';
  if (/windows/i.test(ua)) os = 'Windows';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  let browser = 'Unknown Browser';
  let version = '';
  if (/chrome|crios/i.test(ua)) {
    browser = 'Chrome';
    const match = ua.match(/(?:chrome|crios)\/([0-9.]+)/i);
    if (match) version = match[1];
  } else if (/safari/i.test(ua) && !/chrome/i.test(ua)) {
    browser = 'Safari';
    const match = ua.match(/version\/([0-9.]+)/i);
    if (match) version = match[1];
  } else if (/firefox/i.test(ua)) {
    browser = 'Firefox';
    const match = ua.match(/firefox\/([0-9.]+)/i);
    if (match) version = match[1];
  } else if (/edg/i.test(ua)) {
    browser = 'Edge';
    const match = ua.match(/edg\/([0-9.]+)/i);
    if (match) version = match[1];
  }

  return {
    deviceType,
    deviceName: `${os} Device (${browser})`,
    operatingSystem: os,
    browser,
    browserVersion: version,
    screenResolution: `${window.screen.width}x${window.screen.height}`,
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    language: navigator.language || 'en-US'
  };
}

export default function SecretAdminLogin({ onLoginSuccess, onCancel }: SecretAdminLoginProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [adminProfile, setAdminProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Alert states
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  // Recovery code states
  const [showRecoveryForm, setShowRecoveryForm] = useState(false);
  const [recoveryCode, setRecoveryCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [recoveryStep, setRecoveryStep] = useState<'verify_code' | 'reset_password'>('verify_code');
  const [verifiedCode, setVerifiedCode] = useState('');

  // Fetch admin security details on mount
  const fetchAdminProfile = async () => {
    try {
      const data = await getProfile('admin');
      if (data) {
        setAdminProfile(data);
      }
    } catch (err: any) {
      setErrorMsg('Error contacting security server: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdminProfile();
  }, []);

  // Calculate Lock status
  const getLockStatus = (p: any) => {
    if (!p) return { isLocked: false, type: 'none', message: '' };
    if (p.permanentLock) {
      return { 
        isLocked: true, 
        type: 'permanent', 
        message: 'This administrator account has been permanently locked due to multiple failed login attempts. Please enter an offline one-time recovery code to authorize a password reset.' 
      };
    }
    if (p.lockedUntil) {
      const lockDate = p.lockedUntil.toDate ? p.lockedUntil.toDate() : new Date(p.lockedUntil);
      const now = new Date();
      if (lockDate > now) {
        return { 
          isLocked: true, 
          type: p.lockoutType || 'temporary_10', 
          message: `This administrator account is temporarily suspended. Please wait until the countdown finishes or use an offline recovery code.`, 
          lockedUntilDate: lockDate 
        };
      }
    }
    return { isLocked: false, type: 'none', message: '' };
  };

  const lockStatus = adminProfile ? getLockStatus(adminProfile) : { isLocked: false, type: 'none', message: '' };

  // Countdown timer for temporary lockouts
  useEffect(() => {
    if (lockStatus.isLocked && lockStatus.lockedUntilDate) {
      const updateTimer = () => {
        const now = new Date();
        const diffMs = lockStatus.lockedUntilDate!.getTime() - now.getTime();
        if (diffMs <= 0) {
          setTimeRemaining('');
          fetchAdminProfile(); // Reload natural profile
        } else {
          const totalSeconds = Math.floor(diffMs / 1000);
          const minutes = Math.floor(totalSeconds / 60);
          const seconds = totalSeconds % 60;
          setTimeRemaining(`${minutes}:${seconds.toString().padStart(2, '0')}`);
        }
      };
      updateTimer();
      const timerId = setInterval(updateTimer, 1000);
      return () => clearInterval(timerId);
    } else {
      setTimeRemaining('');
    }
  }, [lockStatus.isLocked, lockStatus.lockedUntilDate]);

  // Log login attempt to security center
  const logLoginAttempt = async (status: 'Success' | 'Failed' | 'Locked', failureReason?: string) => {
    try {
      const geo = await getGeoLocation();
      const dev = getDeviceInfo();
      const sessionId = 'sess_' + Math.random().toString(36).substring(2, 11);
      
      await addLoginLog({
        userId: 'admin',
        fullName: 'Super Administrator',
        email: email || adminProfile?.email || 'work.anishdallakoti@gmail.com',
        userRole: 'Super Admin Override',
        status,
        ipAddress: geo.ip,
        country: geo.country,
        state: geo.region,
        city: geo.city,
        location: geo.location,
        deviceName: dev.deviceName,
        deviceType: dev.deviceType,
        operatingSystem: dev.operatingSystem,
        browser: dev.browser,
        browserVersion: dev.browserVersion,
        screenResolution: dev.screenResolution,
        timeZone: dev.timeZone,
        language: dev.language,
        sessionId,
        failureReason: failureReason || ''
      });
    } catch (err) {
      console.error("Error writing administrator security audit logs: ", err);
    }
  };

  // Credentials Submission handler
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsSubmitting(true);

    if (!adminProfile) {
      setErrorMsg('❌ Error: Administrative profile not synchronized.');
      setIsSubmitting(false);
      return;
    }

    // Secure checking latency
    await new Promise((resolve) => setTimeout(resolve, 600));

    // Refresh profile state to prevent race conditions
    let latestProfile;
    try {
      latestProfile = await getProfile('admin');
      setAdminProfile(latestProfile);
    } catch (err: any) {
      setErrorMsg('❌ System Sync Failure: ' + err.message);
      setIsSubmitting(false);
      return;
    }

    const currentLock = getLockStatus(latestProfile);
    if (currentLock.isLocked && currentLock.type === 'permanent') {
      setErrorMsg('🛑 Locked Out: Admin vault is permanently locked. Please input an offline recovery code to authorize a reset.');
      setIsSubmitting(false);
      return;
    }

    if (currentLock.isLocked && currentLock.type !== 'permanent') {
      setErrorMsg(`⏳ Lockout Active: Please wait ${timeRemaining} or input an offline recovery code.`);
      setIsSubmitting(false);
      return;
    }

    const normalizedEmail = email.trim().toLowerCase();
    const adminEmail = latestProfile.email || 'work.anishdallakoti@gmail.com';
    const inputHash = await hashPassword(password);

    if (normalizedEmail === adminEmail.toLowerCase() && inputHash === latestProfile.password) {
      // Success: Clear failed metrics
      await updateProfile('admin', {
        failedAttemptsCount: 0,
        lockoutType: 'none',
        lockedUntil: null,
        permanentLock: false
      });

      await logLoginAttempt('Success');

      // Send Discord Alerts
      sendDiscordNotification('userLoginLogout', {
        title: `👑 Super Admin Access Granted`,
        description: `Secure credentials validated successfully. The Super Admin override dashboard has been accessed.`,
        category: 'security',
        color: 3066993, // Green
        fields: [
          { name: 'Admin Account', value: adminEmail, inline: true },
          { name: 'Authorized By', value: 'System Vault', inline: true }
        ]
      }, 'admin');

      sessionStorage.setItem('isAdminLoggedIn', 'true');
      onLoginSuccess();
    } else {
      // Failed login logic
      const nextCount = (latestProfile.failedAttemptsCount || 0) + 1;
      const updates: any = { failedAttemptsCount: nextCount };
      let lockedState = false;
      let durationStr = '';

      if (nextCount === 3) {
        const lockUntil = new Date(Date.now() + 10 * 60 * 1000); // 10 mins
        updates.lockoutType = 'temporary_10';
        updates.lockedUntil = lockUntil.toISOString();
        lockedState = true;
        durationStr = '10 Minutes';
      } else if (nextCount === 4) {
        const lockUntil = new Date(Date.now() + 30 * 60 * 1000); // 30 mins
        updates.lockoutType = 'temporary_30';
        updates.lockedUntil = lockUntil.toISOString();
        lockedState = true;
        durationStr = '30 Minutes';
      } else if (nextCount >= 5) {
        updates.lockoutType = 'permanent';
        updates.permanentLock = true;
        lockedState = true;
        durationStr = 'PERMANENT';
      }

      await updateProfile('admin', updates);
      await logLoginAttempt(lockedState ? 'Locked' : 'Failed', `Invalid login credentials (Attempt #${nextCount})`);

      // Send Discord Alerts
      sendDiscordNotification('failedLogins', {
        title: lockedState ? `🛑 SUPER ADMIN LOCKOUT REGISTERED (${durationStr})` : `🚨 Failed Super Admin Login Attempt`,
        description: lockedState 
          ? `Super Admin login was suspended due to ${nextCount} consecutive password failures.`
          : `An unauthorized or incorrect password attempt was logged for ${normalizedEmail}.`,
        category: 'security',
        color: lockedState ? 15158332 : 15570220, // Red or Orange
        fields: [
          { name: 'Target Email', value: normalizedEmail, inline: true },
          { name: 'Total Failed Attempts', value: `${nextCount} / 5`, inline: true }
        ]
      }, 'admin');

      // Refresh admin profile state locally
      setAdminProfile({ ...latestProfile, ...updates });

      if (nextCount >= 5) {
        setErrorMsg('🛑 PERMANENT SECURITY SUSPENSION: Five failed attempts logged. Access is locked. Please enter an offline recovery code below to recover.');
      } else if (nextCount >= 3) {
        setErrorMsg(`⏳ SECURITY DELAY: Account suspended for ${durationStr} due to multiple failures.`);
      } else {
        setErrorMsg(`❌ Access Denied: Incorrect administrator password. Attempt ${nextCount}/5 before suspension.`);
      }
      setIsSubmitting(false);
    }
  };

  // Verify Offline Recovery Code
  const handleVerifyRecoveryCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setIsSubmitting(true);

    const formattedCode = recoveryCode.trim().toUpperCase();
    const codes: string[] = adminProfile?.recoveryCodes || [];

    if (!codes.includes(formattedCode)) {
      await new Promise(resolve => setTimeout(resolve, 850)); // Security anti-bruteforce delay
      setErrorMsg('❌ Invalid Security Code: The provided recovery code does not match active offline tokens.');
      setIsSubmitting(false);
      return;
    }

    // Success! Verified one-time code
    setVerifiedCode(formattedCode);
    setRecoveryStep('reset_password');
    setSuccessMsg('🛡️ Identity Verified! Enter a new password for the administrator account.');
    setIsSubmitting(false);
  };

  // Perform actual password reset
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setIsSubmitting(true);

    if (newPassword.length < 4) {
      setErrorMsg('❌ Password must be at least 4 characters long.');
      setIsSubmitting(false);
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('❌ Passwords do not match. Please verify entries.');
      setIsSubmitting(false);
      return;
    }

    try {
      const currentCodes: string[] = adminProfile?.recoveryCodes || [];
      const updatedCodes = currentCodes.filter(c => c !== verifiedCode); // Burn the used one-time code!

      // Update password and reset lockout stats
      await updateProfile('admin', {
        password: newPassword,
        failedAttemptsCount: 0,
        lockoutType: 'none',
        lockedUntil: null,
        permanentLock: false,
        recoveryCodes: updatedCodes
      });

      sendDiscordNotification('passwordSecurityChanges', {
        title: `🔑 Admin Password Recovered`,
        description: `The Super Admin password was successfully reset using an offline one-time recovery code.`,
        category: 'security',
        color: 3066993, // Green
        fields: [
          { name: 'Used Code Token', value: `\`${verifiedCode}\` (Burned & De-authorized)`, inline: true },
          { name: 'Status', value: '🟢 Vault Re-secured', inline: true }
        ]
      }, 'admin');

      setSuccessMsg('🎉 Password reset successfully! You can now authenticate with your new credentials.');
      setRecoveryCode('');
      setNewPassword('');
      setConfirmPassword('');
      setShowRecoveryForm(false);
      setRecoveryStep('verify_code');
      
      // Reload updated profile
      await fetchAdminProfile();
    } catch (err: any) {
      setErrorMsg('❌ Recovery Sync Error: ' + err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4">
        <div className="flex flex-col items-center gap-3 bg-white border-4 border-slate-900 rounded-3xl p-8 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)]">
          <RefreshCw className="w-10 h-10 text-indigo-600 animate-spin stroke-[2.5px]" />
          <p className="text-xs font-mono font-black uppercase text-slate-800">Synchronizing Security Vault...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center items-center p-4 selection:bg-rose-100">
      <div className="w-full max-w-md bg-white border-4 border-slate-900 rounded-3xl p-6 sm:p-8 shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] space-y-6 relative overflow-hidden">
        
        {/* Subtle decorative security grid background */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#e2e8f0_1px,transparent_1px),linear-gradient(to_bottom,#e2e8f0_1px,transparent_1px)] bg-[size:14px_14px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-30 -z-10" />

        {/* TOP ACCENT LINE */}
        <div className="absolute top-0 left-0 right-0 h-2 bg-gradient-to-r from-amber-500 via-rose-500 to-indigo-600 border-b-2 border-slate-900" />

        {/* HEADER */}
        <div className="text-center space-y-2.5 pt-2">
          <div className={`inline-flex p-3 rounded-2xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] mb-1 ${
            lockStatus.isLocked ? 'bg-rose-100 text-rose-700 animate-bounce' : 'bg-rose-100 text-rose-750 animate-pulse'
          }`}>
            {lockStatus.isLocked ? (
              <ShieldAlert className="w-8 h-8 stroke-[2.5px]" />
            ) : (
              <ShieldCheck className="w-8 h-8 stroke-[2.5px]" />
            )}
          </div>
          <h2 className="text-xl font-black uppercase tracking-tight text-slate-900">
            {showRecoveryForm ? 'Admin Recovery Console' : 'Secure Admin Vault'}
          </h2>
          <p className="text-xs font-mono font-bold text-slate-500 tracking-wide uppercase">
            {showRecoveryForm ? 'OFFLINE TOKEN CLEARANCE PROTOCOL' : 'AUTHORIZED PERSONNEL PROTOCOL'}
          </p>
        </div>

        {/* MESSAGES */}
        {errorMsg && (
          <div className="bg-rose-100 border-2 border-slate-900 rounded-2xl p-3 flex items-start gap-2.5 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] text-slate-900 animate-shake">
            <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 mt-0.5" />
            <p className="text-xs font-black leading-tight">{errorMsg}</p>
          </div>
        )}

        {successMsg && (
          <div className="bg-emerald-100 border-2 border-slate-900 rounded-2xl p-3 flex items-start gap-2.5 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] text-emerald-950">
            <CheckCircle className="w-4 h-4 shrink-0 text-emerald-700 mt-0.5" />
            <p className="text-xs font-black leading-tight">{successMsg}</p>
          </div>
        )}

        {/* LOCKOUT DISPLAY IF ACTIVE */}
        {lockStatus.isLocked && !showRecoveryForm && (
          <div className="bg-amber-50 border-2 border-slate-900 rounded-2xl p-4 space-y-3 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-black uppercase text-slate-900 font-mono">Suspended Admin Console</h4>
                <p className="text-[10px] text-slate-700 font-medium leading-relaxed mt-1 font-mono">{lockStatus.message}</p>
              </div>
            </div>

            {timeRemaining && (
              <div className="bg-white border-2 border-slate-900 rounded-xl py-2 px-3 flex justify-between items-center shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]">
                <span className="text-[9px] font-mono font-black text-slate-500 uppercase tracking-wider">Cooldown Clock:</span>
                <span className="text-sm font-mono font-black text-rose-600 animate-pulse">{timeRemaining}</span>
              </div>
            )}

            <button
              id="btn-admin-go-recovery"
              type="button"
              onClick={() => {
                setErrorMsg('');
                setSuccessMsg('');
                setShowRecoveryForm(true);
                setRecoveryStep('verify_code');
              }}
              className="w-full py-2 bg-indigo-100 hover:bg-indigo-200 text-indigo-950 border-2 border-slate-900 rounded-xl font-black uppercase tracking-wider text-[10px] shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all cursor-pointer flex items-center justify-center gap-1.5"
            >
              <Key className="w-3.5 h-3.5" />
              Reset password with offline code
            </button>
          </div>
        )}

        {/* RECOVERY CODE FORM */}
        {showRecoveryForm ? (
          <div>
            {recoveryStep === 'verify_code' ? (
              <form onSubmit={handleVerifyRecoveryCode} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 font-mono flex items-center gap-1.5">
                    <Key className="w-3.5 h-3.5 text-indigo-600" />
                    Enter Offline Recovery Code
                  </label>
                  <input
                    id="recovery-code"
                    type="text"
                    required
                    placeholder="Recovery Code"
                    value={recoveryCode}
                    onChange={(e) => setRecoveryCode(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs font-mono font-bold uppercase border-2 border-slate-900 rounded-xl shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] focus:outline-none focus:ring-0 focus:border-indigo-600 focus:translate-x-[0.5px] focus:translate-y-[0.5px] focus:shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] bg-white transition-all text-slate-950 tracking-widest text-center"
                  />
                </div>

                <div className="pt-3 space-y-2.5">
                  <button
                    id="btn-recovery-verify-submit"
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 bg-amber-400 hover:bg-amber-500 disabled:bg-amber-200 disabled:cursor-not-allowed text-slate-950 border-2 border-slate-900 rounded-xl font-black uppercase tracking-wider text-xs shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1.5px] active:translate-y-[1.5px] active:shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? 'Verifying Code Token...' : 'Authorize Clearance Code'}
                  </button>

                  <button
                    id="btn-recovery-back"
                    type="button"
                    onClick={() => {
                      setErrorMsg('');
                      setSuccessMsg('');
                      setShowRecoveryForm(false);
                    }}
                    className="w-full py-2 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-950 border-2 border-slate-900 rounded-xl font-black uppercase tracking-wider text-[10px] shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back to login console
                  </button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleResetPassword} className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 font-mono flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-indigo-600" />
                    New Secure Passcode
                  </label>
                  <div className="relative">
                    <input
                      id="recovery-new-password"
                      type={showNewPassword ? 'text' : 'password'}
                      required
                      placeholder="••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full pl-3.5 pr-10 py-2.5 text-xs font-medium border-2 border-slate-900 rounded-xl shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] focus:outline-none focus:ring-0 focus:border-indigo-600 bg-white transition-all text-slate-900 font-mono"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-2.5 top-2.5 p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors"
                    >
                      {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 font-mono flex items-center gap-1.5">
                    <CheckCircle className="w-3.5 h-3.5 text-indigo-600" />
                    Confirm Secure Passcode
                  </label>
                  <input
                    id="recovery-confirm-password"
                    type={showNewPassword ? 'text' : 'password'}
                    required
                    placeholder="••••"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full px-3.5 py-2.5 text-xs font-medium border-2 border-slate-900 rounded-xl shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] focus:outline-none focus:ring-0 focus:border-indigo-600 bg-white transition-all text-slate-900 font-mono"
                  />
                </div>

                <div className="pt-3 space-y-2.5">
                  <button
                    id="btn-recovery-reset-submit"
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 disabled:cursor-not-allowed text-white border-2 border-slate-900 rounded-xl font-black uppercase tracking-wider text-xs shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1.5px] active:translate-y-[1.5px] active:shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] transition-all cursor-pointer flex items-center justify-center gap-2"
                  >
                    {isSubmitting ? 'Syncing New Passcode...' : 'Commit & Lock New Passcode'}
                  </button>
                </div>
              </form>
            )}
          </div>
        ) : (
          /* STANDARD LOGIN FORM */
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 font-mono flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-indigo-600" />
                Admin Identifier
              </label>
              <input
                id="admin-email"
                type="email"
                required
                disabled={lockStatus.isLocked}
                placeholder="e.g. admin@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 text-xs font-medium border-2 border-slate-900 rounded-xl shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] focus:outline-none focus:ring-0 focus:border-indigo-600 focus:translate-x-[0.5px] focus:translate-y-[0.5px] focus:shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] bg-white disabled:bg-slate-100 disabled:cursor-not-allowed transition-all text-slate-900 font-mono"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 font-mono flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-indigo-600" />
                Security Passcode
              </label>
              <div className="relative">
                <input
                  id="admin-password"
                  type={showPassword ? 'text' : 'password'}
                  required
                  disabled={lockStatus.isLocked}
                  placeholder="••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-3.5 pr-10 py-2.5 text-xs font-medium border-2 border-slate-900 rounded-xl shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] focus:outline-none focus:ring-0 focus:border-indigo-600 focus:translate-x-[0.5px] focus:translate-y-[0.5px] focus:shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] bg-white disabled:bg-slate-100 disabled:cursor-not-allowed transition-all text-slate-900 font-mono"
                />
                <button
                  type="button"
                  disabled={lockStatus.isLocked}
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-2.5 p-1 rounded hover:bg-slate-100 text-slate-500 hover:text-slate-900 transition-colors disabled:opacity-50"
                  title={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="pt-3 space-y-2.5">
              <button
                id="btn-admin-submit"
                type="submit"
                disabled={isSubmitting || lockStatus.isLocked}
                className="w-full py-3 bg-amber-400 hover:bg-amber-500 disabled:bg-amber-200 disabled:cursor-not-allowed text-slate-950 border-2 border-slate-900 rounded-xl font-black uppercase tracking-wider text-xs shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1.5px] active:translate-y-[1.5px] active:shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)] transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <KeyRound className="w-4 h-4" />
                {isSubmitting ? 'Verifying Clearance...' : 'Authenticate Access'}
              </button>

              <div className="flex gap-2">
                <button
                  id="btn-admin-cancel"
                  type="button"
                  onClick={onCancel}
                  className="flex-1 py-2 bg-white hover:bg-slate-50 text-slate-700 hover:text-slate-950 border-2 border-slate-900 rounded-xl font-black uppercase tracking-wider text-[10px] shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] transition-all cursor-pointer flex items-center justify-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  Cancel & Exit
                </button>

                <button
                  id="btn-admin-forget"
                  type="button"
                  onClick={() => {
                    setErrorMsg('');
                    setSuccessMsg('');
                    setShowRecoveryForm(true);
                    setRecoveryStep('verify_code');
                  }}
                  className="py-2 px-3 bg-slate-100 hover:bg-slate-200 text-slate-800 border-2 border-slate-900 rounded-xl font-black uppercase tracking-wider text-[10px] shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all cursor-pointer flex items-center justify-center gap-1"
                  title="Forgot Admin Password"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-indigo-600" />
                  Forgot?
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
