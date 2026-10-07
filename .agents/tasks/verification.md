# 検証記録 — 段階3a: 散歩実績の計測信頼性

実行環境: Windows / PowerShell
実行ディレクトリ: `c:\ミチシル開発\michishiru_app\frontend`
実施日: 2026/10/07
イテレーション: 2回（初回＝計画どおりの実装 / 2回目＝`.agents/tasks/measurement-review.json` の指摘対応）

最新の結果は「## 5. イテレーション2」を参照。以下の 1〜4 は初回イテレーションの記録。

---

## 1. 実行したコマンドと結果（初回）

| # | コマンド | 終了コード | 結果 |
|---|---|---|---|
| 1 | `npm run lint` | 0 | `eslint .` がエラー0・警告0で完了。出力はコマンドのエコーのみ |
| 2 | `npm run test` | 0 | `vitest run` — Test Files 10 passed (10) / Tests 89 passed (89) |
| 3 | `npm run build` | 0 | `vite build` — 708 modules transformed、`✓ built in 2.66s`。`dist/` 出力あり |

### テスト件数の変化

| タイミング | テストファイル | テスト件数 |
|---|---|---|
| 実装前（ベースライン） | 8 | 78 |
| 実装後 | 10 | 89 |

増えた11件の内訳:

- `frontend/src/stores/__tests__/walkStore.test.js`（新規）10件
  - `describe('measurementStatus')` 6件 / `describe('計測状態の記録')` 4件
- `frontend/src/composables/__tests__/useScreenWakeLock.test.js`（新規）1件

既存8ファイル78件はすべて引き続き通っている（減少・スキップなし）。

### build の出力について

`npm run build` は終了コード0で成功したが、標準エラーへ以下が出る。

- `Some chunks are larger than 500 kB after minification`（`index-*.js` が 1,301.58 kB / `maplibre-gl-worker-*.js` が 486.83 kB）

これはベースライン時点から出ている既存の助言であり、今回の変更が原因ではない（追加したコードは composable 1ファイルとストアの computed のみ）。チャンク分割は本段階のスコープ外のため対応していない。

---

## 2. 自己点検（初回）

| # | 点検項目 | 結果 | 確認した場所 |
|---|---|---|---|
| ① | `measurementStatus` の判定順序が unavailable → gap → 距離0 → complete | OK | `frontend/src/stores/walkStore.js` の `measurementStatus`。早期 return の直列で ①`hasLocationFix === false` → `UNAVAILABLE`、②`hasMeasurementGap === true` → `PARTIAL`、③`totalDistanceM === 0` → `PARTIAL`、④`COMPLETE`。順序の理由を直上のコメントに明記。テスト「測位できていない場合は欠落の有無より unavailable を優先する」で①が②より先であることを、「距離を積めていても欠落を検知していれば partial」で②が③/④より先であることを固定している |
| ② | `visibilitychange` リスナーが `onBeforeUnmount` で確実に解除される | OK | `frontend/src/views/RouteNavigationView.vue`。ハンドラを名前付き関数 `handleVisibilityChange` で定義し、`onMounted` の `addEventListener` と `onBeforeUnmount` の `removeEventListener` に同一参照を渡している（無名関数ではないため解除が成立する） |
| ③ | Wake Lock の sentinel が `onBeforeUnmount` で解放される | OK | `frontend/src/composables/useScreenWakeLock.js` の末尾で `onBeforeUnmount(() => { releaseScreenWakeLock(); })`。View 側では解放を呼ばず、責務を composable に閉じている（その旨を View のコメントに記載） |
| ④ | `navigator.wakeLock` が無い環境で例外を投げない | OK | `requestScreenWakeLock` の先頭で `if (!('wakeLock' in navigator)) return;` と機能検出。取得自体も `try/catch` で囲み、失敗は `console.warn` のみで利用者には見せない。`releaseScreenWakeLock` は `sentinel === null` で早期 return。jsdom に `wakeLock` が無いことを利用して、`useScreenWakeLock.test.js` で「reject せず `isScreenAwake` が false のまま」を実際に検証済み |
| ⑤ | `MEASUREMENT_STATUS` の文字列リテラルが画面側に直書きされていない | OK | `WalkResultView.vue` は `import { MEASUREMENT_STATUS, useWalkStore } from '@/stores/walkStore';` で定数を参照。`'partial'` / `'unavailable'` / `'complete'` の文字列は `walkStore.js` の定数定義のみに存在（`frontend/src` 内を grep して画面側・テスト側に直書きが無いことを確認。テストも `MEASUREMENT_STATUS` 経由で比較） |
| ⑥ | 既存78件が引き続き通り、合計件数が増えている | OK | 78 → 89（+11）。テストファイルは 8 → 10 |
| ⑦ | 未使用の import・変数が残っていない | OK | `npm run lint` が終了コード0。本リポジトリの ESLint は未使用変数を error 扱いのため、残っていれば失敗する。意図的な対応として `RouteNavigationView.vue` では `useScreenWakeLock()` から `requestScreenWakeLock` のみを分割代入し、使わない `isScreenAwake` / `releaseScreenWakeLock` は受け取っていない。`catch (error)` の `error` はいずれも `console.warn` の第2引数で使用している |

---

