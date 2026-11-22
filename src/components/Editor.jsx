import { useEffect, useMemo, useRef, useState } from 'react';

const toHex = (value) => Array.from(new TextEncoder().encode(value))
  .map((byte, index) => `${byte.toString(16).padStart(2, '0')}${(index + 1) % 16 ? ' ' : '\n'}`)
  .join('').trim();

const escapeHtml = (value) => value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char]));
const highlight = (value) => escapeHtml(value).split('\n').map((line) => {
  let html = line.replace(/^(GET|POST|PUT|PATCH|DELETE|HTTP\/\d(?:\.\d)?)/, '<span class="code-method">$1</span>');
  html = html.replace(/^([A-Za-z][A-Za-z0-9-]*)(:)/, '<span class="code-header">$1</span>$2');
  html = html.replace(/(https?:\/\/[^\s<]+)/g, '<span class="code-url">$1</span>');
  html = html.replace(/(Cookie|Set-Cookie)(:)([^<]*)/g, '<span class="code-cookie">$1</span>$2<span class="code-value">$3</span>');
  html = html.replace(/(\b\d+(?:\.\d+)?\b)/g, '<span class="code-number">$1</span>');
  return html || '&nbsp;';
}).join('\n');

export default function Editor({ value, onChange, mode, onModeChange }) {
  const [search, setSearch] = useState('');
  const [scrollX, setScrollX] = useState(0);
  const [scrollMax, setScrollMax] = useState(0);
  const lineNumbersRef = useRef(null);
  const highlightRef = useRef(null);
  const textareaRef = useRef(null);
  const displayed = useMemo(() => mode === 'Hex' ? toHex(value) : value, [mode, value]);
  const highlights = search ? (displayed.match(new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')) || []).length : 0;

  const lines = displayed.split('\n');
  useEffect(() => { const measure = () => setScrollMax(Math.max(0, (textareaRef.current?.scrollWidth || 0) - (textareaRef.current?.clientWidth || 0))); measure(); window.addEventListener('resize', measure); return () => window.removeEventListener('resize', measure); }, [displayed]);
  const syncScroll = (event) => { if (lineNumbersRef.current) lineNumbersRef.current.scrollTop = event.currentTarget.scrollTop; if (highlightRef.current) highlightRef.current.scrollTop = event.currentTarget.scrollTop; setScrollX(event.currentTarget.scrollLeft); };
  const moveHorizontal = (event) => { const value = Number(event.target.value); setScrollX(value); if (textareaRef.current) textareaRef.current.scrollLeft = value; if (highlightRef.current) highlightRef.current.scrollLeft = value; };
  return <div className="editor editor-light">
    <div className="format-tabs">
      {['Pretty', 'Raw', 'Hex'].map((format) => <button key={format} className={mode === format ? 'active' : ''} onClick={() => onModeChange(format)}>{format}</button>)}
    </div>
    <div className="code-area"><div className="line-numbers" ref={lineNumbersRef}>{lines.map((_, index) => <span key={index}>{index + 1}</span>)}</div><div className="code-highlight" ref={highlightRef} dangerouslySetInnerHTML={{ __html: highlight(displayed) }} /><textarea ref={textareaRef} value={displayed} onChange={(event) => mode !== 'Hex' && onChange(event.target.value)} onScroll={syncScroll} readOnly={mode === 'Hex'} spellCheck="false" /></div>
    <div className={'editor-horizontal ' + (scrollMax ? 'visible' : '')}><input type="range" min="0" max={scrollMax} value={Math.min(scrollX, scrollMax)} onChange={moveHorizontal} aria-label="Horizontal code scroll" /></div>
    <div className="editor-search"><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search" /><span>{highlights} highlights</span></div>
  </div>;
}
