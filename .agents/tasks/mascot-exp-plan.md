# 実装計画 — マスコットの経験値レベルアップ（feature/NZ-236）

対象リポジトリ: `c:\Users\hanbai01\Desktop\agventure lab\work\スプリント3\michishiru_app`
ワークツリーは作らず、現在のチェックアウト（`feature/NZ-236`）でそのまま作業する。**コミットもプッシュもしない。**
`frontend/src/assets/styles/global.css` には未コミットの変更（`button, input, select, textarea` と `.maplibregl-map` の `font-family: inherit`）がある。**消さない。**

---

## 0. 設計判断（この計画で決めたこと）

| # | 判断 | 理由 |
|---|---|---|
| 1 | API のパスは `GET /api/v1/experience`（単数） | 規約は「パスは複数形」だが、経験値は不可算で `experiences` は「体験」に読める。合意済みの契約どおり単数にし、例外であることを `michishiru-stack.ts` の経路コメントに書き残す |
| 2 | Lambda の論理名は `getUserExperience` | camelCase の動詞+名詞。`User` を入れて「呼び出し元本人の実績」であることを名前で示す（`getUserReviews` と同じ付け方） |
| 3 | Repository は `repository.js` 1ファイル | 参照先は2テーブルだが、どちらも DynamoDB で SDK もエラーの扱いも同じ。`repositories/` 分割は「外部サービスが複数あり、別SDK・別エラー扱い」の場合の規定のため該当しない |
| 4 | `validator.js` は作らない | このAPIは入力を一切受け取らない（利用者は `claims.sub` から決まる）。入力の無い `getUserReviews` も validator を持たない |
| 5 | 新しいエラーコードは追加しない | `UNAUTHORIZED` / `DATA_SOURCE_ERROR` / `INTERNAL_ERROR` で足りる。`errorCodes.js` は参照のみ（集約先を増やさない） |
| 6 | 口コミ件数は `Select: 'COUNT'` + `LastEvaluatedKey` ループで数える | `GSI-UserReview` を `userId` で引く点は `getUserReviews` と同じ。COUNT は項目本体を返さないため転送量が小さい。1回の応答は走査1MBで切れるため、ページを送って合算する（ページ数には上限を置く） |
| 7 | 経験値の計算はフロントの純関数で行う | API は生の実績値だけを返す（合意済み仕様）。式と係数が1か所（`constants/` + `utils/`）に収まり、テストしやすい |
| 8 | 累計しきい値は必要経験値の表から導出する | 二重定義を避ける。導出結果が合意済みの累計表と一致することをテストで固定する |
| 9 | バーは props 駆動の `MascotExperienceBar.vue` にする | `components/` 配下は現状すべて props 駆動で、ストアを読むコンポーネントは1つも無い。この方針を崩さない |
| 10 | 進捗の5値は `levelProgress` オブジェクト1つで渡す | 個別に渡すと props が7つになり「設計を見直す」しきい値に当たる。バーが必要とする値だけの小さなまとまりなので「大きなオブジェクトを丸ごと渡す」には当たらない |
| 11 | 実績の取得は「ホーム画面のマウント時」と「結果画面の保存直後」の2か所で起こす | ホームは必ず最初に通る画面。結果画面では保存の後に取り直すことで、今終えた散歩の分を含めたレベルが見える |
| 12 | ルート提案画面（`RouteInfoCard.vue`）は変更しない | 合意済みの対象は4画面。提案画面はレベル表示もバーも出しておらず、Lv.2〜10 の画像が無い現状では見た目に差が出ない |
| 13 | `docs/設計書.md` は触らない | API 仕様の節が無く（エンドポイント一覧も持たない）、2026/08/26 時点の資料。指示どおり節が無い場合は作らない |

---

## 1. 追加・変更するファイル一覧（絶対パス）

### 新規

