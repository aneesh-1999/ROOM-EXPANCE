import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy, 
  serverTimestamp,
  updateDoc,
  getDoc,
  setDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { Expense, Roommate, Profile, Category, LoginLog } from './types';
import { sendDiscordNotification } from './discordService';

// Operation Types as requested by Firestore integration skill
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: null,
      email: null,
      emailVerified: null,
      isAnonymous: null,
      tenantId: null,
      providerInfo: []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

const EXPENSES_COLLECTION = 'expenses';

// Subscribe to real-time changes in expenses
export function subscribeExpenses(callback: (expenses: Expense[]) => void, onError?: (error: any) => void) {
  const expensesRef = collection(db, EXPENSES_COLLECTION);
  const q = query(expensesRef, orderBy('timestamp', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const expenses: Expense[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        expenses.push({
          id: doc.id,
          title: data.title,
          amount: data.amount,
          paidBy: data.paidBy,
          splitType: data.splitType,
          category: data.category,
          timestamp: data.timestamp ? (data.timestamp.toDate ? data.timestamp.toDate() : new Date(data.timestamp)) : new Date(),
          splitDetails: data.splitDetails,
          isCoin: data.isCoin || false,
          isSettlement: data.isSettlement || false,
          isLendBorrow: data.isLendBorrow || false,
          paymentMethod: data.paymentMethod || undefined,
          itemizedDetails: data.itemizedDetails,
          notes: data.notes || '',
          status: data.status || 'confirmed',
          createdBy: data.createdBy || undefined,
          deleteRequested: data.deleteRequested || false,
          deleteRequestedBy: data.deleteRequestedBy || undefined
        });
      });
      callback(expenses);
    },
    (error) => {
      console.error("Firestore subscription error: ", error);
      if (onError) {
        onError(error);
      } else {
        handleFirestoreError(error, OperationType.GET, EXPENSES_COLLECTION);
      }
    }
  );
}

// Add a new expense
export async function addExpense(expense: Omit<Expense, 'id' | 'timestamp'>, actor?: Roommate) {
  try {
    const expensesRef = collection(db, EXPENSES_COLLECTION);
    
    // Clean undefined fields to avoid Firestore payload errors
    const cleanedExpense = Object.entries(expense).reduce((acc, [key, value]) => {
      if (value !== undefined) {
        acc[key] = value;
      }
      return acc;
    }, {} as any);

    const docRef = await addDoc(expensesRef, {
      ...cleanedExpense,
      status: expense.status || 'pending',
      timestamp: serverTimestamp()
    });

    // Send Discord push notification
    const triggerActor = actor || cleanedExpense.createdBy || cleanedExpense.paidBy;
    let notifTitle = `💰 New Shared Expense Entered`;
    let notifDesc = `A new shared bill/item has been submitted to the ledger.`;
    let color = 5195493; // indigo #4F46E5

    if (cleanedExpense.isCoin) {
      notifTitle = `🔌 Electricity Coin Logged`;
      notifDesc = `A physical electricity coin has been inserted and logged.`;
      color = 16753920; // orange #FFA500
    } else if (cleanedExpense.isSettlement) {
      notifTitle = `🤝 Balance Settle-Up Registered`;
      notifDesc = `A debt settlement transfer has been recorded.`;
      color = 3066993; // emerald #2ECC71
    } else if (cleanedExpense.isLendBorrow) {
      notifTitle = `💸 Direct Roommate Loan Logged`;
      notifDesc = `A roommate direct lend/borrow transaction has been created.`;
      color = 10181046; // purple #9B59B6
    }

    sendDiscordNotification('newTransaction', {
      title: notifTitle,
      description: notifDesc,
      category: 'transactions',
      color,
      fields: [
        { name: 'Title', value: cleanedExpense.title || 'Untitled', inline: true },
        { name: 'Amount', value: `€${Number(cleanedExpense.amount || 0).toFixed(2)}`, inline: true },
        { name: 'Paid By', value: cleanedExpense.paidBy || 'Unknown', inline: true },
        { name: 'Split Type', value: cleanedExpense.splitType || '50/50', inline: true },
        { name: 'Category', value: cleanedExpense.category || 'Other', inline: true },
        { name: 'Logged By', value: triggerActor || 'System', inline: true },
        { name: 'Status', value: (expense.status || 'pending') === 'confirmed' ? '✅ Confirmed' : '⏳ Pending Confirmation', inline: true }
      ]
    }, triggerActor);

    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, EXPENSES_COLLECTION);
  }
}

