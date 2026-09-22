/**
 * Modern Indian UPI & Banking Categorization Engine
 * Powered by NPCI 4-digit Merchant Category Codes (MCC), vendor heuristics,
 * VPA handle parsing, and intelligent P2P transfer recognition.
 */

export const CATEGORY_DEFINITIONS = {
  Dining: { name: 'Dining', icon: '🍔', color: '#F97316', bg: 'rgba(249, 115, 22, 0.12)' },
  Groceries: { name: 'Groceries', icon: '🛒', color: '#10B981', bg: 'rgba(16, 185, 129, 0.12)' },
  Shopping: { name: 'Shopping', icon: '🛍️', color: '#EC4899', bg: 'rgba(236, 72, 153, 0.12)' },
  Entertainment: { name: 'Entertainment', icon: '🍿', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.12)' },
  Transport: { name: 'Transport', icon: '🚗', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.12)' },
  Utilities: { name: 'Utilities', icon: '⚡', color: '#EAB308', bg: 'rgba(234, 179, 8, 0.12)' },
  Health: { name: 'Health', icon: '💊', color: '#EF4444', bg: 'rgba(239, 68, 68, 0.12)' },
  Investments: { name: 'Investments', icon: '📈', color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.12)' },
  Transfers: { name: 'Transfers', icon: '🔄', color: '#64748B', bg: 'rgba(100, 116, 139, 0.12)' },
  Salary: { name: 'Salary', icon: '💼', color: '#22C55E', bg: 'rgba(34, 197, 94, 0.12)' },
  Other: { name: 'Other', icon: '🏷️', color: '#94A3B8', bg: 'rgba(148, 163, 184, 0.12)' }
};

export const ALL_CATEGORIES = Object.values(CATEGORY_DEFINITIONS);

export function getCategoryMeta(catName) {
  return CATEGORY_DEFINITIONS[catName] || CATEGORY_DEFINITIONS.Other;
}

