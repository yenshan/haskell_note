import { useEffect, useState } from 'react';
import { RotateCcw } from 'lucide-react';
import type { OpenAIKeyStatus } from './types';
import { defaultOpenAIBaseURL, type useAssistant } from './useAssistant';

export function AISettings({ assistant }:{ assistant:ReturnType<typeof useAssistant> }) {
  const { provider,setProvider,openAIModel,setOpenAIModel,openAIBaseURL,setOpenAIBaseURL } = assistant;
  return <section className="settings-section" aria-labelledby="ai-settings-title">
    <h3 id="ai-settings-title">AI設定</h3>
    <div className="settings-fields ai-provider-field">
      <label>AI接続先<select value={provider} onChange={e => setProvider(e.target.value === 'openai' ? 'openai' : 'codex')}>
        <option value="openai">OpenAI API</option>
        <option value="codex">Codex</option>
      </select></label>
    </div>
    {provider === 'openai' ? <OpenAISettings model={openAIModel} onModelChange={setOpenAIModel} baseURL={openAIBaseURL} onBaseURLChange={setOpenAIBaseURL}/> : <CodexSettings assistant={assistant}/>}
  </section>;
}

function CodexSettings({ assistant }:{ assistant:ReturnType<typeof useAssistant> }) {
  const { codexStatus,model,effort,efforts,setAISettings,aiBusy,connectCodex } = assistant;
  const connecting = codexStatus.state === 'connecting';
  const disconnected = codexStatus.state === 'disconnected';
  const needsReconnect = codexStatus.state === 'error' || (codexStatus.state === 'connected' && !codexStatus.authenticated);
  return <>
    <div className="settings-fields ai-settings-controls">
      <label>Codexモデル<select value={model} disabled={aiBusy || connecting || !codexStatus.models.length} onChange={e => {
        const next = codexStatus.models.find(option => option.id === e.target.value);
        setAISettings({ model:e.target.value,effort:next?.defaultReasoningEffort || '' });
      }}>
        {!codexStatus.models.length && <option value="">{connecting ? 'モデルを読込中…' : 'デフォルト'}</option>}
        {codexStatus.models.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}
      </select></label>
      <label>推論レベル<select value={effort} disabled={aiBusy || connecting || !efforts.length} onChange={e => setAISettings({ model,effort:e.target.value })}>
        {!efforts.length && <option value="">デフォルト</option>}
        {efforts.map(option => <option key={option.effort} value={option.effort} title={option.description}>{option.effort}</option>)}
      </select></label>
    </div>
    <div className="ai-connection">
      <span role="status">{codexStatus.message}</span>
      {(disconnected || needsReconnect) && <button className="secondary-button" onClick={() => void connectCodex()}><RotateCcw size={13}/>{disconnected ? 'Codexに接続' : 'Codexに再接続'}</button>}
    </div>
  </>;
}

function OpenAISettings({ model,onModelChange,baseURL,onBaseURLChange }:{ model:string; onModelChange:(model:string)=>void; baseURL:string; onBaseURLChange:(baseURL:string)=>void }) {
  const [models,setModels] = useState<string[]>([]);
  const [baseURLInput,setBaseURLInput] = useState(baseURL);
  const [keyInput,setKeyInput] = useState('');
  const [keyStatus,setKeyStatus] = useState<OpenAIKeyStatus|null>(null);
  const [message,setMessage] = useState('');
  const [busy,setBusy] = useState(false);
  const baseURLChanged = baseURLInput.trim() !== baseURL;
  const usesOfficialURL = baseURL === defaultOpenAIBaseURL;
  const canConnect = !busy && !baseURLChanged && keyStatus !== null && (!usesOfficialURL || keyStatus !== 'missing');
  const currentModelAvailable = models.includes(model);
  useEffect(() => {
    let active = true;
    window.kata.openAIKeyStatus(baseURL).then(status => { if (active) setKeyStatus(status); })
      .catch(error => { if (active) setMessage(error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': Error: /,'') : String(error)); });
    return () => { active = false; };
  },[baseURL]);

  async function run(action:()=>Promise<void>) {
    setBusy(true); setMessage('');
    try { await action(); }
    catch (error) { setMessage(error instanceof Error ? error.message.replace(/^Error invoking remote method '[^']+': Error: /,'') : String(error)); }
    finally { setBusy(false); }
  }

  return <div className="settings-fields openai-settings">
    <form className="openai-setting" onSubmit={e => {
      e.preventDefault();
      if (!baseURLChanged || busy) return;
      void run(async () => {
        const url = await window.kata.normalizeOpenAIBaseURL(baseURLInput);
        if (url !== baseURL) {
          setKeyStatus(null); setKeyInput(''); setModels([]); onBaseURLChange(url);
        }
        setBaseURLInput(url); setMessage('ベースURLを保存しました。');
      });
    }}>
      <label>ベースURL<input type="url" required value={baseURLInput} placeholder={defaultOpenAIBaseURL} onChange={e => setBaseURLInput(e.target.value)} maxLength={2048} spellCheck={false} disabled={busy}/></label>
      <button className="secondary-button" type="submit" disabled={busy || !baseURLChanged || !baseURLInput.trim()}>URLを保存</button>
    </form>
    <form className="openai-setting" onSubmit={e => {
      e.preventDefault();
      if (!keyInput.trim() || busy || baseURLChanged) return;
      void run(async () => { setKeyStatus(await window.kata.saveOpenAIKey(keyInput,baseURL)); setKeyInput(''); setModels([]); setMessage('APIキーを保存しました。'); });
    }}>
      <label>OpenAI APIキー<input type="password" autoComplete="off" value={keyInput} onChange={e => setKeyInput(e.target.value)} maxLength={1024} disabled={busy || baseURLChanged}/></label>
      <button className="secondary-button" type="submit" disabled={busy || baseURLChanged || !keyInput.trim()}>キーを保存</button>
    </form>
    <div className="openai-setting">
      <label>モデル<select value={model} disabled={!canConnect || !models.length} onChange={e => {
        onModelChange(e.target.value); setMessage('モデルを保存しました。');
      }}>
        {!currentModelAvailable && <option value={model} disabled>{models.length ? `${model}（一覧にありません）` : model}</option>}
        {models.map(id => <option key={id} value={id}>{id}</option>)}
      </select></label>
      <button className="secondary-button" type="button" disabled={!canConnect} onClick={() => void run(async () => {
        setMessage('モデル一覧を取得中…');
        const available = await window.kata.listOpenAIModels(baseURL);
        setModels(available);
        setMessage(available.length ? `${available.length}件のモデルを取得しました。` : '取得できるモデルがありません。');
      })}>モデル取得</button>
    </div>
    <div className="ai-connection openai-connection">
      <span>{keyStatus === 'saved' ? 'APIキー保存済み' : keyStatus === 'environment' ? 'OPENAI_API_KEY を使用' : keyStatus === 'missing' ? 'APIキー未設定' : ''}</span>
      {keyStatus === 'saved' && <button className="secondary-button" disabled={busy || baseURLChanged} onClick={() => void run(async () => {
        setKeyStatus(await window.kata.clearOpenAIKey(baseURL)); setKeyInput(''); setModels([]); setMessage('保存したAPIキーを削除しました。');
      })}>保存したキーを削除</button>}
      <button className="secondary-button" disabled={!canConnect || !model} onClick={() => void run(async () => {
        await window.kata.checkOpenAI(model,baseURL); setMessage('OpenAI APIに接続できました。');
      })}>接続を確認</button>
    </div>
    <div className="ai-connection-message" role="status">{message}</div>
  </div>;
}