## 3. 変更したファイル（スコープの確認・初回）

`git status --porcelain` / `git diff --numstat` の結果:

| ファイル | 種別 | 追加 | 削除 |
|---|---|---|---|
| `.kiro/steering/naming-glossary.md` | 変更 | 5 | 0 |
| `frontend/src/stores/walkStore.js` | 変更 | 72 | 0 |
| `frontend/src/views/RouteNavigationView.vue` | 変更 | 39 | 1 |
| `frontend/src/views/WalkResultView.vue` | 変更 | 21 | 3 |
| `frontend/src/composables/useScreenWakeLock.js` | 新規 | - | - |
| `frontend/src/stores/__tests__/walkStore.test.js` | 新規 | - | - |
| `frontend/src/composables/__tests__/useScreenWakeLock.test.js` | 新規（任意分） | - | - |

用語辞書は追加5行・削除0行で、直近マージで入った既存の `2026/10/07` の行を1行も消していない（`git diff --numstat` の削除0で確認）。

`.agents/tasks/plan.md` にも差分があるが、これは本実装の前段（計画作成）での変更で、今回の実装では触っていない。

スコープ外（`backend/`、`iac/`、`tools/`、`docs/`、`useLocationTracking.js`、`useRouteProgress.js`、`useWalkRecord.js`、`routeStore.js`、`authStore.js`、`WalkResultStats.vue`、`global.css`）はいずれも未変更。`git commit` / `git push` は実行していない。

---

## 4. 利用者に見える振る舞いの変化（初回）

計画で合意済みの範囲のみ。

| 場面 | 変更前 | 変更後 |
|---|---|---|
| 結果画面（完全に計測できた） | 注記なし | 変化なし（注記なし） |
| 結果画面（一度も測位できなかった） | 「位置情報を取得できなかったため、実績を計測できませんでした」 | 同じ文言（`unavailable`） |
| 結果画面（測位はできたが欠落あり／距離0） | 注記なし | 「一部の区間を計測できなかったため、実際より短く表示されている可能性があります」（`partial`） |
| 案内画面 | 画面が自動消灯する | 対応ブラウザでは案内中の自動消灯を抑止する（未対応環境は従来どおり） |

数値（距離・スポット数・所要時間）は計測状態にかかわらず常に表示し、`WalkResultStats` の props は変更していない。`.hint` と `role="status"` は既存を踏襲し、`partial` と `unavailable` で見た目は同じ。

DB保存・保存API・オフライン退避は段階3b のため未実装。

---

## 5. イテレーション2（レビュー指摘の修正）

入力: `.agents/tasks/measurement-review.json`（verdict: CHANGES_REQUESTED、findings 4件）と `.agents/tasks/measurement-review.md`。

### 5-1. 指摘への対応

| # | 指摘 | 対応 | 変更したファイル |
|---|---|---|---|
| 1 | Wake Lock の in-flight 取りこぼしで解放漏れ（blocking / confirmed） | **修正済み。** 取得中を表す `isRequesting` と、待ち合わせ中に解放を求められたかを表す `isReleaseRequested` を追加。`await navigator.wakeLock.request('screen')` の前で取得中の呼び出しを弾き、await の後で解放要求が立っていれば取得したロックを保持せず即 `release()` して捨てる。解放処理は `releaseSentinel()` に切り出し、`releaseScreenWakeLock` と「捨てる」経路で共用。JSDoc の「何度呼ばれても二重取得しない」は実装の保証範囲（取得中は何もせず抜ける／有効なロックがあれば取り直さない）に合わせて書き直した | `frontend/src/composables/useScreenWakeLock.js` |
| 2 | TIMEOUT 1回で `partial` がラッチされる（non-blocking / likely） | **未対応。** 直し方（エラー種別で区別する／しきい値を設ける）はいずれも利用者が見る注記の出方＝振る舞いの変更になるため、`send_message`（severity: warning）でチームの判断を仰いだ。判断が出るまで現状の実装を維持 | （変更なし） |
| 3 | 一瞬の非表示でも恒久的に欠落扱い（non-blocking / confirmed） | **未対応。** 文言を弱める／短時間の中断を無視する、いずれも利用者に見える変更のため #2 と同じく判断待ち | （変更なし） |
| 4 | View 側の配線にテストが無い（non-blocking / confirmed） | **修正済み。** `RouteNavigationView` の shallow マウントで、①`visibilitychange`（hidden）で `markMeasurementGap` が呼ばれること ②`unmount` 後の `visibilitychange` では呼ばれないこと（`removeEventListener` の確認）③測位エラーで欠落が記録されること を検証するテストを追加。地図などの子は `shallow: true` で差し替え、`vue-router` と `conditionService` のみモック | `frontend/src/views/__tests__/RouteNavigationView.test.js`（新規） |

あわせて #1 の修正を固定するテストを `useScreenWakeLock.test.js` に追加（1件 → 5件）。`navigator.wakeLock.request` を解決タイミングを操れるスタブに差し替え、取得できた場合・待ち合わせ中の呼び直し・待ち合わせ中のアンマウント・取得済みのアンマウントの4経路を検証。`afterEach` で `navigator.wakeLock` を消し、未対応環境のテストに影響させない。

### 5-2. 実行したコマンドと結果（イテレーション2）

