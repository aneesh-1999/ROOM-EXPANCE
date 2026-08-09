import { Expense, Roommate } from './types';
import { db } from './firebase';
import { doc, updateDoc, setDoc, arrayUnion, arrayRemove, getDoc, serverTimestamp } from 'firebase/firestore';

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

// Helper to convert base64 url-safe VAPID key to Uint8Array
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

// Subscribe user to standard Web Push API notifications
export async function registerWebPushSubscription(username: Roommate) {
  if (!isNotificationSupported()) return;
  
  // Request permission if not already granted
  let permission = getNotificationPermission();
  if (permission === 'default') {
    permission = await requestNotificationPermission();
  }
  if (permission !== 'granted') {
    console.warn('[Push API] Permission not granted:', permission);
    return;
  }

  try {
    // 1. Get Service Worker registration
    if (!('serviceWorker' in navigator)) {
      console.warn('[Push API] Service Worker not supported');
      return;
    }
    const registration = await navigator.serviceWorker.ready;

    // 2. Fetch VAPID Public Key from the backend
    const response = await fetch('/api/vapid-public-key');
    if (!response.ok) {
      throw new Error('Failed to fetch VAPID public key from backend server.');
    }
    const { publicKey } = await response.json();

    // 3. Clean up existing subscription first to prevent duplicate/stale browser endpoints
    const existingSub = await registration.pushManager.getSubscription();
    if (existingSub) {
      console.log('[Push API] Existing subscription found. Renewing to guarantee clean background push state...');
      try {
        await existingSub.unsubscribe();
      } catch (unsubErr) {
        console.warn('[Push API] Error unsubscribing existing push registration:', unsubErr);
      }
    }

    // 4. Subscribe the user via PushManager
    const subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey)
    });

    console.log(`[Push API] Active subscription obtained for ${username}:`, subscription);

    // 5. Save subscription to Firestore in profiles/{username}
    const subJson = subscription.toJSON();
    if (!subJson.endpoint) {
      throw new Error('Push subscription missing endpoint.');
    }

    const profileRef = doc(db, 'profiles', username);
    const docSnap = await getDoc(profileRef);

    if (docSnap.exists()) {
      const data = docSnap.data();
      const currentSubs: any[] = data.pushSubscriptions || [];

      // Check if this endpoint is already registered
      const exists = currentSubs.some((sub: any) => sub.endpoint === subJson.endpoint);

      if (!exists) {
        console.log(`[Push API] Registering new push subscription to Firestore for ${username}...`);
        await updateDoc(profileRef, {
          pushSubscriptions: arrayUnion(subJson)
        });
      } else {
        console.log(`[Push API] Subscription endpoint already registered in Firestore for ${username}`);
      }
    } else {
      console.log(`[Push API] Profile document missing. Initializing new profile with push subscription for ${username}...`);
      await setDoc(profileRef, {
        pushSubscriptions: [subJson],
        nickname: username,
        avatar: username === 'Ozric' ? '🐼' : '🦊',
        accentColor: username === 'Ozric' ? 'indigo' : 'rose',
        preferredPaymentMethod: 'Revolut',
        quickCoinCategory: 'Electricity (Coins)',
        failedAttemptsCount: 0,
        lockoutType: 'none',
        lockedUntil: null,
        permanentLock: false,
        manualLocked: false,
        recoveryRequest: null,
        updatedAt: serverTimestamp()
      }, { merge: true });
    }
  } catch (error) {
    console.error('[Push API] Error registering push subscription:', error);
  }
}

// Send Web Push notification to a specific user using VAPID
export async function sendPushNotificationToUser(
  username: Roommate,
  payload: { title: string; body: string; tag?: string; data?: any }
) {
  try {
    const profileRef = doc(db, 'profiles', username);
    const docSnap = await getDoc(profileRef);
    if (!docSnap.exists()) return;

    const data = docSnap.data();
    const subscriptions: any[] = data.pushSubscriptions || [];
    if (subscriptions.length === 0) {
      console.log(`[Push API] No push subscriptions found for ${username}`);
      return;
    }

    console.log(`[Push API] Dispatching push notifications to ${subscriptions.length} devices of ${username}...`);

    for (const sub of subscriptions) {
      try {
        const response = await fetch('/api/send-push', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            subscription: sub,
            payload
          })
        });

        // If subscription is invalid/expired (HTTP 410), clean it up from Firestore
        if (response.status === 410) {
          console.log(`[Push API] Removing expired subscription for ${username}`);
          await updateDoc(profileRef, {
            pushSubscriptions: arrayRemove(sub)
          });
        } else if (!response.ok) {
          const errText = await response.text();
          console.warn(`[Push API] Failed to send push to subscription ${sub.endpoint}: ${errText}`);
        }
      } catch (subErr) {
        console.error(`[Push API] Error posting push notification for ${username}:`, subErr);
      }
    }
  } catch (err) {
    console.error(`[Push API] Error fetching profile for push send to ${username}:`, err);
  }
}

// Send Web Push notification to all OTHER roommates
export async function broadcastPushToOtherRoommates(
  currentUser: Roommate,
  payload: { title: string; body: string; tag?: string; data?: any }
) {
  const roommates: Roommate[] = ['Ozric', 'Pawan'];
  const targets = roommates.filter(name => name !== currentUser);

  for (const target of targets) {
    await sendPushNotificationToUser(target, payload);
  }
}
