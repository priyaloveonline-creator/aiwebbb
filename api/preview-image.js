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
  const prompt = `Professional UI/UX mockup screenshot of a modern ${appType} called "${brand || 'App'}". 
Dark theme, mobile app design, 9:16 aspect ratio phone screenshot style. 
The app is: ${desc.substring(0, 150)}.
Show realistic UI elements: navigation bar, cards, buttons, icons, content sections.
Pixel-perfect, high-fidelity, professional design similar to top apps on the App Store.
No text overlays explaining what it is. Pure UI mockup only.`;

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
        size: '1024x1792',  // 9:16 portrait
        quality: 'medium'   // balance speed vs quality
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
