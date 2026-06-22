import { getSupabase, cors } from './_supabase.js';

function genToken() {
  const chars = 'abcdefghjkmnpqrstuvwxyz23456789';
  let t = '';
  for (let i = 0; i < 12; i++) t += chars[Math.floor(Math.random() * chars.length)];
  return t;
}

export default async function handler(req, res) {
  cors(res, req.headers.origin);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const sb = getSupabase();
  if (!sb) return res.status(500).json({ error: 'Sharing not configured' });

  const { action, project_id, owner_email, privacy, password, allow_comments } = req.body || {};
  if (action !== 'create') return res.status(400).json({ error: 'Invalid action' });
  if (!project_id) return res.status(400).json({ error: 'project_id required' });
  if (privacy === 'password' && !password) return res.status(400).json({ error: 'password required for password-protected links' });

  try {
    const token = genToken();
    const { error } = await sb.from('share_links').insert({
      token, project_id, owner_email: owner_email || 'anon',
      privacy: privacy || 'public',
      password: privacy === 'password' ? password : null,
      allow_comments: allow_comments !== false
    });
    if (error) { console.error('share create error:', error.message); return res.status(500).json({ error: error.message }); }

    await sb.from('activity_logs').insert({ project_id, actor_email: owner_email, action: 'shared', meta: { privacy } });

    const origin = req.headers.origin && req.headers.origin.includes('aiwebbb.com') ? req.headers.origin : 'https://aiwebbb.com';
    return res.status(200).json({ url: `${origin}/s/${token}`, token });
  } catch (err) {
    console.error('share.js error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
