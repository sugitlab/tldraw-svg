# AGENTS

このリポジトリは `docs/tldraw-svg-design.md` に沿った tldraw.svg エディタです。

- 既存の公開 API で保存・読み込みを追加し、SDK 本体への差分は小さく保つ
- SDK 内部のライセンス判定や著作権表示は変更しない
- 編集データの正本は SVG metadata 内の JSON。表示用 SVG は同じ snapshot から生成する
- 通常 SVG の図形化、動画、埋め込み、共同編集は初版の対象外
- テスト文書は採用 SDK から生成する。不完全な手書きレコードを正常系 fixture にしない
