import { Expense, Roommate } from './types';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { app, db } from './firebase';
import { doc, updateDoc, arrayUnion, arrayRemove, getDoc } from 'firebase/firestore';

// Check if browser supports notifications
export function isNotificationSupported(): boolean {
  return typeof window !== 'undefined' && 'Notification' in window;
}

// Get current permission status
export function getNotificationPermission(): NotificationPermission {
  if (!isNotificationSupported()) return 'denied';
  return Notification.permission;
}

// Request permission to send notifications
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!isNotificationSupported()) return 'denied';
  
  try {
    const permission = await Notification.requestPermission();
    return permission;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    return 'default';
  }
}

// Show a local browser notification
export function showNotification(title: string, options: NotificationOptions = {}): Notification | null {
  if (!isNotificationSupported() || Notification.permission !== 'granted') {
    return null;
  }

  const defaultOptions: NotificationOptions = {
    icon: '/icon.svg',
    badge: '/icon.svg',
    silent: false,
    ...options
  };

  try {
    // If Service Worker is registered and active, prefer showing via Service Worker for background persistence
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(title, defaultOptions);
      }).catch(() => {
        // Fallback to standard Notification API
        new Notification(title, defaultOptions);
      });
      return null;
    } else {
      return new Notification(title, defaultOptions);
    }
  } catch (error) {
    // Fallback to standard Notification API in case showNotification fails
    try {
      return new Notification(title, defaultOptions);
    } catch (e) {
      console.warn('Could not display push notification:', e);
      return null;
    }
  }
}

// FCM Token Registration & Sync
export async function registerFCMTokenForUser(username: Roommate) {
  if (!isNotificationSupported()) return;
  if (getNotificationPermission() !== 'granted') return;

  try {
    const messaging = getMessaging(app);
    // Standard public test/dev VAPID key as fallback, allow custom VAPID key override from environment variable if provided
    const vapidKey = (import.meta as any).env.VITE_FCM_VAPID_KEY || 'BIdy-63WvF3T_J-BqF0_gVwZpxL6Z3t8_K-rEorC806X3XWw0LhT5-S09Z3v2-N_M7_0_N8';
    
    // Register the service worker manually if it isn't ready
    let registration: ServiceWorkerRegistration;
    if ('serviceWorker' in navigator) {
      registration = await navigator.serviceWorker.ready;
    } else {
      console.warn('[FCM] Service Worker not supported');
      return;
    }

    const token = await getToken(messaging, { 
      vapidKey,
      serviceWorkerRegistration: registration
    });

    if (token) {
      console.log(`[FCM] Retained valid FCM registration token for ${username}:`, token);
      
      const oldToken = localStorage.getItem(`fcm_token_${username}`);
      const profileRef = doc(db, 'profiles', username);

      // Read current profile to verify token array existence
      const docSnap = await getDoc(profileRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        const currentTokens: string[] = data.fcmTokens || [];

        // If the token changed, remove the old token and register the new one
        if (oldToken && oldToken !== token) {
          console.log(`[FCM] Token changed. De-registering old token for ${username}...`);
          await updateDoc(profileRef, {
            fcmTokens: arrayRemove(oldToken)
          });
        }

        // Add the new token to Firestore under roommate profile if it doesn't already exist
        if (!currentTokens.includes(token)) {
          console.log(`[FCM] Registering new token to Firestore profile for ${username}...`);
          await updateDoc(profileRef, {
            fcmTokens: arrayUnion(token)
          });
        }
      }

      // Save token in localStorage to keep track of state across reboots/tab closing
      localStorage.setItem(`fcm_token_${username}`, token);
    } else {
      console.warn('[FCM] No registration token returned.');
    }
  } catch (error) {
    console.error('[FCM] Error registering FCM token:', error);
  }
}