// Delete an expense
export async function deleteExpense(id: string, actor?: string) {
  try {
    const docRef = doc(db, EXPENSES_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    let details: any = null;
    if (docSnap.exists()) {
      details = docSnap.data();
    }

    await deleteDoc(docRef);

    if (details) {
      sendDiscordNotification('updateDeleteTransaction', {
        title: `🗑️ Shared Transaction Deleted`,
        description: `A shared transaction has been completely deleted from the cohabitation ledger.`,
        category: 'transactions',
        color: 15158332, // red #E74C3C
        fields: [
          { name: 'Title', value: details.title || 'Untitled', inline: true },
          { name: 'Amount', value: `€${Number(details.amount || 0).toFixed(2)}`, inline: true },
          { name: 'Paid By', value: details.paidBy || 'Unknown', inline: true },
          { name: 'Deleted By', value: actor || 'System', inline: true }
        ]
      }, actor);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `${EXPENSES_COLLECTION}/${id}`);
  }
}

// Request deletion of an expense (must be approved by other roommate)
export async function requestDeleteExpense(id: string, requester: Roommate) {
  try {
    const docRef = doc(db, EXPENSES_COLLECTION, id);
    await updateDoc(docRef, {
      deleteRequested: true,
      deleteRequestedBy: requester
    });

    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const details = docSnap.data();
      sendDiscordNotification('updateDeleteTransaction', {
        title: `⚠️ Transaction Deletion Requested`,
        description: `A delete request has been placed. This action must be confirmed/approved by the other roommate.`,
        category: 'transactions',
        color: 15105570, // orange-red #E67E22
        fields: [
          { name: 'Title', value: details.title || 'Untitled', inline: true },
          { name: 'Amount', value: `€${Number(details.amount || 0).toFixed(2)}`, inline: true },
          { name: 'Paid By', value: details.paidBy || 'Unknown', inline: true },
          { name: 'Requested By', value: requester, inline: true }
        ]
      }, requester);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${EXPENSES_COLLECTION}/${id}`);
  }
}

// Cancel or reject a deletion request
export async function cancelDeleteExpense(id: string, actor?: string) {
  try {
    const docRef = doc(db, EXPENSES_COLLECTION, id);
    await updateDoc(docRef, {
      deleteRequested: false,
      deleteRequestedBy: null
    });

    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const details = docSnap.data();
      sendDiscordNotification('approvalRejectionActions', {
        title: `❌ Deletion Request Rejected`,
        description: `The deletion proposal for a ledger item has been rejected and restored.`,
        category: 'transactions',
        color: 3447003, // blue #3498DB
        fields: [
          { name: 'Title', value: details.title || 'Untitled', inline: true },
          { name: 'Amount', value: `€${Number(details.amount || 0).toFixed(2)}`, inline: true },
          { name: 'Restored By', value: actor || 'System', inline: true }
        ]
      }, actor);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${EXPENSES_COLLECTION}/${id}`);
  }
}

