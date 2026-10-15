# 実装計画 — 段階3b: 散歩実績のDB保存（ユーザー単位）

対象リポジトリ: `c:\ミチシル開発\michishiru_app`（Windows / PowerShell）
作業ブランチ: `feature/NZ-176` のまま。worktree を作らない。`git commit` / `git push` はしない。

段階3b のゴールは、散歩が終わった時点の実績を Cognito の `sub` 単位で DynamoDB へ保存すること。履歴取得API（GET）・履歴画面・削除機能は作らない。保存（POST）のみ。累計は単調増加でよい。

あわせて段階3a のレビューで確認された検知漏れ2件（低精度の測位が続く区間 / 断続的な不調）に対処する。

## 検証の基準値（変更前に実測）

| 場所 | コマンド | 現状 |
|---|---|---|
| `backend/` | `npm test` | 8 suites / 56 tests pass |
| `frontend/` | `npm test` | 11 files / 99 tests pass |
| `iac/` | `npm test` | 1 suite / 16 tests pass |

この3つを下回らせない。各FEATの検証はこの数値との比較で行う。

---

## 設計判断（実装前に確定。実装者が選び直さない）

### 判断1: 保存の成否で画面遷移を止めない方式

**結論: 保存は `WalkResultView.vue` の `onMounted` で起動する。`RouteNavigationView.vue` には保存処理を置かない。成否は `useWalkResultSave` のローカル状態（`ref`）で持ち、同じ画面の `useToastMessage` でトーストに出す。`walkStore` には保存状態を足さない。**

理由:

- 案内画面で保存を起動すると、`router.push` の直後に案内画面が破棄され、`composable` のローカル状態（保存の成否）が結果画面から読めなくなる。読めるようにするには `walkStore` に保存状態を足す必要があり、画面をまたいで読む必要のない値をグローバルへ出すことになる。
- 結果画面の `onMounted` で起動すれば、保存の起点と結果の表示先が同じコンポーネントに収まる。遷移は `endWalk()` → `push` だけなので保存を一切待たない（判断の目的＝遷移を止めないを満たす）。
- `walkStore` の状態は結果画面が描画される時点で確定している（`endWalk()` は遷移前に呼ばれる）。`handleReturnHome` の `resetWalk()` より前に `onMounted` でペイロードを組み立てて控えるため、リセットと競合しない。
- 二重保存は起きない。結果画面は遷移ごとに1回マウントされ、再読み込みではルーターガード（`meta.requiresRoute` + `routeStore.hasRoute`）が条件入力画面へ戻すため再マウントされない。万一重なっても `walkId` の冪等性（`attribute_not_exists(pk)`）で累計は増えない。

### 判断2: 再送の実装場所と起動タイミング

**結論: `App.vue` に置く。`useWalkResultSave()` の `flushPendingWalkResults()` を、(a) `watch(() => authStore.isSignedIn, ...)` に `{ immediate: true }` を付けて true になった時点、(b) `window.addEventListener('online', ...)` の2つの引き金で呼ぶ。多重起動は composable のモジュールスコープ変数（`let isFlushing = false`）で防ぐ。**

理由:

- `main.js` では Pinia のストアを安全に読めない。`createApp(App).use(createPinia())` の前にストアを触ることになり、初期化順の前提に依存する。`App.vue` の `setup` はストアを使える最上位の場所。
- `router/index.js` の `beforeEach` が `restoreSession()` を待ってから `isSignedIn` を立てる。`onMounted` の1回きりでは、再読み込み直後に `isSignedIn` がまだ false で取りこぼす。`watch` + `immediate: true` なら「すでにログイン済み」と「これからログインする」の両方を1つの記述で拾える。
- 退避は「通信できなかった」ことが原因なので、復帰の合図（`online`）も引き金に加える。`isFlushing` はインスタンスをまたいで効く必要があるため `ref` ではなくモジュール変数にする。
- 再送はユーザーに見せない（トーストを出さない）。結果画面を離れた後の静かな処理で、成功しても失敗しても利用者の操作は変わらないため。

### 判断3: 段階3a 検知漏れ(b) 断続的不調の累積保持先

**結論: `RouteNavigationView.vue` のローカル変数（`let accumulatedGapMs = 0`）に累積する。`walkStore` に `measurementGapMs` は足さない。したがって用語辞書への追記も不要。**

理由:

- 累積値そのものを他画面が読む必要はない。結果画面が必要とするのは「欠落があったか」の1ビットで、それは既存の `hasMeasurementGap` が表している。しきい値を超えた時点で既存の `walkStore.markMeasurementGap()` を呼べばよい。
- ストアに足すと、状態の追加・`startWalk` / `resetWalk` での初期化・`walkStore.test.js` の追従・用語辞書の追記が連鎖するのに、観測できる出力は1ビットも変わらない。
- 検知漏れ(a)（低精度の測位が続く区間）も同じ累積器に載せる。`trackingError !== null`（測位が届かない）と `accuracy > MAX_MEASURABLE_ACCURACY_M`（届くが距離にならない）を1つの computed `isMeasurementInterrupted` にまとめ、その真偽の継続時間を累積する。検知口を2系統持たず1系統にできる。

### 判断4: `UNAUTHORIZED` の追加

**結論: `backend/shared/constants/errorCodes.js` に `UNAUTHORIZED: 'UNAUTHORIZED'` と `ERROR_STATUS_CODES` の 401 マッピングを追加する。`errorHandler.js` にはファクトリを追加しない。**

理由:

- `createWalkResult` の handler は `event.requestContext.authorizer.claims.sub` が取れない場合に `buildErrorResponse(401, ERROR_CODES.UNAUTHORIZED, ...)` を直接返す。Service より手前（受付時点）で分かる失敗で、throw して `resolveErrorResponse` に通す必要がないため、`createUnauthorizedError` は作らない。
- マッピングだけ足しておけば、将来 Service 層から `ApplicationError('UNAUTHORIZED', ...)` を投げても 401 に解決される。
- API Gateway のオーソライザーが手前で弾くため通常は到達しない。それでも実装するのは、リクエストボディの `userId` を代わりに信用する余地を残さないため（ボディの `userId` は**読まない**）。

