# 段階3b: 散歩実績のDB保存（ユーザー単位） — イテレーション2のレビュー

前回のレビュー（verdict: CHANGES_REQUESTED / 指摘8件）を受けた修正を含む差分を見直した。blocking だった退避キューの持ち主なし問題は `{ walkId, ownerUsername, walkResult }` の形と「サインイン中の本人の分だけ送る」判定で閉じ、残り7件（`endedAt` の書式、`repository.js` のテスト、結果画面と `App.vue` の配線のテスト、`grant` の絞り込み、非表示と測位中断の二重計上、`startedAt` 未設定のガード、サーバー文言の非表示）もすべて実装・テストで固定されている。手元で再実行した検証も基準を上回った（backend 91件/12 suites、frontend lint 0・140件/16ファイル、iac build・20件）。

Watch for: 保存は結果画面の `onMounted` で起こすため、ブラウザの戻る／進むで結果画面が再マウントされると**別の `walkId`** で2件目が保存される（`attribute_not_exists(pk)` は別キーなので効かない。non-blocking / likely）。低精度の測位が続く区間は、その測位が現在地として採用されるまで中断として数え始めない（最大10秒遅れ。non-blocking / confirmed）。実績テーブルには `deletionProtection` も PITR も無く、隣のユーザープールとは保護の水準が揃っていない（non-blocking / confirmed）。

**Verdict**: APPROVED

## 高レベル像

冪等性の中核に初めてテストが通った。`repository.test.js` は `DynamoDBDocumentClient.from` を差し替えて送信コマンドを記録し、Put の `attribute_not_exists(pk)`、`pk`/`sk` の組み立て、累計の `ADD` 式と4つの値、`TOTAL` のキー、`TransactionCanceledException` の `ConditionalCheckFailed` 読み替え、条件エラーを再試行しないことを固定している。式のタイプミスがデプロイまで見えない状態は解消された。

退避と再送の持ち主問題は、退避項目に `ownerUsername` を持たせ、`flushPendingWalkResults` が①未サインインなら送らない②持ち主が一致する項目だけを送り他人の分は残す、の2段で閉じている。送信ボディには持ち主を載せないため、サーバーが `claims.sub` だけで利用者を決める前提も崩れていない。残るのは「誰の分とも一致しない項目」の扱いで、`ownerUsername` が null の項目や旧形式の項目は送られも捨てられもせず、20件の上限に押し出されるまで残る。

キーに入る値の縛りは `walkId`（UUID v4）に加えて `startedAt` / `endedAt`（UTCのISO 8601の正規表現＋実在する日時）まで広がり、非ISO形式・オフセット付き・制御文字を挟んだ `#` 混じりはいずれも弾かれる。利用者の識別も引き続きハンドラの `claims.sub` 1か所だけで、Validator はボディの `userId` を検証も採用もしない。

権限は `grant(fn, 'dynamodb:PutItem', 'dynamodb:UpdateItem')` へ絞られた。一方でテーブル自身の保護は `removalPolicy` だけで、スタック削除以外の経路（テーブルの直接削除、誤った項目更新）には備えがない。履歴取得APIも段階3bに無いため、累計が壊れたときに元の値から作り直す手段もない。

計測の欠落判定は、中断の累積に非表示側と測位側の両方を流す形のまま、`hiddenAt !== null` の間は測位側を数えないガードで二重計上を取り除いた。残る誤差は逆方向で、`useLocationTracking` は精度の悪い測位を原則採用しないため `accuracy` が更新されず、低精度区間は「初回」または「10秒間採用がない救済」で採用されるまで中断として数え始めない。短いバーストは数えないが、その間の移動は復帰時の直線距離で繋がるため、しきい値60秒の根拠（200m以内なら直線で繋がる）とは整合している。

