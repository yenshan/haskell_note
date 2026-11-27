const { randomUUID } = require('node:crypto');
const { diagnosticInstructions, diagnosticRequest, parseExplanation, chatPrompt, tutorInstructions, validateQuestion } = require('./ai-prompts.cjs');
const { normalizeOpenAIBaseURL } = require('./openai-url.cjs');

const messageTimeout = 120_000;

function validModelId(model) {
  return typeof model === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.:@+\/-]{0,511}$/.test(model);
}

function modelId(model) {
  if (!validModelId(model)) throw new Error('AI設定で有効なOpenAIモデルIDを指定してください。');
  return model;
}

function outputText(response) {
  return (response?.output || []).filter(item => item.type === 'message')
    .flatMap(item => item.content).filter(part => part.type === 'output_text').map(part => part.text).join('');
}

async function streamAnswer(body, onDelta) {
  if (!body) throw new Error('OpenAI APIから応答を受信できませんでした。');
  let buffer = '';
  for await (const chunk of body.pipeThrough(new TextDecoderStream())) {
    buffer += chunk;
    let boundary;
    while ((boundary = /\r?\n\r?\n/.exec(buffer))) {
      const frame = buffer.slice(0,boundary.index);
      buffer = buffer.slice(boundary.index + boundary[0].length);
      const data = frame.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trimStart()).join('\n');
      if (!data || data === '[DONE]') continue;
      const event = JSON.parse(data);
      switch (event.type) {
        case 'response.output_text.delta':
        case 'response.refusal.delta':
          if (typeof event.delta === 'string') onDelta(event.delta);
          break;
        case 'response.completed': return outputText(event.response);
        case 'response.incomplete': throw new Error('OpenAI APIの応答が途中で終了しました。');
        case 'response.failed':
        case 'error': throw new Error('OpenAI APIで応答の生成に失敗しました。');
      }
    }
  }
  throw new Error('OpenAI APIとの接続が応答の途中で切れました。');
}

class OpenAI {
  constructor(store, emit, credentials, fetchRequest = fetch) {
    this.store = store;
    this.emit = emit;
    this.credentials = credentials;
    this.fetchRequest = fetchRequest;
    this.chats = new Map();
    this.lifetime = new AbortController();
  }

  async request(baseURL, endpoint, signal, body) {
    signal.throwIfAborted();
    const url = normalizeOpenAIBaseURL(baseURL);
    const key = await this.credentials.get(url);
    signal.throwIfAborted();
    let response;
    try {
      response = await this.fetchRequest(url + endpoint,{
        method:body ? 'POST' : 'GET',redirect:'error',signal,
        headers:{ ...(key ? { Authorization:`Bearer ${key}` } : {}),...(body ? { 'Content-Type':'application/json' } : {}) },
        ...(body ? { body:JSON.stringify(body) } : {})
      });
    } catch {
      signal.throwIfAborted();
      throw new Error('OpenAI APIに接続できませんでした。');
    }
    if (response.ok) return response;
    await response.body?.cancel().catch(() => {});
    // Remote errors may quote authentication data. Only show local messages.
    switch (response.status) {
      case 401: throw new Error('OpenAI APIの認証に失敗しました。APIキーを確認してください。');
      case 403: throw new Error('OpenAI APIのアクセス権限を確認してください。');
      case 404: throw new Error(endpoint === '/models' ? 'モデル一覧を取得できません。ベースURLを確認してください。' : '指定したOpenAIモデルを利用できません。モデルIDと権限を確認してください。');
      case 429: throw new Error('OpenAI APIの利用枠またはリクエスト上限に達しました。');
      default: throw new Error(`OpenAI APIのリクエストが失敗しました（HTTP ${response.status}）。`);
    }
  }

  async check(model,baseURL) {
    const signal = AbortSignal.any([this.lifetime.signal,AbortSignal.timeout(15_000)]);
    const response = await this.request(baseURL,'/models/' + encodeURIComponent(modelId(model)),signal);
    await response.body?.cancel().catch(() => {});
  }

