# 実装計画 — API Gateway に Cognito オーソライザーを付け、フロントが idToken を送る

対象ブランチ: 現在のブランチのまま（`git branch --show-current` は `feature/NZ-176`。タスク本文の `feature/NZ-230` とは異なるが、指示どおりブランチは切り替えない）。コミット・プッシュはしない。

---

## 事前に確認した事実（実コードベース）

| 確認項目 | 結果 |
|---|---|
| `userPool` / `userPool.addClient('WebClient')` | `iac/lib/michishiru-stack.ts` に既存。`withBackend` の外（常に作成）。`apigateway` / `cognito` の import も既存 |
| API Gateway のメソッド数 | **4つ**。`GET /api/v1/routes` / `POST /api/v1/routes` / `GET /api/v1/conditions` / **`POST /api/v1/password-reset-verifications`** |
| CORS 設定 | 無し（同一オリジン）。したがって `OPTIONS` メソッドは生成されない |
| `iac/node_modules` | **存在しない**。`iac` での作業前に `npm ci` が必要 |
| `backend/node_modules` | 存在する（`esbuild` も devDependency にあるため `NodejsFunction` のバンドルは可能） |
| フロントのサービス層 | `routeService.js` / `conditionService.js` / `passwordResetService.js` / `authService.js` の4ファイル |
| 既存のフロントのテスト | 6ファイル（`services/__tests__/passwordResetService.test.js` を含む）。Vitest、`vitest` から明示 import、`vi.stubGlobal('fetch', ...)` で差し替える書き方 |
| 既存の IaC のテスト | `iac/test/iac.test.ts` に9テスト。`Template.fromStack` + `hasResourceProperties` / `findResources` 併用 |
| lint の対象 | `frontend/eslint.config.js` のみ。`tools/` と `iac/` は ESLint の対象外 |
| ローカル開発と Cognito | `main.js` は `HAS_CONFIGURED_AUTH` が false だと `Amplify.configure` を呼ばない。ルーターが全画面をログインゲートしているため、**現状でも `.env.local` の Cognito 設定なしでは画面を使えない**。したがって「ローカルで idToken が取れない」ケースの特別扱いは不要 |

## 設計上の判断（タスク本文との差分 — 実装者は必読）

1. **`POST /api/v1/password-reset-verifications` は認可を付けない。**
   タスク本文は「API Gateway のメソッドは3つ」「`AuthorizationType: NONE` のメソッドが存在しないことを検証する」としているが、実コードには4つ目のメソッドとして照合APIがある。これは**パスワード再設定の前＝ログイン前に呼ぶ**ため、Cognito オーソライザーを付けると機能しなくなる。`.kiro/steering/ミチシル_前提条件.md` の「照合APIの保護」行も「ログイン前に呼べる必要がある。認可で守れないので回数制限で抑える」と明記している。
   よって保護対象は本文どおり3メソッド、照合APIは `NONE` のまま残す。テストの要点は「NONE が0件」ではなく **「NONE は照合APIの1件だけで、それ以外のメソッドは全て COGNITO_USER_POOLS」** とする（新しいメソッドを無認可で追加したら落ちる、という保護の意図は保てる）。
   `frontend/src/services/passwordResetService.js` も同じ理由で**変更しない**。
2. **401 のときに画面へ出る文言は今回変えない。** API Gateway のオーソライザーは `{"message":"Unauthorized"}` を返すため、`routeService.ensureUsableResponse` 経由で「Unauthorized」がそのまま表示され得る。既存エラー処理には触らない指示のため今回は対象外とし、残課題として本計画の最後に記録する（`fetchIdToken` が投げる経路＝セッション切れは日本語文言になるため、実害は「トークンは取れたが API 側で失効扱い」の狭いケースに限られる）。
3. **共通化しない。** `Authorization` ヘッダーの付与は `routeService.js` と `conditionService.js` に同じ形で2回書く（指示どおり）。3ファイル目が出た時点で共通化する方針をコメントに残す。

