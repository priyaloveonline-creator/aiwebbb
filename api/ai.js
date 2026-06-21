import { cors } from './_supabase.js';

// Vercel Hobby caps every function at 60s regardless of this value —
// streaming is what actually lets long builds complete within that window,
// since we forward tokens as they arrive instead of waiting for the full response.
export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  cors(res, req.headers.origin);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { messages, model } = req.body;
  if (!messages || !Array.isArray(messages)) {
    return res.status(400).json({ error: 'messages array required' });
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'AI service not configured' });

  // MODEL ROUTING:
  // owl-alpha         → FREE conversation layer (chat, Q&A, consultation)
  // gpt-4o-mini       → cheap project planning / understanding (text only)
  // vision-analyst    → DEDICATED image/screenshot/reference analysis (Gemini 2.5 Flash - strong vision)
  // claude-sonnet-4-6 → full website build (default, credits charged)
  // claude-opus-4-8   → complex builds when requested
  let selectedModel = 'anthropic/claude-sonnet-4-6';

  if (model === 'owl-alpha' || model === 'openrouter/owl-alpha') {
    selectedModel = 'openrouter/owl-alpha';
  } else if (model === 'gpt-4o-mini' || model === 'openai/gpt-4o-mini') {
    selectedModel = 'openai/gpt-4o-mini';
  } else if (model === 'vision-analyst' || model === 'google/gemini-2.5-flash') {
    selectedModel = 'google/gemini-2.5-flash';
  } else if (model === 'claude-opus-4-8' || model === 'anthropic/claude-opus-4-8') {
    selectedModel = 'anthropic/claude-opus-4-8';
  }

  const maxTokens = selectedModel === 'openai/gpt-4o-mini' ? 2000
    : selectedModel === 'google/gemini-2.5-flash' ? 3000
    : selectedModel === 'anthropic/claude-opus-4-8' ? 16000
    : 12000;

  // Only stream for the heavy build/edit models — keep simple chat calls as
  // plain JSON since they're fast and the frontend already expects that shape.
  const shouldStream = selectedModel === 'anthropic/claude-sonnet-4-6' || selectedModel === 'anthropic/claude-opus-4-8';

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
        max_tokens: maxTokens,
        temperature: selectedModel === 'google/gemini-2.5-flash' ? 0.4 : 0.7,
        stream: shouldStream
      })
    });

    if (orRes.status === 429) return res.status(402).json({ error: 'credits_exhausted' });

    if (!orRes.ok) {
      const errText = await orRes.text();
      console.error('OpenRouter error:', orRes.status, errText);
      return res.status(orRes.status).json({ error: 'AI service error', detail: errText.substring(0, 300) });
    }

    if (!shouldStream) {
      const data = await orRes.json();
      return res.status(200).json(data);
    }

    // ── STREAMING PATH ──
    // Forward Server-Sent Events to the browser as Newline-Delimited JSON chunks.
    // Frontend accumulates `content` deltas, then has the full text once 'done' arrives.
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('X-Accel-Buffering', 'no');

    const reader = orRes.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullContent = '';

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete last line for next chunk

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || !trimmed.startsWith('data:')) continue;
          const payload = trimmed.slice(5).trim();
          if (payload === '[DONE]') continue;
          try {
            const json = JSON.parse(payload);
            const delta = json.choices?.[0]?.delta?.content || '';
            if (delta) {
              fullContent += delta;
              res.write(JSON.stringify({ type: 'delta', content: delta }) + '\n');
            }
          } catch (e) { /* partial JSON line, ignore */ }
        }
      }
    } catch (streamErr) {
      console.error('stream read error:', streamErr.message);
    }

    res.write(JSON.stringify({ type: 'done', content: fullContent }) + '\n');
    return res.end();

  } catch (err) {
    console.error('ai.js error:', err.message);
    if (!res.headersSent) {
      return res.status(500).json({ error: 'Internal error', detail: err.message });
    }
    res.end();
  }
}
