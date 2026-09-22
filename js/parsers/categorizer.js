/**
 * Indian UPI & Merchant Transaction Categorization Engine
 * Automatically tags categories and icons based on UPI narrations and vendor keywords.
 */

const CATEGORY_RULES = [
  {
    category: 'Dining',
    icon: '🍔',
    patterns: [/swiggy/i, /zomato/i, /starbucks/i, /mcdonald/i, /domino/i, /kfc/i, /burger\s*king/i, /chai\s*point/i, /pizza/i, /restaurant/i, /cafe/i, /barbeque/i]
  },
  {
    category: 'Groceries',
    icon: '🛒',
    patterns: [/blinkit/i, /zepto/i, /bigbasket/i, /instamart/i, /dmart/i, /d-mart/i, /more\s*retail/i, /nature.*basket/i, /grocery/i, /supermarket/i, /spencer/i]
  },
  {
    category: 'Shopping',
    icon: '🛍️',
    patterns: [/amazon/i, /flipkart/i, /myntra/i, /ajio/i, /tatacliq/i, /nykaa/i, /meesho/i, /zara/i, /h&m/i, /uniqlo/i, /lifestyle/i, /shoppers\s*stop/i]
  },
  {
    category: 'Investments',
    icon: '📈',
    patterns: [/zerodha/i, /groww/i, /kuvera/i, /upstox/i, /angel\s*one/i, /mutual\s*fund/i, /nippon/i, /uti/i, /sip/i, /etf/i, /broking/i, /sebi/i, /bse/i, /nse/i]
  },
  {
    category: 'Transport',
    icon: '🚗',
    patterns: [/uber/i, /ola/i, /rapido/i, /irctc/i, /metro/i, /fuel/i, /petrol/i, /diesel/i, /shell/i, /indianoil/i, /hpcl/i, /bpcl/i, /indigo/i, /air\s*india/i, /makemytrip/i, /fastag/i]
  },
  {
    category: 'Utilities',
    icon: '⚡',
    patterns: [/bescom/i, /adani/i, /tata\s*power/i, /electricity/i, /airtel/i, /jio/i, /broadband/i, /act\s*corp/i, /bbps/i, /water/i, /gas/i, /billdesk/i, /recharge/i]
  },
  {
    category: 'Entertainment',
    icon: '🍿',
    patterns: [/netflix/i, /spotify/i, /prime\s*video/i, /hotstar/i, /bookmyshow/i, /pvr/i, /inox/i, /cult\.?fit/i, /gym/i, /steam/i, /youtube/i, /apple\.com\/bill/i]
  },
  {
    category: 'Health',
    icon: '💊',
    patterns: [/apollo/i, /pharmeasy/i, /1mg/i, /medplus/i, /hospital/i, /clinic/i, /pharmacy/i, /diagnostic/i, /dr\./i]
  },
  {
    category: 'Salary',
    icon: '💼',
    patterns: [/salary/i, /payroll/i, /corp.*sal/i, /ach\s*c.*sal/i, /wipro/i, /infosys/i, /tcs/i, /accenture/i, /cognizant/i, /google/i, /microsoft/i]
  }
];

export function categorizeTransaction(narration = '', type = 'expense') {
  const text = String(narration);

  // Check if it's salary or explicit income
  if (type === 'income' || /salary|payroll|dividend|interest|int\.pd/i.test(text)) {
    if (/dividend/i.test(text)) {
      return { category: 'Investments', icon: '📈', cleanMerchant: extractCleanMerchant(text, 'Dividend Credit') };
    }
    if (/interest|int\.pd/i.test(text)) {
      return { category: 'Investments', icon: '💰', cleanMerchant: 'Bank Interest Credit' };
    }
    return { category: 'Salary', icon: '💼', cleanMerchant: extractCleanMerchant(text, 'Salary Credit') };
  }

  // Check against categorized pattern rules
  for (const rule of CATEGORY_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(text)) {
        return {
          category: rule.category,
          icon: rule.icon,
          cleanMerchant: extractCleanMerchant(text, rule.category)
        };
      }
    }
  }

  // Default fallback
  return {
    category: 'Other',
    icon: '🏷️',
    cleanMerchant: extractCleanMerchant(text, 'Transaction')
  };
}

// Clean messy bank narrations into user-friendly merchant names
export function extractCleanMerchant(narration = '', fallback = 'Merchant') {
  let s = String(narration).trim();

  // Handle UPI formats like "UPI-SWIGGY-BANGALORE-UPI/428194829104@icici"
  // or "UPI/DR/492019284719/ZEPTO QUICK COMM/ZEPTO@KBL/GROCERY"
  if (/^UPI/i.test(s)) {
    const parts = s.split(/[\/-]/);
    for (const p of parts) {
      const clean = p.trim();
      if (
        clean.length > 2 &&
        !/^UPI$/i.test(clean) &&
        !/^DR$/i.test(clean) &&
        !/^CR$/i.test(clean) &&
        !/^\d+$/.test(clean) &&
        !clean.includes('@')
      ) {
        return formatTitleCase(clean);
      }
    }
  }

  // Handle ACH/POS formats
  s = s.replace(/^(ACH\s+[CD]-|POS\s+\d+\s+|NEFT\s+[A-Z0-9]+-|RTGS\s+|IMPS\s+\d+\s+)/i, '');
  const firstChunk = s.split(/[-–—/]/)[0].trim();
  if (firstChunk && firstChunk.length > 2) {
    return formatTitleCase(firstChunk);
  }

  return fallback;
}

function formatTitleCase(str) {
  return str
    .toLowerCase()
    .split(' ')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export const ALL_CATEGORIES = [
  { name: 'Dining', icon: '🍔' },
  { name: 'Groceries', icon: '🛒' },
  { name: 'Shopping', icon: '🛍️' },
  { name: 'Transport', icon: '🚗' },
  { name: 'Utilities', icon: '⚡' },
  { name: 'Investments', icon: '📈' },
  { name: 'Entertainment', icon: '🍿' },
  { name: 'Health', icon: '💊' },
  { name: 'Salary', icon: '💼' },
  { name: 'Other', icon: '🏷️' }
];
