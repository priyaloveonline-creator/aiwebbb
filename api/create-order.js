import { cors } from './_supabase.js';
import { PACKS } from './_packs.js';

const USD_TO_INR = 85;

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
