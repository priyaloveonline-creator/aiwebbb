import crypto from 'crypto';
import { getSupabase } from './_supabase.js';

export const config = { api: { bodyParser: false } };

async function readRawBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => (body += chunk.toString()));
    req.on('end',  () => resolve(body));
    req.on('error', reject);
  });
}

const CREDIT_AMOUNTS = { credits_10: 10, credits_100: 100, credits_1000: 1000, credits: 10 };
const PLAN_MONTHLY_CREDITS = { standard: 100, pro: 500 };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const rawBody   = await readRawBody(req);
  const signature = req.headers['x-razorpay-signature'];
  const secret    = process.env.RZP_WEBHOOK_SECRET;

  if (!secret) return res.status(500).end();

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  if (expected !== signature) {
    console.warn('Webhook signature mismatch');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  let event;
  try { event = JSON.parse(rawBody); }
  catch { return res.status(400).json({ error: 'Invalid JSON' }); }

  if (event.event !== 'payment.captured') {
    return res.status(200).json({ status: 'ignored' });
  }

  const payment = event.payload?.payment?.entity;
  if (!payment) return res.status(400).json({ error: 'No payment entity' });

  const { email, plan, yearly } = payment.notes || {};
  const payId = payment.id;
  if (!email || !plan) return res.status(400).json({ error: 'Missing notes' });

  const sb = getSupabase();
  if (!sb) return res.status(500).json({ error: 'DB not configured' });

  try {
    const { data: existing } = await sb.from('users').select('*').eq('email', email).single();
    const prev = existing || { email, plan: 'free', credits: 0 };
    const isCredits  = plan.startsWith('credits');
    const newPlan    = isCredits ? prev.plan : plan;
    const addedCredits = isCredits ? (CREDIT_AMOUNTS[plan] || 0) : (PLAN_MONTHLY_CREDITS[plan] || 0);
    const newCredits = (prev.credits || 0) + addedCredits;

    await sb.from('users').upsert({
      email, plan: newPlan, credits: newCredits,
      last_pay: payId, updated_at: new Date().toISOString()
    }, { onConflict: 'email' });

    console.log(`✓ ${email} → plan=${newPlan}, credits=${newCredits}`);
    return res.status(200).json({ status: 'ok' });
  } catch (err) {
    console.error('Webhook DB error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
