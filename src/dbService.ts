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
import { Expense, Roommate, Profile, Category } from './types';

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
export async function addExpense(expense: Omit<Expense, 'id' | 'timestamp'>) {
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
    return docRef.id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, EXPENSES_COLLECTION);
  }
}

// Delete an expense
export async function deleteExpense(id: string) {
  try {
    const docRef = doc(db, EXPENSES_COLLECTION, id);
    await deleteDoc(docRef);
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
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${EXPENSES_COLLECTION}/${id}`);
  }
}

// Cancel or reject a deletion request
export async function cancelDeleteExpense(id: string) {
  try {
    const docRef = doc(db, EXPENSES_COLLECTION, id);
    await updateDoc(docRef, {
      deleteRequested: false,
      deleteRequestedBy: null
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `${EXPENSES_COLLECTION}/${id}`);
  }
}

// Confirm/approve a pending transaction
export async function confirmExpense(id: string) {
  try {
    const docRef = doc(db, EXPENSES_COLLECTION, id);
    await updateDoc(docRef, {
      status: 'confirmed'
    });
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

// Fetch security profile for a roommate (or initialize with defaults)
export async function getProfile(id: Roommate): Promise<Profile> {
  try {
    const docRef = doc(db, PROFILES_COLLECTION, id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        id,
        password: data.password || '1234',
        nickname: data.nickname || id,
        avatar: data.avatar || (id === 'Ozric' ? '🐼' : '🦊'),
        accentColor: data.accentColor || (id === 'Ozric' ? 'indigo' : 'rose'),
        monthlyBudget: data.monthlyBudget || undefined,
        preferredPaymentMethod: data.preferredPaymentMethod || 'Revolut',
        quickCoinCategory: data.quickCoinCategory || 'Electricity (Coins)',
        phone: data.phone || '',
        updatedAt: data.updatedAt
      };
    } else {
      // Initialize in database
      const defaultProfile = {
        password: '1234',
        nickname: id,
        avatar: id === 'Ozric' ? '🐼' : '🦊',
        accentColor: id === 'Ozric' ? 'indigo' : 'rose',
        preferredPaymentMethod: 'Revolut',
        quickCoinCategory: 'Electricity (Coins)',
        phone: '',
        updatedAt: serverTimestamp()
      };
      await setDoc(docRef, defaultProfile);
      return {
        id,
        password: '1234',
        nickname: id,
        avatar: id === 'Ozric' ? '🐼' : '🦊',
        accentColor: id === 'Ozric' ? 'indigo' : 'rose',
        preferredPaymentMethod: 'Revolut',
        quickCoinCategory: 'Electricity (Coins)',
        phone: ''
      };
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, `${PROFILES_COLLECTION}/${id}`);
  }
}

// Update security profile for a roommate
export async function updateProfile(id: Roommate, updates: Partial<Omit<Profile, 'id'>>) {
  try {
    const docRef = doc(db, PROFILES_COLLECTION, id);
    const cleanUpdates: any = {};
    Object.entries(updates).forEach(([key, val]) => {
      if (val !== undefined) {
        cleanUpdates[key] = val;
      }
    });
    await setDoc(docRef, {
      ...cleanUpdates,
      updatedAt: serverTimestamp()
    }, { merge: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `${PROFILES_COLLECTION}/${id}`);
  }
}


