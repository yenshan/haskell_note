import { useEffect, useRef, useState } from 'react';
import { Compartment, EditorState } from '@codemirror/state';
import { EditorView, lineNumbers } from '@codemirror/view';
import { haskellLanguage } from './haskellLanguage';
import { defaultEditorTheme, editorAppearance, editorThemes } from './editorThemes';
import { defaultFontSettings, editorTypography, fonts, type FontSettings as Settings } from './fonts';

const sample = '-- Haskellで、小さな発見を。\nmodule Practice where\n\ngreet :: String -> String\ngreet name = "Hello, " ++ name\n\nsquares :: [Int]\nsquares = map (^2) $ filter (>3) [1..10]\n\n-- 合字: -> => <- >>= >=> <$> <*> /= ==';

export function FontSettings({ settings,theme,onChange,onThemeChange }:{ settings:Settings; theme:string; onChange:(settings:Settings)=>void; onThemeChange:(theme:string)=>void }) {
  const host = useRef<HTMLDivElement>(null); const view = useRef<EditorView|null>(null);
  const typography = useRef(new Compartment()); const initial = useRef(settings);
  const appearance = useRef(new Compartment()); const initialTheme = useRef(theme);
  const [sizeInput,setSizeInput] = useState(String(settings.size));
  useEffect(() => setSizeInput(String(settings.size)),[settings.size]);
  const selected = fonts.find(font => font.id === settings.font) || fonts[0];
  const selectedTheme = editorThemes.find(option => option.id === theme) || editorThemes[0];
  useEffect(() => {
    if (!host.current) return;
    const editor = new EditorView({ parent:host.current,state:EditorState.create({ doc:sample,extensions:[
      EditorState.readOnly.of(true),EditorView.editable.of(false),lineNumbers(),
      haskellLanguage,appearance.current.of(editorAppearance(initialTheme.current)),
      EditorView.theme({ '&':{ height:'100%' },'.cm-content':{ padding:'16px 0' },'.cm-line':{ padding:'0 18px 0 12px' },'.cm-gutterElement':{ padding:'0 8px' } }),
      typography.current.of(editorTypography(initial.current))
    ] }) });
    view.current = editor;
    return () => { editor.destroy(); view.current = null; };
  },[]);
  useEffect(() => {
    view.current?.dispatch({ effects:appearance.current.reconfigure(editorAppearance(theme)) });
  },[theme]);
  useEffect(() => {
    const editor = view.current; if (!editor) return;
    editor.dispatch({ effects:typography.current.reconfigure(editorTypography(settings)) });
    let disposed = false;
    document.fonts.ready.then(() => { if (!disposed) editor.requestMeasure(); });
    return () => { disposed = true; };
  },[settings]);
  return <section className="settings-section" aria-labelledby="font-settings-title">
    <h3 id="font-settings-title">フォント・配色設定</h3>
    <div className="settings-fields"><label>配色テーマ<select value={theme} onChange={event => onThemeChange(event.target.value)}>{editorThemes.map(option => <option key={option.id} value={option.id}>{option.name}</option>)}</select></label></div>
    <div className="theme-swatches" aria-hidden="true">{[selectedTheme.palette.keyword,selectedTheme.palette.builtin,selectedTheme.palette.type,selectedTheme.palette.string,selectedTheme.palette.number,selectedTheme.palette.operator].map((color,index) => <span key={index} style={{ backgroundColor:color }}/>)}</div>
    <p className="theme-description">{selectedTheme.description}</p>
    <div className="settings-fields font-settings-controls">
      <label className="font-family-field">フォント<select value={settings.font} onChange={e => onChange({ ...settings,font:e.target.value })}>{fonts.map(font => <option value={font.id} key={font.id}>{font.name}</option>)}</select></label>
      <label>文字サイズ<span className="font-size-control"><input aria-label="文字サイズ" type="number" min={10} max={28} step={1} value={sizeInput} onChange={e => {
        setSizeInput(e.target.value);
        const value = e.target.valueAsNumber;
        if (Number.isInteger(value) && value >= 10 && value <= 28) onChange({ ...settings,size:value });
      }} onBlur={() => {
        const value = sizeInput.trim() ? Number(sizeInput) : settings.size;
        const size = Number.isFinite(value) ? Math.round(Math.max(10,Math.min(28,value))) : settings.size;
        setSizeInput(String(size)); onChange({ ...settings,size });
      }}/><span>px</span></span></label>
      <label>行間<select value={settings.lineHeight} onChange={e => onChange({ ...settings,lineHeight:Number(e.target.value) })}>{[1.2,1.4,1.6,1.85,2,2.2].map(value => <option value={value} key={value}>{value} 倍</option>)}</select></label>
    </div>
    <p className="font-description">{selected.description}</p>
    <label className="font-ligatures"><input type="checkbox" checked={settings.ligatures} onChange={e => onChange({ ...settings,ligatures:e.target.checked })}/><span>合字を使う<small><code>-&gt;</code> や <code>=&gt;</code> などを、つながった記号で表示します。</small></span></label>
    <div className="font-preview-heading">プレビュー</div>
    <div ref={host} className="font-preview" aria-label="Haskellフォントプレビュー"/>
    <button className="secondary-button font-settings-reset" onClick={() => { onChange({ ...defaultFontSettings }); onThemeChange(defaultEditorTheme); }}>標準に戻す</button>
  </section>;
}
