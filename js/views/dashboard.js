/**
 * Dashboard View - SBAFA Financial Enclave
 * Total net worth, period cashflow, intelligent spending sectionization,
 * interactive category breakdown bars, and recent activity.
 */

import { db, formatINR, getCurrentUser, getUserAccounts, getUserTransactions, getActiveAccountFilter, setActiveAccountFilter } from '../db.js';
import { BiometricAuthService } from '../auth.js';
import { getCategoryMeta } from '../parsers/categorizer.js';
import { openEditTransactionModal } from '../components/edit-category-modal.js';

let chartInstance = null;
let currentPeriodFilter = 'month'; // 'month' | 'all'
let selectedMonth = null;
let currentChartType = 'donut'; // 'donut' | 'bar'

// Warm Editorial Theme-Matching Palettes (Grounded in Terracotta, Sage, Ochre & Olive)
const THEME_PALETTES = {
  // Light Theme: Earthy, rich, high-contrast natural pigments on warm oatmeal linen
  light: [
    '#D45025', // Deep Terracotta (Brand)
    '#226344', // Deep Forest Sage
    '#B46816', // Warm Amber Ochre
    '#1A5A55', // Deep Sea Teal
    '#A03B1E', // Warm Sienna Rust
    '#4A6026', // Earthy Deep Olive
    '#6B4226', // Roasted Mocha
    '#6D3B62', // Deep Plum Slate
    '#8C5A20', // Burnt Ochre
    '#B83E1E'  // Brick Terracotta
  ],
  // Dark Theme: Luminous, warm, vibrating pigments tailored for the lighter charcoal canvas
  dark: [
    '#FF6B3D', // Luminous Terracotta (Brand)
    '#4ADE80', // Radiant Sage Forest
    '#FBBF24', // Warm Golden Amber
    '#2DD4BF', // Luminous Sea Teal
    '#F87171', // Warm Terracotta Coral
    '#E2B17A', // Golden Clay Sand
    '#A3E635', // Fresh Olive Leaf
    '#FB923C', // Bright Tangerine
    '#38BDF8', // Luminous Sky Slate
    '#C084FC'  // Warm Lavender Ash
  ]
};

export function getThemePalette(isLight) {
  return isLight ? THEME_PALETTES.light : THEME_PALETTES.dark;
}