---

# Implementation Plan

- [ ] 1. `iac` の依存をインストールし、変更前の基準（ベースライン）を取る。
      `iac` に `node_modules` が無いため、まずここを通しておかないと以降の検証が全て失敗する。既存9テストが通ることを変更前に確認し、後で「壊していない」と言える基準にする。
      Files: （変更なし。`iac/node_modules` と `iac/package-lock.json` の生成のみ）
      Verify: `cd iac; npm ci` が成功 → `npm run build`（tsc）がエラー0 → `npm test` で既存9テストが pass。

- [ ] 2. `iac/lib/michishiru-stack.ts` に Cognito オーソライザーを作り、保護対象の3メソッドへ適用する。
      `const api = new apigateway.RestApi(this, 'MichishiruApi', {...})` の直後（`const v1Resource = ...` の前）に `const apiAuthorizer = new apigateway.CognitoUserPoolsAuthorizer(this, 'ApiAuthorizer', { cognitoUserPools: [userPool], authorizerName: `michishiru-api-authorizer-${stage}` });` を追加する。`userPool` は `withBackend` ブロックの外で宣言済みのため、このブロック内からそのまま参照できる（スコープ確認済み）。
      続いて `routesResource.addMethod('GET', ...)` / `routesResource.addMethod('POST', ...)` / `conditionsResource.addMethod('GET', ...)` の3箇所すべてに第3引数 `{ authorizer: apiAuthorizer, authorizationType: apigateway.AuthorizationType.COGNITO }` を追加する（1つも漏らさない。`authorizationType` は省略せず明示する）。`passwordResetVerificationsResource.addMethod('POST', ...)` には**付けない**。
      コメント（既存ファイルと同じ「なぜ」を書く日本語の文体、`// ----` 区切りは使わず通常の行コメント）で次を説明する: (a) 3メソッドすべてを保護する理由＝フロントは `router.beforeEach` で完全にログインゲート済みで、ログイン前にこれらを呼ぶ経路が無い。(b) 後続タスクで Lambda が `event.requestContext.authorizer.claims.sub` でユーザーを識別すること。(c) フロントは idToken を `Authorization` ヘッダーで送ること。(d) 照合API（`password-reset-verifications`）だけ認可を付けない理由＝パスワード再設定はログイン前に呼ぶため。保護は回数制限で別途行う（未対応の残課題）。
      既存の論理ID（`UserPool` / `MichishiruApi` 等）は改名しない。CloudFront の `cachePolicy: CACHING_DISABLED` と `originRequestPolicy: ALL_VIEWER_EXCEPT_HOST_HEADER` は変更しない。import 追加は不要（`apigateway` は既に import 済み）。
      Files: `iac/lib/michishiru-stack.ts`
      Verify: `cd iac; npm run build` がエラー0 → `npx cdk synth Michishiru-dev -c withBackend=true --quiet` が成功（オーソライザーを作って1つもメソッドへ紐付けないと CDK が synth 時に例外を出すため、ここで紐付け漏れも検出できる）→ 生成された `iac/cdk.out/Michishiru-dev.template.json` に `AWS::ApiGateway::Authorizer` が1件あり、`AuthorizationType` が `COGNITO_USER_POOLS` のメソッドが3件・`NONE` が1件であること（`Select-String` で件数を目視確認。正式な検証は次の項目のテストで行う）。

