// api/ai.js — OpenRouter AI proxy
// Handles both streaming and non-streaming responses.
// Free tier: claude-sonnet-4-6  |  Paid: claude-opus-4-8

import { cors, getSupabase } from './_supabase.js';

const ALLOWED_MODELS = new Set([
  'claude-sonnet-4-6',
  'claude-opus-4-8',
  'anthropic/claude-sonnet-4-6',
  'anthropic/claude-opus-4-8'
]);

export const config = { maxDuration: 120 };

export default async function handler(req, res) {
  cors(res, req.headers.origin);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, model, email, stream = false } = req.body;

  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  // Determine model — default to Sonnet (free tier)
  let selectedModel = 'anthropic/claude-sonnet-4-6';
  if (model && ALLOWED_MODELS.has(model)) {
    // Only allow Opus for paid users — verify in DB
    if (model === 'claude-opus-4-8' || model === 'anthropic/claude-opus-4-8') {
      const sb = getSupabase();
      if (sb && email) {
        const { data } = await sb.from('users').select('plan').eq('email', email).single();
        if (data?.plan === 'pro') {
          selectedModel = 'anthropic/claude-opus-4-8';
        }
        // standard plan: sonnet is fine
      }
    }
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI service not configured' });

  try {
    const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://aiwebbb.com',
        'X-Title': 'AIWEBBB'
      },
      body: JSON.stringify({
        model: selectedModel,
        messages,
        max_tokens: 16000,
        temperature: 0.7,
        stream: false // keep non-streaming for JSON parse reliability
      })
    });

    if (orRes.status === 429) {
      return res.status(402).json({ error: 'credits_exhausted' });
    }
    if (!orRes.ok) {
      const errText = await orRes.text();
      console.error('OpenRouter error:', orRes.status, errText);
      return res.status(orRes.status).json({ error: 'AI service error', detail: errText.slice(0, 300) });
    }

    const data = await orRes.json();

    // OpenRouter returns OpenAI-compatible format
    return res.status(200).json(data);

  } catch (err) {
    console.error('ai.js error:', err.message);
    return res.status(500).json({ error: 'Internal error', detail: err.message });
  }
}
