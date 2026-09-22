/**
 * Transactions View
 * Filterable, searchable ledger with sync status badges and export capability.
 */

import { db, formatINR, getCurrentUser, getUserAccounts, getUserTransactions } from '../db.js';
import { BiometricAuthService } from '../auth.js';
import { openEditTransactionModal } from '../components/edit-category-modal.js';

let currentFilter = 'all';
let currentSearch = '';

export async function renderTransactions(container) {
  const isPrivacy = await BiometricAuthService.getPrivacyMode();
  const user = await getCurrentUser();
  const userId = user ? user.id : null;

  const accounts = userId ? await getUserAccounts(userId) : [];
  const accountMap = {};
  accounts.forEach(a => { accountMap[a.id] = a.bankName; });

  const allTxns = userId ? await getUserTransactions(userId) : [];

  // Check URL query params for initial category filter e.g. #/transactions?category=Dining
  const hash = window.location.hash;
  if (hash.includes('?')) {
    const params = new URLSearchParams(hash.split('?')[1]);
    const catParam = params.get('category');
    if (catParam) {
      currentFilter = `cat:${catParam}`;
    }
  }

  // Filter & Search logic
  let filtered = allTxns.filter(t => {
    if (currentFilter === 'expense' && t.type !== 'expense') return false;
    if (currentFilter === 'income' && t.type !== 'income') return false;
    if (currentFilter.startsWith('cat:')) {
      const targetCat = currentFilter.replace('cat:', '');
      if (t.category !== targetCat) return false;
    } else if (currentFilter !== 'all' && currentFilter !== 'expense' && currentFilter !== 'income' && currentFilter !== 'offline') {
      if (t.account_id !== currentFilter) return false;
    }

    if (currentSearch) {
      const q = currentSearch.toLowerCase();
      const matchMerchant = (t.merchant || '').toLowerCase().includes(q);
      const matchCategory = (t.category || '').toLowerCase().includes(q);
      const matchNarration = (t.narration || '').toLowerCase().includes(q);
      const matchAmount = String(t.amount || '').includes(q);
      if (!matchMerchant && !matchCategory && !matchNarration && !matchAmount) return false;
    }

    return true;
  });

  // Extract distinct categories present in allTxns for quick filter chips
  const distinctCategories = [...new Set(allTxns.map(t => t.category).filter(Boolean))];

  // Sort descending by date
  filtered.sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at));

  let listContentHtml = '';
  if (!user) {
    listContentHtml = `
      <div style="text-align: center; color: var(--text-muted); padding: 40px 20px; font-size: var(--text-sm);">
        <div style="font-size: 2rem; margin-bottom: 8px;">🔒</div>
        <div style="font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">Vault Locked</div>
        <p style="font-size: var(--text-xs); margin-bottom: 12px;">Sign in to view your ledger.</p>
        <button id="txns-login-btn" class="btn btn-primary btn-sm">Sign In</button>
      </div>
    `;
  } else if (filtered.length === 0) {
    listContentHtml = '<div style="text-align: center; color: var(--text-muted); padding: 40px 20px; font-size: var(--text-sm);">No matching transactions found.</div>';
  } else {
    listContentHtml = renderGroupedList(filtered, isPrivacy, accountMap);
  }

  container.innerHTML = `
    <!-- Search Bar -->
    <div class="txns-search-bar">
      <svg class="txns-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
      </svg>
      <input type="text" id="txns-search-input" class="txns-search-input" placeholder="Search merchants, categories, or ₹..." value="${escapeHtml(currentSearch)}" />
    </div>

    <!-- Filter Chips Scroll -->
    <div class="filter-chips-scroll">
      <button class="filter-chip ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">All (${allTxns.length})</button>
      <button class="filter-chip ${currentFilter === 'expense' ? 'active' : ''}" data-filter="expense">Expenses</button>
      <button class="filter-chip ${currentFilter === 'income' ? 'active' : ''}" data-filter="income">Income</button>
      ${distinctCategories.map(cat => `
        <button class="filter-chip ${currentFilter === `cat:${cat}` ? 'active' : ''}" data-filter="cat:${escapeHtml(cat)}">${escapeHtml(cat)}</button>
      `).join('')}
      ${accounts.map(a => `
        <button class="filter-chip ${currentFilter === a.id ? 'active' : ''}" data-filter="${escapeHtml(a.id)}">${escapeHtml(a.bankName)}</button>
      `).join('')}
    </div>

    <!-- Export & Stats Row -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin: 6px 0 12px 0;">
      <span style="font-size: var(--text-xs); color: var(--text-muted);">Showing ${filtered.length} entries</span>
      <button id="export-csv-btn" class="btn btn-outline btn-sm" style="font-size: 11px; padding: 4px 10px;">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
        Export CSV
      </button>
    </div>

    <!-- Grouped Transactions List -->
    <div id="txns-list-container">
      ${listContentHtml}
    </div>
  `;

  // Attach search handler with debounce
  const loginBtn = container.querySelector('#txns-login-btn');
  if (loginBtn) {
    loginBtn.onclick = () => { window.location.hash = '#/login'; };
  }

  const searchInput = container.querySelector('#txns-search-input');
  searchInput.oninput = (e) => {
    currentSearch = e.target.value;
    renderTransactions(container);
  };

  // Filter chips click
  container.querySelectorAll('.filter-chip').forEach(btn => {
    btn.onclick = () => {
      currentFilter = btn.dataset.filter;
      renderTransactions(container);
    };
  });

  // Export CSV handler
  const exportBtn = container.querySelector('#export-csv-btn');
  if (exportBtn) {
    exportBtn.onclick = () => exportTransactionsCSV(filtered, accountMap);
  }

  // Transaction item click for quick-edit popup window
  container.querySelectorAll('.txn-item').forEach(item => {
    item.onclick = async () => {
      const id = Number(item.dataset.id);
      const txn = await db.transactions.get(id);
      if (txn) {
        openEditTransactionModal(txn, () => renderTransactions(container));
      }
    };
  });
}