export async function renderDashboard(container) {
  const isPrivacy = await BiometricAuthService.getPrivacyMode();
  const user = await getCurrentUser();
  const userId = user ? user.id : null;

  // Fetch user-scoped accounts
  const accounts = userId ? await getUserAccounts(userId) : [];

  // Validate active account filter
  let rawActiveAccount = getActiveAccountFilter();
  if (rawActiveAccount !== 'all' && !accounts.some(a => String(a.id) === String(rawActiveAccount))) {
    rawActiveAccount = 'all';
    setActiveAccountFilter('all');
  }
  const activeAccount = rawActiveAccount;
  const selectedAccountObj = accounts.find(a => String(a.id) === String(activeAccount));

  // Calculate Net Worth / Current Balance:
  // If specific account selected, show that account's balance; otherwise sum of all accounts
  const displayTotalNum = activeAccount === 'all'
    ? accounts.reduce((acc, a) => acc + (a.balance || 0), 0)
    : (selectedAccountObj ? (selectedAccountObj.balance || 0) : 0);

  // Fetch all transactions for this user, scoped to active account if selected
  const userTxns = userId ? await getUserTransactions(userId) : [];
  const allTxns = activeAccount === 'all'
    ? userTxns
    : userTxns.filter(t => String(t.account_id) === String(activeAccount));

  const now = new Date();
  const currentMonthPrefix = now.toISOString().slice(0, 7); // YYYY-MM
  
  // Robust transaction month parser
  const parseTxnMonth = (t) => {
    if (!t || !t.date) return null;
    const clean = String(t.date).trim();
    if (/^\d{4}-\d{2}/.test(clean)) return clean.slice(0, 7);
    const dmy = clean.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2, '0')}`;
    return null;
  };

  // Discover all months with transactions, latest first, along with metadata
  const monthStats = {};
  for (const t of allTxns) {
    const ym = parseTxnMonth(t);
    if (ym) {
      if (!monthStats[ym]) monthStats[ym] = { count: 0, spend: 0 };
      monthStats[ym].count += 1;
      if (t.type !== 'income') monthStats[ym].spend += (Number(t.amount) || 0);
    }
  }
  const availableMonths = Object.keys(monthStats).sort().reverse();

  if (!selectedMonth || !availableMonths.includes(selectedMonth)) {
    // Default to current calendar month if it has data, or the latest statement month with data
    selectedMonth = (availableMonths.includes(currentMonthPrefix) && monthStats[currentMonthPrefix]?.count > 0)
      ? currentMonthPrefix
      : (availableMonths[0] || currentMonthPrefix);
  }

  // Determine active transactions based on period filter
  let activeTxns = [];
  let periodLabel = 'Monthly Breakdown';

  if (currentPeriodFilter === 'month') {
    activeTxns = allTxns.filter(t => parseTxnMonth(t) === selectedMonth);
    const parts = (selectedMonth || '').split('-');
    if (parts.length === 2) {
      const mDate = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
      periodLabel = mDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
    } else {
      periodLabel = selectedMonth || 'This Month';
    }
  } else {
    activeTxns = allTxns;
    periodLabel = 'All Time (' + allTxns.length + ' entries)';
  }

  // Calculate Cashflow & Category Breakdown for active period
  let periodIncome = 0;
  let periodExpense = 0;
  const categoryMap = {};

  for (const t of activeTxns) {
    const amt = Number(t.amount) || 0;
    if (t.type === 'income') {
      periodIncome += amt;
    } else {
      periodExpense += amt;
      const catName = t.category || 'Other';
      if (!categoryMap[catName]) {
        categoryMap[catName] = {
          category: catName,
          amount: 0,
          count: 0
        };
      }
      categoryMap[catName].amount += amt;
      categoryMap[catName].count += 1;
    }
  }

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const themePalette = getThemePalette(isLight);

  // Build sorted sectionized category list with theme-matching editorial colors
  const categorySections = Object.values(categoryMap)
    .filter(c => c.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .map((c, i) => {
      const meta = getCategoryMeta(c.category);
      const percent = periodExpense > 0 ? Math.round((c.amount / periodExpense) * 100) : 0;
      const themeColor = themePalette[i % themePalette.length];
      return {
        ...c,
        meta: {
          ...meta,
          color: themeColor,
          bg: themeColor + (isLight ? '1E' : '28')
        },
        percent
      };
    });

  const displayBalance = isPrivacy ? '••••••••' : formatINR(displayTotalNum);
  const displayIncome = isPrivacy ? '••••' : formatINR(periodIncome);
  const displayExpense = isPrivacy ? '••••' : formatINR(periodExpense);

  const recentTxns = allTxns.slice(0, 5);

  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
  const userName = user ? (user.name || 'Friend') : 'Guest';

  // Build Account Switcher UI at top:
  // If <= 1 account: show nothing
  // If === 2 accounts: toggle pills
  // If > 2 accounts: styled dropdown
  let accountSwitcherHtml = '';
  if (accounts.length === 2) {
    accountSwitcherHtml = `
      <div class="account-switcher-wrapper">
        <div class="account-switcher-label">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
          <span>Account</span>
        </div>
        <div class="account-toggle-pills" id="dashboard-account-toggle-group" role="tablist" aria-label="Account Switcher">
          <button type="button" class="account-toggle-pill ${activeAccount === 'all' ? 'active' : ''}" data-account-id="all" role="tab" aria-selected="${activeAccount === 'all'}">
            <span class="pill-full-label">All Accounts</span>
            <span class="pill-short-label">All</span>
          </button>
          ${accounts.map(acc => {
            const digits = String(acc.accountNumberMask || acc.accountNumberLast4 || '').replace(/[^0-9]/g, '');
            const last4 = digits ? digits.slice(-4) : '••••';
            const shortBank = (acc.bankName || 'Bank')
              .replace(/\s+Bank\b/i, '')
              .replace(/State Bank of India/i, 'SBI')
              .trim();
            return `
              <button type="button" class="account-toggle-pill ${activeAccount === String(acc.id) ? 'active' : ''}" data-account-id="${escapeHtml(acc.id)}" role="tab" aria-selected="${activeAccount === String(acc.id)}" title="${escapeHtml(acc.bankName)} (${escapeHtml(acc.accountNumberMask || last4)})">
                <span class="bank-pill-content">
                  <span class="bank-pill-icon">🏛️</span>
                  <span class="bank-pill-name">${escapeHtml(shortBank)}</span>
                  <span class="bank-pill-digits">(${last4})</span>
                </span>
              </button>
            `;
          }).join('')}
        </div>
      </div>
    `;
  } else if (accounts.length > 2) {
    accountSwitcherHtml = `
      <div class="account-switcher-wrapper">
        <div class="account-switcher-label">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>
          <span>Active Account</span>
        </div>
        <div class="account-switcher-dropdown-container">
          <select id="dashboard-account-select" class="account-switcher-select">
            <option value="all" ${activeAccount === 'all' ? 'selected' : ''}>All Accounts (${accounts.length})</option>
            ${accounts.map(acc => {
              const digits = String(acc.accountNumberMask || '').replace(/[^0-9]/g, '');
              const last4 = digits ? digits.slice(-4) : '••••';
              return `
                <option value="${escapeHtml(acc.id)}" ${activeAccount === String(acc.id) ? 'selected' : ''}>
                  ${escapeHtml(acc.bankName)} (${last4}) — ${formatINR(acc.balance || 0, true)}
                </option>
              `;
            }).join('')}
          </select>
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    ${!user ? `
      <!-- Logged-out Zero State Notice -->
      <div class="glass-card" style="margin-bottom: 16px; border: 1px solid var(--border-medium); background: var(--bg-surface-elevated); display: flex; align-items: center; justify-content: space-between; padding: 12px 16px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 1.2rem;">🔒</span>
          <div>
            <div style="font-size: var(--text-xs); font-weight: 700; color: var(--text-primary);">Logged Out (Values at ₹0)</div>
            <div style="font-size: 11px; color: var(--text-muted);">Sign in to unlock your private vault & transactions.</div>
          </div>
        </div>
        <button id="banner-signin-btn" class="btn btn-primary btn-sm" style="font-size: 11px; padding: 5px 12px;">Sign In</button>
      </div>
    ` : `
      <!-- Personal Greeting & Status Bar (with Google PFP avatar if present) -->
      <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
        <div style="display: flex; align-items: center; gap: 12px;">
          ${(user && (user.picture || user.photoURL)) ? `
            <img src="${escapeHtml(user.picture || user.photoURL)}" alt="Profile" style="width: 44px; height: 44px; border-radius: 50%; object-fit: cover; border: 2px solid var(--accent-primary); box-shadow: var(--shadow-glow-terracotta);" />
          ` : ''}
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <h2 style="font-family: var(--font-family-display); font-size: var(--text-2xl); font-weight: 800; color: var(--text-primary); margin: 0; letter-spacing: -0.02em;">
                Ciao, ${escapeHtml(userName)}!
              </h2>
              <span style="font-size: 1.1rem;">✨</span>
            </div>
            <p style="font-size: var(--text-xs); color: var(--text-muted); margin: 3px 0 0 0;">
              ${selectedAccountObj ? `${escapeHtml(selectedAccountObj.bankName)} (${selectedAccountObj.accountNumberMask})` : 'Track your income, expenses & statement flow'}
            </p>
          </div>
        </div>
        <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); background: var(--bg-surface-elevated); padding: 5px 12px; border-radius: var(--radius-full); border: 1px solid var(--border-medium); white-space: nowrap;">
          ${todayFormatted}
        </div>
      </div>
    `}

    <!-- Account Switcher at Top of Dashboard (Toggle if 2, Dropdown if >2, None if <=1) -->
    ${accountSwitcherHtml}

    <!-- Net Worth Hero Card -->
    <div class="hero-balance-card">
      <div class="hero-label-row">
        <span class="hero-label">
          ${selectedAccountObj ? `${escapeHtml(selectedAccountObj.bankName)} Balance` : 'Current Balance'}
        </span>
        <button id="toggle-privacy-btn" class="hero-mask-toggle" title="Toggle balance privacy">
          ${isPrivacy ? '👁️ Show' : '🙈 Hide'}
        </button>
      </div>
      <div class="hero-amount" id="hero-net-worth">${displayBalance}</div>
      <div class="hero-cashflow-grid">
        <div class="cashflow-item">
          <span class="cashflow-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"></polyline><polyline points="17 6 23 6 23 12"></polyline></svg>
            Period Inflow
          </span>
          <span class="cashflow-value cashflow-income">${displayIncome}</span>
        </div>
        <div class="cashflow-item">
          <span class="cashflow-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>
            Period Outflow
          </span>
          <span class="cashflow-value cashflow-expense">${displayExpense}</span>
        </div>
      </div>
    </div>

    <!-- Quick Actions Row (Warm Tactile Style) -->
    <div class="quick-actions-row">
      <button class="quick-action-btn" data-action="add">
        <div class="quick-action-icon" style="background: rgba(232, 96, 52, 0.12); color: var(--accent-primary);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </div>
        <span class="quick-action-label">Log Spend</span>
      </button>

      <button class="quick-action-btn" data-action="statements">
        <div class="quick-action-icon" style="background: rgba(61, 107, 82, 0.12); color: var(--accent-sage);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
        </div>
        <span class="quick-action-label">Statements</span>
      </button>

      <button class="quick-action-btn" data-action="gmail-sync">
        <div class="quick-action-icon" style="background: rgba(217, 130, 43, 0.12); color: var(--accent-ochre);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        </div>
        <span class="quick-action-label">Gmail Sync</span>
      </button>

      <button class="quick-action-btn" data-action="budgets">
        <div class="quick-action-icon" style="background: rgba(46, 125, 91, 0.12); color: var(--signal-income);">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
        </div>
        <span class="quick-action-label">Budgets</span>
      </button>
    </div>

    <!-- Spending Sectionization & Category Breakdown Card -->
    <div class="card chart-card">
      <div class="spending-period-bar">
        <div>
          <h3 class="section-title">Spending Breakdown</h3>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
            ${escapeHtml(periodLabel)} • ${categorySections.length} ${categorySections.length === 1 ? 'Category' : 'Categories'}
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 8px;">
          ${currentPeriodFilter === 'month' && availableMonths.length > 0 ? `
            <select id="spending-month-select" class="form-select" style="padding: 4px 10px; font-size: 11px; height: 30px; border-radius: var(--radius-sm); background: var(--bg-surface-elevated); color: var(--text-primary); border: 1px solid var(--border-medium); cursor: pointer; font-weight: 600;">
              ${availableMonths.map(m => {
                const parts = m.split('-');
                const d = new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, 1);
                const label = d.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
                const count = monthStats[m] ? monthStats[m].count : 0;
                return `<option value="${m}" ${selectedMonth === m ? 'selected' : ''}>${label} (${count})</option>`;
              }).join('')}
            </select>
          ` : ''}

          <div class="spending-period-tabs">
            <button type="button" class="spending-period-btn ${currentPeriodFilter === 'month' ? 'active' : ''}" data-period="month">
              Monthly
            </button>
            <button type="button" class="spending-period-btn ${currentPeriodFilter === 'all' ? 'active' : ''}" data-period="all">
              All Time
            </button>
          </div>
        </div>
      </div>

      <!-- Interactive Chart with Graph Type Switcher -->
      <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 14px; margin-bottom: 8px; padding: 0 4px;">
        <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted);">
          Visual Spend Breakdown
        </span>
        <button type="button" id="toggle-chart-type-btn" class="btn btn-secondary btn-sm" style="font-size: 11px; padding: 3px 10px; border-radius: var(--radius-full); display: flex; align-items: center; gap: 6px; font-weight: 600;" title="Switch between Donut Graph and Bar Graph">
          <span>${currentChartType === 'donut' ? '🍩 Donut Graph' : '📊 Bar Graph'}</span>
          <span style="font-size: 10px; color: var(--accent-primary);">⇄ Change</span>
        </button>
      </div>

      <div class="chart-container" style="min-height: 220px; position: relative;">
        <canvas id="categoryChart" width="340" height="220"></canvas>
      </div>

      <!-- Sectionized Category Progress List (Modern Fintech View) -->
      <div class="spending-breakdown-list">
        ${categorySections.length === 0 ? `
          <div style="text-align: center; color: var(--text-muted); font-size: var(--text-xs); padding: 16px;">
            No spending recorded for this period.
          </div>
        ` : categorySections.map(c => `
          <div class="spending-cat-row" data-category="${escapeHtml(c.category)}" title="Filter ledger by ${escapeHtml(c.category)}">
            <div class="spending-cat-header">
              <div class="spending-cat-identity">
                <div class="spending-cat-icon" style="background: ${c.meta.bg}; color: ${c.meta.color};">
                  ${c.meta.icon}
                </div>
                <div>
                  <div class="spending-cat-title">${escapeHtml(c.category)}</div>
                  <div class="spending-cat-count">${c.count} ${c.count === 1 ? 'transaction' : 'transactions'}</div>
                </div>
              </div>
              <div class="spending-cat-figures">
                <div class="spending-cat-amount">${isPrivacy ? '••••' : formatINR(c.amount)}</div>
                <div class="spending-cat-percent">${c.percent}%</div>
              </div>
            </div>
            <div class="spending-progress-track">
              <div class="spending-progress-fill" style="width: ${Math.min(100, Math.max(4, c.percent))}%; background: ${c.meta.color};"></div>
            </div>
          </div>
        `).join('')}
      </div>
    </div>

    <!-- Recent Transactions -->
    <div class="section-header">
      <h3 class="section-title">Recent Transactions</h3>
      <span class="section-link" id="view-all-txns-link">See All →</span>
    </div>
    <div class="recent-txns-list" id="dashboard-txns-list">
      ${recentTxns.length === 0 ? '<p style="color: var(--text-muted); font-size: var(--text-xs); text-align: center; padding: 20px;">No transactions recorded yet.</p>' : ''}
      ${recentTxns.map(t => renderTxnItemHtml(t, isPrivacy)).join('')}
    </div>
  `;

  // Attach event handlers
  const bannerSignIn = container.querySelector('#banner-signin-btn');
  if (bannerSignIn) {
    bannerSignIn.onclick = () => { window.location.hash = '#/login'; };
  }

  const privacyBtn = container.querySelector('#toggle-privacy-btn');
  if (privacyBtn) {
    privacyBtn.onclick = async () => {
      await BiometricAuthService.togglePrivacyMode();
      renderDashboard(container);
    };
  }

  // Handle 2-account toggle pill buttons
  container.querySelectorAll('.account-toggle-pill').forEach(btn => {
    btn.onclick = () => {
      const accId = btn.dataset.accountId;
      if (accId) {
        setActiveAccountFilter(accId);
        renderDashboard(container);
      }
    };
  });

  // Handle >2 account dropdown selector
  const accSelect = container.querySelector('#dashboard-account-select');
  if (accSelect) {
    accSelect.onchange = (e) => {
      setActiveAccountFilter(e.target.value);
      renderDashboard(container);
    };
  }

  // Toggle chart type button (Donut vs Cute Bars)
  const toggleChartBtn = container.querySelector('#toggle-chart-type-btn');
  if (toggleChartBtn) {
    toggleChartBtn.onclick = () => {
      currentChartType = currentChartType === 'donut' ? 'bar' : 'donut';
      renderDashboard(container);
    };
  }

  // Quick actions
  container.querySelectorAll('.quick-action-btn').forEach(btn => {
    btn.onclick = () => {
      const action = btn.dataset.action;
      if (action === 'add') window.location.hash = '#/add';
      else if (action === 'statements' || action === 'gmail-sync') window.location.hash = '#/accounts';
      else if (action === 'budgets') window.location.hash = '#/budgets';
    };
  });

  // Period filter tabs
  container.querySelectorAll('.spending-period-btn').forEach(btn => {
    btn.onclick = () => {
      currentPeriodFilter = btn.dataset.period;
      renderDashboard(container);
    };
  });

  const monthSelect = container.querySelector('#spending-month-select');
  if (monthSelect) {
    monthSelect.onchange = (e) => {
      selectedMonth = e.target.value;
      renderDashboard(container);
    };
  }

  // Clicking category row filters ledger to that category
  container.querySelectorAll('.spending-cat-row').forEach(row => {
    row.onclick = () => {
      const cat = row.dataset.category;
      if (cat) {
        window.location.hash = `#/transactions?category=${encodeURIComponent(cat)}`;
      }
    };
  });

  const viewAllLink = container.querySelector('#view-all-txns-link');
  if (viewAllLink) {
    viewAllLink.onclick = () => { window.location.hash = '#/transactions'; };
  }

  // Transaction quick-edit modal for Recent Transactions
  container.querySelectorAll('#dashboard-txns-list .txn-item').forEach(item => {
    item.onclick = () => {
      const id = item.dataset.id;
      const targetTxn = allTxns.find(t => String(t.id) === String(id));
      if (targetTxn) {
        openEditTransactionModal(targetTxn, () => renderDashboard(container));
      }
    };
  });

  // Initialize Category Breakdown Chart with crisp visibility for 1% / 5% micro-slices
  initSpendingChart(categorySections, periodExpense, isPrivacy);
}