| パス | 役割 |
|---|---|
| `...\backend\functions\getUserExperience\constants.js` | 環境変数（`WALK_RESULT_TABLE_NAME` / `REVIEW_TABLE_NAME`）とキー・索引名・ページ上限の定数 |
| `...\backend\functions\getUserExperience\repository.js` | 累計アイテムの取得と口コミ件数の集計（DynamoDB） |
| `...\backend\functions\getUserExperience\service.js` | 2つの取得を組み合わせ、実績が無ければ0で返す |
| `...\backend\functions\getUserExperience\handler.js` | `claims.sub` で利用者を決め、レスポンスを整形 |
| `...\backend\functions\getUserExperience\package.json` | `"name": "get-user-experience"`。依存の記録 |
| `...\backend\functions\getUserExperience\__tests__\service.test.js` | 実績あり／無し／口コミ0件の分岐 |
| `...\backend\functions\getUserExperience\__tests__\repository.test.js` | 送るコマンドの形（COUNT・キー・ページ送り）と例外の読み替え |
| `...\frontend\src\constants\mascotExperience.js` | 係数3つ・必要経験値の表（唯一の定義）・そこから導出する累計しきい値 |
| `...\frontend\src\utils\mascotLevelProgress.js` | 純関数（実績→経験値、経験値→レベルと進捗） |
| `...\frontend\src\constants\__tests__\mascotExperience.test.js` | 累計しきい値の導出が合意済みの表と一致することの固定 |
| `...\frontend\src\utils\__tests__\mascotLevelProgress.test.js` | 経験値の計算・レベル判定・進捗・上限レベルの検証 |
| `...\frontend\src\services\experienceService.js` | `GET /api/v1/experience` の通信（idToken をヘッダーに載せる） |
| `...\frontend\src\stores\mascotStore.js` | 4画面をまたぐ経験値の状態（`defineStore('mascot', ...)`） |
| `...\frontend\src\components\feature\mascot\MascotExperienceBar.vue` | 経験値バー（props 駆動・表示のみ） |

### 変更

| パス | 変更内容 |
|---|---|
| `...\.kiro\steering\naming-glossary.md` | マスコット節へ用語追記 + 更新履歴1行（2026/10/14） |
| `...\.kiro\steering\ミチシル_前提条件.md` | 「マスコットのレベルの決め方」を確定済みへ移し、残課題を画像未用意だけにする + 更新履歴1行 |
| `...\iac\lib\michishiru-stack.ts` | `GetUserExperienceFunction` の定義、`GET /api/v1/experience` の経路（Cognito 認可必須）、読み取り権限、経路一覧コメントの追記 |
| `...\iac\test\iac.test.ts` | 認可済みメソッド数 9→10、GET/POST の並び、新関数・経路・権限の検証を追加 |
| `...\tools\localApiServer.js` | ハンドラの import とルート1件の追加、必要な環境変数のコメント |
| `...\frontend\src\components\feature\mascot\MascotSpeechBubble.vue` | マスコットの下に差し込む名前付きスロット `experience` を追加（省略時は従来どおり） |
| `...\frontend\src\components\feature\route\RouteLoadingOverlay.vue` | `mascotLevel` prop と `experience` スロットの転送 |
| `...\frontend\src\components\feature\route\RouteNextSpotBanner.vue` | `mascotLevel` prop と `experience` スロット（読み上げの重複を避ける扱い） |
| `...\frontend\src\views\RouteConditionView.vue` | ストアの読み込み（マウント時）、吹き出しとロード画面へレベル・バーを渡す |
| `...\frontend\src\views\RouteSuggestionView.vue` | 再作成時のロード画面へレベル・バーを渡す（ロード画面は同じ部品） |
| `...\frontend\src\views\RouteNavigationView.vue` | 次の目的地バナーへレベル・バーを渡す |
| `...\frontend\src\views\WalkResultView.vue` | 吹き出しへレベル・バーを渡し、保存の直後に実績を取り直す |

---

## 2. 新エンドポイントの仕様

| 項目 | 内容 |
|---|---|
| メソッド・パス | `GET /api/v1/experience` |
| 認可 | API Gateway の Cognito オーソライザー必須。フロントは idToken を `Authorization` ヘッダーに載せる（スキーム接頭辞なし） |
| リクエスト | パラメータ・ボディなし。利用者は `event.requestContext.authorizer.claims.sub` のみで決める（`userId` をリクエストから読まない） |
| 成功応答 | `200` / `{ "cumulativeDistanceM": 12500, "cumulativeMinutes": 210, "reviewCount": 3 }` |
| 実績が無い場合 | `200` / `{ "cumulativeDistanceM": 0, "cumulativeMinutes": 0, "reviewCount": 0 }` |
| 失敗応答 | `401 UNAUTHORIZED`（sub が取れない） / `503 DATA_SOURCE_ERROR`（テーブル未設定・DynamoDB 失敗） / `500 INTERNAL_ERROR` |

経験値そのものは返さない（係数とレベル表はフロントが持つ）。

参照するデータ:

