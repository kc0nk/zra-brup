import { useEffect, useState } from 'react';
import { Search, SlidersHorizontal, Trash2 } from 'lucide-react';
import Editor from './Editor';

export default function HttpProxy({ history, setHistory, selected, setSelected, request, setRequest, response, requestMode, setRequestMode, responseMode, setResponseMode }) {
  const [filter, setFilter] = useState('');
  const [selectedResponse, setSelectedResponse] = useState('');
  const [tableHeight, setTableHeight] = useState(285);
  const [dragging, setDragging] = useState(false);
  const rows = history.filter((item) => `${item.host}${item.path}${item.method}`.toLowerCase().includes(filter.toLowerCase()));
  const choose = (item) => { setSelected(item); setRequest(item.request || `${item.method} ${item.path} HTTP/1.1\nHost: ${item.host}\n\n`); setSelectedResponse(item.response || ''); };
  useEffect(() => {
    if (!dragging) return undefined;
    const move = (event) => setTableHeight(Math.max(150, Math.min(window.innerHeight - 300, event.clientY - 210)));
    const stop = () => setDragging(false);
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', stop, { once: true });
    return () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', stop); };
  }, [dragging]);

  return <>
    <section className="proxy-filter"><SlidersHorizontal size={15} /><span>Filter settings: hiding CSS and image content</span><div className="search"><Search size={15} /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Search" /></div><span className="filter-on">● Filter on</span></section>
    <section className="history-toolbar"><div className="search"><Search size={15} /><input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filter requests..." /></div><button className="secondary" onClick={async () => { await fetch('http://127.0.0.1:4173/api/history', { method: 'DELETE' }); setHistory([]); setSelected(null); setSelectedResponse(''); setRequest(''); }}><Trash2 size={15} /> Clear history</button></section>
    <div className="history-grid"><div className="table" style={{ flex: `0 0 ${tableHeight}px` }}><div className="thead"><span>#</span><span>Host</span><span>Method</span><span>URL</span><span>Status</span><span>Length</span><span>MIME type</span><span>Time</span><span>IP</span><span>Cookies</span></div>{rows.map((item, index) => <div className={'trow ' + (selected?.id === item.id ? 'selected' : '')} onClick={() => choose(item)} key={item.id}><span>{index + 1}</span><span className="host">{item.host}</span><span className={'method ' + item.method.toLowerCase()}>{item.method}</span><span>{item.path}</span><span className={item.status >= 400 ? 'bad' : 'good'}>{item.status}</span><span>{item.size}</span><span>HTML</span><span className="muted">{item.time}</span><span className="muted">{item.ip || '—'}</span><span className="muted cookie-cell" title={item.cookie !== '—' ? item.cookie : item.setCookie}>{item.cookie !== '—' ? item.cookie : item.setCookie}</span></div>)}</div><div className={'proxy-divider ' + (dragging ? 'dragging' : '')} onPointerDown={(event) => { event.preventDefault(); setDragging(true); }} role="separator" aria-orientation="horizontal" aria-label="Resize request table" />
      <div className="side-panel"><div className="panel-title">Original request</div><div className="dual-editors"><Editor value={request} onChange={setRequest} mode={requestMode} onModeChange={setRequestMode} /><Editor value={selectedResponse || response} onChange={() => {}} mode={responseMode} onModeChange={setResponseMode} /></div><div className="inspector-panel"><b>Inspector</b>{selected ? <><p>Request attributes <span>2</span></p><p>Protocol <span>{selected.tls ? 'HTTPS' : 'HTTP'}</span></p><hr /><p>Name <span>Value</span></p><p>Method <span>{selected.method}</span></p><p>Path <span>{selected.path}</span></p><p>Request cookies <span>—</span></p></> : <p className="muted">Select a request to inspect it.</p>}</div></div>
    </div>
  </>;
}
