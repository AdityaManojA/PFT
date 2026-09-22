/**
 * Dashboard View
 * Total net worth, monthly cashflow, spending breakdown chart, and recent activity.
 */

import { db, formatINR, getCurrentUser, getUserAccounts, getUserTransactions } from '../db.js';
import { BiometricAuthService } from '../auth.js';

let chartInstance = null;

export async function renderDashboard(container) {
  const isPrivacy = await BiometricAuthService.getPrivacyMode();
  const user = await getCurrentUser();
  const userId = user ? user.id : 'user-aditya';

  // Fetch user-scoped accounts to calculate net worth
  const accounts = await getUserAccounts(userId);
  const totalBalance = accounts.reduce((acc, a) => acc + (a.balance || 0), 0);

  // Fetch this month's transactions for this user
  const now = new Date();
  const currentMonthPrefix = now.toISOString().slice(0, 7); // YYYY-MM
  const allTxns = await getUserTransactions(userId);
  const monthTxns = allTxns.filter(t => t.date && t.date.startsWith(currentMonthPrefix));

  let monthIncome = 0;
  let monthExpense = 0;
  const categoryTotals = {};

  for (const t of monthTxns) {
    if (t.type === 'income') {
      monthIncome += Number(t.amount) || 0;
    } else {
      const amt = Number(t.amount) || 0;
      monthExpense += amt;
      const cat = t.category || 'Other';
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
    }
  }

  // Recent 5 transactions
  const recentTxns = allTxns
    .sort((a, b) => new Date(b.date || b.created_at) - new Date(a.date || a.created_at))
    .slice(0, 5);

  const displayBalance = isPrivacy ? '••••••••' : formatINR(totalBalance);
  const displayIncome = isPrivacy ? '••••••' : formatINR(monthIncome);
  const displayExpense = isPrivacy ? '••••••' : formatINR(monthExpense);

  container.innerHTML = `
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
            This Month Income
          </span>
          <span class="cashflow-value cashflow-income">${displayIncome}</span>
        </div>
        <div class="cashflow-item">
          <span class="cashflow-label">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="23 18 13.5 8.5 8.5 13.5 1 6"></polyline><polyline points="17 18 23 18 23 12"></polyline></svg>
            This Month Spent
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
      <button class="quick-action-btn" data-action="aa-sync">
        <div class="quick-action-icon" style="background: rgba(59, 130, 246, 0.15); color: #3B82F6;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
        </div>
        <span class="quick-action-label">AA Sync</span>
      </button>
      <button class="quick-action-btn" data-action="upload-csv">
        <div class="quick-action-icon" style="background: rgba(139, 92, 246, 0.15); color: #8B5CF6;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
        </div>
        <span class="quick-action-label">Upload CSV</span>
      </button>
      <button class="quick-action-btn" data-action="budgets">
        <div class="quick-action-icon" style="background: rgba(245, 158, 11, 0.15); color: #F59E0B;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="1" x2="12" y2="23"></line><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"></path></svg>
        </div>
        <span class="quick-action-label">Budgets</span>
      </button>
    </div>

    <!-- Monthly Spending Breakdown Chart -->
    <div class="card chart-card">
      <div class="section-header">
        <h3 class="section-title">Spending by Category</h3>
        <span class="badge badge-emerald">This Month</span>
      </div>
      <div class="chart-container">
        <canvas id="categoryChart" width="340" height="190"></canvas>
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
      else if (action === 'aa-sync' || action === 'upload-csv') window.location.hash = '#/accounts';
      else if (action === 'budgets') window.location.hash = '#/budgets';
    };
  });

  const viewAllLink = container.querySelector('#view-all-txns-link');
  if (viewAllLink) {
    viewAllLink.onclick = () => { window.location.hash = '#/transactions'; };
  }

  // Initialize Category Breakdown Chart
  initSpendingChart(categoryTotals);
}

function renderTxnItemHtml(t, isPrivacy) {
  const isExp = t.type === 'expense';
  const displayAmt = isPrivacy ? '••••' : (isExp ? '-' : '+') + formatINR(t.amount);
  const iconMap = {
    Dining: '🍔',
    Groceries: '🛒',
    Shopping: '🛍️',
    Investments: '📈',
    Transport: '🚗',
    Utilities: '⚡',
    Entertainment: '🍿',
    Salary: '💼',
    Health: '💊'
  };
  const icon = iconMap[t.category] || '💳';

  return `
    <div class="txn-item">
      <div class="txn-icon">${icon}</div>
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

function initSpendingChart(categoryTotals) {
  const canvas = document.getElementById('categoryChart');
  if (!canvas) return;

  const labels = Object.keys(categoryTotals);
  const data = Object.values(categoryTotals);

  if (labels.length === 0) {
    labels.push('Groceries', 'Dining', 'Investments', 'Shopping');
    data.push(1260, 1075, 15000, 4349);
  }

  // Check if Chart.js is loaded
  if (window.Chart) {
    if (chartInstance) chartInstance.destroy();

    const ctx = canvas.getContext('2d');
    chartInstance = new window.Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: [
            '#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#F43F5E', '#06B6D4', '#EC4899'
          ],
          borderColor: '#0F172A',
          borderWidth: 3,
          hoverOffset: 6
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
              color: '#94A3B8',
              font: { family: 'Plus Jakarta Sans', size: 11, weight: '500' },
              padding: 10
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => ` ${context.label}: ${formatINR(context.raw)}`
            }
          }
        }
      }
    });
  } else {
    // Fallback Canvas Donut renderer if Chart.js CDN is unavailable
    renderCanvasDonutFallback(canvas, labels, data);
  }
}

function renderCanvasDonutFallback(canvas, labels, data) {
  const ctx = canvas.getContext('2d');
  const width = canvas.width;
  const height = canvas.height;
  const centerX = width * 0.35;
  const centerY = height * 0.5;
  const radius = Math.min(width, height) * 0.4;
  const innerRadius = radius * 0.65;
  const total = data.reduce((a, b) => a + b, 0) || 1;

  ctx.clearRect(0, 0, width, height);

  const colors = ['#10B981', '#3B82F6', '#8B5CF6', '#F59E0B', '#F43F5E', '#06B6D4', '#EC4899'];
  let startAngle = -Math.PI / 2;

  data.forEach((val, i) => {
    const sliceAngle = (val / total) * 2 * Math.PI;
    ctx.beginPath();
    ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
    ctx.arc(centerX, centerY, innerRadius, startAngle + sliceAngle, startAngle, true);
    ctx.closePath();
    ctx.fillStyle = colors[i % colors.length];
    ctx.fill();
    startAngle += sliceAngle;
  });

  // Render text legend on the right
  ctx.font = '11px sans-serif';
  ctx.textAlign = 'left';
  labels.slice(0, 5).forEach((label, i) => {
    const y = 30 + i * 26;
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(width * 0.68, y - 9, 8, 8);
    ctx.fillStyle = '#94A3B8';
    ctx.fillText(`${label} (${formatINR(data[i], true)})`, width * 0.68 + 14, y);
  });
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
