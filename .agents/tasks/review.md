# API Gateway に Cognito オーソライザーを付け、フロントが idToken を送る

ログイン後に呼ぶ3メソッド（`GET`/`POST /api/v1/routes`、`GET /api/v1/conditions`）を API Gateway の Cognito オーソライザーで保護し、フロントの `routeService` / `conditionService` が `fetchAuthSession` 由来の idToken を `Authorization` ヘッダーに載せるようにした変更。パスワード再設定の照合API（`POST /api/v1/password-reset-verifications`）はログイン前に呼ぶ必要があるため意図的に未認証のまま残し、その事実を IaC のテストで「未認証はこの1件だけ」と固定している。ローカルのAPIハーネスは本番のイベント形に合わせて `requestContext.authorizer.claims` を模倣するだけで検証はしない。steering 2ファイルも「API の認可」を未決事項から確定事項へ移した。

Watch for: ブロッキングな穴は無い（3メソッドすべてに `authorizer` + `authorizationType: COGNITO` が付き、`Bearer ` 接頭辞なし、トークンのモジュールスコープキャッシュなし＝いずれも確認済み）。残るのは文言経路の不整合 — `ERROR_MESSAGES.NoValidSession` を追加したが、ルート作成／検索条件の経路は `toAuthErrorMessage` を通らないためこの文言に到達しない（confirmed）。401 の本文がそのまま画面に出る点も未解消（likely、計画で対象外と明記）。

**Verdict**: APPROVED

## High-level view

IaC 側は `MethodOptions` を1つの定数（`cognitoAuthorized`）にまとめ、3箇所の `addMethod` へ同じオブジェクトを渡す形。個別に書き写すより漏れにくく、`authorizationType` も省略せず明示している。既存の論理ID（`UserPool` / `MichishiruApi` 等）は変更なし、CloudFront の `cachePolicy` / `originRequestPolicy` も差分に含まれない。

テストは「NONE が0件」ではなく「COGNITO_USER_POOLS 以外のメソッドはちょうど1件で、それは `password-reset-verifications` リソースのもの」という形に変えている。レビュー観点の文面（NONE が0件）とは異なるが、実コードには照合APIという4つ目のメソッドがあり、これはログイン前に呼べなければ機能しない。計画書と steering の「照合APIの保護」行の両方がこの前提を明記しているため、この読み替えは正しく、しかも「無認可のメソッドを足したら落ちる」という保護の意図は保てている。論理IDを直書きせず `findResources` から引いているのも CDK の生成規則への依存を避けていて良い。

フロントは `fetchIdToken` をリクエストごとに呼び、取得できなければ `null` を返さず `name = 'NoValidSession'` の例外を投げる。キャッシュしない理由（idToken は1時間、散歩はそれより長い、`fetchAuthSession` がリフレッシュトークンで自動更新する）がコメントに残っている。ヘッダー値はトークンそのもので、新規テストが `'dummy-id-token'` との厳密一致で接頭辞なしを固定している。

ただしコメントが主張する「セッション切れの文言への変換は `toAuthErrorMessage` 側の責務」は現状成り立っていない。`toAuthErrorMessage` の呼び出しは `authStore.js` だけで、ルート作成・検索条件の composable は `error.message` をそのまま表示する。実害は文言の質（「有効なセッションがありません」が出る）に留まるが、追加した辞書エントリは今の経路では死んでいる。

`tools/localApiServer.js` は `Authorization` の中身を一切見ない。`127.0.0.1` 限定・デプロイ対象外という根拠と「検証はしない」旨がコメントにあり、ダミー値も UUID 形式を避けている（`local-dev-user` / `local-dev`）。スコープは `backend/` / `router/index.js` / composables に一切触れておらず、steering も naming-glossary が追加3行・削除0行、前提条件が追加3行・削除2行（API Gateway 行の書き換え1行と「API の認可」行の除去1行）で計画どおり。

<details>
<summary>Issues (6)</summary>

