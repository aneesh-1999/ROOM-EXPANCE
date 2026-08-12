export type Roommate = 'Ozric' | 'Pawan';

export type Category = 
  | 'Rent' 
  | 'Electricity (Coins)' 
  | 'Shared Groceries' 
  | 'Household Supplies' 
  | 'Internet/Wi-Fi' 
  | 'Takeout/Delivery' 
  | 'Other';

export type SplitType = '50/50' | 'custom' | 'itemized';

export interface Expense {
  id?: string;
  title: string;
  amount: number;
  paidBy: Roommate;
  splitType: SplitType;
  category: Category;
  timestamp: any; // Firestore Timestamp or ISO String
  splitDetails: {
    OzricAmount: number;
    PawanAmount: number;
  };
  paymentDistribution?: {
    OzricAmount: number;
    PawanAmount: number;
  };
  isCoin?: boolean; // If logged via Coin Meter Quick Log
  isSettlement?: boolean; // If this represents a "Settle Up" transaction
  isLendBorrow?: boolean; // If this represents a lend/borrow direct cash or transfer entry
  paymentMethod?: 'Cash' | 'Revolut' | 'Bank Transfer'; // Transfer mode for lend/borrow
  itemizedDetails?: {
    personalUser: Roommate;
    personalAmount: number;
  };
  notes?: string;
  status?: 'pending' | 'confirmed';
  createdBy?: Roommate;
  deleteRequested?: boolean;
  deleteRequestedBy?: Roommate;
}

export interface Settlement {
  id: string;
  timestamp: any;
  amount: number;
  paidBy: Roommate; // The person who paid to settle up (who owed)
  receivedBy: Roommate; // The person who received it (who was owed)
}

export interface Profile {
  id: Roommate; // 'Ozric' or 'Pawan'
  password?: string;
  nickname?: string;
  avatar?: string; // custom emoji, e.g. 🐼, 🦊
  accentColor?: 'indigo' | 'rose' | 'amber' | 'emerald' | 'violet' | 'sky';
  monthlyBudget?: number | null; // spending limit
  preferredPaymentMethod?: 'Cash' | 'Revolut' | 'Bank Transfer';
  quickCoinCategory?: Category;
  phone?: string;
  updatedAt?: any;
  failedAttemptsCount?: number;
  lockoutType?: 'none' | 'temporary_10' | 'temporary_30' | 'permanent';
  lockedUntil?: any;
  permanentLock?: boolean;
  manualLocked?: boolean;
  recoveryRequest?: {
    requestedAt: any;
    targetPassword?: string;
    answersCorrect?: boolean;
    activeAt?: any;
  } | null;
}

export interface LoginLog {
  id?: string;
  userId: Roommate | string;
  fullName: string;
  email: string;
  userRole: string;
  status: 'Success' | 'Failed' | 'Locked';
  timestamp: any;
  ipAddress: string;
  country: string;
  state: string;
  city: string;
  location: string;
  deviceName: string;
  deviceType: 'Desktop' | 'Mobile' | 'Tablet';
  operatingSystem: string;
  browser: string;
  browserVersion: string;
  screenResolution: string;
  timeZone: string;
  language: string;
  sessionId: string;
  logoutTime?: any;
  sessionDuration?: number;
  failureReason?: string;
}

export type PersonalAccountType = 'Cash' | 'Bank Account' | 'Revolut' | 'Digital Wallet';
export type PersonalTxType = 'expense' | 'income' | 'remittance';

export interface PersonalAccount {
  id: string;
  user: Roommate;
  name: string;
  type: PersonalAccountType;
  balance: number;
  currency: 'EUR' | 'NPR' | 'USD';
  createdAt?: any;
}

export interface PersonalTransaction {
  id: string;
  user: Roommate;
  title: string;
  amount: number;
  type: PersonalTxType;
  category: string;
  accountId: string; // references PersonalAccount.id
  timestamp: any;
  tags: string[];
  receiptUrl?: string; // Base64 or mock file url
  receiptName?: string;
  notes?: string;
  currency: 'EUR' | 'NPR' | 'USD';
  exchangeRate?: number; // Rate to EUR
}

export interface SavingsGoal {
  id: string;
  user: Roommate;
  name: string;
  targetAmount: number;
  currentAmount: number;
  currency: 'EUR' | 'NPR' | 'USD';
  deadline: string; // YYYY-MM-DD
  notes?: string;
  createdAt?: any;
}

export interface RecurringBill {
  id: string;
  user: Roommate;
  name: string;
  amount: number;
  category: string;
  dueDate: number; // day of month (1-31)
  frequency: 'Monthly' | 'Weekly' | 'Yearly';
  currency: 'EUR' | 'NPR' | 'USD';
  lastPaid?: string; // YYYY-MM-DD
  reminderActive: boolean;
  notes?: string;
}

export interface Shift {
  id?: string;
  user: Roommate;
  date: string; // YYYY-MM-DD
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  title: string;
  reminderHoursBefore: number; // e.g. 1 or 2
  reminderActive: boolean;
  notified?: boolean;
  notes?: string;
  createdAt?: any;
  employerName?: string;
  hourlyRate?: number;
  unpaidBreakMinutes?: number;
  completed?: boolean;
}

export type ShoppingCategory = 
  | 'Produce & Groceries' 
  | 'Pantry & Grains' 
  | 'Dairy & Refrigerated' 
  | 'Household & Cleaning' 
  | 'Snacks & Beverages' 
  | 'Other';

export type ShoppingPriority = 'Urgent (Running Low)' | 'Normal' | 'Low';

export interface ShoppingItem {
  id?: string;
  title: string;
  quantity?: string;
  category: ShoppingCategory;
  priority: ShoppingPriority;
  addedBy: Roommate;
  completed: boolean;
  completedBy?: Roommate;
  completedAt?: any;
  notes?: string;
  convertedToExpenseId?: string;
  estimatedCost?: number;
  createdAt?: any;
}

