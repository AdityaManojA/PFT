/**
 * RBI Account Aggregator (AA) Service
 * Simulates the Setu AA Sandbox Consent and Live Financial Data Fetch workflow.
 */

import { db, getCurrentUser } from '../db.js';
import { categorizeTransaction } from '../parsers/categorizer.js';

export class SetuAccountAggregatorService {
  /**
   * Initiate Setu AA Sandbox Consent Session
   * @param {string} mobileNumber - 10 digit Indian mobile number
   */
  static async createConsentRequest(mobileNumber) {
    // Simulate network latency to Setu AA Gateway
    await new Promise(r => setTimeout(r, 600));

    const consentHandle = 'SETU-AA-' + Math.random().toString(36).substring(2, 9).toUpperCase();
    return {
      success: true,
      consentHandle,
      status: 'AWAITING_OTP',
      fipsDiscovered: [
        { fipId: 'FIP-HDFC', fipName: 'HDFC Bank Ltd', accounts: ['Savings A/c **4921'] },
        { fipId: 'FIP-FEDERAL', fipName: 'Federal Bank', accounts: ['Savings A/c **8812'] },
        { fipId: 'FIP-ICICI', fipName: 'ICICI Bank', accounts: ['Salary A/c **3104'] },
        { fipId: 'FIP-SBI', fipName: 'State Bank of India', accounts: ['Savings A/c **9024'] }
      ]
    };
  }

  /**
   * Verify Consent OTP and Authorize Consent
   * @param {string} consentHandle
   * @param {string} otp
   */
  static async verifyConsentOtp(consentHandle, otp) {
    await new Promise(r => setTimeout(r, 800));

    if (otp !== '123456' && otp.length !== 6) {
      throw new Error('Invalid OTP. In sandbox mode, use OTP: 123456');
    }

    const consentId = 'CONSENT-' + Date.now().toString(36).toUpperCase();
    return {
      success: true,
      consentId,
      status: 'CONSENT_GRANTED',
      validTill: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      rbiComplianceCode: 'AA-RBI-REG-2024-SETU'
    };
  }

  /**
   * Fetch live encrypted financial data from FIPs and ingest into local Dexie database
   * @param {string} consentId
   */
  static async syncLiveFinancialData(consentId) {
    await new Promise(r => setTimeout(r, 1200));

    // Simulated live transactions fetched from Setu AA Sandbox
    const today = new Date().toISOString().split('T')[0];
    const liveStream = [
      {
        amount: 320.00,
        currency: 'INR',
        narration: 'UPI-SWIGGY-BANGALORE-UPI/592019482910@hdfcbank',
        type: 'expense',
        date: today,
        account_id: 'hdfc-4921'
      },
      {
        amount: 2450.00,
        currency: 'INR',
        narration: 'UPI-MYNTRA DESIGNS-MYNTRA@AXIS-APPAREL',
        type: 'expense',
        date: today,
        account_id: 'federal-8812'
      },
      {
        amount: 5000.00,
        currency: 'INR',
        narration: 'NEFT CR-MUTUAL FUND REDEMPTION-UTI NIFTY 50',
        type: 'income',
        date: today,
        account_id: 'hdfc-4921'
      },
      {
        amount: 680.00,
        currency: 'INR',
        narration: 'UPI-SHELL PETROL-SHELL@KBL-FUEL',
        type: 'expense',
        date: today,
        account_id: 'federal-8812'
      }
    ];

    let insertedCount = 0;

    const user = await getCurrentUser();
    const userId = user ? user.id : 'user-aditya';

    for (const item of liveStream) {
      const { category, cleanMerchant } = categorizeTransaction(item.narration, item.type);
      await db.transactions.add({
        ...item,
        userId,
        category,
        merchant: cleanMerchant,
        synced: true,
        source: 'SETU_AA_LIVE',
        created_at: new Date().toISOString()
      });
      insertedCount++;

      // Adjust account balance
      const acc = await db.accounts.get(item.account_id);
      if (acc) {
        const diff = item.type === 'income' ? item.amount : -item.amount;
        await db.accounts.update(item.account_id, {
          balance: (acc.balance || 0) + diff,
          lastSynced: 'Just now (Setu AA)'
        });
      }
    }

    return {
      syncedCount: insertedCount,
      timestamp: new Date().toLocaleTimeString()
    };
  }
}
