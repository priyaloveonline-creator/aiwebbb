import { cors } from './_supabase.js';

export default async function handler(req, res) {
  cors(res, req.headers.origin);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { plan, email, yearly } = req.body;
  if (!plan || !email) return res.status(400).json({ error: 'Missing plan or email' });

  const prices = {
    standard:     yearly ? 69900   : 99900,
    pro:          yearly ? 1399900 : 1999900,
    credits_10:   9900,
    credits_100:  99900,
    credits_1000: 999900,
    credits:      9900
  };

  const descriptions = {
    standard:     'Standard Plan — 5 projects + 100 credits/mo',
    pro:          'Pro Plan — Unlimited + 500 credits/mo + Opus AI',
    credits_10:   '10 Credits Pack',
    credits_100:  '100 Credits Pack',
    credits_1000: '1000 Credits Pack',
    credits:      '10 Credits Pack'
  };

  const amount = prices[plan];
  if (!amount) return res.status(400).json({ error: 'Invalid plan: ' + plan });

  const key_id     = process.env.RZP_KEY_ID;
  const key_secret = process.env.RZP_KEY_SECRET;
  if (!key_id || !key_secret) return res.status(500).json({ error: 'Payment not configured' });

  const auth = Buffer.from(`${key_id}:${key_secret}`).toString('base64');

  try {
    const r = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount, currency: 'INR',
        receipt: `awbb_${Date.now()}`,
        notes: { plan, email, yearly: yearly ? '1' : '0' }
      })
    });

    const data = await r.json();
    if (!data.id) {
      console.error('Razorpay order error:', JSON.stringify(data));
      return res.status(500).json({ error: 'Could not create order' });
    }

    return res.status(200).json({
      order_id: data.id, amount: data.amount,
      currency: data.currency, key_id,
      description: descriptions[plan] || plan
    });
  } catch (err) {
    console.error('create-order error:', err.message);
    return res.status(500).json({ error: 'Internal error' });
  }
}