function renderTxnItemHtml(t, isPrivacy) {
  const isExp = t.type === 'expense';
  const displayAmt = isPrivacy ? '••••' : (isExp ? '-' : '+') + formatINR(t.amount);
  const meta = getCategoryMeta(t.category);

  return `
    <div class="txn-item" data-id="${t.id}" style="cursor: pointer;" title="Tap to change category, emoji, or type">
      <div class="txn-icon" style="background: ${meta.bg}; color: ${meta.color};">${meta.icon}</div>
      <div class="txn-details">
        <div class="txn-merchant" style="display: flex; align-items: center; gap: 6px;">
          <span>${escapeHtml(t.merchant || t.category || 'Transaction')}</span>
          <span style="font-size: 11px; color: var(--text-muted); opacity: 0.6;">✏️</span>
        </div>
        <div class="txn-meta">
          <span>${t.date || 'Today'}</span>
          <span>•</span>
          <span>${escapeHtml(t.category || 'General')}</span>
          <span>•</span>
          <span class="sync-pill ${t.synced ? 'synced' : 'pending'}">
            ${t.synced ? '✓ Synced' : '⏳ Offline'}
          </span>
        </div>
      </div>
      <div class="txn-amount-col">
        <div class="txn-amount ${isExp ? 'expense' : 'income'}">${displayAmt}</div>
      </div>
    </div>
  `;
}