実行ディレクトリ: `c:\ミチシル開発\michishiru_app\frontend`

| # | コマンド | 終了コード | 結果 |
|---|---|---|---|
| 1 | `npm run lint` | 0 | `eslint .` がエラー0・警告0（出力はコマンドのエコーのみ） |
| 2 | `npm run test` | 0 | `vitest run` — Test Files 11 passed (11) / Tests 96 passed (96) |
| 3 | `npm run build` | 0 | `vite build` — 708 modules transformed、`✓ built in 2.72s`、`dist/` 出力あり |

テスト件数の変化:

| タイミング | テストファイル | テスト件数 |
|---|---|---|
| 実装前（ベースライン） | 8 | 78 |
| 初回イテレーション後 | 10 | 89 |
| イテレーション2後 | 11 | 96 |

増えた7件の内訳: `useScreenWakeLock.test.js` に4件（Wake Lock の取得・二重取得の抑止・待ち合わせ中のアンマウント・取得済みのアンマウント）、`RouteNavigationView.test.js`（新規）に3件。既存の89件は1件も失敗・スキップしていない。

`npm run build` の `Some chunks are larger than 500 kB` はベースライン時点から出ている既存の助言で、今回の変更が原因ではない（本段階のスコープ外）。

### 5-3. 自己点検（イテレーション2）

| # | 点検項目 | 結果 | 確認した場所 |
|---|---|---|---|
| ① | `measurementStatus` の判定順序が unavailable → gap → 距離0 → complete | OK | `walkStore.js` の `measurementStatus`（イテレーション2では未変更）。順序を固定するテスト2件も引き続き通っている |
| ② | `visibilitychange` リスナーが `onBeforeUnmount` で確実に解除される | OK | `RouteNavigationView.vue`（未変更）。加えて `RouteNavigationView.test.js` の「案内画面を離れた後の画面の切り替えでは欠落を記録しない」で、unmount 後に `visibilitychange` を発火させても `hasMeasurementGap` が false のままであることを実際に検証 |
| ③ | Wake Lock の sentinel が `onBeforeUnmount` で解放される | OK | `useScreenWakeLock.js` 末尾の `onBeforeUnmount`。取得済みの場合（テスト「取得済みのロックはアンマウントで解放される」）と、取得の待ち合わせ中にアンマウントされた場合（テスト「取得の待ち合わせ中にアンマウントされた場合も、解決したロックを解放する」）の両方で `release()` が呼ばれることを検証。後者は指摘#1 の修正前は失敗する |
| ④ | `navigator.wakeLock` が無い環境で例外を投げない | OK | `requestScreenWakeLock` の先頭の `if (!('wakeLock' in navigator)) return;`。テスト「Screen Wake Lock に未対応の環境でも失敗せず、抑止なしのまま進む」で `resolves.toBeUndefined()` を確認。`afterEach` でスタブを削除しているため、この条件が他のテストに汚染されない |
| ⑤ | `MEASUREMENT_STATUS` の文字列リテラルが画面側に直書きされていない | OK | 文字列は `walkStore.js` の定数定義のみ。今回追加したテストも状態の真偽値（`hasMeasurementGap`）で判定しており、文字列を書いていない |
| ⑥ | 既存78件が引き続き通り、合計件数が増えている | OK | 78 → 89 → 96。ファイル 8 → 10 → 11 |
| ⑦ | 未使用の import・変数が残っていない | OK | `npm run lint` が終了コード0（未使用変数は error 設定）。追加したテストの import（`flushPromises` / `vi` / `nextTick` / `afterEach` 等）はすべて使用している |

### 5-4. スコープの確認（イテレーション2）

`git status --porcelain` の結果:

| ファイル | 種別 |
|---|---|
| `.kiro/steering/naming-glossary.md` | 変更（初回分のみ。追加5行・削除0行） |
| `frontend/src/stores/walkStore.js` | 変更（初回分のみ） |
| `frontend/src/views/RouteNavigationView.vue` | 変更（初回分のみ。指摘#2・#3 が判断待ちのため今回は触っていない） |
| `frontend/src/views/WalkResultView.vue` | 変更（初回分のみ） |
| `frontend/src/composables/useScreenWakeLock.js` | 新規（イテレーション2で指摘#1 を修正） |
| `frontend/src/composables/__tests__/useScreenWakeLock.test.js` | 新規（イテレーション2で4件追加） |
| `frontend/src/stores/__tests__/walkStore.test.js` | 新規（初回分のみ） |
| `frontend/src/views/__tests__/RouteNavigationView.test.js` | 新規（イテレーション2） |

スコープ外（`backend/`、`iac/`、`tools/`、`docs/`、`useLocationTracking.js`、`useRouteProgress.js`、`useWalkRecord.js`、`routeStore.js`、`authStore.js`、`WalkResultStats.vue`、`global.css`）はいずれも `git status` に現れない。`git commit` / `git push` も実行していない。

---

# 検証記録 — 段階3b: 散歩実績のDB保存（ユーザー単位）

実行環境: Windows / PowerShell
ワークスペース: `c:\ミチシル開発\michishiru_app`（ブランチ `feature/NZ-176`）
実施日: 2026/10/07
対象: FEAT-001（用語辞書・IaC）／FEAT-002（`createWalkResult` Lambda）／FEAT-003（フロントの保存・退避・再送）の **FEATをまたいだ統合検証**

