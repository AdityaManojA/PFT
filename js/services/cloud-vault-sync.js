/**
 * Cloud Vault Synchronization Service
 * Enables seamless cross-platform data synchronization across devices (Mobile, PC, Tablet)
 * via Firebase Cloud Firestore while maintaining 100% offline-first IndexedDB performance.
 */

import { db, getCurrentUser, getStatementUploadHistory, addStatementUploadHistory, setCurrentUser } from '../db.js';
import { FirebaseAuthService } from '../auth.js';

let firestoreInstance = null;
let firestoreSdk = null;
let syncDebounceTimer = null;
let syncSafetyTimer = null;
let activeSnapshotUnsubscribe = null;
export let isSyncing = false;

// Safety: auto-reset isSyncing after 30s if stuck (e.g. app backgrounded on iOS mid-sync)
function startSyncSafetyTimer() {
  if (syncSafetyTimer) clearTimeout(syncSafetyTimer);
  syncSafetyTimer = setTimeout(() => {
    if (isSyncing) {
      console.warn('[CloudVaultSync] Safety reset: isSyncing was stuck for 30s, forcing reset.');
      isSyncing = false;
    }
  }, 30000);
}
function clearSyncSafetyTimer() {
  if (syncSafetyTimer) { clearTimeout(syncSafetyTimer); syncSafetyTimer = null; }
}

export class CloudVaultSyncService {
  /**
   * Lazily import and initialize Firebase Firestore
   */
  static async getFirestore() {
    if (firestoreInstance && firestoreSdk) {
      return { firestore: firestoreInstance, sdk: firestoreSdk };
    }

    try {
      const { auth } = await FirebaseAuthService.getAuth();
      const app = auth.app;
      firestoreSdk = await import('https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js');
      firestoreInstance = firestoreSdk.getFirestore(app);
      return { firestore: firestoreInstance, sdk: firestoreSdk };
    } catch (err) {
      console.warn('[CloudVaultSync] Firestore initialization deferred:', err.message);
      return null;
    }
  }

