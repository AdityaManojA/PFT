/**
 * Add Expense / Income View
 * Fast tactile logger storing directly to IndexedDB with optimistic UI.
 */

import { db, addTransaction, getCurrentUser, getUserAccounts, getActiveAccountFilter } from '../db.js';
import { ALL_CATEGORIES } from '../parsers/categorizer.js';
import { checkSpendingCaps } from '../services/notification-center.js';

let activeType = 'expense';
let activeCategory = 'Dining';

export async function renderAddExpense(container, showToastCallback) {
  const user = await getCurrentUser();
  if (!user) {
    container.innerHTML = `
      <div style="text-align: center; color: var(--text-muted); padding: 60px 20px;">
        <div style="font-size: 2.5rem; margin-bottom: 12px;">🔒</div>
        <h3 style="font-size: var(--text-base); font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">Sign In Required</h3>
        <p style="font-size: var(--text-xs); color: var(--text-muted); margin-bottom: 18px; max-width: 280px; margin-left: auto; margin-right: auto;">
          Please sign in to your vault to log transactions into your private ledger.
        </p>
        <button id="add-signin-btn" class="btn btn-primary btn-sm">Sign In to Vault</button>
      </div>
    `;
    const btn = container.querySelector('#add-signin-btn');
    if (btn) btn.onclick = () => { window.location.hash = '#/login'; };
    return;
  }

  const userId = user.id;
  const accounts = await getUserAccounts(userId);
  const activeAccFilter = getActiveAccountFilter();
  const todayISO = new Date().toISOString().split('T')[0];

  container.innerHTML = `
    <!-- Type Switcher Segmented Control -->
    <div class="segmented-control" style="margin-bottom: 18px;">
      <button class="segment-btn ${activeType === 'expense' ? 'active' : ''}" data-type="expense">Expense</button>
      <button class="segment-btn ${activeType === 'income' ? 'active' : ''}" data-type="income">Income</button>
      <button class="segment-btn ${activeType === 'transfer' ? 'active' : ''}" data-type="transfer">Transfer</button>
    </div>

    <!-- Amount Hero Input -->
    <div class="add-amount-hero">
      <span class="add-amount-currency">₹</span>
      <input type="number" id="add-amount-input" class="add-amount-input" placeholder="0" step="any" autofocus inputmode="decimal" />
    </div>

    <!-- Category Chips Grid -->
    <div class="form-group">
      <label class="form-label">Category</label>
      <div class="category-chips-grid">
        ${ALL_CATEGORIES.map(c => `
          <button type="button" class="category-chip-btn ${c.name === activeCategory ? 'active' : ''}" data-cat="${c.name}">
            <span class="category-chip-icon">${c.icon}</span>
            <span>${c.name}</span>
          </button>
        `).join('')}
      </div>
    </div>

    <!-- Form Fields -->
    <div class="card" style="margin-bottom: 24px;">
      <div class="form-group">
        <label class="form-label" for="add-merchant-input">Merchant / Payee Name</label>
        <input type="text" id="add-merchant-input" class="form-input" placeholder="e.g. Swiggy, Uber, Amazon..." />
      </div>

      <div class="form-group">
        <label class="form-label" for="add-account-select">Account / Payment Method</label>
        <select id="add-account-select" class="form-select">
          ${accounts.length === 0 ? '<option value="">No accounts linked yet</option>' : ''}
          ${accounts.map(a => `
            <option value="${a.id}" ${activeAccFilter === a.id ? 'selected' : ''}>${escapeHtml(a.bankName)} (${a.accountNumberMask})</option>
          `).join('')}
        </select>
        ${accounts.length === 0 ? `
          <div style="font-size: 11px; color: var(--accent-amber); margin-top: 5px;">
            ⚠️ You need to add a bank account before logging transactions. <a href="/accounts" style="color: var(--accent-blue); text-decoration: underline;">+ Add Bank Account</a>
          </div>
        ` : ''}
      </div>

      <div class="form-group">
        <label class="form-label" for="add-date-input">Date</label>
        <input type="date" id="add-date-input" class="form-input" value="${todayISO}" />
      </div>

      <div class="form-group" style="margin-bottom: 0;">
        <label class="form-label" for="add-notes-input">Notes (Optional)</label>
        <input type="text" id="add-notes-input" class="form-input" placeholder="e.g. Dinner with team" />
      </div>
    </div>

    <!-- Submit Button -->
    <button id="add-save-btn" class="btn btn-primary btn-block" style="padding: 14px; font-size: var(--text-base);">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg>
      Save Transaction
    </button>
  `;

  // Attach Type Switcher
  container.querySelectorAll('.segment-btn').forEach(btn => {
    btn.onclick = () => {
      activeType = btn.dataset.type;
      container.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    };
  });

  // Attach Category selector
  container.querySelectorAll('.category-chip-btn').forEach(btn => {
    btn.onclick = () => {
      activeCategory = btn.dataset.cat;
      container.querySelectorAll('.category-chip-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    };
  });

  // Save Transaction Handler
  const saveBtn = container.querySelector('#add-save-btn');
  saveBtn.onclick = async () => {
    const amountVal = parseFloat(container.querySelector('#add-amount-input').value);
    if (!amountVal || isNaN(amountVal) || amountVal <= 0) {
      if (showToastCallback) showToastCallback('Please enter a valid amount', 'info');
      container.querySelector('#add-amount-input').focus();
      return;
    }

    const merchantVal = container.querySelector('#add-merchant-input').value.trim() || activeCategory;
    const accountId = container.querySelector('#add-account-select').value;

    if (!accountId) {
      if (showToastCallback) showToastCallback('Please add a bank account first in Banks & AA', 'info');
      window.location.hash = '#/accounts';
      return;
    }

    const dateVal = container.querySelector('#add-date-input').value || todayISO;
    const notesVal = container.querySelector('#add-notes-input').value.trim();

    await addTransaction({
      amount: amountVal,
      type: activeType === 'transfer' ? 'expense' : activeType,
      category: activeCategory,
      merchant: merchantVal,
      narration: notesVal ? `${merchantVal} - ${notesVal}` : merchantVal,
      date: dateVal,
      account_id: accountId
    });

    // Check spending caps and trigger alert if breached
    await checkSpendingCaps(userId);

    const isOnline = navigator.onLine;
    if (showToastCallback) {
      showToastCallback(
        isOnline ? 'Transaction saved and synced!' : 'Saved offline in IndexedDB. Will sync when online.',
        'success'
      );
    }

    // Reset amount
    container.querySelector('#add-amount-input').value = '';
    // Navigate to dashboard
    window.location.hash = '#/dashboard';
  };
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
