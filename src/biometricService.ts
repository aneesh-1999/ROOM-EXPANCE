// Helper utilities for WebAuthn platform credential registration and verification
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return window.btoa(binary);
}

export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = window.atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

export function isBiometricSupported(): boolean {
  return typeof window !== 'undefined' && !!window.PublicKeyCredential;
}

export async function isPlatformAuthenticatorAvailable(): Promise<boolean> {
  if (!isBiometricSupported()) return false;
  try {
    return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch (e) {
    console.warn('[BiometricService] Error checking platform authenticator availability:', e);
    return false;
  }
}

// Generate new WebAuthn credential matching platform and required user verification
export async function registerPlatformCredential(username: string): Promise<string> {
  const isAvailable = await isPlatformAuthenticatorAvailable();
  if (!isAvailable) {
    throw new Error('Platform biometric authentication is not available on this device/browser.');
  }

  const challenge = new Uint8Array(32);
  window.crypto.getRandomValues(challenge);

  const userIdBuffer = new TextEncoder().encode(username + '_' + Date.now());

  const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
    challenge: challenge,
    rp: {
      name: 'Roommate Expense Wallet',
      id: window.location.hostname
    },
    user: {
      id: userIdBuffer,
      name: username,
      displayName: username
    },
    pubKeyCredParams: [
      { type: 'public-key', alg: -7 },  // ES256 (standard)
      { type: 'public-key', alg: -257 } // RS256 (fallback)
    ],
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: 'required',
      requireResidentKey: false
    },
    timeout: 60000
  };

  if (!navigator.credentials || !navigator.credentials.create) {
    throw new Error('WebAuthn Credentials API is not supported in this environment.');
  }

  const credential = await navigator.credentials.create({
    publicKey: publicKeyCredentialCreationOptions
  }) as PublicKeyCredential | null;

  if (!credential) {
    throw new Error('Authenticator did not return a valid platform credential.');
  }

  // Convert rawId to Base64 to safely store in localStorage as requested
  const base64Id = arrayBufferToBase64(credential.rawId);
  return base64Id;
}
