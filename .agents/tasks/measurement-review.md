# 散歩実績の計測信頼性（段階3a・フロントのみ）— 3回目のレビュー

欠落の検知を「1回でも起きたら記録」から「継続時間がしきい値（60秒）を超えたら記録」へ変えたイテレーション3の差分。検知口は従来どおり2つで、測位エラーは `setTimeout` で途切れの継続を測り、画面の非表示は hidden 時刻を控えて復帰時に実測で判定する。あわせて前回の指摘だった Wake Lock の in-flight 取りこぼしと View 側配線の未テストが解消されている。保存・トースト・オフライン退避は段階3bのため含まれない。

前回の4件はすべて決着した。#1（in-flight 取りこぼし）は `isRequesting` / `isReleaseRequested` の2フラグで修正され、待ち合わせ中のアンマウントでロックを捨てる経路までテストされている。#2・#3（感度）はチーム判断（しきい値60秒・文言は変更しない）を受けて実装済み。#4（View 配線の未テスト）は `RouteNavigationView.test.js` の6件でしきい値の両側と購読・タイマーの後始末が固定された。

**Watch for:**
- 低精度の測位が届き続ける区間は、`trackingError` が null へ戻るため欠落として検知されない。距離が積まれないまま `complete` になりうる（confirmed）。
- 測位エラーが周期的に復帰すると、そのたびにタイマーが捨てられる。断続的な不調は検知されない（confirmed）。
- しきい値の定数が View とテストに二重定義されている（confirmed）。

**Verdict**: APPROVED

## High-level view

`measurementStatus` の判定順序（測位ゼロ → 欠落検知 → 距離0 → それ以外）とラッチの方針、順序を固定するテストはイテレーション3で触られていない。今回の変更は欠落の「解釈」を持つ View 側だけに収まっている。

測位エラーの検知はタイマー方式になった。エラーが立つと60秒のタイマーを張り、`trackingError` が null へ戻った時点で捨てる。残る穴は `trackingError` を唯一の根拠にしている点で、`useLocationTracking` は精度を問わず測位が届いた時点でエラーを null へ戻すのに対し、`useWalkRecord` は精度100m超の測位では距離を積まない。この差の区間（測位は届くが距離にならない）は検知されず `complete` に落ちる。

画面の非表示側はタイマーを使わず、hidden の時刻を控えて復帰時に実測で差を取る。バックグラウンドではタイマーが凍結・間引かれるためこの形でしか長さを測れない。副作用として、立ち止まっていた間の非表示でも継続時間だけで `partial` が確定し、実損がゼロでも注記が出る。文言を変えない決定とセットの受け入れ済みのトレードオフ。

Wake Lock は非同期境界の穴が埋まった。取得中の再呼び出しは弾かれ、待ち合わせ中に解放を求められた場合は解決したロックをその場で捨てる。`releaseScreenWakeLock` を外から呼んだ直後に `requestScreenWakeLock` を重ねると、どちらのロックも残らず再試行もされない経路が残るが、View は解放を自前で呼ばないため実際には到達しない。

用語辞書は削除0行で、用語5件と更新履歴2行の追記のみ。`lastDistanceAddedAt` の説明が「判定に使う」になっており、本段階では判定に使わないという実装のコメントと食い違っている。スコープ外ファイルは1つも触られておらず、コミットもされていない（HEAD は `origin/feature/NZ-176` と同一）。

<details>
<summary>Issues (8)</summary>

1. **低精度の測位が続く区間は検知されない** — `useLocationTracking` は精度を問わず測位が届けば `trackingError` を null にするが、`useWalkRecord` は精度100m超では距離を積まない。この区間は欠落として記録されず `complete` になる。段階3bで `lastDistanceAddedAt` を判定に加えるか、精度の継続的な悪化を別の検知口として扱う。
2. **エラーの点滅でタイマーが毎回捨てられる** — `RouteNavigationView.vue` の `watch(trackingError, ...)` は null へ戻るたびに `clearGapTimer()` するため、しきい値未満で復帰を繰り返す断続的な不調は永久に記録されない。累積の中断時間を持つか、復帰の回数を見る案を段階3bで検討する。
3. **実損ゼロの非表示でも partial が確定する** — 立ち止まっている間に60秒以上画面を隠すと、失われた距離がなくても注記が出る。しきい値方式の受け入れ済みの副作用だが、注記の文言が「実際より短く表示されている」と断定的なため、利用者の体感と合わない場面が残る。
4. **待ち合わせ中の release → request でロックが残らない** — `useScreenWakeLock.js` で `isRequesting` が立っている間の `requestScreenWakeLock()` は何もせず抜けるため、直前に `releaseScreenWakeLock()` が呼ばれていると解決したロックは捨てられ、再取得も走らない。View からは到達しないが、`releaseScreenWakeLock` を公開している以上、解放要求の後に再要求が来たら取り直す形にするか、JSDoc で順序の前提を明記する。
5. **しきい値の定数が二重定義** — `MEASUREMENT_GAP_THRESHOLD_MS` が `RouteNavigationView.vue` と `RouteNavigationView.test.js` の両方に60000として書かれている。View から export するか `constants/` へ出して1か所にする。
6. **用語辞書の説明が実装と食い違う** — `lastDistanceAddedAt` の説明が「計測が途切れていないかの判定に使う」だが、実装は記録のみで判定に使っていない。「段階3bの判定材料として記録する」等に直す。
7. **未テストの経路** — Wake Lock の `release` イベントで `isScreenAwake` が false へ戻ること、画面復帰時に Wake Lock を取り直すこと、`WalkResultView` が計測状態ごとに注記を出し分けることのテストが無い。とくに3つ目は利用者が直接見る出力。
8. **plan.md が実装に追いついていない** — `.agents/tasks/plan.md` の手順4は即時 `markMeasurementGap()` のままで、しきい値方式の実装と食い違う。経緯は `verification.md` にしかないため、計画側も更新しておく。

