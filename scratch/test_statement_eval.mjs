globalThis.window = { Dexie: class MockDexie { version() { return { stores() {} }; } } };
import { BankPDFParser } from '../js/parsers/pdf-parser.js';
import { categorizeTransaction } from '../js/parsers/categorizer.js';

const statementLines = [
  '01-APR-2025 01-APR-2025 UPIOUT/509137154876/palmtree.63468258@hdfcba/5499 TFR C93972700 220.00 1440.76 Cr',
  '01-APR-2025 01-APR-2025 UPIOUT/102401983718/axisbankltdbbps.rzp@axis/4112 TFR C93999875 27.00 1413.76 Cr',
  '01-APR-2025 01-APR-2025 UPIOUT/102437594497/nirunair005@okhdfcbank/U/0000 TFR S45594180 50.00 1363.76 Cr',
  '01-APR-2025 01-APR-2025 UPI IN/102437697951/nirunair005@okhdfcbank/U/0000 TFR S45614323 50.00 1413.76 Cr',
  '01-APR-2025 01-APR-2025 UPIOUT/509146241842/gpay-11255294316@okbizax/5812 TFR S47396159 50.00 1363.76 Cr',
  '02-APR-2025 02-APR-2025 UPIOUT/509248670747/q051776628@ybl/Paid via /5411 TFR S50651274 28.00 1335.76 Cr',
  '02-APR-2025 02-APR-2025 UPIOUT/509250101073/vyapar.170059501032@hdfc/5812 TFR S52472581 20.00 1315.76 Cr',
  '02-APR-2025 02-APR-2025 UPIOUT/509254013777/seaportcafe412@fbl/Paid /5812 TFR S57376383 46.00 1269.76 Cr',
  '02-APR-2025 02-APR-2025 UPIOUT/509255815887/adnixprotvpm@ybl/Payment/5733 TFR S59424001 170.00 1099.76 Cr',
  '02-APR-2025 02-APR-2025 UPIOUT/509255834716/adnixprotvpm@ybl/Payment/5733 TFR S59433073 30.00 1069.76 Cr',
  '02-APR-2025 02-APR-2025 UPIOUT/509231661165/spotify.bdsi@icici/Manda/4899 TFR S62335510 59.00 1010.76 Cr',
  '02-APR-2025 03-APR-2025 UPIOUT/509359285303/gpay-11255294316@okbizax/5812 TFR S62886108 10.00 1000.76 Cr',
  '03-APR-2025 03-APR-2025 UPIOUT/509361298635/pkt-9995999228@okbizaxis/7523 TFR S65317349 94.64 906.12 Cr',
  '03-APR-2025 03-APR-2025 UPIOUT/509361621755/q240374593@ybl/Paid via /5812 TFR S65650306 120.00 786.12 Cr',
  '03-APR-2025 03-APR-2025 UPI IN/509358942952/sarathc7015-1@okaxis/UPI/0000 TFR S66146800 30.00 816.12 Cr'
];

const sampleDoc = `
The Federal Bank Ltd.
Effective Available Balance : 474.39
Customer ID : 134208099
Statement of Account for the period 2025-04-01 to 2026-03-31
Date Value Date Particulars Tran Type Tran ID Cheque Details Withdrawals Deposits Balance DR/CR
Opening Balance 1660.76 Cr
${statementLines.join('\n')}
`;

const res = BankPDFParser.parseTextToTransactions(sampleDoc);
console.log(`Parsed total: ${res.totalParsed} txns, Available Balance: ${res.availableBalance}`);
res.transactions.forEach((t, i) => {
  console.log(`[${i+1}] Date: ${t.date} | Type: ${t.type.padEnd(7)} | Amount: ₹${t.amount.toFixed(2).padStart(7)} | Cat: ${t.category.padEnd(13)} | Merchant: ${t.merchant}`);
});
