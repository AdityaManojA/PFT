/**
 * SBAFA Email Notification Service
 * Dispatches month-end expense reminders and monthly spending limit/billing cap breach alerts
 * from: aditya.dev.org@gmail.com
 */

import { formatINR } from '../db.js';

export const SENDER_EMAIL = 'aditya.dev.org@gmail.com';

/**
 * Dispatches an instant alert when a monthly budget cap or category limit has been crossed.
 */
export async function sendLimitBreachEmail({
  userEmail,
  userName = 'Member',
  currentSpend = 0,
  limitAmount = 0,
  categoryName = 'Total Monthly Spending',
  appUrl = window.location.origin + window.location.pathname + '#/dashboard'
}) {
  if (!userEmail) {
    console.warn('[EmailService] No user email provided for limit breach alert.');
    return { success: false, reason: 'no_email' };
  }

  const excess = Math.max(0, currentSpend - limitAmount);
  const formattedSpend = formatINR(currentSpend);
  const formattedLimit = formatINR(limitAmount);
  const formattedExcess = formatINR(excess);
  const percent = limitAmount > 0 ? Math.round((currentSpend / limitAmount) * 100) : 100;

  const subject = `🚨 Spending Cap Alert: ${categoryName} Limit Crossed (${formattedSpend} of ${formattedLimit}) - SBAFA`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0B0F17; color: #E2E8F0; }
        .wrapper { max-width: 600px; margin: 24px auto; background: #0F172A; border-radius: 16px; border: 1px solid #1E293B; overflow: hidden; }
        .header { background: linear-gradient(135deg, #1E1B4B 0%, #0F172A 100%); padding: 28px 32px; border-bottom: 1px solid #1E293B; }
        .logo { font-size: 22px; font-weight: 800; color: #10B981; letter-spacing: -0.5px; }
        .logo span { color: #F8FAFC; }
        .content { padding: 32px; }
        .alert-banner { background: rgba(244, 63, 94, 0.12); border: 1px solid rgba(244, 63, 94, 0.35); border-radius: 12px; padding: 18px 20px; margin-bottom: 24px; }
        .alert-title { font-size: 17px; font-weight: 700; color: #F43F5E; margin: 0 0 6px 0; }
        .alert-text { font-size: 13px; color: #FDA4AF; margin: 0; line-height: 1.5; }
        .stats-table { width: 100%; border-collapse: collapse; margin: 24px 0; }
        .stats-table td { padding: 12px 14px; border-bottom: 1px solid #1E293B; font-size: 13px; }
        .stats-label { color: #94A3B8; font-weight: 500; }
        .stats-value { color: #F8FAFC; font-weight: 700; text-align: right; font-variant-numeric: tabular-nums; }
        .stats-value.danger { color: #F43F5E; }
        .cta-box { text-align: center; margin: 32px 0 16px 0; }
        .cta-btn { display: inline-block; background: #10B981; color: #042F2E; text-decoration: none; padding: 14px 28px; font-size: 14px; font-weight: 700; border-radius: 10px; }
        .footer { background: #090D16; padding: 20px 32px; font-size: 11px; color: #64748B; text-align: center; border-top: 1px solid #1E293B; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <div class="logo">SBAFA <span>Vault</span></div>
        </div>
        <div class="content">
          <div class="alert-banner">
            <div class="alert-title">⚠️ Monthly Limit Crossed (${percent}% Utilized)</div>
            <p class="alert-text">
              Hello ${escapeHtml(userName)}, your spending for <strong>${escapeHtml(categoryName)}</strong> has exceeded the threshold configured in your account.
            </p>
          </div>

          <table class="stats-table">
            <tr>
              <td class="stats-label">Category / Scope</td>
              <td class="stats-value">${escapeHtml(categoryName)}</td>
            </tr>
            <tr>
              <td class="stats-label">Configured Cap</td>
              <td class="stats-value">${formattedLimit}</td>
            </tr>
            <tr>
              <td class="stats-label">Current Total Spent</td>
              <td class="stats-value danger">${formattedSpend}</td>
            </tr>
            <tr>
              <td class="stats-label">Amount Over Limit</td>
              <td class="stats-value danger">+${formattedExcess}</td>
            </tr>
          </table>

          <div class="cta-box">
            <a href="${appUrl}" class="cta-btn" target="_blank">Open SBAFA & Review Spending →</a>
          </div>
          <p style="font-size: 12px; color: #64748B; text-align: center; margin: 12px 0 0 0;">
            Manage and adjust your budget thresholds anytime in the <strong>Budgets</strong> tab.
          </p>
        </div>
        <div class="footer">
          Sent by SBAFA Automated Alerts &bull; from: ${SENDER_EMAIL} &bull; Personal Finance Tracker
        </div>
      </div>
    </body>
    </html>
  `;

  return await dispatchEmail({
    to: userEmail,
    from: SENDER_EMAIL,
    subject,
    html: htmlContent,
    type: 'limit_breach'
  });
}

/**
 * Dispatches a month-end reminder inviting users to update expenses and upload bank statements.
 */
export async function sendMonthEndReminderEmail({
  userEmail,
  userName = 'Member',
  monthName = 'This Month',
  appUrl = window.location.origin + window.location.pathname + '#/accounts'
}) {
  if (!userEmail) {
    console.warn('[EmailService] No user email provided for month-end reminder.');
    return { success: false, reason: 'no_email' };
  }

  const subject = `📅 Month-End Expense Update: Sync & Track Your ${monthName} Outflow - SBAFA`;

  const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8" />
      <style>
        body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #0B0F17; color: #E2E8F0; }
        .wrapper { max-width: 600px; margin: 24px auto; background: #0F172A; border-radius: 16px; border: 1px solid #1E293B; overflow: hidden; }
        .header { background: linear-gradient(135deg, #064E3B 0%, #0F172A 100%); padding: 28px 32px; border-bottom: 1px solid #1E293B; }
        .logo { font-size: 22px; font-weight: 800; color: #10B981; letter-spacing: -0.5px; }
        .logo span { color: #F8FAFC; }
        .content { padding: 32px; }
        .card { background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: 12px; padding: 20px; margin-bottom: 24px; }
        .card-title { font-size: 18px; font-weight: 700; color: #34D399; margin: 0 0 8px 0; }
        .card-text { font-size: 13px; color: #CBD5E1; margin: 0; line-height: 1.6; }
        .checklist { list-style: none; padding: 0; margin: 20px 0; }
        .checklist li { font-size: 13px; color: #94A3B8; padding: 8px 0; border-bottom: 1px solid #1E293B; display: flex; align-items: center; gap: 8px; }
        .cta-box { text-align: center; margin: 32px 0 16px 0; }
        .cta-btn { display: inline-block; background: #10B981; color: #042F2E; text-decoration: none; padding: 14px 28px; font-size: 14px; font-weight: 700; border-radius: 10px; }
        .footer { background: #090D16; padding: 20px 32px; font-size: 11px; color: #64748B; text-align: center; border-top: 1px solid #1E293B; }
      </style>
    </head>
    <body>
      <div class="wrapper">
        <div class="header">
          <div class="logo">SBAFA <span>Vault</span></div>
        </div>
        <div class="content">
          <div class="card">
            <div class="card-title">🗓️ Time to Close Out Your ${escapeHtml(monthName)} Expenses</div>
            <p class="card-text">
              Hello ${escapeHtml(userName)}, the month is drawing to a close. Make sure your financial records and bank statements are 100% up to date to keep your budgets and balances accurate.
            </p>
          </div>

          <ul class="checklist">
            <li><span>✓</span> Sync your bank statement via Gmail Sync or PDF upload (Federal / HDFC)</li>
            <li><span>✓</span> Review your sectionized spending categories & monthly donut chart</li>
            <li><span>✓</span> Check your category spending limits to prepare for next month</li>
          </ul>

          <div class="cta-box">
            <a href="${appUrl}" class="cta-btn" target="_blank">Open SBAFA & Update Expenses Now →</a>
          </div>
        </div>
        <div class="footer">
          Monthly Reminder &bull; Sent from: ${SENDER_EMAIL} &bull; SBAFA Financial Enclave
        </div>
      </div>
    </body>
    </html>
  `;

  return await dispatchEmail({
    to: userEmail,
    from: SENDER_EMAIL,
    subject,
    html: htmlContent,
    type: 'month_end_reminder'
  });
}

/**
 * Underlying transport: calls backend Cloud Function if reachable,
 * or logs cleanly in client storage/console with full email preview.
 */
async function dispatchEmail(payload) {
  console.log(
    `%c[SBAFA Email Dispatch]%c From: ${payload.from} -> To: ${payload.to} | Subject: "${payload.subject}"`,
    'background: #10B981; color: #000; font-weight: bold; padding: 2px 6px; border-radius: 4px;',
    'color: #38BDF8;'
  );

  // Try calling Cloud Function endpoint if deployed
  try {
    const res = await fetch('/api/sendAlertEmail', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      return { success: true, deliveredVia: 'cloud_function' };
    }
  } catch (e) {
    // Expected in standalone client / local dev environment without active cloud functions
  }

  // Record dispatch in client audit history
  try {
    const auditKey = 'sbafa_dispatched_emails';
    const existing = JSON.parse(localStorage.getItem(auditKey) || '[]');
    existing.unshift({
      to: payload.to,
      from: payload.from,
      subject: payload.subject,
      type: payload.type,
      dispatchedAt: new Date().toISOString()
    });
    localStorage.setItem(auditKey, JSON.stringify(existing.slice(0, 50)));
  } catch (err) {}

  return {
    success: true,
    deliveredVia: 'local_client_audit',
    preview: payload
  };
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
