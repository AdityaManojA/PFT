globalThis.window = { Dexie: class { version() { return this; } stores() { return this; } } };
import { BankPDFParser } from '../js/parsers/pdf-parser.js';
import { categorizeTransaction, extractCleanMerchant } from '../js/parsers/categorizer.js';

const testLines = [
  '01-APR-2025 01-APR-2025 UPIOUT/509137154876/palmtree.63468258@hdfcba/5499 TFR C93972700 220.00 1440.76 Cr',
  '01-APR-2025 01-APR-2025 UPIOUT/102401983718/axisbankltdbbps.rzp@axis/4112 TFR C93999875 27.00 1413.76 Cr',
  '01-APR-2025 01-APR-2025 UPIOUT/102437594497/nirunair005@okhdfcbank/U/0000 TFR S45594180 50.00 1363.76 Cr',
  '01-APR-2025 01-APR-2025 UPI IN/102437697951/nirunair005@okhdfcbank/U/0000 TFR S45614323 50.00 1413.76 Cr',
  '01-APR-2025 01-APR-2025 UPIOUT/509146241842/gpay-11255294316@okbizax/5812 TFR S47396159 50.00 1363.76 Cr',
  '02-APR-2025 02-APR-2025 UPIOUT/509248670747/q051776628@ybl/Paid via /5411 TFR S50651274 28.00 1335.76 Cr',
  '02-APR-2025 02-APR-2025 UPIOUT/509250101073/vyapar.170059501032@hdfc/5812 TFR S52472581 20.00 1315.76 Cr',
  '02-APR-2025 02-APR-2025 UPIOUT/509254013777/seaportcafe412@fbl/Paid /5812 TFR S57376383 46.00 1269.76 Cr',
  '02-APR-2025 02-APR-2025 UPIOUT/509255815887/adnixprotvpm@ybl/Payment/5733 TFR S59424001 170.00 1099.76 Cr',
  '02-APR-2025 02-APR-2025 UPIOUT/509231661165/spotify.bdsi@icici/Manda/4899 TFR S62335510 59.00 1010.76 Cr',
  '03-APR-2025 03-APR-2025 UPIOUT/509361298635/pkt-9995999228@okbizaxis/7523 TFR S65317349 94.64 906.12 Cr',
  // User's specific September 2026 transactions:
  '22-SEP-2026 22-SEP-2026 UPIOUT/626512345678/q747985925@ybl/5411 TRF S47985925 434.39 474.39 Cr',
  '19-SEP-2026 19-SEP-2026 MB FTB/134208099/self TRF S47123456 488.04 908.78 Cr',
  '19-SEP-2026 19-SEP-2026 UPIOUT/626212345678/chai-point@icici/5812 TRF S47123999 38.04 870.74 Cr'
];

console.log('--- Testing Current Categorization ---');
testLines.forEach(l => {
  const parsed = BankPDFParser.parseTextToTransactions(l);
  if (parsed.transactions.length > 0) {
    const t = parsed.transactions[0];
    console.log(`[${t.category.padEnd(12)}] Merchant: "${t.merchant}" | Amt: Rs.${t.amount} | Raw: ${l.slice(0, 60)}...`);
  }
});