- [ ] 3. `iac/test/iac.test.ts` に認可の検証を追加する。
      `describe('MichishiruStack (バックエンド有効)')`（`stage: 'prod'`）の中、既存の `test('API Gateway と GET / POST メソッドを作成する')` の直後に、既存と同じ日本語のテスト名・記法で3テストを追加する。既存9テストは1つも書き換えない。
      - `test('API に Cognito オーソライザーを1つ作成する')`: `template.resourceCountIs('AWS::ApiGateway::Authorizer', 1)` と `template.hasResourceProperties('AWS::ApiGateway::Authorizer', { Type: 'COGNITO_USER_POOLS', Name: 'michishiru-api-authorizer-prod', ProviderARNs: Match.anyValue() })`。
      - `test('ログイン後に呼ぶ3つのメソッドを Cognito 認可で保護する')`: `template.findResources('AWS::ApiGateway::Method')` で全メソッドを取得し、`Properties.AuthorizationType === 'COGNITO_USER_POOLS'` のものが3件、いずれも `Properties.AuthorizerId` が定義済みであることを確認する。あわせて3件の `Properties.HttpMethod` の集まりが `['GET', 'GET', 'POST']`（routes の GET / POST と conditions の GET）であることを `sort()` して比較する。
      - `test('未認証のメソッドはログイン前に呼ぶ照合APIだけである')`: `findResources('AWS::ApiGateway::Resource')` から `PathPart === 'password-reset-verifications'` の論理IDを引き、`AuthorizationType` が `COGNITO_USER_POOLS` 以外のメソッドがちょうど1件で、その `Properties.ResourceId.Ref` がその論理IDと一致することを確認する。**この「未認証は照合APIの1件だけ」の検証が今回の要点**（無認可のメソッドを足したら落ちるようにする）。論理IDの文字列を直書きせず `findResources` から引くことで、CDK の論理ID生成規則に依存しない。
      テスト名・コメントは日本語。`Match` は既に import 済み。
      Files: `iac/test/iac.test.ts`
      Verify: `cd iac; npm test` → 既存9 + 新規3 = 12テストすべて pass。試しに `iac/lib/michishiru-stack.ts` の `conditionsResource.addMethod` から認可を一時的に外すと3番目のテストが落ちることを確認してから元に戻す（テストが実際に効いていることの確認）。

- [ ] 4. `frontend/src/services/authService.js` に `fetchIdToken` を追加する。
      `aws-amplify/auth` の import に `fetchAuthSession` を追加する（既存はエイリアス前の元名でアルファベット順に並んでいるため、`confirmSignUp as cognitoConfirmSignUp` と `getCurrentUser` の間に置く）。
      `ERROR_MESSAGES` の末尾に区切りコメント（例: `// ここから下はAPIの認可で出るもの`）を付けて `NoValidSession: 'ログインの有効期限が切れました。もう一度ログインしてください'` を追加する。既存のキーと3つの対応表（`ERROR_MESSAGES` / `PASSWORD_RESET_ERROR_MESSAGES` / 既定文言の定数）の構造は変えない。`toAuthErrorMessage` が `ERROR_MESSAGES` を引くため、追加だけで画面の文言変換に乗る。
      ファイル末尾（`fetchSignedInUsername` の後）に `export const fetchIdToken = async () => { ... }` を追加する。`const session = await fetchAuthSession();` → `const idToken = session.tokens?.idToken?.toString();` → 取得できなければ `null` を返さず、`new Error(...)` に `error.name = 'NoValidSession'` を設定して throw する（`signInWithPassword` と同じ「`new Error` + `error.name` 代入」の書き方に合わせる。`passwordResetService.js` の `createNamedError` は import しない＝サービス間の依存を増やさない）。取得できれば `idToken` を返す。
      コメントで「**トークンをモジュール変数にキャッシュしない**」理由を明記する: idToken の有効期限は1時間だが散歩はそれより長くなり得る。`fetchAuthSession` はリフレッシュトークン（5日）で自動更新するため、リクエストごとに呼ぶのが最も単純で安全。
      JSDoc は既存と同じ密度で `@description` / `@returns {Promise<string>}` / `@throws {Error}` を日本語で書く。
      Files: `frontend/src/services/authService.js`
      Verify: `cd frontend; npm run lint` がエラー0 → `npm test` で既存6テストファイルがすべて pass（この項目単体ではまだ `fetchIdToken` を呼ぶ経路が無いため、挙動の検証は項目6で行う）。

