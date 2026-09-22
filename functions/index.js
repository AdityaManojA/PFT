/**
 * Firebase Cloud Functions for SBAFA Personal Finance Tracker
 * Handles:
 * 1. Scheduled Month-End Expense Reminders (runs monthly at 9am IST)
 * 2. Instant Spending Cap / Billing Limit Breach Emails
 * Sender: aditya.dev.org@gmail.com
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onRequest } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');

if (!admin.apps.length) {
  admin.initializeApp();
}

const SENDER_EMAIL = 'aditya.dev.org@gmail.com';

// Configure Nodemailer Transport
// Set GMAIL_APP_PASSWORD in Firebase environment or Google Secret Manager:
// firebase functions:secrets:set GMAIL_APP_PASSWORD
function getTransporter() {
  const password = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASSWORD;
  return nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: SENDER_EMAIL,
      pass: password
    }
  });
}

/**
 * Scheduled Cron: Runs on the 28th of every month at 9:00 AM IST
 * Sends reminder email with link to app: https://sbafa-ft.web.app
 */
exports.monthEndExpenseReminder = onSchedule({
  schedule: '0 9 28 * *',
  timeZone: 'Asia/Kolkata',
  region: 'asia-south1'
}, async (event) => {
  const transporter = getTransporter();
  const db = admin.firestore();

  const now = new Date();
  const monthName = now.toLocaleString('en-IN', { month: 'long', year: 'numeric' });
  const appUrl = 'https://sbafa-ft.web.app/#/accounts';

  console.log(`[MonthEndReminder] Initiating reminder dispatch for ${monthName}`);

  try {
    const usersSnap = await db.collection('users').get();
    const sendPromises = [];

    usersSnap.forEach(doc => {
      const user = doc.data();
      const targetEmail = user.alertEmail || user.googleEmail || user.email;
      if (!targetEmail) return;

      const mailOptions = {
        from: `"SBAFA Vault" <${SENDER_EMAIL}>`,
        to: targetEmail,
        subject: `📅 Month-End Expense Update: Sync & Track Your ${monthName} Outflow - SBAFA`,
        html: `
          <div style="font-family: sans-serif; background: #0F172A; color: #F8FAFC; padding: 24px; border-radius: 12px; max-width: 580px; margin: 0 auto;">
            <h2 style="color: #10B981; margin-top: 0;">SBAFA Financial Vault</h2>
            <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.3); padding: 16px; border-radius: 8px;">
              <h3 style="color: #34D399; margin: 0 0 8px 0;">🗓️ Time to Close Out Your ${monthName} Expenses</h3>
              <p style="color: #CBD5E1; font-size: 14px; margin: 0; line-height: 1.5;">
                Hello ${user.name || 'Member'}, the month is coming to an end. Make sure your financial records and bank statements are 100% updated to keep your budgets and balances accurate.
              </p>
            </div>
            <div style="text-align: center; margin: 28px 0;">
              <a href="${appUrl}" style="background: #10B981; color: #042F2E; padding: 12px 24px; font-weight: bold; text-decoration: none; border-radius: 8px; font-size: 14px; display: inline-block;">
                Update Expenses & Sync Statement →
              </a>
            </div>
            <p style="color: #64748B; font-size: 11px; text-align: center; margin-bottom: 0;">
              Sent from ${SENDER_EMAIL} &bull; SBAFA Personal Finance Tracker
            </p>
          </div>
        `
      };

      sendPromises.push(transporter.sendMail(mailOptions));
    });

    await Promise.all(sendPromises);
    console.log(`[MonthEndReminder] Successfully dispatched reminders to ${sendPromises.length} users.`);
  } catch (err) {
    console.error('[MonthEndReminder] Error sending scheduled reminders:', err);
  }
});

/**
 * HTTPS Callable / HTTP Endpoint: Dispatches Instant Limit Breach Alert
 */
exports.sendAlertEmail = onRequest({ cors: true, region: 'asia-south1' }, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  const { to, subject, html, type } = req.body || {};
  if (!to || !subject || !html) {
    res.status(400).json({ error: 'Missing required email fields (to, subject, html)' });
    return;
  }

  try {
    const transporter = getTransporter();
    const info = await transporter.sendMail({
      from: `"SBAFA Alerts" <${SENDER_EMAIL}>`,
      to,
      subject,
      html
    });

    res.status(200).json({ success: true, messageId: info.messageId });
  } catch (error) {
    console.error('[sendAlertEmail] Transport error:', error);
    res.status(500).json({ error: error.message });
  }
});
