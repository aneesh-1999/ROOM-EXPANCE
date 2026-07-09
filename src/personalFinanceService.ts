import { 
  collection, 
  addDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  where,
  serverTimestamp,
  updateDoc,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { db } from './firebase';
import { 
  PersonalAccount, 
  PersonalTransaction, 
  SavingsGoal, 
  RecurringBill, 
  Roommate,
  PersonalTxType
} from './types';

const ACCOUNTS_COLLECTION = 'personal_accounts';
const TRANSACTIONS_COLLECTION = 'personal_transactions';
const SAVINGS_COLLECTION = 'personal_savings_goals';
const RECURRING_COLLECTION = 'personal_recurring_bills';

// Helper to clean undefined fields before sending to Firestore
function cleanPayload<T extends object>(obj: T): any {
  return Object.entries(obj).reduce((acc, [key, value]) => {
    if (value !== undefined) {
      acc[key] = value;
    }
    return acc;
  }, {} as any);
}

// ---------------------------------------------
// 1. PERSONAL ACCOUNTS
// ---------------------------------------------

// Subscribe to private accounts of a roommate
export function subscribeAccounts(user: Roommate, callback: (accounts: PersonalAccount[]) => void) {
  const accountsRef = collection(db, ACCOUNTS_COLLECTION);
  const q = query(accountsRef, where('user', '==', user));

  return onSnapshot(q, async (snapshot) => {
    const accounts: PersonalAccount[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      accounts.push({
        id: doc.id,
        user: data.user,
        name: data.name,
        type: data.type,
        balance: data.balance || 0,
        currency: data.currency || 'EUR',
        createdAt: data.createdAt
      });
    });

    // If first time and no accounts exist, initialize default ones
    if (snapshot.empty) {
      try {
        await initializeDefaultAccounts(user);
      } catch (err) {
        console.error("Failed to initialize default accounts: ", err);
      }
    } else {
      callback(accounts);
    }
  }, (error) => {
    console.error("Error subscribing to personal accounts:", error);
  });
}

// Setup initial default accounts
async function initializeDefaultAccounts(user: Roommate) {
  const accountsRef = collection(db, ACCOUNTS_COLLECTION);
  const defaults = [
    { name: 'Physical Cash', type: 'Cash', balance: 120, currency: 'EUR' },
    { name: 'Primary Bank Account', type: 'Bank Account', balance: 1550, currency: 'EUR' },
    { name: 'Revolut Card', type: 'Revolut', balance: 340, currency: 'EUR' },
    { name: 'Digital Wallet (eSewa)', type: 'Digital Wallet', balance: 80, currency: 'EUR' }
  ];

  const batch = writeBatch(db);
  defaults.forEach((acc) => {
    const newDocRef = doc(accountsRef);
    batch.set(newDocRef, {
      ...acc,
      user,
      createdAt: new Date().toISOString()
    });
  });

  await batch.commit();
}

// Add custom account
export async function addAccount(account: Omit<PersonalAccount, 'id' | 'createdAt'>) {
  const accountsRef = collection(db, ACCOUNTS_COLLECTION);
  const payload = cleanPayload({
    ...account,
    createdAt: new Date().toISOString()
  });
  const docRef = await addDoc(accountsRef, payload);
  return docRef.id;
}

// Update account
export async function updateAccount(id: string, updates: Partial<Omit<PersonalAccount, 'id' | 'user'>>) {
  const docRef = doc(db, ACCOUNTS_COLLECTION, id);
  const payload = cleanPayload(updates);
  await updateDoc(docRef, payload);
}

// Delete account
export async function deleteAccount(id: string) {
  const docRef = doc(db, ACCOUNTS_COLLECTION, id);
  await deleteDoc(docRef);
}

// ---------------------------------------------
// 2. PERSONAL TRANSACTIONS
// ---------------------------------------------

