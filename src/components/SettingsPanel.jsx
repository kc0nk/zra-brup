import { useState } from 'react';

export default function SettingsPanel() {
  const [proxyUrl, setProxyUrl] = useState('http://127.0.0.1:8080');
  const [apiKey, setApiKey] = useState('');
  const [aiUrl, setAiUrl] = useState('https://api.openai.com/v1');
  const [model, setModel] = useState('gpt-4o-mini');

  return <div className="settings-page">
    <h1>Proxy settings</h1>
    <p className="subtitle">Configure the local listener used by ZRA BRUP.</p>
    <div className="settings-card proxy-settings-card">
      <label className="url-field">
        <span>URL proxy</span>
        <input type="url" value={proxyUrl} onChange={(event) => setProxyUrl(event.target.value)} placeholder="http://127.0.0.1:8080" />
      </label>
      <button className="primary" type="button">Save</button>
    </div>
    <div className="settings-card ai-settings-card">
      <div className="settings-card-heading">
        <div>
          <h2>AI settings</h2>
          <p>Configure the provider used for payload scan write-ups.</p>
        </div>
      </div>
      <label className="url-field">
        <span>API key</span>
        <input type="password" value={apiKey} onChange={(event) => setApiKey(event.target.value)} placeholder="Enter API key" autoComplete="off" />
      </label>
      <label className="url-field">
        <span>AI URL</span>
        <input type="url" value={aiUrl} onChange={(event) => setAiUrl(event.target.value)} placeholder="https://api.openai.com/v1" />
      </label>
      <label className="url-field">
        <span>Model</span>
        <input type="text" value={model} onChange={(event) => setModel(event.target.value)} placeholder="gpt-4o-mini" />
      </label>
      <button className="primary ai-save" type="button">Save AI settings</button>
    </div>
  </div>;
}