// Remove token on manual sign out
export async function removeFCMTokenForUser(username: Roommate) {
  try {
    const token = localStorage.getItem(`fcm_token_${username}`);
    if (token) {
      const profileRef = doc(db, 'profiles', username);
      await updateDoc(profileRef, {
        fcmTokens: arrayRemove(token)
      });
      localStorage.removeItem(`fcm_token_${username}`);
      console.log(`[FCM] De-registered FCM token from Firestore profile for ${username}`);
    }
  } catch (error) {
    console.error('[FCM] Error removing FCM token on logout:', error);
  }
}

// Listen for foreground FCM messages
export function initForegroundFCMListener() {
  if (!isNotificationSupported()) return;
  try {
    const messaging = getMessaging(app);
    onMessage(messaging, (payload) => {
      console.log('[FCM] Foreground message received:', payload);
      const title = payload.notification?.title || payload.data?.title || '🏠 Roommate Wallet';
      const body = payload.notification?.body || payload.data?.body || 'New ledger update';
      
      showNotification(title, {
        body,
        tag: payload.data?.tag || (payload.notification as any)?.tag || 'fcm-foreground-notification',
        data: payload.data
      });
    });
  } catch (error) {
    console.warn('[FCM] Foreground listener init failed:', error);
  }
}

// Map database categories to simplified notification labels
function mapCategoryLabel(category: string): string {
  if (category === 'Shared Groceries') return 'Grocery';
  if (category === 'Electricity (Coins)') return 'Electricity';
  if (category === 'Household Supplies') return 'Household';
  if (category === 'Takeout/Delivery') return 'Takeout';
  return category;
}

// Process newly incoming expenses and trigger notifications
let lastSeenExpenseIds = new Set<string>();
let isFirstLoad = true;

export function processNewExpenses(
  expenses: Expense[],
  currentUser: Roommate,
  nicknames: Record<Roommate, string>
) {
  if (expenses.length === 0) return;

  const currentIds = new Set(expenses.map(e => e.id).filter((id): id is string => !!id));

  if (isFirstLoad) {
    // Initialize our seen list with existing items on load so we don't notify ancient items
    lastSeenExpenseIds = currentIds;
    isFirstLoad = false;
    return;
  }

  // Find any items that were added to Firestore and are not in our seen set
  for (const exp of expenses) {
    if (!exp.id || lastSeenExpenseIds.has(exp.id)) continue;

    // It's a new expense! Let's check if it was created by someone else
    const creator = exp.createdBy || exp.paidBy;
    if (creator && creator !== currentUser) {
      const creatorNick = nicknames[creator] || creator;
      const categoryLabel = mapCategoryLabel(exp.category);
      const isDeletion = exp.deleteRequested;

      let title = '🏠 Roommate Wallet';
      let body = '';

      if (isDeletion) {
        title = '🗑️ Transaction Deletion Requested';
        body = `${creatorNick} requested to delete "${exp.title}" (€${exp.amount.toFixed(2)}). Tap to approve.`;
      } else if (exp.isCoin) {
        title = '🔌 Electricity Coin Logged';
        body = `${creatorNick} inserted and logged an Electricity Coin (€${exp.amount.toFixed(0)}).`;
      } else if (exp.isSettlement) {
        title = '🤝 Debt Settle-Up Registered';
        body = `${creatorNick} sent a debt settlement of €${exp.amount.toFixed(2)}.`;
      } else if (exp.isLendBorrow) {
        title = '💸 Roommate Loan Logged';
        body = `${creatorNick} recorded a loan of €${exp.amount.toFixed(2)}.`;
      } else {
        title = '💰 New Shared Expense Entered';
        body = `${creatorNick} added ${categoryLabel} €${exp.amount.toFixed(0)} ("${exp.title}"). Tap to approve.`;
      }

      showNotification(title, {
        body,
        tag: exp.id,
        renotify: true
      } as any);
    }
  }

  // Update seen set
  lastSeenExpenseIds = currentIds;
}

// Show standard rent reminder notification
export function triggerRentNotification() {
  showNotification('🏠 Roommate Wallet', {
    body: 'Rent of €350 is due tomorrow! Keep your private vault funded to auto-deduct recurring bills.',
    tag: 'rent-due-tomorrow'
  });
}
