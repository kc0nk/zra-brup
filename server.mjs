import { spawn } from 'node:child_process';
import express from 'express';
import { Proxy as MitmProxy } from 'http-mitm-proxy';

const PORT = 8080;
const UI_PORT = 4173;
const events = [];
const waiting = new Map();
const proxy = new MitmProxy();
const api = express();

api.use(express.json({ limit: '2mb' }));
api.use((_, response, next) => { response.setHeader('Access-Control-Allow-Origin', '*'); response.setHeader('Access-Control-Allow-Headers', 'Content-Type'); next(); });
api.get('/api/health', (_, response) => response.json({ ok: true, port: PORT, https: 'MITM' }));
api.get('/api/history', (_, response) => response.json(events.slice(-200).reverse()));
api.post('/api/browser', (request, response) => {
  const target = typeof request.body?.url === 'string' ? request.body.url.trim() : '';
  let url;
  try { url = new URL(target); } catch { return response.status(400).json({ ok: false, error: 'URL tidak valid' }); }
  if (!['http:', 'https:'].includes(url.protocol)) return response.status(400).json({ ok: false, error: 'Gunakan URL HTTP atau HTTPS' });
  const args = ['--proxy-server=http=127.0.0.1:8080;https=127.0.0.1:8080', '--ignore-certificate-errors', '--user-data-dir=/tmp/zra-brup-chrome-profile', '--new-window', url.toString()];
  const launch = (command) => { const child = spawn(command, args, { detached: true, stdio: 'ignore' }); child.on('error', () => { if (command === 'google-chrome') launch('chromium'); }); child.unref(); };
  launch('google-chrome');
  response.json({ ok: true, url: url.toString(), httpsMitm: true });
});
api.post('/api/intercept/:id/forward', (request, response) => { const item = waiting.get(request.params.id); if (!item) return response.sendStatus(404); waiting.delete(request.params.id); item.callback(); response.json({ ok: true }); });
api.post('/api/intercept/:id/drop', (request, response) => { const item = waiting.get(request.params.id); if (!item) return response.sendStatus(404); waiting.delete(request.params.id); item.callback(new Error('Dropped by user')); response.json({ ok: true }); });
api.listen(UI_PORT, () => console.log(`Sentinel API: http://127.0.0.1:${UI_PORT}`));

function add(request, isSSL = false) {
  const host = request.headers.host || 'unknown';
  const path = request.url || '/';
  const item = { id: String(Date.now() + Math.random()), method: request.method, host, path, status: 0, size: '—', time: new Date().toLocaleTimeString('en-GB'), tls: isSSL, request: `${request.method} ${path} HTTP/${request.httpVersion}\nHost: ${host}\n${Object.entries(request.headers).map(([key, value]) => `${key}: ${value}`).join('\n')}` };
  events.push(item);
  return item;
}

proxy.onError((context, error) => { const item = context?.zraEvent; if (item) item.status = 502; console.error('Proxy error:', error.message); });
proxy.onRequest((context, callback) => {
  const item = add(context.clientToProxyRequest, context.isSSL);
  context.zraEvent = item;
  context.onResponse((responseContext, responseCallback) => { item.status = responseContext.serverToProxyResponse?.statusCode || 0; item.size = responseContext.serverToProxyResponse?.headers?.['content-length'] ? `${responseContext.serverToProxyResponse.headers['content-length']} B` : '—'; return responseCallback(); });
  if (process.env.SENTINEL_INTERCEPT === '1') { waiting.set(item.id, { callback }); return; }
  return callback();
});

proxy.listen({ port: PORT, host: '127.0.0.1', sslCaDir: `${process.cwd()}/.http-mitm-proxy` });
console.log(`Proxy MITM HTTP/HTTPS: http://127.0.0.1:${PORT}`);
