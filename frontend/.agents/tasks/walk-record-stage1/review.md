# 散歩の実績計測（段階1 / フロントのみ）のレビュー

案内終了後の結果画面が表示する「総距離・巡ったスポット・所要時間」を、`createRoute` の予測値から実際に歩いた実績へ差し替えた変更。実績は画面をまたぐため新しい Pinia ストア `walkStore` に置き、距離の積算は現在地の `watch` を持つ新 composable `useWalkRecord` が担う。案内画面が開始・終了・到達状況の同期を受け持ち、結果画面は表示元を `routeStore.currentRoute` から `walkStore` へ差し替えただけに収まっている。スコープ指定どおり `useRouteProgress.js` / `useLocationTracking.js` / `geoDistance.js` / `routeStore.js` / `WalkResultStats.vue` / `global.css` / `backend/` / `iac/` / `docs/` は一切変更されていない（`git status` で確認済み、変更3・新規2ファイル）。

依頼で指定された仕様（ストアの状態・computed・アクション、6つのガードの順序と挙動、画面側の呼び出し位置、用語辞書の8語＋履歴1行）はすべて仕様どおりに実装されている。ガード④（飛び＝再アンカーする）と⑤（ゆらぎ＝据え置く）の差も、意図と理由がコメント付きで正しく書かれている。

**Watch for:** `MAX_SEGMENT_DISTANCE_M=200` と `useLocationTracking` の精度上限 100m の組み合わせで、精度が 200m より悪い測位が続く環境では④と⑤が互いを塞ぎ、距離が一切積まれない帯域ができる（confirmed）。この場合 `hasLocationFix` が `false` のまま結果画面に「位置情報を取得できなかったため」と出るが、実際には測位はできている（confirmed）。加えて `plan.md` 手順6の手動確認①〜⑥が未実施で、しきい値と2回目リセットという本変更の核心部分が未検証（confirmed）。いずれもコードの誤りではなく、PR前に片付けるべき残作業と仕様の確認点。

**Verdict**: APPROVED

## High-level view

状態の置き場所の判断が妥当。`/navigation` → `/result` の `router.push` で案内画面はアンマウントされ composable の `ref` は消えるため、実績は Pinia に置くしかない。それを `routeStore`（条件と予測値）に相乗りさせず別ストアにしたことで、`resetConditions()` と `resetWalk()` を独立して呼べるようになっている。結果画面の `handleReturnHome()` が両方を並べて呼ぶ形は素直。

積算ロジックの要は `useWalkRecord` のガードの並び順で、そこは正しく実装されている。特に、初回測位前は `currentLocation` がフォールバック座標（新宿）のままなので `accuracy === null` で弾く①が効いており、起点が偽の座標に打たれない。`useLocationTracking` が `currentLocation` と `accuracy` を同一タックで両方更新するため watch が1回しか走らず、①を通った時点で両方が実測値になっている点も結果的に噛み合っている。

一方で、しきい値の設計には既存コードとの境界で穴がある。`MAX_SEGMENT_DISTANCE_M=200` は④で区間を切り捨て、⑤は `max(accuracy, 10)` 未満を切り捨てる。精度が 200m を超える測位が採用され続けると両者の間に隙間がなくなり、どんな区間も加算されない。`useLocationTracking` は通常 100m 超を弾くが、10秒間採用が途切れた場合の救済パス（`MAX_POSITION_AGE_MS`）は精度を問わず採用するため、到達可能な状態になっている。

`hasLocationFix` は「一度でも距離を加算できたか」を表すフラグで、文言の「位置情報を取得できなかったため」とは意味がずれている。`plan.md` は「一歩も動かなかった場合」の取り違えを既知として挙げているが、上記の精度帯の場合も同じ文言が出る。依頼で指定された仕様なので変更はしていないが、確認対象。

`hasWalkRecord` は仕様で要求されたとおり実装されているものの、どこからも参照されていない。

検証は lint・build のみ。フロントのテストツールが未決定（`naming-conventions.md` 未決定事項 #4）という前提は正しく、記録も残っているが、しきい値の挙動と2回目の散歩でのリセットは lint・build では一切確認できない。

