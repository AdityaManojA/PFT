/**
 * SBAFA Notification Center
 * Handles in-app notifications, badge counter, drawer sheet UI,
 * automated month-end reminders, and monthly billing cap breach alerts.
 */

import {
  getCurrentUser,
  getUserNotifications,
  addNotification,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  getUnreadNotificationCount,
  deleteNotification,
  getUserSpendingCap,
  getUserBudgets,
  getUserTransactions,
  formatINR
} from '../db.js';

import { sendLimitBreachEmail, sendMonthEndReminderEmail } from './email-service.js';

let activeFilter = 'all';

/**
 * Initializes the notification center, binds badge updates, and runs background alert checks.
 */
export async function initNotificationCenter() {
  await updateNotificationBadge();
  const user = await getCurrentUser();
  if (user) {
    await runAutomatedChecks(user.id);
  }
}

/**
 * Updates the unread notification badge count in the app header.
 */
export async function updateNotificationBadge() {
  const badge = document.getElementById('header-notif-badge');
  if (!badge) return;

  const user = await getCurrentUser();
  if (!user) {
    badge.style.display = 'none';
    return;
  }

  const count = await getUnreadNotificationCount(user.id);
  if (count > 0) {
    badge.textContent = count > 99 ? '99+' : count;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

/**
 * Opens the modern Notification Center Drawer / Slide Sheet.
 */
export async function openNotificationDrawer() {
  const user = await getCurrentUser();
  const userId = user ? user.id : null;

  const modalContainer = document.getElementById('global-modal-container');
  if (!modalContainer) return;

  const notifications = userId ? await getUserNotifications(userId) : [];
  const unreadCount = userId ? await getUnreadNotificationCount(userId) : 0;

  renderDrawerHtml(modalContainer, notifications, unreadCount, userId);
}

function renderDrawerHtml(modalContainer, notifications, unreadCount, userId) {
  // Apply category filter
  let filtered = notifications;
  if (activeFilter === 'reminders') {
    filtered = notifications.filter(n => n.type === 'reminder');
  } else if (activeFilter === 'caps') {
    filtered = notifications.filter(n => n.type === 'cap_breach' || n.type === 'cap_warning');
  }

  modalContainer.innerHTML = `
    <div class="modal-backdrop active" id="notif-drawer-backdrop" style="justify-content: flex-end; align-items: stretch; padding: 0;">
      <div class="notif-drawer">
        <!-- Drawer Header -->
        <div class="notif-drawer-header">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div class="notif-drawer-icon">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
                <path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
              </svg>
            </div>
            <div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <h3 style="margin: 0; font-size: 16px; font-weight: 700;">Notification Center</h3>
                ${unreadCount > 0 ? `<span class="badge badge-emerald" style="font-size: 10px; padding: 2px 6px;">${unreadCount} Unread</span>` : ''}
              </div>
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Monthly reminders & spending alerts</div>
            </div>
          </div>
          <button id="close-notif-drawer-btn" class="header-icon-btn" title="Close" style="width: 32px; height: 32px;">✕</button>
        </div>

        <!-- Filter & Actions Bar -->
        <div class="notif-filter-bar">
          <div class="notif-filter-tabs">
            <button class="notif-filter-btn ${activeFilter === 'all' ? 'active' : ''}" data-filter="all">All</button>
            <button class="notif-filter-btn ${activeFilter === 'reminders' ? 'active' : ''}" data-filter="reminders">Reminders</button>
            <button class="notif-filter-btn ${activeFilter === 'caps' ? 'active' : ''}" data-filter="caps">Billing Caps</button>
          </div>
          ${unreadCount > 0 ? `
            <button id="mark-all-read-btn" class="notif-action-text-btn" title="Mark all notifications as read">
              Mark all read
            </button>
          ` : ''}
        </div>

        <!-- Notifications List -->
        <div class="notif-list">
          ${!userId ? `
            <div class="notif-empty-state">
              <div style="font-size: 2rem; margin-bottom: 8px;">🔒</div>
              <p style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">Sign In Required</p>
              <p style="font-size: 12px; color: var(--text-muted); margin-bottom: 14px;">Sign in to view your personalized reminders and cap alerts.</p>
              <button id="notif-signin-btn" class="btn btn-primary btn-sm">Sign In</button>
            </div>
          ` : filtered.length === 0 ? `
            <div class="notif-empty-state">
              <div style="font-size: 2.2rem; margin-bottom: 10px;">✨</div>
              <p style="font-weight: 600; color: var(--text-primary); margin-bottom: 4px;">You're All Caught Up!</p>
              <p style="font-size: 12px; color: var(--text-muted);">No notifications matching this filter.</p>
            </div>
          ` : filtered.map(n => renderNotificationItem(n)).join('')}
        </div>
      </div>
    </div>
  `;

  // Event Listeners
  const backdrop = document.getElementById('notif-drawer-backdrop');
  const closeBtn = document.getElementById('close-notif-drawer-btn');

  const closeDrawer = () => {
    modalContainer.innerHTML = '';
    updateNotificationBadge();
  };

  if (backdrop) backdrop.onclick = (e) => { if (e.target.id === 'notif-drawer-backdrop') closeDrawer(); };
  if (closeBtn) closeBtn.onclick = closeDrawer;

  const signinBtn = document.getElementById('notif-signin-btn');
  if (signinBtn) {
    signinBtn.onclick = () => {
      closeDrawer();
      window.location.hash = '#/login';
    };
  }

  // Filter Buttons
  modalContainer.querySelectorAll('.notif-filter-btn').forEach(btn => {
    btn.onclick = () => {
      activeFilter = btn.dataset.filter;
      renderDrawerHtml(modalContainer, notifications, unreadCount, userId);
    };
  });

  // Mark all read button
  const markAllBtn = document.getElementById('mark-all-read-btn');
  if (markAllBtn) {
    markAllBtn.onclick = async () => {
      await markAllNotificationsAsRead(userId);
      const updated = await getUserNotifications(userId);
      renderDrawerHtml(modalContainer, updated, 0, userId);
      updateNotificationBadge();
    };
  }

  // Individual notification card actions
  modalContainer.querySelectorAll('.notif-card').forEach(card => {
    const id = Number(card.dataset.id);

    // Click card action CTA
    const actionBtn = card.querySelector('.notif-card-cta');
    if (actionBtn) {
      actionBtn.onclick = async (e) => {
        e.stopPropagation();
        await markNotificationAsRead(id);
        closeDrawer();
        const targetUrl = actionBtn.dataset.url;
        if (targetUrl) window.location.hash = targetUrl;
      };
    }

    // Click mark read or anywhere on card
    card.onclick = async () => {
      await markNotificationAsRead(id);
      const updated = await getUserNotifications(userId);
      const unread = await getUnreadNotificationCount(userId);
      renderDrawerHtml(modalContainer, updated, unread, userId);
      updateNotificationBadge();
    };

    // Delete single notification
    const delBtn = card.querySelector('.notif-del-btn');
    if (delBtn) {
      delBtn.onclick = async (e) => {
        e.stopPropagation();
        await deleteNotification(id);
        const updated = await getUserNotifications(userId);
        const unread = await getUnreadNotificationCount(userId);
        renderDrawerHtml(modalContainer, updated, unread, userId);
        updateNotificationBadge();
      };
    }
  });
}

function renderNotificationItem(n) {
  let iconHtml = '📢';
  let badgeColorClass = 'badge-slate';

  if (n.type === 'cap_breach') {
    iconHtml = '🚨';
    badgeColorClass = 'badge-rose';
  } else if (n.type === 'cap_warning') {
    iconHtml = '⚡';
    badgeColorClass = 'badge-amber';
  } else if (n.type === 'reminder') {
    iconHtml = '📅';
    badgeColorClass = 'badge-emerald';
  } else if (n.type === 'sync') {
    iconHtml = '💳';
    badgeColorClass = 'badge-blue';
  }

  const timeAgo = formatTimeAgo(n.createdAt);

  return `
    <div class="notif-card ${n.read ? 'read' : 'unread'}" data-id="${n.id}">
      <div class="notif-card-main">
        <div class="notif-type-icon ${n.type}">
          ${iconHtml}
        </div>
        <div class="notif-content">
          <div class="notif-title-row">
            <span class="notif-title">${escapeHtml(n.title)}</span>
            <span class="notif-time">${timeAgo}</span>
          </div>
          <p class="notif-message">${escapeHtml(n.message)}</p>
          <div class="notif-footer-row">
            <button class="notif-card-cta" data-url="${escapeHtml(n.actionUrl || '#/dashboard')}">
              ${escapeHtml(n.actionLabel || 'View Details')} →
            </button>
            <button class="notif-del-btn" title="Dismiss notification">✕</button>
          </div>
        </div>
      </div>
    </div>
  `;
}

/**
 * Automated Background Checks: Month-End Reminders & Spending Cap Breaches
 */
export async function runAutomatedChecks(userId) {
  if (!userId) return;
  await checkMonthEndReminder(userId);
  await checkSpendingCaps(userId);
}

/**
 * Month-End Reminder Check
 * Generates notification and optionally dispatches reminder email if it's the last week of the month.
 */
export async function checkMonthEndReminder(userId) {
  const today = new Date();
  const currentMonthKey = today.toISOString().slice(0, 7); // YYYY-MM
  const dayOfMonth = today.getDate();
  const lastDayOfMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();

  // Trigger reminder in the last 4 days of the month (e.g. 27th-31st)
  if (dayOfMonth < lastDayOfMonth - 4) {
    return;
  }

  // Check if we already alerted for this month
  const storageKey = `sbafa_month_end_reminded_${userId}_${currentMonthKey}`;
  if (localStorage.getItem(storageKey)) {
    return;
  }

  const monthName = today.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });
  const user = await getCurrentUser();
  const targetEmail = user ? (user.alertEmail || user.googleEmail || user.email) : null;

  // Add in-app notification
  await addNotification(userId, {
    title: `Month-End Expense Update (${monthName})`,
    message: `The month is concluding. Update your expenses, sync your bank statements, and review your spending breakdown to close out ${monthName}.`,
    type: 'reminder',
    actionUrl: '#/accounts',
    actionLabel: 'Sync Bank Statements'
  });

  // Dispatch month-end reminder email from aditya.dev.org@gmail.com
  if (targetEmail) {
    await sendMonthEndReminderEmail({
      userEmail: targetEmail,
      userName: user.name || 'Member',
      monthName,
      appUrl: window.location.origin + window.location.pathname + '#/accounts'
    });
  }

  localStorage.setItem(storageKey, 'true');
  await updateNotificationBadge();
}

