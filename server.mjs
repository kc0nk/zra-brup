import http from 'node:http';
import { spawn } from 'node:child_process';
import express from 'express';
import httpProxy from 'http-proxy';

const PORT = 8080, UI_PORT = 4173, events = [], waiting = new Map();
const proxy = httpProxy.createProxyServer({ changeOrigin: false });
const api = express(); api.use(express.json({ limit: '2mb' }));
api.get('/api/health', (_, r) => r.json({ ok: true, port: PORT, https: 'CONNECT tunnel' }));
api.get('/api/history', (_, r) => r.json(events.slice(-200).reverse()));
api.post('/api/browser', (_, r) => { const a=['--proxy-server=http=127.0.0.1:8080;https=127.0.0.1:8080','--user-data-dir=/tmp/sentinel-chrome-profile','--new-window','http://example.com']; const p=spawn('google-chrome',a,{detached:true,stdio:'ignore'}); p.on('error',()=>spawn('chromium',a,{detached:true,stdio:'ignore'})); p.unref(); r.json({ok:true}); });
api.post('/api/intercept/:id/drop', (q,r) => { const x=waiting.get(q.params.id); if(!x)return r.sendStatus(404); waiting.delete(q.params.id); x.res.writeHead(403); x.res.end('Dropped by Sentinel'); r.json({ok:true}); });
api.listen(UI_PORT,()=>console.log(`Sentinel API: http://127.0.0.1:${UI_PORT}`));
function add(req){const u=req.url.startsWith('http')?new URL(req.url):null;const host=u?.host||req.headers.host||'unknown';const path=u?.pathname||req.url;const x={id:String(Date.now()+Math.random()),method:req.method,host,path,status:0,size:'—',time:new Date().toLocaleTimeString('en-GB'),request:`${req.method} ${path} HTTP/${req.httpVersion}\nHost: ${host}\n${Object.entries(req.headers).map(([k,v])=>`${k}: ${v}`).join('\n')}`};events.push(x);return x}
const server=http.createServer((req,res)=>{if(req.url.startsWith('/api/'))return res.end();const x=add(req);const forward=()=>proxy.web(req,res,{target:req.url},e=>{res.writeHead(502);res.end(`Proxy error: ${e.message}`)});if(process.env.SENTINEL_INTERCEPT==='1'){waiting.set(x.id,{res});return}forward()});
server.on('connect',(req,client)=>{const [host,port]=req.url.split(':');const upstream=http.request({host,port:port||443,method:'CONNECT'});upstream.on('connect',(_,socket)=>{client.write('HTTP/1.1 200 Connection Established\r\n\r\n');client.pipe(socket);socket.pipe(client)});upstream.on('error',()=>client.destroy())});
server.listen(PORT,'127.0.0.1',()=>console.log(`Proxy: http://127.0.0.1:${PORT}`));
