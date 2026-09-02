---
inclusion: always
---

# 命名規則 — ミチシル（ルート作成地図アプリ）

## 基本方針

- 英語で命名する（ローマ字禁止）
- 略語は最小限にし、意味が伝わる名前をつける
- 新しいドメイン用語を使う場合は `naming-glossary.md` に追記してから使用する
- ツールやフレームワークが名前を固定している場合は、そちらに従う（「例外一覧」を参照）

---

## 変数・関数

| 規則 | camelCase |
|---|---|
| 例 | `routeName`, `getRouteById`, `isLoading`, `currentLatitude` |

## 定数

| 規則 | UPPER_SNAKE_CASE |
|---|---|
| 例 | `MAX_WAYPOINTS`, `DEFAULT_ZOOM_LEVEL`, `API_BASE_URL` |

## クラス・コンストラクタ

| 規則 | PascalCase |
|---|---|
| 例 | `RouteService`, `MapController`, `WaypointModel` |

## Vueコンポーネント

| 規則 | PascalCase（ファイル名・タグ名とも） |
|---|---|
| 例 | `RouteMap.vue`, `WaypointList.vue`, `SearchBar.vue` |

### コンポーネント命名ルール

- 2語以上にする（HTMLタグとの衝突を防ぐ）
- 汎用コンポーネントは `Base` プレフィックス（例: `BaseButton.vue`, `BaseModal.vue`）
- ページ単位は `〇〇View.vue`（例: `RouteConditionView.vue`, `WalkResultView.vue`）
- レイアウトは `〇〇Layout.vue`（例: `DefaultLayout.vue`）
- `App` プレフィックスは使用しない（`App.vue` と混同するため）

名前から置き場所が一意に決まるようにする。

| 名前の形 | 置き場所 |
|---|---|
| `Base〇〇.vue` | `components/base/` |
| `〇〇Layout.vue` | `components/layout/` |
| `〇〇View.vue` | `views/` |
| 上記以外 | `components/feature/<機能名>/` |

## Composable（Composition API）

| 規則 | camelCase + `use` プレフィックス |
|---|---|
| 例 | `useRouteCreation.js`, `useMap.js`, `useGeolocation.js` |

## Piniaストア

| 対象 | 規則 | 例 |
|---|---|---|
| ファイル名 | camelCase + `Store` 接尾辞 | `routeStore.js` |
| エクスポートする関数 | `use` + PascalCase + `Store` | `useRouteStore` |
| `defineStore` の第1引数（ID） | 対象を表す単数形の小文字 | `defineStore('route', ...)` |

## Vue Router のルート名

| 規則 | kebab-case |
|---|---|
| 例 | `route-condition`, `route-suggestion`, `walk-result` |

- 画面遷移は `router.push({ name: 'walk-result' })` のように**名前で指定**する（パスを直書きしない）
- パスを変更してもコードを直さずに済むため

## ファイル名

| 対象 | 規則 | 例 |
|---|---|---|
| Vueコンポーネント | PascalCase | `RouteMap.vue`, `RouteConditionView.vue` |
| JS/TSモジュール | camelCase | `routeService.js`, `localApiServer.js` |
| Composable | camelCase + use | `useRouteCreation.js` |
| 定数ファイル | camelCase | `constants.js`, `routeConditions.js` |
| テストファイル | 対象名 + `.test` | `service.test.js`, `iac.test.ts` |
| IaC（`iac/`）のモジュール | kebab-case | `michishiru-stack.ts`, `oidc-stack.ts` |
| GitHub Actions のワークフロー | kebab-case + `.yml` | `ci.yml`, `deploy.yml` |

### テストファイルについて

拡張子の直前は `.test` で統一する。`.spec` は使用しない。

理由: テスト実行ツールはファイル名を目印に対象を探すため、目印が2種類あると片方が実行されない。実行されなくてもエラーにならないため、テストが動いていないことに気付けない。

現在の設定は以下のとおりで、いずれも `.test` を前提としている。

| 場所 | ツール | 対象パターン |
|---|---|---|
| `backend/` | Node.js 標準テストランナー | `functions/**/__tests__/**/*.test.js` |
| `iac/` | Jest | `**/*.test.ts` |

## CSS / クラス名

| 対象 | 規則 | 例 |
|---|---|---|
| 通常のクラス | kebab-case | `route-card`, `waypoint-marker`, `map-container` |
| 状態を表すクラス | `is-` プレフィックス + kebab-case | `is-selected`, `is-active`, `is-disabled` |

- 状態クラスは単体で使わず、必ず対象クラスと併用する（例: `class="select-btn is-selected"`）
- コンポーネント固有のスタイルは `<style scoped>` に書く。全画面共通のものだけ `assets/styles/global.css` に置く

