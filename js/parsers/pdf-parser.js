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
  static parseTextToTransactions(fullText, targetAccountId = 'hdfc-4921') {
    const lines = fullText.split('\n').map(l => l.trim()).filter(Boolean);
    const transactions = [];

    // Detect format
    const isHdfc = /hdfc\s*bank/i.test(fullText) || /narration/i.test(fullText);
    const isFederal = /federal\s*bank/i.test(fullText) || /particulars/i.test(fullText);

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
        account_id: isFederal ? 'federal-8812' : (targetAccountId || 'hdfc-4921'),
        synced: true,
        source: 'PDF_IMPORT',
        created_at: new Date().toISOString()
      });
    }

    return {
      formatDetected: isFederal ? 'FEDERAL BANK PDF' : isHdfc ? 'HDFC BANK PDF' : 'BANK STATEMENT PDF',
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
   * Retrieve saved bank statement password from Dexie settings
   */
  static async getSavedPassword(bankCode = 'HDFC', userId = 'default-user') {
    const key = `pdf_pwd_${bankCode}_${userId}`;
    const item = await db.settings.get(key);
    if (item) return item.value;
    // Fallback to legacy global key
    const legacy = await db.settings.get(`pdf_pwd_${bankCode}`);
    return legacy ? legacy.value : '';
  }

  /**
   * Save bank statement password locally for automatic future unlocks
   */
  static async savePassword(bankCode = 'HDFC', password = '', userId = 'default-user') {
    const key = `pdf_pwd_${bankCode}_${userId}`;
    await db.settings.put({ key, value: password });
  }
}