### 判断5: 条件エラー（既に保存済み）の扱いをどこで成功に変えるか

**結論: Repository は「同じ `walkId` が既にある」という事実を `{ isStored: false }` で返す。それを「成功（HTTP 200）」と解釈するのは Service。**

理由: DynamoDB の例外名（`ConditionalCheckFailedException` / `TransactionCanceledException` の `CancellationReasons[].Code === 'ConditionalCheckFailed'`）を知っているのは Repository の責務。それが業務上エラーではないと決めるのは Service の責務（`back-layer-architecture.md`）。専用の `ApplicationError` を投げる案は、`errorCodes.js` に該当コードがなく、Handler 側で再解釈が必要になるため採らない。既存テストと同じ「Service にリポジトリを引数で差し替える」形でテストできる。

### 判断6: 保存失敗の再試行可否を Service 層（フロントの service）で名前付けする

**結論: `walkResultService.js` は失敗時に `error.name` を `'WalkResultSaveRetryable'`（通信失敗 / 5xx / 429）か `'WalkResultSaveRejected'`（それ以外の 4xx）に設定して throw する。`fetchIdToken` の `NoValidSession` は再試行可として扱う。**

理由: 退避キューに積むかどうかの判断材料が必要。400（入力不正）を積むと永久に送り続ける。判断は composable が行い、`name` の付与（HTTPの知識）は service が持つ。

---

## 保存するデータ設計（決定済み・変更しない）

物理テーブル1つに2種類のアイテムを入れる単一テーブル設計。テーブル名 `WalkResult-<環境>`。

| 種別 | pk | sk |
|---|---|---|
| ① 各散歩の実績 | `USER#<sub>` | `WALK#<endedAt>#<walkId>` |
| ② ユーザーの累計 | `USER#<sub>` | `TOTAL` |

①の属性: `walkId` / `userId` / `totalDistanceM`（整数） / `spotCount` / `elapsedMinutes` / `startedAt` / `endedAt` / `measurementStatus` / `routeTitle` / `genreId` / `createdAt`
②の属性: `walkCount` / `cumulativeDistanceM` / `cumulativeSpotCount` / `cumulativeMinutes` / `updatedAt`

- ①と②は `TransactWriteItems` で1回にまとめる。Put は `ConditionExpression: attribute_not_exists(pk)`、Update は `ADD walkCount :one, cumulativeDistanceM :distanceM, cumulativeSpotCount :spotCount, cumulativeMinutes :minutes SET updatedAt = :now`。`ADD` はサーバー側加算なので②の事前作成は不要。
- `measurementStatus === 'unavailable'` の散歩は①だけ保存し②を加算しない（信頼できない数値で累計を汚さないため）。この場合は単純な `PutItem` 1回。`partial` は②に加算する。分岐の理由をコードのコメントに明記する。
- 冪等性: `walkId`（UUID v4）はフロントで生成して送る。Lambda 側で生成してはいけない。再送時は同じ `walkId` が送られ、トランザクション全体が条件エラーで止まるため累計も増えない。
- `createRoute` は生成ルートを DynamoDB に保存しないため `routeId` からは復元できない。`routeTitle` と `genreId` をスナップショットとして①に持たせる。
- 「その散歩の合計」は `total〇〇`、「全散歩の合計」は `cumulative〇〇` と言い分ける。

---

## 実装手順

### FEAT-001: 用語辞書とインフラ（IaC）

- [ ] 1. 用語辞書に用語を追記する（コードより先に辞書、が運用ルール）。
      `### 画面と操作` の表の末尾（`isScreenAwake` の行の直後）に6行追記する。
      `| 散歩のID | walkId | 1回の散歩を一意に識別する値（UUID v4）。フロントで生成して送り、再送時も同じ値を使う |`
      `| 散歩の回数 | walkCount | 保存した散歩の件数。累計レコードが持つ |`
      `| 累計の距離 | cumulativeDistanceM | 全散歩の距離の合計（メートル）。1回分の totalDistanceM とは別概念 |`
      `| 累計のスポット数 | cumulativeSpotCount | 全散歩で巡ったスポット数の合計 |`
      `| 累計の時間 | cumulativeMinutes | 全散歩の経過時間の合計（分） |`
      `| 保存待ちの実績 | pendingWalkResults | 保存に失敗して端末のブラウザストレージへ退避した実績の一覧 |`
      末尾の更新履歴表の**最終行の後ろ**に1行追記する。
      `| 2026/10/07 | 実績のDB保存に伴い walkId / walkCount / cumulativeDistanceM / cumulativeSpotCount / cumulativeMinutes / pendingWalkResults を追加 |`
      注意: 既存行を1行も消さない。表の列構成（`| 日本語 | 英語（コード上） | 説明 |`）を崩さない。
      Files: `.kiro/steering/naming-glossary.md`
      Verify: `git diff --stat .kiro/steering/naming-glossary.md` が追加7行・削除0行であること。

