/**
 * PDF Bank Statement Parser & Decryptor
 * Runs 100% client-side using PDF.js. Decrypts password-protected bank PDFs
 * (HDFC Customer ID / PAN, Federal Bank DOB / Account No) and extracts transactions.
 */

import { categorizeTransaction } from './categorizer.js';
import { db } from '../db.js';

export class BankPDFParser {
  /**
   * Decrypt and extract text from bank statement PDF
   * @param {ArrayBuffer} arrayBuffer - PDF file binary data
   * @param {string} password - PDF decryption password (if protected)
   */
  static async extractPdfText(arrayBuffer, password = '') {
    if (!window.pdfjsLib) {
      throw new Error('PDF.js library is not loaded. Please ensure internet connection.');
    }

    // Configure worker
    if (!window.pdfjsLib.GlobalWorkerOptions.workerSrc) {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    const loadingTask = window.pdfjsLib.getDocument({
      data: arrayBuffer,
      password: password || undefined
    });

    let pdfDoc;
    try {
      pdfDoc = await loadingTask.promise;
    } catch (err) {
      if (err.name === 'PasswordException') {
        throw new Error('PASSWORD_REQUIRED');
      }
      throw err;
    }

    const pagesText = [];
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      const pageStrings = textContent.items.map(item => item.str);
      pagesText.push(pageStrings.join(' '));
    }

    return pagesText.join('\n');
  }

  /**
   * Parse extracted text into structured transactions
   */
  static parseTextToTransactions(fullText, targetAccountId = null) {
    const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean);
    const transactions = [];

    // Detect format
    const isHdfc = /hdfc\s*bank/i.test(fullText) || /narration/i.test(fullText);
    const isFederal = /federal\s*bank/i.test(fullText) || /particulars/i.test(fullText);
    const isSbi = /state\s*bank\s*of\s*india|\bsbi\b/i.test(fullText);
    const isIcici = /icici\s*bank/i.test(fullText);
    const isAxis = /axis\s*bank/i.test(fullText);

    let detectedBank = 'Bank Account';
    let bankCode = 'OTHER';
    if (isFederal) {
      detectedBank = 'Federal Bank';
      bankCode = 'FEDERAL';
    } else if (isHdfc) {
      detectedBank = 'HDFC Bank';
      bankCode = 'HDFC';
    } else if (isSbi) {
      detectedBank = 'State Bank of India';
      bankCode = 'SBI';
    } else if (isIcici) {
      detectedBank = 'ICICI Bank';
      bankCode = 'ICICI';
    } else if (isAxis) {
      detectedBank = 'Axis Bank';
      bankCode = 'AXIS';
    }

    // Regular expressions for Indian bank dates: DD/MM/YYYY or DD-MM-YYYY or DD/MM/YY
    const dateRegex = /\b(\d{2}[\/\-\.]\d{2}[\/\-\.]\d{2,4})\b/;
    // Regular expression for monetary amounts (e.g. 1,450.00 or 500.00)
    const amountRegex = /\b\d{1,3}(?:,\d{2,3})*(?:\.\d{2})\b/g;

    // Line-by-line / block parsing
    for (const rawLine of lines) {
      const dateMatch = rawLine.match(dateRegex);
      if (!dateMatch) continue;

      const amounts = rawLine.match(amountRegex);
      if (!amounts || amounts.length === 0) continue;

      const dateStr = this.normalizeDate(dateMatch[1]);
      
      // Determine if withdrawal or deposit
      let type = 'expense';
      let amount = 0;
      let narration = rawLine;

      // Clean narration: remove dates and amounts
      narration = narration
        .replace(dateRegex, '')
        .replace(amountRegex, '')
        .replace(/\s+/g, ' ')
        .trim();

      // Look for credit indicators (CR, Deposit, +)
      if (/\b(CR|DEP|SALARY|CREDIT|INTEREST|DIVIDEND)\b/i.test(rawLine)) {
        type = 'income';
      }

      // Take the first or second extracted amount as transaction value
      const parsedAmt = parseFloat(amounts[0].replace(/,/g, ''));
      if (parsedAmt > 0 && parsedAmt < 10000000) {
        amount = parsedAmt;
      }

      if (amount <= 0) continue;

      const { category, cleanMerchant } = categorizeTransaction(narration, type);

      transactions.push({
        date: dateStr,
        narration: narration || 'Bank PDF Entry',
        merchant: cleanMerchant,
        category,
        type,
        amount,
        currency: 'INR',
        account_id: targetAccountId || null,
        synced: true,
        source: 'PDF_IMPORT',
        created_at: new Date().toISOString()
      });
    }