## API関連

| 対象 | 規則 | 例 |
|---|---|---|
| URLパス | kebab-case（複数形） | `/api/v1/routes`, `/api/v1/waypoints` |
| クエリパラメータ | camelCase | `?purpose=refresh&genre=nature&distance=3` |
| リクエスト/レスポンスのキー | camelCase | `{ "routeName": "散歩コース", "spotCount": 5 }` |

- URLには必ずバージョン（`/v1/`）を含める
- パスは複数形にする（`/routes`、`/route` ではない）

## Lambda関数名

| 対象 | 規則 | 例 |
|---|---|---|
| 論理名（コード上・フォルダ名） | camelCase（動詞 + 名詞） | `getRoute`, `createRoute`, `deleteSpot` |
| CDKの論理ID | PascalCase + `Function` | `GetRouteFunction` |
| AWS上の物理名 | **指定しない**（CDKの自動生成に任せる） | - |

物理名を固定しない理由は `iac-rules.md` の「物理名を指定するリソース／しないリソース」を参照。

## エラーコード

| 規則 | UPPER_SNAKE_CASE。`<対象>_<状態>` の形 |
|---|---|
| 例 | `ROUTE_NOT_FOUND`, `VALIDATION_ERROR`, `DATA_SOURCE_ERROR` |

- 定義場所は `backend/shared/constants/errorCodes.js` に集約する
- 外部サービス固有のエラーは、この一覧のいずれかに変換してから上位へ渡す

## イベント名（emit）

| 規則 | camelCase（動詞形） |
|---|---|
| 例 | `selectPurpose`, `selectGenre`, `changeZoom`, `confirmEnd` |

- `on` プレフィックスはつけない

## props / emit の大文字小文字（重要）

Vue の仕様上、**同じ名前を2通りの書き方で書く必要がある**。片方に統一しようとすると動かないため、下表のとおり書き分ける。

| 場所 | 書き方 | 例 |
|---|---|---|
| `defineProps` の宣言 | camelCase | `waypointCount: { type: Number, required: true }` |
| 親から渡すときの属性 | kebab-case | `:waypoint-count="waypointCount"` |
| `defineEmits` の宣言 | camelCase | `defineEmits(['selectPurpose'])` |
| `$emit()` の呼び出し | camelCase | `$emit('selectPurpose', value)` |
| 親で受け取るときの属性 | kebab-case | `@select-purpose="handleSelect"` |

覚え方: **JavaScript の中は camelCase、HTMLとして書く場所は kebab-case。**

## Boolean変数

| 規則 | `is` / `has` / `can` / `should` プレフィックス |
|---|---|
| 例 | `isLoading`, `hasRoute`, `canEdit`, `shouldRefresh` |

## 単位を持つ値

単位が曖昧になる値は、**名前の末尾に単位を付ける**。

| 対象 | 規則 | 例 |
|---|---|---|
| 距離 | `〇〇Km` / `〇〇M` | `distanceKm`, `DEFAULT_DISTANCE_KM` |
| 時間 | `〇〇Ms` / `〇〇Minutes` | `loadingDurationMs`, `WALKING_MINUTES_PER_KM` |

例外: API のリクエスト/レスポンスのキーは `distance`（km固定）とする。外部仕様として単位を固定し、`docs/設計書.md` に明記する。

---

## リポジトリ全体の構成

本リポジトリはモノレポ構成。直下のディレクトリは役割ごとに固定し、新しいディレクトリを勝手に追加しない。

```
michishiru_app/
├── .github/workflows/   # CI/CD のワークフロー
├── .kiro/steering/      # 開発規約（本ファイル群）
├── backend/             # Lambda関数（Node.js）
├── docs/                # 仕様書・設計書
├── frontend/            # Vue 3 SPA
├── iac/                 # AWS CDK（TypeScript）
├── tools/               # 開発補助スクリプト（リポジトリ横断）
└── package.json         # モノレポのルート
```

### `tools/` の使い分け

| 場所 | 用途 | 例 |
|---|---|---|
| `tools/`（ルート） | 複数の領域にまたがる開発補助 | `dev.js`（フロント＋API同時起動）, `localApiServer.js` |
| `backend/tools/` | バックエンド専用のスクリプト | `seed.js`（DynamoDBへの初期データ投入） |

判断基準: `frontend/` と `backend/` の両方に触れるならルートの `tools/`、片方だけならその領域の `tools/`。

### package.json の配置

| 場所 | `name` | 役割 |
|---|---|---|
| ルート | `michishiru-app` | モノレポ全体の開発コマンド |
| `frontend/` | `frontend` | フロントの依存とビルド |
| `backend/` | `backend` | Lambdaの依存とテスト |
| `backend/functions/<論理名>/` | 論理名の kebab-case（`get-route`） | 関数ごとの依存関係の記録 |
| `iac/` | `iac` | CDKの依存 |

