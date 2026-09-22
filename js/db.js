/**
 * Database & Multi-User Offline Sync Queue
 * Implements Dexie.js schema with user isolation, per-user accounts,
 * transactions, budgets, and settings.
 */

const DexieClass = window.Dexie;

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
  return users.find(u => u.email && u.email.toLowerCase() === clean) || null;
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

  const existing = await db.users.where('email').equals(cleanEmail).first();
  if (existing) {
    throw new Error('A user with this email or username already exists.');
  }

  const id = 'user-' + Date.now().toString(36);
  const primaryBank = bankSettings.primaryBank || 'HDFC';
  const pdfPassword = bankSettings.pdfPassword || '';
  const autofillEnabled = bankSettings.autofillEnabled !== false;
  const authProvider = bankSettings.authProvider || 'local';
  const picture = bankSettings.picture || '';

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

// Production Database Initialization (Zero mock data, clean slate)
export async function seedInitialDataIfNeeded() {
  // Purge any development mock/dummy data if present on client
  try {
    const legacyAditya = await db.users.get('user-aditya');
    if (legacyAditya) {
      await db.users.delete('user-aditya');
      await db.accounts.where('userId').equals('user-aditya').delete();
      await db.transactions.where('userId').equals('user-aditya').delete();
      await db.budgets.where('userId').equals('user-aditya').delete();
      if (localStorage.getItem('pft_active_user_id') === 'user-aditya') {
        localStorage.removeItem('pft_active_user_id');
      }
      console.log('Legacy development mock data cleared.');
    }
  } catch (err) {
    console.warn('Initial cleanup check:', err);
  }

  console.log('SBAFA production database ready (clean zero state).');
}

// User-scoped queries (Strict vault isolation; returns empty if logged out)
export async function getUserAccounts(userId) {
  if (!userId) return [];
  return await db.accounts.where('userId').equals(userId).toArray();
}

export async function getUserTransactions(userId) {
  if (!userId) return [];
  return await db.transactions.where('userId').equals(userId).toArray();
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
