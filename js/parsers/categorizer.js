/**
 * Modern Indian UPI & Banking Categorization Engine
 * Powered by NPCI 4-digit Merchant Category Codes (MCC), vendor heuristics,
 * VPA handle parsing, and intelligent P2P transfer recognition.
 */

export const CATEGORY_DEFINITIONS = {
  Shopping: { name: 'Shopping', icon: '🛍️', color: '#FF7A00', bg: 'rgba(255, 122, 0, 0.14)' },
  Dining: { name: 'Dining', icon: '🍔', color: '#F43F5E', bg: 'rgba(244, 63, 94, 0.14)' },
  Groceries: { name: 'Groceries', icon: '🛒', color: '#10B981', bg: 'rgba(16, 185, 129, 0.14)' },
  Transport: { name: 'Transport', icon: '🚗', color: '#06B6D4', bg: 'rgba(6, 182, 212, 0.14)' },
  Entertainment: { name: 'Entertainment', icon: '🍿', color: '#8B5CF6', bg: 'rgba(139, 92, 246, 0.14)' },
  Utilities: { name: 'Utilities', icon: '⚡', color: '#F59E0B', bg: 'rgba(245, 158, 11, 0.14)' },
  Health: { name: 'Health', icon: '💊', color: '#14B8A6', bg: 'rgba(20, 184, 166, 0.14)' },
  Investments: { name: 'Investments', icon: '📈', color: '#3B82F6', bg: 'rgba(59, 130, 246, 0.14)' },
  Transfers: { name: 'Transfers', icon: '🔄', color: '#6366F1', bg: 'rgba(99, 102, 241, 0.14)' },
  Salary: { name: 'Salary', icon: '💼', color: '#059669', bg: 'rgba(5, 150, 105, 0.14)' },
  Other: { name: 'Other', icon: '🏷️', color: '#94A3B8', bg: 'rgba(148, 163, 184, 0.14)' }
};

export const ALL_CATEGORIES = Object.values(CATEGORY_DEFINITIONS);

export function getCategoryMeta(catName) {
  return CATEGORY_DEFINITIONS[catName] || CATEGORY_DEFINITIONS.Other;
}

// NPCI 4-digit Merchant Category Code mapping
const NPCI_MCC_MAP = {
  // Groceries & Supermarkets
  '5411': 'Groceries', '5499': 'Groceries', '5422': 'Groceries', '5441': 'Groceries', '5451': 'Groceries', '5462': 'Groceries',
  // Dining, Restaurants, Food & Cafes
  '5811': 'Dining', '5812': 'Dining', '5813': 'Dining', '5814': 'Dining', '5815': 'Dining',
  // Shopping, Retail, Apparel, Electronics, Department Stores
  '5311': 'Shopping', '5331': 'Shopping', '5611': 'Shopping', '5621': 'Shopping', '5651': 'Shopping',
  '5691': 'Shopping', '5732': 'Shopping', '5733': 'Shopping', '5941': 'Shopping', '5942': 'Shopping',
  '5943': 'Shopping', '5944': 'Shopping', '5977': 'Shopping', '5999': 'Shopping',
  // Transport, Cabs, Tolls, Fuel, Parking
  '4111': 'Transport', '4112': 'Transport', '4121': 'Transport', '4131': 'Transport', '4789': 'Transport',
  '5541': 'Transport', '5542': 'Transport', '7523': 'Transport', '7524': 'Transport',
  // Utilities, Telecom & Services
  '4900': 'Utilities', '4812': 'Utilities', '4814': 'Utilities', '4816': 'Utilities', '4821': 'Utilities',
  // Entertainment & Streaming
  '4899': 'Entertainment', '5735': 'Entertainment', '7832': 'Entertainment', '7922': 'Entertainment',
  '7929': 'Entertainment', '7991': 'Entertainment', '7996': 'Entertainment', '7997': 'Entertainment',
  // Health & Medicine
  '5912': 'Health', '8011': 'Health', '8021': 'Health', '8031': 'Health', '8041': 'Health',
  '8042': 'Health', '8049': 'Health', '8062': 'Health', '8071': 'Health', '8099': 'Health',
  // Investments & Trading
  '6211': 'Investments', '6051': 'Investments',
  // Person-to-Person Transfers
  '0000': 'Transfers', '6540': 'Transfers'
};