// Ordered rules: Specific heuristics evaluated first
const SPECIFIC_VENDOR_RULES = [
  // Utilities & Bills (Priority: match BBPS, recharge, electricity before transport MCCs)
  {
    category: 'Utilities',
    icon: '⚡',
    patterns: [
      /bbps/i, /billdesk/i, /bescom/i, /adani.*power/i, /tata.*power/i, /electricity/i,
      /airtel/i, /jio/i, /broadband/i, /act.*fibernet/i, /water\s*board/i, /gas\s*bill/i,
      /recharge/i, /dth/i, /postpaid/i, /prepaid/i
    ]
  },
  // Entertainment & Streaming
  {
    category: 'Entertainment',
    icon: '🍿',
    patterns: [
      /spotify/i, /netflix/i, /hotstar/i, /prime.*video/i, /bookmyshow/i, /pvr/i, /inox/i,
      /steam/i, /youtube/i, /apple\.com\/bill/i, /sony.*liv/i, /zee5/i, /cult\.?fit/i,
      /\/(4899|5735|7832|7922|7929|7991|7996|7997)\b/ // MCC: Cable, Streaming, Amusements
    ]
  },
  // Dining & Restaurants
  {
    category: 'Dining',
    icon: '🍔',
    patterns: [
      /swiggy/i, /zomato/i, /starbucks/i, /mcdonald/i, /domino/i, /kfc/i, /burger\s*king/i,
      /palmtree/i, /seaportcafe/i, /cafe/i, /restaurant/i, /pizza/i, /biryani/i, /dhaba/i,
      /baker/i, /kitchen/i, /canteen/i, /food/i, /eatery/i,
      /\/(581[1-4]|5812)\b/ // MCC: Eating Places, Restaurants
    ]
  },
  // Groceries & Supermarkets
  {
    category: 'Groceries',
    icon: '🛒',
    patterns: [
      /blinkit/i, /zepto/i, /bigbasket/i, /instamart/i, /dmart/i, /d-mart/i, /more\s*retail/i,
      /nature.*basket/i, /grocery/i, /supermarket/i, /spencer/i, /vegetables/i, /fruits/i,
      /\/(5411|5499|5422|5441|5451|5462)\b/ // MCC: Grocery, Supermarkets, Food Stores
    ]
  },
  // Shopping & Retail
  {
    category: 'Shopping',
    icon: '🛍️',
    patterns: [
      /amazon/i, /flipkart/i, /myntra/i, /ajio/i, /tatacliq/i, /nykaa/i, /meesho/i, /zara/i,
      /h&m/i, /uniqlo/i, /adnix/i, /vyapar/i, /lifestyle/i, /shoppers\s*stop/i, /croma/i,
      /reliance\s*digital/i, /store/i, /mart/i, /electronics/i, /clothing/i, /fashion/i,
      /\/(5732|5733|5311|5331|5611|5621|5651|5691|5941|5942|5943|5944)\b/ // MCC: Retail, Department stores
    ]
  },
  // Transport & Travel
  {
    category: 'Transport',
    icon: '🚗',
    patterns: [
      /uber/i, /ola/i, /rapido/i, /irctc/i, /metro/i, /fuel/i, /petrol/i, /diesel/i,
      /shell/i, /indianoil/i, /hpcl/i, /bpcl/i, /indigo/i, /air\s*india/i, /makemytrip/i,
      /fastag/i, /toll/i, /parking/i, /pkt/i,
      /\/(7523|7524|5541|5542|4111|4112|4121|4131|4789)\b/ // MCC: Parking, Service Stations, Rails, Cabs
    ]
  },
  // Health & Medicine
  {
    category: 'Health',
    icon: '💊',
    patterns: [
      /apollo/i, /pharmeasy/i, /1mg/i, /medplus/i, /hospital/i, /clinic/i, /pharmacy/i,
      /diagnostic/i, /dr\./i, /netmeds/i, /practo/i, /dent/i, /optical/i,
      /\/(5912|8011|8021|8031|8041|8042|8049|8062|8071|8099)\b/ // MCC: Drug Stores, Doctors, Hospitals
    ]
  },
  // Investments & Trading
  {
    category: 'Investments',
    icon: '📈',
    patterns: [
      /zerodha/i, /groww/i, /kuvera/i, /upstox/i, /angel\s*one/i, /mutual\s*fund/i,
      /nippon/i, /uti/i, /sip/i, /etf/i, /broking/i, /sebi/i, /bse/i, /nse/i, /indmoney/i,
      /\/(6211|6051)\b/ // MCC: Security Brokers, Investments
    ]
  },
  // Utilities MCC Catch-all
  {
    category: 'Utilities',
    icon: '⚡',
    patterns: [
      /\/(4900|4814|4812|4813|4816|4821)\b/
    ]
  },
  // P2P Transfers & UPI Personal
  {
    category: 'Transfers',
    icon: '🔄',
    patterns: [
      /\/0000\b/, // MCC 0000 = P2P UPI Transfer
      /\/6540\b/, // POI Stored Value / P2P
      /transfer\s*to/i, /sent\s*to/i, /p2p/i
    ]
  }
];

