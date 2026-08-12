import { 
  collection, 
  getDocs, 
  doc, 
  setDoc, 
  deleteDoc, 
  writeBatch,
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';

export interface BackupCollectionSummary {
  expenses: number;
  profiles: number;
  login_logs: number;
  shifts: number;
  personal_accounts: number;
  personal_transactions: number;
  personal_savings_goals: number;
  personal_recurring_bills: number;
  discord_settings: number;
  shopping_list: number;
  [key: string]: number;
}

export interface BackupPackage {
  appName: string;
  version: string;
  exportedAt: string;
  collectionsCount: BackupCollectionSummary;
  data: {
    expenses?: any[];
    profiles?: any[];
    login_logs?: any[];
    shifts?: any[];
    personal_accounts?: any[];
    personal_transactions?: any[];
    personal_savings_goals?: any[];
    personal_recurring_bills?: any[];
    discord_settings?: any[];
    shopping_list?: any[];
    [key: string]: any[] | undefined;
  };
  localStorageData?: Record<string, string>;
}

const ALL_COLLECTIONS = [
  'expenses',
  'profiles',
  'login_logs',
  'shifts',
  'personal_accounts',
  'personal_transactions',
  'personal_savings_goals',
  'personal_recurring_bills',
  'discord_settings',
  'shopping_list'
];

/**
 * Recursively converts Firestore Timestamps and Dates to ISO strings for clean JSON serialization
 */
function serializeFieldValue(val: any): any {
  if (val === null || val === undefined) return val;
  if (typeof val === 'object' && typeof val.toDate === 'function') {
    return { _type: 'Timestamp', iso: val.toDate().toISOString() };
  }
  if (val instanceof Date) {
    return { _type: 'Timestamp', iso: val.toISOString() };
  }
  if (Array.isArray(val)) {
    return val.map(serializeFieldValue);
  }
  if (typeof val === 'object') {
    const res: any = {};
    for (const [k, v] of Object.entries(val)) {
      res[k] = serializeFieldValue(v);
    }
    return res;
  }
  return val;
}

/**
 * Recursively restores ISO string timestamps back into Firestore Timestamp or Date objects
 */
function deserializeFieldValue(val: any): any {
  if (val === null || val === undefined) return val;
  if (typeof val === 'object') {
    if (val._type === 'Timestamp' && typeof val.iso === 'string') {
      return Timestamp.fromDate(new Date(val.iso));
    }
    if (Array.isArray(val)) {
      return val.map(deserializeFieldValue);
    }
    const res: any = {};
    for (const [k, v] of Object.entries(val)) {
      res[k] = deserializeFieldValue(v);
    }
    return res;
  }
  if (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(val)) {
    // String ISO date conversion
    const d = new Date(val);
    if (!isNaN(d.getTime())) {
      return Timestamp.fromDate(d);
    }
  }
  return val;
}

/**
 * Fetches all documents from a Firestore collection
 */
async function fetchCollectionData(collectionName: string): Promise<any[]> {
  try {
    const querySnapshot = await getDocs(collection(db, collectionName));
    const items: any[] = [];
    querySnapshot.forEach((docSnap) => {
      const rawData = docSnap.data();
      const serialized = serializeFieldValue(rawData);
      items.push({
        _docId: docSnap.id,
        ...serialized
      });
    });
    return items;
  } catch (err) {
    console.warn(`[BackupService] Could not fetch collection ${collectionName}:`, err);
    return [];
  }
}

/**
 * Generates a full backup JSON structure from Firestore & relevant local state
 */
export async function createFullBackupJSON(): Promise<BackupPackage> {
  const collectionData: Record<string, any[]> = {};
  const counts: BackupCollectionSummary = {
    expenses: 0,
    profiles: 0,
    login_logs: 0,
    shifts: 0,
    personal_accounts: 0,
    personal_transactions: 0,
    personal_savings_goals: 0,
    personal_recurring_bills: 0,
    discord_settings: 0,
    shopping_list: 0
  };

  for (const colName of ALL_COLLECTIONS) {
    const docs = await fetchCollectionData(colName);
    collectionData[colName] = docs;
    counts[colName] = docs.length;
  }

  // Backup relevant local preferences
  const localStorageKeys = [
    'activeRoommate',
    'roommate_biometric_enabled',
    'zindagi_biometric_enabled',
    'cohabit_employer_presets_Ozric',
    'cohabit_employer_presets_Pawan'
  ];
  const localStorageData: Record<string, string> = {};
  for (const key of localStorageKeys) {
    const val = localStorage.getItem(key);
    if (val !== null) {
      localStorageData[key] = val;
    }
  }

  return {
    appName: 'Roommate Wallet & Cohabit',
    version: '1.0',
    exportedAt: new Date().toISOString(),
    collectionsCount: counts,
    data: collectionData,
    localStorageData
  };
}

/**
 * Triggers browser download of backup JSON file
 */
export async function downloadBackupFile(): Promise<{ fileName: string; itemCount: number }> {
  const backup = await createFullBackupJSON();
  const jsonString = JSON.stringify(backup, null, 2);
  const blob = new Blob([jsonString], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const now = new Date();
  const timestampStr = now.toISOString().replace(/[:.]/g, '-').slice(0, 19);
  const fileName = `roommate_wallet_backup_${timestampStr}.json`;

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  const totalItems = Object.values(backup.collectionsCount).reduce((a, b) => a + b, 0);
  return { fileName, itemCount: totalItems };
}

/**
 * Validates raw backup text from uploaded file
 */
export function validateBackupJSON(rawText: string): {
  isValid: boolean;
  error?: string;
  backupPackage?: BackupPackage;
  summaryText?: string;
  totalItems?: number;
} {
  try {
    const parsed = JSON.parse(rawText);
    if (!parsed || typeof parsed !== 'object') {
      return { isValid: false, error: 'Invalid JSON format. Uploaded file is not an object.' };
    }

    if (!parsed.data || typeof parsed.data !== 'object') {
      return { isValid: false, error: 'Invalid backup structure. Missing "data" collection field.' };
    }

    let totalItems = 0;
    const foundCollections: string[] = [];

    for (const [colName, items] of Object.entries(parsed.data)) {
      if (Array.isArray(items)) {
        totalItems += items.length;
        if (items.length > 0) {
          foundCollections.push(`${colName} (${items.length})`);
        }
      }
    }

    if (totalItems === 0 && foundCollections.length === 0) {
      return { 
        isValid: true, 
        backupPackage: parsed as BackupPackage, 
        summaryText: 'Empty backup file (0 documents found).',
        totalItems: 0
      };
    }

    return {
      isValid: true,
      backupPackage: parsed as BackupPackage,
      summaryText: `Found ${totalItems} records across: ${foundCollections.join(', ')}`,
      totalItems
    };
  } catch (err: any) {
    return { isValid: false, error: 'Failed to parse JSON file: ' + err.message };
  }
}

/**
 * Restores backup data into Firestore
 * mode: 'overwrite' deletes existing docs in target collections before restoring
 * mode: 'merge' writes/updates docs without wiping unmentioned collections
 */
export async function restoreBackupData(
  backupPackage: BackupPackage,
  mode: 'overwrite' | 'merge' = 'merge',
  onProgress?: (statusMsg: string, percent: number) => void
): Promise<{ success: boolean; totalRestored: number; message: string }> {
  try {
    const collectionsData = backupPackage.data || {};
    const collectionKeys = Object.keys(collectionsData);
    let totalDocsToRestore = 0;

    for (const colName of collectionKeys) {
      const items = collectionsData[colName];
      if (Array.isArray(items)) {
        totalDocsToRestore += items.length;
      }
    }

    if (totalDocsToRestore === 0) {
      return { success: true, totalRestored: 0, message: 'Backup file contained no items to restore.' };
    }

    let processedCount = 0;

    // STEP 1: Overwrite mode clearing step
    if (mode === 'overwrite') {
      if (onProgress) onProgress('Clearing existing database collections...', 5);
      for (const colName of ALL_COLLECTIONS) {
        try {
          const snapshot = await getDocs(collection(db, colName));
          const deletePromises: Promise<void>[] = [];
          snapshot.forEach((docSnap) => {
            deletePromises.push(deleteDoc(doc(db, colName, docSnap.id)));
          });
          await Promise.all(deletePromises);
        } catch (delErr) {
          console.warn(`[BackupService] Warning clearing collection ${colName}:`, delErr);
        }
      }
    }

    // STEP 2: Restore documents into Firestore
    for (let i = 0; i < collectionKeys.length; i++) {
      const colName = collectionKeys[i];
      const items = collectionsData[colName];

      if (!Array.isArray(items) || items.length === 0) continue;

      if (onProgress) {
        const pct = Math.round(10 + (processedCount / totalDocsToRestore) * 80);
        onProgress(`Restoring collection "${colName}" (${items.length} records)...`, pct);
      }

      for (const item of items) {
        const { _docId, ...fields } = item;
        const deserializedData = deserializeFieldValue(fields);

        const targetDocId = _docId || doc(collection(db, colName)).id;
        const targetRef = doc(db, colName, targetDocId);

        await setDoc(targetRef, deserializedData, { merge: true });
        processedCount++;

        if (onProgress) {
          const pct = Math.round(10 + (processedCount / totalDocsToRestore) * 80);
          onProgress(`Restoring items (${processedCount}/${totalDocsToRestore})...`, pct);
        }
      }
    }

    // STEP 3: Restore local preferences if present
    if (backupPackage.localStorageData) {
      if (onProgress) onProgress('Restoring local preferences...', 95);
      for (const [k, v] of Object.entries(backupPackage.localStorageData)) {
        if (v) {
          localStorage.setItem(k, v);
        }
      }
    }

    if (onProgress) onProgress('Restore completed successfully!', 100);

    return {
      success: true,
      totalRestored: processedCount,
      message: `Successfully restored ${processedCount} records into database!`
    };
  } catch (err: any) {
    console.error('[BackupService] Restore error:', err);
    return {
      success: false,
      totalRestored: 0,
      message: 'Failed to restore backup: ' + (err.message || String(err))
    };
  }
}
