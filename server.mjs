import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import https from 'node:https';
import express from 'express';
import { Proxy as MitmProxy } from 'http-mitm-proxy';

const PORT = 8080;
const UI_PORT = 4173;
const events = [];
const waiting = new Map();
const browserProcesses = new Set();
const browserProfiles = new Set();
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
api.post('/api/intercept/toggle', (request, response) => {
  interceptEnabled = Boolean(request.body?.enabled);
  if (!interceptEnabled) {
    for (const item of waiting.values()) item.callback(new Error('Intercept disabled'));
    waiting.clear();
  }
  response.json({ ok: true, enabled: interceptEnabled });
});
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
  const profile = `/tmp/zra-brup-chrome-profile-${process.pid}`;
  args[4] = `--user-data-dir=${profile}`;
  browserProfiles.add(profile);
  const candidates = ['/opt/google/chrome/chrome', '/usr/bin/google-chrome-stable', '/usr/bin/google-chrome', '/usr/bin/chromium', '/usr/bin/chromium-browser'];
  const command = candidates.find((candidate) => existsSync(candidate));
  if (!command) return response.status(503).json({ ok: false, error: 'Chrome atau Chromium tidak ditemukan' });
  args[args.length - 1] = browserUrl.toString();
  const child = spawn(command, args, { detached: true, stdio: 'ignore' });
  browserProcesses.add(child);
  child.once('exit', () => browserProcesses.delete(child));
  child.once('error', (error) => console.error('Browser launch error:', error.message));
  child.unref();
  response.json({ ok: true, url: browserUrl.toString(), originalUrl: url.toString(), httpsMitm: true });
});
api.post('/api/intercept/:id/forward', (request, response) => { const item = waiting.get(request.params.id); if (!item) return response.sendStatus(404); waiting.delete(request.params.id); item.callback(); response.json({ ok: true }); });
api.post('/api/intercept/:id/drop', (request, response) => { const item = waiting.get(request.params.id); if (!item) return response.sendStatus(404); waiting.delete(request.params.id); item.callback(new Error('Dropped by user')); response.json({ ok: true }); });
api.post('/api/repeater/send', (request, response) => {
  const raw = String(request.body?.request || '');
  const lines = raw.split(/\r?\n/);
  const first = lines.shift() || '';
  const match = first.match(/^(\S+)\s+(\S+)\s+HTTP\/\S+$/);
  if (!match) return response.status(400).json({ ok: false, error: 'Request tidak valid' });
  const headers = {};
  while (lines.length && lines[0] !== '') { const line = lines.shift(); const index = line.indexOf(':'); if (index > 0) headers[line.slice(0, index).trim()] = line.slice(index + 1).trim(); }
  if (lines[0] === '') lines.shift();
  const body = lines.join('\n');
  const host = headers.Host || headers.host;
  if (!host) return response.status(400).json({ ok: false, error: 'Header Host tidak ditemukan' });
  const secure = Boolean(request.body?.https);
  const client = secure ? https : http;
  const options = { hostname: host.split(':')[0], port: Number(host.split(':')[1] || (secure ? 443 : 80)), path: match[2], method: match[1], headers, rejectUnauthorized: false };
  const outgoing = client.request(options, (incoming) => { const chunks = []; incoming.on('data', (chunk) => chunks.push(chunk)); incoming.on('end', () => { const responseText = `HTTP/${incoming.httpVersion} ${incoming.statusCode} ${incoming.statusMessage || ''}\n${Object.entries(incoming.headers).map(([key, value]) => `${key}: ${value}`).join('\n')}\n\n${Buffer.concat(chunks).toString('utf8')}`; response.json({ ok: true, response: responseText }); }); });
  outgoing.on('error', (error) => response.status(502).json({ ok: false, error: error.message }));
  if (body) outgoing.write(body);
  outgoing.end();
});
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
  if (interceptEnabled && inScope(item)) { waiting.set(item.id, { callback, event: item }); return; }
  return callback();
});

proxy.listen({ port: PORT, host: '127.0.0.1', sslCaDir: `${process.cwd()}/.http-mitm-proxy` });
console.log(`Proxy MITM HTTP/HTTPS: http://127.0.0.1:${PORT}`);

function closeProjectBrowsers() {
  for (const child of browserProcesses) {
    try { process.kill(-child.pid, 'SIGTERM'); } catch { try { child.kill('SIGTERM'); } catch {} }
  }
  browserProcesses.clear();
  for (const profile of browserProfiles) { try { spawn('pkill', ['-TERM', '-f', profile], { stdio: 'ignore' }); } catch {} }
  browserProfiles.clear();
}
process.once('SIGTERM', () => { closeProjectBrowsers(); process.exit(0); });
process.once('SIGINT', () => { closeProjectBrowsers(); process.exit(0); });
process.once('exit', closeProjectBrowsers);
