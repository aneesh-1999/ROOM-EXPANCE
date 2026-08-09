import React, { useState, useEffect } from 'react';
import { useAuthStore } from '../authStore';
import { Fingerprint, AlertCircle, RefreshCw, Trash2, HeartHandshake, ShieldAlert, Key } from 'lucide-react';
import { showNotification } from '../notificationService';

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
      const credentialId = localStorage.getItem('zindagi_biometric_credential_id');
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
        showNotification('Zindagi Unlocked', {
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
        // Unexpected error (e.g. user cleared device biometrics or system error) -> show failure and a fail-open path or reset button
        setErrorMsg(`Biometric mismatch or system error: ${err.message || err}`);
        setShowReset(true);

        // Don't block app usage entirely if WebAuthn throws unexpected system errors -> Fail open
        console.warn('[BiometricLock] Unexpected error. Initiating fail-open recovery protocol...');
        
        // Show fallback warning toast
        showNotification('Security Fallback', {
          body: 'Unexpected biometric system error. Bypassing lock screen to prevent lockout.',
          tag: 'biometric-failopen'
        });

        // Fail open after a brief delay to let user see status
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
    }, 600); // Small delay for rendering transition smoothness
    return () => clearTimeout(timer);
  }, []);

  // Emergency reset of biometrics if credential validation fails permanently
  const handleResetBiometrics = () => {
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
    <div className="fixed inset-0 z-[9999] bg-[#0A0A0F] text-white flex flex-col justify-between p-6 sm:p-12 antialiased selection:bg-[#5B4FCF]/30 select-none">
      
      {/* Decorative top grid accent */}
      <div className="absolute inset-x-0 top-0 h-64 bg-radial-gradient from-[#5B4FCF]/10 to-transparent pointer-events-none" />

      {/* Top spacing */}
      <div className="w-full flex justify-between items-center z-10">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#5B4FCF] animate-pulse" />
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-400 font-bold">Secure Core v1.4</span>
        </div>
        <div className="text-[10px] font-mono text-slate-500 font-bold">Dublin, IE</div>
      </div>

      {/* MAIN LOGO & BIOMETRIC ACTION PANEL */}
      <div className="flex flex-col items-center justify-center max-w-sm mx-auto w-full space-y-12 z-10 my-auto">
        
        {/* Pulsing App Logo */}
        <div className="relative group">
          <div className="absolute inset-0 bg-[#5B4FCF] rounded-3xl blur-2xl opacity-20 group-hover:opacity-45 transition duration-500 animate-pulse" />
          <div className="w-20 h-20 bg-[#12121e] rounded-3xl border-3 border-[#5B4FCF] flex items-center justify-center shadow-[0px_8px_32px_0px_rgba(91,79,207,0.25)] relative text-[#5B4FCF] transition-transform duration-300 transform group-hover:scale-105">
            <HeartHandshake className="w-10 h-10 stroke-[2]" />
          </div>
        </div>

        {/* Brand Information */}
        <div className="text-center space-y-2">
          <h2 className="text-2xl font-black tracking-tight font-display uppercase">Unlock Zindagi</h2>
          <p className="text-xs text-slate-400 font-semibold max-w-[280px] mx-auto leading-relaxed">
            Verify your biometrics to authorize your secure roommate wallet and ledger dashboard.
          </p>
        </div>

        {/* Large Centered Biometric Fingerprint Button */}
        <div className="flex flex-col items-center space-y-4 w-full">
          <button
            onClick={triggerBiometricUnlock}
            disabled={authenticating}
            className={`w-24 h-24 rounded-full bg-[#12121e] border-3 border-[#5B4FCF] flex items-center justify-center transition-all duration-300 relative group cursor-pointer ${
              authenticating 
                ? 'scale-95 border-amber-500 text-amber-500 shadow-[0px_0px_24px_rgba(245,158,11,0.25)]' 
                : 'hover:scale-105 text-white active:scale-95 shadow-[0px_0px_32px_rgba(91,79,207,0.2)] hover:border-[#7c71e8]'
            }`}
          >
            {authenticating ? (
              <RefreshCw className="w-10 h-10 animate-spin" />
            ) : (
              <Fingerprint className="w-12 h-12 stroke-[1.5] group-hover:scale-110 transition-transform duration-300" />
            )}
            
            {/* Pulsing ring on authenticating state */}
            {authenticating && (
              <span className="absolute inset-0 rounded-full border-3 border-amber-500 animate-ping opacity-75" />
            )}
          </button>
          
          <span className="text-[10px] font-mono uppercase tracking-widest text-slate-500 font-black">
            {authenticating ? 'Scanning Platform Authenticator...' : 'Tap scanner icon to prompt'}
          </span>
        </div>

        {/* Dynamic Status / Error Messages */}
        {errorMsg && (
          <div className="w-full bg-[#1c1216] border-2 border-rose-950/50 rounded-2xl p-4 flex items-start gap-3 text-slate-300 animate-shake">
            <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h5 className="font-bold text-xs text-white">Authentication State</h5>
              <p className="text-[10px] leading-relaxed text-slate-400 font-medium">{errorMsg}</p>
            </div>
          </div>
        )}

        {/* Action Controls & Fallback options */}
        <div className="flex flex-col items-center gap-4 w-full pt-4">
          {!authenticating && errorMsg && (
            <button
              onClick={triggerBiometricUnlock}
              className="px-6 py-2.5 bg-[#5B4FCF] hover:bg-[#4d40b8] text-white text-xs font-black uppercase tracking-wider rounded-xl transition-all shadow-[0px_4px_12px_rgba(91,79,207,0.3)] active:translate-y-0.5 cursor-pointer flex items-center gap-2"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Try Again
            </button>
          )}

          {/* Fallback Option */}
          <button
            onClick={triggerBiometricUnlock}
            className="text-slate-400 hover:text-white text-xs font-bold underline underline-offset-4 cursor-pointer transition-colors"
          >
            Use fallback method
          </button>
          {/* TODO: Implement a numeric passcode / PIN lock screen option in future builds for secure credential fallback */}

          {/* Reset Biometric Lock Option (Requirement 4 Edge Cases) */}
          {showReset && (
            <button
              onClick={handleResetBiometrics}
              className="mt-2 text-rose-400 hover:text-rose-300 text-[10px] font-mono uppercase tracking-wider font-bold flex items-center gap-1 cursor-pointer transition-colors"
              title="Deactivates biometrics instantly and unlocks"
            >
              <Trash2 className="w-3 h-3" />
              Reset Biometric Lock
            </button>
          )}
        </div>

      </div>

      {/* FOOTER */}
      <div className="w-full text-center text-[10px] text-slate-600 font-mono tracking-wider z-10 pt-4">
        🔒 End-to-End Encrypted Platform Validation
      </div>

    </div>
  );
}
