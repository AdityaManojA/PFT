/**
 * Dashboard View - SBAFA Financial Enclave
 * Total net worth, period cashflow, intelligent spending sectionization,
 * interactive category breakdown bars, and recent activity.
 */

import { db, formatINR, getCurrentUser, getUserAccounts, getUserTransactions } from '../db.js';
import { BiometricAuthService } from '../auth.js';
import { getCategoryMeta } from '../parsers/categorizer.js';

let chartInstance = null;
let currentPeriodFilter = 'auto'; // 'auto' | 'month' | 'all'

export async function renderDashboard(container) {
  const isPrivacy = await BiometricAuthService.getPrivacyMode();
  const user = await getCurrentUser();
  const userId = user ? user.id : null;

  // Fetch user-scoped accounts to calculate net worth (0 if logged out)
  const accounts = userId ? await getUserAccounts(userId) : [];
  const totalBalance = accounts.reduce((acc, a) => acc + (a.balance || 0), 0);

  // Fetch all transactions for this user
  const allTxns = userId ? await getUserTransactions(userId) : [];
  const now = new Date();
  const currentMonthPrefix = now.toISOString().slice(0, 7); // YYYY-MM
  const monthTxns = allTxns.filter(t => t.date && t.date.startsWith(currentMonthPrefix));

  // Determine active transactions based on period filter
  let activeTxns = [];
  let periodLabel = 'This Month';

  if (currentPeriodFilter === 'month') {
    activeTxns = monthTxns;
    periodLabel = 'This Month (' + now.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) + ')';
  } else if (currentPeriodFilter === 'all') {
    activeTxns = allTxns;
    periodLabel = 'All Time (' + allTxns.length + ' entries)';
  } else {
    // 'auto' mode: If current month has records, use current month.
    // If current month is empty but statements/past transactions exist, auto-select all records
    if (monthTxns.length > 0) {
      activeTxns = monthTxns;
      periodLabel = 'This Month (' + now.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }) + ')';
    } else if (allTxns.length > 0) {
      activeTxns = allTxns;
      // Identify latest transaction date for label
      const sortedDates = [...allTxns].filter(t => t.date).sort((a, b) => b.date.localeCompare(a.date));
      const latestDate = sortedDates[0]?.date ? new Date(sortedDates[0].date) : now;
      const latestMonthStr = latestDate.toLocaleDateString('en-IN', { month: 'short', year: 'numeric' });
      periodLabel = `Statement Activity (${latestMonthStr} / All)`;
    } else {
      activeTxns = [];
      periodLabel = 'This Month';
    }
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

  // Build sorted sectionized category list
  const categorySections = Object.values(categoryMap)
    .map(c => {
      const meta = getCategoryMeta(c.category);
      const percent = periodExpense > 0 ? (c.amount / periodExpense) * 100 : 0;
      return {
        ...c,
        meta,
        percent: Math.round(percent * 10) / 10
      };
    })
    .sort((a, b) => b.amount - a.amount);

  // Recent 5 transactions
  const recentTxns = allTxns
    .sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at))
    .slice(0, 5);

  const displayBalance = isPrivacy ? '••••••••' : formatINR(totalBalance);
  const displayIncome = isPrivacy ? '••••••' : formatINR(periodIncome);
  const displayExpense = isPrivacy ? '••••••' : formatINR(periodExpense);

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
    ` : ''}

    <!-- Net Worth Hero Card -->
    <div class="hero-balance-card">
      <div class="hero-label-row">
        <span class="hero-label">Total Net Worth</span>
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

    <!-- Quick Actions Row -->
    <div class="quick-actions-row">
      <button class="quick-action-btn" data-action="add">
        <div class="quick-action-icon" style="background: rgba(16, 185, 129, 0.15); color: #10B981;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </div>
        <span class="quick-action-label">Log Spend</span>
      </button>

      <button class="quick-action-btn" data-action="statements">
        <div class="quick-action-icon" style="background: rgba(59, 130, 246, 0.15); color: #3B82F6;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line></svg>
        </div>
        <span class="quick-action-label">Statements</span>
      </button>

      <button class="quick-action-btn" data-action="gmail-sync">
        <div class="quick-action-icon" style="background: rgba(234, 67, 53, 0.15); color: #EA4335;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
        </div>
        <span class="quick-action-label">Gmail Sync</span>
      </button>

      <button class="quick-action-btn" data-action="budgets">
        <div class="quick-action-icon" style="background: rgba(245, 158, 11, 0.15); color: #F59E0B;">
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
            ${escapeHtml(periodLabel)}
          </div>
        </div>

        <div class="spending-period-tabs">
          <button type="button" class="spending-period-btn ${currentPeriodFilter === 'auto' ? 'active' : ''}" data-period="auto">
            Auto
          </button>
          <button type="button" class="spending-period-btn ${currentPeriodFilter === 'month' ? 'active' : ''}" data-period="month">
            This Month
          </button>
          <button type="button" class="spending-period-btn ${currentPeriodFilter === 'all' ? 'active' : ''}" data-period="all">
            All Time
          </button>
        </div>
      </div>

      <!-- Donut Visual Chart -->
      <div class="chart-container">
        <canvas id="categoryChart" width="340" height="190"></canvas>
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

  // Initialize Category Breakdown Chart
  initSpendingChart(categorySections);
}

function renderTxnItemHtml(t, isPrivacy) {
  const isExp = t.type === 'expense';
  const displayAmt = isPrivacy ? '••••' : (isExp ? '-' : '+') + formatINR(t.amount);
  const meta = getCategoryMeta(t.category);

  return `
    <div class="txn-item">
      <div class="txn-icon" style="background: ${meta.bg}; color: ${meta.color};">${meta.icon}</div>
      <div class="txn-details">
        <div class="txn-merchant">${escapeHtml(t.merchant || t.category || 'Transaction')}</div>
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

