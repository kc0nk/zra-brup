import { Send } from 'lucide-react';
import { useState } from 'react';
import Editor from './Editor';

export default function Repeater({ tabs, setTabs, activeId, setActiveId, response }) {
  const current = tabs.find((tab) => tab.id === activeId) || tabs[0];
  const [sending, setSending] = useState(false);
  const update = (patch) => setTabs(tabs.map((tab) => tab.id === activeId ? { ...tab, ...patch } : tab));
  const add = () => { const id = Date.now(); setTabs([...tabs, { id, name: String(tabs.length + 1), request: '', response: '', target: false, requestMode: 'Pretty', responseMode: 'Pretty' }]); setActiveId(id); };
  const close = (id, event) => { event.stopPropagation(); if (tabs.length === 1) { const replacement = { id: Date.now(), name: '1', request: '', response: '', target: false, requestMode: 'Pretty', responseMode: 'Pretty' }; setTabs([replacement]); setActiveId(replacement.id); return; } const remaining = tabs.filter((tab) => tab.id !== id); setTabs(remaining); if (id === activeId) setActiveId(remaining[remaining.length - 1].id); };
  const send = async () => { if (!current?.request.trim()) return; setSending(true); try { const result = await fetch('http://127.0.0.1:4173/api/repeater/send', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ request: current.request, https: current.target }) }); const data = await result.json(); update({ response: data.response || `HTTP error: ${data.error || 'Unable to send request'}` }); } catch (error) { update({ response: `HTTP error: ${error.message}` }); } finally { setSending(false); } };
  return <div className="repeater-page"><div className="repeater-tabs">{tabs.map((tab) => <button className={activeId === tab.id ? 'repeater-tab active' : 'repeater-tab'} onClick={() => setActiveId(tab.id)} key={tab.id}>{tab.name}<span onClick={(event) => close(tab.id, event)}>×</span></button>)}<button className="new-repeater" onClick={add}>＋</button></div><div className="repeater-head"><h1>Repeater</h1><span>Edit and resend requests manually</span><button className="primary" onClick={send} disabled={sending || !current?.request.trim()}><Send size={14} /> {sending ? 'Sending…' : 'Send'}</button></div><div className="repeater-grid"><Editor value={current.request} onChange={(value) => update({ request: value })} mode={current.requestMode} onModeChange={(requestMode) => update({ requestMode })} /><Editor value={current.response || response} onChange={() => {}} mode={current.responseMode} onModeChange={(responseMode) => update({ responseMode })} /></div></div>;
}
