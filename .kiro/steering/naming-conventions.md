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
| JS/TSモジュール | camelCase | `routeService.js`, `mapUtils.js` |
| Composable | camelCase + use | `useRouteCreation.js` |
| 定数ファイル | camelCase | `constants.js`, `routeConditions.js` |
| テストファイル | 対象名 + `.test` | `service.test.js`, `michishiru-stack.test.ts` |
| IaC（`iac/`）のモジュール | kebab-case | `michishiru-stack.ts`, `oidc-stack.ts` |

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
| 論理名（コード上・フォルダ名） | camelCase（動詞 + 名詞） | `getRoute`, `createRoute`, `deleteWaypoint` |
| AWS上の物理名 | 未決定（「未決定事項」を参照） | - |

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

## 例外一覧

ツールやフレームワークが名前を固定しているため、上記ルールを適用しないもの。**レビューで指摘不要。**

| 対象 | 適用しないルール | 理由 |
|---|---|---|
| `src/App.vue` | コンポーネント名は2語以上 | Vue がルートコンポーネント名として固定している |
| `export const handler` | 関数名は動詞 + 名詞 | AWS Lambda が `handler` という名前で呼び出す |
| `iac/` 配下のファイル名 | JS/TSモジュールは camelCase | AWS CDK の慣例が kebab-case。自動生成されるファイルもこの形になる |
| `__tests__/` | ディレクトリ名の規則 | Node.js / Jest の慣例 |
| `package.json` の `name` | 英語で命名する | ワークスペース名（`backend`, `frontend`, `iac`）として使用 |

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

---

## 未決定事項（チーム判断待ち）

実装を進めるうえで決めが必要な項目。決まり次第、本ファイルまたは該当ファイルへ追記する。

### 最優先（決まらないと作業が止まる）

| # | 項目 | 何が決まっていないか | 影響 |
|---|---|---|---|
| 1 | 課題番号 `NZ-X` の採番 | 番号の出どころ（課題管理ツール・採番担当）が未定義 | ブランチ名 `feature/NZ-X` とコミットメッセージに必須。決まらないとブランチが切れない |
| 2 | フロントエンドのテストツール | `frontend/` にテストツール・テストが存在しない | `git-workflow.md` の「PR前提条件」を満たせない。候補は Vitest（Vite と同系列のため設定が最小） |

### 次に決めたい

| # | 項目 | 何が決まっていないか |
|---|---|---|
| 3 | AWS上のLambda物理名 | 環境プレフィックスの形（例: `dev-michishiru-getRoute`）。デプロイ時に必要 |
| 4 | テストの配置 | `backend/` は `__tests__/`、`iac/` は `test/` で異なる。統一するかどうか |
| 5 | ドキュメントの日本語ファイル名 | `docs/仕様書.md` のような日本語名を許容するか |
| 6 | ディレクトリ名の規則 | 2026年9月の見直しで kebab-case 指定を削除した。ルールなしのままにするか、後日あらためて定めるか |

---

## 更新履歴

| 日付 | 内容 |
|---|---|
| - | 初版作成 |
| 2026/09/02 | 矛盾の解消と不足の追加。テストファイル名を `.test` に統一 / `App` プレフィックスを廃止 / ディレクトリ名の kebab-case 指定を削除 / IaC のファイル名を kebab-case に / 例外一覧を追加 / Piniaストア・Vue Routerのルート名・エラーコード・CSS状態クラス・props と emit の大文字小文字・単位の規則を追加 |
