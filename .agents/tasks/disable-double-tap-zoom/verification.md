# 検証記録（ダブルタップ拡大の抑止）

実行ディレクトリ: `c:\ミチシル開発\michishiru_app\frontend`

| コマンド | 結果 |
|---|---|
| `npm run lint` | エラーなし |
| `npm run build` | 成功（チャンクサイズの警告のみ。既存） |
| `npx vitest --run` | 24ファイル / 210テスト すべて成功（新規 `src/assets/styles/__tests__/global.test.js` 7件を含む） |
| `dist` のCSS確認 | 共通ルール `:where(button,a,label,summary,select,input,textarea,[role=button]):not(.maplibregl-canvas-container *){touch-action:manipulation}` がビルド後も残っている。`.toast` / `.next-spot-banner` / `.review-toggles` / `.review-form` / `.bottom-actions` / `.popup` にも出力されている |

## 変更内容
- `global.css`: 共通ルール（理由コメント付き）、`.popup` / `.bottom-actions` に1行
- `BaseToast.vue` `.toast` / `RouteNextSpotBanner.vue` `.next-spot-banner` / `RouteNavigationView.vue` `.review-toggles` / `ReviewPostForm.vue` `.review-form` に1行
- テスト追加: `frontend/src/assets/styles/__tests__/global.test.js`
- `index.html` の viewport、地図、`.content` / `.screen` / `body`、既存の `touch-action: none` は未変更

## 限界
jsdom ではダブルタップ拡大の実動作は確認できない。テストは宣言の有無と範囲のみを検証する。

## 実機確認項目（iPhone Safari / Android Chrome）
- 口コミ切り替えボタンをダブルタップしても画面が拡大しない
- 次の目的地へ／前の目的地／終了ボタン、終了確認モーダルのボタンのダブルタップで拡大しない
- トースト・終了ボタン付近のピンチは従来どおり拡大する（仕様。アクセシビリティのため）
- 地図のダブルタップ拡大とピンチ、パン、長押しは従来どおり。ズーム／現在地ボタンの連打で画面が拡大しない
- 写真の全画面表示の左右スワイプと、口コミフォームのハンドルの上下スワイプが動く
- ホーム画面の距離スライダーが従来どおり動く
- 既知の範囲外: 見出し・本文など操作部品でない領域のダブルタップでは拡大が残る可能性がある
