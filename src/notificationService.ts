import { Expense, Roommate, RecurringBill } from './types';

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