</details>

<details>
<summary>Details</summary>

### 欠落検知の根拠にしている信号

```js
watch(trackingError, (message) => {
  if (message === null) {
    clearGapTimer();
    return;
  }
  if (walkStore.hasMeasurementGap || gapTimerId !== null) {
    return;
  }
  gapTimerId = setTimeout(() => { ... }, MEASUREMENT_GAP_THRESHOLD_MS);
});
```

`watch` は値が変わった時だけ走るため、TIMEOUT から POSITION_UNAVAILABLE へメッセージが変わってもタイマーは張り直されない（`gapTimerId !== null` で弾かれる）。途切れの「開始時刻」が保たれる形になっている。

問題は `trackingError` を唯一の根拠にしている点。`useLocationTracking.handlePositionUpdate` は精度の採否に関わらず先頭で `trackingError.value = null` を実行する。一方 `useWalkRecord` のガード③は `accuracy > MAX_MEASURABLE_ACCURACY_M`（100m）で積算せずに return する。したがって「測位は毎回届くが精度が悪く距離にならない」区間では、エラーは一度も立たずタイマーも張られない。`markLocationFixed()` は呼ばれるので `hasLocationFix` は true、距離も良い測位の区間で積まれてゼロではないため、`measurementStatus` は `complete` を返す。実際には大きく足りていない実績が、注記なしで出る。

これは `trackingError` が「測位が届いているか」の信号であって「距離が積めているか」の信号ではないことから来る。後者を表す値（`lastDistanceAddedAt`）は今回ストアに入ったが判定には使われていない。計画の設計判断4で「信号待ち・休憩を誤検知するため今回は入れない」と理由付けされており、段階3aの合意範囲内。

点滅の件も同じ `watch` の性質から来る。50秒おきに1点だけ測位が届く環境では、届くたびに `trackingError` が null へ戻ってタイマーが捨てられ、次のエラーで60秒の計測が振り出しに戻る。中断の合計は散歩全体に及ぶのに `complete` のまま出る。「継続時間」の定義をそのまま実装した結果だが、しきい値方式の弱点として残る。

### 画面の非表示側がタイマーを使わない理由

```js
if (document.visibilityState === 'hidden') {
  hiddenAt = Date.now();
  return;
}
if (hiddenAt !== null && Date.now() - hiddenAt >= MEASUREMENT_GAP_THRESHOLD_MS) {
  walkStore.markMeasurementGap();
}
```

非表示中は `setTimeout` が間引かれるか凍結されるため、こちら側でタイマーを使うと中断の長さを測れない。復帰時に実測する形はその制約を回避している。コメントの「復帰せずに案内が終わることがない」も、終了ボタンが表示中しか押せない前提から成り立っている。

しきい値60秒の根拠はコメントで追え、参照している2つの定数は実コードと一致する（`useWalkRecord.js` の `MAX_SEGMENT_DISTANCE_M` = 200、`useRouteProgress.js` の `ARRIVAL_THRESHOLD_M` = 40）。徒歩約1.25m/sで200mは約160秒、40mの円を直径で通過すると約64秒で、短い方に合わせた導出になっている。

### Wake Lock の非同期境界

前回の指摘は埋まっている。`isRequesting` で取得中の再呼び出しを弾き、`await` の後で `isReleaseRequested` を見て、立っていれば解決したロックを保持せず捨てる。テストは `request` の resolve をテスト側から起こせるスタブで、待ち合わせ中のアンマウントでも `release()` が呼ばれることを固定している。

残る経路は解放要求と再要求が交差する場合。

```
request #1 → isRequesting = true, await 中
release()  → isReleaseRequested = true（sentinel は null なので素通り）
request #2 → isRequesting が true なので何もせず return
#1 解決    → isReleaseRequested が true なのでロックを捨てる
```