    return {
      formatDetected: detectedBank ? `${detectedBank.toUpperCase()} PDF` : 'BANK STATEMENT PDF',
      detectedBank,
      bankCode,
      totalParsed: transactions.length,
      transactions
    };
  }

  static normalizeDate(str) {
    const clean = String(str).trim();
    const parts = clean.split(/[\/\-\.]/);
    if (parts.length === 3) {
      let year = parts[2];
      if (year.length === 2) year = '20' + year;
      return `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
    }
    return new Date().toISOString().split('T')[0];
  }

  /**
   * Check if 1-tap statement autofill is enabled for user
   */
  static async isAutofillEnabled(userId = null) {
    if (!userId) {
      const curId = localStorage.getItem('pft_active_user_id');
      userId = curId || null;
    }
    if (!userId) return false;

    const pref = await db.settings.get(`pdf_autofill_${userId}`);
    if (pref && typeof pref.value === 'boolean') {
      return pref.value;
    }
    const user = await db.users.get(userId);
    return user ? user.autofillEnabled !== false : true;
  }

  /**
   * Toggle 1-tap statement autofill preference
   */
  static async setAutofillEnabled(enabled, userId = null) {
    if (!userId) {
      const curId = localStorage.getItem('pft_active_user_id');
      userId = curId || null;
    }
    if (!userId) return;

    await db.settings.put({ key: `pdf_autofill_${userId}`, value: Boolean(enabled), userId });
    const user = await db.users.get(userId);
    if (user) {
      await db.users.update(userId, { autofillEnabled: Boolean(enabled) });
    }
  }

  /**
   * Get user primary bank
   */
  static async getPrimaryBank(userId = null) {
    if (!userId) {
      const curId = localStorage.getItem('pft_active_user_id');
      userId = curId || null;
    }
    if (!userId) return 'HDFC';
    const user = await db.users.get(userId);
    return user && user.primaryBank ? user.primaryBank : 'HDFC';
  }

  /**
   * Retrieve saved bank statement password from Dexie settings
   * (Returns empty string if autofill has been turned off by the user)
   */
  static async getSavedPassword(bankCode = 'HDFC', userId = null) {
    if (!userId) {
      const curId = localStorage.getItem('pft_active_user_id');
      userId = curId || null;
    }
    if (!userId) return '';

    // If user turned off autofill, do not autofill
    const isEnabled = await this.isAutofillEnabled(userId);
    if (!isEnabled) return '';

    const key = `pdf_pwd_${bankCode}_${userId}`;
    const item = await db.settings.get(key);
    if (item && item.value) return item.value;

    // Check user object directly
    const user = await db.users.get(userId);
    if (user && user.pdfPassword) {
      if (!user.primaryBank || user.primaryBank === bankCode) {
        return user.pdfPassword;
      }
    }

    // Fallback to legacy global key if any
    const legacy = await db.settings.get(`pdf_pwd_${bankCode}`);
    return legacy ? legacy.value : '';
  }

  /**
   * Save bank statement password locally for automatic future unlocks
   */
  static async savePassword(bankCode = 'HDFC', password = '', userId = null, enableAutofill = true) {
    if (!userId) {
      const curId = localStorage.getItem('pft_active_user_id');
      userId = curId || null;
    }
    if (!userId) return;

    const key = `pdf_pwd_${bankCode}_${userId}`;
    await db.settings.put({ key, value: password, userId });
    await this.setAutofillEnabled(enableAutofill, userId);

    const user = await db.users.get(userId);
    if (user) {
      await db.users.update(userId, {
        primaryBank: bankCode,
        pdfPassword: password,
        autofillEnabled: Boolean(enableAutofill)
      });
    }
  }

  /**
   * Retrieve saved statement password regardless of autofill state (for edit/management view)
   */
  static async getSavedPasswordRaw(bankCode = 'HDFC', userId = null) {
    if (!userId) {
      const curId = localStorage.getItem('pft_active_user_id');
      userId = curId || null;
    }
    if (!userId) return '';

    const key = `pdf_pwd_${bankCode}_${userId}`;
    const item = await db.settings.get(key);
    if (item && item.value) return item.value;

    const user = await db.users.get(userId);
    if (user && user.pdfPassword) {
      return user.pdfPassword;
    }

    const legacy = await db.settings.get(`pdf_pwd_${bankCode}`);
    if (legacy && legacy.value) return legacy.value;

    // Check candidate bank keys if primary key was empty
    const candidateBanks = ['HDFC', 'FEDERAL', 'SBI', 'ICICI', 'AXIS', 'KOTAK', 'OTHER'];
    for (const b of candidateBanks) {
      const bItem = await db.settings.get(`pdf_pwd_${b}_${userId}`);
      if (bItem && bItem.value) return bItem.value;
      const bLegacy = await db.settings.get(`pdf_pwd_${b}`);
      if (bLegacy && bLegacy.value) return bLegacy.value;
    }

    return '';
  }

  /**
   * Completely remove statement password and disable autofill
   */
  static async deletePassword(bankCode = 'HDFC', userId = null) {
    if (!userId) {
      const curId = localStorage.getItem('pft_active_user_id');
      userId = curId || null;
    }
    if (!userId) return;

    // Delete primary and legacy bank keys
    await db.settings.delete(`pdf_pwd_${bankCode}_${userId}`);
    await db.settings.delete(`pdf_pwd_${bankCode}`);

    // Clean up any candidate bank keys
    const candidateBanks = ['HDFC', 'FEDERAL', 'SBI', 'ICICI', 'AXIS', 'KOTAK', 'OTHER'];
    for (const b of candidateBanks) {
      await db.settings.delete(`pdf_pwd_${b}_${userId}`);
      await db.settings.delete(`pdf_pwd_${b}`);
    }

    const user = await db.users.get(userId);
    if (user) {
      await db.users.update(userId, {
        pdfPassword: '',
        autofillEnabled: false
      });
    }
    await this.setAutofillEnabled(false, userId);
  }
}
