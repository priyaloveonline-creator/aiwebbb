// api/webhook.js — Razorpay webhook (credit pack system)

import crypto from 'crypto';
import { getSupabase } from './_supabase.js';

export const config = { api: { bodyParser: false } };

const PACKS = [
  {credits:100},   // 0 Starter
  {credits:250},   // 1 Builder
  {credits:700},   // 2 Creator
  {credits:1500},  // 3 Creator Plus
  {credits:3500},  // 4 Growth
  {credits:10000}, // 5 Growth Plus
  {credits:25000}, // 6 Premium
  {credits:60000}, // 7 Premium Plus
  {credits:160000},// 8 Ultimate
  {credits:350000} // 9 Unlimited Build
];

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => (body += chunk.toString()));
    req.on('end',  () => resolve(body));
    req.on('error', reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody   = await readRawBody(req);
  const signature = req.headers['x-razorpay-signature'];
  const secret    = process.env.RZP_WEBHOOK_SECRET;

  if (!secret) { console.error('RZP_WEBHOOK_SECRET not set'); return res.status(500).end(); }

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  if (expected !== signature) {
    console.warn('Webhook signature mismatch');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  let event;
  try { event = JSON.parse(rawBody); }
  catch { return res.status(400).json({ error: 'Invalid JSON' }); }

  if (event.event !== 'payment.captured') {
    return res.status(200).json({ status: 'ignored', event: event.event });
  }

  const payment = event.payload?.payment?.entity;
  if (!payment) return res.status(400).json({ error: 'No payment entity' });

  const notes    = payment.notes || {};
  const email    = notes.email;
  const packIdx  = parseInt(notes.pack_idx || '3');
  const payId    = payment.id;

  if (!email) { console.error('Webhook missing email in notes:', notes); return res.status(400).json({ error: 'Missing email' }); }

  const pack = PACKS[packIdx];
  if (!pack) { console.error('Invalid pack index:', packIdx); return res.status(400).json({ error: 'Invalid pack' }); }

  const sb = getSupabase();
  if (!sb) return res.status(500).json({ error: 'DB not configured' });

  try {
    const { data: existing } = await sb.from('users').select('*').eq('email', email).single();
    const prev = existing || { email, credits: 0, total_purchased: 0 };

    const newCredits       = (prev.credits        || 0) + pack.credits;
    const newTotalPurchased = (prev.total_purchased || 0) + pack.credits;

    await sb.from('users').upsert({
      email,
      plan:            'credits',
      credits:          newCredits,
      total_purchased:  newTotalPurchased,
      last_pay:         payId,
      updated_at:       new Date().toISOString()
    }, { onConflict: 'email' });

    console.log(`✓ Webhook: ${email} +${pack.credits} credits → total ${newCredits}, pid=${payId}`);
    return res.status(200).json({ status: 'ok', credits: newCredits });

  } catch (err) {
    console.error('Webhook DB error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