<details>
<summary>Issues (4)</summary>

1. **精度 200m 超で距離が積まれない帯域**（confirmed / 非ブロッキング） — `MAX_SEGMENT_DISTANCE_M=200` と⑤の `max(accuracy, 10)` の間に隙間がなくなり、どの区間も加算されない。`useLocationTracking` の stale 救済パス経由で到達しうる。安全側（過大計上しない）に倒れているため段階1では許容できるが、段階2でDBへ保存する前にしきい値の関係を見直すこと。
2. **`hasLocationFix` と注記文言のずれ**（confirmed / 仕様確認） — フラグの実体は「距離を一度でも加算できたか」で、測位の成否ではない。測位できていても文言が出るケースが `plan.md` の挙げる「一歩も動かなかった」以外にもある（上記1）。文言は依頼指定なので変更していないが、依頼者に確認すること。
3. **`hasWalkRecord` が未使用**（confirmed / 非ブロッキング） — 仕様で要求された computed だが参照箇所がない。段階2で使う予定があるならそのままでよいが、`hasLocationFix` と役割が混同されやすいので用途を決めること。
4. **手動確認①〜⑥が未実施**（confirmed / PR前に必須） — `plan.md` 手順6が未実行で、しきい値の挙動・到達カウント・2回目のリセットが未検証。`git-workflow.md` はPRの前提条件に「動作確認済み」を挙げているため、PR作成前に実施すること。

</details>

<details>
<summary>Details</summary>

### ガードの並びと、しきい値が作る死角

`useWalkRecord` の6つのガードは依頼どおりの順序で、④と⑤の差（再アンカーするか据え置くか）も正しい。据え置きの理由（小さな移動が累積してしきい値を超えた時点でまとめて積める）もコメントに書かれている。`previousPosition` は素の `let` で、代入はすべて `{ lat, lng }` の展開コピー。参照共有はしていない。

問題は値の組み合わせ側にある。有効な区間と判定されるには次の両方を満たす必要がある。

```
segmentDistanceM <= MAX_SEGMENT_DISTANCE_M              // ④ 200m 以下
segmentDistanceM >= max(accuracy, MIN_SEGMENT_DISTANCE_M) // ⑤ 精度以上
```

`accuracy > 200` のとき、この2条件を同時に満たす `segmentDistanceM` は存在しない。つまり測位は届いていて `watch` も走っているのに、`addDistanceM` が一度も呼ばれず `totalDistanceM` は 0、`hasLocationFix` も `false` のまま終わる。

`useLocationTracking` は `MAX_ACCEPTABLE_ACCURACY_M = 100` で精度の悪い測位を弾くため通常は起きないが、2つの抜け道がある。初回測位は `isFirstFix` で精度を問わず採用される。採用が10秒途切れると `isPositionStale` でやはり精度を問わず採用される。後者は精度の悪い環境では継続的に成立しうるため、`accuracy` が 200 を超えた状態が続く経路が実在する。

誤差の方向は安全側（歩いていない距離を積まない）なので段階1の表示としては許容できる。ただし段階2でこの値をユーザーごとにDBへ保存すると、「0km の散歩記録」が残ることになる。しきい値の関係（`MAX_SEGMENT_DISTANCE_M` を精度に応じて動かす、あるいは精度の上限を超えた測位を `useWalkRecord` 側でも弾く）は、保存を入れる前に決めておく必要がある。

### `hasLocationFix` が表しているもの

`addDistanceM` が加算に成功した時だけ `true` になる設計のため、このフラグは「測位できたか」ではなく「距離を積めたか」を表している。結果画面の文言は「位置情報を取得できなかったため、実績を計測できませんでした」で、前半が実体と一致しない。

`plan.md` は「測位はできていても一歩も動かなかった場合は `false` のまま」を既知の制約として明記しており、依頼指定の仕様として扱う判断は妥当。ただし上記の精度帯のケースは `plan.md` の記載に含まれておらず、文言が実態から外れる経路がもう1つある。文言を「実績を計測できませんでした」だけに留めるか、`hasWalkRecord` と組み合わせて出し分けるかは、依頼者の判断を取ってから決めるのが筋。

