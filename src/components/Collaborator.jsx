import { Copy, Globe, Radio, RefreshCw } from 'lucide-react';
import { useState } from 'react';

export default function Collaborator() {
  const [payload, setPayload] = useState('zra-' + Math.random().toString(36).slice(2, 18) + '.oast.local');
  const [copied, setCopied] = useState(false);
  const copy = async () => { await navigator.clipboard?.writeText(payload); setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return <div className="collab-page"><div className="collab-toolbar"><label>Payloads to generate: <input value="1" readOnly /></label><button className="primary" onClick={copy}><Copy size={14} /> {copied ? 'Copied' : 'Copy to clipboard'}</button><button className="secondary" onClick={() => setPayload('zra-' + Math.random().toString(36).slice(2, 18) + '.oast.local')}><RefreshCw size={14} /> Poll now</button><span className="poll-status"><Radio size={14} /> Polling manually</span></div><div className="collab-empty"><div className="collab-icon"><Globe size={55} /></div><h1>Your interactions will appear here</h1><p>Copy a Collaborator payload and use it during authorized testing.</p></div><div className="payload-line">Current payload: <code>{payload}</code></div></div>;
}