| 値 | 取得元 |
|---|---|
| `cumulativeDistanceM` / `cumulativeMinutes` | `WalkResult-<環境>` の `pk = USER#<sub>` / `sk = TOTAL`（`createWalkResult` が `ADD` で加算している累計アイテム）を `GetItem` |
| `reviewCount` | `Review-<環境>` の `GSI-UserReview` を `userId = <sub>` で `Query`（`Select: 'COUNT'`） |

---

## 3. 経験値の計算式とレベル表（実装する値）

```
totalExperiencePoints =
  floor( reviewCount * EXPERIENCE_PER_REVIEW
       + (cumulativeDistanceM / METERS_PER_KM) * EXPERIENCE_PER_KM
       + cumulativeMinutes * EXPERIENCE_PER_MINUTE )
```

| 定数 | 値 |
|---|---|
| `EXPERIENCE_PER_REVIEW` | 100 |
| `EXPERIENCE_PER_KM` | 100 |
| `EXPERIENCE_PER_MINUTE` | 10 |
| `METERS_PER_KM` | 1000 |

端数が出るのは距離の項だけ。3項を足した**合計**に対して1回だけ切り捨てる（項ごとに丸めない）。

`MASCOT_LEVEL_REQUIREMENTS`（唯一の定義。添字0が Lv.1→2）:

```
[1000, 1300, 1690, 2197, 2856, 3713, 4827, 6275, 8157]
```

`MASCOT_LEVEL_THRESHOLDS`（コード内で足し上げて導出。添字0が Lv.1）:

```
[0, 1000, 2300, 3990, 6187, 9043, 12756, 17583, 23858, 32015]
```

Lv.10 が上限。Lv.10 では `experienceToNextLevel` を持たず（`null`）、`isMaxLevel` が真、`levelProgressRatio` は 1。0除算を作らない。

---

## 4. 用語辞書に追記する用語（`naming-glossary.md` のマスコット節）

| 日本語 | 英語（コード上） | 説明 |
|---|---|---|
| 経験値 | experiencePoints | 実績から求めるマスコットの成長の度合い |
| 累計経験値 | totalExperiencePoints | 全実績から求めた経験値の合計 |
| 次のレベルまでの必要経験値 | experienceToNextLevel | 現在のレベルから次へ上がるのに要する経験値。Lv.10 では持たない（null） |
| 現在レベル内で獲得した経験値 | experienceInCurrentLevel | 累計経験値から現在レベルの到達しきい値を引いた値 |
| レベル内進捗の割合 | levelProgressRatio | 0〜1。バーの塗りに使う |
| レベルの進捗 | levelProgress | 現在レベル・レベル内の経験値・必要経験値・割合・上限かをまとめたもの |
| レベル到達しきい値 | MASCOT_LEVEL_THRESHOLDS | 各レベルに到達する累計経験値。必要経験値の表から足し上げて導出する |
| 各レベルの必要経験値 | MASCOT_LEVEL_REQUIREMENTS | Lv.1→2 から Lv.9→10 までの9段。経験値表の唯一の定義元 |
| 投稿件数 | reviewCount | 利用者が投稿した口コミの件数（場所に付いた件数の `ratingCount` とは別） |
| 投稿1件あたりの経験値 | EXPERIENCE_PER_REVIEW | 100 |
| 1kmあたりの経験値 | EXPERIENCE_PER_KM | 100 |
| 1分あたりの経験値 | EXPERIENCE_PER_MINUTE | 10 |
| 上限レベルかどうか | isMaxLevel | Lv.10 に達しているか |
| 実績を取得できたかどうか | hasExperience | 取得に失敗した場合は false。バーを出さず Lv.1 で続ける |
| 経験値バー | MascotExperienceBar | レベル内の進捗を示すバー（コンポーネント名） |

`reviewCount` は口コミ節の `ratingCount`（その場所に付いた評価の件数）と混ざりやすいので、説明に差を明記する。

---

## 5. 実装項目

- [ ] 1. `naming-glossary.md` のマスコット節へ、第4章の対応表の用語を追記し、更新履歴に1行（`2026/10/14 | マスコットの経験値レベルアップに伴い experiencePoints / totalExperiencePoints / ... を追加`）を足す。コードより先に辞書を更新する運用ルールに従い、**この項目を最初に行う**。
      Files: `...\.kiro\steering\naming-glossary.md`
      Verify: ドキュメントのみの変更でビルド対象外。第4章の表と1対1で載っていること、および以降の項目で使う識別子が全て表にあることを読み合わせて確認する。