### 画面側の呼び出し順序

`onMounted` の `startWalk()` → `startTracking()`、`handleConfirmEnd()` の `endWalk()` → `router.push`、`watch(visitedSpotIds, ...)` の `deep` 省略はいずれも依頼どおり。`endWalk()` の位置は `elapsedMinutes` が `endedAt ?? Date.now()` を見る computed であるため必須で、`deep` 省略は `useRouteProgress` が `visitedSpotIds.value = [...visitedSpotIds.value, spotId]` で配列を丸ごと差し替えることで成立している。`walkStore.visitedSpotIds` の初期値と `startWalk()` のリセット後の値がどちらも `[]` のため、watch が未発火の間も同期ずれは生じない。

### 規約との突き合わせ

単位サフィックス（`totalDistanceM` / `totalDistanceKm` / `segmentDistanceM` / `elapsedMinutes` / `MIN_SEGMENT_DISTANCE_M` / `MAX_SEGMENT_DISTANCE_M`）、camelCase / UPPER_SNAKE_CASE、Boolean の `has` プレフィックス、`defineStore('walk', ...)` の単数形小文字ID、`@/` エイリアス、import の並び（vue → utils → stores、composable 群・store 群内のアルファベット順）はいずれも規約どおり。`routeStore.js` と比べて JSDoc の密度・文体も揃っている。

マジックナンバーは `METERS_PER_KM` / `MILLISECONDS_PER_MINUTE` として定数化され、式の中に 1000 / 60000 の裸の数字は残っていない。

結果画面の注記は `global.css` の既存 `.hint`（kebab-case、12px・グレー）を流用しており、`role="status"` も付いている。`global.css` は未変更。`WalkResultView.vue` は `computed` の import と旧 `spotCount` computed がともに削除されており、未使用の import・変数は残っていない。`WalkResultStats.vue` の3つの props はすべて `Number` の `required: true` だが、`totalDistanceKm`（常に数値）/ `spotCount`（配列長）/ `elapsedMinutes`（`startedAt === null` で 0 を返す）はいずれも `null` / `undefined` を返さないため型要求を満たす。

用語辞書は「ルートとスポット」へ5語、「画面と操作」へ3語、更新履歴へ1行が既存行と同じ列数・同じ記法で追記されている。表の構造は壊れていない。

### 検証記録について

記録は残っており、lint・build ともに最終状態で成功している。1回目のビルド失敗は `node_modules/aws-amplify` 未インストールという環境側の問題で、`package.json` / `package-lock.json` に差分がないことも確認されている（`git status` でも未変更）。本変更に起因しないという判断は妥当。

未テストの範囲は本変更の核心と重なる。④の飛び判定、⑤のゆらぎ判定と据え置きによる累積、`startWalk()` / `resetWalk()` による2回目の散歩でのリセット、到達カウントのストアへの同期は、いずれも lint・build では検出できない。フロントのテストツールが未決定という前提は規約どおりだが、`git-workflow.md` はPRの前提条件に「動作確認済み」を明示しているため、`plan.md` 手順6の①〜⑥はPR作成前に実施が必要。

</details>

<details>
<summary>変更ファイル</summary>

| ファイル | 内容 |
|---|---|
| `frontend/src/stores/walkStore.js` | 新規。実績（総距離・到達スポット・開始終了時刻・測位フラグ）を保持する Pinia ストア |
| `frontend/src/composables/useWalkRecord.js` | 新規。現在地の watch で、ゆらぎと飛びを除いた区間距離をストアへ積算する |
| `frontend/src/views/RouteNavigationView.vue` | 計測の開始・終了と到達スポットのストア同期を追加。テンプレートは無変更 |
| `frontend/src/views/WalkResultView.vue` | 集計値の表示元を予測値から実績へ差し替え、未計測時の注記を追加 |
| `.kiro/steering/naming-glossary.md` | 計測・時間系の8語と更新履歴1行を追記 |

差分: `git diff`（`frontend/src/stores/walkStore.js` と `frontend/src/composables/useWalkRecord.js` は未追跡のため `git status --porcelain` で確認）

</details>
