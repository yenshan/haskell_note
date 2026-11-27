const defaultOpenAIBaseURL = 'https://api.openai.com/v1';
const loopbackHosts = new Set(['localhost','127.0.0.1','[::1]']);

function normalizeOpenAIBaseURL(value = defaultOpenAIBaseURL) {
  const invalid = () => new Error('OpenAI APIのベースURLを入力してください。HTTPS、またはローカル接続用のHTTPを指定できます。');
  if (typeof value !== 'string') throw invalid();
  const input = value.trim();
  if (input.length > 2048 || !/^https?:\/\//i.test(input) || /[\u0000-\u0020\u007f\\?#]/.test(input)) throw invalid();
  let url;
  try { url = new URL(input); }
  catch { throw invalid(); }
  if (url.username || url.password || (url.protocol === 'http:' && !loopbackHosts.has(url.hostname))) throw invalid();
  return url.origin + url.pathname.replace(/\/+$/,'');
}

module.exports = { defaultOpenAIBaseURL, normalizeOpenAIBaseURL };
