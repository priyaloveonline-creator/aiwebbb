import { getSupabase, cors } from './_supabase.js';

export default async function handler(req, res) {
  cors(res, req.headers.origin);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sb = getSupabase();
  if (!sb) return res.status(200).json({ user: null, fallback: true });

  if (req.method === 'GET') {
    const email = (req.query.email || '').toLowerCase().trim();
    if (!email) return res.status(400).json({ error: 'email required' });
    try {
      const { data, error } = await sb.from('users').select('*').eq('email', email).single();
      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows found — fine for a brand-new user, not a real error
        console.error('users GET error:', error.message);
      }
      return res.status(200).json({ user: data || null });
    } catch (err) {
      console.error('users.js GET error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    const body = req.body || {};
    const email = (body.email || '').toLowerCase().trim();
    if (!email) return res.status(400).json({ error: 'email required' });
    try {
      const payload = Object.assign({}, body, { email, updated_at: new Date().toISOString() });
      const { data, error } = await sb.from('users').upsert(payload, { onConflict: 'email' }).select().single();
      if (error) { console.error('users POST error:', error.message); return res.status(500).json({ error: error.message }); }
      return res.status(200).json({ user: data });
    } catch (err) {
      console.error('users.js POST error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