- [ ] 2. `iac/lib/michishiru-stack.ts` に実績テーブル・Lambda・APIの経路を追加する。
      すべて既存の `if (withBackend) { ... }` ブロックの中に置く。
      (a) `routeTable` の定義の直後に実績テーブルを追加する。
      ```ts
      const walkResultTable = new dynamodb.TableV2(this, 'WalkResultTable', {
        tableName: `WalkResult-${stage}`,
        partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
        sortKey: { name: 'sk', type: dynamodb.AttributeType.STRING },
        billing: dynamodb.Billing.onDemand(),
        removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY
      });
      ```
      コメントで「1つのテーブルに各散歩の実績（`WALK#<endedAt>#<walkId>`）とユーザーの累計（`TOTAL`）の2種類を入れる単一テーブル設計」「履歴取得APIを作らないため GSI は持たない。pk でユーザーを絞り sk の前方一致で引ける」ことを書く。
      (b) `getConditionsFn` の定義の直後に Lambda を追加する。DynamoDB のクライアントは Lambda ランタイム同梱なのでバンドルせず、既存の `backendCode` をそのまま使う（`getRoute` / `getConditions` と同じ形）。
      ```ts
      const createWalkResultFn = new lambda.Function(this, 'CreateWalkResultFunction', {
        runtime: lambda.Runtime.NODEJS_LATEST,
        handler: 'functions/createWalkResult/handler.handler',
        code: backendCode,
        memorySize: 256,
        timeout: cdk.Duration.seconds(10),
        environment: { WALK_RESULT_TABLE_NAME: walkResultTable.tableName }
      });

      walkResultTable.grantWriteData(createWalkResultFn);
      ```
      `grantWriteData` のみを与える理由（この関数は書き込みしかせず、読み取りを許すと最小権限から外れる）をコメントに書く。
      (c) `conditionsResource` の定義の直後に API の経路を追加する。認可は既存の `cognitoAuthorized` を必ず渡す。
      ```ts
      const walkResultsResource = v1Resource.addResource('walk-results');
      walkResultsResource.addMethod(
        'POST',
        new apigateway.LambdaIntegration(createWalkResultFn),
        cognitoAuthorized
      );
      ```
      コメントで「ログイン後にしか呼ばないため認可必須。Lambda は `event.requestContext.authorizer.claims.sub` で利用者を識別し、ボディの `userId` は読まない」ことを書く。
      (d) `api` の定義の上にあるエンドポイント一覧のコメントに `POST /api/v1/walk-results  散歩の実績を保存` の1行を追加する。
      (e) `RouteTableName` の `CfnOutput` の直後に出力を追加する。
      ```ts
      new cdk.CfnOutput(this, 'WalkResultTableName', {
        value: walkResultTable.tableName,
        description: '散歩の実績を格納する DynamoDB テーブル名'
      });
      ```
      変更しないもの: `userPool` / `userPoolClient` / `apiAuthorizer` の定義、CloudFront の `cachePolicy` / `originRequestPolicy`、`routeTable` と既存4関数、既存の論理ID。
      Files: `iac/lib/michishiru-stack.ts`
      Verify: `cd iac; npm run build` が終了コード0（型エラーなし）。

- [ ] 3. `iac/test/iac.test.ts` を更新・追加する。
      (a) 既存テスト『ログイン後に呼ぶ3つのメソッドを Cognito 認可で保護する』を4メソッドへ更新する。テスト名を「ログイン後に呼ぶ4つのメソッドを Cognito 認可で保護する」に変え、`toHaveLength(3)` を `toHaveLength(4)` に、期待する `HttpMethod` の並びを `['GET', 'GET', 'POST', 'POST']` にする。コメントの「routes の GET / POST と conditions の GET」に `walk-results の POST` を足す。
      (b) 既存テスト『未認証のメソッドはログイン前に呼ぶ照合APIだけである』は変更しない（1件のままであることが今回の確認点）。
      (c) 新規テストを `describe('MichishiruStack (バックエンド有効)')` の中に4件追加する。
      - 実績テーブル: `AWS::DynamoDB::GlobalTable` が `TableName: 'WalkResult-prod'` を持ち、`KeySchema` が pk（HASH）・sk（RANGE）であること。`GlobalSecondaryIndexes` を持たないこと（`template.findResources` で引き、該当リソースに `GlobalSecondaryIndexes` が無いことを確認する）。
      - `createWalkResult` の Lambda: `Handler: 'functions/createWalkResult/handler.handler'` と `Environment.Variables.WALK_RESULT_TABLE_NAME` を持つこと。
      - APIの経路: `AWS::ApiGateway::Resource` に `PathPart: 'walk-results'` があること。
      - 権限: `CreateWalkResultFunctionServiceRoleDefaultPolicy` で始まる論理IDのポリシーを引き（既存の createRoute のテストと同じ手法）、JSON に `dynamodb:PutItem` と `dynamodb:UpdateItem` を含み、`dynamodb:Query` と `dynamodb:GetItem` を**含まない**こと。
      Files: `iac/test/iac.test.ts`
      Verify: `cd iac; npm run build; npm test` — 20 tests（既存16 + 新規4）すべてパス。`npx cdk synth Michishiru-dev -c withBackend=true` が成功すること（`backend/node_modules` が必要。未インストールなら `cd backend; npm ci` を先に実行する）。

### FEAT-002: バックエンド（`createWalkResult` Lambda）

- [ ] 4. `errorCodes.js` に `UNAUTHORIZED` を追加する。
      `ERROR_CODES` に `/** 利用者を特定できない */ UNAUTHORIZED: 'UNAUTHORIZED',` を `VALIDATION_ERROR` の直後に追加し、`ERROR_STATUS_CODES` に `[ERROR_CODES.UNAUTHORIZED]: 401,` を同じ位置関係で追加する。既存4コードと既存のマッピングは変更しない。
      Files: `backend/shared/constants/errorCodes.js`
      Verify: `cd backend; npm test` — 既存56件がすべてパス（このファイルを読む既存テストは無いが、回帰を確認する）。

- [ ] 5. `backend/functions/createWalkResult/constants.js` を作る。
      このファイルだけが `process.env` を読む（`back-layer-architecture.md`）。
      ```js
      export const WALK_RESULT_TABLE_NAME = process.env.WALK_RESULT_TABLE_NAME ?? '';
      ```
      併せて入力チェック用の定数を置く: `ROUTE_TITLE_MAX_LENGTH = 120` / `GENRE_ID_MAX_LENGTH = 32` / `MAX_TOTAL_DISTANCE_M = 200000` / `MAX_SPOT_COUNT = 50` / `MAX_ELAPSED_MINUTES = 1440` / `MEASUREMENT_STATUSES = ['complete', 'partial', 'unavailable']`。
      上限値の根拠をコメントに書く（200km / 50スポット / 24時間は徒歩の散歩としてあり得ない値で、誤った巨大値が累計へ入るのを防ぐ）。`MEASUREMENT_STATUSES` はフロントの `MEASUREMENT_STATUS`（`frontend/src/stores/walkStore.js`）と同じ3値であることをコメントで明記する。
      Files: `backend/functions/createWalkResult/constants.js`（新規）
      Verify: 手順10のテストで参照される。単体では `cd backend; npm test` が通ること。

