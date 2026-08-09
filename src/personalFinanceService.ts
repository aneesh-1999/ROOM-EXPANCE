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
  writeBatch,
  getDoc
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
import { sendDiscordNotification } from './discordService';

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

    callback(accounts);
  }, (error) => {
    console.error("Error subscribing to personal accounts:", error);
  });
}

// Add custom account
export async function addAccount(account: Omit<PersonalAccount, 'id' | 'createdAt'>) {
  const accountsRef = collection(db, ACCOUNTS_COLLECTION);
  const payload = cleanPayload({
    ...account,
    createdAt: new Date().toISOString()
  });
  const docRef = await addDoc(accountsRef, payload);

  sendDiscordNotification('accountChanges', {
    title: `🏦 Private Account Created`,
    description: `A new private wallet/vault has been registered.`,
    category: 'security',
    color: 3447003, // Blue
    fields: [
      { name: 'Wallet Name', value: account.name, inline: true },
      { name: 'Type', value: account.type, inline: true },
      { name: 'Initial Balance', value: `${account.currency} ${account.balance}`, inline: true },
      { name: 'Profile Owner', value: account.user, inline: true }
    ]
  }, account.user);

  return docRef.id;
}

// Update account
export async function updateAccount(id: string, updates: Partial<Omit<PersonalAccount, 'id' | 'user'>>) {
  const docRef = doc(db, ACCOUNTS_COLLECTION, id);
  const docSnap = await getDoc(docRef);
  const payload = cleanPayload(updates);
  await updateDoc(docRef, payload);

  if (docSnap.exists()) {
    const original = docSnap.data();
    sendDiscordNotification('accountChanges', {
      title: `🏦 Private Account Updated`,
      description: `A private wallet/vault has been modified.`,
      category: 'security',
      color: 3447003, // Blue
      fields: [
        { name: 'Wallet', value: original.name || 'Untitled', inline: true },
        { name: 'Updates', value: Object.keys(updates).join(', '), inline: true },
        { name: 'Profile Owner', value: original.user, inline: true }
      ]
    }, original.user);
  }
}

// Delete account
export async function deleteAccount(id: string) {
  const docRef = doc(db, ACCOUNTS_COLLECTION, id);
  const docSnap = await getDoc(docRef);
  await deleteDoc(docRef);

  if (docSnap.exists()) {
    const original = docSnap.data();
    sendDiscordNotification('accountChanges', {
      title: `🏦 Private Account Deleted`,
      description: `A private budget account has been removed.`,
      category: 'security',
      color: 15158332, // Red
      fields: [
        { name: 'Wallet Name', value: original.name || 'Untitled', inline: true },
        { name: 'Type', value: original.type || 'Unknown', inline: true },
        { name: 'Final Balance', value: `${original.currency || 'EUR'} ${original.balance || 0}`, inline: true },
        { name: 'Profile Owner', value: original.user, inline: true }
      ]
    }, original.user);
  }
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
  tx: Omit<PersonalTransaction, 'id' | 'timestamp'> & { timestamp?: any }, 
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
    timestamp: tx.timestamp ? new Date(tx.timestamp).toISOString() : new Date().toISOString()
  });

  // 2. Update account balance
  const accountRef = doc(db, ACCOUNTS_COLLECTION, account.id);
  batch.update(accountRef, {
    balance: newBalance
  });

  await batch.commit();

  sendDiscordNotification('financeUpdates', {
    title: `📊 Private Transaction Logged`,
    description: `A personal finance transaction has been recorded.`,
    category: 'transactions',
    color: tx.type === 'income' ? 3066993 : 15158332, // Green for income, Red for expense
    fields: [
      { name: 'Title', value: tx.title, inline: true },
      { name: 'Amount', value: `${tx.currency} ${tx.amount.toFixed(2)}`, inline: true },
      { name: 'Type', value: tx.type.toUpperCase(), inline: true },
      { name: 'Category', value: tx.category, inline: true },
      { name: 'Account Affected', value: account.name, inline: true },
      { name: 'Profile Owner', value: tx.user, inline: true }
    ]
  }, tx.user);

  return txRef.id;
}