- [ ] 5. `frontend/src/services/routeService.js` と `frontend/src/services/conditionService.js` の3つの fetch に `Authorization` ヘッダーを付ける。
      両ファイルの先頭の import に `import { fetchIdToken } from '@/services/authService';` を追加する（`@/` エイリアスを使う）。
      - `routeService.fetchRoute`: `fetch(...)` の直前に `const idToken = await fetchIdToken();` を置き、第2引数に `{ headers: { Authorization: idToken } }` を渡す。`VITE_ROUTE_API_URL` による切り替え（`ROUTE_API_URL`）とクエリの組み立ては変更しない。どこからも呼ばれていない関数だが削除せず、他と同じ扱いにする。
      - `routeService.createRoute`: 同様に `const idToken = await fetchIdToken();` を置き、既存の `headers: { 'Content-Type': 'application/json' }` へ `Authorization: idToken` を併記する。`buildCreateRouteBody` / `ensureUsableResponse` / `toRoute` の呼び出しは変更しない。
      - `conditionService.fetchConditionOptions`: 素の `fetch(\`${API_BASE_PATH}/conditions\`)` を `fetch(url, { headers: { Authorization: idToken } })` にする。後続の `response.ok` / `isJsonResponse` / 整形処理は変更しない。
      コメントで次を明記する: (a) `Bearer ` などのスキーム接頭辞を**付けない**理由＝API Gateway の Cognito オーソライザーは既定でヘッダーの値をトークンそのものとして検証するため、接頭辞を付けると検証に失敗する。(b) `fetchIdToken` の例外はここで捕まえず上位（composable）へそのまま伝播させる＝セッション切れの文言は `toAuthErrorMessage` 側の責務。(c) 2ファイルに同じ処理を書いているが今回は抽象化せず、3ファイル目が出た時点で共通化する方針。
      `passwordResetService.js` は変更しない（ログイン前に呼ぶ照合APIのため。項目2の (d) と対応）。
      Files: `frontend/src/services/routeService.js`, `frontend/src/services/conditionService.js`
      Verify: `cd frontend; npm run lint` がエラー0 → `npm test` が pass（挙動は項目6で確認）→ `npm run build` が成功。

- [ ] 6. `frontend/src/services/__tests__/` に `routeService.test.js` と `conditionService.test.js` を追加する。
      ヘッダーが実際に付くことを確認できる唯一の自動検証なので入れる。既存の `passwordResetService.test.js` の書き方を踏襲する（`vitest` から `afterEach` / `describe` / `expect` / `test` / `vi` を import、`vi.stubGlobal('fetch', ...)` のヘルパー `stubFetch` を各ファイルに用意、`afterEach` で `vi.unstubAllGlobals()`）。
      - 共通: `vi.mock('@/services/authService', () => ({ fetchIdToken: vi.fn(async () => 'dummy-id-token') }))` でトークン取得を差し替える（Amplify の実体を読み込ませない）。
      - `routeService.test.js`: `vi.mock('@/utils/routeResponse', () => ({ toRoute: (payload) => payload }))` でレスポンス変換を恒等にしておく（`toRoute` の入力形式に依存しないため）。テストは「`createRoute` が `Authorization` と `Content-Type` の両方を付けて POST する」「`fetchRoute` が `Authorization` を付けて GET する」「`fetchIdToken` が投げた例外がそのまま伝播する（`vi.mocked(fetchIdToken).mockRejectedValueOnce` で `NoValidSession` を投げさせ、`rejects.toMatchObject({ name: 'NoValidSession' })`）」「トークンに `Bearer ` 接頭辞を付けない（ヘッダー値が `'dummy-id-token'` と厳密一致）」。
      - `conditionService.test.js`: `fetchConditionOptions` が `Authorization` を付けて `/api/v1/conditions` を呼ぶこと。マスタの整形は既存仕様のため、`GENRE#ALL` / `DISTANCE#ALL` の最小データ（`isActive: true`、`sortOrder`、`genreId` / `genreName` / `iconEmoji`、`distanceKm` / `displayLabel`）を1〜2件ずつ用意して成功系が通ることを1テストで確認する。
      テスト名・JSDoc は日本語。ファイル名は `<対象>.test.js`（`.spec` は使わない）。
      Files: `frontend/src/services/__tests__/routeService.test.js`, `frontend/src/services/__tests__/conditionService.test.js`
      Verify: `cd frontend; npm test` → 新規テストと既存6ファイルがすべて pass。`routeService.js` の `Authorization` を一時的に外すと新規テストが落ちることを確認してから戻す。

