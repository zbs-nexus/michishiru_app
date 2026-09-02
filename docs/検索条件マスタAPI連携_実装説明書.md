# 検索条件マスタAPI連携 実装説明書

条件選択画面（US-1）の目的・ジャンル・距離を、ハードコードした定数からDB（検索条件マスタAPI）取得へ切り替えた際の判断理由と規約準拠点をまとめる。

---

## 対象API

| 項目 | 内容 |
|---|---|
| エンドポイント | `GET https://152wqulx7l.execute-api.ap-northeast-1.amazonaws.com/dev/` |
| レスポンス | 目的・ジャンル・距離の全項目を1つの配列で返す |
| 種別の判別 | `pk` の値（`PURPOSE#ALL` / `GENRE#ALL` / `DISTANCE#ALL`） |
| CORS | `Access-Control-Allow-Origin: *` が返るためブラウザから直接呼べる |

### APIの項目とアプリ側の対応

| APIの項目 | アプリ側 | 用途 |
|---|---|---|
| `purposeName` | `purposeOptions[].label` | 目的ボタンの文字列 |
| `genreName` | `genreOptions[].label` | ジャンルボタンの文字列 |
| `iconEmoji` | `options[].icon` | 選択肢のアイコン |
| `displayLabel` | `distanceRange.minLabel` / `maxLabel` | 距離スライダーの下限・上限ラベル |
| `distanceKm` | `distanceRange.minKm` / `maxKm` | 処理で使う距離の値（スライダーの範囲） |
| `purposeId` / `genreId` | `options[].value` | 選択値（`refresh`, `nature` 等） |
| `sortOrder` | （並び順に使用） | 表示順の決定 |
| `isActive` | （絞り込みに使用） | 無効な項目を除外 |
| `isDefault` | `distanceRange.defaultKm` | 距離の初期値 |

---

## 実装上の判断理由

- **距離は「選択肢の列挙」ではなく「下限〜上限の範囲」として扱った。** APIが返す距離は2件（1km / 10km）で、`displayLabel` が上限値と下限値を表すという定義のため。`sortOrder` 順の先頭を下限、末尾を上限として組み立てているので、中間の値がマスタへ追加されても取得側のコード変更は不要。
- **`BaseSlider` を「選択肢の配列から選ぶ」方式から「範囲から選ぶ」方式へ変更した。** 従来は `options: [1, 3, 5, 8]` の添字をつまみ位置にしていたため、下限・上限の2件を渡すとつまみが2段階しか動かない。範囲方式にすることで 1〜10km を 1km 刻みで選べる。利用箇所は `RouteConditionForm.vue` のみなので影響範囲は閉じている。
- **目盛りラベルは `scaleLabels`（配列）として受け取る。** `displayLabel` をそのまま並べるだけの責務にしたため、将来中間目盛りが増えてもコンポーネントを変えずに対応できる。
- **マスタが1種別でも欠けている場合はエラー扱いにした。** 目的・ジャンル・距離のいずれかが無いと条件を確定できないため、部分表示より「再読み込み」を促すほうが安全と判断した。
- **選択肢のフォールバックは持たせない。** 定数にハードコードした選択肢を残すと、DBとコードで二重管理になり、値のズレに気付けなくなる。取得失敗時は再読み込みボタンで復帰させる。
- **距離の選択値が取得した範囲外だった場合のみ補正する。** マスタに `isDefault` があればその値、無ければ `DEFAULT_DISTANCE_KM` を範囲内へ丸める。範囲内なら上書きしないため、提案画面から戻ったときにユーザーの選択が消えない。
- **選択肢はPiniaに置かず composable のstateにした。** 参照するのは条件選択画面だけで、画面をまたいで保持する必要がないため（`directory-structure.md` のストア利用条件）。画面を再表示するたびに再取得するが、マスタ1リクエストのため許容した。
- **`fetch` はサービス層に閉じ込め、レスポンスの形の変換もサービス層で行う。** バックエンドのRepositoryが「DB形式↔アプリ形式」の変換を担うのと同じ考え方で、`pk` や `*Id` といったDB由来の構造をこの層より上へ漏らさない。

---

## 規約に準拠したポイント

