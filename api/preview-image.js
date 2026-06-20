// api/preview-image.js
// Generates website preview image using OpenAI gpt-image-1
// Called during free preview phase - no credits charged

import { cors } from './_supabase.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  cors(res, req.headers.origin);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { desc, brand, type } = req.body;
  if (!desc) return res.status(400).json({ error: 'desc required' });

  const openaiKey = process.env.OPENAI_API_KEY;
  if (!openaiKey) {
    // Fallback: return null so frontend uses text preview
    return res.status(200).json({ imageUrl: null, fallback: true });
  }

  // Build a strong prompt for gpt-image-1
  const appType = type || 'web app';
  const prompt = `Professional, ultra-high-fidelity website UI mockup for "${brand || 'App'}" — a ${appType}.
Context: ${desc.substring(0, 200)}.

Style: Clean modern web design, desktop browser viewport mockup, realistic and polished like a top-tier SaaS or e-commerce site (Stripe, Linear, Apple-level design quality).
Show: a complete visible homepage layout with navigation bar, hero section with real-looking headline text, product/content cards, and clear visual hierarchy.
Typography should look crisp and intentional. Use a cohesive color palette matching the brand's industry.
Lighting and rendering should look like a real screenshot — sharp edges, proper alignment, consistent spacing, no warped text, no garbled letters.
Pure UI design only — no browser chrome, no device frame, no watermarks, no explanatory text overlays.`;

  try {
    const r = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-image-1',
        prompt: prompt,
        n: 1,
        size: '1536x1024',  // widescreen - matches desktop website layouts
        quality: 'high'     // best quality tier
      })
    });

    if (!r.ok) {
      const err = await r.text();
      console.error('OpenAI image error:', r.status, err);
      return res.status(200).json({ imageUrl: null, fallback: true });
    }

    const data = await r.json();
    // gpt-image-1 returns base64 by default
    const b64 = data.data?.[0]?.b64_json;
    const url = data.data?.[0]?.url;

    if (b64) {
      return res.status(200).json({ imageUrl: `data:image/png;base64,${b64}`, fallback: false });
    } else if (url) {
      return res.status(200).json({ imageUrl: url, fallback: false });
    } else {
      return res.status(200).json({ imageUrl: null, fallback: true });
    }

  } catch (err) {
    console.error('preview-image error:', err.message);
    return res.status(200).json({ imageUrl: null, fallback: true });
  }
}