- [ ] 7. `tools/localApiServer.js` の `buildEvent` に `requestContext` を追加する。
      ファイル先頭の `HOST` 定数の下に、`/** ローカル開発で認可済みとみなすユーザーの識別子（Cognito の sub 相当） */ const LOCAL_DEV_USER_SUB = 'local-dev-user';` と `/** ローカル開発で認可済みとみなすユーザー名 */ const LOCAL_DEV_USERNAME = 'local-dev';` を UPPER_SNAKE_CASE で定義する（実在しそうな UUID 形式にはしない。本番のデータと見分けが付くようにする）。
      `buildEvent` の戻り値へ `requestContext: { authorizer: { claims: { sub: LOCAL_DEV_USER_SUB, 'cognito:username': LOCAL_DEV_USERNAME } } }` を追加する（既存5キーは順序も含めてそのまま残す）。
      コメントで明記する: このハーネスは**認可を模倣するだけで検証はしない**。`Authorization` ヘッダーの中身は見ない（本番の認可は API Gateway が行う）。そうしてよい理由は `127.0.0.1` のみで待ち受け、`tools/` 配下でデプロイ対象外だから。後続タスクで Lambda が `event.requestContext.authorizer.claims.sub` を読むため、ローカルでも同じ形のイベントを渡しておく。
      `ROUTE_HANDLERS` / `readRequestBody` / サーバー本体の構造は変更しない。`backend/` 配下は一切触らない。
      Files: `tools/localApiServer.js`
      Verify: `node --check tools/localApiServer.js` が成功（`tools/` は ESLint 対象外のため構文確認はこれで行う）→ `npm run dev:api` をリポジトリルートで起動し、`ローカルAPIハーネス起動: http://127.0.0.1:3001` と4経路のログが出ることを確認して停止（経路が DynamoDB / Cognito を呼ぶため、AWS の認証情報がある環境なら `Invoke-WebRequest http://127.0.0.1:3001/api/v1/conditions` が 200 を返すことまで確認する。認証情報が無い環境では起動確認までで可とし、その旨を実装報告に書く）。

- [ ] 8. `.kiro/steering/naming-glossary.md` の「認証」節と更新履歴に追記する。
      「認証」節の表の末尾（`isPasswordVisible` の行の直後）に既存と同じ `| 日本語 | 英語（コード上） | 説明 |` の形で2行追加する。
      - `| IDトークン | idToken | Cognito が発行する、ユーザーの属性（sub など）を含むトークン。API の認可で Authorization ヘッダーに載せる |`
      - `| ユーザーの一意なID | sub | Cognito が発行する不変のユーザー識別子。ユーザー名は変更され得るためデータのキーにはこちらを使う |`
      ファイル末尾の更新履歴表に1行追記する: `| 2026/10/07 | API の認可（Cognito オーソライザー）の実装に伴い「認証」へ idToken / sub を追加 |`。
      **既存の行は1行も消さない**（直近のマージで競合したファイルで、末尾に 2026/10/07 の行が既に2つある。それらを残したまま、その下へ追記する）。表の列数・区切り行の形は既存に揃える。
      Files: `.kiro/steering/naming-glossary.md`
      Verify: `git diff --numstat -- .kiro/steering/naming-glossary.md` の削除行数が **0**、追加行数が3であること → `git diff -- .kiro/steering/naming-glossary.md` を読み、追記位置が「認証」節の表末尾と更新履歴の末尾であることを確認。

