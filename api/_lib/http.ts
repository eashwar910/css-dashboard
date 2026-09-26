// Small HTTP helpers shared by every /api endpoint.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isNotionClientError } from '@notionhq/client';
import { ConfigError } from './env.js';

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
type Handler = (req: VercelRequest, res: VercelResponse) => Promise<void> | void;

/** Every response is per-user and authenticated, so nothing may be cached by the CDN or browser. */
function noStore(res: VercelResponse) {
  res.setHeader('Cache-Control', 'no-store');
}

export function sendJson(res: VercelResponse, status: number, body: unknown): void {
  noStore(res);
  res.status(status).json(body);
}

export function sendError(res: VercelResponse, status: number, message: string, extra?: Record<string, unknown>): void {
  sendJson(res, status, { error: message, ...extra });
}

/** Send 405 with an Allow header unless req.method is one of methods. Returns whether to continue. */
export function allowMethods(req: VercelRequest, res: VercelResponse, methods: Method[]): boolean {
  if (req.method && (methods as string[]).includes(req.method)) return true;
  res.setHeader('Allow', methods.join(', '));
  sendError(res, 405, `Method ${req.method ?? 'unknown'} not allowed`);
  return false;
}

/**
 * Log the full error server-side, send the client only a generic message.
 * Notion errors can include request bodies and IDs, so they never reach the client.
 */
export function handleError(res: VercelResponse, err: unknown, context: string): void {
  if (err instanceof ConfigError) {
    console.error(`[api] ${context}: ${err.message}`);
    if (!res.headersSent) sendError(res, 500, 'Server is not configured correctly');
    return;
  }
  if (isNotionClientError(err)) {
    const requestId = 'request_id' in err ? (err as { request_id?: string }).request_id : undefined;
    console.error(`[api] ${context}: Notion ${err.code}: ${err.message}`, requestId ? `(request_id ${requestId})` : '');
    if (res.headersSent) return;
    if (err.code === 'rate_limited') sendError(res, 503, 'Notion is busy, please try again shortly');
    else sendError(res, 502, 'Could not reach Notion');
    return;
  }
  console.error(`[api] ${context}:`, err);
  if (!res.headersSent) sendError(res, 500, 'Internal server error');
}

/**
 * Wrap an endpoint: sets no-store on every response, enforces allowed methods
 * and catches anything thrown.
 */
export function withHandler(methods: Method[], handler: Handler, context = 'handler'): Handler {
  return async (req, res) => {
    noStore(res);
    if (!allowMethods(req, res, methods)) return;
    try {
      await handler(req, res);
    } catch (err) {
      handleError(res, err, `${context} ${req.method} ${req.url}`);
    }
  };
}