// Delete a transaction & restore corresponding account balance
export async function deleteTransaction(tx: PersonalTransaction, account?: PersonalAccount) {
  const batch = writeBatch(db);

  // 1. Delete transaction document
  const txRef = doc(db, TRANSACTIONS_COLLECTION, tx.id);
  batch.delete(txRef);

  // 2. Update account balance if account is provided
  if (account) {
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
    const accountRef = doc(db, ACCOUNTS_COLLECTION, account.id);
    batch.update(accountRef, {
      balance: newBalance
    });
  }

  await batch.commit();

  sendDiscordNotification('financeUpdates', {
    title: `📊 Private Transaction Deleted`,
    description: `A personal transaction has been deleted.`,
    category: 'transactions',
    color: 10181046, // Purple
    fields: [
      { name: 'Title', value: tx.title, inline: true },
      { name: 'Amount', value: `${tx.currency} ${tx.amount.toFixed(2)}`, inline: true },
      { name: 'Category', value: tx.category, inline: true },
      { name: 'Profile Owner', value: tx.user, inline: true }
    ]
  }, tx.user);
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

  sendDiscordNotification('savingsGoalsChanges', {
    title: `🎯 Savings Goal Initiated`,
    description: `A new savings goal benchmark has been created.`,
    category: 'savings',
    color: 16753920, // Orange
    fields: [
      { name: 'Goal Name', value: goal.name, inline: true },
      { name: 'Target Amount', value: `${goal.currency} ${goal.targetAmount}`, inline: true },
      { name: 'Deadline', value: goal.deadline || 'None', inline: true },
      { name: 'Profile Owner', value: goal.user, inline: true }
    ]
  }, goal.user);

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
  const newAmount = goal.currentAmount + amount;
  batch.update(goalRef, {
    currentAmount: newAmount
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

  // Check for goal completion!
  const isCompleted = newAmount >= goal.targetAmount;
  sendDiscordNotification('savingsGoalsChanges', {
    title: isCompleted ? `🎉 SAVINGS GOAL COMPLETED!` : `📈 Savings Goal Contribution`,
    description: isCompleted 
      ? `Congratulations! The savings goal "${goal.name}" has reached its destination target!` 
      : `An amount has been saved towards the goal "${goal.name}".`,
    category: 'savings',
    color: isCompleted ? 3066993 : 16753920, // Green if completed, orange if contributed
    fields: [
      { name: 'Goal Name', value: goal.name, inline: true },
      { name: 'Contributed', value: `${goal.currency} ${amount}`, inline: true },
      { name: 'Progress', value: `${goal.currency} ${newAmount} / ${goal.targetAmount}`, inline: true },
      { name: 'Profile Owner', value: goal.user, inline: true }
    ]
  }, goal.user);
}

// Delete Savings Goal
export async function deleteSavingsGoal(id: string) {
  const docRef = doc(db, SAVINGS_COLLECTION, id);
  const docSnap = await getDoc(docRef);
  await deleteDoc(docRef);

  if (docSnap.exists()) {
    const original = docSnap.data();
    sendDiscordNotification('savingsGoalsChanges', {
      title: `🗑️ Savings Goal Terminated`,
      description: `A savings benchmark goal has been deleted.`,
      category: 'savings',
      color: 15158332, // Red
      fields: [
        { name: 'Goal Name', value: original.name || 'Untitled', inline: true },
        { name: 'Target Amount', value: `${original.currency || 'EUR'} ${original.targetAmount || 0}`, inline: true },
        { name: 'Profile Owner', value: original.user, inline: true }
      ]
    }, original.user);
  }
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

  sendDiscordNotification('financeUpdates', {
    title: `📅 Recurring Bill Added`,
    description: `A new recurring expense reminder has been registered.`,
    category: 'bills',
    color: 15105570, // Orange
    fields: [
      { name: 'Bill Name', value: bill.name, inline: true },
      { name: 'Amount', value: `${bill.currency} ${bill.amount}`, inline: true },
      { name: 'Due Date', value: `Day ${bill.dueDate} of the month`, inline: true },
      { name: 'Frequency', value: bill.frequency, inline: true },
      { name: 'Profile Owner', value: bill.user, inline: true }
    ]
  }, bill.user);

  return docRef.id;
}

// Delete Recurring Bill
export async function deleteRecurringBill(id: string) {
  const docRef = doc(db, RECURRING_COLLECTION, id);
  const docSnap = await getDoc(docRef);
  await deleteDoc(docRef);

  if (docSnap.exists()) {
    const original = docSnap.data();
    sendDiscordNotification('financeUpdates', {
      title: `🗑️ Recurring Bill Deleted`,
      description: `A recurring bill reminder has been removed.`,
      category: 'bills',
      color: 15158332, // Red
      fields: [
        { name: 'Bill Name', value: original.name || 'Untitled', inline: true },
        { name: 'Amount', value: `${original.currency || 'EUR'} ${original.amount || 0}`, inline: true },
        { name: 'Profile Owner', value: original.user, inline: true }
      ]
    }, original.user);
  }
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

  sendDiscordNotification('financeUpdates', {
    title: `✅ Recurring Bill Paid`,
    description: `A recurring expense reminder has been successfully paid and logged.`,
    category: 'bills',
    color: 3066993, // Green
    fields: [
      { name: 'Bill Paid', value: bill.name, inline: true },
      { name: 'Amount Paid', value: `${bill.currency} ${bill.amount.toFixed(2)}`, inline: true },
      { name: 'Source Account', value: account.name, inline: true },
      { name: 'Profile Owner', value: bill.user, inline: true }
    ]
  }, bill.user);
}

// ---------------------------------------------
// 5. FUNDS TRANSFER BETWEEN WALLETS
// ---------------------------------------------
export async function transferFunds(
  sourceAccount: PersonalAccount,
  destAccount: PersonalAccount,
  amount: number,
  convertedAmount: number,
  exchangeRate: number,
  user: Roommate,
  date: string
) {
  const batch = writeBatch(db);

  // 1. Deduct from source account
  const sourceRef = doc(db, ACCOUNTS_COLLECTION, sourceAccount.id);
  batch.update(sourceRef, {
    balance: sourceAccount.balance - amount
  });

  // 2. Add to destination account
  const destRef = doc(db, ACCOUNTS_COLLECTION, destAccount.id);
  batch.update(destRef, {
    balance: destAccount.balance + convertedAmount
  });

  // 3. Log Outflow Transaction
  const outTxRef = doc(collection(db, TRANSACTIONS_COLLECTION));
  batch.set(outTxRef, {
    user,
    title: `Transfer to ${destAccount.name}`,
    amount,
    type: 'expense',
    category: 'Transfer Out',
    accountId: sourceAccount.id,
    timestamp: new Date(date).toISOString(),
    tags: ['Transfer'],
    notes: `Ex. Rate: 1 ${sourceAccount.currency} = ${exchangeRate.toFixed(4)} ${destAccount.currency}`,
    currency: sourceAccount.currency,
    exchangeRate: sourceAccount.currency === 'EUR' ? 1.0 : (1.0 / exchangeRate)
  });

  // 4. Log Inflow Transaction
  const inTxRef = doc(collection(db, TRANSACTIONS_COLLECTION));
  batch.set(inTxRef, {
    user,
    title: `Transfer from ${sourceAccount.name}`,
    amount: convertedAmount,
    type: 'income',
    category: 'Transfer In',
    accountId: destAccount.id,
    timestamp: new Date(date).toISOString(),
    tags: ['Transfer'],
    notes: `Ex. Rate: 1 ${sourceAccount.currency} = ${exchangeRate.toFixed(4)} ${destAccount.currency}`,
    currency: destAccount.currency,
    exchangeRate: destAccount.currency === 'EUR' ? 1.0 : exchangeRate
  });

  await batch.commit();

  sendDiscordNotification('financeUpdates', {
    title: `🔄 Private Funds Transferred`,
    description: `Funds transferred from one private wallet to another.`,
    category: 'transactions',
    color: 3447003, // Blue
    fields: [
      { name: 'Source Wallet', value: sourceAccount.name, inline: true },
      { name: 'Destination Wallet', value: destAccount.name, inline: true },
      { name: 'Amount Sent', value: `${sourceAccount.currency} ${amount.toFixed(2)}`, inline: true },
      { name: 'Amount Received', value: `${destAccount.currency} ${convertedAmount.toFixed(2)}`, inline: true },
      { name: 'Profile Owner', value: user, inline: true }
    ]
  }, user);
}