スコープは計画どおり。`routeStore.js` / `authStore.js` / `useRouteProgress.js` / `useLocationTracking.js` / `WalkResultStats.vue` / `global.css` / 既存4 Lambda / CloudFront の `cachePolicy`・`originRequestPolicy` / `docs/` はいずれも未変更で、`walkStore.js` の差分は段階3aの未コミット分（追加72・削除0）のまま。`useWalkRecord.js` は `export` 追加とコメント3行だけで積算のガードは動いていない。コミットもプッシュもされていない（HEAD は develop のマージコミット）。

<details>
<summary>Issues (5)</summary>

1. **結果画面の再マウントで2件目の実績が増える** — `walkId` は保存のたびに `crypto.randomUUID()` で作るため、結果画面が2回マウントされると別キーになり `attribute_not_exists(pk)` では弾けない。ブラウザの戻る→進むで案内画面を経由すると `startWalk()` が走って計測状態が `unavailable` になるため累計は守られるが、その間に測位が1回通ると `walkCount` が距離0のまま1増える。`walkId` を散歩ごと（`startWalk` 時）に決めるか、保存済みかどうかを控えて2回目を送らない。
2. **低精度区間の中断を数え始めるのが最大10秒遅れる** — `isMeasurementInterrupted` は `accuracy` を見るが、`useLocationTracking` は精度の悪い測位を採用しないため `accuracy` が更新されない。`MAX_POSITION_AGE_MS`（10秒）の救済で採用されるまで中断として数えず、10秒未満のバーストは一切数えない。実害は小さい（復帰時の直線距離で繋がる）ため、現状維持でよいならコメントに「採用された測位の精度でしか判定できない」ことを書き残す。
3. **持ち主が一致しない退避項目が残り続ける** — `flushPendingWalkResults` は `ownerUsername` が現在のユーザーと一致しない項目を `continue` で飛ばすだけなので、`ownerUsername` が null の項目（保存の待ち合わせ中にサインアウトした場合）や旧形式の項目は送られも捨てられもせず、20件の上限に押し出されるまで残る。送れないと確定した項目（持ち主が null・`walkResult` を持たない）は捨てる。
4. **実績テーブルに deletionProtection と PITR が無い** — `removalPolicy: RETAIN` はスタック削除だけを守る。同じスタックのユーザープールは `deletionProtection: isProd` を持つのに、再生成できない散歩の履歴を持つこのテーブルには無い。履歴取得APIもエクスポートも無いため、消えた場合に戻す手段がない。prod では `deletionProtection: isProd` と `pointInTimeRecoverySpecification` を検討する。
5. **しきい値が View とテストに二重定義** — `MEASUREMENT_GAP_THRESHOLD_MS`（60000）が `RouteNavigationView.vue` とそのテストの両方に書かれている（段階3aからの繰り越し）。値がずれればテストが落ちるため黙って壊れることはないが、`MAX_MEASURABLE_ACCURACY_M` と同じく `export` して1か所にできる。

</details>

<details>
<summary>Details</summary>

## 保存の起点が「画面のマウント」であること

`walkId` を決めるのは `buildCurrentWalkResult()` で、呼ばれるたびに `crypto.randomUUID()` が走る。したがって冪等性が効くのは「同じペイロードを送り直す」経路（退避キューからの再送）だけで、「同じ散歩をもう一度組み立てて送る」経路には効かない。計画の判断1にある「万一重なっても `walkId` の冪等性で累計は増えない」は、後者には当てはまらない。

実際に起きる経路は次のとおり。

```
/result（1件目を保存）
  ├ 戻る ─▶ /navigation が再マウント ─▶ startWalk()（距離0・測位なしに戻る）
  └ 進む ─▶ /result が再マウント ─▶ 2件目を保存（別の walkId）
```

