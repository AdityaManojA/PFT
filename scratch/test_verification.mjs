import { BankPDFParser } from '../js/parsers/pdf-parser.js';
import fs from 'fs';
import path from 'path';

console.log('=== RUNNING CODE-LEVEL TESTS ===');

// 1. Verify BankPDFParser.getSavedPassword exists
if (typeof BankPDFParser.getSavedPassword !== 'function') {
  console.error('FAIL: BankPDFParser.getSavedPassword is not a function');
  process.exit(1);
} else {
  console.log('PASS: BankPDFParser.getSavedPassword is a function');
}

// 2. Test Balance Regex
const testHeaders = [
  'Effective Available Balance : 474.39',
  'Effective Available Balance : 1,474.39',
  'Effective Available Balance 550.00',
  'Available Balance: INR 2,500.50',
  'Closing Balance : ₹12,345.67'
];

const balRegex = /(?:Effective\s+Available\s+Balance|Available\s+Balance|Closing\s+Balance)\s*:?\s*(?:INR|Rs\.?|₹)?\s*([\d,]+(?:\.\d{2})?)/i;

for (const header of testHeaders) {
  const match = header.match(balRegex);
  if (!match) {
    console.error(`FAIL: Balance regex did not match "${header}"`);
    process.exit(1);
  }
  const val = parseFloat(match[1].replace(/,/g, ''));
  console.log(`PASS: Parsed "${header}" -> ${val}`);
}

// 3. Test Statement Transaction Parsing
const sampleStatement = `
FEDERAL BANK
STATEMENT OF ACCOUNT
Account Number: 1234567890
Effective Available Balance : 474.39
Date Particulars Tran ID Withdrawals Deposits Balance
01/05/2024 UPIOUT/Palmtree/123456789 250.00 474.39 Cr
02/05/2024 UPI IN/Refund Spotify/987654321 150.00 624.39 Cr
`;

const parsed = BankPDFParser.parseTextToTransactions(sampleStatement);
console.log('PASS: Parsed statement:', {
  detectedBank: parsed.detectedBank,
  bankCode: parsed.bankCode,
  availableBalance: parsed.availableBalance,
  totalParsed: parsed.totalParsed
});

if (parsed.availableBalance !== 474.39 || parsed.totalParsed !== 2) {
  console.error('FAIL: Statement parsing mismatch', parsed);
  process.exit(1);
}

// 4. Check for alerts and confirms in code
const jsDir = 'd:/Projects/PFT/js';
function checkFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      checkFiles(full);
    } else if (entry.name.endsWith('.js')) {
      const code = fs.readFileSync(full, 'utf8');
      if (/\balert\s*\(/.test(code)) {
        console.error(`FAIL: Found raw alert() in ${full}`);
        process.exit(1);
      }
      if (/\bconfirm\s*\(/.test(code)) {
        console.error(`FAIL: Found raw confirm() in ${full}`);
        process.exit(1);
      }
    }
  }
}
checkFiles(jsDir);
console.log('PASS: Zero raw alert() or confirm() in all JS files');

console.log('ALL CODE-LEVEL CHECKS PASSED.');