// Confirm/approve a pending transaction
export async function confirmExpense(id: string, actor?: string) {
  try {
    const docRef = doc(db, EXPENSES_COLLECTION, id);
    await updateDoc(docRef, {
      status: 'confirmed'
    });

    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const details = docSnap.data();
      sendDiscordNotification('approvalRejectionActions', {
        title: `✅ Transaction Approved`,
        description: `A pending transaction has been approved and finalized into the cohabitation ledger.`,
        category: 'transactions',
        color: 3066993, // dark green #2ECC71
        fields: [
          { name: 'Title', value: details.title || 'Untitled', inline: true },
          { name: 'Amount', value: `€${Number(details.amount || 0).toFixed(2)}`, inline: true },
          { name: 'Approved By', value: actor || 'System', inline: true }
        ]
      }, actor);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${EXPENSES_COLLECTION}/${id}`);
  }
}

// Log a coin insertion
export async function logCoinInsertion(user: Roommate, value: number, createdBy?: Roommate, category?: Category) {
  return addExpense({
    title: `Electricity Coin €${value}`,
    amount: value,
    paidBy: user,
    splitType: '50/50',
    category: category || 'Electricity (Coins)',
    isCoin: true,
    splitDetails: {
      OzricAmount: value / 2,
      PawanAmount: value / 2
    },
    notes: `Coin inserted physically into meter (Log category: ${category || 'Electricity (Coins)'})`,
    status: 'pending',
    createdBy: createdBy || user
  });
}

// Settle up balances
export async function settleUpBalances(payer: Roommate, receiver: Roommate, amount: number, createdBy?: Roommate) {
  return addExpense({
    title: `Settled Balance (€${amount.toFixed(2)})`,
    amount: amount,
    paidBy: payer,
    splitType: 'custom',
    category: 'Other',
    isSettlement: true,
    splitDetails: {
      OzricAmount: payer === 'Ozric' ? 0 : amount,
      PawanAmount: payer === 'Pawan' ? 0 : amount
    },
    notes: `${payer} transferred €${amount.toFixed(2)} to ${receiver} to settle up`,
    status: 'pending',
    createdBy: createdBy || payer
  });
}

// Log a lend/borrow direct cash or transfer entry
export async function logLendBorrow(
  lender: Roommate,
  borrower: Roommate,
  amount: number,
  paymentMethod: 'Cash' | 'Revolut' | 'Bank Transfer',
  notes?: string,
  createdBy?: Roommate
) {
  return addExpense({
    title: `${lender} lent ${borrower} €${amount.toFixed(2)}`,
    amount: amount,
    paidBy: lender,
    splitType: 'custom',
    category: 'Other',
    isLendBorrow: true,
    paymentMethod,
    splitDetails: {
      OzricAmount: lender === 'Ozric' ? 0 : amount,
      PawanAmount: lender === 'Pawan' ? 0 : amount
    },
    notes: notes?.trim() || `${lender} lent €${amount.toFixed(2)} to ${borrower} via ${paymentMethod}`,
    status: 'pending',
    createdBy: createdBy || lender
  });
}

const PROFILES_COLLECTION = 'profiles';
const LOGIN_LOGS_COLLECTION = 'login_logs';

// Secure SHA-256 password hashing using Web Crypto API
export async function hashPassword(password: string): Promise<string> {
  if (!password) return '';
  // If it's already a SHA-256 hash (64 hex chars), return it
  if (/^[a-f0-9]{64}$/i.test(password)) {
    return password;
  }
  const msgBuffer = new TextEncoder().encode(password);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

// Fetch security profile for a roommate (or initialize with defaults)
export async function getProfile(id: Roommate): Promise<Profile> {
  try {
    const docRef = doc(db, PROFILES_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    const defaultPasswordHash = await hashPassword('1234');

    if (docSnap.exists()) {
      const data = docSnap.data();
      // Auto-hash password in database if it is in plain text
      let dbPassword = data.password || '1234';
      if (!/^[a-f0-9]{64}$/i.test(dbPassword)) {
        dbPassword = await hashPassword(dbPassword);
        await setDoc(docRef, { password: dbPassword }, { merge: true });
      }

      return {
        id,
        password: dbPassword,
        nickname: data.nickname || id,
        avatar: data.avatar || (id === 'Ozric' ? '🐼' : '🦊'),
        accentColor: data.accentColor || (id === 'Ozric' ? 'indigo' : 'rose'),
        monthlyBudget: data.monthlyBudget || undefined,
        preferredPaymentMethod: data.preferredPaymentMethod || 'Revolut',
        quickCoinCategory: data.quickCoinCategory || 'Electricity (Coins)',
        phone: data.phone || '',
        failedAttemptsCount: data.failedAttemptsCount || 0,
        lockoutType: data.lockoutType || 'none',
        lockedUntil: data.lockedUntil || null,
        permanentLock: data.permanentLock || false,
        manualLocked: data.manualLocked || false,
        recoveryRequest: data.recoveryRequest || null,
        updatedAt: data.updatedAt
      };
    } else {
      // Initialize in database with secure hash
      const defaultProfile = {
        password: defaultPasswordHash,
        nickname: id,
        avatar: id === 'Ozric' ? '🐼' : '🦊',
        accentColor: id === 'Ozric' ? 'indigo' : 'rose',
        preferredPaymentMethod: 'Revolut',
        quickCoinCategory: 'Electricity (Coins)',
        phone: '',
        failedAttemptsCount: 0,
        lockoutType: 'none',
        lockedUntil: null,
        permanentLock: false,
        manualLocked: false,
        recoveryRequest: null,
        updatedAt: serverTimestamp()
      };
      await setDoc(docRef, defaultProfile);
      return {
        id,
        password: defaultPasswordHash,
        nickname: id,
        avatar: id === 'Ozric' ? '🐼' : '🦊',
        accentColor: id === 'Ozric' ? 'indigo' : 'rose',
        preferredPaymentMethod: 'Revolut',
        quickCoinCategory: 'Electricity (Coins)',
        phone: '',
        failedAttemptsCount: 0,
        lockoutType: 'none',
        lockedUntil: null,
        permanentLock: false,
        manualLocked: false,
        recoveryRequest: null
      };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${PROFILES_COLLECTION}/${id}`);
  }
}