再マウント時のストアは `startWalk()` 直後なので `startedAt` は入っており、`saveCurrentWalkResult` の未開始ガードは通り抜ける。多くの場合は `hasLocationFix === false` で `measurementStatus` が `unavailable` となり、`createWalkResultWithoutTotals` を通るため累計は汚れない（`WALK#` の項目だけが1件増える）。ただし再マウントから「進む」までの間に測位が1回でも通ると `partial` になり、`createWalkResultWithTotals` 経由で `walkCount` が1増える。距離とスポット数は0なので平均値だけが狂う。

再読み込みでは `meta.requiresRoute` と `routeStore.hasRoute`（Pinia はメモリのみ）で条件入力画面へ戻されるため、この経路は戻る／進むに限られる。`walkId` を `startWalk()` の時点で決めてストアに持たせれば、2回目は条件エラーで止まり 200 が返る。

## 低精度区間を数え始める時点

`isMeasurementInterrupted` は `trackingError !== null` と `accuracy > MAX_MEASURABLE_ACCURACY_M`（100m）の論理和。後者が効くのは `accuracy` が更新されたときだけで、`useLocationTracking.handlePositionUpdate` は精度が悪い測位を次の3条件以外では採用しない。

| 条件 | 内容 |
|---|---|
| `isFirstFix` | `accuracy` がまだ null（初回） |
| `isReliableAccuracy` | 精度が `MAX_ACCEPTABLE_ACCURACY_M`（100m）以内 |
| `isPositionStale` | 直前の採用から `MAX_POSITION_AGE_MS`（10秒）以上経過 |

つまり良い測位の直後に精度150mの測位が届き続けても、10秒間は `accuracy` が良い値のまま据え置かれ、中断としては数えない。10秒経って救済で採用された時点から数え始め、以降は（採用のたびに10秒の猶予が入るものの）悪い値が居座るため中断は継続する。結果として1回の低精度区間は最大10秒短く数えられ、10秒未満のバーストは数えられない。

ただし採用が止まっている間 `currentLocation` は動かず、復帰時に `useWalkRecord` が `MIN_SEGMENT_DISTANCE_M`〜`MAX_SEGMENT_DISTANCE_M`（200m）の区間として直線で繋ぐ。しきい値を60秒にした根拠（短い中断は200m以内に収まるので損失が出ない）と同じ理屈で、数え落とす区間はもともと注記を出す必要のない長さに収まっている。判定の口が `accuracy` の採用に依存することをコメントに残しておけば足りる。

## 退避キューに残り続ける項目

`flushPendingWalkResults` の判定は1本。

```js
if (pendingResult.ownerUsername !== authStore.username) {
  continue;
}
```

他人の分を残すのは意図どおり（その人がサインインしたときに送られる）。一方で、どのユーザーにも一致しない項目は再送の対象にならず、捨てる経路も無い。該当するのは2種類で、どちらも `MAX_PENDING_COUNT`（20件）に押し出されるまで残る。

- `ownerUsername` が null の項目: `saveCurrentWalkResult` は失敗を捕まえた時点の `authStore.username` を控える。通信の待ち合わせ中にサインアウトされた場合は null が入り、`null !== 'alice'` で永久に飛ばされる。
- 旧形式の項目: イテレーション1の実装は9キーのペイロードを直接積んでいた。既存の端末に残っていれば `ownerUsername` も `walkResult` も無く、やはり飛ばされ続ける（未デプロイのため実機には存在しないが、形が変わったことは記録しておきたい）。

`walkResult` を持たない項目や持ち主が null の項目は、再送できないと確定しているため捨てるのが素直。持ち主を `username` ではなく `sub` にすると、上の null は避けられないままなので、判定を足す方が効く。

## テーブルの保護

```ts
const walkResultTable = new dynamodb.TableV2(this, 'WalkResultTable', {
  tableName: `WalkResult-${stage}`,
  billing: dynamodb.Billing.onDemand(),
  removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY
});
```

