/**
 * Budgets & Category Limits View
 * Tracks monthly spending vs category limits with visual status bars and alerts.
 */

import { db, formatINR, getCurrentUser, getUserBudgets, getUserTransactions, getUserSpendingCap, setUserSpendingCap } from '../db.js';
import { checkSpendingCaps } from '../services/notification-center.js';
import { sendLimitBreachEmail } from '../services/email-service.js';

let selectedBudgetMonth = null;

export async function renderBudgets(container, showToastCallback) {
  const user = await getCurrentUser();
  const userId = user ? user.id : null;
  const budgets = userId ? await getUserBudgets(userId) : [];
  const capData = userId ? await getUserSpendingCap(userId) : { monthlyLimit: 0, alertEmail: '', emailAlertsEnabled: true };

  // Get all transactions to determine available months
  const allTxns = userId ? await getUserTransactions(userId) : [];
  const expenseTxns = allTxns.filter(t => t.type === 'expense' && t.date);
  const availableMonths = [...new Set(expenseTxns.map(t => t.date.slice(0, 7)))].sort().reverse();
  const currentMonthPrefix = new Date().toISOString().slice(0, 7);

  if (!selectedBudgetMonth || !availableMonths.includes(selectedBudgetMonth)) {
    selectedBudgetMonth = availableMonths.includes(currentMonthPrefix)
      ? currentMonthPrefix
      : (availableMonths[0] || currentMonthPrefix);
  }

  const [y, mon] = selectedBudgetMonth.split('-');
  const mDate = new Date(parseInt(y, 10), parseInt(mon, 10) - 1, 1);
  const monthLabel = mDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  // Get active month's expenses
  const monthExpenses = allTxns.filter(t => t.type === 'expense' && t.date && t.date.startsWith(selectedBudgetMonth));

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

  // Monthly Spending Cap Calculations
  const monthlyCap = Number(capData.monthlyLimit) || 0;
  const capPercent = monthlyCap > 0 ? Math.round((totalSpent / monthlyCap) * 100) : 0;
  const isCapBreached = monthlyCap > 0 && totalSpent >= monthlyCap;
  const isCapWarning = monthlyCap > 0 && totalSpent >= monthlyCap * 0.8 && totalSpent < monthlyCap;
  const userAlertEmail = capData.alertEmail || (user && (user.alertEmail || user.googleEmail || user.email)) || '';

  let budgetCardsHtml = '';
  if (!user) {
    budgetCardsHtml = `
      <div style="text-align: center; color: var(--text-muted); padding: 30px 16px; font-size: var(--text-xs); background: var(--bg-surface); border-radius: var(--radius-lg); border: 1px dashed var(--border-medium);">
        <div style="font-size: 1.6rem; margin-bottom: 6px;">🔒</div>
        <p style="margin-bottom: 10px;">Sign in to view and set your personalized category limits.</p>
        <button id="budgets-signin-btn" class="btn btn-primary btn-sm" style="font-size: 11px;">Sign In</button>
      </div>
    `;
  } else if (budgets.length === 0) {
    budgetCardsHtml = '<div style="text-align: center; color: var(--text-muted); padding: 30px 16px; font-size: var(--text-xs);">No category budgets set.</div>';
  } else {
    // Strict multi-tier sorting:
    // 1. Highest spend first
    // 2. Highest utilization % first
    // 3. Alphabetical by category
    const sortedBudgets = [...budgets].sort((a, b) => {
      const spentA = categorySpentMap[a.category] || 0;
      const spentB = categorySpentMap[b.category] || 0;
      if (spentB !== spentA) return spentB - spentA;
      const pctA = a.monthlyLimit > 0 ? spentA / a.monthlyLimit : 0;
      const pctB = b.monthlyLimit > 0 ? spentB / b.monthlyLimit : 0;
      if (pctB !== pctA) return pctB - pctA;
      return a.category.localeCompare(b.category);
    });

    budgetCardsHtml = sortedBudgets.map(b => {
      const spent = categorySpentMap[b.category] || 0;
      const limit = b.monthlyLimit || 0;
      const pct = limit > 0 ? Math.round((spent / limit) * 100) : 0;
      const isOver = limit > 0 && pct > 100;
      const isWarn = limit > 0 && pct >= 75 && pct <= 100;
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
              ${limit === 0 ? 'No limit set (Tap + Edit Limits)' : (isOver ? '⚠️ Overbudget by ' + formatINR(spent - limit) : isWarn ? '⚡ Approaching limit' : formatINR(limit - spent) + ' remaining')}
            </span>
            <span style="font-weight: 700; color: ${isOver ? 'var(--signal-expense)' : isWarn ? 'var(--signal-warning)' : 'var(--accent-emerald)'};">
              ${pct}%
            </span>
          </div>
        </div>
      `;
    }).join('');
  }

  container.innerHTML = `
    <!-- Overall Monthly Spending Cap & Email Alerts Card -->
    <div class="glass-card ${isCapBreached ? 'glass-card-glow-rose' : isCapWarning ? 'glass-card-glow-amber' : 'glass-card-glow-emerald'}" style="margin-bottom: 16px; border: 1px solid ${isCapBreached ? 'rgba(244, 63, 94, 0.4)' : isCapWarning ? 'rgba(245, 158, 11, 0.35)' : 'var(--border-medium)'};">
      <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
        <div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 14px;">${isCapBreached ? '🚨' : isCapWarning ? '⚡' : '🛡️'}</span>
            <span class="hero-label">Monthly Spending Cap & Alerts</span>
          </div>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
            ${monthlyCap > 0 ? `Alerts sent to ${escapeHtml(userAlertEmail || 'configured email')}` : 'Set an overall cap to get instant email alerts when crossed'}
          </div>
        </div>
        <button id="edit-cap-btn" class="btn btn-outline btn-sm" style="font-size: 11px; padding: 4px 10px;">
          ⚙️ ${monthlyCap > 0 ? 'Edit Cap' : '+ Set Cap'}
        </button>
      </div>

      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 10px;">
        <div style="font-size: 1.6rem; font-weight: 800; color: ${isCapBreached ? 'var(--signal-expense)' : isCapWarning ? 'var(--signal-warning)' : 'var(--text-primary)'};">
          ${formatINR(totalSpent)}
        </div>
        <div style="font-size: var(--text-xs); color: var(--text-muted);">
          ${monthlyCap > 0 ? `of ${formatINR(monthlyCap)} Cap (${capPercent}%)` : 'No Cap Configured'}
        </div>
      </div>

      ${monthlyCap > 0 ? `
        <div class="budget-progress-track" style="height: 8px;">
          <div class="budget-progress-fill ${isCapBreached ? 'danger' : isCapWarning ? 'warning' : 'normal'}" style="width: ${Math.min(100, capPercent)}%;"></div>
        </div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 8px; font-size: 11px;">
          <span style="color: ${isCapBreached ? 'var(--signal-expense)' : isCapWarning ? 'var(--signal-warning)' : 'var(--text-muted)'}; font-weight: 600;">
            ${isCapBreached ? `🚨 Cap crossed by +${formatINR(totalSpent - monthlyCap)}! Email alert dispatched.` : isCapWarning ? `⚡ Caution: ${formatINR(monthlyCap - totalSpent)} remaining before cap breach.` : `✓ ${formatINR(monthlyCap - totalSpent)} remaining under cap.`}
          </span>
          <span style="font-size: 10px; color: var(--text-muted);">
            from: aditya.dev.org@gmail.com
          </span>
        </div>
      ` : `
        <div style="font-size: 11px; color: var(--text-secondary); background: var(--bg-surface-elevated); padding: 8px 12px; border-radius: var(--radius-sm); margin-top: 4px;">
          💡 Tap <strong>+ Set Cap</strong> to specify your monthly threshold and activate automatic email warnings whenever your spend limit is crossed.
        </div>
      `}
    </div>

    <!-- Overall Category Budget Meter Card -->
    <div class="glass-card" style="margin-bottom: 20px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
        <span class="hero-label">${escapeHtml(monthLabel)} Category Limits Total</span>
        <span class="badge ${overallPercent > 100 ? 'badge-rose' : overallPercent > 75 ? 'badge-amber' : 'badge-emerald'}">
          ${overallPercent}% Allocated Used
        </span>
      </div>
      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 12px;">
        <div style="font-size: 1.3rem; font-weight: 700;">${formatINR(totalSpent)}</div>
        <div style="font-size: var(--text-xs); color: var(--text-muted);">of ${formatINR(totalBudget)} Category Limits</div>
      </div>
      <div class="budget-progress-track">
        <div class="budget-progress-fill ${overallPercent > 100 ? 'danger' : overallPercent > 75 ? 'warning' : 'normal'}" style="width: ${Math.min(100, overallPercent)}%;"></div>
      </div>
    </div>

    <!-- Category Budgets List -->
    <div class="section-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
      <div>
        <h3 class="section-title">Category Limits</h3>
        <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
          ${escapeHtml(monthLabel)} Breakdown
        </div>
      </div>
      <div style="display: flex; align-items: center; gap: 8px;">
        ${availableMonths.length > 1 ? `
          <select id="budget-month-select" class="form-select" style="padding: 4px 10px; font-size: 11px; height: 30px; border-radius: var(--radius-sm); background: var(--bg-surface-elevated); color: var(--text-primary); border: 1px solid var(--border-medium); cursor: pointer; font-weight: 600;">
            ${availableMonths.map(m => {
              const [my, mmon] = m.split('-');
              const md = new Date(parseInt(my, 10), parseInt(mmon, 10) - 1, 1);
              const label = md.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
              return `<option value="${m}" ${selectedBudgetMonth === m ? 'selected' : ''}>${label}</option>`;
            }).join('')}
          </select>
        ` : ''}
        <button id="add-budget-btn" class="btn btn-outline btn-sm">+ Edit Limits</button>
      </div>
    </div>
    <div class="budget-cards-list">
      ${budgetCardsHtml}
    </div>
  `;

  // Attach Month Select listener
  const monthSelect = container.querySelector('#budget-month-select');
  if (monthSelect) {
    monthSelect.onchange = (e) => {
      selectedBudgetMonth = e.target.value;
      renderBudgets(container, showToastCallback);
    };
  }

  // Attach Edit Monthly Cap Modal
  const editCapBtn = container.querySelector('#edit-cap-btn');
  if (editCapBtn) {
    editCapBtn.onclick = () => {
      if (!user) {
        window.location.hash = '#/login';
        return;
      }
      openSpendingCapModal(userId, capData, user, totalSpent, showToastCallback, () => renderBudgets(container, showToastCallback));
    };
  }

  // Attach Edit Limits Modal
  const signinBtn = container.querySelector('#budgets-signin-btn');
  if (signinBtn) {
    signinBtn.onclick = () => { window.location.hash = '#/login'; };
  }

  const addBtn = container.querySelector('#add-budget-btn');
  if (addBtn) {
    addBtn.onclick = () => {
      if (!user) {
        window.location.hash = '#/login';
        return;
      }
      openBudgetEditModal(userId, budgets, showToastCallback, () => renderBudgets(container, showToastCallback));
    };
  }
}

/**
 * Modal to configure Monthly Spending Cap and Automated Email Alerts
 */
function openSpendingCapModal(userId, currentCapData, user, currentSpend, showToast, refreshCallback) {
  const modalContainer = document.getElementById('global-modal-container');
  if (!modalContainer) return;

  const defaultEmail = currentCapData.alertEmail || (user && (user.alertEmail || user.googleEmail || user.email)) || '';

  modalContainer.innerHTML = `
    <div class="modal-backdrop active" id="cap-modal-backdrop">
      <div class="modal-sheet" style="max-width: 440px;">
        <div class="sheet-handle"></div>
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">
          <div style="font-size: 22px;">🛡️</div>
          <div>
            <h3 class="sheet-title" style="margin: 0;">Monthly Spending Cap & Alerts</h3>
            <div style="font-size: 11px; color: var(--text-muted);">Configure threshold & instant email dispatch</div>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 16px; margin: 18px 0;">
          <div>
            <label class="form-label" style="font-size: 12px; font-weight: 600;">Monthly Spending Cap (₹)</label>
            <div style="position: relative;">
              <span style="position: absolute; left: 12px; top: 50%; transform: translateY(-50%); font-size: 14px; color: var(--accent-emerald); font-weight: 700;">₹</span>
              <input type="number" id="cap-amount-input" class="form-input" placeholder="50000" value="${currentCapData.monthlyLimit || ''}" style="padding-left: 28px; font-size: 16px; font-weight: 700;" />
            </div>
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
              Current month spend: <strong>${formatINR(currentSpend)}</strong>
            </div>
          </div>

          <div>
            <label class="form-label" style="font-size: 12px; font-weight: 600;">Alert Recipient Email</label>
            <input type="email" id="cap-email-input" class="form-input" placeholder="yourname@gmail.com" value="${escapeHtml(defaultEmail)}" />
            <div style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">
              Emails will be sent from: <strong>aditya.dev.org@gmail.com</strong>
            </div>
          </div>

          <div style="background: var(--bg-surface-elevated); padding: 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-medium); display: flex; flex-direction: column; gap: 10px;">
            <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer;">
              <input type="checkbox" id="cap-email-enabled" ${currentCapData.emailAlertsEnabled !== false ? 'checked' : ''} style="width: 16px; height: 16px; accent-color: var(--accent-emerald);" />
              <span>Send instant email alert when spending crosses monthly cap</span>
            </label>
            <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer;">
              <input type="checkbox" id="cap-reminder-enabled" checked style="width: 16px; height: 16px; accent-color: var(--accent-emerald);" />
              <span>Send month-end expense update reminder with app link</span>
            </label>
          </div>
        </div>

        <div style="display: flex; gap: 10px;">
          <button id="test-cap-email-btn" class="btn btn-outline" style="flex: 1; font-size: 12px;">
            ✉️ Send Test Alert
          </button>
          <button id="save-cap-btn" class="btn btn-primary" style="flex: 1; font-size: 12px;">
            Save Cap Settings
          </button>
        </div>
      </div>
    </div>
  `;

  document.getElementById('cap-modal-backdrop').onclick = (e) => {
    if (e.target.id === 'cap-modal-backdrop') modalContainer.innerHTML = '';
  };

  // Send Test Alert Email Button
  const testBtn = document.getElementById('test-cap-email-btn');
  testBtn.onclick = async () => {
    const targetEmail = document.getElementById('cap-email-input').value.trim();
    const limit = parseFloat(document.getElementById('cap-amount-input').value) || 50000;

    if (!targetEmail) {
      showToast('Please enter a recipient email address.', 'error');
      return;
    }

    testBtn.disabled = true;
    testBtn.innerText = 'Sending...';

    const result = await sendLimitBreachEmail({
      userEmail: targetEmail,
      userName: user.name || 'Member',
      currentSpend: limit + 2500,
      limitAmount: limit,
      categoryName: 'Monthly Spending Cap Test'
    });

    testBtn.disabled = false;
    testBtn.innerText = '✉️ Send Test Alert';

    if (result.success) {
      showToast(`Test alert email dispatched from aditya.dev.org@gmail.com to ${targetEmail}!`, 'success');
    } else {
      showToast('Failed to dispatch test email: ' + (result.reason || 'Network error'), 'error');
    }
  };

  // Save Cap Settings Button
  const saveBtn = document.getElementById('save-cap-btn');
  saveBtn.onclick = async () => {
    const limitVal = parseFloat(document.getElementById('cap-amount-input').value);
    const emailVal = document.getElementById('cap-email-input').value.trim();
    const emailEnabled = document.getElementById('cap-email-enabled').checked;

    const limit = isNaN(limitVal) || limitVal < 0 ? 0 : limitVal;

    await setUserSpendingCap(userId, {
      monthlyLimit: limit,
      alertEmail: emailVal,
      emailAlertsEnabled: emailEnabled
    });

    // Check caps immediately
    await checkSpendingCaps(userId);

    modalContainer.innerHTML = '';
    showToast('Monthly spending cap & email alert preferences saved!', 'success');
    if (refreshCallback) refreshCallback();
  };
}

function openBudgetEditModal(userId, budgets, showToast, refreshCallback) {
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
      const parsed = parseFloat(input.value);
      const limit = isNaN(parsed) || parsed < 0 ? 0 : parsed;
      await db.budgets.where('userId').equals(userId).filter(b => b.category === cat).modify({ monthlyLimit: limit });
    }

    // Check caps immediately
    await checkSpendingCaps(userId);

    modalContainer.innerHTML = '';
    showToast('Budget limits updated successfully!', 'success');
    if (refreshCallback) refreshCallback();
  };
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