1. **`NoValidSession` の文言が到達しない** — `ERROR_MESSAGES.NoValidSession` を引く `toAuthErrorMessage` は `authStore.js` からしか呼ばれず、ルート作成・検索条件の composable は `error.message` を直接表示する。文言を活かすなら composable 側で変換を通すか、辞書追加を見送る。
2. **401 の本文が英語で画面に出る** — API Gateway のオーソライザーは `{"message":"Unauthorized"}` を返し、`routeService.extractErrorMessage` がそれを拾う。計画で対象外と明記済みだが、デプロイ後に目に見える形で残る。
3. **`VITE_ROUTE_API_URL` 経由で idToken が別オリジンへ出得る** — `fetchRoute` のURLは env で任意のオリジンに差し替えられる設計（既存）で、今回そこに idToken が乗る。`fetchRoute` に本番の呼び出し元は無いため現時点では潜在的。別API Gatewayへ向ける運用を続けるなら、向き先を同一オリジンに限る前提を明文化したい。
4. **`IdentitySource` を検証していない** — ヘッダー名 `Authorization` は CDK の既定に依存しており、フロントはその名前に固定で依存している。テンプレートの `IdentitySource` をテストで固定しておくと、既定変更や明示指定ミスで全リクエストが落ちる事故を防げる。
5. **バックエンド無効時にオーソライザーが作られないことの検証が無い** — オーソライザーは `withBackend` ブロック内にあるが、フロントのみのスタックで `AWS::ApiGateway::Authorizer` が0件であることを確かめるテストが無い。
6. **検証結果の記録がタスクディレクトリに無い** — `.agents/tasks/` には `plan.md` のみで、lint / build / test / cdk synth の実行結果を残したファイルが無い。本レビューはコーダーの最終メッセージに記録があることを前提に、指示どおりスイートの再実行はしていない。

</details>

<details>
<summary>Details</summary>

## 認可の付け忘れを構造で防いでいる

3メソッドへの適用は共有の `MethodOptions` 定数を渡す形になっている。

```ts
const cognitoAuthorized: apigateway.MethodOptions = {
  authorizer: apiAuthorizer,
  authorizationType: apigateway.AuthorizationType.COGNITO
};
```

`routes` の GET / POST と `conditions` の GET の3箇所がこの定数を受け取り、`password-reset-verifications` の POST だけが第3引数を持たない。付け忘れ・片方だけ付けるといった食い違いが起きにくい形になっている。加えて `cdk synth` は「オーソライザーを作って1つもメソッドへ紐付けない」状態を例外にするため、紐付け漏れは合成段階でも検出される。

## 未認証メソッドの件数を1件に固定するテスト

3本目のテストが今回の要点で、`AWS::ApiGateway::Resource` から `PathPart === 'password-reset-verifications'` の論理IDを引き、`AuthorizationType !== 'COGNITO_USER_POOLS'` のメソッドがちょうど1件かつその `ResourceId.Ref` がそのIDと一致することを確認している。無認可のメソッドを足せば件数で落ち、照合API以外を無認可にすれば参照先の不一致で落ちる。CORS 設定が無く `OPTIONS` が生成されないため現状この「1件」は安定するが、CORS を後から足すとこのテストは見直しが必要になる。

## 文言経路の不整合

`routeService.js` / `conditionService.js` のコメントは `fetchIdToken` の例外を上位へ流す理由として「セッション切れの文言への変換は `toAuthErrorMessage` 側の責務」と書いている。実際の受け手は以下のとおりで、変換は挟まらない。

```
fetchIdToken (throw NoValidSession)
  → routeService / conditionService （そのまま伝播）
    → useRouteCreation / useRouteConditionOptions / useGenreOptions
       catch (error) { errorMessage.value = error.message; }   ← 変換なし
```

結果として画面に出るのは `new Error('有効なセッションがありません')` のメッセージで、辞書に追加した「ログインの有効期限が切れました。もう一度ログインしてください」（再ログインを促す文言）には到達しない。どちらも日本語なので致命的ではないが、コメントの主張と実装が食い違っており、追加した辞書エントリは `authStore` 経由の呼び出し元が現れるまで使われない。

</details>

<details>
<summary>変更ファイル</summary>

| ファイル | 変更内容 |
|---|---|
| `iac/lib/michishiru-stack.ts` | `CognitoUserPoolsAuthorizer` を追加し、共有 `MethodOptions` で3メソッドへ適用 |
| `iac/test/iac.test.ts` | オーソライザーの型・名前、保護3メソッド、未認証は照合API1件のみ、を検証する3テストを追加 |
| `frontend/src/services/authService.js` | `fetchAuthSession` の import、`fetchIdToken`、`ERROR_MESSAGES.NoValidSession` を追加 |
| `frontend/src/services/routeService.js` | `fetchRoute` / `createRoute` の2つの fetch に `Authorization` を追加 |
| `frontend/src/services/conditionService.js` | `fetchConditionOptions` の fetch に `Authorization` を追加 |
| `frontend/src/services/__tests__/routeService.test.js` | 新規。ヘッダー付与・接頭辞なし・例外伝播を検証 |
| `frontend/src/services/__tests__/conditionService.test.js` | 新規。ヘッダー付与・整形の成功系・例外伝播を検証 |
| `tools/localApiServer.js` | `requestContext.authorizer.claims` のダミー値を追加 |
| `.kiro/steering/naming-glossary.md` | 「認証」節へ `idToken` / `sub`、更新履歴に1行（追加3・削除0） |
| `.kiro/steering/ミチシル_前提条件.md` | API Gateway 行の追記、「API の認可」を確定事項へ移動、更新履歴に1行 |

差分の取得: `git diff`（作業ツリー、未コミット）

</details>
