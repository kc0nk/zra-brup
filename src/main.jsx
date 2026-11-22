import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { HelpCircle, Settings, ShieldCheck } from 'lucide-react';
import './styles.css';
import Collaborator from './components/Collaborator';
import HttpProxy from './components/HttpProxy';
import Repeater from './components/Repeater';
import Scanning from './components/Scanning';
import SettingsPanel from './components/SettingsPanel';
import Editor from './components/Editor';

const requestSample = '';
const responseSample = '';
const initialHistory = [];

function InterceptPanel({ enabled, setEnabled, request, setRequest }) {
  const [queue, setQueue] = useState([]);
  const [mode, setMode] = useState('Pretty');
  const [tableHeight, setTableHeight] = useState(72);
  const [dragging, setDragging] = useState(false);
  const current = queue[0];
  const refreshPending = async () => { try { const response = await fetch('http://127.0.0.1:4173/api/intercept/pending'); if (response.ok) setQueue(await response.json()); } catch {} };
  const toggle = async () => { const next = !enabled; setEnabled(next); if (!next) setQueue([]); try { await fetch('http://127.0.0.1:4173/api/intercept/toggle', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ enabled: next }) }); refreshPending(); } catch {} };
  const action = async (kind) => { if (!current) return; await fetch(`http://127.0.0.1:4173/api/intercept/${current.id}/${kind}`, { method: 'POST' }); refreshPending(); };
  useEffect(() => {
    if (!dragging) return undefined;
    const move = (event) => setTableHeight(Math.max(50, Math.min(window.innerHeight - 360, event.clientY - 210)));
    const stop = () => setDragging(false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop, { once: true });
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); };
  }, [dragging]);
  useEffect(() => { refreshPending(); const timer = setInterval(refreshPending, 500); return () => clearInterval(timer); }, []);
  useEffect(() => { if (current?.request) setRequest(current.request); }, [current, setRequest]);
  return <div className="intercept-page">
    <section className="intercept-toolbar"><button className={'intercept ' + (enabled ? 'on' : '')} onClick={toggle}><span className="switch"><span /></span> Intercept {enabled ? 'on' : 'off'}</button><button className="primary" disabled={!enabled || !current} onClick={() => action('forward')}><span>→</span> Forward</button><button className="secondary" disabled={!current} onClick={() => action('drop')}>Drop <span>⌄</span></button><span className="spacer" /><span className="target-request">{current ? `Request to ${current.url || `${current.host}${current.path}`}` : 'No intercepted request'}</span><button className="secondary">◉ Open browser</button></section>
    <div className="intercept-table" style={{ flex: `0 0 ${tableHeight}px` }}><div className="intercept-row intercept-header"><span>Time</span><span>Type</span><span>Direction</span><span>Method</span><span>URL</span><span>Status code</span><span>Length</span></div>{queue.map((item) => <div className="intercept-row selected" key={item.id}><span>{item.time}</span><span>{item.type}</span><span>{item.direction} Request</span><span>{item.method}</span><span>{item.url}</span><span>—</span><span>—</span></div>)}</div><div className={'intercept-divider ' + (dragging ? 'dragging' : '')} onPointerDown={(event) => { event.preventDefault(); setDragging(true); }} role="separator" aria-orientation="horizontal" aria-label="Resize intercept request" />
    {current ? <div className="intercept-detail"><div className="intercept-request"><div className="detail-title">Request</div><Editor value={request} onChange={setRequest} mode={mode} onModeChange={setMode} /></div><div className="intercept-inspector"><b>Inspector</b><p>Request attributes <span>2</span></p><p>Request cookies <span>2</span></p><p>Request headers <span>20</span></p></div></div> : <div className="empty"><div className="empty-icon"><ShieldCheck size={48} /></div><h1>{enabled ? 'Waiting for request' : 'Intercept is off'}</h1><p>{enabled ? 'New browser requests will appear here for review.' : 'Turn Intercept on to hold requests before forwarding them.'}</p><button className="primary large" onClick={() => setEnabled(true)}>{enabled ? 'Waiting for request' : 'Start intercepting'}</button></div>}
  </div>;
}

function App() {
  const [tab, setTab] = useState('Intercept');
  const [intercept, setIntercept] = useState(false);
  const [history, setHistory] = useState(initialHistory);
  const [selected, setSelected] = useState(null);
  const [request, setRequest] = useState(requestSample);
  const [requestMode, setRequestMode] = useState('Pretty');
  const [responseMode, setResponseMode] = useState('Pretty');
  const [repeaterTabs, setRepeaterTabs] = useState([{ id: 1, name: '1', request: requestSample, response: responseSample, requestMode: 'Pretty', responseMode: 'Pretty' }]);
  const [activeRepeater, setActiveRepeater] = useState(1);
  const sendToRepeater = (item) => { const id = Date.now(); setRepeaterTabs((tabs) => [...tabs, { id, name: String(tabs.length + 1), request: item.request || '', response: '', target: Boolean(item.tls), requestMode: 'Pretty', responseMode: 'Pretty' }]); setActiveRepeater(id); setTab('Repeater'); };

  useEffect(() => {
    let alive = true;
    const loadHistory = async () => {
      try {
        const response = await fetch('http://127.0.0.1:4173/api/history');
        if (!response.ok) return;
        const items = await response.json();
        if (alive) setHistory(items);
      } catch {
        // The UI can still be used while the proxy backend is stopped.
      }
    };
    loadHistory();
    const timer = setInterval(loadHistory, 1000);
    return () => { alive = false; clearInterval(timer); };
  }, []);

  return <div className="app">
    <header className="topbar"><div className="brand"><div className="brandmark"><ShieldCheck size={18} /></div><span>ZRA BRUP</span><small>PROXY WORKBENCH</small></div><div className="top-actions"><HelpCircle size={17} /><Settings size={17} /><div className="avatar">KC</div></div></header>
    <nav className="tabs">{['Intercept', 'HTTP proxy', 'Repeater', 'Collaborator', 'Scanning'].map((item) => <button key={item} onClick={() => setTab(item)} className={tab === item ? 'active' : ''}>{item}{item === 'HTTP proxy' && <span className="count">{history.length}</span>}</button>)}<button className="settings-tab" onClick={() => setTab('Proxy settings')}><Settings size={16} /> Proxy settings</button></nav>
    <main>
      {tab === 'Intercept' && <InterceptPanel enabled={intercept} setEnabled={setIntercept} request={request} setRequest={setRequest} />}
      {tab === 'HTTP proxy' && <HttpProxy history={history} setHistory={setHistory} selected={selected} setSelected={setSelected} request={request} setRequest={setRequest} response={responseSample} requestMode={requestMode} setRequestMode={setRequestMode} responseMode={responseMode} setResponseMode={setResponseMode} onSendToRepeater={sendToRepeater} />}
      {tab === 'Repeater' && <Repeater tabs={repeaterTabs} setTabs={setRepeaterTabs} activeId={activeRepeater} setActiveId={setActiveRepeater} response={responseSample} />}
      {tab === 'Collaborator' && <Collaborator />}
      {tab === 'Scanning' && <Scanning />}
      {tab === 'Proxy settings' && <SettingsPanel />}
    </main>
  </div>;
}

createRoot(document.getElementById('root')).render(<App />);