`.agents/tasks/review.json` は verdict が `CHANGES_REQUESTED` だが `findings` が空のため、レビュー前の1回目として統合検証を実施した。個別の指摘対応はない。

## 7-1. 実行したコマンドと結果

| # | 実行ディレクトリ | コマンド | 終了コード | 結果 | 基準値 |
|---|---|---|---|---|---|
| 1 | `backend/` | `npm test` | 0 | 10 suites / 77 tests pass / 0 fail | 56 tests（上回る） |
| 2 | `frontend/` | `npm run lint` | 0 | `eslint .` がエラー0・警告0 | - |
| 3 | `frontend/` | `npm test` | 0 | 14 files / 123 tests pass | 99 tests（上回る） |
| 4 | `frontend/` | `npm run build` | 0 | `vite build` 成功、`dist/` 出力あり | - |
| 5 | `iac/` | `npm run build` | 0 | `tsc` が型エラーなしで完了 | - |
| 6 | `iac/` | `npm test` | 0 | 1 suite / 20 tests pass | 16 tests（上回る） |
| 7 | `iac/` | `npx cdk synth Michishiru-dev -c withBackend=true` | 0 | 合成成功（`createRoute` / `verifyPasswordResetTarget` の esbuild バンドルも完了） | - |
| 8 | ルート | `node --check tools/localApiServer.js` | 0 | 構文エラーなし | - |
| 9 | ルート | `git status --short` | 0 | スコープ外のファイルなし（下表） | - |

`npm run build`（frontend）の `Some chunks are larger than 500 kB` は段階3a以前から出ている既存の助言で、今回の変更が原因ではない。

## 7-2. FEAT間の継ぎ目の突き合わせ（実コードで確認）

| 継ぎ目 | 片側 | もう片側 | 結果 |
|---|---|---|---|
| Lambda のハンドラパス | `iac/lib/michishiru-stack.ts` の `handler: 'functions/createWalkResult/handler.handler'` | `backend/functions/createWalkResult/handler.js` が `export const handler` を持つ | 一致 |
| 環境変数名 | CDK の `WALK_RESULT_TABLE_NAME: walkResultTable.tableName` | `backend/functions/createWalkResult/constants.js` が同名を読む（`process.env` を読むのはこのファイルのみ） | 一致 |
| APIのパス | CDK の `v1Resource.addResource('walk-results')` + POST | `frontend/src/services/walkResultService.js` の `` `${API_BASE_PATH}/walk-results` ``（`API_BASE_PATH = '/api/v1'`）／`tools/localApiServer.js` の `POST /api/v1/walk-results` | 3者一致 |
| リクエストのキー名 | `useWalkResultSave.js` の `buildCurrentWalkResult()` が送る9キー（`walkId` / `totalDistanceM` / `spotCount` / `elapsedMinutes` / `startedAt` / `endedAt` / `measurementStatus` / `routeTitle` / `genreId`） | `validator.js` が検証する項目と同一。`userId` は送らず、validator も `value` に含めない | 一致 |
| 値の型 | `spotCount` は `visitedSpotIds.length`、`elapsedMinutes` は `Math.round(...)`、`totalDistanceM` は `Math.round(...)`（いずれも整数） | validator は `Number.isInteger` / 有限数を要求 | 一致（整数要求を満たす） |
| ジャンルの受け渡し | フロントは `routeStore.genre`（英語の `genreId`。表示名の `genreName` ではない） | validator の `GENRE_ID_PATTERN`（半角英数字・ハイフン・アンダースコア）を通る。ジャンル未選択時は `''` で、validator は空文字を許容 | 一致 |
| ルートタイトル | フロントは `routeStore.currentRoute?.routeName`（`utils/routeResponse.js` が正規化して必ず持たせるキー） | validator は120文字で切り詰め、長さでは落とさない | 一致 |
| レスポンスの形 | handler は `buildSuccessResponse({ walkId, isAlreadySaved })` | `walkResultService.saveWalkResult` は `response.json()` をそのまま返し、composable は値で分岐せず「200なら成功」として扱う（`isAlreadySaved: true` も成功） | 一致 |
| 認可ヘッダー | CDK は既存の `cognitoAuthorized`（COGNITO_USER_POOLS、`Authorization` ヘッダー） | フロントは `fetchIdToken()` の値をスキーム接頭辞なしで `Authorization` に載せる（既存2サービスと同形） | 一致 |
| 再試行可否の判定 | service が `WalkResultSaveRetryable`（通信不能 / 429 / 5xx）と `WalkResultSaveRejected`（その他4xx・JSON以外の200）を付ける | composable の `isRetryableError` が `WalkResultSaveRetryable` と `NoValidSession` のみ退避対象にする | 一致（400は退避しないため永久再送にならない） |
| テーブル未設定時の経路 | repository が `createDataSourceError` を投げ、handler が 503 `DATA_SOURCE_ERROR` を返す | 503 は 5xx のため `WalkResultSaveRetryable` → 退避キューへ積まれる | 設計どおり |
| IAM 権限 | `walkResultTable.grantWriteData` のみ（`Query` / `GetItem` なし） | repository は書き込み（`TransactWriteItems` / `PutCommand`）のみで読み取りをしない | 一致 |
| ローカルハーネスの経路 | `ROUTE_HANDLERS` は5経路（routes GET/POST、conditions GET、walk-results POST、password-reset-verifications POST） | `buildEvent` のダミー claims（`sub: 'local-dev-user'`）は変更なし。handler は `claims.sub` から利用者を決めるためローカルでも認可済みとして通る | 一致 |
| 案内画面に保存を持ち込んでいないこと | `RouteNavigationView.vue` に `useWalkResultSave` / `saveCurrentWalkResult` の記述なし（grep で0件） | 保存の起点は `WalkResultView.vue` の `onMounted` のみ（判断1） | 一致 |