`backend/functions/getRoute/` のフォルダ名は camelCase だが、`package.json` の `name` は `get-route` になる。npm がパッケージ名に大文字を許可しないため。

---

## npm スクリプト名

| 規則 | kebab-case。サブコマンドは `:` で区切る |
|---|---|
| 例 | `dev`, `dev:web`, `dev:api`, `lint`, `lint:fix`, `build`, `test`, `seed` |

### 変更してはいけないスクリプト名

`.github/workflows/ci.yml` と `deploy.yml` が以下の名前を直接呼んでいる。名前を変えると CI が壊れる。

| 場所 | スクリプト |
|---|---|
| `frontend/` | `lint`, `build` |
| `backend/` | `test` |
| `iac/` | `build`, `test` |

---

## GitHub Actions

| 対象 | 規則 | 例 |
|---|---|---|
| ワークフローのファイル名 | kebab-case + `.yml` | `ci.yml`, `deploy.yml` |
| ワークフローの `name` | 用途を表す短い英語（先頭大文字） | `CI`, `Deploy` |
| ジョブID | 対象領域を表す小文字 | `frontend`, `backend`, `iac`, `deploy` |
| ジョブの `name` | 小文字 + 括弧で内容 | `frontend (build & lint)` |
| ステップの `name` | 日本語で内容を書く | `dist を成果物として保存` |
| GitHub Secrets | UPPER_SNAKE_CASE | `AWS_DEPLOY_ROLE_ARN` |
| ワークフロー内の環境変数 | UPPER_SNAKE_CASE | `AWS_REGION` |
| `concurrency.group` | `<用途>-${{ github.ref }}` | `ci-${{ github.ref }}`, `deploy-${{ github.ref }}` |

ステップ名は日本語で統一する。既存ファイルに英語のステップ名（`Determine stage`, `Build frontend` 等）が残っているが、次に触るときに日本語へ揃える。

---

## TypeScript（`iac/`）

TypeScript を使うのは `iac/` のみ。型・インターフェース・CDKの論理IDの命名は `iac-rules.md` を参照。

---

## 例外一覧

ツールやフレームワークが名前を固定しているため、上記ルールを適用しないもの。**レビューで指摘不要。**

| 対象 | 適用しないルール | 理由 |
|---|---|---|
| `src/App.vue` | コンポーネント名は2語以上 | Vue がルートコンポーネント名として固定している |
| `export const handler` | 関数名は動詞 + 名詞 | AWS Lambda が `handler` という名前で呼び出す |
| `iac/` 配下のファイル名 | JS/TSモジュールは camelCase | AWS CDK の慣例が kebab-case。自動生成されるファイルもこの形になる |
| `__tests__/` / `test/` | ディレクトリ名の規則 | それぞれ Node.js / Jest（CDK）の慣例 |
| `package.json` の `name`（ルート） | ローマ字禁止 | `michishiru-app`。アプリ名は固有名詞のため許容する |
| `package.json` の `name`（各領域） | 英語で命名する | ワークスペース名（`backend`, `frontend`, `iac`）として使用 |
| `iac/` のリソース名に含む `michishiru` | ローマ字禁止 | AWSリソース名にプロジェクト名を含めるため許容する（例: `michishiru-api-dev`） |
| `bin/iac.ts` | JS/TSモジュールは camelCase | CDK が生成するエントリーポイント |
| Lambda関数の `package.json` の `name` | 論理名は camelCase | npm がパッケージ名に大文字を許可しない（`getRoute` → `get-route`） |

---

## まとめ表