- [ ] 6. `backend/functions/createWalkResult/validator.js` を作る。
      `export const validateCreateWalkResultRequest = (body) => ({ isValid, errorMessages, value })`。副作用なしの純粋関数。`verifyPasswordResetTarget/validator.js` と同じ構造にする。
      検証内容:
      - `walkId`: 必須。UUID v4 の形（`/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`）に一致しない場合はエラー。形を縛る理由をコメントに書く（`sk` の一部になるため、`#` などの区切り文字や任意文字列をキーへ流し込ませない。`back-data-access.md` の「ユーザー入力をそのままキーに使わない」）。
      - `totalDistanceM`: 必須。有限の数値で 0 以上 `MAX_TOTAL_DISTANCE_M` 以下。`value` には `Math.round()` した整数を入れる。
      - `spotCount`: 必須。0 以上 `MAX_SPOT_COUNT` 以下の整数（`Number.isInteger`）。
      - `elapsedMinutes`: 必須。0 以上 `MAX_ELAPSED_MINUTES` 以下の整数。
      - `startedAt` / `endedAt`: 必須。ISO 8601 の文字列で、`Number.isNaN(Date.parse(value))` が false。`endedAt` が `startedAt` より前の場合はエラー（時刻が逆転した実績は保存しない）。
      - `measurementStatus`: 必須。`MEASUREMENT_STATUSES` のいずれか。
      - `routeTitle`: 任意。文字列以外・未指定は `''`。`trim()` した後 `ROUTE_TITLE_MAX_LENGTH` で切り詰める（エラーにしない）。理由をコメントに書く: 表示名の長さで実績の保存を落とさないため。
      - `genreId`: 任意。文字列以外・未指定は `''`。`trim()` し、`GENRE_ID_MAX_LENGTH` 超または半角英数字・ハイフン・アンダースコア以外を含む場合はエラー。
      - `userId` は**検証も採用もしない**。`value` に含めない（利用者の識別は Handler が claims から行う）。その旨をファイル先頭の `@description` に書く。
      Files: `backend/functions/createWalkResult/validator.js`（新規）
      Verify: 手順10のテスト。

- [ ] 7. `backend/functions/createWalkResult/repository.js` を作る。
      `getRoute/repository.js` の形を踏襲する（`DynamoDBDocumentClient` のシングルトン、`sendWithRetry`、`RETRYABLE_ERROR_NAMES`、`createDataSourceError` への変換）。テーブル名は `constants.js` から import し、`process.env` は読まない。
      モジュールローカル定数としてキーの組み立てを置く: `USER_KEY_PREFIX = 'USER#'` / `WALK_KEY_PREFIX = 'WALK#'` / `TOTAL_SORT_KEY = 'TOTAL'` と、`toUserPartitionKey(userId)` / `toWalkSortKey({ endedAt, walkId })` の2つの小さな関数。キーの記法を Repository に閉じる。
      公開する関数は2つ。どちらも `Promise<{ isStored: boolean }>` を返す。`isStored: false` は「同じ `walkId` のアイテムが既にある」という事実のみを表し、それをどう扱うかは Service が決める（JSDoc に明記）。
      - `createWalkResultWithTotals(walkResult)`: `TransactWriteItems` を1回。`Put`（①の全属性 + `pk` / `sk`、`ConditionExpression: 'attribute_not_exists(pk)'`）と `Update`（②、`UpdateExpression: 'ADD walkCount :one, cumulativeDistanceM :distanceM, cumulativeSpotCount :spotCount, cumulativeMinutes :minutes SET updatedAt = :now'`）。`TransactionCanceledException` を捕まえ、`error.CancellationReasons?.some((reason) => reason.Code === 'ConditionalCheckFailed')` が真なら `{ isStored: false }` を返す。それ以外は `createDataSourceError` に変換して throw。
      - `createWalkResultWithoutTotals(walkResult)`: `PutCommand` 1回（同じ `ConditionExpression`）。`ConditionalCheckFailedException` を捕まえて `{ isStored: false }`。
      `WALK_RESULT_TABLE_NAME === ''` の場合は `createDataSourceError('実績テーブルが未設定のため保存できません（環境変数 WALK_RESULT_TABLE_NAME）')` を throw する。`getRoute` のようなシード値へのフォールバックは書かない（書き込みに代替手段はなく、保存できていないのに成功を返すと退避も働かない）。
      注意: `sendWithRetry` のリトライ対象に `TransactionCanceledException` を**入れない**（条件エラーで何度も投げ直すことになる）。`getRoute` と同じ3つ（`ProvisionedThroughputExceededException` / `ThrottlingException` / `RequestLimitExceeded`）のみ。
      Files: `backend/functions/createWalkResult/repository.js`（新規）
      Verify: 手順10のテスト（Service 経由）。Repository 自体の単体テストは書かない（既存の `getRoute` / `verifyPasswordResetTarget` も Service のみをテストしている）。

- [ ] 8. `backend/functions/createWalkResult/service.js` を作る。
      ```js
      const defaultRepositories = { createWalkResultWithTotals, createWalkResultWithoutTotals };
      export const createWalkResult = async (walkResult, repositories = defaultRepositories) => { ... }
      ```
      処理:
      1. `createdAt` を `new Date().toISOString()` で付け、保存するアイテム（`{ ...walkResult, createdAt }`）を組み立てる。
      2. `measurementStatus === 'unavailable'` なら `createWalkResultWithoutTotals` を呼ぶ。それ以外（`complete` / `partial`）は `createWalkResultWithTotals` を呼ぶ。**分岐の理由をコメントで明記する**: 一度も測位できなかった散歩の数値は信頼できないため、記録としては残すが累計には足さない。`partial` は測れた分だけでも実績として意味があるため足す。
      3. `isStored === false` のときは `logInfo('同じwalkIdの実績が既に保存されています', { walkId })` を出し、`{ walkId, isAlreadySaved: true }` を返す（例外にしない）。再送で必ず通る経路であり、エラーとして扱うと利用者に無意味な失敗が見える。
      4. 成功時は `logInfo` を出して `{ walkId, isAlreadySaved: false }` を返す。
      HTTP には依存しない（`event` を参照しない）。Repository の例外は捕まえずそのまま上位へ渡す。
      Files: `backend/functions/createWalkResult/service.js`（新規）
      Verify: 手順10のテスト。

