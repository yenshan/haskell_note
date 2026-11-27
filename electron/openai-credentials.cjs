const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash, randomUUID } = require('node:crypto');
const { defaultOpenAIBaseURL, normalizeOpenAIBaseURL } = require('./openai-url.cjs');

function openAICredentials(directory, safeStorage, environmentKey = '') {
  const fallback = environmentKey.trim();
  const linux = process.platform === 'linux';

  function destination(baseURL) {
    const url = normalizeOpenAIBaseURL(baseURL);
    if (url === defaultOpenAIBaseURL) return { file:path.join(directory,'openai-key.enc'),environmentKey:fallback,requiresKey:true };
    const keyId = createHash('sha256').update(url).digest('hex');
    return { file:path.join(directory,'openai-key-'+keyId+'.enc'),environmentKey:'',requiresKey:false };
  }

  async function status(baseURL) {
    const { file,environmentKey } = destination(baseURL);
    try { await fs.access(file); return 'saved'; }
    catch (error) { if (error.code !== 'ENOENT') throw new Error('保存したAPIキーを確認できません。'); }
    return environmentKey ? 'environment' : 'missing';
  }

  async function secureStorageAvailable() {
    // Electron's synchronous Linux backend identifies unprotected fallback storage.
    return linux ? safeStorage.isEncryptionAvailable() && !['basic_text','unknown'].includes(safeStorage.getSelectedStorageBackend())
      : safeStorage.isAsyncEncryptionAvailable();
  }

  async function save(value,baseURL) {
    const { file,requiresKey } = destination(baseURL);
    if (typeof value !== 'string' || !/^[!-~]{1,1024}$/.test(value.trim())) throw new Error('有効な形式のAPIキーを入力してください。');
    if (!await secureStorageAvailable()) throw new Error('OSの安全な保存先を利用できません。' + (requiresKey ? 'OPENAI_API_KEY を設定して起動してください。' : ''));
    const temporary = file + '.' + randomUUID();
    try {
      const key = value.trim();
      const encrypted = linux ? safeStorage.encryptString(key) : await safeStorage.encryptStringAsync(key);
      await fs.writeFile(temporary,encrypted,{ mode:0o600,flag:'wx' });
      await fs.rename(temporary,file);
    } catch {
      throw new Error('APIキーを安全に保存できませんでした。');
    } finally {
      await fs.rm(temporary,{ force:true }).catch(() => {});
    }
    return 'saved';
  }

  async function clear(baseURL) {
    const { file,environmentKey } = destination(baseURL);
    try { await fs.rm(file,{ force:true }); }
    catch { throw new Error('保存したAPIキーを削除できませんでした。'); }
    return environmentKey ? 'environment' : 'missing';
  }

  async function get(baseURL) {
    const { file,environmentKey,requiresKey } = destination(baseURL);
    let encrypted;
    try { encrypted = await fs.readFile(file); }
    catch (error) {
      if (error.code !== 'ENOENT') throw new Error('保存したAPIキーを読み込めません。');
      if (environmentKey) return environmentKey;
      if (!requiresKey) return '';
      throw new Error('AI設定でOpenAI APIキーを設定してください。');
    }
    try {
      if (!await secureStorageAvailable()) throw new Error();
      if (linux) return safeStorage.decryptString(encrypted);
      const { result } = await safeStorage.decryptStringAsync(encrypted);
      if (!result) throw new Error();
      return result;
    } catch {
      throw new Error('保存したAPIキーを復号できません。AI設定でキーを保存し直してください。');
    }
  }

  return { status,save,clear,get };
}

module.exports = { openAICredentials };