// Check if narration contains an NPCI MCC code
function detectMCC(text) {
  const matches = text.match(/(?:[\/\s\-_]|^)(\d{4})(?:[\/\s\-_]|$)/g);
  if (matches) {
    for (const raw of matches) {
      const code = raw.replace(/[\/\s\-_]/g, '');
      if (NPCI_MCC_MAP[code]) {
        return {
          mcc: code,
          category: NPCI_MCC_MAP[code],
          meta: CATEGORY_DEFINITIONS[NPCI_MCC_MAP[code]]
        };
      }
    }
  }
  return null;
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
      /recharge/i, /dth/i, /postpaid/i, /prepaid/i, /rent/i, /society/i, /maintenance/i, /housing/i,
      /sms\s*chg/i, /folio\s*chg/i, /service\s*chg/i, /bank\s*chg/i, /annual\s*fee/i, /card\s*fee/i
    ]
  },
  // Entertainment & Streaming
  {
    category: 'Entertainment',
    icon: '🍿',
    patterns: [
      /spotify/i, /netflix/i, /hotstar/i, /prime.*video/i, /bookmyshow/i, /pvr/i, /inox/i,
      /steam/i, /youtube/i, /apple\.com\/bill/i, /sony.*liv/i, /zee5/i, /cult\.?fit/i,
      /theatre/i, /cinema/i, /cinepolis/i, /gaming/i, /playstation/i
    ]
  },
  // Dining & Restaurants
  {
    category: 'Dining',
    icon: '🍔',
    patterns: [
      /swiggy/i, /zomato/i, /starbucks/i, /mcdonald/i, /domino/i, /kfc/i, /burger\s*king/i,
      /palmtree/i, /seaportcafe/i, /cafe/i, /restaurant/i, /pizza/i, /biryani/i, /dhaba/i,
      /baker/i, /kitchen/i, /canteen/i, /food/i, /eatery/i, /tea\b/i, /chai/i, /coffee/i, /snack/i,
      /hotel/i, /shawarma/i, /juice/i, /mess/i, /dining/i, /tiffin/i, /curry/i, /roast/i,
      /bhojanalaya/i, /sweets/i, /restro/i, /grill/i, /barbeque/i, /bbq/i, /bake/i
    ]
  },
  // Groceries & Supermarkets
  {
    category: 'Groceries',
    icon: '🛒',
    patterns: [
      /blinkit/i, /zepto/i, /bigbasket/i, /instamart/i, /dmart/i, /d-mart/i, /more\s*retail/i,
      /nature.*basket/i, /grocery/i, /supermarket/i, /spencer/i, /vegetables?/i, /fruits?/i,
      /provisions?/i, /dairy/i, /milk/i, /hypermarket/i, /bazaar/i, /kirana/i, /fresh/i, /organics/i
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
      /apparel/i, /footwear/i, /shoe/i, /mall/i, /retail/i, /jewel/i, /opticals/i, /boutique/i,
      /textiles/i, /silks/i, /stationery/i, /hardware/i, /gadgets/i
    ]
  },
  // Transport & Travel
  {
    category: 'Transport',
    icon: '🚗',
    patterns: [
      /uber/i, /ola\b/i, /rapido/i, /irctc/i, /metro/i, /fuel/i, /petrol/i, /diesel/i, /cng/i,
      /shell/i, /indianoil/i, /hpcl/i, /bpcl/i, /indigo/i, /air\s*india/i, /makemytrip/i,
      /fastag/i, /toll/i, /parking/i, /pkt/i, /railway/i, /flight/i, /bus/i, /redbus/i,
      /cab\b/i, /auto\s*rickshaw/i, /yulu/i
    ]
  },
  // Health & Medicine
  {
    category: 'Health',
    icon: '💊',
    patterns: [
      /apollo/i, /pharmeasy/i, /1mg/i, /medplus/i, /hospital/i, /clinic/i, /pharmacy/i,
      /diagnostic/i, /dr\./i, /netmeds/i, /practo/i, /dent/i, /optical/i, /medical/i, /chemist/i,
      /doctor/i, /pathology/i, /lab\b/i, /medicals/i, /druggist/i
    ]
  },
  // Investments & Trading
  {
    category: 'Investments',
    icon: '📈',
    patterns: [
      /zerodha/i, /groww/i, /kuvera/i, /upstox/i, /angel\s*one/i, /mutual\s*fund/i,
      /nippon/i, /uti/i, /sip\b/i, /etf/i, /broking/i, /sebi/i, /bse/i, /nse/i, /indmoney/i,
      /coin\b/i, /smallcase/i
    ]
  },
  // Explicit Person-to-Person Transfers & Mobile Banking
  {
    category: 'Transfers',
    icon: '🔄',
    patterns: [
      /\/0000\b/, // MCC 0000 = P2P UPI Transfer
      /\/6540\b/, // POI Stored Value / P2P
      /\b(transfer\s*to|sent\s*to|p2p|self\s*transfer|own\s*a\/?c|internal\s*transfer)\b/i,
      /\b(MB\s*FTB|MB:FTB|MB-FTB|IB\s*FTB|IB:FTB|FTB)\b/i
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

  // 2. NPCI MCC Code Detection (Authoritative industry classification)
  const mccResult = detectMCC(text);
  if (mccResult) {
    return {
      category: mccResult.category,
      icon: mccResult.meta.icon,
      cleanMerchant: extractCleanMerchant(text, mccResult.category)
    };
  }

  // 3. Specific Vendor & Domain Keyword Rules
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

  // 4. Physical Merchant QR Code & Payment Gateway Recognition
  // Store handles like q051776628@ybl, paytmqr..., bharatpe... are retail merchant purchases
  if (/@(okbizaxis|okbizicici|okbizsbi|okbizhdfc)/i.test(text) || /q\d+@/i.test(text) || /paytmqr/i.test(text) || /bharatpe/i.test(text)) {
    return {
      category: 'Shopping',
      icon: '🛍️',
      cleanMerchant: extractCleanMerchant(text, 'Store Merchant')
    };
  }

  // 5. Explicit Bank Funds Transfer (MB FTB / FTB without MCC)
  if (/\b(MB\s*FTB|MB:FTB|MB-FTB|IB\s*FTB|IB:FTB|FTB)\b/i.test(text)) {
    return {
      category: 'Transfers',
      icon: '🔄',
      cleanMerchant: extractCleanMerchant(text, 'Bank Fund Transfer')
    };
  }

  // 6. Generic UPI Expense Fallback
  // A generic UPI debit to a store or person without MCC is an Expense, NOT a Bank Transfer
  if (/^UPI/i.test(text)) {
    return {
      category: 'Shopping',
      icon: '🛍️',
      cleanMerchant: extractCleanMerchant(text, 'UPI Merchant')
    };
  }

  // 7. General Default Fallback
  return {
    category: 'Other',
    icon: '🏷️',
    cleanMerchant: extractCleanMerchant(text, 'Expense')
  };
}

// Clean bank narrations into clear, modern merchant brand names
export function extractCleanMerchant(narration = '', fallback = 'Merchant') {
  let s = String(narration || '').trim();

  // 1. Strip bank internal transaction IDs, transfer abbreviations, and line noise
  s = s
    .replace(/\b[SC]\d{7,10}\b/g, '') // e.g. S47985925 or C93972700
    .replace(/\b(TFR|TRF|CLG|CHQ|CHEQUE|DR|CR)\b/gi, '')
    .replace(/\b\d{1,4}\s+\d{1,4}\b/g, '') // trailing token noise like 40 0
    .replace(/\s+/g, ' ')
    .trim();

  // 2. Known brand substitutions
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

  // 3. Handle Federal / HDFC / Indian UPI strings
  if (/^UPI(OUT|\s*IN)?/i.test(s)) {
    const parts = s.split('/');
    // Check for VPA handle (part with @)
    for (const p of parts) {
      if (p.includes('@')) {
        const vpaHandle = p.split('@')[0];
        if (/^q\d+/i.test(vpaHandle)) {
          return 'PhonePe Store Merchant';
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
      const clean = p
        .replace(/\b[SC]\d{7,10}\b/g, '')
        .replace(/\b\d+\s+\d+\b/g, '')
        .trim();
      if (
        clean.length > 2 &&
        !/^UPI(OUT|\s*IN)?$/i.test(clean) &&
        !/^(TFR|TRF|DR|CR|CLG|CHQ|NEFT|IMPS|RTGS|Payment|Paid|U)$/i.test(clean) &&
        !/^\d+$/.test(clean) &&
        !clean.includes('@')
      ) {
        if (/^q\d+/i.test(clean)) {
          return 'PhonePe Store Merchant';
        }
        return formatTitleCase(clean.replace(/Paid\s+via/i, '').trim() || fallback);
      }
    }
  }

  // 4. Clean MB FTB / Mobile Banking Fund Transfers
  if (/^(MB\s*FTB|MB:FTB|MB-FTB|IB\s*FTB|IB:FTB|FTB)\b/i.test(s)) {
    const after = s.replace(/^(MB\s*FTB|MB:FTB|MB-FTB|IB\s*FTB|IB:FTB|FTB)[\s/:\-_]*/i, '').trim();
    if (after.length > 2 && !/^\d+$/.test(after)) {
      const cleanChunk = after.split(/[-–—/:]/)[0].trim();
      if (cleanChunk.length > 2 && !/^(TFR|TRF|DR|CR|NEFT|IMPS)$/i.test(cleanChunk)) {
        return formatTitleCase(cleanChunk);
      }
    }
    return 'Bank Fund Transfer';
  }

  // 5. Clean prefix noise
  s = s.replace(/^(ACH\s+[CD]-|POS\s+\d+\s+|NEFT\s+[A-Z0-9]+-|RTGS\s+|IMPS\s+\d+\s+|MB\s*FTB[\s/:\-_]*|FTB[\s/:\-_]*)/i, '');
  const firstChunk = s.split(/[-–—/:]/)[0].trim();
  if (firstChunk && firstChunk.length > 2 && !/^(TFR|TRF|DR|CR|TRANSFER)$/i.test(firstChunk)) {
    if (/^q\d+/i.test(firstChunk)) return 'Store Merchant';
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

if (typeof window !== 'undefined') {
  window.__categorizeTransaction = categorizeTransaction;
  window.__extractCleanMerchant = extractCleanMerchant;
  window.__getCategoryMeta = getCategoryMeta;
}