- [ ] 9. `backend/functions/createWalkResult/handler.js` と `package.json` を作る。
      `verifyPasswordResetTarget/handler.js` と同じ構造（`parseRequestBody` のローカル関数を含む）。
      処理の順:
      1. `const userId = event?.requestContext?.authorizer?.claims?.sub ?? null;` 取れなければ `buildErrorResponse(401, ERROR_CODES.UNAUTHORIZED, '利用者を特定できませんでした')`。**ボディの `userId` は読まない**ことをコメントで明記する。
      2. `parseRequestBody` が null なら 400（`VALIDATION_ERROR`、メッセージは既存2関数と同文）。
      3. `validateCreateWalkResultRequest` が不正なら 400（`errorMessages.join(' / ')`）。
      4. `logInfo('散歩の実績の保存リクエストを受け付けました', { walkId, measurementStatus })` を出す。`userId` はログに出さない（個人を辿れる値をログへ残さない）。
      5. `createWalkResult({ ...validationResult.value, userId })` を呼び、`buildSuccessResponse({ walkId, isAlreadySaved })` を返す。
      6. `catch` で `resolveErrorResponse` → `logError` → `buildErrorResponse`。
      `package.json` は `getRoute/package.json` と同じ形で `"name": "create-walk-result"`、`dependencies` は `@aws-sdk/client-dynamodb` と `@aws-sdk/lib-dynamodb`（`backend/package.json` と同じバージョン指定の書き方に合わせる）。
      Files: `backend/functions/createWalkResult/handler.js`（新規）、`backend/functions/createWalkResult/package.json`（新規）
      Verify: `cd backend; npm test` が通ること（Handler の単体テストは既存関数にも無いため書かない）。

- [ ] 10. `createWalkResult` のテストを追加する。
      配置は `backend/functions/createWalkResult/__tests__/`。`node:test` + `node:assert/strict`、既存の `verifyPasswordResetTarget/__tests__/service.test.js` と同じ形（リポジトリを引数で差し替える）。
      `service.test.js`（7件程度）:
      1. `complete` の実績は `createWalkResultWithTotals` を呼び、`createWalkResultWithoutTotals` を呼ばない
      2. `partial` の実績も累計へ加算する経路（`createWalkResultWithTotals`）を通る
      3. `unavailable` の実績は `createWalkResultWithoutTotals` のみを呼ぶ
      4. リポジトリへ渡すアイテムに `createdAt`（ISO 8601）が付与され、`userId` / `walkId` がそのまま含まれる
      5. `isStored: false` のとき `{ walkId, isAlreadySaved: true }` を返し、例外を投げない
      6. 保存できたときは `isAlreadySaved: false` を返す
      7. リポジトリの例外はそのまま上位へ伝わる
      `validator.test.js`（10件程度）: 正常系1件と、`walkId` が UUID v4 でない / `walkId` に `#` を含む / 負の距離 / 上限超えの距離 / `spotCount` が小数 / `measurementStatus` が3値以外 / `endedAt` が ISO 8601 でない / `endedAt` < `startedAt` / `routeTitle` が上限超過でも `isValid` が true かつ `value.routeTitle` が切り詰められる / ボディが null でも例外にならない / `value` に `userId` が含まれない。
      Files: `backend/functions/createWalkResult/__tests__/service.test.js`（新規）、`backend/functions/createWalkResult/__tests__/validator.test.js`（新規）
      Verify: `cd backend; npm test` — 既存56件すべてパス + 新規17件前後がパス（合計73件前後、10 suites）。

- [ ] 11. ローカルAPIハーネスに経路を登録する。
      `tools/localApiServer.js` の import に `import { handler as createWalkResultHandler } from '../backend/functions/createWalkResult/handler.js';` を追加（既存のアルファベット順に合わせ `createRoute` の後）。`ROUTE_HANDLERS` に `{ method: 'POST', path: '/api/v1/walk-results', invoke: createWalkResultHandler }` を追加する（`conditions` の後）。
      `ROUTE_HANDLERS` 上部のコメントに「`createWalkResult` は DynamoDB へ書き込むため、ローカルで実際に保存するには AWS の認証情報と環境変数 `WALK_RESULT_TABLE_NAME`（例: `WalkResult-dev`）が必要。未設定なら 503 を返し、フロントは退避キューへ積む」ことを追記する。
      変更しないもの: `buildEvent` のダミー claims（`sub: 'local-dev-user'`）、ポート、`readRequestBody`。
      Files: `tools/localApiServer.js`
      Verify: `node -e "import('./tools/localApiServer.js')"` ではサーバーが起動し続けるため、代わりに `cd backend; npm test` の通過と、ハーネス起動（`npm run dev:api` 相当。ルートの `package.json` のスクリプト名を確認して使う）でコンソールに5経路が並ぶことを目視確認する。CI では評価されないファイルのため、構文エラーがないことの確認に留めてよい。

### FEAT-003: フロントエンド（保存・退避・再送）と段階3a の検知漏れ対処

- [ ] 12. `frontend/src/utils/pendingWalkResults.js` を作る（Vue に依存しない純粋な保管庫）。
      `localStorage` を使う。ファイル先頭の `@description` に、これが**端末のブラウザ内のストレージ**であること（スマホのアプリ領域ではなく、ブラウザのデータ削除で消える。同一オリジン・同一ブラウザでのみ読める）を日本語で明記する。
      定数: `const STORAGE_KEY = 'michishiru.pendingWalkResults';` / `const MAX_PENDING_COUNT = 20;`（上限の理由＝ストレージを埋め尽くさないため。超過時は古いものから捨てる）。
      公開する関数:
      - `loadPendingWalkResults()`: 配列を返す。キーが無い・JSON として壊れている・配列でない場合は `[]`。`localStorage` 自体が例外を投げる環境（プライベートモード等）でも `[]` を返す。
      - `addPendingWalkResult(walkResult)`: 同じ `walkId` が既にあれば置き換える（二重登録を防ぐ）。上限を超えたら先頭（古い方）から捨てる。保存できなかった場合は何もしない（例外を投げない）。
      - `removePendingWalkResult(walkId)`: 該当を取り除く。
      すべて try/catch で囲み、失敗しても呼び出し側の処理を止めない。理由をコメントに書く（退避は best effort であり、退避できないことを利用者に見せる必要はない）。
      Files: `frontend/src/utils/pendingWalkResults.js`（新規）
      Verify: 手順17のテスト。単体では `cd frontend; npm run lint` が通ること。

