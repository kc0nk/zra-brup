import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import express from 'express';
import { Proxy as MitmProxy } from 'http-mitm-proxy';

const PORT = 8080;
const UI_PORT = 4173;
const events = [];
const waiting = new Map();
let activeScope = null;
let interceptEnabled = false;
const proxy = new MitmProxy();
const api = express();

api.use(express.json({ limit: '2mb' }));
api.use((_, response, next) => { response.setHeader('Access-Control-Allow-Origin', '*'); response.setHeader('Access-Control-Allow-Headers', 'Content-Type'); next(); });
api.get('/lab/', (request, response) => { response.cookie('zra_lab_visit', 'active', { httpOnly: true, sameSite: 'lax', maxAge: 3600000 }); response.sendFile(path.join(process.cwd(), 'lab', 'index.html')); });
api.use('/lab', express.static(path.join(process.cwd(), 'lab')));
api.get('/api/health', (_, response) => response.json({ ok: true, port: PORT, https: 'MITM' }));
api.get('/api/history', (_, response) => response.json(events.filter((item) => !activeScope || inScope(item)).slice(-200).reverse()));
api.delete('/api/history', (_, response) => { events.length = 0; response.json({ ok: true }); });
api.get('/api/intercept/pending', (_, response) => response.json([...waiting.values()].map((item) => item.event)));
api.post('/api/intercept/toggle', (request, response) => { interceptEnabled = Boolean(request.body?.enabled); response.json({ ok: true, enabled: interceptEnabled }); });
api.post('/lab/api/login', (request, response) => { const { email = '' } = request.body || {}; const valid = email.includes('@'); if (valid) response.cookie('zra_lab_session', 'active', { httpOnly: true, sameSite: 'lax', maxAge: 3600000 }); response.status(valid ? 200 : 401).json({ ok: valid, message: valid ? 'Welcome back to the lab.' : 'Use a valid lab email address.', user: email || null }); });
api.get('/lab/api/search', (request, response) => { const query = String(request.query.q || '').trim(); response.json({ query, results: query ? [`${query} security guide`, `${query} request playground`, `${query} testing notes`] : [] }); });
api.get('/lab/api/profile', (_, response) => response.json({ name: 'Ari Pratama', role: 'Security learner', status: 'Ready for testing' }));
api.post('/api/browser', (request, response) => {
  const target = typeof request.body?.url === 'string' ? request.body.url.trim() : '';
  let url;
  try { url = new URL(target); } catch { return response.status(400).json({ ok: false, error: 'URL tidak valid' }); }
  if (!['http:', 'https:'].includes(url.protocol)) return response.status(400).json({ ok: false, error: 'Gunakan URL HTTP atau HTTPS' });
  const browserUrl = new URL(url.toString());
  if (['127.0.0.1', 'localhost', '::1'].includes(browserUrl.hostname)) browserUrl.hostname = '127.0.0.1.nip.io';
  activeScope = { host: browserUrl.host, path: browserUrl.pathname === '/' ? '/' : browserUrl.pathname.replace(/\/$/, '') };
  const args = ['--proxy-server=http=127.0.0.1:8080;https=127.0.0.1:8080', '--proxy-bypass-list=<-loopback>', '--ignore-certificate-errors', '--disable-quic', `--user-data-dir=/tmp/zra-brup-chrome-profile-${process.pid}`, '--new-window', url.toString()];
  const candidates = ['/opt/google/chrome/chrome', '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  const command = candidates.find((candidate) => existsSync(candidate));
  if (!command) return response.status(503).json({ ok: false, error: 'Chrome atau Chromium tidak ditemukan' });
  args[args.length - 1] = browserUrl.toString();
  const child = spawn(command, args, { detached: true, stdio: 'ignore' });
  child.once('error', (error) => console.error('Browser launch error:', error.message));
  child.unref();
  response.json({ ok: true, url: browserUrl.toString(), originalUrl: url.toString(), httpsMitm: true });
});
api.post('/api/intercept/:id/forward', (request, response) => { const item = waiting.get(request.params.id); if (!item) return response.sendStatus(404); waiting.delete(request.params.id); item.callback(); response.json({ ok: true }); });
api.post('/api/intercept/:id/drop', (request, response) => { const item = waiting.get(request.params.id); if (!item) return response.sendStatus(404); waiting.delete(request.params.id); item.callback(new Error('Dropped by user')); response.json({ ok: true }); });
api.listen(UI_PORT, () => console.log(`Sentinel API: http://127.0.0.1:${UI_PORT}`));

function add(request, isSSL = false) {
  const host = request.headers.host || 'unknown';
  const path = request.url || '/';
  const item = { id: String(Date.now() + Math.random()), method: request.method, host, path, status: 0, size: '—', time: new Date().toLocaleTimeString('en-GB'), tls: isSSL, ip: request.socket.remoteAddress?.replace(/^::ffff:/, '') || '—', cookie: request.headers.cookie || '—', setCookie: '—', request: `${request.method} ${path} HTTP/${request.httpVersion}\n${Object.entries(request.headers).map(([key, value]) => `${key}: ${value}`).join('\n')}`, response: '' };
  events.push(item);
  return item;
}

function inScope(item) {
  if (!activeScope || item.host !== activeScope.host) return false;
  return activeScope.path === '/' || item.path === activeScope.path || item.path.startsWith(`${activeScope.path}/`);
}

proxy.onError((context, error) => { const item = context?.zraEvent; if (item) item.status = 502; console.error('Proxy error:', error.message); });
proxy.onRequest((context, callback) => {
  const item = add(context.clientToProxyRequest, context.isSSL);
  context.zraEvent = item;
  context.onResponse((responseContext, responseCallback) => {
    const response = responseContext.serverToProxyResponse;
    item.status = response?.statusCode || 0;
    item.size = response?.headers?.['content-length'] ? `${response.headers['content-length']} B` : '—';
    item.setCookie = response?.headers?.['set-cookie']?.join('; ') || '—';
    item.response = `HTTP/${response?.httpVersion || '1.1'} ${response?.statusCode || 0} ${response?.statusMessage || ''}\n${Object.entries(response?.headers || {}).map(([key, value]) => `${key}: ${value}`).join('\n')}\n\n`;
    context.onResponseData((_, chunk, dataCallback) => {
      if (item.response.length < 100000) item.response += chunk.toString('utf8').slice(0, 100000 - item.response.length);
      return dataCallback(null, chunk);
    });
    return responseCallback();
  });
  if (interceptEnabled) { waiting.set(item.id, { callback, event: item }); return; }
  return callback();
});

proxy.listen({ port: PORT, host: '127.0.0.1', sslCaDir: `${process.cwd()}/.http-mitm-proxy` });
console.log(`Proxy MITM HTTP/HTTPS: http://127.0.0.1:${PORT}`);