## 7-3. 変更ファイル（スコープの確認）

`git diff --numstat` と `git status --short` の結果。

| ファイル | 種別 | 追加 | 削除 | 属する段階 |
|---|---|---|---|---|
| `.kiro/steering/naming-glossary.md` | 変更 | 14 | 0 | 3a分7行 + 3b分7行 |
| `backend/shared/constants/errorCodes.js` | 変更 | 3 | 0 | 3b（`UNAUTHORIZED` と401） |
| `backend/functions/createWalkResult/`（8ファイル） | 新規 | - | - | 3b |
| `tools/localApiServer.js` | 変更 | 9 | 0 | 3b |
| `iac/lib/michishiru-stack.ts` | 変更 | 51 | 1 | 3b |
| `iac/test/iac.test.ts` | 変更 | 54 | 4 | 3b |
| `frontend/src/utils/pendingWalkResults.js` | 新規 | - | - | 3b |
| `frontend/src/services/walkResultService.js` | 新規 | - | - | 3b |
| `frontend/src/composables/useWalkResultSave.js` | 新規 | - | - | 3b |
| `frontend/src/App.vue` | 変更 | 47 | 0 | 3b |
| `frontend/src/views/WalkResultView.vue` | 変更 | 54 | 3 | 3a + 3b |
| `frontend/src/views/RouteNavigationView.vue` | 変更 | 153 | 2 | 3a + 3b |
| `frontend/src/composables/useWalkRecord.js` | 変更 | 4 | 1 | 3b（`export` 追加とコメント3行のみ） |
| `frontend/src/stores/walkStore.js` | 変更 | 72 | 0 | **3a（3bでは未変更）** |
| `frontend/src/composables/useScreenWakeLock.js` | 新規 | - | - | 3a |
| テスト（`__tests__/` 7ファイル） | 新規・変更 | - | - | 3a + 3b |
| `.agents/tasks/` 配下 | 変更・新規 | - | - | 作業成果物 |

`frontend/src/stores/walkStore.js` は段階3bのスコープ外だが、段階3aの未コミットの変更がそのまま残っているもので、段階3bでは触っていない（`useWalkRecord.js` の差分も `export` 追加のみで積算ロジックは無変更。`git diff` で確認）。`routeStore.js` / `authStore.js` / `useRouteProgress.js` / `useLocationTracking.js` / `WalkResultStats.vue` / `global.css` / `docs/` はいずれも `git status` に現れない。

`git commit` / `git push` は実行していない。

---

## 6. イテレーション3（指摘#2・#3 の判断を受けた実装）

判断待ちだった指摘#2・#3 について、チームの決定（#2 は案B＝継続時間のしきい値、#3 は案E＝非表示の継続時間で判定、文言は変更しない、しきい値は両方に共通の60秒）を受けて実装した。

### 6-1. 実装内容

| 対象 | 変更 |
|---|---|
| `frontend/src/views/RouteNavigationView.vue` | 定数 `MEASUREMENT_GAP_THRESHOLD_MS = 60000` を追加（しきい値の根拠＝距離は200m／約160秒、スポットは半径40m／約64秒で、短い方に合わせた旨をコメントに明記）。`watch(trackingError, ...)` を即時記録から**タイマー方式**へ変更（非 null になったら `setTimeout` を張り、null へ戻ったら `clearTimeout`。`hasMeasurementGap` が既に true、またはタイマーを張り済みなら張り直さない）。`handleVisibilityChange` は hidden で `hiddenAt = Date.now()` を控えるだけにし、visible へ戻った時点で `Date.now() - hiddenAt >= MEASUREMENT_GAP_THRESHOLD_MS` のときだけ `markMeasurementGap()` を呼ぶ形へ変更。Wake Lock の取り直しは従来どおり。`onBeforeUnmount` に `clearGapTimer()` を追加 |
| `frontend/src/views/__tests__/RouteNavigationView.test.js` | しきい値の分岐を検証する形へ書き換え（3件 → 6件）。`vi.useFakeTimers()` を使い、`watchPosition` のコールバックを捕まえて測位の失敗・復帰をテストから起こす |
| `.kiro/steering/naming-glossary.md` | 「ルートとスポット」へ `計測の欠落とみなす継続時間 / MEASUREMENT_GAP_THRESHOLD_MS` を追記し、更新履歴に1行追加（既存の `2026/10/07` の行は消していない） |
| `frontend/src/stores/walkStore.js` | 変更なし（判定ロジックは据え置き。欠落の解釈は View の責務） |
| `frontend/src/views/WalkResultView.vue` | 変更なし（文言は案D を採らない決定のため） |