- [ ] 9. `.kiro/steering/ミチシル_前提条件.md` の3つの表と更新履歴を更新する。
      - 「各サービスの役割」表の `Amazon API Gateway` 行（現在「REST API のエンドポイントを提供する。HTTPS でのみ受け付ける」）に、Cognito オーソライザーで保護していること（照合APIのみ対象外）を追記する。
      - 「今後追加予定の要素」表から「API の認可」行を**削除**する。同じ表の「照合APIの保護」行は**残す**（未対応のまま。回数制限の方針は未決定）。
      - 「確定した要素」表の末尾に1行追加する: 要素「API の認可」／採用「API Gateway の Cognito オーソライザー。`GET`/`POST /api/v1/routes` と `GET /api/v1/conditions` の3メソッドに適用し、フロントは idToken を `Authorization` ヘッダーで送る。`POST /api/v1/password-reset-verifications` はログイン前に呼ぶため対象外」／確定日 `2026/10/07`。
      - ファイル末尾の更新履歴表に1行追記する: `| 2026/10/07 | - | API の認可を実装し、「今後追加予定の要素」から「確定した要素」へ移動。API Gateway の3メソッドに Cognito オーソライザーを付け、フロントは idToken を Authorization ヘッダーで送る。照合APIはログイン前に呼ぶため対象外（回数制限は未対応のまま） |`。
      構成図（ASCII 図）は経路自体が変わらないため変更しない。
      Files: `.kiro/steering/ミチシル_前提条件.md`
      Verify: `git diff -- '.kiro/steering/ミチシル_前提条件.md'` を読み、(a) 削除が「API の認可」行の1行だけであること、(b) 「確定した要素」表と更新履歴に各1行追加され表の列数が崩れていないこと、(c) 「照合APIの保護」行が残っていることを確認。

- [ ] 10. 全体をまとめて検証する（`git-workflow.md` の「PR の前提条件」に相当）。
      コミット・プッシュはしない。結果を実装報告にまとめる。
      Files: （変更なし）
      Verify: 次をすべて実行して通すこと。`cd frontend; npm run lint` → エラー0。`cd frontend; npm test` → 全テスト pass。`cd frontend; npm run build` → 成功。`cd backend; npm test` → 既存テストが pass（backend は未変更なので変化がないことの確認）。`cd iac; npm run build` → エラー0。`cd iac; npm test` → 12テスト pass。`cd iac; npx cdk synth Michishiru-dev -c withBackend=true --quiet` → 成功。最後に `git status` で変更ファイルが想定の7ファイル（`iac/lib/michishiru-stack.ts`, `iac/test/iac.test.ts`, `frontend/src/services/authService.js`, `routeService.js`, `conditionService.js`, `tools/localApiServer.js`, steering 2ファイル）＋新規テスト2ファイルだけであることを確認（`iac/package-lock.json` と `iac/cdk.out` の生成物は除く。`cdk.out` が `.gitignore` 対象か確認し、未対象なら生成物を削除する）。

---

## デプロイ後に必要になること（今回のスコープ外・実装報告に残す）

| 項目 | 内容 |
|---|---|
| 401 の文言 | API Gateway のオーソライザーは `{"message":"Unauthorized"}` を返すため、`routeService.ensureUsableResponse` 経由で英語の文言が画面に出得る。既存エラー処理を変えない指示のため今回は対象外 |
| 照合APIの保護 | `POST /api/v1/password-reset-verifications` は未認証のまま。スロットリング / WAF による回数制限は未決定（steering の「今後追加予定の要素」に残置） |
| Lambda 側のユーザー識別 | `event.requestContext.authorizer.claims.sub` を使う実装は後続タスク。今回 `backend/` は変更しない |
| ローカル開発の前提 | フロントは `frontend/.env.local` に `VITE_COGNITO_USER_POOL_ID` / `VITE_COGNITO_USER_POOL_CLIENT_ID` が必要（既存の前提と同じ）。ローカルのAPIハーネスはトークンを検証しない |