// Update security profile for a roommate
export async function updateProfile(id: Roommate, updates: Partial<Omit<Profile, 'id'>>, actor?: string) {
  try {
    const docRef = doc(db, PROFILES_COLLECTION, id);
    const cleanUpdates: any = {};
    
    // Hash password before saving if provided
    if (updates.password !== undefined) {
      updates.password = await hashPassword(updates.password);
    }

    Object.entries(updates).forEach(([key, val]) => {
      if (val !== undefined) {
        cleanUpdates[key] = val;
      }
    });

    await setDoc(docRef, {
      ...cleanUpdates,
      updatedAt: serverTimestamp()
    }, { merge: true });

    // Send notifications based on updated parameters
    if (updates.password !== undefined) {
      sendDiscordNotification('passwordSecurityChanges', {
        title: `🔐 Passcode Security Alteration`,
        description: `A hashed passcode modification has been recorded for roommate profile "${id}".`,
        category: 'security',
        color: 15570220, // orange #ED8936
        fields: [
          { name: 'Roommate Profile', value: id, inline: true },
          { name: 'Modified By', value: actor || id, inline: true }
        ]
      }, actor);
    }

    if (updates.nickname !== undefined || updates.avatar !== undefined || updates.accentColor !== undefined || updates.monthlyBudget !== undefined) {
      sendDiscordNotification('settingsChanges', {
        title: `⚙️ Profile Customization Updated`,
        description: `Custom avatar, nickname, budget limit, or color preference saved for profile "${id}".`,
        category: 'security',
        color: 3447003, // blue #3498DB
        fields: [
          { name: 'Roommate Profile', value: id, inline: true },
          { name: 'New Nickname', value: updates.nickname || 'Unchanged', inline: true },
          { name: 'New Avatar', value: updates.avatar || 'Unchanged', inline: true },
          { name: 'New Budget Limit', value: updates.monthlyBudget ? `€${updates.monthlyBudget}` : 'None/Unchanged', inline: true },
          { name: 'Modified By', value: actor || id, inline: true }
        ]
      }, actor);
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${PROFILES_COLLECTION}/${id}`);
  }
}

// Log a successful or failed login attempt
export async function addLoginLog(log: Omit<LoginLog, 'id' | 'timestamp'>): Promise<string> {
  try {
    const logsRef = collection(db, LOGIN_LOGS_COLLECTION);
    const docRef = await addDoc(logsRef, {
      ...log,
      timestamp: serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, LOGIN_LOGS_COLLECTION);
  }
}

// Update a login log with logout details
export async function updateLoginLogLogout(id: string, duration: number) {
  try {
    const docRef = doc(db, LOGIN_LOGS_COLLECTION, id);
    await updateDoc(docRef, {
      logoutTime: serverTimestamp(),
      sessionDuration: duration
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${LOGIN_LOGS_COLLECTION}/${id}`);
  }
}

// Subscribe to real-time login logs
export function subscribeLoginLogs(callback: (logs: LoginLog[]) => void, onError?: (error: any) => void) {
  const logsRef = collection(db, LOGIN_LOGS_COLLECTION);
  const q = query(logsRef, orderBy('timestamp', 'desc'));

  return onSnapshot(
    q,
    (snapshot) => {
      const logs: LoginLog[] = [];
      snapshot.forEach((doc) => {
        const data = doc.data();
        logs.push({
          id: doc.id,
          userId: data.userId,
          fullName: data.fullName,
          email: data.email,
          userRole: data.userRole,
          status: data.status,
          timestamp: data.timestamp ? (data.timestamp.toDate ? data.timestamp.toDate() : new Date(data.timestamp)) : new Date(),
          ipAddress: data.ipAddress || '',
          country: data.country || '',
          state: data.state || '',
          city: data.city || '',
          location: data.location || '',
          deviceName: data.deviceName || '',
          deviceType: data.deviceType || 'Desktop',
          operatingSystem: data.operatingSystem || '',
          browser: data.browser || '',
          browserVersion: data.browserVersion || '',
          screenResolution: data.screenResolution || '',
          timeZone: data.timeZone || '',
          language: data.language || '',
          sessionId: data.sessionId || '',
          logoutTime: data.logoutTime ? (data.logoutTime.toDate ? data.logoutTime.toDate() : new Date(data.logoutTime)) : null,
          sessionDuration: data.sessionDuration || 0,
          failureReason: data.failureReason || ''
        });
      });
      callback(logs);
    },
    (error) => {
      console.error("Firestore login logs subscription error: ", error);
      if (onError) {
        onError(error);
      } else {
        handleFirestoreError(error, OperationType.GET, LOGIN_LOGS_COLLECTION);
      }
    }
  );
}