export function categorizeTransaction(narration = '', type = 'expense') {
  const text = String(narration || '').trim();

  // 1. Income Classification
  if (type === 'income') {
    // Explicit Salary
    if (/salary|payroll|corp.*sal|ach\s*c.*sal|wipro|infosys|tcs|accenture|cognizant/i.test(text)) {
      return {
        category: 'Salary',
        icon: '💼',
        cleanMerchant: extractCleanMerchant(text, 'Salary Deposit')
      };
    }
    // Dividends
    if (/dividend/i.test(text)) {
      return {
        category: 'Investments',
        icon: '📈',
        cleanMerchant: extractCleanMerchant(text, 'Dividend Credit')
      };
    }
    // Interest Credits
    if (/interest|int\.pd/i.test(text)) {
      return {
        category: 'Investments',
        icon: '💰',
        cleanMerchant: 'Bank Interest Credit'
      };
    }
    // Cashback & Refunds
    if (/cashback|refund|reversal|reward/i.test(text)) {
      return {
        category: 'Other',
        icon: '🎁',
        cleanMerchant: extractCleanMerchant(text, 'Refund / Cashback')
      };
    }
    // P2P Credits & UPI In
    return {
      category: 'Transfers',
      icon: '🔄',
      cleanMerchant: extractCleanMerchant(text, 'Transfer Deposit')
    };
  }

  // 2. Expense Classification by Heuristics & MCC Codes
  for (const rule of SPECIFIC_VENDOR_RULES) {
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

  // 3. Fallback: If it's a personal UPI transfer (e.g. handle has personal name)
  if (/^UPI(OUT|\s*IN)?/i.test(text)) {
    return {
      category: 'Transfers',
      icon: '🔄',
      cleanMerchant: extractCleanMerchant(text, 'UPI Transfer')
    };
  }

  // Default fallback
  return {
    category: 'Other',
    icon: '🏷️',
    cleanMerchant: extractCleanMerchant(text, 'Expense')
  };
}

// Clean bank narrations into clear, modern merchant brand names
export function extractCleanMerchant(narration = '', fallback = 'Merchant') {
  let s = String(narration || '').trim();

  // Known brand substitutions
  const brandKeywords = [
    { pattern: /spotify/i, name: 'Spotify' },
    { pattern: /swiggy/i, name: 'Swiggy' },
    { pattern: /zomato/i, name: 'Zomato' },
    { pattern: /blinkit/i, name: 'Blinkit' },
    { pattern: /zepto/i, name: 'Zepto' },
    { pattern: /instamart/i, name: 'Instamart' },
    { pattern: /amazon/i, name: 'Amazon' },
    { pattern: /flipkart/i, name: 'Flipkart' },
    { pattern: /uber/i, name: 'Uber' },
    { pattern: /ola/i, name: 'Ola Cabs' },
    { pattern: /rapido/i, name: 'Rapido' },
    { pattern: /irctc/i, name: 'IRCTC' },
    { pattern: /netflix/i, name: 'Netflix' },
    { pattern: /palmtree/i, name: 'Palmtree' },
    { pattern: /seaportcafe/i, name: 'Seaport Cafe' },
    { pattern: /adnix/i, name: 'Adnix Store' },
    { pattern: /vyapar/i, name: 'Vyapar' },
    { pattern: /pkt/i, name: 'PKT' },
    { pattern: /bbps/i, name: 'BBPS Billdesk' },
    { pattern: /airtel/i, name: 'Airtel' },
    { pattern: /jio/i, name: 'Jio' },
    { pattern: /bescom/i, name: 'BESCOM' },
    { pattern: /zerodha/i, name: 'Zerodha' },
    { pattern: /groww/i, name: 'Groww' }
  ];

  for (const b of brandKeywords) {
    if (b.pattern.test(s)) {
      return b.name;
    }
  }

  // Handle Federal / HDFC / Indian UPI strings
  if (/^UPI(OUT|\s*IN)?/i.test(s)) {
    const parts = s.split('/');
    // Check for VPA handle (part with @)
    for (const p of parts) {
      if (p.includes('@')) {
        const vpaHandle = p.split('@')[0];
        if (/^q\d+/i.test(vpaHandle)) {
          return 'PhonePe Merchant';
        }
        if (/^gpay/i.test(vpaHandle)) {
          return 'Google Pay Merchant';
        }
        if (/^paytm/i.test(vpaHandle)) {
          return 'Paytm Merchant';
        }
        if (/^bharatpe/i.test(vpaHandle)) {
          return 'BharatPe Merchant';
        }
        // Clean leading/trailing tokens and numbers
        const cleanHandle = vpaHandle
          .split(/[\._\-]/)[0]
          .replace(/\d+$/, '')
          .trim();
        if (cleanHandle.length >= 2) {
          return formatTitleCase(cleanHandle);
        }
      }
    }

    // Check non-code tokens
    for (const p of parts) {
      const clean = p.trim();
      if (
        clean.length > 2 &&
        !/^UPI(OUT|\s*IN)?$/i.test(clean) &&
        !/^(TFR|DR|CR|CLG|CHQ|NEFT|IMPS|RTGS|Payment|Paid|U)$/i.test(clean) &&
        !/^\d+$/.test(clean) &&
        !clean.includes('@')
      ) {
        return formatTitleCase(clean.replace(/Paid\s+via/i, '').trim() || fallback);
      }
    }
  }

  // Clean prefix noise
  s = s.replace(/^(ACH\s+[CD]-|POS\s+\d+\s+|NEFT\s+[A-Z0-9]+-|RTGS\s+|IMPS\s+\d+\s+)/i, '');
  const firstChunk = s.split(/[-–—/]/)[0].trim();
  if (firstChunk && firstChunk.length > 2) {
    return formatTitleCase(firstChunk);
  }

  return fallback;
}

function formatTitleCase(str) {
  return String(str || '')
    .toLowerCase()
    .split(/\s+/)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
