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
}
