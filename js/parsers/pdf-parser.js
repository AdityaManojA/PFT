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
   * Sorts items by visual vertical & horizontal coordinates to preserve table row integrity.
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
      
      // Group items into rows using Y coordinate clustering (tolerance: 4px)
      const rows = [];
      for (const item of textContent.items) {
        if (!item.str && item.str !== ' ') continue;
        const x = item.transform ? Math.round(item.transform[4]) : 0;
        const y = item.transform ? Math.round(item.transform[5]) : 0;
        
        let foundRow = rows.find(r => Math.abs(r.y - y) <= 4);
        if (!foundRow) {
          foundRow = { y, items: [] };
          rows.push(foundRow);
        }
        foundRow.items.push({ x, str: item.str });
      }

      // Sort rows top-to-bottom (descending Y in PDF coordinate space)
      rows.sort((a, b) => b.y - a.y);

      // Sort items within each row left-to-right (ascending X)
      const pageLines = rows.map(r => {
        r.items.sort((a, b) => a.x - b.x);
        return r.items.map(it => it.str).join(' ').replace(/\s+/g, ' ').trim();
      }).filter(Boolean);

      pagesText.push(pageLines.join('\n'));
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
    const isFederal = /federal\s*bank|fdrl\b|fedbook/i.test(fullText) || /particulars/i.test(fullText);
    const isHdfc = /hdfc\s*bank/i.test(fullText) || /narration/i.test(fullText);
    const isSbi = /state\s*bank\s*of\s*india|\bsbi\b/i.test(fullText);
    const isIcici = /icici\s*bank/i.test(fullText);
    const isAxis = /axis\s*bank/i.test(fullText);
    const isKotak = /kotak\s*bank/i.test(fullText);

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
    } else if (isKotak) {
      detectedBank = 'Kotak Mahindra Bank';
      bankCode = 'KOTAK';
    }

    // Extract Effective Available Balance / Closing Balance from header
    let availableBalance = null;
    const balanceMatch = fullText.match(/(?:Effective\s+Available\s+Balance|Available\s+Balance|Closing\s+Balance)\s*:?\s*(?:INR|Rs\.?|₹)?\s*([\d,]+(?:\.\d{2})?)/i);
    if (balanceMatch) {
      const cleanBal = parseFloat(balanceMatch[1].replace(/,/g, ''));
      if (!isNaN(cleanBal)) {
        availableBalance = cleanBal;
      }
    }

    // Extract Statement Period End Date or Statement Date from header
    let statementDate = null;
    const periodMatch = fullText.match(/(?:for the period|statement period|period\s*:?)[^\n\r]*?(?:to|-)\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-\.][A-Za-z0-9]+[\/\-\.]\d{2,4})/i);
    if (periodMatch) {
      statementDate = this.normalizeDate(periodMatch[1]);
    }
    if (!statementDate) {
      const asOnMatch = fullText.match(/(?:Statement\s+as\s+on|Balance\s+as\s+on|Date\s+of\s+Issue|Statement\s+Date|Generated\s+on)\s*:?\s*(\d{4}-\d{2}-\d{2}|\d{1,2}[\/\-\.][A-Za-z0-9]+[\/\-\.]\d{2,4})/i);
      if (asOnMatch) {
        statementDate = this.normalizeDate(asOnMatch[1]);
      }
    }

    // Regular expressions for Indian bank dates: DD/MM/YYYY or DD-MM-YYYY or DD-Mon-YYYY
    const numericDateRegex = /\b(\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4})\b/;
    const alphaDateRegex = /\b(\d{1,2}[\s\-](?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*[\s\-]\d{2,4})\b/i;
    // Regular expression for monetary amounts (e.g. 1,450.00 or 500.00)
    const amountRegex = /\b\d{1,3}(?:,\d{2,3})*(?:\.\d{2})\b/g;

    for (const rawLine of lines) {
      // Ignore header rows
      if (/^(Date|Particulars|Tran Type|Tran ID|Cheque Details|Withdrawals|Deposits|Balance|Statement of Account)/i.test(rawLine)) {
        continue;
      }
      if (/^Opening Balance/i.test(rawLine)) {
        continue;
      }
      if (/Effective\s+Available\s+Balance|Date\s+of\s+Issue|Customer\s+ID|Account\s+Open\s+Date|Regd\.\s*Mobile/i.test(rawLine)) {
        continue;
      }

      let dateMatch = rawLine.match(alphaDateRegex);
      if (!dateMatch) {
        dateMatch = rawLine.match(numericDateRegex);
      }
      if (!dateMatch) continue;

      const amounts = rawLine.match(amountRegex);
      if (!amounts || amounts.length === 0) continue;

      const dateStr = this.normalizeDate(dateMatch[1]);
      
      // Determine transaction type (expense vs income)
      let type = 'expense';

      // Federal Bank & Standard UPI specific checks:
      if (/UPIOUT\b/i.test(rawLine)) {
        type = 'expense';
      } else if (/UPI\s*IN\b/i.test(rawLine)) {
        type = 'income';
      } else if (/\b(DR|DEBIT|WITHDRAWAL|ATM|POS)\b/i.test(rawLine)) {
        type = 'expense';
      } else if (/\b(SALARY|CREDIT|INTEREST|DIVIDEND|REFUND|REVERSAL)\b/i.test(rawLine)) {
        type = 'income';
      } else if (/\b(CR)\b/i.test(rawLine) && !rawLine.endsWith('Cr') && !rawLine.endsWith('CR')) {
        // Only if CR is not simply the trailing balance indicator
        type = 'income';
      }

      // Pick transaction amount:
      // If line has multiple amounts (e.g. [amount, running_balance]),
      // the transaction amount is typically amounts[0].
      const parsedAmt = parseFloat(amounts[0].replace(/,/g, ''));
      if (isNaN(parsedAmt) || parsedAmt <= 0 || parsedAmt > 50000000) continue;

      // Clean narration: remove dates, amounts, and trailing balance flags
      let narration = rawLine
        .replace(new RegExp(dateMatch[0], 'g'), '')
        .replace(amountRegex, '')
        .replace(/\b(Cr|Dr|CR|DR|TFR)\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();

      const { category, cleanMerchant } = categorizeTransaction(narration, type);

      transactions.push({
        date: dateStr,
        narration: narration || `${detectedBank} Transaction`,
        merchant: cleanMerchant,
        category,
        type,
        amount: parsedAmt,
        currency: 'INR',
        account_id: targetAccountId || null,
        synced: true,
        source: 'PDF_IMPORT',
        created_at: new Date().toISOString()
      });
    }

    // Determine the latest transaction date in this statement
    let maxTxnDate = '';
    for (const t of transactions) {
      if (t.date && t.date > maxTxnDate) {
        maxTxnDate = t.date;
      }
    }

    // Effective statement date: whichever is latest between header period and transactions
    if (!statementDate || (maxTxnDate && maxTxnDate > statementDate)) {
      statementDate = maxTxnDate || statementDate;
    }

    return {
      formatDetected: detectedBank ? `${detectedBank.toUpperCase()} PDF` : 'BANK STATEMENT PDF',
      detectedBank,
      bankCode,
      availableBalance,
      statementDate,
      totalParsed: transactions.length,
      transactions
    };
  }

  static normalizeDate(str) {
    const clean = String(str).trim();
    if (!clean) return new Date().toISOString().split('T')[0];

    // Already YYYY-MM-DD
    if (/^\d{4}-\d{2}-\d{2}$/.test(clean)) {
      return clean;
    }
    
    // Check alpha month e.g. 01-APR-2025 or 15 Jan 24
    const monthNames = {
      jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
      jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12'
    };
    const alphaMatch = clean.match(/^(\d{1,2})[\s\-]([A-Za-z]{3,})[\s\-](\d{2,4})$/);
    if (alphaMatch) {
      const day = alphaMatch[1].padStart(2, '0');
      const mon = monthNames[alphaMatch[2].substring(0, 3).toLowerCase()] || '01';
      let year = alphaMatch[3];
      if (year.length === 2) year = '20' + year;
      return `${year}-${mon}-${day}`;
    }

    const parts = clean.split(/[\/\-\.]/);
    if (parts.length === 3) {
      // If first part is 4-digit year e.g. 2025/04/01
      if (parts[0].length === 4) {
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      }
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
    return user?.primaryBank || 'HDFC';
  }

  /**
   * Set user primary bank
   */
  static async setPrimaryBank(bankCode, userId = null) {
    if (!userId) {
      const curId = localStorage.getItem('pft_active_user_id');
      userId = curId || null;
    }
    if (!userId) return;

    const user = await db.users.get(userId);
    if (user) {
      await db.users.update(userId, { primaryBank: bankCode });
    }
  }

  /**
   * Get saved statement password for bank (alias)
   */
  static async getSavedPassword(bankCode = 'HDFC', userId = null) {
    return this.getSavedPasswordRaw(bankCode, userId);
  }

  /**
   * Get raw saved statement password for bank
   */
  static async getSavedPasswordRaw(bankCode = 'HDFC', userId = null) {
    if (!userId) {
      const curId = localStorage.getItem('pft_active_user_id');
      userId = curId || null;
    }
    if (!userId) return '';
    const key = `pdf_pwd_${bankCode}_${userId}`;
    const setting = await db.settings.get(key);
    if (setting && setting.value) return setting.value;
    const user = await db.users.get(userId);
    return user?.pdfPassword || '';
  }

  /**
   * Save statement password for bank
   */
  static async savePasswordForBank(bankCode, password, userId = null) {
    if (!userId) {
      const curId = localStorage.getItem('pft_active_user_id');
      userId = curId || null;
    }
    if (!userId) return;
    const key = `pdf_pwd_${bankCode}_${userId}`;
    await db.settings.put({ key, value: password, userId });
    const user = await db.users.get(userId);
    if (user) {
      await db.users.update(userId, { pdfPassword: password, primaryBank: bankCode });
    }
  }

  /**
   * Delete saved statement password for bank
   */
  static async deleteSavedPassword(bankCode, userId = null) {
    if (!userId) {
      const curId = localStorage.getItem('pft_active_user_id');
      userId = curId || null;
    }
    if (!userId) return;
    const key = `pdf_pwd_${bankCode}_${userId}`;
    await db.settings.delete(key);
    const user = await db.users.get(userId);
    if (user) {
      await db.users.update(userId, { pdfPassword: '' });
    }
  }

  static async savePassword(bankCode, password, userId = null, enableAutofill = true) {
    await this.savePasswordForBank(bankCode, password, userId);
    if (typeof enableAutofill === 'boolean') {
      await this.setAutofillEnabled(enableAutofill, userId);
    }
  }

  static async deletePassword(bankCode, userId = null) {
    await this.deleteSavedPassword(bankCode, userId);
    await this.setAutofillEnabled(false, userId);
  }
}
