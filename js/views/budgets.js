/**
 * Budgets & Category Limits View
 * Tracks monthly spending vs category limits with visual status bars and alerts.
 */

import { db, formatINR, getCurrentUser, getUserBudgets, getUserTransactions } from '../db.js';

export async function renderBudgets(container, showToastCallback) {
  const user = await getCurrentUser();
  const userId = user ? user.id : 'user-aditya';
  const budgets = await getUserBudgets(userId);

  // Get current month's transactions for this user
  const currentMonthPrefix = new Date().toISOString().slice(0, 7);
  const allTxns = await getUserTransactions(userId);
  const monthExpenses = allTxns.filter(t => t.type === 'expense' && t.date && t.date.startsWith(currentMonthPrefix));

  // Compute spent by category
  const categorySpentMap = {};
  monthExpenses.forEach(t => {
    const cat = t.category || 'Other';
    categorySpentMap[cat] = (categorySpentMap[cat] || 0) + (Number(t.amount) || 0);
  });

  let totalBudget = 0;
  let totalSpent = 0;

  budgets.forEach(b => {
    totalBudget += (b.monthlyLimit || 0);
    totalSpent += (categorySpentMap[b.category] || 0);
  });

  const overallPercent = totalBudget > 0 ? Math.round((totalSpent / totalBudget) * 100) : 0;

  container.innerHTML = `
    <!-- Overall Budget Meter Card -->
    <div class="glass-card glass-card-glow-emerald" style="margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <span class="hero-label">Monthly Budget Utilization</span>
        <span class="badge ${overallPercent > 100 ? 'badge-rose' : overallPercent > 75 ? 'badge-amber' : 'badge-emerald'}">
          ${overallPercent}% Used
        </span>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px;">
        <div style="font-size: 1.6rem; font-weight: 800;">${formatINR(totalSpent)}</div>
        <div style="font-size: var(--text-xs); color: var(--text-muted);">of ${formatINR(totalBudget)} Limit</div>
      </div>
      <div class="budget-progress-track">
        <div class="budget-progress-fill ${overallPercent > 100 ? 'danger' : overallPercent > 75 ? 'warning' : 'normal'}" style="width: ${Math.min(100, overallPercent)}%;"></div>
      </div>
    </div>

    <!-- Category Budgets List -->
    <div class="section-header">
      <h3 class="section-title">Category Limits</h3>
      <button id="add-budget-btn" class="btn btn-outline btn-sm">+ Edit Limits</button>
    </div>
    <div class="budget-cards-list">
      ${budgets.map(b => {
        const spent = categorySpentMap[b.category] || 0;
        const limit = b.monthlyLimit || 1;
        const pct = Math.round((spent / limit) * 100);
        const isOver = pct > 100;
        const isWarn = pct >= 75 && pct <= 100;
        const statusClass = isOver ? 'danger' : isWarn ? 'warning' : 'normal';

        return `
          <div class="budget-card">
            <div class="budget-card-header">
              <div class="budget-category-name">
                <span>${b.icon || '🏷️'}</span>
                <span>${escapeHtml(b.category)}</span>
              </div>
              <div class="budget-amounts">
                <strong>${formatINR(spent)}</strong> / ${formatINR(limit)}
              </div>
            </div>
            <div class="budget-progress-track">
              <div class="budget-progress-fill ${statusClass}" style="width: ${Math.min(100, pct)}%;"></div>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; font-size: 11px;">
              <span style="color: ${isOver ? 'var(--signal-expense)' : isWarn ? 'var(--signal-warning)' : 'var(--text-muted)'};">
                ${isOver ? '⚠️ Overbudget by ' + formatINR(spent - limit) : isWarn ? '⚡ Approaching limit' : formatINR(limit - spent) + ' remaining'}
              </span>
              <span style="font-weight: 700; color: ${isOver ? 'var(--signal-expense)' : isWarn ? 'var(--signal-warning)' : 'var(--accent-emerald)'};">
                ${pct}%
              </span>
            </div>
          </div>
        `;
      }).join('')}
    </div>
  `;

  // Attach Edit Limits Modal
  const addBtn = container.querySelector('#add-budget-btn');
  if (addBtn) {
    addBtn.onclick = () => openBudgetEditModal(budgets, showToastCallback, () => renderBudgets(container, showToastCallback));
  }
}

function openBudgetEditModal(budgets, showToast, refreshCallback) {
  const modalContainer = document.getElementById('global-modal-container');
  if (!modalContainer) return;

  modalContainer.innerHTML = `
    <div class="modal-backdrop active" id="budget-modal-backdrop">
      <div class="modal-sheet">
        <div class="sheet-handle"></div>
        <h3 class="sheet-title">Adjust Category Limits</h3>
        <p class="sheet-subtitle">Update monthly spend thresholds for real-time tracking.</p>

        <div style="display: flex; flex-direction: column; gap: 12px; margin-bottom: 20px;">
          ${budgets.map(b => `
            <div style="display: flex; align-items: center; justify-content: space-between; gap: 12px;">
              <span style="font-size: var(--text-sm); font-weight: 600; display: flex; align-items: center; gap: 6px;">
                ${b.icon || '🏷️'} ${escapeHtml(b.category)}
              </span>
              <div style="position: relative; width: 140px;">
                <span style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); font-size: 12px; color: var(--accent-emerald);">₹</span>
                <input type="number" class="form-input budget-input-field" data-cat="${escapeHtml(b.category)}" value="${b.monthlyLimit}" style="padding-left: 24px; font-variant-numeric: tabular-nums;" />
              </div>
            </div>
          `).join('')}
        </div>

        <button id="save-budgets-btn" class="btn btn-primary btn-block">Save Limits</button>
      </div>
    </div>
  `;

  document.getElementById('budget-modal-backdrop').onclick = (e) => {
    if (e.target.id === 'budget-modal-backdrop') modalContainer.innerHTML = '';
  };

  document.getElementById('save-budgets-btn').onclick = async () => {
    const inputs = modalContainer.querySelectorAll('.budget-input-field');
    for (const input of inputs) {
      const cat = input.dataset.cat;
      const limit = parseFloat(input.value) || 1000;
      await db.budgets.where('category').equals(cat).modify({ monthlyLimit: limit });
    }
    modalContainer.innerHTML = '';
    showToast('Budget limits updated successfully!', 'success');
    if (refreshCallback) refreshCallback();
  };
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
