// Category / event guesses for imported ledger rows, via Vercel AI Gateway.
//
// Auth: on Vercel the project's OIDC token (request header, else env); locally
// VERCEL_OIDC_TOKEN from `vercel env pull`, or AI_GATEWAY_API_KEY. Model:
// AI_GATEWAY_MODEL, else a cheap free-tier-friendly default. Any failure
// returns no suggestions; the client then leaves those rows on "Other".

import type { VercelRequest } from '@vercel/node';
import { FINANCE_OPTIONS } from './finance.js';
import { HttpError } from './http.js';

const DEFAULT_MODEL = 'google/gemini-2.5-flash-lite';
const MAX_ROWS = 200;

export interface Suggestion {
  index: number;
  category: string | null;
  event: string | null;
}

function strings(value: unknown, max: number, field: string): string[] {
  if (!Array.isArray(value) || value.length > max) throw new HttpError(400, `${field} must be a list of at most ${max}`);
  return value.map((v) => (typeof v === 'string' ? v.trim().slice(0, 200) : ''));
}

export async function suggestForRows(req: VercelRequest, body: Record<string, unknown>): Promise<{ suggestions: Suggestion[]; warning: string | null }> {
  const rows = strings(body.rows, MAX_ROWS, 'rows');
  const events = strings(body.events, 500, 'events').filter(Boolean);
  if (rows.length === 0) return { suggestions: [], warning: null };

  const header = req.headers['x-vercel-oidc-token'];
  const token = (Array.isArray(header) ? header[0] : header) || process.env.VERCEL_OIDC_TOKEN || process.env.AI_GATEWAY_API_KEY;
  if (!token) return { suggestions: [], warning: 'AI suggestions are off here (no AI Gateway token).' };

  const categories = FINANCE_OPTIONS.categories;
  const prompt = [
    'Classify each line of a university student society ledger.',
    `category: exactly one of ${categories.join(', ')}. Use Other when unsure.`,
    `event: exactly one of these event titles, or "" if none clearly fits: ${JSON.stringify(events)}`,
    'Lines (index: text):',
    ...rows.map((r, i) => `${i}: ${r}`),
  ].join('\n');

  try {
    const res = await fetch('https://ai-gateway.vercel.sh/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(30_000),
      body: JSON.stringify({
        model: process.env.AI_GATEWAY_MODEL || DEFAULT_MODEL,
        temperature: 0,
        messages: [{ role: 'user', content: prompt }],
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'ledger_suggestions',
            strict: true,
            schema: {
              type: 'object',
              additionalProperties: false,
              required: ['rows'],
              properties: {
                rows: {
                  type: 'array',
                  items: {
                    type: 'object',
                    additionalProperties: false,
                    required: ['index', 'category', 'event'],
                    properties: {
                      index: { type: 'integer' },
                      category: { type: 'string', enum: [...categories] },
                      event: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      }),
    });
    if (!res.ok) {
      console.error('[ledgerAi] gateway', res.status, (await res.text()).slice(0, 300));
      return { suggestions: [], warning: `AI suggestions unavailable (gateway returned ${res.status}).` };
    }
    const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const parsed = JSON.parse(data.choices?.[0]?.message?.content ?? '{}') as { rows?: Suggestion[] };
    // The model's answer is untrusted: keep only known categories, events and indexes.
    const suggestions = (parsed.rows ?? [])
      .filter((s) => Number.isInteger(s.index) && s.index >= 0 && s.index < rows.length)
      .map((s) => ({
        index: s.index,
        category: (categories as readonly string[]).includes(s.category ?? '') ? s.category : null,
        event: s.event && events.includes(s.event) ? s.event : null,
      }));
    return { suggestions, warning: null };
  } catch (err) {
    console.error('[ledgerAi]', err);
    return { suggestions: [], warning: 'AI suggestions unavailable right now.' };
  }
}