| 対象 | 規則 | 例 |
|---|---|---|
| 変数・関数 | camelCase | `routeName`, `getRoute` |
| 定数 | UPPER_SNAKE_CASE | `MAX_WAYPOINTS` |
| クラス | PascalCase | `RouteService` |
| Vueコンポーネント | PascalCase | `RouteMap.vue` |
| Composable | camelCase + use | `useRouteCreation.js` |
| Piniaストア | camelCase + Store | `routeStore.js` / `useRouteStore` |
| Vue Router のルート名 | kebab-case | `walk-result` |
| テストファイル | 対象名 + `.test` | `service.test.js` |
| IaCのモジュール | kebab-case | `michishiru-stack.ts` |
| CSSクラス | kebab-case | `route-card` |
| CSS状態クラス | `is-` + kebab-case | `is-selected` |
| APIパス | kebab-case（複数形・バージョン付き） | `/api/v1/routes` |
| クエリパラメータ | camelCase | `?genre=nature` |
| JSONキー | camelCase | `routeName` |
| 環境変数 | UPPER_SNAKE_CASE | `ROUTE_TABLE_NAME` |
| エラーコード | UPPER_SNAKE_CASE（`対象_状態`） | `ROUTE_NOT_FOUND` |
| Boolean | is/has/can/should + camelCase | `isVisible` |
| Lambda関数（論理名） | camelCase（動詞+名詞） | `getRoute` |
| イベント名（emit） | camelCase（動詞形） | `selectGenre` |
| 単位を持つ値 | 末尾に単位 | `distanceKm` |
| npmスクリプト | kebab-case（`:` でサブコマンド） | `dev:api`, `lint:fix` |
| GitHub Actions のワークフロー | kebab-case + `.yml` | `ci.yml` |
| GitHub Secrets | UPPER_SNAKE_CASE | `AWS_DEPLOY_ROLE_ARN` |
| CDKの論理ID | PascalCase | `RouteTable` |
| CDKのスタック名 | `Michishiru-<環境>` | `Michishiru-dev` |
| DynamoDBテーブル | PascalCase単数形 + `-<環境>` | `Route-dev` |

---

## 未決定事項（チーム判断待ち）

実装を進めるうえで決めが必要な項目。決まり次第、本ファイルまたは該当ファイルへ追記する。

### 最優先（DynamoDBのデプロイ前に決着させる）

| # | 項目 | 内容 | 期限の理由 |
|---|---|---|---|
| 1 | `category` → `genre` への統一 | 規約は `genre`、コード・IaC・設計書は `category`。DynamoDBの属性名とGSI名（`GSI-CategoryDistance`）に到達している | GSI名と属性名はデプロイ後の変更にGSI再作成とデータ移行が必要。**未デプロイの今なら無償で直せる** |
| 2 | `waypoint` → `spot` への統一 | 規約は `spot`（立ち寄り先）と `waypoint`（経路の座標点）を分離。コードは `waypoint` のみ | 同上。APIレスポンスのキーにも影響する |

いずれもフロント・バックエンド両担当の合意が必要（APIのパラメータ名とレスポンスのキーが変わる）。

### 最優先（決まらないと作業が止まる）

| # | 項目 | 何が決まっていないか | 影響 |
|---|---|---|---|
| 3 | 課題番号 `NZ-X` の採番 | 番号の出どころ（課題管理ツール・採番担当）が未定義 | ブランチ名とコミットメッセージに使う。現在は採番なしのブランチ・コミットが混在している |
| 4 | フロントエンドのテストツール | `frontend/` にテストツール・テストが存在しない | `git-workflow.md` の「PR前提条件」を満たせない。候補は Vitest（Vite と同系列のため設定が最小） |

### 次に決めたい

| # | 項目 | 何が決まっていないか |
|---|---|---|
| 5 | `develop` 向けPRのCI | `ci.yml` は `main` 向けPRでのみ実行される。`develop` 向けにも走らせるか |
| 6 | ディレクトリ名の規則 | 2026年9月の見直しで kebab-case 指定を削除した。ルールなしのままにするか、後日あらためて定めるか |

### 解決済み（実装により確定）

| 項目 | 決定内容 | 確定日 |
|---|---|---|
| AWS上のLambda物理名 | 指定しない（CDKの自動生成に任せる）。`iac-rules.md` 参照 | 2026/09/02 |
| テストの配置 | `backend/` は `__tests__/`、`iac/` は `test/`。各エコシステムの標準に合わせ統一しない | 2026/09/02 |
| ドキュメントの日本語ファイル名 | `docs/` 配下は日本語名を許容。コード・設定ファイルは英語のみ | 2026/09/02 |
| DynamoDBテーブル名の環境識別子 | 後置（`Route-dev`）。`back-data-access.md` 参照 | 2026/09/02 |

---

## 更新履歴

| 日付 | 内容 |
|---|---|
| - | 初版作成 |
| 2026/09/02 | 矛盾の解消と不足の追加。テストファイル名を `.test` に統一 / `App` プレフィックスを廃止 / ディレクトリ名の kebab-case 指定を削除 / IaC のファイル名を kebab-case に / 例外一覧を追加 / Piniaストア・Vue Routerのルート名・エラーコード・CSS状態クラス・props と emit の大文字小文字・単位の規則を追加 |
| 2026/09/02 | `main` マージで入った CI/CD・IaC・モノレポ構成に対応。リポジトリ全体の構成 / `tools/` の使い分け / package.json の配置 / npmスクリプト名 / GitHub Actions の命名を追加 / Lambda物理名を「指定しない」に確定 / 例外一覧に `michishiru-app` ・`bin/iac.ts` を追加 / 未決定事項を再整理し4件を解決済みへ移動 / AWSリソース命名は `iac-rules.md` に分離 |
