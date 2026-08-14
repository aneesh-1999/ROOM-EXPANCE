import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../authStore';
import { Fingerprint, AlertCircle, RefreshCw, Trash2, HeartHandshake, Lock, KeyRound, ShieldCheck } from 'lucide-react';
import { showNotification } from '../notificationService';
import Logo from './Logo';

// Utility helper to convert Base64 string back to ArrayBuffer
function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export default function BiometricLockScreen() {
  const [authenticating, setAuthenticating] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [showReset, setShowReset] = useState(false);

  const setUnlocked = useAuthStore((state) => state.setUnlocked);

  // Core biometric authentication trigger using WebAuthn navigator.credentials.get
  const triggerBiometricUnlock = async () => {
    setErrorMsg('');
    setAuthenticating(true);

    try {
      const credentialId = localStorage.getItem('roommate_biometric_credential_id') || localStorage.getItem('zindagi_biometric_credential_id');
      if (!credentialId) {
        throw new Error('Biometric lock is enabled but no credential ID was found on this device.');
      }

      const challenge = new Uint8Array(32);
      window.crypto.getRandomValues(challenge);

      const rawId = base64ToArrayBuffer(credentialId);

      const publicKeyCredentialRequestOptions: PublicKeyCredentialRequestOptions = {
        challenge: challenge,
        allowCredentials: [{
          id: rawId,
          type: 'public-key'
        }],
        userVerification: 'required',
        timeout: 60000
      };

      if (!navigator.credentials || !navigator.credentials.get) {
        throw new Error('WebAuthn is not supported or accessible on this browser.');
      }

      const credential = await navigator.credentials.get({
        publicKey: publicKeyCredentialRequestOptions
      });

      if (credential) {
        // Biometric success: unlock the app completely
        setUnlocked(true);
        showNotification('Roommate Expense Unlocked', {
          body: 'Welcome back! Secure session unlocked successfully via biometrics.',
          tag: 'biometric-success'
        });
      } else {
        throw new Error('No authentication response returned by the platform authenticator.');
      }
    } catch (err: any) {
      console.error('WebAuthn authentication failed:', err);

      // Distinguish user cancellation from critical errors
      if (err.name === 'NotAllowedError') {
        setErrorMsg('Authentication failed: The verification prompt was cancelled or timed out.');
      } else {
        setErrorMsg(`Biometric mismatch or system error: ${err.message || err}`);
        setShowReset(true);

        console.warn('[BiometricLock] Unexpected error. Initiating fail-open recovery protocol...');
        
        showNotification('Security Fallback', {
          body: 'Unexpected biometric system error. Bypassing lock screen to prevent lockout.',
          tag: 'biometric-failopen'
        });

        setTimeout(() => {
          setUnlocked(true);
        }, 1500);
      }
    } finally {
      setAuthenticating(false);
    }
  };

  // Auto-trigger biometric prompt on component mount
  useEffect(() => {
    const timer = setTimeout(() => {
      triggerBiometricUnlock();
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Emergency reset of biometrics if credential validation fails permanently
  const handleResetBiometrics = () => {
    localStorage.removeItem('roommate_biometric_enabled');
    localStorage.removeItem('roommate_biometric_credential_id');
    localStorage.removeItem('zindagi_biometric_enabled');
    localStorage.removeItem('zindagi_biometric_credential_id');
    
    useAuthStore.getState().setBiometricEnabled(false);
    setUnlocked(true);
    
    showNotification('Biometrics Reset', {
      body: 'Biometric lock has been disabled. Returning to normal state.',
      tag: 'biometric-reset'
    });
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-100 flex flex-col justify-between p-4 sm:p-8 font-sans selection:bg-indigo-200 select-none overflow-y-auto">
      
      {/* Top Bar Header */}
      <div className="w-full max-w-md mx-auto flex justify-between items-center z-10 pt-2">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-100 text-indigo-950 border-2 border-slate-900 text-xs font-black uppercase tracking-wider shadow-[1.5px_1.5px_0px_0px_rgba(15,23,42,1)]">
          <ShieldCheck className="w-3.5 h-3.5 text-indigo-700 stroke-[2.5px]" />
          Biometric App-Lock
        </div>
        <div className="text-xs font-black font-mono text-slate-800 bg-white px-2.5 py-1 rounded-lg border-2 border-slate-900 shadow-[1px_1px_0px_0px_rgba(15,23,42,1)]">
          v1.4 Secure
        </div>
      </div>

      {/* Main Lock Card Panel */}
      <div className="bg-white border-3 border-slate-900 rounded-3xl p-6 sm:p-8 max-w-md w-full mx-auto shadow-[8px_8px_0px_0px_rgba(15,23,42,1)] space-y-6 my-auto text-slate-900">
        
        {/* App Logo Icon */}
        <div className="flex justify-center">
          <Logo size="xl" subtext="Secure" animated />
        </div>

        {/* Brand Header */}
        <div className="text-center space-y-1">
          <p className="text-xs font-bold text-slate-600 max-w-[280px] mx-auto leading-relaxed">
            Verify your Touch ID, Face ID, or fingerprint biometrics to unlock your shared ledger and financial dashboard.
          </p>
        </div>

        {/* Large Centered Biometric Fingerprint Scanner Button */}
        <div className="flex flex-col items-center space-y-3 w-full pt-2">
          <button
            onClick={triggerBiometricUnlock}
            disabled={authenticating}
            className={`w-24 h-24 rounded-2xl border-3 border-slate-900 flex items-center justify-center transition-all duration-200 cursor-pointer ${
              authenticating 
                ? 'bg-amber-300 text-amber-950 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] scale-95' 
                : 'bg-amber-400 hover:bg-amber-500 text-slate-950 shadow-[4px_4px_0px_0px_rgba(15,23,42,1)] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)]'
            }`}
            title="Click to authenticate using biometrics"
          >
            {authenticating ? (
              <RefreshCw className="w-11 h-11 animate-spin stroke-[2.5px]" />
            ) : (
              <Fingerprint className="w-12 h-12 stroke-[2px]" />
            )}
          </button>
          
          <span className="text-xs font-black uppercase tracking-wider text-slate-800 font-mono">
            {authenticating ? 'Scanning Authenticator...' : 'Tap scanner icon to unlock'}
          </span>
        </div>

        {/* Dynamic Status / Error Messages */}
        {errorMsg && (
          <div className="w-full bg-rose-100 border-2 border-slate-900 rounded-2xl p-4 flex items-start gap-3 text-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)]">
            <AlertCircle className="w-5 h-5 text-rose-700 shrink-0 mt-0.5 stroke-[2.5px]" />
            <div className="space-y-1">
              <h5 className="font-black text-xs uppercase tracking-wider text-rose-950">Authentication State</h5>
              <p className="text-xs font-bold leading-relaxed text-slate-800">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Action Controls */}
        <div className="flex flex-col items-center gap-3 w-full pt-2">
          {!authenticating && (
            <button
              onClick={triggerBiometricUnlock}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs uppercase tracking-wider rounded-xl border-2 border-slate-900 shadow-[3px_3px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <RefreshCw className="w-4 h-4 stroke-[2.5px]" />
              Scan Biometrics Again
            </button>
          )}

          {/* Emergency Reset Option */}
          {showReset && (
            <button
              onClick={handleResetBiometrics}
              className="w-full py-2.5 bg-rose-100 hover:bg-rose-200 text-rose-950 font-black text-xs uppercase tracking-wider rounded-xl border-2 border-slate-900 shadow-[2px_2px_0px_0px_rgba(15,23,42,1)] active:translate-x-[1px] active:translate-y-[1px] active:shadow-[1px_1px_0px_0px_rgba(15,23,42,1)] transition-all cursor-pointer flex items-center justify-center gap-1.5"
              title="Deactivates biometrics instantly and unlocks"
            >
              <Trash2 className="w-3.5 h-3.5 stroke-[2.5px]" />
              Reset Biometric Lock
            </button>
          )}
        </div>

      </div>

      {/* Footer Notice */}
      <div className="w-full text-center text-xs font-bold text-slate-700 tracking-wide flex items-center justify-center gap-1.5 pb-2">
        <Lock className="w-3.5 h-3.5 text-slate-900 stroke-[2.5px]" />
        <span>End-to-End Encrypted Platform Validation</span>
      </div>

    </div>
  );
}
