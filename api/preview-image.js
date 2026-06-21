// api/preview-image.js
// Generates a high-quality website preview image via OpenRouter (Gemini 3.1 Flash Image,
// a.k.a. "Nano Banana 2" — Pro-level visual quality at Flash speed).
// Uses the SAME OPENROUTER_API_KEY as every other AI feature — no separate OpenAI key needed.
// Called during the free preview phase - no credits charged.

import { cors } from './_supabase.js';

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  cors(res, req.headers.origin);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { desc, brand, type } = req.body;
  if (!desc) return res.status(400).json({ error: 'desc required' });

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return res.status(200).json({ imageUrl: null, fallback: true, reason: 'no_api_key' });
  }

  const appType = type || 'web app';
  const prompt = `Professional, ultra-high-fidelity website UI mockup for "${brand || 'App'}" — a ${appType}.
Context: ${desc.substring(0, 200)}.

Style: Clean modern web design, desktop browser viewport mockup, realistic and polished like a top-tier SaaS or e-commerce site (Stripe, Linear, Apple-level design quality).
Show: a complete visible homepage layout with navigation bar, hero section with real-looking headline text, product/content cards, and clear visual hierarchy.
Typography should look crisp and intentional. Use a cohesive color palette matching the brand's industry.
Lighting and rendering should look like a real screenshot — sharp edges, proper alignment, consistent spacing, no warped text, no garbled letters.
Pure UI design only — no browser chrome, no device frame, no watermarks, no explanatory text overlays.`;

  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://aiwebbb.com',
        'X-Title': 'AIWEBBB'
      },
      body: JSON.stringify({
        model: 'google/gemini-3.1-flash-image-preview',
        messages: [{ role: 'user', content: prompt }],
        modalities: ['image', 'text'],
        image_config: { aspect_ratio: '3:2' } // closest supported ratio to a widescreen website mockup
      })
    });

    if (!r.ok) {
      const errText = await r.text();
      console.error('OpenRouter image error:', r.status, errText.substring(0, 300));
      // Fallback to a secondary model if the primary is unavailable
      return await tryFallbackModel(apiKey, prompt, res);
    }

    const data = await r.json();
    const imageUrl = extractImageUrl(data);

    if (imageUrl) {
      return res.status(200).json({ imageUrl, fallback: false });
    }
    return await tryFallbackModel(apiKey, prompt, res);

  } catch (err) {
    console.error('preview-image error:', err.message);
    return res.status(200).json({ imageUrl: null, fallback: true, reason: err.message });
  }
}

// If Nano Banana 2 (preview model) is unavailable, retry with the stable Gemini 2.5 Flash Image model.
async function tryFallbackModel(apiKey, prompt, res) {
  try {
    const r = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://aiwebbb.com',
        'X-Title': 'AIWEBBB'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-image-preview',
        messages: [{ role: 'user', content: prompt }],
        modalities: ['image', 'text']
      })
    });
    if (!r.ok) return res.status(200).json({ imageUrl: null, fallback: true, reason: 'both_models_failed' });
    const data = await r.json();
    const imageUrl = extractImageUrl(data);
    return res.status(200).json({ imageUrl, fallback: !imageUrl });
  } catch (err) {
    return res.status(200).json({ imageUrl: null, fallback: true, reason: err.message });
  }
}

// OpenRouter's image-generation response embeds the image as a content block
// (commonly an image_url-style object or a base64 data URL) inside the message.
function extractImageUrl(data) {
  try {
    const message = data?.choices?.[0]?.message;
    if (!message) return null;

    // images array (OpenRouter's documented shape for multimodal output)
    if (Array.isArray(message.images) && message.images.length > 0) {
      const first = message.images[0];
      if (typeof first === 'string') return first;
      if (first?.image_url?.url) return first.image_url.url;
      if (first?.url) return first.url;
    }

    // content as an array of blocks, possibly containing an image_url block
    if (Array.isArray(message.content)) {
      for (const block of message.content) {
        if (block?.type === 'image_url' && block.image_url?.url) return block.image_url.url;
        if (block?.type === 'image' && block.source?.data) {
          return `data:${block.source.media_type || 'image/png'};base64,${block.source.data}`;
        }
      }
    }

    return null;
  } catch (e) {
    return null;
  }
}
