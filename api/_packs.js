// api/_packs.js — single source of truth for credit packs.
// Import this in create-order.js, webhook.js, and anywhere else that needs pack data,
// instead of redefining the array. The frontend (index.html) still needs its own copy
// for instant UI rendering, but keep it byte-for-byte identical to this file.

export const PACKS = [
  { name: 'Starter',         credits: 100,    inr: 99,    usd: 5,    inPaise: 9900,    usdCents: 500   },
  { name: 'Builder',         credits: 250,    inr: 199,   usd: 10,   inPaise: 19900,   usdCents: 1000  },
  { name: 'Creator',         credits: 700,    inr: 499,   usd: 25,   inPaise: 49900,   usdCents: 2500  },
  { name: 'Creator Plus',    credits: 1500,   inr: 999,   usd: 50,   inPaise: 99900,   usdCents: 5000,  popular: true },
  { name: 'Growth',          credits: 3500,   inr: 1999,  usd: 100,  inPaise: 199900,  usdCents: 10000 },
  { name: 'Growth Plus',     credits: 10000,  inr: 4999,  usd: 250,  inPaise: 499900,  usdCents: 25000 },
  { name: 'Premium',         credits: 25000,  inr: 9999,  usd: 500,  inPaise: 999900,  usdCents: 50000 },
  { name: 'Premium Plus',    credits: 60000,  inr: 19999, usd: 1000, inPaise: 1999900, usdCents: 100000},
  { name: 'Ultimate',        credits: 160000, inr: 49999, usd: 2500, inPaise: 4999900, usdCents: 250000},
  { name: 'Unlimited Build', credits: 350000, inr: 99999, usd: 5000, inPaise: 9999900, usdCents: 500000}
];