function initSpendingChart(categorySections, periodExpense, isPrivacy) {
  const canvas = document.getElementById('categoryChart');
  if (!canvas) return;

  const labels = categorySections.map(c => c.category);
  const data = categorySections.map(c => c.amount);
  const colors = categorySections.map(c => c.meta.color);

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const isEmpty = labels.length === 0 || data.every(v => v === 0);
  const chartLabels = isEmpty ? ['No Expenses'] : labels;
  const chartData = isEmpty ? [1] : data;
  const chartColors = isEmpty ? [isLight ? '#CBD5E1' : '#3E4452'] : colors;

  const chartContainer = canvas.parentElement;
  const isFewCategories = !isEmpty && chartLabels.length <= 3;
  if (chartContainer) {
    if (currentChartType === 'bar' && isFewCategories) {
      // Group bars tightly together in center when there are only 1, 2, or 3 categories
      const groupedWidth = chartLabels.length === 1 ? '180px' : (chartLabels.length === 2 ? '300px' : '420px');
      chartContainer.style.maxWidth = groupedWidth;
      chartContainer.style.marginLeft = 'auto';
      chartContainer.style.marginRight = 'auto';
    } else {
      chartContainer.style.maxWidth = currentChartType === 'donut' ? '380px' : '100%';
      chartContainer.style.marginLeft = 'auto';
      chartContainer.style.marginRight = 'auto';
    }
  }

  if (window.Chart) {
    if (chartInstance) chartInstance.destroy();
    window.Chart.defaults.color = isLight ? '#11120E' : '#FFFFFF';

    const ctx = canvas.getContext('2d');

    if (currentChartType === 'bar' && !isEmpty) {
      // Bar Graph View (tightly grouped for few categories)
      chartInstance = new window.Chart(ctx, {
        type: 'bar',
        data: {
          labels: chartLabels.map(l => {
            const sec = categorySections.find(s => s.category === l);
            return (sec && sec.meta ? sec.meta.icon + ' ' : '') + l;
          }),
          datasets: [{
            data: chartData,
            backgroundColor: chartColors,
            borderRadius: 8,
            borderSkipped: false,
            barPercentage: isFewCategories ? 0.65 : 0.85,
            categoryPercentage: isFewCategories ? 0.75 : 0.8,
            barThickness: isFewCategories ? 36 : Math.min(26, Math.max(14, Math.floor(220 / (chartLabels.length || 1)))),
            maxBarThickness: 40
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            duration: 550,
            easing: 'easeOutQuart'
          },
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context) => ` ${formatINR(context.raw)}`
              }
            }
          },
          scales: {
            x: {
              grid: { display: false },
              ticks: {
                color: isLight ? '#11120E' : '#FFFFFF',
                font: { family: 'Plus Jakarta Sans', size: 10.5, weight: '600' },
                maxRotation: 32,
                minRotation: 0
              }
            },
            y: {
              grid: {
                color: isLight ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.06)'
              },
              ticks: {
                color: isLight ? '#3E3D36' : '#CBD5E1',
                font: { family: 'Plus Jakarta Sans', size: 10, weight: '600' },
                callback: (v) => '₹' + v
              }
            }
          }
        }
      });
    } else {
      // Completely Redesigned Donut Chart:
      // Physical wedge separation (spacing: 4), rounded slice ends (borderRadius: 6),
      // center cutout text display, and clear percentage labels in legend for 1% / 5% slices.
      const centerCutoutPlugin = {
        id: 'centerSpendText',
        beforeDraw: (chart) => {
          if (currentChartType !== 'donut') return;
          const { ctx, width, height } = chart;
          ctx.save();
          const meta = chart.getDatasetMeta(0);
          const cx = (meta && meta.data && meta.data[0]) ? meta.data[0].x : width / 2;
          const cy = (meta && meta.data && meta.data[0]) ? meta.data[0].y : height / 2;

          const textColor = isLight ? '#11120E' : '#FFFFFF';
          const subColor = isLight ? '#5C5950' : '#94A3B8';

          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';

          // "TOTAL SPENT" Header
          ctx.font = '700 10px "Plus Jakarta Sans", sans-serif';
          ctx.fillStyle = subColor;
          ctx.fillText('TOTAL SPEND', cx, cy - 9);

          // Value in Center
          ctx.font = '800 15px "Space Grotesk", "Plus Jakarta Sans", sans-serif';
          ctx.fillStyle = textColor;
          const centerText = isPrivacy ? '••••' : (isEmpty ? '₹0' : formatINR(periodExpense, true));
          ctx.fillText(centerText, cx, cy + 9);

          ctx.restore();
        }
      };

      chartInstance = new window.Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: chartLabels,
          datasets: [{
            data: chartData,
            backgroundColor: chartColors,
            borderColor: isLight ? '#FFFFFF' : '#272A32',
            borderWidth: isEmpty ? 0 : 2,
            spacing: isEmpty ? 0 : 4,         // Physical gap between slices for extreme micro-slice visibility
            borderRadius: isEmpty ? 0 : 6,    // Rounded pill ends
            hoverOffset: isEmpty ? 0 : 8
          }]
        },
        plugins: [centerCutoutPlugin],
        options: {
          color: isLight ? '#11120E' : '#FFFFFF',
          responsive: true,
          maintainAspectRatio: false,
          cutout: '72%',
          animation: {
            duration: 550,
            easing: 'easeOutQuart'
          },
          plugins: {
            legend: {
              position: 'right',
              labels: {
                boxWidth: 8,
                boxHeight: 8,
                usePointStyle: true,
                pointStyle: 'circle',
                color: isLight ? '#11120E' : '#FFFFFF',
                fontColor: isLight ? '#11120E' : '#FFFFFF',
                font: { family: 'Plus Jakarta Sans', size: 11, weight: '600' },
                padding: 10,
                generateLabels: (chart) => {
                  const datasets = chart.data.datasets;
                  return chart.data.labels.map((label, i) => {
                    const val = datasets[0].data[i];
                    const pct = periodExpense > 0 ? Math.max(1, Math.round((val / periodExpense) * 100)) : 0;
                    const sec = categorySections.find(s => s.category === label);
                    const icon = sec?.meta?.icon ? `${sec.meta.icon} ` : '';
                    // Display exact percentage prominently so 1% and 5% are immediately distinguishable!
                    const textLabel = isEmpty ? label : `${icon}${label} • ${pct}%`;
                    return {
                      text: textLabel,
                      fillStyle: datasets[0].backgroundColor[i],
                      fontColor: isLight ? '#11120E' : '#FFFFFF',
                      strokeStyle: 'transparent',
                      lineWidth: 0,
                      hidden: isNaN(datasets[0].data[i]) || chart.getDatasetMeta(0).data[i]?.hidden,
                      index: i
                    };
                  });
                }
              }
            },
            tooltip: {
              backgroundColor: isLight ? '#FFFFFF' : '#1E2126',
              titleColor: isLight ? '#11120E' : '#FFFFFF',
              bodyColor: isLight ? '#3E3D36' : '#CBD5E1',
              borderColor: isLight ? '#CBD5E1' : '#3E4452',
              borderWidth: 1,
              padding: 10,
              cornerRadius: 8,
              callbacks: {
                label: (context) => {
                  if (isEmpty) return ' No expenses recorded (₹0)';
                  const val = context.raw || 0;
                  const pct = periodExpense > 0 ? Math.round((val / periodExpense) * 100) : 0;
                  return ` ${context.label}: ${formatINR(val)} (${pct}%)`;
                }
              }
            }
          }
        }
      });
    }
  } else {
    renderCanvasChartFallback(canvas, chartLabels, chartData, chartColors, isEmpty, currentChartType, periodExpense, isPrivacy);
  }
}

