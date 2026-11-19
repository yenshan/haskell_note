# HaskellNote application icon

角ばった λ とノートの3本の横線を、一続きの深緑のマークとして構成。
背景はアイボリーの角丸タイル、タイル外側は透明です。
小さなサイズでも読み取れるよう、文字・細かな装飾は使いません。

- 編集用原稿: `HaskellNote.svg`（1024 × 1024、ベクター）
- Macアイコン用画像: `HaskellNote.png`（1024 × 1024、透過PNG）
- Macアプリ組み込み: `HaskellNote.icns`（16px〜1024px）
- アプリ内ロゴ: `src/App.tsx` の `Logo`（同じパス形状）

SVGの変更後はImageMagickでPNGを再生成します。

```sh
magick -background none -density 288 assets/HaskellNote.svg -resize 1024x1024 -depth 8 PNG32:assets/HaskellNote.png
```

`./build-mac.sh` はPNGからmacOS標準の `sips` / `iconutil` で全サイズのICNSを生成し、`HaskellNote.app` に組み込みます。
