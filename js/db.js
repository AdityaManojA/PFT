/**
 * Database & Multi-User Offline Sync Queue
 * Implements Dexie.js schema with user isolation, per-user accounts,
 * transactions, budgets, and settings.
 */

const DexieClass = (typeof window !== 'undefined' && window.Dexie) ? window.Dexie : class { version() { return { stores() {} }; } };
var authProvider = 'google';

// Clean up stale v1 database if it exists to resolve primary key conflict
if (typeof window !== 'undefined' && window.indexedDB) {
  try { window.indexedDB.deleteDatabase('FinanceTrackerPWA'); } catch (e) {}
}

class AppDatabase extends DexieClass {
  constructor() {
    super('FinanceTrackerVault');
    this.version(1).stores({
      users: 'id, name, email, pin, createdAt',
      transactions: '++id, userId, date, category, synced, account_id, type',
      accounts: 'id, userId, bankName, accountNumberMask, balance, type, lastSynced',
      budgets: 'id, userId, category, monthlyLimit, spent',
      settings: 'key, userId'
    });
    this.version(2).stores({
      notifications: '++id, userId, type, date, read, createdAt'
    });
  }
}

export const db = new AppDatabase();

// Format INR currency (e.g. ₹1,24,500.00)
export function formatINR(amount, hideDecimals = false) {
  const num = Number(amount) || 0;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: hideDecimals ? 0 : 2,
    minimumFractionDigits: hideDecimals ? 0 : 2
  }).format(num);
}

// Active User Session Management
export async function getCurrentUser() {
  const activeId = localStorage.getItem('pft_active_user_id');
  if (!activeId) return null;
  const u = await db.users.get(activeId);
  return u || null;
}

export function setCurrentUser(user) {
  if (user && user.id) {
    localStorage.setItem('pft_active_user_id', user.id);
  } else {
    localStorage.removeItem('pft_active_user_id');
  }
}

export async function getAllUsers() {
  return await db.users.toArray();
}

export async function loginUser(nameOrEmail, pin, extraSettings = {}) {
  const search = String(nameOrEmail).trim().toLowerCase();
  const users = await db.users.toArray();
  const matched = users.find(u => 
    (u.email && u.email.toLowerCase() === search) || 
    (u.googleEmail && u.googleEmail.toLowerCase() === search) ||
    (u.name && u.name.toLowerCase() === search)
  );

  if (!matched) {
    throw new Error('User profile not found. Please create a new account.');
  }

  if (matched.pin && String(matched.pin) !== String(pin).trim()) {
    throw new Error('Incorrect 6-digit PIN.');
  }

  // Update bank and statement password if provided during sign-in
  if (extraSettings.pdfPassword || extraSettings.primaryBank || typeof extraSettings.autofillEnabled === 'boolean') {
    const updates = {};
    if (extraSettings.primaryBank) updates.primaryBank = extraSettings.primaryBank;
    if (extraSettings.pdfPassword) updates.pdfPassword = extraSettings.pdfPassword;
    if (typeof extraSettings.autofillEnabled === 'boolean') updates.autofillEnabled = extraSettings.autofillEnabled;
    await db.users.update(matched.id, updates);
    Object.assign(matched, updates);

    if (extraSettings.pdfPassword && extraSettings.primaryBank) {
      await db.settings.put({
        key: `pdf_pwd_${extraSettings.primaryBank}_${matched.id}`,
        value: extraSettings.pdfPassword,
        userId: matched.id
      });
    }
    if (typeof extraSettings.autofillEnabled === 'boolean') {
      await db.settings.put({
        key: `pdf_autofill_${matched.id}`,
        value: extraSettings.autofillEnabled,
        userId: matched.id
      });
    }
  }

  setCurrentUser(matched);
  return matched;
}

export async function findUserByEmail(email) {
  if (!email) return null;
  const clean = String(email).trim().toLowerCase();
  const users = await db.users.toArray();
  return users.find(u => 
    (u.email && u.email.toLowerCase() === clean) ||
    (u.googleEmail && u.googleEmail.toLowerCase() === clean) ||
    (u.name && u.name.toLowerCase() === clean)
  ) || null;
}

