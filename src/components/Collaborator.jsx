import { Filter, Search, Trash2 } from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';

const API = 'http://127.0.0.1:4173/api/collaborator';

export default function Collaborator() {
  const [payload, setPayload] = useState(null);
  const [interactions, setInteractions] = useState([]);
  const [filters, setFilters] = useState({ HTTP: true, HTTPS: true, SMTP: true });
  const [query, setQuery] = useState('');
  const [copied, setCopied] = useState('');

  const loadPayload = useCallback(async () => { const response = await fetch(`${API}/payload`); setPayload(await response.json()); }, []);
  const poll = useCallback(async () => { const response = await fetch(`${API}/interactions${payload ? `?token=${encodeURIComponent(payload.token)}` : ''}`); if (response.ok) setInteractions(await response.json()); }, [payload]);
  useEffect(() => { loadPayload(); }, [loadPayload]);
  useEffect(() => { poll(); const timer = setInterval(poll, 1000); return () => clearInterval(timer); }, [poll]);
  const copy = async (value, label) => {
    if (!value) return;
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(value);
      else throw new Error('clipboard unavailable');
    } catch {
      const area = document.createElement('textarea'); area.value = value; area.style.position = 'fixed'; area.style.opacity = '0'; document.body.appendChild(area); area.focus(); area.select(); document.execCommand('copy'); area.remove();
    }
    setCopied(label); setTimeout(() => setCopied(''), 1500);
  };
  const visibleRows = useMemo(() => interactions.filter((item) => filters[item.type] && (!query || JSON.stringify(item).toLowerCase().includes(query.toLowerCase()))), [interactions, filters, query]);
  const clear = async () => { await fetch(`${API}/interactions`, { method: 'DELETE' }); setInteractions([]); };

  return <div className="collab-page">
    <div className="collab-endpoints"><div className="collab-endpoint-card"><b>HTTP</b><code>{payload?.http || 'Starting local collector…'}</code><button className={copied === 'HTTP-endpoint' ? 'copied' : ''} onClick={() => copy(payload?.http, 'HTTP-endpoint')}>{copied === 'HTTP-endpoint' ? 'Copied' : 'Copy'}</button></div><div className="collab-endpoint-card"><b>HTTPS</b><code>{payload?.https || 'Starting local collector…'}</code><button className={copied === 'HTTPS' ? 'copied' : ''} onClick={() => copy(payload?.https, 'HTTPS')}>{copied === 'HTTPS' ? 'Copied' : 'Copy'}</button></div><div className="collab-endpoint-card"><b>SMTP</b><code>{payload?.smtp || 'Starting local collector…'}</code><button className={copied === 'SMTP' ? 'copied' : ''} onClick={() => copy(payload?.smtp, 'SMTP')}>{copied === 'SMTP' ? 'Copied' : 'Copy'}</button></div></div>
    <div className="collab-filters"><Filter size={16} /><b>Filter</b>{Object.keys(filters).map((type) => <button key={type} className={`filter-chip ${filters[type] ? 'active' : ''}`} onClick={() => setFilters((old) => ({ ...old, [type]: !old[type] }))}>{type}</button>)}<div className="collab-search"><Search size={14} /><input placeholder="Search" value={query} onChange={(event) => setQuery(event.target.value)} /></div><button className="collab-clear" onClick={clear} title="Clear interactions"><Trash2 size={14} /></button></div>
    <div className="collab-table-wrap"><div className="collab-table-head"><span>#</span><span>Time</span><span>Type</span><span>Payload</span><span>Source IP address</span><span>Comment</span></div>{visibleRows.map((item, index) => <div className="collab-table-row" key={item.id}><span>{visibleRows.length - index}</span><span>{item.time}</span><span>{item.type}</span><span className="payload-cell">{item.payload}</span><span>{item.sourceIp}</span><span>{item.comment}</span></div>)}{!visibleRows.length && <div className="collab-empty"><div className="collab-icon"><Filter size={52} /></div><h1>Your interactions will appear here</h1><p>Send an HTTP/HTTPS request or email to the generated local payload.</p><button className="learn-button" onClick={() => copy(payload?.http, 'HTTP')}>Copy HTTP payload</button></div>}</div>
  </div>;
}