- [ ] 2. `getUserExperience` の実装4ファイルと `package.json` を作る。`constants.js` だけが `process.env` を読む（`WALK_RESULT_TABLE_NAME` / `REVIEW_TABLE_NAME`）。`constants.js` には `GSI_USER_REVIEW = 'GSI-UserReview'`、`TOTAL_SORT_KEY = 'TOTAL'`、`USER_KEY_PREFIX = 'USER#'`、`MAX_REVIEW_COUNT_PAGE_COUNT`（例: 10。無限ループを作らないための上限で、理由をコメントに書く）も置く（`getUserReviews` と同じ置き方）。
      `repository.js`: `DynamoDBDocumentClient` は1度だけ生成。`createWalkResult` / `getUserReviews` と同じ `RETRYABLE_ERROR_NAMES` + 最大3回の指数バックオフ、テーブル未設定なら `createDataSourceError` を投げる（`assertTableConfigured` と同じ考え方。シード値へは落とさない）。公開する関数は2つだけにする。
        - `getWalkTotalsByUserId(userId)`: `GetCommand`（`pk = USER#<sub>` / `sk = TOTAL`）。アイテムが無ければ `null` を返す。ある場合は `{ cumulativeDistanceM, cumulativeMinutes }` を `Number()` でアプリ形式にして返す。
        - `getReviewCountByUserId(userId)`: `QueryCommand`（`IndexName: GSI_USER_REVIEW`、`KeyConditionExpression: '#userId = :userId'`、`Select: 'COUNT'`）。`LastEvaluatedKey` がある限り `ExclusiveStartKey` を渡して `Count` を合算し、ページ数の上限で打ち切る。項目本体を読まないので軽い、という判断をコメントに残す。
      `service.js`: `getUserExperience({ userId }, repository = experienceRepository)`。2つの取得を `Promise.all` で行い、`null`（実績なし）を0に置き換えて `{ cumulativeDistanceM, cumulativeMinutes, reviewCount }` を返す。HTTP には依存しない。
      `handler.js`: `getAuthenticatedUserId(event)` で sub を取り、無ければ `401 UNAUTHORIZED`。成功は `buildSuccessResponse`、失敗は `resolveErrorResponse` + `buildErrorResponse`。`userId` はログに出さない（`getUserReviews` と同じ）。全ての公開関数に JSDoc（`@param` / `@returns` / `@throws`）を付ける。
      Files: `...\backend\functions\getUserExperience\constants.js`, `repository.js`, `service.js`, `handler.js`, `package.json`
      Verify: `cd backend && npm test` — 既存の合格数が減らないこと（この時点で新規テストは未追加）。

- [ ] 3. `getUserExperience` のテストを追加する。`service.test.js` は差し替えたリポジトリで「累計と件数をそのまま返す」「累計アイテムが無ければ0」「口コミ0件」を確認する。`repository.test.js` は `createWalkResult/__tests__/repository.test.js` と同じ要領で `DynamoDBDocumentClient.from` を `mock.method` で差し替え、(a) 累計の `Key` が `USER#<sub>` / `TOTAL`、(b) Query が `GSI-UserReview` と `Select: 'COUNT'` を使う、(c) `LastEvaluatedKey` があるとページを送って `Count` を合算する、(d) スロットリングは再試行し、その他の例外は `DATA_SOURCE_ERROR` になる、を固定する。環境変数は import より先に設定する。
      Files: `...\backend\functions\getUserExperience\__tests__\service.test.js`, `...\__tests__\repository.test.js`
      Verify: `cd backend && npm test` — 新規テストが全て通り、合格数が増える。
      注意（既存の問題）: この環境では `backend/node_modules` に `@aws-sdk/client-s3` 等が無く、`createPhotoUploadUrls` / `createReview` / `getSpot` / `verifyPasswordResetTarget` の4スイートが**変更前から失敗**している（基準値: pass 97 / fail 4）。`cd backend && npm ci` を実行できるなら先に行う。直せない場合でも、失敗が4件から増えていなければこの項目は合格とする。新しい関数は `@aws-sdk/client-dynamodb` と `@aws-sdk/lib-dynamodb`（どちらもインストール済み）しか使わない。