- **ディレクトリ配置**（`directory-structure.md`）
  - API通信 → `services/conditionService.js`（1ファイル = 1リソース。ルートとは別リソースのため新設）
  - リアクティブなロジック → `composables/useRouteConditionOptions.js`（`use` プレフィックス、戻り値はオブジェクト）
  - データ取得はViewとcomposableのみ。`RouteConditionForm.vue` はpropsを受け取るだけ
- **命名**（`naming-conventions.md`）
  - composableは `use` + camelCase、サービスは camelCase + `Service`
  - 距離は単位付きで `distanceKm` / `minKm` / `maxKm`。ストアの `distance` も `distanceKm` へ変更
  - ただし `getRoute` APIへのクエリキーは `distance` のまま（km固定の外部仕様という例外規定に従う）
  - Booleanは `isLoading` / `isActive` / `hasConditionOptions`
- **props / emit の書き分け**（`component-design.md`）
  - 宣言は camelCase（`distanceKm`, `purposeOptions`, `selectGenre`）
  - テンプレートの属性は kebab-case（`:distance-km`, `:purpose-options`, `@select-genre`）
  - propsは `required` または `default` を必ず指定し、配列の default はファクトリ関数（`() => []`）
- **アクセシビリティ**（`component-design.md`）
  - 読み込み中メッセージに `role="status"`、失敗メッセージに `role="alert"`
  - 選択ボタンに `aria-pressed`、スライダーに `aria-labelledby` / `aria-valuetext`
  - ボタンには `type` を明示
- **JSDoc**：サービス・composableの公開関数に `@description` / `@param` / `@returns` / `@throws` を記載
- **コンポーネントの規模**：`RouteConditionForm.vue` のテンプレートは約60行、propsは6つで分割の目安内

---

## 追加対応: エラー表示とJSON以外の応答の扱い

### `Unexpected token '<', "<!DOCTYPE "... is not valid JSON` の原因

`/api/v1/routes` が **JSONではなくSPAの `index.html` を返している**ため、`response.json()` の解析時に発生していた。

- CDKは `withBackend` が既定 `false` で、その場合 CloudFront に `/api/*` のビヘイビアが作られない（`iac/bin/iac.ts`）
- そのため `/api/v1/routes` はS3へ向かい、403/404 のフォールバック設定で `index.html`（HTTP 200）が返る
- `response.ok` が true になるため従来のエラー判定を通過し、JSON解析で初めて失敗していた
- ルート作成が失敗すると `router.push` に到達しないため、**画面遷移もできない**

### 対応

- `utils/apiResponse.js` の `isJsonResponse` で `content-type` を確認し、JSON以外なら解析前に日本語のメッセージで例外を投げる（`routeService` / `conditionService` の両方）
- これにより原因が読み取れるメッセージ（「ルート作成APIに接続できません」）が出るようになる。**APIが配信されていない事実自体は解消しないため、下記のいずれかが必要**

| 環境 | 対応 |
|---|---|
| ローカル | リポジトリルートで `npm run dev` を実行する（Vite と `tools/localApiServer.js` が同時に起動し、`/api` が3001へプロキシされる）。`frontend/` と `backend/` の `npm ci` が必要 |
| dev/prod | `cdk deploy -c withBackend=true` でバックエンド（API Gateway + Lambda + DynamoDB）を有効化する |

ローカルAPIハーネス経由で `GET /api/v1/routes?purpose=refresh&category=nature&distance=3` が 200 + JSON を返すことを確認済み（テーブル未設定時は `seedRoutes.js` のデータが返る）。

### エラーメッセージの表示方法

- 「目的とジャンルを選択してください」の常時表示と、作成失敗メッセージのボタン上表示を廃止し、**画面上部のポップアップ（`BaseToast.vue`）へ集約**した
- 「ルートを作成」ボタンは未選択でも押せるようにした（押下をきっかけにポップアップを出すため）。押した結果を知らせる方が、押せない理由が分からない状態より原因が伝わる
- 表示は4秒で自動的に消え、閉じるボタンでも消せる。タイマーは `useToastMessage.js` が持ち、画面を離れるときに破棄する
- `role="alert"` / `aria-live="assertive"` を付け、支援技術にも即時に伝える

---

## 用語辞書への追記案（`naming-glossary.md`）

コードで使う前に承認が必要な語。**まだ辞書には追記していない。** 承認後に反映する。