- [ ] 13. `frontend/src/services/walkResultService.js` を作る（1ファイル = 1リソース）。
      `conditionService.js` と同じ構造。`API_BASE_PATH = '/api/v1'`、`fetchIdToken()` を毎回呼び、`Authorization` にスキーム接頭辞を付けずに載せる（`Bearer ` を付けない理由のコメントを既存2ファイルと同様に書く）。
      `export const saveWalkResult = async (walkResult) => { ... }`:
      - `POST ${API_BASE_PATH}/walk-results`、ヘッダーは `Content-Type: application/json` と `Authorization`。ボディは受け取った `walkResult` をそのまま `JSON.stringify`（`userId` は含めない。サーバーが claims から決めるため）。
      - `fetch` 自体が reject した場合（通信不能）は `name = 'WalkResultSaveRetryable'` の Error に包んで throw。
      - `!response.ok` の場合: ステータスが 429 または 500 以上なら `WalkResultSaveRetryable`、それ以外（400 / 401 / 403 等）は `WalkResultSaveRejected`。メッセージはレスポンスの `message` を優先し、取れなければ `保存に失敗しました（${status}）`。
      - `isJsonResponse(response)` が false なら `WalkResultSaveRejected`（APIが未配線の環境では SPA の index.html が 200 で返るため）。
      - 成功時は `await response.json()` を返す。
      `fetchIdToken` の例外（`NoValidSession`）は捕まえず上位へそのまま流す。composable 側で再試行可として扱う旨をコメントに書く。
      Files: `frontend/src/services/walkResultService.js`（新規）
      Verify: 手順17のテスト。

- [ ] 14. `frontend/src/composables/useWalkResultSave.js` を作る。
      モジュールスコープに `let isFlushing = false;`（インスタンスをまたいで再送の多重起動を防ぐ。`ref` にしない理由をコメントに書く）と、再試行可否を判定する純粋関数 `const isRetryableError = (error) => error?.name === 'WalkResultSaveRetryable' || error?.name === 'NoValidSession';` を置く。
      `export const useWalkResultSave = () => { ... }`。内部で `useWalkStore()` と `useRouteStore()` を読む。
      公開するもの: `{ isSaving, saveErrorMessage, saveCurrentWalkResult, flushPendingWalkResults }`。
      - `buildCurrentWalkResult()`（composable 内のローカル関数）: `walkStore` と `routeStore` から送信用のオブジェクトを組み立てる。
        `walkId: crypto.randomUUID()` / `totalDistanceM: Math.round(walkStore.totalDistanceM)` / `spotCount: walkStore.spotCount` / `elapsedMinutes: walkStore.elapsedMinutes` / `startedAt: new Date(walkStore.startedAt).toISOString()` / `endedAt: new Date(walkStore.endedAt ?? Date.now()).toISOString()` / `measurementStatus: walkStore.measurementStatus` / `routeTitle: routeStore.currentRoute?.routeName ?? ''` / `genreId: routeStore.genre ?? ''`。
        ストアは epoch ms、APIは ISO 8601 のため、この1か所で変換する（境界を閉じる）ことをコメントに書く。`crypto.randomUUID()` はセキュアコンテキスト（HTTPS / localhost）が前提で、CloudFront が HTTPS を強制しているため満たされることもコメントに書く。
      - `saveCurrentWalkResult()`: `isSaving` を立て、ペイロードを**先に**組み立ててから送る（結果画面が `resetWalk()` される前に値を確定させる）。成功で `true`、失敗で `false` を返す。失敗時は再試行可なら `addPendingWalkResult(payload)` し `saveErrorMessage` に「保存できませんでした。通信が回復したときに自動で保存します」を、再試行不可なら退避せず「保存できませんでした」＋`error.message` を入れる。
      - `flushPendingWalkResults()`: `isFlushing` が真なら即 return。キューを1件ずつ送り、成功したら `removePendingWalkResult`、再試行不可の失敗なら捨てる（永久に残らないようにする）、再試行可の失敗なら break（通信が回復していないため後続も失敗する）。`finally` で `isFlushing = false`。トーストは出さない（判断2の理由をコメントに書く）。
      Files: `frontend/src/composables/useWalkResultSave.js`（新規）
      Verify: 手順17のテスト。`cd frontend; npm run lint` が通ること（未使用の分割代入を残さない）。

- [ ] 15. `WalkResultView.vue` に保存の起動と失敗トーストを追加する。
      (a) import 追加: `onMounted` を `vue` の import に足す（`import { computed, onMounted } from 'vue';`）。`BaseToast`（`BaseButton` の後、アルファベット順）、`useToastMessage`、`useWalkResultSave`。
      (b) `const { message: toastMessage, showMessage, hideMessage } = useToastMessage();` と `const { saveErrorMessage, saveCurrentWalkResult } = useWalkResultSave();`。`isSaving` は画面に出さないため分割代入しない（未使用変数は ESLint エラー）。保存中の表示を出さない理由をコメントに書く: 実績は既に確定していて利用者の操作を待たせる必要がなく、スピナーを出すと失敗したように見える。
      (c) `onMounted(async () => { const isSucceeded = await saveCurrentWalkResult(); if (!isSucceeded) { showMessage(saveErrorMessage.value ?? '実績を保存できませんでした'); } });`
      コメントで判断1の要点を書く（案内画面は保存を待たずに遷移する。保存の起点と結果の表示をこの画面に閉じる）。
      (d) テンプレートの `<DefaultLayout>` の直下、`.result-content` の前に `RouteConditionView.vue` と同じ形でトーストを置く。
      ```
      <BaseToast v-if="toastMessage" :message="toastMessage" @close="hideMessage" />
      ```
      変更しないもの: `measurementNote` の computed と文言、`WalkResultStats` への props 3つ、`handleReturnHome`、`v-if="routeStore.currentRoute"`、`<style>`。
      Files: `frontend/src/views/WalkResultView.vue`
      Verify: `cd frontend; npm run lint`、`npm run build` が通ること。