- [ ] 4. `michishiru-stack.ts` に Lambda と経路を追加する。
      - `GetUserExperienceFunction`（`lambda.Function`、`handler: 'functions/getUserExperience/handler.handler'`、`code: backendCode`、`memorySize: 256`、`timeout: 10秒`、環境変数は `WALK_RESULT_TABLE_NAME` と `REVIEW_TABLE_NAME`）。DynamoDB クライアントはランタイム同梱なのでバンドルしない（`getUserReviews` と同じ）。物理名は指定しない。
      - 権限は最小限にする。`walkResultTable.grant(fn, 'dynamodb:GetItem')` と `reviewTable.grant(fn, 'dynamodb:Query')`（`grant` は索引の ARN も含むため GSI を引ける）。`grantReadData` は使わない（Scan まで付く）。
      - 経路は `v1Resource.addResource('experience')` に `GET` を追加し、`cognitoAuthorized` を渡す。パスが単数である理由（第0章 #1）をコメントに書く。
      - ファイル冒頭の API Gateway の経路一覧コメントへ `GET /api/v1/experience  マスコットの経験値のもとになる実績の取得（要認証）` を追記する。
      Files: `...\iac\lib\michishiru-stack.ts`
      Verify: `cd iac && npm run build`（tsc が通る）。

- [ ] 5. `iac.test.ts` を更新する。
      - 「ログイン後に呼ぶ9つのメソッド」を10に変え、`HttpMethod` の並びを `['GET','GET','GET','GET','GET','GET','POST','POST','POST','POST']` にする。テスト名とコメント（経路の列挙）も10件に合わせる。
      - 「未認証のメソッドはログイン前に呼ぶ照合APIだけである」は1件のまま変えない（この検証が付け忘れの検出器なので壊さない）。
      - 追加するテスト: `getUserExperience` の Lambda が `Handler: 'functions/getUserExperience/handler.handler'` と2つの環境変数を持つこと、`AWS::ApiGateway::Resource` に `PathPart: 'experience'` があること、`GetUserExperienceFunctionServiceRoleDefaultPolicy` を論理IDの接頭辞で引いて `dynamodb:GetItem` と `dynamodb:Query` を含み、`dynamodb:PutItem` / `dynamodb:UpdateItem` / `dynamodb:DeleteItem` / `dynamodb:Scan` を含まないこと。
      Files: `...\iac\test\iac.test.ts`
      Verify: `cd iac && npm run build && npm test && npx cdk synth -c withBackend=true` — すべて通ること。`cdk synth` は既存の `NodejsFunction` を esbuild でバンドルするため、先に `cd backend && npm ci` が必要（`.github/workflows/checks.yml` の iac ジョブと同じ順序）。

- [ ] 6. `localApiServer.js` に `GET /api/v1/experience` を足す。`getUserExperience` のハンドラを import（import の並びはアルファベット順を保つ）し、`ROUTE_HANDLERS` に `{ method: 'GET', path: '/api/v1/experience', invoke: getUserExperienceHandler }` を追加する。先頭のコメントに「DynamoDB を読むため、AWS の認証情報と `WALK_RESULT_TABLE_NAME` / `REVIEW_TABLE_NAME` が必要。未設定なら 503 を返し、フロントはバーを出さずに続行する」を1〜2行で足す。
      Files: `...\tools\localApiServer.js`
      Verify: `node --check tools/localApiServer.js`（構文が通る）。ハーネスの起動は、この環境では `createPhotoUploadUrls` が参照する `@aws-sdk/client-s3` 未インストールのため失敗しうる。`backend` で `npm ci` 済みなら `npm run dev:api` を起動し、起動ログに `GET /api/v1/experience` が並ぶことまで確認する。

- [ ] 7. 経験値の定数と純関数を作る。
      - `constants/mascotExperience.js`: `EXPERIENCE_PER_REVIEW` / `EXPERIENCE_PER_KM` / `EXPERIENCE_PER_MINUTE` / `METERS_PER_KM` / `MASCOT_LEVEL_REQUIREMENTS`（9要素）と、そこから `reduce` で足し上げた `MASCOT_LEVEL_THRESHOLDS`（10要素・先頭0）。**累計値は直書きしない**（二重定義を作らない）。他モジュールを import しない（画像も読まない）ので、Vitest を介さず素の node からも読める。
      - `utils/mascotLevelProgress.js`: Vue に依存しない純関数2つ。
        - `toExperiencePoints({ cumulativeDistanceM, cumulativeMinutes, reviewCount })` → 第3章の式。合計に対して `Math.floor` を1回だけ適用し、数値でない入力は0として扱う。
        - `toMascotLevelProgress(totalExperiencePoints)` → `{ mascotLevel, experienceInCurrentLevel, experienceToNextLevel, levelProgressRatio, isMaxLevel }`。しきい値を下から探して現在レベルを決め、Lv.10 では `experienceToNextLevel: null` / `levelProgressRatio: 1` / `isMaxLevel: true` を返す。割合は0〜1にクランプする。`MASCOT_MAX_LEVEL` は `constants/mascotLevels.js` から読む（レベルの上限を二重に持たない）。
      Files: `...\frontend\src\constants\mascotExperience.js`, `...\frontend\src\utils\mascotLevelProgress.js`
      Verify: `cd frontend && npm run lint`（ESLint が通る）。