// Subscribe to private transactions of a roommate
export function subscribeTransactions(user: Roommate, callback: (transactions: PersonalTransaction[]) => void) {
  const txRef = collection(db, TRANSACTIONS_COLLECTION);
  const q = query(txRef, where('user', '==', user));

  return onSnapshot(q, (snapshot) => {
    const transactions: PersonalTransaction[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      transactions.push({
        id: doc.id,
        user: data.user,
        title: data.title,
        amount: data.amount,
        type: data.type,
        category: data.category,
        accountId: data.accountId,
        timestamp: data.timestamp ? (data.timestamp.toDate ? data.timestamp.toDate() : new Date(data.timestamp)) : new Date(),
        tags: data.tags || [],
        receiptUrl: data.receiptUrl || undefined,
        receiptName: data.receiptName || undefined,
        notes: data.notes || '',
        currency: data.currency || 'EUR',
        exchangeRate: data.exchangeRate || 1
      });
    });

    // Sort in memory by timestamp descending
    transactions.sort((a, b) => {
      const tA = new Date(a.timestamp).getTime();
      const tB = new Date(b.timestamp).getTime();
      return tB - tA;
    });

    callback(transactions);
  }, (error) => {
    console.error("Error subscribing to personal transactions:", error);
  });
}

// Add a transaction & update account balance automatically
export async function addTransaction(
  tx: Omit<PersonalTransaction, 'id' | 'timestamp'>, 
  account: PersonalAccount
) {
  // Compute new account balance
  let balanceChange = tx.amount;
  if (tx.type === 'expense' || tx.type === 'remittance') {
    balanceChange = -tx.amount;
  }

  const newBalance = account.balance + balanceChange;

  // Perform Firestore writes
  const batch = writeBatch(db);

  // 1. Write the transaction
  const txRef = doc(collection(db, TRANSACTIONS_COLLECTION));
  batch.set(txRef, {
    ...cleanPayload(tx),
    timestamp: new Date().toISOString()
  });

  // 2. Update account balance
  const accountRef = doc(db, ACCOUNTS_COLLECTION, account.id);
  batch.update(accountRef, {
    balance: newBalance
  });

  await batch.commit();
  return txRef.id;
}

// Delete a transaction & restore corresponding account balance
export async function deleteTransaction(tx: PersonalTransaction, account: PersonalAccount) {
  // Revert balance change
  let balanceChange = tx.amount;
  if (tx.type === 'expense' || tx.type === 'remittance') {
    // Expense originally subtracted from balance, so we ADD it back
    balanceChange = tx.amount;
  } else {
    // Income originally added to balance, so we SUBTRACT it
    balanceChange = -tx.amount;
  }

  const newBalance = account.balance + balanceChange;

  const batch = writeBatch(db);

  // 1. Delete transaction document
  const txRef = doc(db, TRANSACTIONS_COLLECTION, tx.id);
  batch.delete(txRef);

  // 2. Update account balance
  const accountRef = doc(db, ACCOUNTS_COLLECTION, account.id);
  batch.update(accountRef, {
    balance: newBalance
  });

  await batch.commit();
}


// ---------------------------------------------
// 3. SAVINGS GOALS
// ---------------------------------------------

// Subscribe to savings goals
export function subscribeSavingsGoals(user: Roommate, callback: (goals: SavingsGoal[]) => void) {
  const goalsRef = collection(db, SAVINGS_COLLECTION);
  const q = query(goalsRef, where('user', '==', user));

  return onSnapshot(q, (snapshot) => {
    const goals: SavingsGoal[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      goals.push({
        id: doc.id,
        user: data.user,
        name: data.name,
        targetAmount: data.targetAmount || 0,
        currentAmount: data.currentAmount || 0,
        currency: data.currency || 'EUR',
        deadline: data.deadline || '',
        notes: data.notes || '',
        createdAt: data.createdAt
      });
    });

    callback(goals);
  }, (error) => {
    console.error("Error subscribing to savings goals:", error);
  });
}

// Add Savings Goal
export async function addSavingsGoal(goal: Omit<SavingsGoal, 'id' | 'createdAt'>) {
  const goalsRef = collection(db, SAVINGS_COLLECTION);
  const payload = cleanPayload({
    ...goal,
    createdAt: new Date().toISOString()
  });
  const docRef = await addDoc(goalsRef, payload);
  return docRef.id;
}

