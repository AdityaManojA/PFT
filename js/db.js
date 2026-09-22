/**
 * Database & Multi-User Offline Sync Queue
 * Implements Dexie.js schema with user isolation, per-user accounts,
 * transactions, budgets, and settings.
 */

const DexieClass = window.Dexie;

class AppDatabase extends DexieClass {
  constructor() {
    super('FinanceTrackerPWA');
    this.version(2).stores({
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
  if (activeId) {
    const u = await db.users.get(activeId);
    if (u) return u;
  }
  // Return the first available user or null
  const first = await db.users.toCollection().first();
  if (first) {
    localStorage.setItem('pft_active_user_id', first.id);
    return first;
  }
  return null;
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

export async function loginUser(nameOrEmail, pin) {
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
    throw new Error('Incorrect 4-digit PIN.');
  }

  setCurrentUser(matched);
  return matched;
}

export async function registerUser(name, email, pin) {
  const cleanName = String(name).trim();
  const cleanEmail = String(email || `${cleanName.toLowerCase()}@local.pft`).trim();
  const cleanPin = String(pin || '1234').trim();

  if (!cleanName) {
    throw new Error('Please enter a display name.');
  }

  const existing = await db.users.where('email').equals(cleanEmail).first();
  if (existing) {
    throw new Error('A user with this email or username already exists.');
  }

  const id = 'user-' + Date.now().toString(36);
  const newUser = {
    id,
    name: cleanName,
    email: cleanEmail,
    pin: cleanPin,
    createdAt: new Date().toISOString()
  };

  await db.users.add(newUser);

  // New users start with a clean slate (0 accounts, 0 transactions).
  // They add their own bank accounts using the + icon in the Accounts tab!

  // Seed default budgets for new user
  await db.budgets.bulkAdd([
    { id: `${id}-b-dining`, userId: id, category: 'Dining', monthlyLimit: 10000, icon: '🍔' },
    { id: `${id}-b-groceries`, userId: id, category: 'Groceries', monthlyLimit: 12000, icon: '🛒' },
    { id: `${id}-b-shopping`, userId: id, category: 'Shopping', monthlyLimit: 8000, icon: '🛍️' },
    { id: `${id}-b-investments`, userId: id, category: 'Investments', monthlyLimit: 20000, icon: '📈' },
    { id: `${id}-b-utilities`, userId: id, category: 'Utilities', monthlyLimit: 5000, icon: '⚡' },
    { id: `${id}-b-transport`, userId: id, category: 'Transport', monthlyLimit: 4000, icon: '🚗' },
    { id: `${id}-b-entertainment`, userId: id, category: 'Entertainment', monthlyLimit: 3000, icon: '🍿' }
  ]);

  setCurrentUser(newUser);
  return newUser;
}

// Initial Seed Data for Default User
export async function seedInitialDataIfNeeded() {
  const usersCount = await db.users.count();
  const defaultUserId = 'user-aditya';

  if (usersCount === 0) {
    console.log('Seeding default user profile (Aditya)...');
    await db.users.add({
      id: defaultUserId,
      name: 'Aditya',
      email: 'aditya@pft.local',
      pin: '1234',
      createdAt: new Date().toISOString()
    });
    localStorage.setItem('pft_active_user_id', defaultUserId);
  }

  const accountsCount = await db.accounts.count();
  if (accountsCount === 0) {
    console.log('Seeding initial accounts for default user...');
    await db.accounts.bulkAdd([
      {
        id: 'hdfc-4921',
        userId: defaultUserId,
        bankName: 'HDFC Bank',
        accountNumberMask: '•••• 4921',
        accountType: 'Savings Account',
        balance: 124510.50,
        bankCode: 'HDFC',
        lastSynced: 'Just now'
      },
      {
        id: 'federal-8812',
        userId: defaultUserId,
        bankName: 'Federal Bank',
        accountNumberMask: '•••• 8812',
        accountType: 'FedNet Savings',
        balance: 48210.00,
        bankCode: 'FEDERAL',
        lastSynced: '10 mins ago'
      },
      {
        id: 'icici-3104',
        userId: defaultUserId,
        bankName: 'ICICI Bank',
        accountNumberMask: '•••• 3104',
        accountType: 'Salary Account',
        balance: 65400.00,
        bankCode: 'ICICI',
        lastSynced: '1 hour ago'
      },
      {
        id: 'cash-wallet',
        userId: defaultUserId,
        bankName: 'Cash Wallet',
        accountNumberMask: 'Physical Cash',
        accountType: 'Wallet',
        balance: 3850.00,
        bankCode: 'CASH',
        lastSynced: 'Manual'
      }
    ]);

    await db.budgets.bulkAdd([
      { id: `${defaultUserId}-b-dining`, userId: defaultUserId, category: 'Dining', monthlyLimit: 12000, icon: '🍔' },
      { id: `${defaultUserId}-b-groceries`, userId: defaultUserId, category: 'Groceries', monthlyLimit: 15000, icon: '🛒' },
      { id: `${defaultUserId}-b-shopping`, userId: defaultUserId, category: 'Shopping', monthlyLimit: 10000, icon: '🛍️' },
      { id: `${defaultUserId}-b-investments`, userId: defaultUserId, category: 'Investments', monthlyLimit: 30000, icon: '📈' },
      { id: `${defaultUserId}-b-utilities`, userId: defaultUserId, category: 'Utilities', monthlyLimit: 6000, icon: '⚡' },
      { id: `${defaultUserId}-b-transport`, userId: defaultUserId, category: 'Transport', monthlyLimit: 5000, icon: '🚗' },
      { id: `${defaultUserId}-b-entertainment`, userId: defaultUserId, category: 'Entertainment', monthlyLimit: 4000, icon: '🍿' }
    ]);

    // Seed realistic transactions
    const now = new Date();
    const getISO = (daysAgo) => {
      const d = new Date(now);
      d.setDate(d.getDate() - daysAgo);
      return d.toISOString().split('T')[0];
    };

    await db.transactions.bulkAdd([
      {
        userId: defaultUserId,
        amount: 485.00,
        currency: 'INR',
        category: 'Dining',
        merchant: 'Swiggy Food Delivery',
        narration: 'UPI-SWIGGY-BANGALORE-UPI/428194829104@icici',
        type: 'expense',
        date: getISO(0),
        account_id: 'hdfc-4921',
        synced: true,
        created_at: new Date().toISOString()
      },
      {
        userId: defaultUserId,
        amount: 420.00,
        currency: 'INR',
        category: 'Groceries',
        merchant: 'Zepto Quick Commerce',
        narration: 'UPI/DR/492019284719/ZEPTO QUICK COMM',
        type: 'expense',
        date: getISO(0),
        account_id: 'federal-8812',
        synced: true,
        created_at: new Date().toISOString()
      },
      {
        userId: defaultUserId,
        amount: 115000.00,
        currency: 'INR',
        category: 'Salary',
        merchant: 'TCS Limited Payroll',
        narration: 'ACH C-TCS LIMITED SALARY CR-SALARY FOR AUG 2026',
        type: 'income',
        date: getISO(1),
        account_id: 'hdfc-4921',
        synced: true,
        created_at: new Date().toISOString()
      },
      {
        userId: defaultUserId,
        amount: 15000.00,
        currency: 'INR',
        category: 'Investments',
        merchant: 'Zerodha Broking SIP',
        narration: 'UPI-ZERODHA BROKING-ZERODHA@HDFC-INVESTMENT SIP',
        type: 'expense',
        date: getISO(2),
        account_id: 'hdfc-4921',
        synced: true,
        created_at: new Date().toISOString()
      },
      {
        userId: defaultUserId,
        amount: 840.00,
        currency: 'INR',
        category: 'Groceries',
        merchant: 'Blinkit Instant Groceries',
        narration: 'UPI-BLINKIT GROCERIES-BLINKIT@YESBANK',
        type: 'expense',
        date: getISO(3),
        account_id: 'hdfc-4921',
        synced: true,
        created_at: new Date().toISOString()
      },
      {
        userId: defaultUserId,
        amount: 1899.00,
        currency: 'INR',
        category: 'Shopping',
        merchant: 'Amazon India Pay',
        narration: 'UPI-AMAZON PAY INDIA-AMAZON@APL-SHOPPING',
        type: 'expense',
        date: getISO(4),
        account_id: 'hdfc-4921',
        synced: true,
        created_at: new Date().toISOString()
      },
      {
        userId: defaultUserId,
        amount: 649.00,
        currency: 'INR',
        category: 'Entertainment',
        merchant: 'Netflix Subscription',
        narration: 'NETFLIX ENTERTAINMENT SERVICES MUMBAI',
        type: 'expense',
        date: getISO(5),
        account_id: 'hdfc-4921',
        synced: true,
        created_at: new Date().toISOString()
      },
      {
        userId: defaultUserId,
        amount: 345.00,
        currency: 'INR',
        category: 'Transport',
        merchant: 'Uber India Trip',
        narration: 'UPI-UBER INDIA TECHNOLOGY-UBER@ICICI-TRIP',
        type: 'expense',
        date: getISO(6),
        account_id: 'hdfc-4921',
        synced: true,
        created_at: new Date().toISOString()
      }
    ]);
  } else {
    // Migration: assign any legacy unassigned records to default user
    await db.accounts.where('userId').equals('').or('userId').equals(undefined).modify({ userId: defaultUserId });
    await db.transactions.where('userId').equals('').or('userId').equals(undefined).modify({ userId: defaultUserId });
    await db.budgets.where('userId').equals('').or('userId').equals(undefined).modify({ userId: defaultUserId });
  }

  console.log('Database initialized with multi-user support.');
}

// User-scoped queries
export async function getUserAccounts(userId) {
  return await db.accounts.filter(a => !a.userId || a.userId === userId).toArray();
}

export async function getUserTransactions(userId) {
  return await db.transactions.filter(t => !t.userId || t.userId === userId).toArray();
}

export async function getUserBudgets(userId) {
  return await db.budgets.filter(b => !b.userId || b.userId === userId).toArray();
}

// Add transaction scoped to active user
export async function addTransaction(transaction) {
  const user = await getCurrentUser();
  const userId = user ? user.id : 'user-aditya';
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