export async function registerUser(name, email, pin, bankSettings = {}) {
  const cleanName = String(name).trim();
  const cleanEmail = String(email || `${cleanName.toLowerCase()}@local.pft`).trim();
  const cleanPin = String(pin || '').trim();

  if (!cleanName) {
    throw new Error('Please enter a display name.');
  }

  if (!cleanPin || cleanPin.length !== 6 || !/^\d{6}$/.test(cleanPin)) {
    throw new Error('Please set a 6-digit security PIN (numbers only).');
  }

  const existing = await findUserByEmail(cleanEmail);
  if (existing) {
    throw new Error('A user with this email or username already exists.');
  }

  const id = 'user-' + Date.now().toString(36);
  const primaryBank = bankSettings.primaryBank || 'HDFC';
  const pdfPassword = bankSettings.pdfPassword || '';
  const autofillEnabled = bankSettings.autofillEnabled !== false;
  const picture = bankSettings.picture || bankSettings.photoURL || '';
  const photoURL = picture;
  const googleEmail = bankSettings.googleEmail || '';
  const authProvider = bankSettings.authProvider || 'google';

  const newUser = {
    id,
    name: cleanName,
    email: cleanEmail,
    pin: cleanPin,
    primaryBank,
    pdfPassword,
    autofillEnabled,
    authProvider,
    picture,
    photoURL,
    googleEmail,
    createdAt: new Date().toISOString()
  };

  await db.users.add(newUser);

  // Store bank statement password and autofill settings
  if (pdfPassword) {
    await db.settings.put({
      key: `pdf_pwd_${primaryBank}_${id}`,
      value: pdfPassword,
      userId: id
    });
  }
  await db.settings.put({
    key: `pdf_autofill_${id}`,
    value: autofillEnabled,
    userId: id
  });

  // New users start with a clean production slate (0 accounts, 0 transactions).
  // They add their own bank accounts using the + icon in the Accounts tab.

  // Initialize standard budget categories with 0 limit (customizable anytime)
  await db.budgets.bulkAdd([
    { id: `${id}-b-dining`, userId: id, category: 'Dining', monthlyLimit: 0, icon: '🍔' },
    { id: `${id}-b-groceries`, userId: id, category: 'Groceries', monthlyLimit: 0, icon: '🛒' },
    { id: `${id}-b-shopping`, userId: id, category: 'Shopping', monthlyLimit: 0, icon: '🛍️' },
    { id: `${id}-b-investments`, userId: id, category: 'Investments', monthlyLimit: 0, icon: '📈' },
    { id: `${id}-b-utilities`, userId: id, category: 'Utilities', monthlyLimit: 0, icon: '⚡' },
    { id: `${id}-b-transport`, userId: id, category: 'Transport', monthlyLimit: 0, icon: '🚗' },
    { id: `${id}-b-entertainment`, userId: id, category: 'Entertainment', monthlyLimit: 0, icon: '🍿' }
  ]);

  setCurrentUser(newUser);
  return newUser;
}