  async listModels(baseURL) {
    const signal = AbortSignal.any([this.lifetime.signal,AbortSignal.timeout(15_000)]);
    try {
      const response = await this.request(baseURL,'/models',signal);
      const body = await response.json().catch(() => null);
      signal.throwIfAborted();
      if (!Array.isArray(body?.data)) throw new Error('モデル一覧の応答形式が不正です。');
      return [...new Set(body.data.map(entry => entry?.id).filter(validModelId))].sort();
    } catch (error) {
      if (signal.reason?.name === 'TimeoutError') throw new Error('モデル一覧の取得がタイムアウトしました。');
      throw error;
    }
  }

  async ask(id, text, context, model, _effort, sourceCode, baseURL) {
    validateQuestion(text,sourceCode);
    modelId(model);
    const item = this.store.find(id);
    if (item.messages.some(message => message.pending)) throw new Error('前の応答が完了するまでお待ちください');
    const signalController = new AbortController();
    const signal = AbortSignal.any([signalController.signal,this.lifetime.signal,AbortSignal.timeout(messageTimeout)]);
    signal.throwIfAborted();
    const history = item.messages.slice(-12).filter(message => message.text)
      .map(({ role,text }) => ({ role,content:text.slice(-8000) }));
    const at = new Date().toISOString();
    const message = { id:randomUUID(),role:'assistant',provider:'openai',text:'',pending:true,at };
    this.chats.set(id,signalController);
    item.messages.push({ id:randomUUID(),role:'user',text,at },message);
    this.emit({ type:'ai-messages',id,messages:item.messages });
    try {
      const code = sourceCode ?? (await this.store.open(id)).code;
      const input = [...history,{ role:'user',content:chatPrompt(item.title,code,text,context) }];
      const response = await this.request(baseURL,'/responses',signal,{ model,stream:true,store:false,instructions:tutorInstructions,input });
      const finalText = await streamAnswer(response.body,delta => {
        message.text += delta;
        this.emit({ type:'ai-message',id,message });
      });
      if (!message.text) message.text = finalText || '応答がありませんでした。もう一度お試しください。';
    } catch (error) {
      if (signalController.signal.aborted) {
        message.text += '\n\n（応答を停止しました）';
        return;
      }
      const failure = signal.reason?.name === 'TimeoutError' ? new Error('OpenAI APIの応答がタイムアウトしました。') : error;
      message.text = message.text ? `${message.text}\n\nエラー: ${failure.message}` : failure.message;
      throw failure;
    } finally {
      this.chats.delete(id);
      message.pending = false;
      this.emit({ type:'ai-message',id,message });
    }
  }

  async explainDiagnostics(report, model, _effort, baseURL) {
    modelId(model);
    const { sourceLines,input,schema } = diagnosticRequest(report);
    const signal = AbortSignal.any([this.lifetime.signal,AbortSignal.timeout(messageTimeout)]);
    try {
      const result = await this.request(baseURL,'/responses',signal,{
        model,store:false,instructions:diagnosticInstructions,input,
        text:{ format:{ type:'json_schema',name:'ghci_diagnostics',strict:true,schema } }
      });
      const response = await result.json();
      if (response.status !== 'completed') throw new Error('OpenAI APIのエラー解析が完了しませんでした。');
      const text = outputText(response);
      if (!text) throw new Error('OpenAI APIからエラーの説明を取得できませんでした。');
      return parseExplanation(text,report,sourceLines);
    } catch (error) {
      if (signal.reason?.name === 'TimeoutError') throw new Error('OpenAI APIのエラー解析がタイムアウトしました。');
      throw error;
    }
  }

  interrupt(id) {
    const controller = this.chats.get(id);
    controller?.abort();
    return Boolean(controller);
  }

  close() { this.lifetime.abort(); }
}

module.exports = { OpenAI };
