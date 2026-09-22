/**
 * Bank Statement CSV / XLS Parser
 * Client-side parser for HDFC Bank, Federal Bank, and generic Indian bank exports.
 */

import { categorizeTransaction } from './categorizer.js';

export class BankStatementParser {
  /**
   * Parse CSV string into standardized transaction objects
   * @param {string} csvText - Raw CSV text
   * @param {string} targetAccountId - Dexie Account ID
   */
  static parse(csvText, targetAccountId) {
    if (!window.Papa) {
      throw new Error('PapaParse library is not loaded');
    }

    const parsed = window.Papa.parse(csvText.trim(), {
      skipEmptyLines: true,
      header: false
    });

    if (!parsed.data || parsed.data.length < 2) {
      throw new Error('CSV file is empty or invalid format');
    }

    // Find header row (some bank exports have preamble notes)
    let headerRowIdx = -1;
    let bankFormat = 'generic';

    for (let i = 0; i < Math.min(15, parsed.data.length); i++) {
      const rowStr = parsed.data[i].join(' ').toLowerCase();
      if (rowStr.includes('narration') && rowStr.includes('withdrawal')) {
        headerRowIdx = i;
        bankFormat = 'hdfc';
        break;
      } else if (rowStr.includes('particulars') && (rowStr.includes('debit') || rowStr.includes('type'))) {
        headerRowIdx = i;
        bankFormat = 'federal';
        break;
      } else if (rowStr.includes('date') && (rowStr.includes('amount') || rowStr.includes('debit'))) {
        headerRowIdx = i;
        bankFormat = 'generic';
        break;
      }
    }

    if (headerRowIdx === -1) {
      headerRowIdx = 0; // Default to first row
    }

    const headers = parsed.data[headerRowIdx].map(h => String(h).trim());
    const dataRows = parsed.data.slice(headerRowIdx + 1);

    const transactions = [];

    if (bankFormat === 'hdfc') {
      transactions.push(...this.parseHDFC(headers, dataRows, targetAccountId));
    } else if (bankFormat === 'federal') {
      transactions.push(...this.parseFederal(headers, dataRows, targetAccountId));
    } else {
      transactions.push(...this.parseGeneric(headers, dataRows, targetAccountId));
    }

    return {
      formatDetected: bankFormat.toUpperCase(),
      totalParsed: transactions.length,
      transactions
    };
  }

  // HDFC Format: Date, Narration, Chq./Ref.No., Value Dt, Withdrawal Amt., Deposit Amt., Closing Balance
  static parseHDFC(headers, rows, accountId) {
    const dateIdx = headers.findIndex(h => /date/i.test(h));
    const narrIdx = headers.findIndex(h => /narration/i.test(h));
    const debitIdx = headers.findIndex(h => /withdrawal/i.test(h));
    const creditIdx = headers.findIndex(h => /deposit/i.test(h));

    const results = [];

    for (const row of rows) {
      if (!row[dateIdx] || !row[narrIdx]) continue;

      const dateStr = this.normalizeDate(row[dateIdx]);
      const narration = String(row[narrIdx]).trim();
      const debitStr = row[debitIdx] ? String(row[debitIdx]).replace(/,/g, '').trim() : '';
      const creditStr = row[creditIdx] ? String(row[creditIdx]).replace(/,/g, '').trim() : '';

      const debit = parseFloat(debitStr) || 0;
      const credit = parseFloat(creditStr) || 0;

      if (debit <= 0 && credit <= 0) continue;

      const type = credit > 0 ? 'income' : 'expense';
      const amount = type === 'income' ? credit : debit;
      const { category, cleanMerchant } = categorizeTransaction(narration, type);

      results.push({
        date: dateStr,
        narration,
        merchant: cleanMerchant,
        category,
        type,
        amount,
        currency: 'INR',
        account_id: accountId || 'hdfc-4921',
        synced: true,
        created_at: new Date().toISOString()
      });
    }

    return results;
  }

