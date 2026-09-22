/**
 * Test Notification Center, Spending Cap Breach Alert, and Month-End Reminder
 */

import { SENDER_EMAIL, sendLimitBreachEmail, sendMonthEndReminderEmail } from '../js/services/email-service.js';

console.log('--- TEST 1: SENDER EMAIL VERIFICATION ---');
if (SENDER_EMAIL === 'aditya.dev.org@gmail.com') {
  console.log('PASS: SENDER_EMAIL is aditya.dev.org@gmail.com');
} else {
  console.error('FAIL: SENDER_EMAIL mismatch:', SENDER_EMAIL);
  process.exit(1);
}

console.log('--- TEST 2: EMAIL TEMPLATE GENERATION ---');
// Mock window.location for node environment
globalThis.window = {
  location: {
    origin: 'https://sbafa-ft.web.app',
    pathname: '/'
  }
};
globalThis.localStorage = {
  _data: {},
  getItem(k) { return this._data[k] || null; },
  setItem(k, v) { this._data[k] = String(v); },
  removeItem(k) { delete this._data[k]; }
};

const breachResult = await sendLimitBreachEmail({
  userEmail: 'adityamanoja@gmail.com',
  userName: 'Aditya',
  currentSpend: 54200,
  limitAmount: 50000,
  categoryName: 'Total Monthly Spending'
});

if (breachResult.success && breachResult.preview.from === 'aditya.dev.org@gmail.com') {
  console.log('PASS: Limit breach email payload generated successfully.');
  console.log('      Subject:', breachResult.preview.subject);
  console.log('      To:', breachResult.preview.to);
  console.log('      From:', breachResult.preview.from);
} else {
  console.error('FAIL: Limit breach email failed:', breachResult);
  process.exit(1);
}

const reminderResult = await sendMonthEndReminderEmail({
  userEmail: 'adityamanoja@gmail.com',
  userName: 'Aditya',
  monthName: 'September 2026'
});

if (reminderResult.success && reminderResult.preview.from === 'aditya.dev.org@gmail.com') {
  console.log('PASS: Month-end reminder email payload generated successfully.');
  console.log('      Subject:', reminderResult.preview.subject);
  console.log('      To:', reminderResult.preview.to);
  console.log('      From:', reminderResult.preview.from);
} else {
  console.error('FAIL: Month-end reminder email failed:', reminderResult);
  process.exit(1);
}

console.log('=== ALL NOTIFICATION & EMAIL TESTS PASSED ===');