/**
 * Evaluates monthly spending cap and category limits.
 * Triggers in-app alerts and dispatches limit breach emails when cap is exceeded.
 */
export async function checkSpendingCaps(userId) {
  if (!userId) return;

  const user = await getCurrentUser();
  const capData = await getUserSpendingCap(userId);
  const monthlyCap = Number(capData.monthlyLimit) || 0;
  const targetEmail = capData.alertEmail || (user && (user.alertEmail || user.googleEmail || user.email));

  const allTxns = await getUserTransactions(userId);
  const currentMonthPrefix = new Date().toISOString().slice(0, 7);
  
  // Find active statement month if current month has zero expenses
  const expenseTxns = allTxns.filter(t => t.type === 'expense' && t.date);
  const availableMonths = [...new Set(expenseTxns.map(t => t.date.slice(0, 7)))].sort().reverse();
  const activeMonth = availableMonths.includes(currentMonthPrefix)
    ? currentMonthPrefix
    : (availableMonths[0] || currentMonthPrefix);

  const monthExpenses = allTxns.filter(t => t.type === 'expense' && t.date && t.date.startsWith(activeMonth));
  const totalSpent = monthExpenses.reduce((sum, t) => sum + (Number(t.amount) || 0), 0);

  const [y, mon] = activeMonth.split('-');
  const mDate = new Date(parseInt(y, 10), parseInt(mon, 10) - 1, 1);
  const monthName = mDate.toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  // 1. Check Overall Monthly Spending Cap
  if (monthlyCap > 0 && totalSpent >= monthlyCap) {
    const breachKey = `sbafa_cap_breach_${userId}_${activeMonth}_${monthlyCap}`;
    if (!localStorage.getItem(breachKey)) {
      const excess = totalSpent - monthlyCap;

      await addNotification(userId, {
        title: `🚨 Monthly Spending Cap Exceeded!`,
        message: `Your total spending for ${monthName} has reached ${formatINR(totalSpent)}, crossing your ${formatINR(monthlyCap)} monthly cap by +${formatINR(excess)}.`,
        type: 'cap_breach',
        actionUrl: '#/budgets',
        actionLabel: 'Review Budget & Cap'
      });

      // Dispatch Limit Breach Alert Email from aditya.dev.org@gmail.com
      if (targetEmail && capData.emailAlertsEnabled !== false) {
        await sendLimitBreachEmail({
          userEmail: targetEmail,
          userName: user.name || 'Member',
          currentSpend: totalSpent,
          limitAmount: monthlyCap,
          categoryName: `Overall Monthly Cap (${monthName})`,
          appUrl: window.location.origin + window.location.pathname + '#/budgets'
        });
      }

      localStorage.setItem(breachKey, 'true');
      await updateNotificationBadge();
    }
  }

  // 2. Check Individual Category Limits
  const budgets = await getUserBudgets(userId);
  const categorySpentMap = {};
  monthExpenses.forEach(t => {
    const cat = t.category || 'Other';
    categorySpentMap[cat] = (categorySpentMap[cat] || 0) + (Number(t.amount) || 0);
  });

  for (const b of budgets) {
    const limit = Number(b.monthlyLimit) || 0;
    const spent = categorySpentMap[b.category] || 0;
    if (limit > 0 && spent >= limit) {
      const catBreachKey = `sbafa_cat_breach_${userId}_${activeMonth}_${b.category}_${limit}`;
      if (!localStorage.getItem(catBreachKey)) {
        await addNotification(userId, {
          title: `⚠️ Category Limit Reached: ${b.category}`,
          message: `Spending for ${b.category} reached ${formatINR(spent)}, exceeding your ${formatINR(limit)} threshold.`,
          type: 'cap_breach',
          actionUrl: '#/budgets',
          actionLabel: 'Adjust Category Limit'
        });

        if (targetEmail && capData.emailAlertsEnabled !== false) {
          await sendLimitBreachEmail({
            userEmail: targetEmail,
            userName: user.name || 'Member',
            currentSpend: spent,
            limitAmount: limit,
            categoryName: `${b.category} (${monthName})`,
            appUrl: window.location.origin + window.location.pathname + '#/budgets'
          });
        }

        localStorage.setItem(catBreachKey, 'true');
        await updateNotificationBadge();
      }
    }
  }
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return 'Recently';
  const now = new Date();
  const d = new Date(dateStr);
  const diffMs = now - d;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays === 1) return 'Yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