function initSpendingChart(categorySections) {
  const canvas = document.getElementById('categoryChart');
  if (!canvas) return;

  const labels = categorySections.map(c => c.category);
  const data = categorySections.map(c => c.amount);
  const colors = categorySections.map(c => c.meta.color);

  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  const isEmpty = labels.length === 0 || data.every(v => v === 0);
  const chartLabels = isEmpty ? ['No Expenses (₹0)'] : labels;
  const chartData = isEmpty ? [1] : data;
  const chartColors = isEmpty ? [isLight ? '#E2E8F0' : '#1E293B'] : colors;

  if (window.Chart) {
    if (chartInstance) chartInstance.destroy();

    const ctx = canvas.getContext('2d');
    chartInstance = new window.Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: chartLabels,
        datasets: [{
          data: chartData,
          backgroundColor: chartColors,
          borderColor: isLight ? '#FFFFFF' : '#0F172A',
          borderWidth: 3,
          hoverOffset: isEmpty ? 0 : 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '70%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              boxWidth: 10,
              color: isLight ? '#334155' : '#94A3B8',
              font: { family: 'Plus Jakarta Sans', size: 11, weight: '600' },
              padding: 10
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => isEmpty ? ' No expenses recorded (₹0.00)' : ` ${context.label}: ${formatINR(context.raw)}`
            }
          }
        }
      }
    });
  } else {
    renderCanvasDonutFallback(canvas, chartLabels, chartData, isEmpty);
  }
}

function renderCanvasDonutFallback(canvas, labels, data, isEmpty) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(cx, cy) - 20;
  const innerRadius = radius * 0.7;

  if (isEmpty) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.arc(cx, cy, innerRadius, Math.PI * 2, 0, true);
    ctx.fillStyle = '#1E293B';
    ctx.fill();
    return;
  }

  const total = data.reduce((a, b) => a + b, 0);
  let startAngle = -Math.PI / 2;
  const colors = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#F43F5E', '#06B6D4', '#EC4899'];

  data.forEach((val, i) => {
    const sliceAngle = (val / total) * Math.PI * 2;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, startAngle, startAngle + sliceAngle);
    ctx.arc(cx, cy, innerRadius, startAngle + sliceAngle, startAngle, true);
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    startAngle += sliceAngle;
  });
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