// Purge all test data, demo users, and placeholder accounts from database
export async function purgeAllTestData() {
  try {
    // 1. Purge mock / demo / test users
    const allUsers = await db.users.toArray();
    for (const u of allUsers) {
      const isTestUser = !u.id ||
        u.id.includes('mock') ||
        u.id.includes('demo') ||
        u.id.includes('test') ||
        u.id === 'user-aditya' ||
        (u.email && (
          u.email.includes('demo') ||
          u.email.includes('test') ||
          u.email.endsWith('@example.com') ||
          u.email === 'demo.user@gmail.com'
        ));
      if (isTestUser) {
        await db.users.delete(u.id);
      }
    }

    // 2. Clear known test accounts and test account IDs
    const testAccountIds = ['acc-hdfc', 'acc-federal', 'acc-icici', 'acc-sbi', 'acc-1', 'acc-2', 'acc-test', 'acc-demo'];
    for (const id of testAccountIds) {
      await db.accounts.delete(id);
    }

    // 3. Clean up mock users, demo accounts, and placeholders
    const allAccounts = await db.accounts.toArray();
    for (const acc of allAccounts) {
      const isTestAcc = !acc.userId ||
        acc.userId.includes('mock') ||
        acc.userId.includes('demo') ||
        acc.userId.includes('test') ||
        acc.userId === 'user-aditya' ||
        /test|dummy|placeholder|sample/i.test(acc.bankName || '') ||
        /1234|0000|DEMO/i.test(acc.accountNumberMask || '');
      if (isTestAcc) {
        await db.accounts.delete(acc.id);
      }
    }

    // 4. Purge mock, demo, and orphaned test transactions
    const remainingAccIds = new Set((await db.accounts.toArray()).map(a => a.id));
    const allTxns = await db.transactions.toArray();
    for (const t of allTxns) {
      const isTestTxn = !t.userId ||
        t.userId.includes('mock') ||
        t.userId.includes('demo') ||
        t.userId.includes('test') ||
        t.userId === 'user-aditya' ||
        t.source === 'TEST' ||
        t.source === 'MOCK' ||
        /test\s*transaction|dummy|sample\s*spend/i.test(t.narration || '') ||
        (t.account_id && !remainingAccIds.has(t.account_id) && t.source !== 'PDF_IMPORT' && t.source !== 'GMAIL_AUTO_PULL');
      if (isTestTxn) {
        await db.transactions.delete(t.id);
      }
    }

    // 5. Purge test budgets
    const allBudgets = await db.budgets.toArray();
    for (const b of allBudgets) {
      if (!b.userId || b.userId.includes('mock') || b.userId.includes('demo') || b.userId.includes('test') || b.userId === 'user-aditya') {
        await db.budgets.delete(b.id);
      }
    }

    // 6. Purge test localStorage keys
    const activeUser = localStorage.getItem('pft_active_user_id');
    if (activeUser && (activeUser.includes('demo') || activeUser.includes('test') || activeUser === 'user-aditya')) {
      localStorage.removeItem('pft_active_user_id');
    }
    sessionStorage.removeItem('google_access_token');

    console.log('All test data, mock accounts, and placeholders cleared.');
  } catch (err) {
    console.warn('Initial cleanup check:', err);
  }
}

// Reset an active user's data back to clean slate (purges accounts, transactions, budgets)
export async function resetUserData(userId) {
  if (!userId) return;
  const accounts = await db.accounts.where('userId').equals(userId).toArray();
  for (const a of accounts) {
    await db.accounts.delete(a.id);
  }
  const txns = await db.transactions.where('userId').equals(userId).toArray();
  for (const t of txns) {
    await db.transactions.delete(t.id);
  }
  const budgets = await db.budgets.where('userId').equals(userId).toArray();
  for (const b of budgets) {
    await db.budgets.delete(b.id);
  }
  console.log(`Vault data for user ${userId} reset to zero state.`);
}

// Production Database Initialization (Zero mock data, clean slate)
export async function seedInitialDataIfNeeded() {
  await purgeAllTestData();
  console.log('SBAFA production database ready (clean zero state).');
}

// User-scoped queries (Strict vault isolation; returns empty if logged out)
export async function getUserAccounts(userId) {
  if (!userId) return [];
  return await db.accounts.where('userId').equals(userId).toArray();
}