### 検索条件（追記先: 検索条件の表）

| 日本語 | 英語（コード上） | 説明 |
|---|---|---|
| 選択肢 | option | ユーザーが選べる候補の1件（`purposeOptions` / `genreOptions`） |
| 表示ラベル | label | 画面に表示する文字列 |
| 表示ラベル（API） | displayLabel | 検索条件マスタが返す表示用の文字列 |
| 目的名 | purposeName | 検索条件マスタが返す目的の表示名 |
| ジャンル名 | genreName | 検索条件マスタが返すジャンルの表示名 |
| 距離の選択範囲 | distanceRange | 距離の下限・上限・初期値をまとめたもの |
| 下限の距離 | minKm | 選択できる距離の下限（km） |
| 上限の距離 | maxKm | 選択できる距離の上限（km） |
| 既定の距離 | defaultKm | 距離の初期値（km） |
| 有効かどうか | isActive | 選択肢として表示するかどうか |
| 既定値かどうか | isDefault | 初期選択にするかどうか |
| 表示順 | sortOrder | 選択肢を並べる順序 |

### 画面と操作（追記先: 画面と操作の表）

| 日本語 | 英語（コード上） | 説明 |
|---|---|---|
| アイコン | icon | 選択肢に添える絵文字 |
| アイコン（API） | iconEmoji | 検索条件マスタが返す絵文字 |
| 目盛りラベル | scaleLabels | スライダーの目盛りとして表示する文字列 |
| 通知ポップアップ | toast | 画面上部に一定時間表示する通知（`BaseToast`, `useToastMessage`） |

`toast` は「画面中央に表示し操作を待つ確認ポップアップ（`BaseModal`）」とは別物として区別する。前者は自動で消え、操作を止めない。

`icon` と `iconEmoji` を分けているのは、APIの項目名（`iconEmoji`）とアプリ内の項目名（`icon`）が異なるため。アプリ内は既存コードに合わせて `icon` を使う。

---

## 依頼範囲外だが本実装で触れた点

- **`category` → `genre` への統一（`naming-conventions.md` 未決定事項 #1）**
  APIが `genreId` / `genreName` を返すため、フロントエンド側の状態・props・emit を `genre` へ統一した（`routeStore`, `RouteConditionForm`, `RouteConditionView`, `useRouteCreation`）。
  ただし **`getRoute` APIのクエリキーは `category` のまま**。バックエンドの `validator.js` が `category` を必須としているため、`routeService.js` で `genre` → `category` へ変換し、TODOコメントを残した。バックエンド側の統一が済んだ時点で変換を削除する。

## 未対応・申し送り

- **【要対応】`getRoute` API が受け付ける距離と、マスタの距離範囲が一致していない。**
  `backend/functions/getRoute/constants.js` の `ALLOWED_DISTANCES_KM` は `[1, 3, 5, 8]` の列挙で、マスタの範囲（1〜10km）で 2km や 4km を選ぶと `distanceが不正です` で弾かれる。
  バックエンド側を「下限〜上限の範囲チェック」へ変更し、値の出どころをマスタへ揃える必要がある。目的（`ALLOWED_PURPOSES`）とジャンル（`ALLOWED_CATEGORIES`）の値はマスタと一致しているため対応不要。
  ローカルAPIハーネスで確認した実際の応答: `{"code":"VALIDATION_ERROR","message":"distanceが不正です（許可値: 1, 3, 5, 8）"}`
- 選択状態のクラス名が `selected` のままで、規約の `is-selected` に沿っていない（`global.css` の `.select-btn.selected` と対になっているため、CSS側と合わせて別途対応）。
- APIのURLをコードに直書きしている。ステージごとの切り替えと、前提条件書のとおり CloudFront の `/api/*` 配下へ統合する対応が必要（サービス層にTODOを記載）。
- APIのパスが `/`（バージョン・複数形なし）で、`naming-conventions.md` のAPIパス規則（`/api/v1/<複数形>`）と不一致。API側の対応が必要。
- フロントエンドのテストツールが未決定（未決定事項 #4）のため、追加した変換ロジックのテストは未実装。

---

## 更新履歴

| 日付 | 内容 |
|---|---|
| 2026/09/02 | 初版作成 |