結果としてロックは1つも残らず、`isRequesting` が false に戻った後も誰も取り直さない。`isReleaseRequested` を `false` へ戻すのは `requestScreenWakeLock` の本体に入れた時だけなので、弾かれた #2 はそのフラグをクリアできない。View は `releaseScreenWakeLock` を呼ばず（composable の `onBeforeUnmount` に任せている）、そのフックは View 側の `onBeforeUnmount` より先に走って以降の再要求も起きないため、現状の使い方では到達しない。ただし戻り値として `releaseScreenWakeLock` を公開しており、JSDoc も「呼び出し側で取得済みかどうかを見張る必要はない」と書いているため、契約としては食い違いが残る。

### 定数の参照

`'complete'` / `'partial'` / `'unavailable'` の文字列は `walkStore.js` の `MEASUREMENT_STATUS` 定義にしか存在せず（`frontend/src` 全体を grep して確認）、View もテストも定数経由で参照している。

一方 `MEASUREMENT_GAP_THRESHOLD_MS` は View とテストの両方に `60000` が直接書かれている。View が export していないため、テストは同じ値を自前で持つしかない状態。View 側だけ値を変えるとテストの「しきい値の1ms手前では記録しない」が落ちるので、黙って壊れるのではなく失敗して気付ける。定数を View 内に置いた判断自体は既存の `ARRIVAL_THRESHOLD_M` / `DISTANCE_ROUNDING_UNIT_M` と同じ慣習に沿っている。

### テスト

`RouteNavigationView.test.js` は `vi.useFakeTimers()` でしきい値の両側を測り、`watchPosition` のコールバックを捕まえて測位の失敗・復帰をテスト側から起こしている。アンマウント後にタイマーも購読も残らないことを別のテストで固定しており、「次の散歩のストアへ書き込む」という事故を名指しで押さえている。

未テスト:
- Wake Lock の `release` イベントで `isScreenAwake` が false へ戻り `sentinel` が捨てられること（スタブの `addEventListener` は `vi.fn()` のままで、登録されたリスナーを呼んでいない）
- 画面復帰時に `requestScreenWakeLock()` が呼び直されること
- `WalkResultView` が `measurementStatus` に応じて注記を出し分けること（利用者が直接見る出力で、本段階の成果物そのもの）

### 検証記録とスコープ

`verification.md` にイテレーション3の3コマンド（lint / test / build）がいずれも終了コード0、テスト11ファイル99件で記録されている。指示どおりスイートの再実行はせず、`ARRIVAL_THRESHOLD_M` の値と状態文字列の所在のみスポットで確認した。

スコープ外ファイル（`useLocationTracking.js` / `useRouteProgress.js` / `useWalkRecord.js` / `routeStore.js` / `authStore.js` / `WalkResultStats.vue` / `global.css` / `backend/` / `iac/` / `tools/` / `docs/`）はいずれも `git status` に現れない。`git rev-list --count origin/feature/NZ-176..HEAD` が0で、コミットもプッシュもされていない。

用語辞書は追加7行・削除0行で、直近マージで入った既存の `2026/10/07` 行3本を保ったまま末尾に追記されている。追記先の表（「ルートとスポット」「画面と操作」）と列構成も崩れていない。`.agents/tasks/plan.md` の差分は計画作成時のもので、しきい値方式への変更が反映されていない点だけ実装と食い違う。

</details>

<details>
<summary>変更ファイル</summary>

| ファイル | 内容 |
|---|---|
| `.kiro/steering/naming-glossary.md` | 用語5件を追記（削除0行）＋更新履歴2行 |
| `frontend/src/stores/walkStore.js` | `MEASUREMENT_STATUS` / `hasMeasurementGap` / `lastDistanceAddedAt` / `measurementStatus` / `markMeasurementGap` を追加 |
| `frontend/src/views/RouteNavigationView.vue` | `MEASUREMENT_GAP_THRESHOLD_MS` の追加、測位エラーのタイマー判定、非表示の継続時間判定、Wake Lock の要求と後始末 |
| `frontend/src/views/WalkResultView.vue` | 注記を `measurementNote` の computed に集約し `v-if` を1本化 |
| `frontend/src/composables/useScreenWakeLock.js` | 新規。取得・解放と非同期境界のガード、限界のコメント |
| `frontend/src/stores/__tests__/walkStore.test.js` | 新規。判定順序とラッチ、初期化（10件） |
| `frontend/src/composables/__tests__/useScreenWakeLock.test.js` | 新規。未対応環境・取得・二重取得の抑止・待ち合わせ中と取得済みのアンマウント（5件） |
| `frontend/src/views/__tests__/RouteNavigationView.test.js` | 新規。しきい値の両側と購読・タイマーの後始末（6件） |

全差分: `git diff -- .kiro/steering/naming-glossary.md frontend` と未追跡4ファイル

</details>
