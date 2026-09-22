# tldraw.svg エディタ

tldraw で編集したホワイトボードを、`*.tldraw.svg` という単一ファイルで保存・再編集するブラウザアプリです。

ファイルは通常の SVG ビューアで画像として開けます。このアプリで開くと、テキスト、付箋、図形、グループ、矢印の接続を保ったまま編集できます。

編集データの正本は SVG の `metadata` に埋め込んだ JSON です。保存のたびに、同じ JSON から表示用 SVG を生成します。

## 起動方法

必要環境: Node.js 22 以上。

```bash
npm install
npm run dev
```

ブラウザで `http://localhost:5173` を開きます。localhost は secure context なので、対応ブラウザでは File System Access API による上書き保存が使えます。

```bash
npm run typecheck
npm run build
npm test
npx playwright install chromium firefox
npm run test:e2e
```

## ライセンス

このアプリは [tldraw SDK 5.4.2](https://www.npmjs.com/package/tldraw) を使います。SDK は source-available で、**本番利用には tldraw のライセンスキーが必要**です。開発（localhost）ではキーなしで動作します。

SDK 内部のライセンス判定は変更していません。キーは公開情報としてクライアントに渡せます。

```bash
cp .env.example .env
```

`.env` に `VITE_TLDRAW_LICENSE_KEY=` を設定してください。詳細は [tldraw License](https://tldraw.dev/community/license) を参照してください。

フォント・アイコン・翻訳は `@tldraw/assets` から同一オリジンで配信し、既定の CDN には依存しません。

## GitHub Pages

静的サイトとして公開できます。プロジェクトサイトの URL は次の形です。

`https://<user>.github.io/tldraw-svg/`

1. GitHub の Settings → Pages → Build and deployment → Source を **GitHub Actions** にする
2. 触れるサンプルにするなら、[trial](https://tldraw.dev/community/license) または [hobby](https://tldraw.dev/get-a-license/hobby) のキーを発行する
3. Settings → Secrets and variables → Actions に `VITE_TLDRAW_LICENSE_KEY` を入れる
4. キーの許可ホストに `<user>.github.io` を含める
5. `main` へ push するか、Actions の **Deploy GitHub Pages** を手動実行する

キーなしでもデプロイ自体は成功しますが、HTTPS の公開ドメインでは tldraw が本番判定になり、**数秒後にエディタ描画が止まります**。SDK の判定は無効化していません。localhost の `npm run dev` はキーなしで動きます。

Chrome では、Pages が HTTPS なので File System Access の上書き保存が使えます。Google Drive for Desktop の同期フォルダを選ぶ運用ができます。Firefox はダウンロード保存です。

## ファイル形式

- 実体は UTF-8 の SVG（`image/svg+xml`）
- 保存名は `<名前>.tldraw.svg`
- 判定は拡張子ではなく中身。`.svg` に改名しても、正しい metadata があれば開けます
- 編集データは `metadata#tldraw-document` 内の `urn:tldraw-svg:document:1` 要素に JSON で格納します
- 文書全体（全ページ、図形、接続、アセット、スキーマ）を保存します
- カメラ、選択、Undo 履歴は保存しません

形式の詳細は `docs/tldraw-svg-design.md` を参照してください。

## プレビュー範囲

画像として見えるのは、**保存を開始した時点の現在ページ全体**です。画面内の表示範囲や選択中の図形だけには限定しません。

文書には全ページが含まれますが、通常の SVG ビューアで見えるのは1ページです。画像だけを渡したいときは、メニューの「表示用SVGを書き出す」を使ってください。こちらは編集用 metadata を含めません。

空ページは 800×600 の白い SVG になります。

## ブラウザ差

| 環境 | 保存 |
| --- | --- |
| Chromium 系 + localhost/HTTPS | File System Access API で上書き保存できることがあります |
| Firefox / Safari / API 非対応 | ダウンロードで出力します。「保存しました」ではなく「ダウンロードを開始しました」と表示します |

ダウンロードでは、ブラウザがディスクへ書き切ったことまでは確認できません。未保存保護は維持されます。

## 初版の範囲と制限

扱うもの: 幾何図形、テキスト、付箋、フリーハンド、ハイライト、線、矢印、グループ、フレーム、静止画像（PNG / JPEG / 静止 WebP）、複数ページ。

扱わないもの: 動画、外部 Web 埋め込み、URL ブックマーク、未登録のカスタム図形、任意 SVG の図形化、共同編集。

非対応の内容を含む文書は、対象を示して読み込み・保存を失敗させます。対象外の図形だけを黙って落とすことはしません。

文字を含むページは、一般的な SVG ビューアでの表示互換のため PNG プレビューになることがあります。再読込後の文字は JSON から編集できます。

## サンプル

`examples/` には、完成したアプリから生成した専用ファイルがあります。

- `basic.tldraw.svg` — 図形と接続した矢印
- `japanese-notes.tldraw.svg` — 日本語、付箋、ラベル
- `images-and-pages.tldraw.svg` — 画像と複数ページ
- `empty.tldraw.svg` — 空ページ
- `preview.png` — 代表サンプルの表示確認用

再生成:

```bash
npm run generate:examples
```

## 既知の制限

- Safari 実機での File System Access / 表示確認は、このリポジトリの自動テストでは未実施です
- あらゆる SVG アプリでのピクセル完全一致は保証しません
- 日本語フォントの見た目は OS のフォールバックで変わることがあります
- IndexedDB の復旧はタブ単位です。ファイル handle の自動復旧はしません
- 本番ビルドを公開ドメインで使う場合は、tldraw のライセンスキーが必要です
