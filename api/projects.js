import { getSupabase, cors } from './_supabase.js';

export default async function handler(req, res) {
  cors(res, req.headers.origin);
  if (req.method === 'OPTIONS') return res.status(200).end();

  const sb = getSupabase();
  if (!sb) return res.status(200).json({ projects: [], fallback: true });

  if (req.method === 'GET') {
    const email = (req.query.email || 'anon').toLowerCase().trim();
    const { search, status } = req.query;
    try {
      let q = sb.from('projects').select('*').eq('email', email).order('updated_at', { ascending: false });
      if (status) q = q.eq('status', status);
      if (search) q = q.ilike('brand', `%${search}%`);
      const { data, error } = await q;
      if (error) { console.error('projects GET error:', error.message); return res.status(500).json({ error: error.message }); }
      return res.status(200).json({ projects: data || [] });
    } catch (err) {
      console.error('projects.js GET error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'POST') {
    const body = req.body || {};

    // ── Sub-action: duplicate an existing project ──
    if (body.action === 'duplicate') {
      try {
        const { data: original, error: getErr } = await sb.from('projects').select('*').eq('id', body.id).single();
        if (getErr || !original) return res.status(404).json({ error: 'Project not found' });
        const newId = 'proj_' + Date.now();
        const copy = Object.assign({}, original, {
          id: newId,
          brand: (original.brand || 'My App') + ' (Copy)',
          deployed: false,
          deploy_url: null,
          deploy_id: null,
          status: original.code ? 'built' : 'draft',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        });
        const { data, error } = await sb.from('projects').insert(copy).select().single();
        if (error) { console.error('duplicate error:', error.message); return res.status(500).json({ error: error.message }); }
        await sb.from('activity_logs').insert({ project_id: newId, actor_email: body.email, action: 'duplicated' });
        return res.status(200).json({ project: data });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // ── Sub-action: log a credit transaction ──
    if (body.action === 'logTransaction') {
      try {
        const { error } = await sb.from('credit_transactions').insert({
          email: body.email,
          project_id: body.project_id || null,
          type: body.type,
          amount: body.amount,
          balance_after: body.balance_after,
          description: body.description,
          payment_id: body.payment_id || null
        });
        if (error) { console.error('logTransaction error:', error.message); return res.status(500).json({ error: error.message }); }
        return res.status(200).json({ ok: true });
      } catch (err) {
        return res.status(500).json({ error: err.message });
      }
    }

    // ── Default: upsert a project (the BS object from the frontend) ──
    if (!body.id) return res.status(400).json({ error: 'id required' });
    try {
      const status = body.status || (body.deployed ? 'deployed' : (body.code ? 'built' : 'draft'));
      const payload = Object.assign({}, body, { status, updated_at: new Date().toISOString() });
      const { data, error } = await sb.from('projects').upsert(payload, { onConflict: 'id' }).select().single();
      if (error) { console.error('projects upsert error:', error.message); return res.status(500).json({ error: error.message }); }
      return res.status(200).json({ project: data });
    } catch (err) {
      console.error('projects.js POST error:', err.message);
      return res.status(500).json({ error: err.message });
    }
  }

  if (req.method === 'DELETE') {
    const body = req.body || {};
    if (!body.id) return res.status(400).json({ error: 'id required' });
    try {
      const { error } = await sb.from('projects').delete().eq('id', body.id).eq('email', body.email || 'anon');
      if (error) { console.error('projects DELETE error:', error.message); return res.status(500).json({ error: error.message }); }
      return res.status(200).json({ ok: true });
    } catch (err) {
      return res.status(500).json({ error: err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