`PERMISSION_DENIED` の特別扱いは入れていない。権限拒否では `hasLocationFix` が false のままで `measurementStatus` が最優先の `unavailable` になり、`partial` の判定に到達しないため。

### 6-2. 実行したコマンドと結果（イテレーション3）

実行ディレクトリ: `c:\ミチシル開発\michishiru_app\frontend`

| # | コマンド | 終了コード | 結果 |
|---|---|---|---|
| 1 | `npm run lint` | 0 | `eslint .` がエラー0・警告0 |
| 2 | `npm run test` | 0 | `vitest run` — Test Files 11 passed (11) / Tests 99 passed (99) |
| 3 | `npm run build` | 0 | `vite build` — 708 modules transformed、`✓ built in 1.88s`、`dist/` 出力あり |

テスト件数の変化:

| タイミング | テストファイル | テスト件数 |
|---|---|---|
| 実装前（ベースライン） | 8 | 78 |
| 初回イテレーション後 | 10 | 89 |
| イテレーション2後 | 11 | 96 |
| イテレーション3後 | 11 | 99 |

`RouteNavigationView.test.js` の6件:

| 分岐 | 内容 |
|---|---|
| 測位エラー① | 途切れたまましきい値を超えたら記録する（しきい値の1ms手前では記録しないことも同じテストで固定） |
| 測位エラー② | しきい値の前に復帰したら記録しない（復帰後に時間を進めても記録されない） |
| 測位エラー③ | 案内画面を離れた後はタイマーが発火しない |
| 画面の切り替え① | しきい値以上隠した後に戻ったら記録する |
| 画面の切り替え② | 短時間（しきい値の半分）の非表示では記録しない |
| 画面の切り替え③ | 案内画面を離れた後の画面の切り替えでは記録しない |

`npm run build` の `Some chunks are larger than 500 kB` はベースラインからの既存の助言で、今回の変更が原因ではない。

### 6-3. 自己点検（イテレーション3）

| # | 点検項目 | 結果 | 確認した場所 |
|---|---|---|---|
| ① | `measurementStatus` の判定順序が unavailable → gap → 距離0 → complete | OK | `walkStore.js`（イテレーション3では未変更）。順序を固定するテストも引き続き通っている |
| ② | `visibilitychange` リスナーが `onBeforeUnmount` で確実に解除される | OK | `RouteNavigationView.vue` の `onBeforeUnmount` で `removeEventListener` と `clearGapTimer()`。テスト「案内画面を離れた後の画面の切り替えでは欠落を記録しない」「案内画面を離れた後はタイマーが発火しない」で、購読とタイマーの両方が残らないことを検証 |
| ③ | Wake Lock の sentinel が `onBeforeUnmount` で解放される | OK | `useScreenWakeLock.js`（イテレーション3では未変更）。取得済み・取得の待ち合わせ中の両経路のテストが通っている |
| ④ | `navigator.wakeLock` が無い環境で例外を投げない | OK | 機能検出 `if (!('wakeLock' in navigator)) return;` と未対応環境のテストを維持 |
| ⑤ | `MEASUREMENT_STATUS` の文字列リテラルが画面側に直書きされていない | OK | 文字列は `walkStore.js` の定数定義のみ。今回追加したテストも `hasMeasurementGap`（真偽値）で判定している |
| ⑥ | 既存78件が引き続き通り、合計件数が増えている | OK | 78 → 89 → 96 → 99。失敗・スキップなし |
| ⑦ | 未使用の import・変数が残っていない | OK | `npm run lint` が終了コード0（未使用変数は error 設定） |
| ⑧ | しきい値が1か所に定義され、意図がコメントで追えること | OK | `RouteNavigationView.vue` の `MEASUREMENT_GAP_THRESHOLD_MS`（60000）に根拠コメントを付け、用語辞書にも登録。テスト側は同じ値をテスト用の定数として持ち、View の実装値と揃えている |

### 6-4. 利用者に見える振る舞い（最終）

| 場面 | 結果画面の注記 |
|---|---|
| 完全に計測できた | 出さない |
| 測位エラーが60秒未満で復帰した／60秒未満のアプリ切替があった | 出さない（距離は直線で繋がり、スポットも取りこぼさないため） |
| 測位が60秒以上途切れた／60秒以上画面を離れた／測位はできたが距離が0 | 「一部の区間を計測できなかったため、実際より短く表示されている可能性があります」 |
| 一度も測位できなかった | 「位置情報を取得できなかったため、実績を計測できませんでした」 |

数値（距離・スポット数・所要時間）は計測状態にかかわらず常に表示する点、`WalkResultStats` の props と文言を変更していない点は初回から変わらない。

### 6-5. スコープの確認（イテレーション3）

`git status --porcelain` / `git diff --numstat`:

