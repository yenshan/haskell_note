import { RotateCcw } from 'lucide-react';
import type { useAssistant } from './useAssistant';

export function AISettings({ assistant }:{ assistant:ReturnType<typeof useAssistant> }) {
  const { codexStatus,model,effort,efforts,setAISettings,aiBusy,connectCodex } = assistant;
  const connecting = codexStatus.state === 'connecting';
  const disconnected = codexStatus.state === 'disconnected';
  const needsReconnect = codexStatus.state === 'error' || (codexStatus.state === 'connected' && !codexStatus.authenticated);
  return <section className="settings-section" aria-labelledby="ai-settings-title">
    <h3 id="ai-settings-title">AI設定</h3>
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
  </section>;
}
