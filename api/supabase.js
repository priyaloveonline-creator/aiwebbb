// api/supabase.js — Secure Supabase proxy
// All DB operations go through here. Browser never has keys.

import { getSupabase, cors } from './_supabase.js';

export default async function handler(req, res) {
  cors(res, req.headers.origin);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const sb = getSupabase();
  if (!sb) return res.status(200).json({ fallback: true, data: null });

  const { action, table, data, filter } = req.body;

  const allowedTables = ['users', 'projects', 'deployments'];
  if (!allowedTables.includes(table)) {
    return res.status(400).json({ error: 'Invalid table' });
  }

  try {
    let result, error;

    switch (action) {
      case 'get': {
        let q = sb.from(table).select('*');
        if (filter) {
          for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
        }
        ({ data: result, error } = await q);
        break;
      }
      case 'upsert': {
        ({ data: result, error } = await sb.from(table).upsert(data, { onConflict: getConflictKey(table) }).select());
        break;
      }
      case 'update': {
        let q = sb.from(table).update(data);
        if (filter) {
          for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
        }
        ({ data: result, error } = await q.select());
        break;
      }
      case 'delete': {
        let q = sb.from(table).delete();
        if (filter) {
          for (const [k, v] of Object.entries(filter)) q = q.eq(k, v);
        }
        ({ data: result, error } = await q);
        break;
      }
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    if (error) {
      console.error(`supabase ${action} ${table}:`, error.message);
      return res.status(500).json({ error: error.message });
    }
    return res.status(200).json({ data: result });

  } catch (err) {
    console.error('supabase.js error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

function getConflictKey(table) {
  const keys = { users: 'email', projects: 'id', deployments: 'deploy_id' };
  return keys[table] || 'id';
}