  /**
   * Derive a clean, consistent vault key for the user
   */
  static getVaultKey(user) {
    if (!user) return null;
    const raw = user.googleEmail || user.email || user.id || '';
    return raw.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '_');
  }

  /**
   * Pull Cloud Vault data and merge into local IndexedDB
   * Resolves conflicts by upserting missing records and syncing statement history
   */
  static async pullCloudVault(user) {
    if (isSyncing) return { success: false, reason: 'Sync in progress' };
    if (!user) user = await getCurrentUser();
    if (!user) return { success: false, reason: 'No active user' };

    const vaultKey = this.getVaultKey(user);
    if (!vaultKey) return { success: false, reason: 'Invalid vault key' };

    const firestoreData = await this.getFirestore();
    if (!firestoreData) return { success: false, reason: 'Firestore not available' };

    const { firestore, sdk } = firestoreData;

    isSyncing = true;
    startSyncSafetyTimer();
    try {
      const vaultRef = sdk.doc(firestore, 'vaults', vaultKey);
      const snap = await sdk.getDoc(vaultRef);

      if (!snap.exists()) {
        console.log(`[CloudVaultSync] No existing cloud vault for ${vaultKey}. Pushing initial local state...`);
        await this.pushLocalVault(user);
        return { success: true, count: 0, initial: true };
      }

      const remoteData = snap.data() || {};
      const remoteAccounts = remoteData.accounts || [];
      const remoteTxns = remoteData.transactions || [];
      const remoteBudgets = remoteData.budgets || [];
      const remoteHistory = remoteData.statementHistory || [];
      const remoteProfile = remoteData.profile || {};

      let addedAccounts = 0;
      let addedTxns = 0;

      // 1. Merge Accounts
      const localAccounts = await db.accounts.where('userId').equals(user.id).toArray();
      const localAccMap = new Map();
      localAccounts.forEach(a => {
        localAccMap.set(String(a.id), a);
        if (a.accountNumberLast4) {
          localAccMap.set(`${(a.bankName || '').toUpperCase()}_${a.accountNumberLast4}`, a);
        }
      });

      for (const rAcc of remoteAccounts) {
        if (!rAcc) continue;
        try {
          const accId = rAcc.id || `acc-${user.id}-${(rAcc.bankName || 'bank').toLowerCase().replace(/[^a-z0-9]/g, '')}-${rAcc.accountNumberLast4 || Date.now().toString(36)}`;
          const keyId = String(accId);
          const keyBank = rAcc.accountNumberLast4 ? `${(rAcc.bankName || '').toUpperCase()}_${rAcc.accountNumberLast4}` : null;

          const existing = localAccMap.get(keyId) || (keyBank ? localAccMap.get(keyBank) : null);
          if (!existing) {
            const newAcc = { ...rAcc, id: accId, userId: user.id };
            await db.accounts.put(newAcc);
            localAccMap.set(keyId, newAcc);
            addedAccounts++;
          } else {
            // If remote balance has more recent timestamp, update
            const remoteTime = new Date(rAcc.lastSynced || 0).getTime();
            const localTime = new Date(existing.lastSynced || 0).getTime();
            if (remoteTime > localTime || (existing.balance === 0 && rAcc.balance > 0)) {
              await db.accounts.update(existing.id, {
                balance: rAcc.balance,
                accountNumberMask: rAcc.accountNumberMask || existing.accountNumberMask,
                accountNumberLast4: rAcc.accountNumberLast4 || existing.accountNumberLast4,
                lastSynced: rAcc.lastSynced || existing.lastSynced
              });
            }
          }
        } catch (accErr) {
          console.warn('[CloudVaultSync] Skipped account merge error:', accErr);
        }
      }

      // 2. Merge Transactions
      const localTxns = await db.transactions.where('userId').equals(user.id).toArray();
      const localTxnSignatures = new Set(
        localTxns.map(t => `${t.date}_${Number(t.amount)}_${(t.narration || t.merchant || '').toLowerCase()}`)
      );

      const txnsToInsert = [];
      for (const rTxn of remoteTxns) {
        if (!rTxn) continue;
        const sig = `${rTxn.date}_${Number(rTxn.amount)}_${(rTxn.narration || rTxn.merchant || '').toLowerCase()}`;
        if (!localTxnSignatures.has(sig)) {
          const { id, ...txnData } = rTxn; // Allow auto-increment ID locally
          txnsToInsert.push({
            ...txnData,
            userId: user.id,
            synced: true
          });
          localTxnSignatures.add(sig);
          addedTxns++;
        }
      }

      if (txnsToInsert.length > 0) {
        try {
          await db.transactions.bulkAdd(txnsToInsert);
        } catch (txnBulkErr) {
          console.warn('[CloudVaultSync] bulkAdd failed, falling back to individual inserts:', txnBulkErr);
          for (const item of txnsToInsert) {
            try {
              await db.transactions.add(item);
            } catch (singleTxnErr) {
              // Ignore duplicate or corrupted item
            }
          }
        }
      }

      // 3. Merge Budgets
      for (const rBudget of remoteBudgets) {
        if (!rBudget || !rBudget.category) continue;
        try {
          const localBudget = await db.budgets.where('userId').equals(user.id)
            .filter(b => b.category === rBudget.category)
            .first();
          const budgetId = rBudget.id || `${user.id}-b-${String(rBudget.category).toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
          if (!localBudget) {
            await db.budgets.add({
              id: budgetId,
              userId: user.id,
              category: rBudget.category,
              monthlyLimit: Number(rBudget.monthlyLimit) || 0,
              spent: Number(rBudget.spent) || 0,
              icon: rBudget.icon || ''
            });
          } else if (rBudget.monthlyLimit > 0 && localBudget.monthlyLimit === 0) {
            await db.budgets.update(localBudget.id, { monthlyLimit: rBudget.monthlyLimit });
          }
        } catch (bErr) {
          console.warn('[CloudVaultSync] Skipped budget item merge error:', bErr);
        }
      }

      // 4. Merge Statement Upload History
      if (remoteHistory.length > 0) {
        try {
          const localHistory = await getStatementUploadHistory(user.id);
          const existingFileNames = new Set(localHistory.map(h => (h.fileName || '').toLowerCase()));
          const missingEntries = remoteHistory.filter(h => !existingFileNames.has((h.fileName || '').toLowerCase()));
          if (missingEntries.length > 0) {
            await addStatementUploadHistory(user.id, missingEntries);
          }
        } catch (hErr) {
          console.warn('[CloudVaultSync] Skipped history merge error:', hErr);
        }
      }

      // 5. Update user profile details if remote is richer
      if (remoteProfile.picture && (!user.picture || user.picture !== remoteProfile.picture)) {
        await db.users.update(user.id, {
          picture: remoteProfile.picture,
          photoURL: remoteProfile.picture
        });
        user.picture = remoteProfile.picture;
      }

      console.log(`[CloudVaultSync] Pull complete: +${addedAccounts} accounts, +${addedTxns} transactions merged from cloud.`);
      
      // Notify UI
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('sbafa:cloud-vault-synced', {
          detail: { addedAccounts, addedTxns, totalAccounts: remoteAccounts.length, totalTxns: remoteTxns.length }
        }));
      }

      return { success: true, addedAccounts, addedTxns };
    } catch (err) {
      console.log('[CloudVaultSync] Cloud vault pull deferred:', err.message);
      return { success: false, error: err.message };
    } finally {
      isSyncing = false;
      clearSyncSafetyTimer();
    }
  }

  /**
   * Push all local vault data to Cloud Firestore for this user
   */
  static async pushLocalVault(user) {
    if (!user) user = await getCurrentUser();
    if (!user) return { success: false, reason: 'No active user' };

    const vaultKey = this.getVaultKey(user);
    if (!vaultKey) return { success: false, reason: 'Invalid vault key' };

    const firestoreData = await this.getFirestore();
    if (!firestoreData) return { success: false, reason: 'Firestore not available' };

    const { firestore, sdk } = firestoreData;

    try {
      const accounts = await db.accounts.where('userId').equals(user.id).toArray();
      const transactions = await db.transactions.where('userId').equals(user.id).toArray();
      const budgets = await db.budgets.where('userId').equals(user.id).toArray();
      const statementHistory = await getStatementUploadHistory(user.id);

      const payload = {
        vaultKey,
        updatedAt: new Date().toISOString(),
        profile: {
          userId: user.id,
          name: user.name || '',
          email: (user.email || '').toLowerCase(),
          googleEmail: (user.googleEmail || '').toLowerCase(),
          primaryBank: user.primaryBank || 'HDFC',
          picture: user.picture || user.photoURL || ''
        },
        accounts: accounts.map(a => ({
          id: a.id,
          bankName: a.bankName,
          accountNumberMask: a.accountNumberMask,
          accountNumberLast4: a.accountNumberLast4 || '',
          balance: a.balance || 0,
          type: a.type || 'savings',
          lastSynced: a.lastSynced || 'Just now'
        })),
        transactions: transactions.map(t => ({
          date: t.date,
          amount: Number(t.amount) || 0,
          type: t.type || 'expense',
          category: t.category || 'General',
          merchant: t.merchant || '',
          narration: t.narration || '',
          icon: t.icon || '',
          account_id: t.account_id || '',
          source: t.source || 'MANUAL'
        })),
        budgets: budgets.map(b => ({
          id: b.id || `${user.id}-b-${String(b.category || 'misc').toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
          category: b.category,
          monthlyLimit: Number(b.monthlyLimit) || 0,
          spent: Number(b.spent) || 0,
          icon: b.icon || ''
        })),
        statementHistory: statementHistory.map(h => ({
          id: h.id,
          fileName: h.fileName,
          date: h.date,
          uploadedAt: h.uploadedAt,
          bank: h.bank,
          txnCount: h.txnCount,
          balance: h.balance,
          status: h.status
        }))
      };

      const vaultRef = sdk.doc(firestore, 'vaults', vaultKey);
      await sdk.setDoc(vaultRef, payload, { merge: true });

      console.log(`[CloudVaultSync] Pushed ${accounts.length} accounts & ${transactions.length} txns to cloud vault.`);
      return { success: true };
    } catch (err) {
      console.warn('[CloudVaultSync] Failed to push local vault to cloud:', err.message);
      return { success: false, error: err.message };
    }
  }

  /**
   * Schedule a debounced push to cloud whenever local data changes
   */
  static scheduleCloudPush(delayMs = 600) {
    if (isSyncing) return;
    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(async () => {
      if (isSyncing) return;
      const user = await getCurrentUser();
      if (user && typeof navigator !== 'undefined' && navigator.onLine) {
        await CloudVaultSyncService.pushLocalVault(user);
      }
    }, delayMs);
  }

  /**
   * Stop any active Firestore realtime snapshot subscription
   */
  static stopRealtimeSync() {
    if (activeSnapshotUnsubscribe) {
      try {
        activeSnapshotUnsubscribe();
      } catch (e) {}
      activeSnapshotUnsubscribe = null;
    }
  }

  /**
   * Subscribe to real-time snapshot updates on this user's vault
   * When another device imports a statement or adds an account, this device syncs automatically!
   */
  static async initRealtimeSync(user, onRemoteUpdate) {
    if (!user) user = await getCurrentUser();
    if (!user) return;

    const vaultKey = this.getVaultKey(user);
    if (!vaultKey) return;

    this.stopRealtimeSync();

    const firestoreData = await this.getFirestore();
    if (!firestoreData) return;

    const { firestore, sdk } = firestoreData;
    const vaultRef = sdk.doc(firestore, 'vaults', vaultKey);

    activeSnapshotUnsubscribe = sdk.onSnapshot(vaultRef, async (snap) => {
      if (snap.exists() && !snap.metadata.hasPendingWrites && !isSyncing) {
        // Trigger pull & refresh for any remote change (new records OR balance/budget updates)
        const res = await CloudVaultSyncService.pullCloudVault(user);
        if (res.success) {
          if (onRemoteUpdate) onRemoteUpdate(res);
        }
      }
    }, (err) => {
      console.log('[CloudVaultSync] Realtime snapshot listener paused:', err.message);
    });
  }

  /**
   * Restore a user's vault on a new device using their Google email.
   * Called when Google sign-in succeeds but no local Dexie record exists.
   * Reconstructs the user profile from Firestore and pulls all data.
   * Returns the restored user object, or null if no cloud vault found.
   */
  static async restoreFromCloudVault(googleEmail, googleProfile = {}) {
    if (!googleEmail) return null;

    const rawKey = googleEmail.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, '_');
    if (!rawKey) return null;

    const firestoreData = await this.getFirestore();
    if (!firestoreData) return null;

    const { firestore, sdk } = firestoreData;

    try {
      const vaultRef = sdk.doc(firestore, 'vaults', rawKey);
      const snap = await sdk.getDoc(vaultRef);

      if (!snap.exists()) {
        console.log(`[CloudVaultSync] No existing vault for ${rawKey} — first time on this device.`);
        return null;
      }

      const remoteData = snap.data() || {};
      const remoteProfile = remoteData.profile || {};
      const remoteAccounts = remoteData.accounts || [];
      const remoteTxns = remoteData.transactions || [];
      const remoteBudgets = remoteData.budgets || [];
      const remoteHistory = remoteData.statementHistory || [];

      // Reconstruct a local user from the cloud profile
      // Prefer the userId stored in the vault (set when account was originally created),
      // so data keys are exactly the same as on the original device.
      const stableId = remoteProfile.userId || ('user-' + rawKey.replace(/[^a-z0-9]/g, '').substring(0, 16));

      const restoredUser = {
        id: stableId,
        name: googleProfile.name || remoteProfile.name || googleEmail.split('@')[0],
        email: remoteProfile.email || googleEmail,
        googleEmail: googleEmail,
        pin: remoteProfile.pin || '', // PIN is intentionally not stored in cloud; user will need to set one
        primaryBank: remoteProfile.primaryBank || 'HDFC',
        picture: googleProfile.picture || remoteProfile.picture || '',
        photoURL: googleProfile.picture || remoteProfile.picture || '',
        authProvider: 'google',
        autofillEnabled: true,
        restoredFromCloud: true,
        createdAt: remoteData.updatedAt || new Date().toISOString()
      };

      // Check if a user with this stable ID or email already exists (race condition guard)
      const existing = await db.users.get(stableId);
      if (existing) {
        // User already exists locally — just update picture and return
        if (googleProfile.picture && existing.picture !== googleProfile.picture) {
          await db.users.update(stableId, {
            picture: googleProfile.picture,
            photoURL: googleProfile.picture
          });
          existing.picture = googleProfile.picture;
          existing.photoURL = googleProfile.picture;
        }
        return existing;
      }

      // Save the restored user to local IndexedDB
      await db.users.put(restoredUser);

      // Seed default budgets if none in cloud
      if (remoteBudgets.length === 0) {
        await db.budgets.bulkAdd([
          { id: `${stableId}-b-dining`, userId: stableId, category: 'Dining', monthlyLimit: 0, icon: '🍔' },
          { id: `${stableId}-b-groceries`, userId: stableId, category: 'Groceries', monthlyLimit: 0, icon: '🛒' },
          { id: `${stableId}-b-shopping`, userId: stableId, category: 'Shopping', monthlyLimit: 0, icon: '🛍️' },
          { id: `${stableId}-b-investments`, userId: stableId, category: 'Investments', monthlyLimit: 0, icon: '📈' },
          { id: `${stableId}-b-utilities`, userId: stableId, category: 'Utilities', monthlyLimit: 0, icon: '⚡' },
          { id: `${stableId}-b-transport`, userId: stableId, category: 'Transport', monthlyLimit: 0, icon: '🚗' },
          { id: `${stableId}-b-entertainment`, userId: stableId, category: 'Entertainment', monthlyLimit: 0, icon: '🍿' }
        ]);
      }

      // Pull accounts
      for (const rAcc of remoteAccounts) {
        if (!rAcc) continue;
        const accId = rAcc.id || `acc-${stableId}-${(rAcc.bankName || 'bank').toLowerCase().replace(/[^a-z0-9]/g, '')}-${rAcc.accountNumberLast4 || Date.now().toString(36)}`;
        try {
          await db.accounts.put({ ...rAcc, id: accId, userId: stableId });
        } catch (accErr) {
          console.warn('[CloudVaultSync] Restore account error:', accErr);
        }
      }

      // Pull transactions
      if (remoteTxns.length > 0) {
        const txnsToInsert = remoteTxns.map(t => {
          const { id, ...rest } = t;
          return { ...rest, userId: stableId, synced: true };
        });
        try {
          await db.transactions.bulkAdd(txnsToInsert);
        } catch (e) {
          for (const item of txnsToInsert) {
            try { await db.transactions.add(item); } catch (tErr) {}
          }
        }
      }

      // Pull budgets
      for (const rBudget of remoteBudgets) {
        if (!rBudget || !rBudget.category) continue;
        const budgetId = rBudget.id || `${stableId}-b-${String(rBudget.category).toLowerCase().replace(/[^a-z0-9]/g, '-')}`;
        try {
          await db.budgets.put({
            id: budgetId,
            userId: stableId,
            category: rBudget.category,
            monthlyLimit: Number(rBudget.monthlyLimit) || 0,
            spent: Number(rBudget.spent) || 0,
            icon: rBudget.icon || ''
          });
        } catch (bErr) {
          console.warn('[CloudVaultSync] Restore budget error:', bErr);
        }
      }

      // Pull statement history
      if (remoteHistory.length > 0) {
        try { await addStatementUploadHistory(stableId, remoteHistory); } catch (e) {}
      }

      console.log(`[CloudVaultSync] Restored vault: ${remoteAccounts.length} accounts, ${remoteTxns.length} txns from cloud for ${googleEmail}.`);
      return restoredUser;
    } catch (err) {
      console.warn('[CloudVaultSync] restoreFromCloudVault failed:', err.message);
      return null;
    }
  }
}

if (typeof window !== 'undefined') {
  window.CloudVaultSyncService = CloudVaultSyncService;
}