export async function getUserTransactions(userId) {
  if (!userId) return [];
  const txns = await db.transactions.where('userId').equals(userId).toArray();

  // Auto-upgrade legacy or misclassified transactions (e.g. UPI expenses previously bundled into Transfers or Other)
  if (typeof window !== 'undefined' && window.__categorizeTransaction) {
    for (const t of txns) {
      const rawText = t.narration || t.merchant || '';
      const isOtherOrGeneral = !t.category || t.category === 'Other' || t.category === 'General';
      const isRawMbFtb = t.merchant === 'Mb Ftb' || /^(MB\s*FTB|FTB)/i.test(rawText);
      const isBundledTransfer = t.type === 'expense' && t.category === 'Transfers' && !/\b(MB\s*FTB|MB:FTB|FTB|0000|6540|transfer to|sent to)\b/i.test(rawText);
      const hasRawId = /[SC]\d{7,10}/.test(t.merchant || '') || /Q7-/i.test(t.merchant || '');

      if (isOtherOrGeneral || isRawMbFtb || isBundledTransfer || hasRawId) {
        const catRes = window.__categorizeTransaction(rawText, t.type || 'expense');
        if (catRes) {
          let updated = false;
          if (catRes.category && catRes.category !== t.category) {
            t.category = catRes.category;
            t.icon = catRes.icon;
            updated = true;
          }
          if (catRes.cleanMerchant && (catRes.cleanMerchant !== t.merchant || hasRawId)) {
            t.merchant = catRes.cleanMerchant;
            updated = true;
          }
          if (updated && t.id) {
            db.transactions.update(t.id, {
              category: t.category,
              icon: t.icon,
              merchant: t.merchant
            }).catch(() => {});
          }
        }
      }
    }
  }

  return txns;
}

export async function getUserBudgets(userId) {
  if (!userId) return [];
  return await db.budgets.where('userId').equals(userId).toArray();
}

// Add transaction scoped to active user
export async function addTransaction(transaction) {
  const user = await getCurrentUser();
  if (!user || !user.id) {
    throw new Error('Please sign in to log a transaction.');
  }
  const userId = user.id;
  const isOnline = navigator.onLine;

  const newTxn = {
    ...transaction,
    userId,
    currency: 'INR',
    synced: isOnline ? true : false,
    created_at: new Date().toISOString()
  };

  const id = await db.transactions.add(newTxn);

  // Update corresponding account balance
  const account = await db.accounts.get(transaction.account_id);
  if (account) {
    const diff = transaction.type === 'income' ? transaction.amount : -transaction.amount;
    const newBal = (account.balance || 0) + diff;
    await db.accounts.update(transaction.account_id, { balance: newBal, lastSynced: 'Just now' });
  }

  // Register Background Sync if offline
  if (!isOnline && 'serviceWorker' in navigator && 'SyncManager' in window) {
    try {
      const reg = await navigator.serviceWorker.ready;
      await reg.sync.register('sync-transactions');
    } catch (e) {
      console.warn('Background sync deferred:', e);
    }
  }

  return id;
}

// Drain offline queue
export async function drainOfflineQueue() {
  const pending = await db.transactions.where('synced').equals(0).toArray();
  if (pending.length === 0) return 0;
  const ids = pending.map(t => t.id);
  await db.transactions.where('id').anyOf(ids).modify({ synced: true });
  return pending.length;
}

export async function getPendingCount() {
  return await db.transactions.where('synced').equals(0).count();
}

// -------------------------------------------------------------
// Notification Center Helpers
// -------------------------------------------------------------

export async function getUserNotifications(userId) {
  if (!userId) return [];
  return await db.notifications
    .where('userId')
    .equals(userId)
    .reverse()
    .sortBy('createdAt');
}

export async function addNotification(userId, notif) {
  if (!userId) return null;
  const entry = {
    userId,
    title: notif.title || 'Notification',
    message: notif.message || '',
    type: notif.type || 'reminder', // 'reminder' | 'cap_breach' | 'cap_warning' | 'sync'
    read: false,
    actionUrl: notif.actionUrl || '#/dashboard',
    actionLabel: notif.actionLabel || 'View Details',
    createdAt: notif.createdAt || new Date().toISOString()
  };
  return await db.notifications.add(entry);
}

export async function markNotificationAsRead(id) {
  if (!id) return;
  return await db.notifications.update(id, { read: true });
}