- [ ] 16. `App.vue` に退避分の再送を組み込み、`RouteNavigationView.vue` の検知漏れ2件に対処する。
      (a) `App.vue`: `<script setup>` に以下を書く。
      ```
      import { onBeforeUnmount, onMounted, watch } from 'vue';
      import { useWalkResultSave } from '@/composables/useWalkResultSave';
      import { useAuthStore } from '@/stores/authStore';
      ```
      `const authStore = useAuthStore();` / `const { flushPendingWalkResults } = useWalkResultSave();`
      `watch(() => authStore.isSignedIn, (isSignedIn) => { if (isSignedIn) { flushPendingWalkResults(); } }, { immediate: true });`
      `const handleOnline = () => { flushPendingWalkResults(); };` を名前付き関数で定義し、`onMounted` で `window.addEventListener('online', handleOnline)`、`onBeforeUnmount` で `removeEventListener` する（同じ参照を渡すため名前付きが必須）。
      判断2の理由（`main.js` ではなく `App.vue`、`immediate: true` が必要な理由、トーストを出さない理由）をコメントに書く。`<template>` は変更しない。
      (b) `RouteNavigationView.vue`: 中断の累積で欠落を判定する形へ変える。
      - import に `import { MAX_MEASURABLE_ACCURACY_M, useWalkRecord } from '@/composables/useWalkRecord';` を使う（手順18で `useWalkRecord.js` から名前付きエクスポートを追加する）。
      - `const isMeasurementInterrupted = computed(() => trackingError.value !== null || (accuracy.value !== null && accuracy.value > MAX_MEASURABLE_ACCURACY_M));` を追加。`accuracy` の条件を入れる理由をコメントに書く: 測位は届いているが精度が悪く `useWalkRecord` が距離を積めない区間は `trackingError` が null のため従来は検知できなかった（段階3aレビューの指摘1）。
      - ローカル変数を追加: `let accumulatedGapMs = 0;` / `let interruptedAt = null;`。
      - `watch(trackingError, ...)` を `watch(isMeasurementInterrupted, (isInterrupted) => { ... })` に置き換える。
        中断に入ったとき: 既に記録済み（`walkStore.hasMeasurementGap`）なら何もしない。`interruptedAt = Date.now()` を控え、残り時間 `MEASUREMENT_GAP_THRESHOLD_MS - accumulatedGapMs` でタイマーを張る（残りが 0 以下なら即 `markMeasurementGap()`）。
        中断から戻ったとき: タイマーを捨て、`accumulatedGapMs += Date.now() - interruptedAt`、`interruptedAt = null`。累積がしきい値以上なら `markMeasurementGap()`。
        累積方式にする理由をコメントに書く: しきい値未満の中断を繰り返す断続的な不調は、復帰のたびにタイマーを捨てる従来の形では永久に検知されなかった（段階3aレビューの指摘2）。
      - `handleVisibilityChange` の復帰側も同じ累積器へ加える。`Date.now() - hiddenAt` を `accumulatedGapMs` に足し、累積がしきい値以上なら `markMeasurementGap()`（従来の「1回の非表示がしきい値以上なら記録」も累積で包含される）。
      - `clearGapTimer()` と `onBeforeUnmount` の後始末は維持する。
      変更しないもの: `handleConfirmEnd`（`endWalk` → `router.push` のまま。保存処理を**追加しない**）、`watch(visitedSpotIds, ...)`、口コミ投稿フォーム関連、Wake Lock の呼び出し、`<template>`、`<style>`。
      Files: `frontend/src/App.vue`、`frontend/src/views/RouteNavigationView.vue`
      Verify: `cd frontend; npm run lint`、`npm run build` が通ること。手順17で既存6件のテストが落ちないことを確認する。

- [ ] 17. フロントエンドのテストを追加・更新する。
      新規3ファイル（`describe` / `test` / `expect` は `vitest` から import する）:
      - `frontend/src/utils/__tests__/pendingWalkResults.test.js`: 積む→読める / 同じ `walkId` は置き換わる（件数が増えない） / `removePendingWalkResult` で消える / 上限20件を超えたら古いものから捨てる / 壊れた JSON が入っていても `[]` を返す / `localStorage.setItem` が例外を投げても `addPendingWalkResult` が例外を投げない。各テストの前に `localStorage.clear()` する。
      - `frontend/src/services/__tests__/walkResultService.test.js`: `routeService.test.js` の `stubFetch` と同じ手法で `fetch` を差し替え、`@/services/authService` をモックする。確認する点＝POST 先が `/api/v1/walk-results` / `Authorization` が接頭辞なしのトークン / `Content-Type` が付く / 500 は `name: 'WalkResultSaveRetryable'` / 400 は `name: 'WalkResultSaveRejected'` / JSON 以外の 200 は `WalkResultSaveRejected` / `fetchIdToken` の `NoValidSession` はそのまま伝わり `fetch` を呼ばない。
      - `frontend/src/composables/__tests__/useWalkResultSave.test.js`: `@/services/walkResultService` をモックし、`setActivePinia(createPinia())` を `beforeEach` で行う。確認する点＝再試行可の失敗で `pendingWalkResults` に1件積まれる / 再試行不可の失敗では積まれない / 成功では積まれない / `flushPendingWalkResults` が成功した件をキューから消す / 再試行不可の件はキューから捨てる。`onUnmounted` を使わないため `mount` は不要（`useToastMessage` は使わない）。ペイロードの `walkId` は `crypto.randomUUID` をスタブして固定する。
      既存1ファイルの更新:
      - `frontend/src/views/__tests__/RouteNavigationView.test.js`: 既存6件は**そのまま通ること**を前提に、2件追加する。
        ① 精度が悪い測位（`accuracy: 150`）が届き続けた場合、しきい値を超えた時点で欠落を記録する（`positionCallbacks.onUpdate` に大きい `accuracy` を渡し、`vi.advanceTimersByTime` で進める）。
        ② しきい値未満の中断を2回繰り返し、合計がしきい値を超えた時点で欠落を記録する（30秒のエラー→復帰→31秒のエラー、で `hasMeasurementGap` が true）。
      Files: 上記4ファイル（うち1つは既存の更新）
      Verify: `cd frontend; npm test` — 既存99件すべてパス + 新規20件前後がパス（合計119件前後、14ファイル）。