  // Federal Bank Format: Tran Date, Particulars, Type, Cheque No, Debit, Credit, Balance
  static parseFederal(headers, rows, accountId) {
    const dateIdx = headers.findIndex(h => /tran\s*date|date/i.test(h));
    const narrIdx = headers.findIndex(h => /particulars/i.test(h));
    const debitIdx = headers.findIndex(h => /debit/i.test(h));
    const creditIdx = headers.findIndex(h => /credit/i.test(h));

    const results = [];

    for (const row of rows) {
      if (!row[dateIdx] || !row[narrIdx]) continue;

      const dateStr = this.normalizeDate(row[dateIdx]);
      const narration = String(row[narrIdx]).trim();
      const debitStr = row[debitIdx] ? String(row[debitIdx]).replace(/,/g, '').trim() : '';
      const creditStr = row[creditIdx] ? String(row[creditIdx]).replace(/,/g, '').trim() : '';

      const debit = parseFloat(debitStr) || 0;
      const credit = parseFloat(creditStr) || 0;

      if (debit <= 0 && credit <= 0) continue;

      const type = credit > 0 ? 'income' : 'expense';
      const amount = type === 'income' ? credit : debit;
      const { category, cleanMerchant } = categorizeTransaction(narration, type);

      results.push({
        date: dateStr,
        narration,
        merchant: cleanMerchant,
        category,
        type,
        amount,
        currency: 'INR',
        account_id: accountId || 'federal-8812',
        synced: true,
        created_at: new Date().toISOString()
      });
    }

    return results;
  }

  // Generic CSV format
  static parseGeneric(headers, rows, accountId) {
    const dateIdx = headers.findIndex(h => /date/i.test(h));
    const narrIdx = headers.findIndex(h => /narration|description|particulars|merchant/i.test(h));
    const debitIdx = headers.findIndex(h => /debit|withdrawal|expense/i.test(h));
    const creditIdx = headers.findIndex(h => /credit|deposit|income/i.test(h));
    const amtIdx = headers.findIndex(h => /amount/i.test(h));

    const results = [];

    for (const row of rows) {
      if (dateIdx === -1 || !row[dateIdx]) continue;

      const dateStr = this.normalizeDate(row[dateIdx]);
      const narration = narrIdx !== -1 ? String(row[narrIdx]).trim() : 'Transaction';

      let debit = 0;
      let credit = 0;

      if (debitIdx !== -1 && row[debitIdx]) debit = parseFloat(String(row[debitIdx]).replace(/,/g, '')) || 0;
      if (creditIdx !== -1 && row[creditIdx]) credit = parseFloat(String(row[creditIdx]).replace(/,/g, '')) || 0;

      if (amtIdx !== -1 && debit === 0 && credit === 0) {
        const val = parseFloat(String(row[amtIdx]).replace(/,/g, '')) || 0;
        if (val < 0) debit = Math.abs(val);
        else credit = val;
      }

      if (debit <= 0 && credit <= 0) continue;

      const type = credit > 0 ? 'income' : 'expense';
      const amount = type === 'income' ? credit : debit;
      const { category, cleanMerchant } = categorizeTransaction(narration, type);

      results.push({
        date: dateStr,
        narration,
        merchant: cleanMerchant,
        category,
        type,
        amount,
        currency: 'INR',
        account_id: accountId || 'hdfc-4921',
        synced: true,
        created_at: new Date().toISOString()
      });
    }

    return results;
  }

  // Normalizes DD/MM/YYYY or DD-MM-YYYY to YYYY-MM-DD
  static normalizeDate(str) {
    const clean = String(str).trim();
    const parts = clean.split(/[\/\-\.]/);

    if (parts.length === 3) {
      if (parts[0].length === 4) {
        // YYYY-MM-DD
        return `${parts[0]}-${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
      } else {
        // DD/MM/YYYY
        let year = parts[2];
        if (year.length === 2) year = '20' + year;
        return `${year}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
      }
    }

    return new Date().toISOString().split('T')[0];
  }
}