- [ ] 8. 第3章の数値を固定するテストを置く。
      - `src\constants\__tests__\mascotExperience.test.js`: `MASCOT_LEVEL_THRESHOLDS` が `[0,1000,2300,3990,6187,9043,12756,17583,23858,32015]` と `deepEqual` であること、`MASCOT_LEVEL_REQUIREMENTS` が9要素で合意済みの並びであること、しきい値が単調増加であることを確認する（`describe` / `test` / `expect` は `vitest` から import する）。
      - `src\utils\__tests__\mascotLevelProgress.test.js`: 「投稿3件 + 5,000m + 30分 = 1,100」のような実例、境界（累計 999→Lv.1 / 1,000→Lv.2 / 32,015→Lv.10）、Lv.10 到達後の形（`experienceToNextLevel` が null・割合1・`isMaxLevel` 真）、実績0のとき Lv.1 で割合0。
      Files: `...\frontend\src\constants\__tests__\mascotExperience.test.js`, `...\frontend\src\utils\__tests__\mascotLevelProgress.test.js`
      Verify:（累計しきい値の導出が合意済みの表と一致することの実行確認）`frontend` で次を実行し `ok` が出ること。
      ```
      node --input-type=module -e "import assert from 'node:assert/strict'; const m = await import('./src/constants/mascotExperience.js'); assert.deepEqual(m.MASCOT_LEVEL_THRESHOLDS, [0,1000,2300,3990,6187,9043,12756,17583,23858,32015]); console.log('ok');"
      ```
      `frontend` の `npm test`（Vitest）は**変更前から17スイートが収集できない既存の問題**があり、調査・修復しない。上の node 1行が、この計画で唯一実行可能なしきい値の検証手段。Vitest のテストファイルは規約どおりの場所に置き、環境が直ったときに動くようにしておく。

- [ ] 9. API 通信とストアを作る。
      - `services/experienceService.js`: `fetchUserExperience()`。`fetchIdToken()` → `fetch('/api/v1/experience', { headers: { Authorization: idToken } })`。`response.ok` と `isJsonResponse(response)` を確認して `Error` を投げ、成功時は `{ cumulativeDistanceM, cumulativeMinutes, reviewCount }` を返す（`reviewService.js` の `ensureUsableResponse` と同じ組み立て）。ヘッダー付与の重複についての既存 TODO に合わせ、共通化はしない。
      - `stores/mascotStore.js`: `defineStore('mascot', ...)`。状態は `cumulativeDistanceM` / `cumulativeMinutes` / `reviewCount`（既定0）と `hasExperience`（既定 false）。computed は `totalExperiencePoints`、`levelProgress`、`mascotLevel`（`hasExperience` が false のときは `DEFAULT_MASCOT_LEVEL`）。アクション `loadExperience()` は service を呼び、成功で値と `hasExperience = true`、失敗は **catch して0のまま `hasExperience = false` で続行**する（`useReviewSpots.js` と同じ方針。経験値は副次情報で画面を止めない、という判断をコメントに残す）。`resetExperience()` も用意し、サインアウト時に次の利用者へ前の人の値が残らないようにする（`RouteConditionView` の `handleSignOut` で `routeStore.resetConditions()` の隣に足す）。
      Files: `...\frontend\src\services\experienceService.js`, `...\frontend\src\stores\mascotStore.js`
      Verify: `cd frontend && npm run lint && npm run build` — どちらも通ること。