function renderCanvasChartFallback(canvas, labels, data, colors, isEmpty, chartType, periodExpense, isPrivacy) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';

  if (chartType === 'bar' && !isEmpty) {
    const maxVal = Math.max(...data, 1);
    const isFew = labels.length <= 3;
    const barWidth = isFew ? 32 : Math.min(24, (w - 40) / labels.length - 8);
    const gap = isFew ? 18 : 8;
    const totalW = labels.length * barWidth + (labels.length - 1) * gap;
    const startX = isFew ? Math.max(16, (w - totalW) / 2) : 20;
    const baseLine = h - 25;

    data.forEach((val, i) => {
      const x = startX + i * (barWidth + gap);
      const barH = (val / maxVal) * (h - 50);
      const y = baseLine - barH;

      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x, y, barWidth, barH, [6, 6, 0, 0]) : ctx.rect(x, y, barWidth, barH);
      ctx.fill();
    });
    return;
  }

  // Redesigned Donut fallback with angular spacing gaps & center spend text
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(cx, cy) - 20;
  const innerRadius = radius * 0.72;

  if (isEmpty) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.arc(cx, cy, innerRadius, Math.PI * 2, 0, true);
    ctx.fillStyle = isLight ? '#E2E8F0' : '#3E4452';
    ctx.fill();
    return;
  }

  const total = data.reduce((a, b) => a + b, 0);
  let startAngle = -Math.PI / 2;
  const sliceGap = 0.05; // Angular gap between slices for micro-slice separation

  data.forEach((val, i) => {
    const sliceAngle = (val / total) * Math.PI * 2;
    const effectiveAngle = Math.max(0.04, sliceAngle - sliceGap);

    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle + sliceGap / 2, startAngle + sliceGap / 2 + effectiveAngle);
    ctx.arc(cx, cy, innerRadius, startAngle + sliceGap / 2 + effectiveAngle, startAngle + sliceGap / 2, true);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();

    startAngle += sliceAngle;
  });

  // Center cutout text in canvas fallback
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = '700 10px sans-serif';
  ctx.fillStyle = isLight ? '#5C5950' : '#94A3B8';
  ctx.fillText('TOTAL SPEND', cx, cy - 8);

  ctx.font = '800 14px sans-serif';
  ctx.fillStyle = isLight ? '#11120E' : '#FFFFFF';
  ctx.fillText(isPrivacy ? '••••' : formatINR(periodExpense, true), cx, cy + 8);
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Reactively re-render dashboard and charts when theme is toggled
if (typeof window !== 'undefined' && !window._sbafaThemeDashboardBound) {
  window._sbafaThemeDashboardBound = true;
  window.addEventListener('sbafa:theme-changed', () => {
    const dashboardScreen = document.getElementById('screen-dashboard');
    if (dashboardScreen && dashboardScreen.classList.contains('active')) {
      renderDashboard(dashboardScreen);
    }
  });
}


