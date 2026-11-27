import { useEffect, useRef, type RefObject } from 'react';
import ReactMarkdown from 'react-markdown';
import { ArrowUp, Loader2, Sparkles, Square, X } from 'lucide-react';
import type { useAssistant } from './useAssistant';
const time = (date:string) => new Date(date).toLocaleTimeString('ja-JP', { hour:'2-digit', minute:'2-digit' });
type Props = {
  assistant:ReturnType<typeof useAssistant>; id:string; open:boolean; onClose:()=>void;
  questionInput:RefObject<HTMLInputElement|null>; onError:(error:unknown)=>void;
};
export function AssistantPanel({ assistant,id,open:right,onClose,questionInput,onError:notify }:Props) {
  const { question,setQuestion,messages,aiBusy,sendQuestion } = assistant;
  const chatArea = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (chatArea.current) chatArea.current.scrollTop = chatArea.current.scrollHeight;
  },[messages.at(-1)?.text,id]);
  useEffect(() => {
    const area = chatArea.current; if (!area) return;
    const observer = new ResizeObserver(() => { area.scrollTop = area.scrollHeight; });
    observer.observe(area); return () => observer.disconnect();
  },[id]);
  return (
        <aside id="assistant-panel" className="ai-sidebar" aria-label="AIアシスタント" hidden={!right}>
        <div className="lower-header ai-sidebar-heading"><h2 id="assistant-heading"><Sparkles size={13}/>AIアシスタント{aiBusy && <Loader2 size={12} className="spin"/>}</h2><button className="icon-button" aria-label="AIサイドバーを閉じる" title="AIアシスタントを閉じる (Esc)" aria-expanded={right} aria-controls="ai-sidebar-content" onClick={() => { onClose(); requestAnimationFrame(() => document.querySelector<HTMLElement>('.cm-content')?.focus()); }}><X size={15}/></button></div>
        <div id="ai-sidebar-content" className="ai-sidebar-content" aria-labelledby="assistant-heading" hidden={!right}>
              <div ref={chatArea} className="chat-area" role="log" aria-label="チャット履歴" aria-live="polite"><div className="messages">{messages.map(m => <div key={m.id} className={`message ${m.role}`}><div className="message-author"><span>{m.role === 'user' ? 'You' : m.provider === 'openai' ? 'OpenAI API' : 'Codex'}</span><time>{time(m.at)}</time></div><div className="markdown">{m.pending && !m.text ? <Loader2 size={14} className="spin" aria-label="応答中"/> : <ReactMarkdown>{m.text}</ReactMarkdown>}{m.pending && m.text && <span className="stream-cursor"/>}</div></div>)}</div></div>
              <div className="composer-area">
                <form className="composer" onSubmit={e => { e.preventDefault(); void sendQuestion(); }}>
                  <input ref={questionInput} aria-label="AIへの質問" value={question} placeholder="質問を入力…" disabled={!id} maxLength={50000} onChange={e => setQuestion(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && (e.nativeEvent.isComposing || e.keyCode === 229)) e.preventDefault(); }}/>
                  {aiBusy ? <button type="button" className="send-button stop" aria-label="応答を停止" onClick={() => window.kata.stopAI(id).catch(notify)}><Square size={12} fill="currentColor"/></button> : <button className="send-button" type="submit" aria-label="送信" disabled={!question.trim() || !id}><ArrowUp size={16}/></button>}
                </form>
              </div>
        </div>
        </aside>
  );
}