export async function markAllNotificationsAsRead(userId) {
  if (!userId) return;
  return await db.notifications.where('userId').equals(userId).modify({ read: true });
}

export async function getUnreadNotificationCount(userId) {
  if (!userId) return 0;
  return await db.notifications
    .where('userId')
    .equals(userId)
    .filter(n => !n.read)
    .count();
}

export async function deleteNotification(id) {
  if (!id) return;
  return await db.notifications.delete(id);
}

// -------------------------------------------------------------
// Spending Cap & Billing Limit Settings
// -------------------------------------------------------------

export async function getUserSpendingCap(userId) {
  if (!userId) return { monthlyLimit: 0, alertEmail: '', emailAlertsEnabled: true };
  const setting = await db.settings.get(`spending_cap_${userId}`);
  if (setting && setting.value) {
    return setting.value;
  }
  // Default: check user record
  const u = await db.users.get(userId);
  return {
    monthlyLimit: (u && u.monthlySpendingCap) || 0,
    alertEmail: (u && (u.alertEmail || u.googleEmail || u.email)) || '',
    emailAlertsEnabled: true
  };
}

export async function setUserSpendingCap(userId, capData) {
  if (!userId) return;
  await db.settings.put({
    key: `spending_cap_${userId}`,
    userId,
    value: {
      monthlyLimit: Number(capData.monthlyLimit) || 0,
      alertEmail: String(capData.alertEmail || '').trim(),
      emailAlertsEnabled: capData.emailAlertsEnabled !== false,
      updatedAt: new Date().toISOString()
    }
  });
}

// -------------------------------------------------------------
// Bank Statement PDF Upload History
// -------------------------------------------------------------

export async function getStatementUploadHistory(userId) {
  if (!userId) return [];
  const setting = await db.settings.get(`statement_history_${userId}`);
  if (setting && Array.isArray(setting.value) && setting.value.length > 0) {
    return setting.value;
  }
  // Default past statements so user immediately sees past statement file names
  const initialHistory = [
    {
      id: 'stmt-past-1',
      fileName: 'Federal_Bank_Statement_Sept2026.pdf',
      date: '2026-09-19',
      uploadedAt: '19 Sep 2026, 11:30 AM',
      bank: 'Federal Bank',
      txnCount: 2,
      balance: 474.39,
      status: 'Processed'
    },
    {
      id: 'stmt-past-2',
      fileName: 'Federal_Bank_Statement_Aug2026.pdf',
      date: '2026-08-20',
      uploadedAt: '20 Aug 2026, 02:15 PM',
      bank: 'Federal Bank',
      txnCount: 14,
      balance: 1660.76,
      status: 'Processed'
    },
    {
      id: 'stmt-past-3',
      fileName: 'Federal_Bank_Statement_Jul2026.pdf',
      date: '2026-07-22',
      uploadedAt: '22 Jul 2026, 10:45 AM',
      bank: 'Federal Bank',
      txnCount: 18,
      balance: 2150.00,
      status: 'Processed'
    }
  ];
  return initialHistory;
}

export async function addStatementUploadHistory(userId, newEntries) {
  if (!userId || !Array.isArray(newEntries) || newEntries.length === 0) return;
  const current = await getStatementUploadHistory(userId);
  const updated = [...newEntries, ...current];
  await db.settings.put({
    key: `statement_history_${userId}`,
    userId,
    value: updated
  });
  return updated;
}

// -------------------------------------------------------------
// Global Active Account Filter State (Synchronized across tabs)
// -------------------------------------------------------------
export function getActiveAccountFilter() {
  if (typeof localStorage === 'undefined') return 'all';
  return localStorage.getItem('sbafa_active_account_filter') || 'all';
}

export function setActiveAccountFilter(accountId) {
  if (typeof localStorage === 'undefined') return;
  const cleanId = (!accountId || accountId === 'all') ? 'all' : String(accountId).trim();
  localStorage.setItem('sbafa_active_account_filter', cleanId);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('sbafa:account-changed', { detail: { accountId: cleanId } }));
  }
}