- [ ] 18. `useWalkRecord.js` に定数の名前付きエクスポートだけを追加する。
      `const MAX_MEASURABLE_ACCURACY_M = 100;` を `export const MAX_MEASURABLE_ACCURACY_M = 100;` にする。**積算ロジック（ガード①〜⑧）には一切触らない。** 既存の JSDoc とコメントも変更しない。エクスポートする理由を既存コメントの末尾に1行足す（案内画面が「距離を積めない精度」の判定に同じ値を使うため、二重定義にしない）。
      Files: `frontend/src/composables/useWalkRecord.js`
      Verify: `cd frontend; npm test`（既存の walkStore / RouteNavigationView のテストが通ること）、`npm run lint`、`npm run build`。

- [ ] 19. 全体検証。
      以下を順に実行し、すべて終了コード0かつ基準値以上であることを確認する。
      `cd c:\ミチシル開発\michishiru_app\backend; npm test`（73件前後 / 10 suites）
      `cd c:\ミチシル開発\michishiru_app\frontend; npm run lint; npm test; npm run build`（119件前後 / 14ファイル）
      `cd c:\ミチシル開発\michishiru_app\iac; npm run build; npm test; npx cdk synth Michishiru-dev -c withBackend=true`（20件）
      `git status` の変更が下表のファイルのみであることを確認する。`git commit` / `git push` はしない。
      Files: なし（検証のみ）
      Verify: 上記すべて。スコープ外ファイルが `git status` に現れないこと。

---

## 変更するファイル一覧

| ファイル | 新規/変更 | 内容 |
|---|---|---|
| `.kiro/steering/naming-glossary.md` | 変更 | 用語6件 + 更新履歴1行を末尾へ追記 |
| `iac/lib/michishiru-stack.ts` | 変更 | `WalkResultTable` / `CreateWalkResultFunction` / `POST /api/v1/walk-results` / `WalkResultTableName` |
| `iac/test/iac.test.ts` | 変更 | 認可メソッド3→4へ更新、新規4件 |
| `backend/shared/constants/errorCodes.js` | 変更 | `UNAUTHORIZED` と 401 マッピング |
| `backend/functions/createWalkResult/constants.js` | 新規 | 環境変数と入力上限 |
| `backend/functions/createWalkResult/validator.js` | 新規 | 入力チェック（`userId` は扱わない） |
| `backend/functions/createWalkResult/repository.js` | 新規 | Transact / Put と条件エラーの事実化 |
| `backend/functions/createWalkResult/service.js` | 新規 | `unavailable` の分岐と「既に保存済み」の解釈 |
| `backend/functions/createWalkResult/handler.js` | 新規 | claims から `sub` を取り受付とレスポンス |
| `backend/functions/createWalkResult/package.json` | 新規 | `create-walk-result` |
| `backend/functions/createWalkResult/__tests__/service.test.js` | 新規 | 7件前後 |
| `backend/functions/createWalkResult/__tests__/validator.test.js` | 新規 | 10件前後 |
| `tools/localApiServer.js` | 変更 | `POST /api/v1/walk-results` の登録 |
| `frontend/src/utils/pendingWalkResults.js` | 新規 | 退避キュー（localStorage） |
| `frontend/src/services/walkResultService.js` | 新規 | 保存API |
| `frontend/src/composables/useWalkResultSave.js` | 新規 | 保存・退避・再送 |
| `frontend/src/views/WalkResultView.vue` | 変更 | 保存の起動と失敗トースト |
| `frontend/src/views/RouteNavigationView.vue` | 変更 | 中断の累積判定（検知漏れ2件） |
| `frontend/src/App.vue` | 変更 | 退避分の再送の引き金 |
| `frontend/src/composables/useWalkRecord.js` | 変更 | 定数の名前付きエクスポートのみ |
| `frontend/src/utils/__tests__/pendingWalkResults.test.js` | 新規 | 6件前後 |
| `frontend/src/services/__tests__/walkResultService.test.js` | 新規 | 7件前後 |
| `frontend/src/composables/__tests__/useWalkResultSave.test.js` | 新規 | 5件前後 |
| `frontend/src/views/__tests__/RouteNavigationView.test.js` | 変更 | 2件追加（既存6件は維持） |
| `.agents/tasks/` 配下 | 変更 | 計画・FEAT・検証記録・レビュー結果（コードではない作業成果物） |

`frontend/src/App.vue` は当初のスコープ表に無いが、判断2（再送の実装場所）の結論として必要になる。

## スコープ外（絶対に触らない）

履歴取得API（GET）・履歴画面 / 削除機能 / `useRouteProgress.js` / `useWalkRecord.js` の積算ロジック（export 追加のみ可） / `useLocationTracking.js` / `routeStore.js` / `authStore.js` / `walkStore.js`（段階3bでは変更しない） / `WalkResultStats.vue` / `global.css` / 既存 `Route` テーブルと `getRoute` / `createRoute` / `getConditions` / `verifyPasswordResetTarget` / CloudFront の `cachePolicy` / `originRequestPolicy` / `docs/` / `git commit` / `git push`。

## 前提と留意点

- `WALK_RESULT_TABLE_NAME` が未設定の環境（ローカルのハーネスを素で起動した場合）では保存が 503 になり、フロントは退避キューへ積む。これは設計どおりの振る舞いで、復旧後の再送で保存される。
- 累計（`TOTAL`）は単調増加で、削除機能を作らないため減算の経路を持たない。`unavailable` の散歩を加算しない分だけ、累計は①の総和より小さくなり得る。これは意図した差で、将来履歴画面を作るときに「①の合計」と「②の値」が一致しない前提をそのとき明示する。
- `measurementStatus` の3値はフロント（`walkStore.js` の `MEASUREMENT_STATUS`）とバックエンド（`constants.js` の `MEASUREMENT_STATUSES`）に二重定義される。共有できる仕組みが無いため、双方のコメントで相手を指す。
- 退避先はブラウザのストレージ（端末内）で、ブラウザのデータ削除や別ブラウザへの乗り換えで失われる。アプリのネイティブストレージは Web からは使えない。この限界は `pendingWalkResults.js` のコメントに明記する。
