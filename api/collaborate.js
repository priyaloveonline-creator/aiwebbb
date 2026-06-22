import { getSupabase, cors } from './_supabase.js';

export default async function handler(req, res) {
  cors(res, req.headers.origin);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sb = getSupabase();
  if (!sb) return res.status(200).json({ collaborators: [], logs: [], fallback: true });

  if (req.method === 'GET') {
    const { project_id, type } = req.query;
    if (!project_id) return res.status(400).json({ error: 'project_id required' });
    try {
      if (type === 'logs') {
        const { data, error } = await sb.from('activity_logs').select('*').eq('project_id', project_id).order('created_at', { ascending: false }).limit(50);
        if (error) return res.status(500).json({ error: error.message });
        return res.status(200).json({ logs: data || [] });
      }
      const { data, error } = await sb.from('collaborators').select('*').eq('project_id', project_id).order('created_at', { ascending: false });
      if (error) return res.status(500).json({ error: error.message });
      return res.status(200).json({ collaborators: data || [] });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    const { action, project_id, owner_email, collaborator_email, access_level } = req.body || {};
    if (!project_id) return res.status(400).json({ error: 'project_id required' });

    if (action === 'invite') {
      if (!collaborator_email || !collaborator_email.includes('@')) return res.status(400).json({ error: 'valid collaborator_email required' });
      try {
        const { data, error } = await sb.from('collaborators').upsert({
          project_id, owner_email, collaborator_email: collaborator_email.toLowerCase().trim(),
          access_level: access_level || 'view'
        }, { onConflict: 'project_id,collaborator_email' }).select().single();
        if (error) { console.error('invite error:', error.message); return res.status(500).json({ error: error.message }); }
        await sb.from('activity_logs').insert({ project_id, actor_email: owner_email, action: 'invited', meta: { collaborator_email, access_level } });
        return res.status(200).json({ ok: true, collaborator: data });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    if (action === 'revoke') {
      try {
        const { error } = await sb.from('collaborators').delete().eq('project_id', project_id).eq('collaborator_email', (collaborator_email || '').toLowerCase().trim());
        if (error) return res.status(500).json({ error: error.message });
        await sb.from('activity_logs').insert({ project_id, actor_email: owner_email, action: 'revoked', meta: { collaborator_email } });
        return res.status(200).json({ ok: true });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    return res.status(400).json({ error: 'Invalid action' });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