function renderGroupedList(txns, isPrivacy, accountMap) {
  // Group by date
  const groups = {};
  for (const t of txns) {
    const d = t.date || 'Earlier';
    if (!groups[d]) groups[d] = [];
    groups[d].push(t);
  }

  const todayStr = new Date().toISOString().split('T')[0];
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayStr = yesterday.toISOString().split('T')[0];

  let html = '';
  for (const [dateStr, list] of Object.entries(groups)) {
    let headerLabel = dateStr;
    if (dateStr === todayStr) headerLabel = 'Today';
    else if (dateStr === yesterdayStr) headerLabel = 'Yesterday';

    html += `<div class="txn-date-group-title">${headerLabel}</div>`;
    html += list.map(t => {
      const isExp = t.type === 'expense';
      const displayAmt = isPrivacy ? '••••' : (isExp ? '-' : '+') + formatINR(t.amount);
      const bankName = accountMap[t.account_id] || 'Bank';
      const iconMap = {
        Dining: '🍔', Groceries: '🛒', Shopping: '🛍️', Investments: '📈',
        Transport: '🚗', Utilities: '⚡', Entertainment: '🍿', Salary: '💼', Health: '💊'
      };
      const icon = iconMap[t.category] || '💳';

      return `
        <div class="txn-item" data-id="${t.id}" style="cursor: pointer;" title="Tap to change category, emoji, or type">
          <div class="txn-icon">${icon}</div>
          <div class="txn-details">
            <div class="txn-merchant" style="display: flex; align-items: center; gap: 6px;">
              <span>${escapeHtml(t.merchant || t.category || 'Transaction')}</span>
              <span style="font-size: 11px; color: var(--text-muted); opacity: 0.6;">✏️</span>
            </div>
            <div class="txn-meta">
              <span>${escapeHtml(bankName)}</span>
              <span>•</span>
              <span>${escapeHtml(t.category || 'General')}</span>
              <span>•</span>
              <span class="sync-pill ${t.synced ? 'synced' : 'pending'}">
                ${t.synced ? '✓' : '⏳ Offline'}
              </span>
            </div>
          </div>
          <div class="txn-amount-col">
            <div class="txn-amount ${isExp ? 'expense' : 'income'}">${displayAmt}</div>
          </div>
        </div>
      `;
    }).join('');
  }

  return html;
}

