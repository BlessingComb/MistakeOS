import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { analyzeWithGroq, validateGroqAnalysisRequest } from './groq';

const port = Number(process.env.MISTAKE_ANALYSIS_PORT || 8787);
const apiKey = process.env.GROQ_API_KEY?.trim();
const allowedOrigins = new Set([
  'http://localhost:8081',
  'http://127.0.0.1:8081',
  ...(process.env.MISTAKEOS_ALLOWED_ORIGINS?.split(',').map((origin: string) => origin.trim()).filter(Boolean) ?? []),
]);
const requestsByIp = new Map<string, number[]>();

createServer(async (request, response) => {
  const origin = request.headers.origin;
  if (origin && allowedOrigins.has(origin)) response.setHeader('access-control-allow-origin', origin);
  response.setHeader('vary', 'Origin');
  response.setHeader('access-control-allow-headers', 'content-type');
  response.setHeader('access-control-allow-methods', 'POST, OPTIONS');
  response.setHeader('cache-control', 'no-store');

  if (request.method === 'OPTIONS') return send(response, 204, null);
  if (request.method !== 'POST' || request.url !== '/analyze-question') return send(response, 404, { code: 'not_found' });
  if (origin && !allowedOrigins.has(origin)) return send(response, 403, { code: 'origin_not_allowed' });
  if (!apiKey) return send(response, 503, { code: 'analysis_not_configured' });
  if (!withinRateLimit(request.socket.remoteAddress ?? 'unknown')) return send(response, 429, { code: 'rate_limited' });

  try {
    const body = await readJson(request);
    const validated = validateGroqAnalysisRequest(body);
    if (!validated) return send(response, 400, { code: 'invalid_request' });
    const result = await analyzeWithGroq(validated, apiKey);
    return send(response, 200, result);
  } catch (error) {
    const status = typeof error === 'object' && error && 'status' in error ? Number(error.status) : 500;
    return send(response, status === 429 ? 429 : 502, { code: status === 429 ? 'rate_limited' : 'analysis_failed' });
  }
}).listen(port, '127.0.0.1', () => {
  process.stdout.write(`MistakeOS analysis server ready at http://localhost:${port}\n`);
});

function withinRateLimit(ip: string): boolean {
  const now = Date.now();
  const recent = (requestsByIp.get(ip) ?? []).filter((timestamp) => now - timestamp < 60_000);
  if (recent.length >= 10) return false;
  recent.push(now);
  requestsByIp.set(ip, recent);
  return true;
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
    size += buffer.length;
    if (size > 8_500_000) throw Object.assign(new Error('Payload too large'), { status: 413 });
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function send(response: ServerResponse, status: number, payload: unknown) {
  response.statusCode = status;
  if (payload === null) return response.end();
  response.setHeader('content-type', 'application/json; charset=utf-8');
  response.end(JSON.stringify(payload));
}