| ファイル | 種別 | 追加 | 削除 |
|---|---|---|---|
| `.kiro/steering/naming-glossary.md` | 変更 | 7 | 0 |
| `frontend/src/stores/walkStore.js` | 変更 | 72 | 0 |
| `frontend/src/views/RouteNavigationView.vue` | 変更 | 91 | 1 |
| `frontend/src/views/WalkResultView.vue` | 変更 | 21 | 3 |
| `frontend/src/composables/useScreenWakeLock.js` | 新規 | - | - |
| `frontend/src/composables/__tests__/useScreenWakeLock.test.js` | 新規 | - | - |
| `frontend/src/stores/__tests__/walkStore.test.js` | 新規 | - | - |
| `frontend/src/views/__tests__/RouteNavigationView.test.js` | 新規 | - | - |

用語辞書は追加7行・削除0行。スコープ外（`backend/`、`iac/`、`tools/`、`docs/`、`useLocationTracking.js`、`useRouteProgress.js`、`useWalkRecord.js`、`routeStore.js`、`authStore.js`、`WalkResultStats.vue`、`global.css`）はいずれも未変更で、`git commit` / `git push` も実行していない。

---

## 8. 段階3b イテレーション2（レビュー指摘8件の対応）

入力: `.agents/tasks/review.json`（verdict: CHANGES_REQUESTED、findings 8件）と `.agents/tasks/review.md`。

### 8-1. 指摘への対応

| # | 指摘 | 重大度 | 対応 | 変更したファイル |
|---|---|---|---|---|
| 1 | 退避キューにユーザーの紐付けが無い | blocking | **修正済み。** 退避する項目を `{ walkId, ownerUsername, walkResult }` の形に変え、退避時に `authStore.username` を控えるようにした。`flushPendingWalkResults` は①サインインしていなければ何も送らず、②`ownerUsername` が現在のユーザーと一致する項目だけを送る（他ユーザー分は消さずに残し、その人がサインインしたときに送られる）。送るのは `walkResult`（APIの9キー）だけで、持ち主は載せない | `frontend/src/composables/useWalkResultSave.js`、`frontend/src/utils/pendingWalkResults.js`（JSDocのみ。保管庫は中身の形を知らない旨を明記）、`.kiro/steering/naming-glossary.md`（`ownerUsername` を追記） |
| 2 | ソートキーに入る `endedAt` の書式を縛っていない | non-blocking | **修正済み。** `ISO_8601_UTC_PATTERN`（`/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/`）を追加し、`startedAt` / `endedAt` の判定を `Date.parse` のみから「書式の一致＋実在する日時」へ変更。`2026/10/07` や NUL を挟んだ `#` 混じりの値、オフセット付き（`+09:00`）は弾く。フロントは常に `toISOString()`（UTC・ミリ秒あり）を送るため、送信側の変更は不要 | `backend/functions/createWalkResult/validator.js`、同 `__tests__/validator.test.js`（+4件） |
| 3 | `repository.js` にテストが無い | non-blocking | **修正済み。** `__tests__/repository.test.js` を新規追加（10件）。`DynamoDBDocumentClient.from` を差し替えてAWSへは接続せず、送られたコマンドを記録して検証する。固定したのは Put の `attribute_not_exists(pk)`、`pk`/`sk` の組み立て、累計の `ADD` 式と4つの値、`TOTAL` を指すキー、`TransactionCanceledException` の `ConditionalCheckFailed` 読み替え、条件エラーを再試行しないこと、スロットリングは再試行すること、`PutCommand` 側の `ConditionalCheckFailedException` 読み替え | `backend/functions/createWalkResult/__tests__/repository.test.js`（新規） |
| 4 | 結果画面の保存起動と再送の配線にテストが無い | non-blocking | **修正済み。** `WalkResultView.test.js`（6件）で「描画時に保存が1回だけ起きる」「成功時はトーストを出さない」「失敗時は文言がトーストに出る」「`measurementStatus` ごとの注記の出し分け3件」を検証。`App.test.js`（5件）で「未サインインでは送らない」「サインイン済みで描画された場合も送る（`immediate: true` の必要性）」「描画後のサインインで送る」「`online` で送る」「アンマウント後の `online` では送らない（購読解除）」を検証 | `frontend/src/views/__tests__/WalkResultView.test.js`（新規）、`frontend/src/__tests__/App.test.js`（新規） |
| 5 | `grantWriteData` が使わない権限まで付与 | non-blocking | **修正済み。** `walkResultTable.grant(createWalkResultFn, 'dynamodb:PutItem', 'dynamodb:UpdateItem')` に変更。`cdk synth` の出力でも当該ポリシーの Action が `PutItem` / `UpdateItem` の2つだけになったことを確認。テストに `DeleteItem` / `BatchWriteItem` を含まないことの確認を追加 | `iac/lib/michishiru-stack.ts`、`iac/test/iac.test.ts` |
| 6 | 非表示と測位中断で同じ時間を二重に計上 | non-blocking | **修正済み。** 中断の開始・終了を `startMeasurementInterruption()` / `endMeasurementInterruption()` に切り出し、①画面が隠れた時点で測位側の中断を締めてから非表示側の計測へ引き継ぐ、②`hiddenAt !== null` の間は測位側の中断を開始しない、③表示へ戻った時点でまだ測位が届いていなければ測位側として数え直す、の3点で重複を取り除いた。しきい値（60000ms）と注記の文言は変更していない | `frontend/src/views/RouteNavigationView.vue`、同テスト（+2件） |
| 7 | `startedAt` が未設定でも保存する | non-blocking | **修正済み。** `saveCurrentWalkResult` の先頭に `walkStore.startedAt === null` のガードを追加。送るものが無いだけなので失敗としては扱わず（トーストも出さない）`true` を返す | `frontend/src/composables/useWalkResultSave.js`、同テスト（+1件） |
| 8 | サーバーの検証メッセージを利用者へそのまま表示 | non-blocking | **修正済み。** 再試行不可の失敗の文言を固定（`実績を保存できませんでした`）し、例外の詳細は `console.error` へ回した。利用者に見える文言が変わる点は 8-4 に記載 | `frontend/src/composables/useWalkResultSave.js`、同テスト |