function showTransactionDetailModal(txn, accountMap) {
  const modalContainer = document.getElementById('global-modal-container');
  if (!modalContainer) return;

  const isExp = txn.type === 'expense';
  const bankName = accountMap[txn.account_id] || 'Bank Account';

  modalContainer.innerHTML = `
    <div class="modal-backdrop active" id="txn-modal-backdrop">
      <div class="modal-sheet">
        <div class="sheet-handle"></div>
        <div style="text-align: center; margin-bottom: 20px;">
          <div class="txn-amount ${isExp ? 'expense' : 'income'}" style="font-size: 2rem; margin-bottom: 4px;">
            ${(isExp ? '-' : '+') + formatINR(txn.amount)}
          </div>
          <div style="font-size: var(--text-base); font-weight: 700; color: var(--text-primary);">
            ${escapeHtml(txn.merchant || txn.category)}
          </div>
          <div style="font-size: var(--text-xs); color: var(--text-muted); margin-top: 4px;">
            ${escapeHtml(txn.narration || 'Manual Entry')}
          </div>
        </div>

        <div style="background: var(--bg-deep); border-radius: var(--radius-md); padding: 14px; margin-bottom: 20px; font-size: var(--text-xs); display: flex; flex-direction: column; gap: 8px;">
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">Account</span>
            <span style="font-weight: 600;">${escapeHtml(bankName)}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">Category</span>
            <span style="font-weight: 600;">${escapeHtml(txn.category)}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">Date</span>
            <span style="font-weight: 600;">${txn.date}</span>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">Sync Status</span>
            <span class="sync-pill ${txn.synced ? 'synced' : 'pending'}">${txn.synced ? '✓ Synced with Cloud/AA' : '⏳ Stored Locally in IndexedDB'}</span>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <button id="modal-delete-btn" class="btn btn-secondary" style="color: var(--signal-expense);">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
            Delete
          </button>
          <button id="modal-close-btn" class="btn btn-primary">Close</button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('modal-close-btn').onclick = () => {
    modalContainer.innerHTML = '';
  };
  document.getElementById('txn-modal-backdrop').onclick = (e) => {
    if (e.target.id === 'txn-modal-backdrop') modalContainer.innerHTML = '';
  };
  document.getElementById('modal-delete-btn').onclick = async () => {
    await db.transactions.delete(txn.id);
    modalContainer.innerHTML = '';
    const main = document.getElementById('view-container');
    if (main) renderTransactions(main);
  };
}

function exportTransactionsCSV(transactions, accountMap = {}) {
  if (transactions.length === 0) {
    const toastBox = document.getElementById('toast-container');
    if (toastBox) {
      const toast = document.createElement('div');
      toast.className = 'toast toast-info';
      toast.innerHTML = `<span style="color: var(--accent-blue); font-weight: 800;">ℹ</span> <span>No transactions to export.</span>`;
      toastBox.appendChild(toast);
      setTimeout(() => toast.remove(), 2800);
    }
    return;
  }

  const csvRows = ['Date,Merchant,Category,Type,Amount,Account,Synced,Narration'];
  for (const t of transactions) {
    const accLabel = accountMap[t.account_id] || t.account_id || '';
    csvRows.push([
      t.date || '',
      `"${(t.merchant || '').replace(/"/g, '""')}"`,
      t.category || '',
      t.type || 'expense',
      t.amount || 0,
      `"${accLabel.replace(/"/g, '""')}"`,
      t.synced ? 'YES' : 'NO',
      `"${(t.narration || '').replace(/"/g, '""')}"`
    ].join(','));
  }

  const blob = new Blob([csvRows.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `transactions_export_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
