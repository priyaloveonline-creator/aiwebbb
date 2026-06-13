// api/create-order.js — Create a Razorpay order

import { cors } from './_supabase.js';

export default async function handler(req, res) {
  cors(res, req.headers.origin);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { plan, email, yearly } = req.body;
  if (!plan || !email) return res.status(400).json({ error: 'Missing plan or email' });

  // Prices in paise (INR × 100)
  const prices = {
    standard:     yearly ? 69900   : 99900,    // ₹699/mo or ₹999/mo
    pro:          yearly ? 1399900 : 1999900,  // ₹13,999/mo or ₹19,999/mo
    credits_10:   9900,                         // ₹99  — 10 credits
    credits_100:  99900,                        // ₹999 — 100 credits
    credits_1000: 999900,                       // ₹9,999 — 1000 credits
    credits:      9900                          // legacy alias → 10 credits
  };

  const descriptions = {
    standard:     'Standard Plan — 5 projects + 100 credits/mo',
    pro:          'Pro Plan — Unlimited projects + 500 credits/mo + Opus AI',
    credits_10:   '10 Credits Pack — 10 post-deploy changes',
    credits_100:  '100 Credits Pack — 100 post-deploy changes',
    credits_1000: '1000 Credits Pack — 1000 post-deploy changes',
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
      headers: {
        'Authorization': `Basic ${auth}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        amount,
        currency: 'INR',
        receipt:  `awbb_${Date.now()}`,
        notes:    { plan, email, yearly: yearly ? '1' : '0' }
      })
    });

    const data = await r.json();
    if (!data.id) {
      console.error('Razorpay order error:', JSON.stringify(data));
      return res.status(500).json({ error: 'Could not create Razorpay order' });
    }

    return res.status(200).json({
      order_id:    data.id,
      amount:      data.amount,
      currency:    data.currency,
      key_id,
      description: descriptions[plan] || plan
    });
  } catch (err) {
    console.error('create-order error:', err.message);
    return res.status(500).json({ error: 'Internal error' });
  }
}
