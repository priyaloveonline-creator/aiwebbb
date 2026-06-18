import { cors } from './_supabase.js';
export const config = { maxDuration: 120 };
export default async function handler(req, res) {
  cors(res, req.headers.origin);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  const { messages, model } = req.body;
  if (!messages || !Array.isArray(messages)) return res.status(400).json({ error: 'messages array required' });
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI service not configured' });
  let selectedModel = 'anthropic/claude-sonnet-4-6';
  if (model === 'gpt-4o-mini' || model === 'openai/gpt-4o-mini') selectedModel = 'openai/gpt-4o-mini';
  else if (model === 'claude-opus-4-8' || model === 'anthropic/claude-opus-4-8') selectedModel = 'anthropic/claude-opus-4-8';
  try {
    const orRes = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json', 'HTTP-Referer': 'https://aiwebbb.com', 'X-Title': 'AIWEBBB' },
      body: JSON.stringify({ model: selectedModel, messages, max_tokens: selectedModel === 'openai/gpt-4o-mini' ? 2000 : 16000, temperature: 0.7 })
    });
    if (orRes.status === 429) return res.status(402).json({ error: 'credits_exhausted' });
    if (!orRes.ok) { const errText = await orRes.text(); console.error('OpenRouter error:', orRes.status, errText); return res.status(orRes.status).json({ error: 'AI service error' }); }
    const data = await orRes.json();
    return res.status(200).json(data);
  } catch (err) { console.error('ai.js error:', err.message); return res.status(500).json({ error: 'Internal error' }); }
}
