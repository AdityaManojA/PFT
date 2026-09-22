/**
 * Gmail Bank Statement Sync Service
 * Direct in-browser automated statement fetching via Gmail REST API.
 * Eliminates regulatory AA dependencies by searching the user's inbox
 * for weekly bank statements (keyword: bank name + 'STATEMENT' + PDF attachment).
 */

import { BankPDFParser } from '../parsers/pdf-parser.js';
import { db, getCurrentUser } from '../db.js';
import { FirebaseAuthService } from '../auth.js';

export class GmailStatementSyncService {
  /**
   * Check if a weekly auto-pull is due (7 days since last sync)
   */
  static isWeeklySyncDue() {
    const lastSync = localStorage.getItem('sbafa_last_gmail_sync');
    if (!lastSync) return true;
    const diffDays = (Date.now() - parseInt(lastSync, 10)) / (1000 * 60 * 60 * 24);
    return diffDays >= 7;
  }

  /**
   * Get formatted last sync time
   */
  static getLastSyncLabel() {
    const lastSync = localStorage.getItem('sbafa_last_gmail_sync');
    if (!lastSync) return 'Never checked';
    const date = new Date(parseInt(lastSync, 10));
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  /**
   * Sync bank statements from Gmail
   * @param {string} bankName - e.g. "Federal Bank" or "HDFC"
   * @param {string} passkey - Statement password if known
   * @param {Function} showToast - Toast notifier
   * @param {Function} onProgress - Progress status callback
   */
  static async syncStatementsFromGmail(bankName = 'Federal Bank', passkey = '', showToast, onProgress) {
    if (onProgress) onProgress('Connecting to Google OAuth...');

    // Acquire dedicated Google access token with Gmail scope
    let token = await this.requestGoogleAccessToken();

    if (!token) {
      throw new Error(
        'Gmail authorization required. Please authorize Google access.'
      );
    }

    const cleanBank = bankName.replace(/\s*Bank\s*/i, '').trim();
    // Search query: keyword of bank name + STATEMENT + PDF attachment
    const query = `(${cleanBank} OR "${bankName}") STATEMENT filename:pdf`;
    
    if (onProgress) onProgress(`Searching Gmail for "${cleanBank} STATEMENT"...`);

    const listUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(query)}&maxResults=5`;
    const listRes = await fetch(listUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!listRes.ok) {
      let errDetail = '';
      try {
        const errJson = await listRes.json();
        errDetail = errJson?.error?.message || '';
      } catch (e) {}

      if (listRes.status === 401 || errDetail.toLowerCase().includes('insufficient authentication scopes')) {
        sessionStorage.removeItem('google_gmail_token');
        sessionStorage.removeItem('google_access_token');
        throw new Error('Gmail authorization missing or expired. Please click Fetch & Sync Statements to grant Gmail access.');
      }

      if (listRes.status === 403) {
        if (errDetail.toLowerCase().includes('disabled') || errDetail.toLowerCase().includes('has not been used')) {
          throw new Error('Gmail API is not enabled in your Google Cloud Console. Enable it at: https://console.cloud.google.com/apis/library/gmail.googleapis.com?project=sbafa-ft');
        }
        throw new Error(`Gmail API permission denied (403): ${errDetail || 'Please enable Gmail API in Google Cloud Console (project: sbafa-ft) and ensure your email is added to Test Users.'}`);
      }
      throw new Error(`Gmail API error: ${errDetail || listRes.statusText}`);
    }

    const listData = await listRes.json();
    if (!listData.messages || listData.messages.length === 0) {
      localStorage.setItem('sbafa_last_gmail_sync', Date.now().toString());
      return { count: 0, message: `No statement emails found for ${bankName} with keyword 'STATEMENT'.` };
    }

    if (onProgress) onProgress(`Found ${listData.messages.length} statement email(s). Downloading latest PDF...`);

    // Fetch the most recent message details
    const msgId = listData.messages[0].id;
    const msgUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}`;
    const msgRes = await fetch(msgUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!msgRes.ok) {
      let msgErr = '';
      try { const j = await msgRes.json(); msgErr = j?.error?.message; } catch(e){}
      throw new Error(`Failed to fetch statement email content: ${msgErr || msgRes.statusText}`);
    }

    const msgData = await msgRes.json();

    // Find the PDF attachment part
    const pdfPart = this.findPdfPart(msgData.payload);
    if (!pdfPart || !pdfPart.body?.attachmentId) {
      throw new Error('Statement email found, but no PDF attachment was attached.');
    }

    if (onProgress) onProgress('Fetching PDF attachment from Gmail...');

    // Download the attachment data
    const attachUrl = `https://gmail.googleapis.com/gmail/v1/users/me/messages/${msgId}/attachments/${pdfPart.body.attachmentId}`;
    const attachRes = await fetch(attachUrl, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (!attachRes.ok) {
      let attachErr = '';
      try { const j = await attachRes.json(); attachErr = j?.error?.message; } catch(e){}
      throw new Error(`Failed to download PDF attachment from Gmail: ${attachErr || attachRes.statusText}`);
    }

    const attachData = await attachRes.json();

    // Gmail returns base64url encoded data
    const base64 = attachData.data.replace(/-/g, '+').replace(/_/g, '/');
    const binaryStr = atob(base64);
    const bytes = new Uint8Array(binaryStr.length);
    for (let i = 0; i < binaryStr.length; i++) {
      bytes[i] = binaryStr.charCodeAt(i);
    }
    const pdfArrayBuffer = bytes.buffer;

    if (onProgress) onProgress('Decrypting & parsing statement...');

    // Try given passkey and saved passwords
    let pdfText = null;
    const curUser = await getCurrentUser();
    const userId = curUser ? curUser.id : null;
    const primaryBank = await BankPDFParser.getPrimaryBank(userId);
    const savedPrimary = await BankPDFParser.getSavedPassword(primaryBank, userId);
    const savedBankPwd = await BankPDFParser.getSavedPassword(cleanBank.toUpperCase().includes('FED') ? 'FEDERAL' : 'HDFC', userId);
    const candidates = [passkey, savedPrimary, savedBankPwd, ''].filter((p, idx, arr) => p !== undefined && arr.indexOf(p) === idx);

    for (const cand of candidates) {
      try {
        pdfText = await BankPDFParser.extractPdfText(pdfArrayBuffer, cand);
        if (pdfText) break;
      } catch (err) {}
    }

    if (!pdfText) {
      throw new Error(`Statement PDF retrieved for ${bankName}, but decryption failed. Please verify your PDF password.`);
    }

    const fileName = pdfPart.filename || `${cleanBank}_Statement.pdf`;
    const parsed = BankPDFParser.parseTextToTransactions(pdfText, null, fileName);

    // If PDF text didn't yield last 4 digits, check email subject and snippet
    let finalLast4 = parsed.accountNumberLast4;
    let finalMask = parsed.accountNumberMask;

    if (!finalLast4) {
      const subjHeader = msgData.payload?.headers?.find(h => h.name?.toLowerCase() === 'subject')?.value || '';
      const subjMatch = (subjHeader + ' ' + (msgData.snippet || '')).match(/(?:ending\s+in|ending\s+with|A\/c\s*(?:no\.?)?|Account\s*(?:no\.?)?)\s*[:\-\s]?\s*([0-9Xx\*]{4,20})/i);
      if (subjMatch) {
        const d = subjMatch[1].replace(/\D/g, '');
        if (d.length >= 4) {
          finalLast4 = d.slice(-4);
          finalMask = '•••• ' + finalLast4;
        }
      }
    }

    // Save timestamp
    localStorage.setItem('sbafa_last_gmail_sync', Date.now().toString());

    return {
      count: parsed.totalParsed,
      transactions: parsed.transactions,
      availableBalance: parsed.availableBalance,
      statementDate: parsed.statementDate,
      accountNumberMask: finalMask,
      accountNumberLast4: finalLast4,
      detectedBank: parsed.detectedBank,
      bankCode: parsed.bankCode,
      fileName,
      message: `Fetched ${parsed.totalParsed} transactions for ${parsed.detectedBank} (${finalMask})!`
    };
  }

  /**
   * Helper to recursively locate PDF part in Gmail payload
   */
  static findPdfPart(part) {
    if (!part) return null;
    if (part.filename && part.filename.toLowerCase().endsWith('.pdf')) {
      return part;
    }
    if (part.mimeType === 'application/pdf') {
      return part;
    }
    if (part.parts && Array.isArray(part.parts)) {
      for (const sub of part.parts) {
        const found = this.findPdfPart(sub);
        if (found) return found;
      }
    }
    return null;
  }

  /**
   * Request Google OAuth token with Gmail scope
   */
  static async requestGoogleAccessToken() {
    return await FirebaseAuthService.getGmailAccessToken();
  }
}
