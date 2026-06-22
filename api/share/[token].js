// api/share/[token].js — serves a shared project at aiwebbb.com/s/TOKEN

import { getSupabase } from '../_supabase.js';

function escHtml(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function passwordGate(token, errorMsg) {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>Protected Project — AIWEBBB</title>
  <style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:sans-serif;background:#000;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center}
  .box{background:#111;border:1px solid #262626;border-radius:12px;padding:32px;max-width:340px;width:90%;text-align:center}
  h2{font-size:18px;margin-bottom:8px}p{font-size:12px;color:#888;margin-bottom:18px}
  input{width:100%;background:#000;border:1px solid #333;border-radius:6px;padding:10px;color:#fff;margin-bottom:10px;font-size:13px}
  button{width:100%;background:#fff;color:#000;border:none;border-radius:6px;padding:10px;font-weight:600;cursor:pointer}
  .err{color:#ef4444;font-size:11px;margin-bottom:10px}</style></head>
  <body><div class="box"><h2>🔒 Password Protected</h2><p>This project requires a password to view.</p>
  ${errorMsg ? `<div class="err">${escHtml(errorMsg)}</div>` : ''}
  <form method="POST"><input name="password" type="text" placeholder="Enter password" required><button type="submit">View Project</button></form>
  </div></body></html>`;
}

function notFound() {
  return `<!DOCTYPE html><html><head><meta charset="UTF-8"><title>Not Found — AIWEBBB</title>
  <style>body{font-family:sans-serif;background:#000;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center}
  a{color:#fff;text-decoration:underline}</style></head>
  <body><div><h2>This shared link doesn't exist or was removed.</h2><p><a href="https://aiwebbb.com">Build your own on AIWEBBB →</a></p></div></body></html>`;
}

async function readRawBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', (c) => (body += c.toString()));
    req.on('end', () => resolve(body));
    req.on('error', () => resolve(''));
  });
}

export default async function handler(req, res) {
  const { token } = req.query;
  if (!token) return res.status(400).send('Missing token');

  const sb = getSupabase();
  if (!sb) return res.status(500).send('Sharing not configured');

  try {
    const { data: link, error } = await sb.from('share_links').select('*').eq('token', token).single();
    if (error || !link) { res.status(404); return res.send(notFound()); }
    if (link.privacy === 'private') { res.status(403); return res.send('<h2 style="color:#fff;background:#000;font-family:sans-serif;text-align:center;padding:60px">This project is private.</h2>'); }

    if (link.privacy === 'password') {
      let suppliedPw = req.query.pw;
      if (req.method === 'POST') {
        const raw = await readRawBody(req);
        const params = new URLSearchParams(raw);
        suppliedPw = params.get('password');
      }
      if (!suppliedPw) { res.setHeader('Content-Type', 'text/html'); return res.status(200).send(passwordGate(token, null)); }
      if (suppliedPw !== link.password) { res.setHeader('Content-Type', 'text/html'); return res.status(200).send(passwordGate(token, 'Incorrect password — try again.')); }
    }

    const { data: project } = await sb.from('projects').select('code, brand').eq('id', link.project_id).single();
    if (!project || !project.code) { res.status(404); return res.send(notFound()); }

    // best-effort view counter + activity log, don't block the response on these
    sb.from('share_links').update({ views: (link.views || 0) + 1 }).eq('token', token).then(() => {});
    sb.from('activity_logs').insert({ project_id: link.project_id, actor_email: null, action: 'viewed' }).then(() => {});

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=30, stale-while-revalidate=120');
    return res.status(200).send(project.code);
  } catch (err) {
    console.error('share/[token] error:', err.message);
    res.status(500);
    return res.send(notFound());
  }
}