- [ ] 10. 経験値バーの部品と、差し込み口を作る。
      - `components\feature\mascot\MascotExperienceBar.vue`（props は4つ: `levelProgress`（Object・required）、`totalExperiencePoints`（Number・default 0）、`size`（`'small' | 'medium' | 'large'`・default `'medium'`）、`isDecorative`（Boolean・default false））。
        - 表示: 外枠（`--border-gold`）+ 地（`--bg-deep`）+ 塗り（`--primary-color`、幅は `levelProgressRatio * 100%`）。数値は `experienceInCurrentLevel / experienceToNextLevel` を `toLocaleString('ja-JP')` で3桁区切りにして添える（例 `1,240 / 1,300`）。`isMaxLevel` のときは塗りを満たして `MAX` と表示する（0除算を作らない）。`size === 'small'` では数値を出さずバーだけにする（案内画面のバナーに収めるため）。`large` のときだけ `累計 32,015` を添える。色・書体は `:root` の変数のみを使い、直書きしない。
        - 読み上げ: 既定では `role="progressbar"`、`aria-label="経験値"`、`aria-valuemin="0"`、`aria-valuemax="100"`、`aria-valuenow`（割合を百分率に丸めた値）、`aria-valuetext`（`1,240 / 1,300` または `最大レベル`）。`isDecorative` が真のときは `aria-hidden="true"` にして role と aria 値を付けない（`MascotAvatar` の `isDecorative` と同じ考え方。読み上げ範囲の中に置いても文言が読み直されないようにする）。
        - クラス名は kebab-case、状態は `is-` プレフィックス（`is-max-level` 等）。スタイルは `<style scoped>`。
      - `MascotSpeechBubble.vue`: テンプレートのマスコット側を縦並びの入れ物（`.mascot-side`）で包み、`MascotAvatar` の直下に `<slot name="experience" />` を置く。スロットが空のときの見た目は従来と変わらないこと（既存3か所の呼び出しは無変更で動く）。
      Files: `...\frontend\src\components\feature\mascot\MascotExperienceBar.vue`, `...\frontend\src\components\feature\mascot\MascotSpeechBubble.vue`
      Verify: `cd frontend && npm run lint && npm run build`。`npm run dev` でホーム画面を開き、吹き出しとマスコットの配置が崩れていないことを目視する。

- [ ] 11. ロード画面と案内バナーへ差し込み口を足す。
      - `RouteLoadingOverlay.vue`: props に `mascotLevel`（Number・default `DEFAULT_MASCOT_LEVEL`）を足して `MascotSpeechBubble` の `:level` に渡し、`<template #experience><slot name="experience" /></template>` で親からのバーを転送する。props・スロットのどちらも省略可にして、`DesignPreviewView.vue` の無引数呼び出しをそのまま動かす。
      - `RouteNextSpotBanner.vue`: props に `mascotLevel`（同上）を足して `MascotAvatar` の `:level` に渡し、アバターの直下に `<slot name="experience" />` を置く（小さいアバターの下に収めるため、バーは `size="small"` で渡す前提）。バナー全体が `role="status"` `aria-live="polite"` の中にあるため、**バーは `is-decorative` で渡す**ことを JSDoc コメントに書き残す（距離が変わるたびに経験値が読み直されるのを防ぐ）。
      Files: `...\frontend\src\components\feature\route\RouteLoadingOverlay.vue`, `...\frontend\src\components\feature\route\RouteNextSpotBanner.vue`
      Verify: `cd frontend && npm run lint && npm run build`。