対応しない判断をした指摘はない（8件すべて修正した）。

### 8-2. 実行したコマンドと結果

| # | 実行ディレクトリ | コマンド | 終了コード | 結果 | 基準値 |
|---|---|---|---|---|---|
| 1 | `backend/` | `npm test` | 0 | 12 suites / 91 tests pass / 0 fail | 56 tests（上回る。前回は77件） |
| 2 | `frontend/` | `npm run lint` | 0 | `eslint .` がエラー0・警告0 | - |
| 3 | `frontend/` | `npm test` | 0 | 16 files / 140 tests pass | 99 tests（上回る。前回は123件） |
| 4 | `frontend/` | `npm run build` | 0 | `vite build` — 711 modules transformed、`✓ built in 2.60s`、`dist/` 出力あり | - |
| 5 | `iac/` | `npm run build` | 0 | `tsc` が型エラーなしで完了 | - |
| 6 | `iac/` | `npm test` | 0 | 1 suite / 20 tests pass | 16 tests（上回る） |
| 7 | `iac/` | `npx cdk synth Michishiru-dev -c withBackend=true` | 0 | 合成成功。`CreateWalkResultFunctionServiceRoleDefaultPolicy` の Action が `dynamodb:PutItem` / `dynamodb:UpdateItem` の2つだけであることを出力で確認 | - |
| 8 | ルート | `node --check tools/localApiServer.js` | 0 | 構文エラーなし | - |
| 9 | ルート | `git status --short` | 0 | スコープ外のファイルなし（8-3） | - |

テスト件数の変化（段階3b 内）:

| タイミング | backend | frontend | iac |
|---|---|---|---|
| 段階3b 実装前のベースライン | 56 | 99 | 16 |
| イテレーション1後 | 77 | 123 | 20 |
| イテレーション2後 | **91** | **140** | **20** |

増えた件数の内訳:

- backend +14: `repository.test.js`（新規10件）、`validator.test.js` +4件（非ISO形式・`#` 混入・ミリ秒なし・オフセット付き）
- frontend +17: `WalkResultView.test.js`（新規6件）、`App.test.js`（新規5件）、`useWalkResultSave.test.js` +4件（持ち主の控え・サーバー文言を出さない・案内未開始では送らない・別ユーザー分を送らない／未サインインでは送らない）、`RouteNavigationView.test.js` +2件（二重計上しない・戻った後も数え続ける）
- iac ±0（既存テストに確認を2行追加）

`npm run build`（frontend）の `Some chunks are larger than 500 kB` は段階3a以前から出ている既存の助言で、今回の変更が原因ではない。

### 8-3. スコープの確認（イテレーション2）

`git status --short` の結果はイテレーション1と同じ集合で、新しく増えたのは以下のテスト2ファイルのみ（いずれも `__tests__/` 配下）。

| ファイル | 種別 |
|---|---|
| `backend/functions/createWalkResult/__tests__/repository.test.js` | 新規 |
| `frontend/src/views/__tests__/WalkResultView.test.js` | 新規 |
| `frontend/src/__tests__/App.test.js` | 新規 |

`routeStore.js` / `useRouteProgress.js` / `useLocationTracking.js` / `WalkResultStats.vue` / `global.css` / 既存4 Lambda / `docs/` はいずれも未変更。`authStore.js` も未変更（`useWalkResultSave` から読むだけで、ストア側には手を入れていない）。`git commit` / `git push` は実行していない。

### 8-4. 利用者に見える振る舞いの変化

| 場面 | 変更前 | 変更後 |
|---|---|---|
| 保存が通らず、送り直しても通らない失敗（400等） | `保存できませんでした。walkId はUUID v4の形式で指定してください` のようにサーバーの検証文言がトーストに出る | `実績を保存できませんでした` の固定文言。詳細はブラウザのコンソールへ |
| 画面を隠している間に測位も途切れていた散歩 | 同じ実時間が2回数えられ、実際には30秒程度の中断でも「一部の区間を計測できなかった…」の注記が出ることがあった | 実際の中断時間だけで判定するため、合計60秒を超えるまで注記は出ない |
| 同じ端末で別のユーザーがサインインしたとき | 前のユーザーの退避分がそのユーザーの実績として保存され、累計に加算されていた | 送られない（持ち主がサインインするまで退避に残る） |
| 案内を経ずに結果画面が描画された場合 | `1970-01-01` の実績が保存され得た | 保存しない（トーストも出さない） |

再試行可の失敗（圏外・5xx）のトーストは従来どおり `保存できませんでした。通信が回復したときに自動で保存します`。数値の表示・注記の文言・画面の構成は変更していない。
