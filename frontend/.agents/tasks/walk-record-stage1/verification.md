
# 検証記録 — 散歩の実績計測（段階1 / フロントエンドのみ）

対象ブランチ: `feature/NZ-230`（コミット・プッシュなし）
実施日: 2026/10/07

## 実行したコマンドと結果

いずれも `c:\ミチシル開発\michishiru_app\frontend` で実行。

| # | コマンド | 結果 |
|---|---|---|
| 1 | `npm run lint` | **成功**（終了コード 0、エラー・警告なし） |
| 2 | `npm run build` | **失敗**（1回目。原因は下記） |
| 3 | `npm install` | 成功（`aws-amplify@6.22.1` ほか 95 パッケージを追加） |
| 4 | `npm run lint` | **成功**（終了コード 0） |
| 5 | `npm run build` | **成功**（終了コード 0、`✓ built in 2.87s`） |

最終状態は lint・build ともにエラーなしで通っている。

### 1回目のビルド失敗について（本変更とは無関係）

```
error during build:
Rolldown failed to resolve import "aws-amplify" from "frontend/src/main.js".
```

`frontend/src/main.js` が `aws-amplify` を import しており（認証基盤の導入時に入ったもの）、
`frontend/package.json` にも `"aws-amplify": "6.22.1"` と宣言されていたが、
作業環境の `node_modules/aws-amplify` が存在しなかった。
依存関係が未インストールだっただけの環境側の問題で、今回の変更に起因するものではない。

対処として `npm install` を実行した。`package.json` は変更しておらず、
`package-lock.json` も差分なし（`git status` で未変更を確認済み）。
宣言済みの固定バージョンをロックファイルどおりに入れただけで、依存の追加・更新はしていない。

### ビルド時の警告（既存のもの）

チャンクサイズが 500kB を超える旨の警告が出るが、本変更の前から出ている既存の警告であり、
`maplibre-gl` と `aws-amplify` の取り込みによるもの。今回の対応範囲外。

## テストについて

フロントエンドはテストツールが未決定（`naming-conventions.md`「未決定事項 #4」）のため、
テストの追加は行っていない。検証は lint とビルドで代替している。

## 変更したファイル

`git status --porcelain` の出力:

```
 M .kiro/steering/naming-glossary.md
 M frontend/src/views/RouteNavigationView.vue
 M frontend/src/views/WalkResultView.vue
?? frontend/.agents/
?? frontend/src/composables/useWalkRecord.js
?? frontend/src/stores/walkStore.js
```

計5ファイル（変更3・新規2）。`frontend/.agents/` は作業用の計画・記録のため未追跡のまま残している。
`backend/` `iac/` `docs/` およびスコープ外に指定された
`useRouteProgress.js` / `useLocationTracking.js` / `geoDistance.js` / `routeStore.js` /
`WalkResultStats.vue` / `global.css` は一切変更していない。

## 手動確認

未実施。ブラウザの位置情報（開発者ツールの Sensors）を使った実機確認は、
`plan.md` の手順6 ①〜⑥ として残っている。
