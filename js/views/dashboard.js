/**
 * Dashboard View - SBAFA Financial Enclave
 * Total net worth, period cashflow, intelligent spending sectionization,
 * interactive category breakdown bars, and recent activity.
 */

import { db, formatINR, getCurrentUser, getUserAccounts, getUserTransactions } from '../db.js';
import { BiometricAuthService } from '../auth.js';
import { getCategoryMeta } from '../parsers/categorizer.js';
import { openEditTransactionModal } from '../components/edit-category-modal.js';

let chartInstance = null;
let currentPeriodFilter = 'month'; // 'month' | 'all'
let selectedMonth = null;
let currentChartType = 'donut'; // 'donut' | 'bar'

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

  // Build sorted sectionized category list (Strict Descending Sort: Highest Spend First)
  const categorySections = Object.values(categoryMap)
    .filter(c => c.amount > 0)
    .sort((a, b) => b.amount - a.amount)
    .map(c => {
      const meta = getCategoryMeta(c.category);
      const percent = periodExpense > 0 ? Math.round((c.amount / periodExpense) * 100) : 0;
      return {
        ...c,
        meta,
        percent
      };
    });

  const displayBalance = isPrivacy ? '••••••••' : formatINR(totalBalance);
  const displayIncome = isPrivacy ? '••••' : formatINR(periodIncome);
  const displayExpense = isPrivacy ? '••••' : formatINR(periodExpense);

  const recentTxns = allTxns.slice(0, 5);

  const todayFormatted = new Date().toLocaleDateString('en-IN', {
    weekday: 'short',
    day: 'numeric',
    month: 'short'
  });
  const userName = user ? (user.name || 'Friend') : 'Guest';

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
              Track your income, expenses &amp; statement flow
            </p>
          </div>
        </div>
        <div style="font-size: 11px; font-weight: 700; color: var(--text-muted); background: var(--bg-surface-elevated); padding: 5px 12px; border-radius: var(--radius-full); border: 1px solid var(--border-medium); white-space: nowrap;">
          ${todayFormatted}
        </div>
      </div>
    `}

    <!-- Net Worth Hero Card -->
    <div class="hero-balance-card">
      <div class="hero-label-row">
        <span class="hero-label">Current Balance</span>
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

      <!-- Interactive Chart with Cute Graph Type Switcher -->
      <div style="display: flex; align-items: center; justify-content: space-between; margin-top: 14px; margin-bottom: 8px; padding: 0 4px;">
        <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted);">
          Visual Spend Breakdown
        </span>
        <button type="button" id="toggle-chart-type-btn" class="btn btn-secondary btn-sm" style="font-size: 11px; padding: 3px 10px; border-radius: var(--radius-full); display: flex; align-items: center; gap: 6px; font-weight: 600;" title="Click to change graph type">
          <span>${currentChartType === 'donut' ? '🍩 Donut' : '📊 Cute Bars'}</span>
          <span style="font-size: 10px; color: var(--accent-primary);">⇄ Change</span>
        </button>
      </div>

      <div class="chart-container" style="min-height: 200px;">
        <canvas id="categoryChart" width="340" height="200"></canvas>
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

  // Initialize Category Breakdown Chart
  initSpendingChart(categorySections);
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
  const chartColors = isEmpty ? [isLight ? '#E2E8F0' : '#333742'] : colors;

  if (window.Chart) {
    if (chartInstance) chartInstance.destroy();

    const ctx = canvas.getContext('2d');

    if (currentChartType === 'bar' && !isEmpty) {
      // Cute Rounded Bar Graph View
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
            barThickness: Math.min(26, Math.max(14, Math.floor(220 / (chartLabels.length || 1)))),
            maxBarThickness: 32
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          animation: {
            duration: 650,
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
                color: isLight ? '#475569' : '#CBD5E1',
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
                color: isLight ? '#64748B' : '#94A3B8',
                font: { family: 'Plus Jakarta Sans', size: 10 },
                callback: (v) => '₹' + v
              }
            }
          }
        }
      });
    } else {
      // Donut view without thick border lines (Clean & Seamless)
      chartInstance = new window.Chart(ctx, {
        type: 'doughnut',
        data: {
          labels: chartLabels,
          datasets: [{
            data: chartData,
            backgroundColor: chartColors,
            borderColor: 'transparent',
            borderWidth: 0,
            hoverOffset: isEmpty ? 0 : 5
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '72%',
          animation: {
            duration: 650,
            easing: 'easeOutQuart'
          },
          plugins: {
            legend: {
              position: 'right',
              labels: {
                boxWidth: 10,
                color: isLight ? '#334155' : '#CBD5E1',
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
    }
  } else {
    renderCanvasChartFallback(canvas, chartLabels, chartData, chartColors, isEmpty, currentChartType);
  }
}

function renderCanvasChartFallback(canvas, labels, data, colors, isEmpty, chartType) {
  const ctx = canvas.getContext('2d');
  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  if (chartType === 'bar' && !isEmpty) {
    // Cute Canvas Bar Fallback
    const maxVal = Math.max(...data, 1);
    const barWidth = Math.min(24, (w - 40) / labels.length - 8);
    const startX = 20;
    const baseLine = h - 25;

    data.forEach((val, i) => {
      const x = startX + i * (barWidth + 8);
      const barH = (val / maxVal) * (h - 50);
      const y = baseLine - barH;

      ctx.fillStyle = colors[i % colors.length];
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(x, y, barWidth, barH, [6, 6, 0, 0]) : ctx.rect(x, y, barWidth, barH);
      ctx.fill();
    });
    return;
  }

  // Donut fallback without thick stroke lines
  const cx = w / 2;
  const cy = h / 2;
  const radius = Math.min(cx, cy) - 20;
  const innerRadius = radius * 0.72;

  if (isEmpty) {
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.arc(cx, cy, innerRadius, Math.PI * 2, 0, true);
    ctx.fillStyle = '#323742';
    ctx.fill();
    return;
  }

  const total = data.reduce((a, b) => a + b, 0);
  let startAngle = -Math.PI / 2;

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
