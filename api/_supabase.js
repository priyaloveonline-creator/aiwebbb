import { createClient } from '@supabase/supabase-js';

let _client = null;

export function getSupabase() {
  if (_client) return _client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) { console.warn('Supabase env vars not set'); return null; }
  _client = createClient(url, key, { auth: { persistSession: false } });
  return _client;
}

export function cors(res, origin) {
  const allowed = ['https://aiwebbb.com', 'https://www.aiwebbb.com', 'https://aiwebbb.vercel.app'];
  const o = allowed.includes(origin) || (origin && origin.endsWith('.vercel.app'))
    ? origin : 'https://aiwebbb.com';
  res.setHeader('Access-Control-Allow-Origin', o);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