// Contribute to Savings Goal (optionally deducts from a personal account)
export async function contributeToSavingsGoal(
  goal: SavingsGoal, 
  amount: number, 
  account?: PersonalAccount
) {
  const batch = writeBatch(db);

  // Update savings goal
  const goalRef = doc(db, SAVINGS_COLLECTION, goal.id);
  batch.update(goalRef, {
    currentAmount: goal.currentAmount + amount
  });

  // If a source account is specified, subtract from account and log transaction
  if (account) {
    const accountRef = doc(db, ACCOUNTS_COLLECTION, account.id);
    batch.update(accountRef, {
      balance: account.balance - amount
    });

    // Create a transaction log
    const txRef = doc(collection(db, TRANSACTIONS_COLLECTION));
    batch.set(txRef, {
      user: goal.user,
      title: `Saved for: ${goal.name}`,
      amount,
      type: 'expense',
      category: 'Savings Contribution',
      accountId: account.id,
      timestamp: new Date().toISOString(),
      tags: ['Savings', goal.name],
      notes: `Transferred €${amount} from ${account.name} into savings goal.`,
      currency: goal.currency
    });
  }

  await batch.commit();
}

// Delete Savings Goal
export async function deleteSavingsGoal(id: string) {
  const docRef = doc(db, SAVINGS_COLLECTION, id);
  await deleteDoc(docRef);
}


// ---------------------------------------------
// 4. RECURRING BILLS
// ---------------------------------------------

// Subscribe to recurring bills
export function subscribeRecurringBills(user: Roommate, callback: (bills: RecurringBill[]) => void) {
  const billsRef = collection(db, RECURRING_COLLECTION);
  const q = query(billsRef, where('user', '==', user));

  return onSnapshot(q, (snapshot) => {
    const bills: RecurringBill[] = [];
    snapshot.forEach((doc) => {
      const data = doc.data();
      bills.push({
        id: doc.id,
        user: data.user,
        name: data.name,
        amount: data.amount || 0,
        category: data.category || 'Other',
        dueDate: data.dueDate || 1,
        frequency: data.frequency || 'Monthly',
        currency: data.currency || 'EUR',
        lastPaid: data.lastPaid || undefined,
        reminderActive: data.reminderActive !== false,
        notes: data.notes || ''
      });
    });

    // Sort by due date day ascending
    bills.sort((a, b) => a.dueDate - b.dueDate);

    callback(bills);
  }, (error) => {
    console.error("Error subscribing to recurring bills:", error);
  });
}

// Add Recurring Bill
export async function addRecurringBill(bill: Omit<RecurringBill, 'id'>) {
  const billsRef = collection(db, RECURRING_COLLECTION);
  const payload = cleanPayload(bill);
  const docRef = await addDoc(billsRef, payload);
  return docRef.id;
}

// Delete Recurring Bill
export async function deleteRecurringBill(id: string) {
  const docRef = doc(db, RECURRING_COLLECTION, id);
  await deleteDoc(docRef);
}

// Pay Recurring Bill (deducts from specified account, records personal transaction, updates lastPaid)
export async function payRecurringBill(
  bill: RecurringBill, 
  account: PersonalAccount,
  paymentDate: string // YYYY-MM-DD
) {
  const batch = writeBatch(db);

  // 1. Update bill's lastPaid field
  const billRef = doc(db, RECURRING_COLLECTION, bill.id);
  batch.update(billRef, {
    lastPaid: paymentDate
  });

  // 2. Deduct amount from bank account
  const accountRef = doc(db, ACCOUNTS_COLLECTION, account.id);
  batch.update(accountRef, {
    balance: account.balance - bill.amount
  });

  // 3. Log a personal transaction
  const txRef = doc(collection(db, TRANSACTIONS_COLLECTION));
  batch.set(txRef, {
    user: bill.user,
    title: `Paid Bill: ${bill.name}`,
    amount: bill.amount,
    type: 'expense',
    category: bill.category,
    accountId: account.id,
    timestamp: new Date().toISOString(),
    tags: ['Recurring', bill.category],
    notes: `Automated payment log of recurring ${bill.frequency} bill via ${account.name}`,
    currency: bill.currency
  });

  await batch.commit();
}