`removalPolicy` は CloudFormation がテーブルを消さないようにするだけで、コンソールや CLI からの削除、誤った項目更新は対象外。同じスタックの `userPool` は `deletionProtection: isProd` を付けており、保護の水準が揃っていない。`routeTable` も同じく未設定だが、あちらはシードで作り直せるデータで、こちらは利用者が歩いた記録そのもので再生成できない。累計（`TOTAL`）は `ADD` の単調増加で、段階3bには履歴取得APIも削除APIも無いため、壊れても元の値から組み直せない。PITR はオンデマンド課金のテーブルでも追加費用がかかるため、prod だけに付ける形（`isProd` で切り替え）が現実的。

## スコープと規約

変更ファイルは計画の一覧と一致し、前回から増えたのはテスト3ファイル（`repository.test.js` / `WalkResultView.test.js` / `App.test.js`）と各ファイルの修正のみ。`git status` にスコープ外のファイルは現れていない。

規約面の確認結果。レイヤー責務は `process.env` を読むのが `constants.js` だけ、Repository に業務判断なし（条件エラーを `{ isStored: false }` という事実で返し、成功と解釈するのは Service）、Validator は純粋関数、Handler は受付と整形のみ。命名は `create-walk-result`（npm 制約の kebab-case）、`WalkResult-<環境>`（PascalCase単数形＋後置の環境識別子）、`CreateWalkResultFunction`、`/api/v1/walk-results`（複数形）、`WalkResultTableName` の出力、いずれも規則どおり。用語辞書は `ownerUsername` を含めて先に追記され、既存行の削除はない（追加16行・削除0行）。テストの配置とファイル名（`__tests__/*.test.js`、`.spec` なし）も揃っている。

</details>

<details>
<summary>変更ファイル</summary>

| ファイル | 種別 | 内容 |
|---|---|---|
| `.kiro/steering/naming-glossary.md` | 変更 | 用語12件（3a分4件＋3b分8件）と更新履歴4行を追記 |
| `iac/lib/michishiru-stack.ts` | 変更 | `WalkResultTable` / `CreateWalkResultFunction` / `POST /api/v1/walk-results` / 出力を追加。権限は `PutItem` と `UpdateItem` のみ |
| `iac/test/iac.test.ts` | 変更 | 認可を4メソッドへ更新し、テーブル・Lambda・経路・権限の4件を追加 |
| `backend/shared/constants/errorCodes.js` | 変更 | `UNAUTHORIZED` と 401 のマッピングを追加 |
| `backend/functions/createWalkResult/` | 新規9ファイル | handler / service / repository / validator / constants / package.json / テスト3件 |
| `tools/localApiServer.js` | 変更 | ローカルハーネスに `POST /api/v1/walk-results` を登録 |
| `frontend/src/utils/pendingWalkResults.js` | 新規 | `localStorage` への退避（上限20件・`walkId` で置き換え） |
| `frontend/src/services/walkResultService.js` | 新規 | 保存APIの呼び出しと再試行可否の名前付け |
| `frontend/src/composables/useWalkResultSave.js` | 新規 | ペイロードの組み立て・退避（持ち主付き）・本人分だけの再送 |
| `frontend/src/views/WalkResultView.vue` | 変更 | `onMounted` で保存を起動し、失敗をトーストに出す（＋3a の注記） |
| `frontend/src/App.vue` | 変更 | ログイン時と `online` 復帰時の再送を配線 |
| `frontend/src/views/RouteNavigationView.vue` | 変更 | 中断時間の累積による欠落判定（非表示との二重計上を除去） |
| `frontend/src/composables/useWalkRecord.js` | 変更 | `MAX_MEASURABLE_ACCURACY_M` を `export`（ロジックは無変更） |
| フロント・バックのテスト | 新規6・変更1 | `pendingWalkResults` / `walkResultService` / `useWalkResultSave` / `WalkResultView` / `App` / `repository` / `RouteNavigationView`（6→10件） |

検証コマンドの再実行結果: `backend` 91件(12 suites) / `frontend` lint 0・140件(16ファイル) / `iac` build・20件。

</details>
