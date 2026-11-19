# Macアプリのビルド詳細

ビルド方法は[README](../README.md#macアプリのビルド)を参照してください。

生成先は `release/HaskellNote-darwin-arm64/HaskellNote.app`（Apple Silicon）または `release/HaskellNote-darwin-x64/HaskellNote.app`（Intel）です。実行中のNode.jsと同じアーキテクチャで生成し、再実行すると同じ生成先を置き換えます。別のディレクトリから絶対パスで実行することもできます。

アプリアイコンは `assets/HaskellNote.png` です。ビルド時にmacOS標準の `sips` と `iconutil` で各サイズを含む `assets/HaskellNote.icns` を生成し、アプリへ組み込みます。編集用のベクター原稿は `assets/HaskellNote.svg`、デザインと再生成手順は [assets/icon-prompt.md](../assets/icon-prompt.md) に保存しています。

`HaskellNote.app` をアプリケーションフォルダーへコピーすると、FinderやDockから起動できます。起動時のNode.js・npmは不要ですが、GHC/GHCi・Codex CLIは別途インストールしておいてください。Finder起動時も `~/.ghcup/bin`、`~/.local/bin`、`/opt/homebrew/bin`、`/usr/local/bin` を検索します。

練習ファイルや `.runtime/` はアプリへ同梱しません。アプリ版の設定と初期ワークスペースは `~/Library/Application Support/Kata/` に保存します（旧名Kataの保存先を継続して使用）。新規インストールの場合は、初回起動後に「フォルダー設定」で既存の `.hs` フォルダーを選択してください。このスクリプトはローカル利用向けで、Developer ID署名・公証は行いません。

