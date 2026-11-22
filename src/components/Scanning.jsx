import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, ShieldAlert } from 'lucide-react';

const API = 'http://127.0.0.1:4173/api/scanning';

export default function Scanning() {
  const [sources, setSources] = useState([]);
  const [payloadCount, setPayloadCount] = useState(0);
  const [scope, setScope] = useState(null);
  const [job, setJob] = useState(null);
  const [running, setRunning] = useState(false);
  const [writeup, setWriteup] = useState(null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');
  const [analyses, setAnalyses] = useState([]);
  const analyzedIds = useRef(new Set());
  const analyzingIds = useRef(new Set());

  useEffect(() => { fetch(`${API}/sources`).then((response) => response.json()).then((data) => { setSources(data.requests || []); setPayloadCount(data.payloads?.length || 0); setScope(data.activeScope); }).catch(() => setError('Scanning backend tidak tersedia.')); }, []);
  useEffect(() => {
    if (!job?.id || job.status === 'complete') return undefined;
    const timer = setInterval(() => fetch(`${API}/${job.id}`).then((response) => response.json()).then((data) => { setJob(data); if (data.status === 'complete') setRunning(false); }).catch(() => {}), 350);
    return () => clearInterval(timer);
  }, [job?.id, job?.status]);

  const start = async () => {
    setError(''); setWriteup(null); setAnalyses([]); analyzedIds.current.clear(); analyzingIds.current.clear(); setRunning(true); setJob({ status: 'running', progress: 0, tested: 0, total: 0, results: [] });
    try { const response = await fetch(`${API}/start`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sourceIds: sources.map((item) => item.id), limit: 80 }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error); setJob(data); } catch (scanError) { setRunning(false); setError(scanError.message || 'Scan gagal dimulai.'); }
  };

  const results = useMemo(() => (job?.results || []).filter((item) => !query || JSON.stringify(item).toLowerCase().includes(query.toLowerCase())), [job, query]);
  const verifiedFindings = useMemo(() => (job?.results || []).filter((item) => item.vulnerable), [job]);
  const progress = job?.progress || 0;

  const analyzeFinding = async (finding) => {
    if (!finding?.id || analyzedIds.current.has(finding.id) || analyzingIds.current.has(finding.id)) return;
    analyzingIds.current.add(finding.id);
    setAnalyses((items) => [...items, { id: finding.id, finding, status: 'analyzing' }]);
    try {
      const response = await fetch(`${API}/analyze-item`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ finding }) });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Analysis failed');
      analyzedIds.current.add(finding.id);
      setAnalyses((items) => items.map((item) => item.id === finding.id ? { ...item, status: 'complete', analysis: data.analysis } : item));
    } catch (analysisError) {
      setAnalyses((items) => items.map((item) => item.id === finding.id ? { ...item, status: 'error', error: analysisError.message } : item));
    } finally { analyzingIds.current.delete(finding.id); }
  };
  useEffect(() => { verifiedFindings.filter((finding) => finding.vulnerable).forEach((finding) => analyzeFinding(finding)); }, [verifiedFindings]);
  const analyze = () => { verifiedFindings.filter((finding) => finding.vulnerable).forEach((finding) => { analyzedIds.current.delete(finding.id); analyzeFinding(finding); }); };
  return <div className="scan-page"><div className="scan-head"><div><h1>Scanning</h1><p>Live payload testing from captured HTTP Proxy requests.</p></div><div className="scan-scope">{scope ? `Scope: ${scope.host}${scope.path}` : 'No proxy scope selected'}</div><button className="primary" onClick={start} disabled={running || !sources.length}>{running ? 'Scanning…' : 'Start scan'}</button></div>
    <div className="scan-loading"><span className={running ? 'spinner active' : 'spinner'} /><span>{running ? `Testing ${job?.tested || 0} / ${job?.total || 0} payload requests` : `${sources.length} proxy requests · ${payloadCount} payloads available`}</span><div className="progress-track"><div className="progress-value" style={{ width: `${progress}%` }} /></div>{job?.collaborator && <code className="scan-callback">OOB: {job.collaborator}</code>}</div>
    {error && <div className="scan-error">{error}</div>}
    <section className="scan-results"><div className="results-head"><div><b>Scan results</b><small>{job?.status === 'complete' ? `${job.results.filter((item) => item.vulnerable).length} verified findings · ${job.results.length} tests` : 'All tests shown; AI uses verified findings only'}</small></div><div className="scan-search"><Search size={14} /><input placeholder="Search results" value={query} onChange={(event) => setQuery(event.target.value)} /></div></div><div className="results-table"><div className="results-row results-header"><span>Host</span><span>URL</span><span>Payload</span><span>Response</span><span>Method</span></div>{results.map((item, index) => <div className={`results-row ${item.vulnerable ? 'finding-row' : ''}`} key={`${item.host}-${item.url}-${index}`}><span className="host">{item.host}</span><span>{item.url}</span><span className="payload-cell" title={item.payload}>{item.payload}</span><span className={item.vulnerable ? 'bad' : 'muted'}>{item.response}</span><span className={'method ' + item.method.toLowerCase()}>{item.method}</span></div>)}{!results.length && <div className="scan-no-results"><ShieldAlert size={28} /><span>{running ? 'Testing payloads live…' : 'No scan results yet.'}</span></div>}</div></section>
    <section className="ai-card"><div><span className="writeup-label">AI ASSISTANT</span><h2>Live evidence analysis</h2><p>Each verified finding is analyzed separately as soon as it appears in the table.</p></div><button className="ai-analyze" onClick={analyze} disabled={!verifiedFindings.length}>{verifiedFindings.length ? `Analyze ${verifiedFindings.length} finding${verifiedFindings.length === 1 ? '' : 's'}` : 'Waiting for verified findings'}</button></section>
    <section className="ai-live-stack">{analyses.map((item) => item.status === 'analyzing' ? <article className="ai-writeup ai-live-card" key={item.id}><div className="writeup-heading"><div><span className="writeup-label">AI ANALYSIS · LIVE</span><h2>Analyzing {item.finding.category}</h2></div><span className="spinner active" /></div><p>Checking evidence, endpoint context, severity, impact, and remediation…</p></article> : item.status === 'error' ? <article className="ai-writeup ai-live-card" key={item.id}><div className="writeup-heading"><div><span className="writeup-label">AI ANALYSIS</span><h2>Analysis failed</h2></div></div><p>{item.error}</p></article> : <article className="ai-writeup ai-live-card" key={item.id}><div className="writeup-heading"><div><span className="writeup-label">AI ANALYSIS · VERIFIED</span><h2>{item.analysis.title}</h2></div><div className={`severity-badge ${item.analysis.severity.toLowerCase()}`}>{item.analysis.severity}</div></div><div className="analysis-meta"><span>Confidence: <b>{item.analysis.confidence}</b></span><span>Endpoint: <code>{item.analysis.endpoint}</code></span></div><section><h3>Evidence</h3><p>{item.analysis.evidence}</p><p>Response: <code>{item.analysis.response}</code> · Payload: <code>{item.analysis.payload}</code></p></section><section><h3>Impact</h3><p>{item.analysis.impact}</p></section><section><h3>Reproduction</h3><p>{item.analysis.reproduction}</p></section><section><h3>Remediation</h3><p>{item.analysis.remediation}</p></section></article>)}</section>
  </div>;
}
