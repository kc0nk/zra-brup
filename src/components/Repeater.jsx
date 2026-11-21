import { Send } from 'lucide-react';
import Editor from './Editor';

export default function Repeater({ tabs, setTabs, activeId, setActiveId, response }) {
  const current = tabs.find((tab) => tab.id === activeId) || tabs[0];
  const update = (patch) => setTabs(tabs.map((tab) => tab.id === activeId ? { ...tab, ...patch } : tab));
  const add = () => { const id = Date.now(); setTabs([...tabs, { id, name: String(tabs.length + 1), request: tabs[0].request, response, requestMode: 'Pretty', responseMode: 'Pretty' }]); setActiveId(id); };
  return <div className="repeater-page"><div className="repeater-tabs">{tabs.map((tab) => <button className={activeId === tab.id ? 'repeater-tab active' : 'repeater-tab'} onClick={() => setActiveId(tab.id)} key={tab.id}>{tab.name}<span>×</span></button>)}<button className="new-repeater" onClick={add}>＋</button></div><div className="repeater-head"><h1>Repeater</h1><span>Edit and resend requests manually</span><button className="primary"><Send size={14} /> Send</button></div><div className="repeater-grid"><Editor value={current.request} onChange={(value) => update({ request: value })} mode={current.requestMode} onModeChange={(requestMode) => update({ requestMode })} /><Editor value={current.response || response} onChange={() => {}} mode={current.responseMode} onModeChange={(responseMode) => update({ responseMode })} /></div></div>;
}
