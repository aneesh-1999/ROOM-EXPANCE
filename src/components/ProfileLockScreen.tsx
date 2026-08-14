import React, { useState, useEffect } from 'react';
import { Roommate, Profile, LoginLog } from '../types';
import { getProfile, updateProfile, addLoginLog, hashPassword } from '../dbService';
import { sendDiscordNotification } from '../discordService';
import { db } from '../firebase';
import { collection, getDocs, query, where, limit } from 'firebase/firestore';
import { ShieldCheck, Lock, Unlock, RefreshCw, Key, AlertCircle, ArrowRight, ShieldAlert, CheckCircle, ArrowLeft } from 'lucide-react';
import Logo from './Logo';

interface ProfileLockScreenProps {
  selectedUser: Roommate;
  onUnlock: () => void;
  onSwitchUser: (user: Roommate) => void;
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

export default function ProfileLockScreen({ 
  selectedUser, 
  onUnlock, 
  onSwitchUser 
}: ProfileLockScreenProps) {
  const otherUser: Roommate = selectedUser === 'Ozric' ? 'Pawan' : 'Ozric';

  const [password, setPassword] = useState('');
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  const [verifying, setVerifying] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // Lock click & recovery states
  const [lockClickCount, setLockClickCount] = useState(0);
  const [showRecovery, setShowRecovery] = useState(false);
  const [q1, setQ1] = useState('');
  const [q2, setQ2] = useState('');
  const [q3, setQ3] = useState('');
  const [newPass, setNewPass] = useState('');
  const [recoveryMessage, setRecoveryMessage] = useState('');
  const [recoveryError, setRecoveryError] = useState('');
  const [timeRemaining, setTimeRemaining] = useState<string>('');

  // Fetch security details from Firestore
  const fetchSecurityProfile = async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await getProfile(selectedUser);
      if (data) {
        setProfile(data);
      }
    } catch (err: any) {
      setErrorMsg('Error contacting security server: ' + err.message);
    } finally {
      if (!silent) setLoading(false);
    }
  };

  useEffect(() => {
    fetchSecurityProfile();
    // Poll profile updates every 7 seconds to reflect remote admin unblocks in real-time
    const interval = setInterval(() => {
      fetchSecurityProfile(true);
    }, 7000);
    return () => clearInterval(interval);
  }, [selectedUser]);

  // Calculate Lock status
  const getLockStatus = (p: Profile) => {
    if (p.permanentLock) {
      return { 
        isLocked: true, 
        type: 'permanent', 
        message: 'Your account has been permanently locked due to multiple failed login attempts. Please contact the system administrator or the application developer to unlock your account.' 
      };
    }
    if (p.manualLocked) {
      return { 
        isLocked: true, 
        type: 'manual', 
        message: 'This profile has been manually locked by the system administrator. Please contact them to authorize your account re-activation.' 
      };
    }
    if (p.lockedUntil) {
      const lockDate = p.lockedUntil.toDate ? p.lockedUntil.toDate() : new Date(p.lockedUntil);
      const now = new Date();
      if (lockDate > now) {
        return { 
          isLocked: true, 
          type: p.lockoutType || 'temporary_10', 
          message: `This account is temporarily locked. Please try again later.`, 
          lockedUntilDate: lockDate 
        };
      }
    }
    return { isLocked: false, type: 'none', message: '' };
  };

  const lockStatus = profile ? getLockStatus(profile) : { isLocked: false, type: 'none', message: '' };

  // Countdown timer for temporary locks
  useEffect(() => {
    if (lockStatus.isLocked && lockStatus.lockedUntilDate) {
      const updateTimer = () => {
        const now = new Date();
        const diffMs = lockStatus.lockedUntilDate!.getTime() - now.getTime();
        if (diffMs <= 0) {
          setTimeRemaining('');
          // Re-fetch to clear lockout state naturally
          fetchSecurityProfile(true);
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

  // Handle hidden click sequence for owner recovery
  const handleLockTitleClick = () => {
    if (selectedUser === 'Ozric' && lockStatus.isLocked) {
      const nextCount = lockClickCount + 1;
      setLockClickCount(nextCount);
      if (nextCount >= 5) {
        setShowRecovery(true);
        setLockClickCount(0);
      }
    }
  };

  // Check historical logins to find if the successful login is from a new location/device
  const checkForSuspiciousLogin = async (geo: GeoInfo, dev: any) => {
    try {
      const logsRef = collection(db, 'login_logs');
      const q = query(
        logsRef, 
        where('userId', '==', selectedUser), 
        where('status', '==', 'Success'),
        limit(50)
      );
      const querySnapshot = await getDocs(q);
      let newDevice = true;
      let newCountry = true;
      let newCity = true;

      querySnapshot.forEach((doc) => {
        const data = doc.data();
        if (data.sessionId !== localStorage.getItem('current_session_id')) {
          if (data.deviceName === dev.deviceName && data.operatingSystem === dev.operatingSystem) {
            newDevice = false;
          }
          if (data.country === geo.country) {
            newCountry = false;
          }
          if (data.city === geo.city) {
            newCity = false;
          }
        }
      });

      // Avoid marking first-ever login as a "suspicious new device/location"
      if (querySnapshot.size <= 1) {
        newDevice = false;
        newCountry = false;
        newCity = false;
      }

      if (newDevice) {
        sendDiscordNotification('userLoginLogout', {
          title: `📱 New Device Detected`,
          description: `A successful login has occurred from an unrecognized device configuration.`,
          category: 'security',
          color: 16753920, // Orange
          fields: [
            { name: 'Roommate Profile', value: selectedUser, inline: true },
            { name: 'Device Configuration', value: dev.deviceName, inline: true },
            { name: 'Operating System', value: dev.operatingSystem, inline: true },
            { name: 'Location Resolved', value: `${geo.city}, ${geo.country}`, inline: true }
          ]
        }, selectedUser);
      }

      if (newCountry || newCity) {
        sendDiscordNotification('userLoginLogout', {
          title: `🌍 Unrecognized Location Access`,
          description: `A successful login has occurred from a new geographical location.`,
          category: 'security',
          color: 16753920, // Orange
          fields: [
            { name: 'Roommate Profile', value: selectedUser, inline: true },
            { name: 'Location Resolved', value: `${geo.city}, ${geo.country}`, inline: true },
            { name: 'IP Address', value: geo.ip, inline: true }
          ]
        }, selectedUser);
      }
    } catch (e) {
      console.error("Suspicious login check error: ", e);
    }
  };

  // Perform geolocation metadata logging to Firestore
  const logLoginAttempt = async (status: 'Success' | 'Failed' | 'Locked', failureReason?: string) => {
    try {
      const geo = await getGeoLocation();
      const dev = getDeviceInfo();
      const sessionId = 'sess_' + Math.random().toString(36).substring(2, 11);
      
      const roommateEmail = selectedUser === 'Ozric' ? 'work.anishdallakoti@gmail.com' : 'pawan@example.com';
      const role = selectedUser === 'Ozric' ? 'Super Admin' : 'Roommate';
      
      const logId = await addLoginLog({
        userId: selectedUser,
        fullName: profile?.nickname || selectedUser,
        email: roommateEmail,
        userRole: role,
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

      if (status === 'Success' && logId) {
        localStorage.setItem('current_session_id', sessionId);
        localStorage.setItem('login_log_doc_id', logId);
        localStorage.setItem(`login_log_doc_id_${selectedUser}`, logId);
        localStorage.setItem('login_time', Date.now().toString());
        localStorage.setItem(`login_time_${selectedUser}`, Date.now().toString());
        
        // Audit historic logins to notify of any new device/location parameters
        await checkForSuspiciousLogin(geo, dev);
      }
    } catch (err) {
      console.error("Error writing security audit logs: ", err);
    }
  };

  // Validate credentials and enforce lockouts
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!profile) return;

    setVerifying(true);
    // Secure verifying delay
    await new Promise((resolve) => setTimeout(resolve, 450));

    // Reload latest security parameters to block clearing cache bypass
    let currentProfile: Profile;
    try {
      currentProfile = await getProfile(selectedUser);
      setProfile(currentProfile);
    } catch (err: any) {
      setErrorMsg('Failed to sync security rules: ' + err.message);
      setVerifying(false);
      return;
    }

    const currentLock = getLockStatus(currentProfile);
    if (currentLock.isLocked) {
      setErrorMsg(currentLock.message);
      setVerifying(false);
      return;
    }

    const inputHash = await hashPassword(password);
    let matched = false;
    let isQuarantinedRecoveryReset = false;

    // Check standard password
    if (inputHash === currentProfile.password) {
      matched = true;
    } 
    // Check if there's an active quarantined recovery request
    else if (currentProfile.recoveryRequest && currentProfile.recoveryRequest.answersCorrect) {
      const activeAtDate = new Date(currentProfile.recoveryRequest.activeAt);
      const now = new Date();
      if (now >= activeAtDate && inputHash === currentProfile.recoveryRequest.targetPassword) {
        matched = true;
        isQuarantinedRecoveryReset = true;
      }
    }

    if (matched) {
      // Success: Reset failed metrics
      const updates: Partial<Profile> = {
        failedAttemptsCount: 0,
        lockoutType: 'none',
        lockedUntil: null,
        permanentLock: false
      };

      if (isQuarantinedRecoveryReset && currentProfile.recoveryRequest) {
        updates.password = currentProfile.recoveryRequest.targetPassword;
        updates.recoveryRequest = null;
      }

      await updateProfile(selectedUser, updates, selectedUser);
      await logLoginAttempt('Success');

      // Send success notification (suppress if Ozric is acting inside Admin, but here we are on the lock screen so we always notify!)
      sendDiscordNotification('userLoginLogout', {
        title: `🔓 Profile Unlocked Successfully`,
        description: `${selectedUser} has successfully logged into their cohabitation portal.`,
        category: 'security',
        color: 3066993, // Green
        fields: [
          { name: 'Roommate Profile', value: selectedUser, inline: true },
          { name: 'Access Mechanism', value: isQuarantinedRecoveryReset ? '🔑 Recovery Password Reset' : '🏷️ Standard Passcode', inline: true }
        ]
      }, selectedUser);

      onUnlock();
    } else {
      // Incorrect Passcode: Enforce progressive lockout thresholds
      const currentAttempts = (currentProfile.failedAttemptsCount || 0) + 1;
      const updates: Partial<Profile> = {
        failedAttemptsCount: currentAttempts
      };

      let lockoutMsg = 'Invalid password.';
      let discordTitle = '';
      let discordDesc = '';
      let isLockedNow = false;

      if (currentAttempts === 3) {
        const unlockTime = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes
        updates.lockoutType = 'temporary_10';
        updates.lockedUntil = unlockTime.toISOString();
        lockoutMsg = 'Account locked for 10 minutes due to multiple failed attempts.';
        discordTitle = `⚠️ Temporary Profile Lockout (10 Minutes)`;
        discordDesc = `Too many failed password entries have temporarily suspended ${selectedUser}'s profile for 10 minutes.`;
        isLockedNow = true;
      } else if (currentAttempts === 4) {
        const unlockTime = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes
        updates.lockoutType = 'temporary_30';
        updates.lockedUntil = unlockTime.toISOString();
        lockoutMsg = 'Account locked for 30 minutes due to multiple failed attempts.';
        discordTitle = `⚠️ Temporary Profile Lockout (30 Minutes)`;
        discordDesc = `A continued password mismatch has escalated ${selectedUser}'s profile lock to 30 minutes.`;
        isLockedNow = true;
      } else if (currentAttempts >= 5) {
        updates.lockoutType = 'permanent';
        updates.permanentLock = true;
        lockoutMsg = 'Your account has been permanently locked due to multiple failed login attempts. Please contact the system administrator or the application developer to unlock your account.';
        discordTitle = `🚨 PERMANENT ACCOUNT LOCKOUT`;
        discordDesc = `${selectedUser}'s roommate profile is now permanently locked out. Administrative clearance is required to unlock this account.`;
        isLockedNow = true;
      }

      await updateProfile(selectedUser, updates, selectedUser);
      
      // Log login failure
      await logLoginAttempt(isLockedNow ? 'Locked' : 'Failed', `Mismatched passcode (Attempt #${currentAttempts})`);

      // Send Discord Alert
      if (isLockedNow) {
        sendDiscordNotification('failedLogins', {
          title: discordTitle,
          description: discordDesc,
          category: 'security',
          color: 15158332, // Red
          fields: [
            { name: 'Roommate Profile', value: selectedUser, inline: true },
            { name: 'Security State', value: '🛑 Suspended/Locked', inline: true },
            { name: 'Attempts Logged', value: `${currentAttempts} attempts`, inline: true }
          ]
        }, selectedUser);
      } else {
        sendDiscordNotification('failedLogins', {
          title: `🚨 Failed Login Attempt`,
          description: `An incorrect password attempt #${currentAttempts} was recorded for "${selectedUser}".`,
          category: 'security',
          color: 15570220, // Orange
          fields: [
            { name: 'Attempted Profile', value: selectedUser, inline: true },
            { name: 'Status', value: `❌ Mismatch (Attempts: ${currentAttempts}/3)`, inline: true }
          ]
        }, selectedUser);
      }

      setErrorMsg(lockoutMsg);
      setVerifying(false);
    }
  };

  // Submit security recovery answers
  const handleRecoverySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError('');
    setRecoveryMessage('');

    const answer1 = q1.trim().toLowerCase();
    const answer2 = q2.trim();
    const answer3 = q3.trim().toLowerCase();

    if (answer1 === 'anish' && answer2 === '1234' && answer3 === 'ozric') {
      if (!newPass.trim()) {
        setRecoveryError('Please enter a secure new password.');
        return;
      }

      try {
        const hashedNew = await hashPassword(newPass.trim());
        const sixHoursLater = new Date(Date.now() + 6 * 60 * 60 * 1000); // 6 hours quarantine

        await updateProfile(selectedUser, {
          recoveryRequest: {
            requestedAt: new Date().toISOString(),
            targetPassword: hashedNew,
            answersCorrect: true,
            activeAt: sixHoursLater.toISOString()
          }
        }, selectedUser);

        sendDiscordNotification('accountChanges', {
          title: `🔑 Admin Account Recovery Registered`,
          description: `The Administrator profile ("Ozric") has successfully completed the emergency security verification questions.`,
          category: 'security',
          color: 3447003, // Blue
          fields: [
            { name: 'Profile Recovered', value: 'Ozric (Administrator)', inline: true },
            { name: 'Quarantine Period', value: '🔒 6 Hours (Standard)', inline: true },
            { name: 'Activation Time', value: sixHoursLater.toLocaleTimeString(), inline: true }
          ]
        }, 'Ozric');

        setRecoveryMessage('Recovery request registered successfully! For security purposes, your password reset will become active in exactly 6 hours. The account will remain locked during this quarantine period.');
      } catch (err: any) {
        setRecoveryError('Failed to save recovery request: ' + err.message);
      }
    } else {
      setRecoveryError('Incorrect security answers. Recovery access denied.');
    }
  };

  return (
    <div className="min-h-screen bg-indigo-50/50 flex items-center justify-center p-4 antialiased selection:bg-pink-150">
      <div className="bg-white border-4 border-slate-900 rounded-3xl w-full max-w-md shadow-[10px_10px_0px_0px_rgba(15,23,42,1)] overflow-hidden my-auto flex flex-col p-6 sm:p-8 space-y-6">
        
        {/* RECOVERY VIEW */}
        {showRecovery ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3">
              <button 
                id="btn-back-to-lock"
                onClick={() => {
                  setShowRecovery(false);
                  setRecoveryError('');
                  setRecoveryMessage('');
                }}
                className="p-2 border-2 border-slate-900 rounded-xl hover:bg-slate-150 cursor-pointer active:translate-y-0.5 transition-transform"
              >
                <ArrowLeft className="w-4 h-4 stroke-[2.5px]" />
              </button>
              <div>
                <h2 className="text-lg font-black text-slate-900 font-display uppercase tracking-tight">Security Recovery</h2>
                <p className="text-[10px] font-bold text-pink-600 font-mono">OWNER PORTAL BYPASS</p>
              </div>
            </div>

            {recoveryError && (
              <div className="bg-rose-100 border-2 border-slate-900 text-slate-900 text-xs rounded-xl p-4 flex items-start gap-2.5 font-bold shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <p>{recoveryError}</p>
              </div>
            )}

            {recoveryMessage ? (
              <div className="bg-emerald-100 border-2 border-slate-900 text-slate-900 text-xs rounded-xl p-4 flex items-start gap-2.5 font-bold shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                <CheckCircle className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <p>{recoveryMessage}</p>
              </div>
            ) : (
              <form onSubmit={handleRecoverySubmit} className="space-y-4">
                <div className="bg-amber-50 border-2 border-dashed border-slate-900 rounded-2xl p-4 text-xs text-slate-700 font-medium space-y-1">
                  <span className="font-bold text-slate-900">⚠️ Recovery Quarantine Rule:</span>
                  <p className="leading-relaxed">Answering correctly will schedule a password override. This reset takes 6 hours to propagate. The account remains locked during quarantine.</p>
                </div>

                {/* Question 1 */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono">
                    1. What is the developer's first name?
                  </label>
                  <input
                    id="input-recovery-q1"
                    type="text"
                    required
                    placeholder="First name..."
                    value={q1}
                    onChange={(e) => setQ1(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-slate-900 rounded-xl font-bold text-xs focus:bg-slate-50 focus:outline-none"
                  />
                </div>

                {/* Question 2 */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono">
                    2. What is the default profile passcode?
                  </label>
                  <input
                    id="input-recovery-q2"
                    type="text"
                    required
                    placeholder="4-digit default passcode..."
                    value={q2}
                    onChange={(e) => setQ2(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-slate-900 rounded-xl font-bold text-xs focus:bg-slate-50 focus:outline-none"
                  />
                </div>

                {/* Question 3 */}
                <div className="space-y-1">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono">
                    3. What is the username of the Super Admin?
                  </label>
                  <input
                    id="input-recovery-q3"
                    type="text"
                    required
                    placeholder="Case-insensitive username..."
                    value={q3}
                    onChange={(e) => setQ3(e.target.value)}
                    className="w-full px-4 py-2 border-2 border-slate-900 rounded-xl font-bold text-xs focus:bg-slate-50 focus:outline-none"
                  />
                </div>

                {/* New Password */}
                <div className="space-y-1 pt-2 border-t border-slate-100">
                  <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono">
                    Desired New Password
                  </label>
                  <input
                    id="input-recovery-newpass"
                    type="password"
                    required
                    placeholder="Enter new password..."
                    value={newPass}
                    onChange={(e) => setNewPass(e.target.value)}
                    className="w-full px-4 py-2.5 border-2 border-slate-900 rounded-xl font-black font-mono text-center text-sm focus:bg-slate-50 focus:outline-none text-slate-900"
                  />
                </div>

                <button
                  id="btn-submit-recovery"
                  type="submit"
                  className="w-full py-3 bg-pink-500 text-white font-black text-xs uppercase tracking-wider rounded-xl border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] hover:translate-y-[-1px] hover:shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] active:translate-y-0.5 cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <ShieldCheck className="w-4 h-4" />
                  Authenticate & Reset
                </button>
              </form>
            )}
          </div>
        ) : (
          /* STANDARD LOCK / LOCKED STATES */
          <>
            <div className="flex justify-center mb-2">
              <Logo size="lg" subtext="Security" animated />
            </div>

            <div className="text-center space-y-3 select-none">
              <div className="relative inline-flex">
                <span 
                  onClick={handleLockTitleClick}
                  className={`p-4 rounded-3xl border-3 border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] inline-block transition-transform active:scale-95 cursor-pointer ${
                    lockStatus.isLocked ? 'bg-rose-100 text-rose-600' : 'bg-pink-100 text-pink-600'
                  }`}
                  title={selectedUser === 'Ozric' && lockStatus.isLocked ? "Emergency Recovery System" : undefined}
                >
                  {lockStatus.isLocked ? (
                    <ShieldAlert className="w-8 h-8 stroke-[2.5px] animate-bounce" />
                  ) : (
                    <Lock className="w-8 h-8 stroke-[2.5px]" />
                  )}
                </span>
                <span className="absolute -top-1 -right-1 bg-amber-400 border-2 border-slate-900 p-1.5 rounded-full shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] text-slate-900">
                  <Key className="w-3.5 h-3.5" />
                </span>
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-900 font-display uppercase tracking-tight">
                  {lockStatus.isLocked ? 'Profile Suspended' : 'Profile Locked'}
                </h2>
                <p className="text-xs text-slate-500 font-medium font-sans">
                  {lockStatus.isLocked 
                    ? 'Security constraints have isolated this profile.' 
                    : `Enter password to secure ${selectedUser}'s private dashboard`}
                </p>
              </div>
            </div>

            {errorMsg && (
              <div className="bg-rose-100 border-2 border-slate-900 text-slate-900 text-xs rounded-2xl p-4 flex items-start gap-2.5 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] font-bold">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
                <p className="leading-relaxed">{errorMsg}</p>
              </div>
            )}

            {loading ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3 text-slate-500 select-none">
                <RefreshCw className="w-8 h-8 animate-spin text-indigo-500" />
                <p className="text-xs font-bold font-mono">Loading security credentials...</p>
              </div>
            ) : lockStatus.isLocked ? (
              /* LOCKED ACCOUNT VIEW */
              <div className="space-y-5">
                <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl p-4 text-center space-y-2">
                  <p className="text-xs text-slate-600 font-medium leading-relaxed">
                    {lockStatus.message}
                  </p>
                  
                  {timeRemaining && (
                    <div className="inline-flex flex-col items-center justify-center px-4 py-2 bg-rose-50 border-2 border-rose-900 rounded-xl shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]">
                      <span className="text-[10px] font-black uppercase text-rose-750 font-mono tracking-wider">Cooldown Timer</span>
                      <span className="text-lg font-black font-mono text-rose-900">{timeRemaining}</span>
                    </div>
                  )}

                  {profile?.recoveryRequest && (
                    <div className="mt-3 text-[10px] font-mono font-bold text-amber-700 bg-amber-50 p-2 rounded-lg border border-amber-300">
                      ⚠️ Password recovery pending quarantine.<br/>
                      Reset unlocks at: {new Date(profile.recoveryRequest.activeAt).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              /* NORMAL PASSWORD INPUT FORM */
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500 font-mono">
                      Roommate Password
                    </label>
                  </div>
                  <input
                    id="input-lock-password"
                    type="password"
                    placeholder="Enter password..."
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoFocus
                    className="w-full px-4 py-3.5 rounded-2xl bg-slate-50 border-3 border-slate-900 focus:bg-white focus:outline-none text-center text-lg font-black font-mono text-slate-900 shadow-inner"
                  />
                </div>

                <button
                  id="btn-unlock-profile"
                  type="submit"
                  disabled={verifying}
                  className="w-full py-4 rounded-2xl text-xs font-black uppercase tracking-wider transition-all duration-300 bg-pink-500 text-white border-3 border-slate-900 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] hover:translate-x-[-1px] hover:translate-y-[-1px] hover:shadow-[5px_5px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] disabled:opacity-50 flex items-center justify-center gap-2 cursor-pointer select-none"
                >
                  <Unlock className="w-4 h-4" />
                  {verifying ? 'Verifying security...' : 'Unlock Dashboard'}
                </button>
              </form>
            )}

            {/* PROFILE SWITCHER FOOTER */}
            <div className="border-t-2 border-slate-100 pt-5 space-y-3 select-none">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-mono">
                  Not your profile?
                </span>
                <button
                  id="btn-switch-lock-user"
                  onClick={() => onSwitchUser(otherUser)}
                  className="text-xs font-black text-indigo-600 hover:text-indigo-800 flex items-center gap-1 transition-colors cursor-pointer"
                >
                  Switch to {otherUser}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
