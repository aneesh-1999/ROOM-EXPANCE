import { create } from 'zustand';

interface AuthState {
  unlocked: boolean;
  biometricEnabled: boolean;
  setUnlocked: (unlocked: boolean) => void;
  setBiometricEnabled: (enabled: boolean) => void;
  lock: () => void;
}

export const useAuthStore = create<AuthState>((set) => {
  const isBiometricEnabled = localStorage.getItem('zindagi_biometric_enabled') === 'true';
  return {
    unlocked: !isBiometricEnabled,
    biometricEnabled: isBiometricEnabled,
    setUnlocked: (unlocked) => set({ unlocked }),
    setBiometricEnabled: (enabled) => set({ biometricEnabled: enabled }),
    lock: () => {
      const isBiometricEnabled = localStorage.getItem('zindagi_biometric_enabled') === 'true';
      if (isBiometricEnabled) {
        set({ unlocked: false });
      }
    },
  };
});

// Track page visibility to lock after >5 minutes of being hidden
let lastHiddenTime = 0;

if (typeof document !== 'undefined') {
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      lastHiddenTime = Date.now();
    } else {
      if (lastHiddenTime > 0) {
        const elapsed = Date.now() - lastHiddenTime;
        const fiveMinutes = 5 * 60 * 1000;
        if (elapsed > fiveMinutes) {
          const isBiometricEnabled = localStorage.getItem('zindagi_biometric_enabled') === 'true';
          if (isBiometricEnabled) {
            useAuthStore.setState({ unlocked: false });
          }
        }
      }
    }
  });
}
