import { cors } from './_supabase.js';
const USD_TO_INR = 85;
const PACKS = [
  { name:'Starter',        credits:100,    inPaise:9900,    usdCents:500   },
  { name:'Builder',        credits:250,    inPaise:19900,   usdCents:1000  },
  { name:'Creator',        credits:700,    inPaise:49900,   usdCents:2500  },
  { name:'Creator Plus',   credits:1500,   inPaise:99900,   usdCents:5000  },
  { name:'Growth',         credits:3500,   inPaise:199900,  usdCents:10000 },
  { name:'Growth Plus',    credits:10000,  inPaise:499900,  usdCents:25000 },
  { name:'Premium',        credits:25000,  inPaise:999900,  usdCents:50000 },
  { name:'Premium Plus',   credits:60000,  inPaise:1999900, usdCents:100000},
  { name:'Ultimate',       credits:160000, inPaise:4999900, usdCents:250000},
  { name:'Unlimited Build',credits:350000, inPaise:9999900, usdCents:500000}
];
export default async function handler(req, res) {
  cors(res, req.headers.origin);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();
  const { email, packIdx, isGlobal } = req.body;
  if (!email) return res.status(400).json({ error: 'Missing email' });
  if (packIdx === undefined) return res.status(400).json({ error: 'Missing packIdx' });
  const idx = parseInt(packIdx);
  const pack = PACKS[idx];
  if (!pack) return res.status(400).json({ error: 'Invalid pack index: ' + idx });
  let serverAmount = pack.inPaise;
  if (isGlobal) { const usdAmount = pack.usdCents / 100; serverAmount = Math.round(usdAmount * USD_TO_INR * 100); }
  const key_id = process.env.RZP_KEY_ID;
  const key_secret = process.env.RZP_KEY_SECRET;
  if (!key_id || !key_secret) return res.status(500).json({ error: 'Payment not configured' });
  const auth = Buffer.from(`${key_id}:${key_secret}`).toString('base64');
  try {
    const r = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ amount: serverAmount, currency: 'INR', receipt: `awbb_${Date.now()}`, notes: { pack_idx: String(idx), pack_name: pack.name, pack_credits: String(pack.credits), email, is_global: isGlobal ? 'true' : 'false' } })
    });
    const data = await r.json();
    if (!data.id) { console.error('Razorpay order error:', JSON.stringify(data)); return res.status(500).json({ error: 'Could not create order' }); }
    return res.status(200).json({ order_id: data.id, amount: data.amount, currency: data.currency, key_id, description: `${pack.name} — ${pack.credits.toLocaleString()} Credits` });
  } catch (err) { console.error('create-order error:', err.message); return res.status(500).json({ error: 'Internal error' }); }
}