- [ ] 12. 4画面を配線する。いずれも `useMascotStore()` を読み、固定の `DEFAULT_MASCOT_LEVEL` 表示をやめて実績から求めたレベルにする。**1画面1体**を守り、バーは `mascotStore.hasExperience` が真のときだけ出す（偽のときはバーを出さず Lv.1 のまま＝取得失敗時の方針）。
      - `RouteConditionView.vue`: `onMounted` で `mascotStore.loadExperience()`（`loadConditionOptions()` と同じく画面に入った時点で起こす）。`MascotSpeechBubble` に `:level="mascotStore.mascotLevel"` と `#experience` スロット（`size="medium"`）。`<RouteLoadingOverlay>` にも `:mascot-level` と `#experience`（`size="large"`）を渡す。`handleSignOut` に `mascotStore.resetExperience()` を足す。
      - `RouteSuggestionView.vue`: 再作成時に出る `<RouteLoadingOverlay>` へ同じ2つを渡す（ロード画面の見え方をホーム経由と揃える）。提案カード（`RouteInfoCard`）は変更しない。
      - `RouteNavigationView.vue`: `RouteNextSpotBanner` に `:mascot-level="mascotStore.mascotLevel"` と `#experience`（`size="small"` + `is-decorative`）を渡す。
      - `WalkResultView.vue`: `MascotSpeechBubble` に `:level` と `#experience`（`size="large"`）。既存の `onMounted` で `saveCurrentWalkResult()` の **後に** `mascotStore.loadExperience()` を呼び、今終えた散歩の分を含めたレベルが見えるようにする（保存の成否に関わらず呼ぶ。失敗時は退避されるため値は変わらないが、取り直しても害はない）。
      - 画像は Lv.1 の1枚しか無く、`getMascotLevel()` が用意済みの最高レベルの姿で代替する。**画像を新規作成しない**（SVG の加工も不可）。レベル番号・名前・バーだけが変わる。`mascotLevels.js` の構造（`mascotImage: null` を差し替えるだけで有効になる設計）は変えない。
      Files: `...\frontend\src\views\RouteConditionView.vue`, `...\frontend\src\views\RouteSuggestionView.vue`, `...\frontend\src\views\RouteNavigationView.vue`, `...\frontend\src\views\WalkResultView.vue`
      Verify: `cd frontend && npm run lint && npm run build` が通ること。`npm run dev`（API を起動できる環境なら `npm run dev` でフロント＋API）で、ホーム → ロード → 案内 → 結果の4画面にマスコットが1体ずつ出て、バーの有無が `hasExperience` と一致することを目視する。API を叩けない環境では、バーが出ず Lv.1 のまま画面が動作することを確認する（これが失敗時の期待挙動）。

- [ ] 13. `ミチシル_前提条件.md` を更新する。
      - 「今後追加予定の要素」から「マスコットのレベルの決め方」の行を削除し、「確定した要素」へ `マスコットのレベルの決め方 | 実績から経験値を算出してレベルを決める。経験値 = 投稿件数×100 + 距離km×100 + 時間分×10（合計を切り捨て）。Lv.1→2 が1000で以降1.3倍の等比（1000/1300/1690/2197/2856/3713/4827/6275/8157）、Lv.10 が上限。実績は GET /api/v1/experience が生の値（累計距離m・累計時間分・投稿件数）で返し、経験値とレベルの計算はフロント（constants/mascotExperience.js + utils/mascotLevelProgress.js）が行う。累計経験値とレベル内の進捗はマスコットの下のバーに出す | 2026/10/14` を追記する。
      - 残課題として「今後追加予定の要素」へ `マスコットのLv.2〜10の画像 | レベルごとに姿を変える | 未対応。画像が1枚（Lv.1）しかなく、getMascotLevel() が用意済みの最高レベルの姿で代替している。frontend/src/constants/mascotLevels.js の mascotImage の null を差し替えるだけで有効になる` を1行だけ残す（しきい値と実績の保存先はもう未定ではないため、その記述は消す）。
      - 更新履歴に1行（2026/10/14）。
      - API Gateway 行の「3メソッド」や AWS Lambda 行の関数一覧は既に実装と合っていないが、**今回の変更範囲ではないので直さない**（別途まとめて直す）。
      Files: `...\.kiro\steering\ミチシル_前提条件.md`
      Verify: ドキュメントのみの変更。記載した式・しきい値・エンドポイントが第2章・第3章および実装コードと一致していることを読み合わせて確認する。

---

## 6. 最終確認（全項目の完了後に通す）

| 場所 | コマンド | 期待 |
|---|---|---|
| `backend` | `npm ci`（可能なら） → `npm test` | 新規テストが通る。失敗は既存の4件（`@aws-sdk/client-s3` 等の未インストール由来）から増えていない。`npm ci` が通った場合は全件合格 |
| `iac` | `npm run build` | tsc が通る |
| `iac` | `npm test` | 認可済み10メソッド・未認可1メソッド・新関数の権限を含め全件合格 |
| `iac` | `npx cdk synth -c withBackend=true` | 合成が通る（事前に `backend` で `npm ci` が必要） |
| `frontend` | `npm run lint` | エラー0 |
| `frontend` | `npm run build` | ビルド成功 |
| `frontend` | 第8項の `node --input-type=module -e ...` | `ok` が出る（累計しきい値の導出が合意済みの表と一致） |
| リポジトリ全体 | `git status` | `frontend/src/assets/styles/global.css` の未コミット変更が残っている。コミットもプッシュもしていない |

`frontend` の `npm test`（Vitest）は変更前から17スイート全滅の既存問題のため、合否の判断に使わない（調査・修復もしない）。
