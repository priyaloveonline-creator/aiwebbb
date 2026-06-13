// api/app/[id].js — Serve a deployed app at aiwebbb.com/app/RANDOMID

import { getSupabase } from '../_supabase.js';

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).send('Missing app ID');

  const sb = getSupabase();

  // Try Supabase first, fallback gracefully
  if (sb) {
    try {
      const { data, error } = await sb
        .from('deployments')
        .select('html, brand')
        .eq('deploy_id', id)
        .single();

      if (!error && data?.html) {
        res.setHeader('Content-Type', 'text/html; charset=utf-8');
        res.setHeader('Cache-Control', 'public, max-age=60, stale-while-revalidate=300');
        res.setHeader('X-Frame-Options', 'SAMEORIGIN');
        return res.status(200).send(data.html);
      }
    } catch (err) {
      console.error('app/[id] DB error:', err.message);
    }
  }

  // App not found
  return res.status(404).send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>App Not Found — AIWEBBB</title>
<link href="https://fonts.googleapis.com/css2?family=Geist:wght@400;700;800&display=swap" rel="stylesheet">
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{font-family:'Geist',sans-serif;background:#000;color:#fff;min-height:100vh;display:flex;align-items:center;justify-content:center;}
.w{text-align:center;padding:28px;}
.n{font-size:72px;font-weight:800;letter-spacing:-4px;color:#1a1a1a;margin-bottom:8px;}
.t{font-size:22px;font-weight:700;letter-spacing:-.5px;margin-bottom:8px;}
.s{font-size:14px;color:#555;margin-bottom:28px;line-height:1.6;}
a{display:inline-block;background:#fff;color:#000;padding:10px 22px;border-radius:6px;text-decoration:none;font-size:13px;font-weight:600;}
a:hover{background:#e5e5e5;}
</style>
</head>
<body>
<div class="w">
  <div class="n">404</div>
  <div class="t">This app doesn't exist</div>
  <div class="s">It may have been deleted, or the link is incorrect.<br>Build your own in 30 seconds — free.</div>
  <a href="https://aiwebbb.com">Build on AIWEBBB →</a>
</div>
</body>
</html>`);
}
