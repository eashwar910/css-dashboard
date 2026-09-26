// Small HTTP helpers shared by every /api endpoint.

import type { VercelRequest, VercelResponse } from '@vercel/node';
import { isNotionClientError } from '@notionhq/client';
import { ConfigError } from './env.js';

type Method = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';

/** Throw from a handler to send `status` with a client-safe message. */
export class HttpError extends Error {
  constructor(
    public readonly status: number,
    message: string,
    public readonly extra?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

/** The request body as a plain object. Throws 400 if it isn't JSON. */
export function jsonBody(req: VercelRequest): Record<string, unknown> {
  let body: unknown = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch {
      throw new HttpError(400, 'Request body must be JSON');
    }
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) throw new HttpError(400, 'Request body must be a JSON object');
  return body as Record<string, unknown>;
}

/** A Notion page id from ?id=, normalised to dashed form. Throws 400 if missing or malformed. */
export function pageIdParam(req: VercelRequest, name = 'id'): string {
  const raw = req.query[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  const id = normalisePageId(value);
  if (!id) throw new HttpError(400, `Query parameter "${name}" must be a Notion page id`);
  return id;
}

/** Dashed lowercase UUID for a 32-hex Notion id (with or without dashes), else null. */
export function normalisePageId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const hex = value.replace(/-/g, '').toLowerCase();
  if (!/^[0-9a-f]{32}$/.test(hex)) return null;
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

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
  if (err instanceof HttpError) {
    if (!res.headersSent) sendError(res, err.status, err.message, err.extra);
    return;
  }
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
