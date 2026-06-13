import { getSupabase, cors } from './_supabase.js';

export default async function handler(req, res) {
  cors(res, req.headers.origin);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).end();

  const { deployId, html, email, brand } = req.body;
  if (!deployId || !html) return res.status(400).json({ error: 'deployId and html required' });

  const sb = getSupabase();
  if (!sb) return res.status(200).json({ ok: true, fallback: true });

  try {
    await sb.from('deployments').upsert({
      deploy_id:  deployId,
      email:      email || 'anon',
      brand:      brand || 'App',
      html,
      updated_at: new Date().toISOString()
    }, { onConflict: 'deploy_id' });

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('save-deployment error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
