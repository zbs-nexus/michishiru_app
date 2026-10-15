# 実装計画 — 散歩の実績計測（段階1 / フロントエンドのみ）

対象リポジトリ: `c:\ミチシル開発\michishiru_app`（Windows / PowerShell）
作業ブランチ: `feature/NZ-230`（現在のブランチ。worktree は作らない）
コミット・プッシュはしない。`backend/` `iac/` `docs/` は一切変更しない。

## ゴール

案内終了後の `WalkResultView` が表示する「総距離・巡ったスポット・所要時間」を、`createRoute` の予測値から**実際に歩いた実績値**へ差し替える。

## 設計の前提と判断

| # | 判断 | 理由 |
|---|---|---|
| 1 | 実績は Pinia の新ストア `walkStore` に置く | `/navigation` → `/result` の `router.push` で `RouteNavigationView` がアンマウントされ、composable 内の `ref` は破棄される。画面をまたぐ状態は Pinia で持つ（`directory-structure.md` / `component-design.md`） |
| 2 | `routeStore` には足さず別ストアにする | `routeStore` は「作成条件と作成済みルート（予測値）」の責務。実績は別の関心事。`resetConditions()` と `resetWalk()` を分けて持てる |
| 3 | 距離の積算ロジックは composable（`useWalkRecord`）に置き、ストアには加算だけさせる | ストアは副作用（`watch`）を持たない方針。`useRouteProgress` と同じ「現在地の `watch` → 判定」の形に揃える |
| 4 | `useWalkRecord` の戻り値は空オブジェクト `{}` | `component-design.md` の「composable の戻り値はオブジェクトで返す」を満たしつつ、公開する状態が無いことを示す。JSDoc に明記する |
| 5 | 積算のアンカー `previousPosition` は非リアクティブな `let` | テンプレートから参照しない内部状態。`ref` にすると自分の `watch` を無駄に再評価させる。`useLocationTracking.js` の `watchId` / `lastAcceptedAt`、`useToastMessage.js` の `timerId` と同じ扱い |
| 6 | 「実績を計測できませんでした」の注記は global.css の既存 `.hint` を流用 | `RouteConditionView.vue:133-137` が同じ用途（12px・グレー・`role="status"`）で使っている。`global.css` は変更しない。`<style scoped>` も不要 |
| 7 | 距離の単位は内部をメートル（`totalDistanceM`）で持ち、表示直前に km へ変換 | `calculateDistanceM` がメートルを返す。丸め誤差の累積を避ける。`WalkResultStats` の props は `distanceKm` のままなので `totalDistanceKm` computed で渡す |
| 8 | フロントのテストは追加しない | テストツール未決定（`naming-conventions.md`「未決定事項 #4」）。`frontend/package.json` の scripts は `dev` / `build` / `preview` / `lint` / `lint:fix` のみ。検証は `npm run lint` と `npm run build`、加えて `npm run dev` での手動確認 |

### 既知の制約（実装者が独断で変えないこと）

- `hasLocationFix` は `addDistanceM()` が呼ばれた時にのみ `true` になる。つまり測位はできていても**一歩も動かなかった**場合は `false` のままで、結果画面に「位置情報を取得できなかったため…」の注記が出る。これは依頼で指定された仕様なので、この計画では変更しない。文言や判定条件を変えたくなった場合は勝手に直さず確認を取る。
- `elapsedMinutes` の `Date.now()` は computed 内の非リアクティブな値なので、`endedAt` が `null` の間は依存（`startedAt` / `endedAt`）が変わるまで再計算されない。結果画面は `endWalk()` 後に読むため実害はない。案内中にリアルタイム表示したくなった段階で見直す。
- `frontend/.agents/` は `.gitignore` に入っていない。この計画ファイルは未追跡のまま残すこと（`git add` しない）。`.gitignore` の変更はスコープ外。

---

## 計画

- [ ] 1. 用語辞書に新しい用語を追記する（コードより先に辞書を更新するルールのため最初に行う）。
      `.kiro/steering/naming-glossary.md` の「### ルートとスポット」表（末尾は 80 行目の `MAX_ROUTE_DEVIATION_M` の行）の直後に、計測・距離系の 5 行を追記する。続いて「### 画面と操作」表（114-121 行目、末尾は `| ロード中 | loading | 処理中の状態 |` の行）の直後に、時間系の 3 行を追記する。最後に末尾の「## 更新履歴」表（最終行は 265 行目）へ 1 行追記する。追記する内容は以下のとおり（既存行と同じ列数・同じ記法）:

```markdown
<!-- ### ルートとスポット 表の末尾へ -->
| 実績の総距離 | totalDistanceM | 実際に歩いた距離（メートル）。GPSの軌跡から積算する |
| 測位できたかどうか | hasLocationFix | 一度でも現在地を採用できたか。できていない場合は実績を計測できない |
| 区間距離 | segmentDistanceM | 前回採用した地点から現在地までの距離（メートル） |
| 採用する最小区間距離 | MIN_SEGMENT_DISTANCE_M | これを下回る移動はGPSのゆらぎとみなして積算しない。`useWalkRecord.js` の定数 |
| 採用する最大区間距離 | MAX_SEGMENT_DISTANCE_M | これを上回る移動は測位の飛びとみなして積算しない。`useWalkRecord.js` の定数 |

<!-- ### 画面と操作 表の末尾へ -->
| 散歩の開始時刻 | startedAt | 案内を開始した時刻 |
| 散歩の終了時刻 | endedAt | 案内を終了した時刻 |
| 経過時間 | elapsedMinutes | 案内の開始から終了までの時間（分） |

<!-- ## 更新履歴 表の末尾へ -->
| 2026/10/07 | 散歩の実績計測に伴い totalDistanceM / startedAt / endedAt / elapsedMinutes / hasLocationFix / segmentDistanceM / MIN_SEGMENT_DISTANCE_M / MAX_SEGMENT_DISTANCE_M を追加 |
```

      上の `<!-- -->` は追記位置を示すための注記であり、ファイルには書かない。
      表を分ける理由は、距離・測位は既存の `distanceToNextM` / `MAX_ACCEPTABLE_ACCURACY_M` と同じ系統、開始・終了・経過時間は `walk` / `walkResult` と同じ「散歩という行為」の系統だから。
      既存の `visitedSpotIds` / `visitedCount` / `walkResult` / `spotCount` / `totalDistance` は登録済みなので追記しない（`totalDistanceKm` も `totalDistance` の単位違いのため追記不要）。
      Files: `.kiro/steering/naming-glossary.md`
      Verify: 追記した 2 つの表と更新履歴が Markdown の表として壊れていないことを確認する（列数が 3 / 2 で揃っているか、`|` の数が既存行と一致するか）。ファイルは Markdown のみなのでビルド検証は不要。

- [ ] 2. 実績を保持する Pinia ストアを新規作成する。
      `frontend/src/stores/walkStore.js` を作る。`routeStore.js` と同じ setup 形式・同じ JSDoc の密度で書く（ファイル先頭に `@description` のブロックコメント、各 `ref` / `computed` に 1 行コメント、各アクションに `@description` / `@param` / `@returns`）。
      import は `import { computed, ref } from 'vue';` と `import { defineStore } from 'pinia';` の 2 行（`routeStore.js:1-3` と同じ並び）。
      ファイル先頭の定数（UPPER_SNAKE_CASE、このファイル内に閉じる）: `const METERS_PER_KM = 1000;` と `const MILLISECONDS_PER_MINUTE = 60000;`。マジックナンバーを式に直接書かない。
      `export const useWalkStore = defineStore('walk', () => { ... })`（ID は単数形小文字）。
      状態（`ref`）: `totalDistanceM`（初期 `0`）/ `visitedSpotIds`（初期 `[]`）/ `startedAt`（初期 `null`、エポックms）/ `endedAt`（初期 `null`、エポックms）/ `hasLocationFix`（初期 `false`）。
      `computed`: `totalDistanceKm` = `totalDistanceM.value / METERS_PER_KM` / `spotCount` = `visitedSpotIds.value.length` / `elapsedMinutes` = `startedAt.value === null ? 0 : Math.round(((endedAt.value ?? Date.now()) - startedAt.value) / MILLISECONDS_PER_MINUTE)`（`endedAt` 未設定でも進行中の経過時間が読めるようにする。コメントで理由を書く）/ `hasWalkRecord` = `startedAt.value !== null`。
      アクション: `startWalk()`（`totalDistanceM` / `visitedSpotIds` / `endedAt` / `hasLocationFix` を初期値へ戻したうえで `startedAt.value = Date.now()`。2 回目の散歩で前回の距離が積み上がらないよう、開始時にリセットする旨をコメントで書く）/ `addDistanceM(distanceM)`（`Number.isFinite(distanceM)` でない場合は何もせず return、通ったら `totalDistanceM` に加算し `hasLocationFix.value = true`）/ `setVisitedSpotIds(spotIds)`（`[...spotIds]` でコピーして置き換える。到達済みを未到達へ戻さないラッチは `useRouteProgress` 側が担保しているのでここでは判定しない旨をコメントで書く）/ `endWalk()`（`endedAt.value = Date.now()`）/ `resetWalk()`（全状態を初期値へ）。
      `return` は `routeStore.js:97-112` と同じく「状態 → computed → アクション」の順に列挙する。
      Files: `frontend/src/stores/walkStore.js`（新規）
      Verify: `cd frontend; npm run lint` が新規ファイルで警告・エラーなしで通ること。この時点では誰からも import されていないのでビルドへの影響はない。

- [ ] 3. GPSのゆらぎを除いて距離を積算する composable を新規作成する。
      `frontend/src/composables/useWalkRecord.js` を作る。import は `import { watch } from 'vue';` / `import { calculateDistanceM } from '@/utils/geoDistance';` / `import { useWalkStore } from '@/stores/walkStore';`（vue → utils → stores の順。`useRouteProgress.js:1-5` と同じ `@/` エイリアス）。
      ファイル先頭に `@description` のブロックコメント（`useRouteProgress.js:7-15` と同じ文体で、「現在地の更新を watch し、ゆらぎと飛びを除いた区間距離だけをストアへ積算する」「判定の順序そのものがこの composable の本体である」ことを書く）。
      定数（このファイル内、UPPER_SNAKE_CASE、それぞれ「なぜその値か」のコメント付き）: `const MIN_SEGMENT_DISTANCE_M = 10;` / `const MAX_SEGMENT_DISTANCE_M = 200;`。
      シグネチャ: `export const useWalkRecord = ({ currentLocation, accuracy }) => { ... }`。JSDoc は `@param {object} sources 参照する状態` / `@param {import('vue').Ref<{lat: number, lng: number}>} sources.currentLocation 現在地` / `@param {import('vue').Ref<number|null>} sources.accuracy 位置情報の精度（メートル）` / `@returns {object} 公開する状態はない（空のオブジェクトを返す）`。
      内部で `const walkStore = useWalkStore();` を呼び、直接書き込む。
      アンカーは `let previousPosition = null;`（リアクティブにしない。理由をコメントで書く）。
      `watch([currentLocation, accuracy], () => { ... })` の中は**この順序で**ガードする。各ガードに「なぜそうするのか」の日本語コメントを付ける:
      ① `accuracy.value === null` なら即 `return`（初回測位前は `currentLocation` が `DEFAULT_CURRENT_LOCATION`（新宿）のままなので、弾かないと実際の現在地との間に巨大な偽の区間が生まれる）
      ② `previousPosition === null` なら `previousPosition = { lat: currentLocation.value.lat, lng: currentLocation.value.lng };` して `return`（最初の測位は起点を決めるだけで距離は積まない）
      ③ `const segmentDistanceM = calculateDistanceM(previousPosition, currentLocation.value);` が `null` なら `return`（座標が不正）
      ④ 飛び判定: `segmentDistanceM > MAX_SEGMENT_DISTANCE_M` なら**加算せず、`previousPosition` を現在地へ更新して** `return`（古いアンカーを残すと次回以降も巨大な区間を測り続けるため必ず再アンカーする）
      ⑤ ゆらぎ判定: `segmentDistanceM < Math.max(accuracy.value, MIN_SEGMENT_DISTANCE_M)` なら**加算せず、`previousPosition` は更新しないまま** `return`（アンカーを据え置くことで、小さな移動が累積してしきい値を超えた時点でまとめて加算される）
      ⑥ ここまで通ったら `walkStore.addDistanceM(segmentDistanceM);` を呼び、`previousPosition` を現在地へ更新する。
      `previousPosition` には `currentLocation.value` をそのまま代入せず、`{ lat, lng }` を展開してコピーする（`useLocationTracking` は毎回新しいオブジェクトを代入するので実害は出にくいが、参照を保持すると将来ミューテートされた時に静かに壊れる）。
      最後に `return {};`。
      Files: `frontend/src/composables/useWalkRecord.js`（新規）
      Verify: `cd frontend; npm run lint` が通ること（特に未使用変数が無いこと）。

- [ ] 4. 案内画面で計測を開始・停止し、到達済みスポットをストアへ同期する。
      `frontend/src/views/RouteNavigationView.vue` を変更する。テンプレートと `<style scoped>` は変更しない。
      - 2 行目の `import { computed, onMounted, ref } from 'vue';` に `watch` を追加（`computed, onMounted, ref, watch` のアルファベット順）。
      - 10 行目 `useRouteProgress` の import の次に `import { useWalkRecord } from '@/composables/useWalkRecord';` を追加（composable 群のアルファベット順）。
      - 11 行目 `useRouteStore` の import の次に `import { useWalkStore } from '@/stores/walkStore';` を追加（stores 群のアルファベット順）。
      - 20 行目 `const routeStore = useRouteStore();` の次に `const walkStore = useWalkStore();` を追加。
      - 39 行目の分割代入を `const { nextSpot, distanceToNextM, visitedSpotIds, isCompleted } = useRouteProgress({ ... });` に変更（`visitedSpotIds` を受け取る。`visitedCount` は使わないので受け取らない）。
      - `useRouteProgress` の呼び出し（39-44 行目）の直後に `useWalkRecord({ currentLocation, accuracy });` を 1 行で呼ぶ。戻り値は使わないので分割代入しない。直前に「距離の積算は戻り値を持たず、現在地の watch で walkStore へ書き込む」趣旨の 1 行コメントを置く。
      - `onMounted`（47-49 行目）を `onMounted(() => { walkStore.startWalk(); startTracking(); });` に変更。`startWalk()` を先に呼ぶ理由（リセットが後に走ると初回の測位で積んだ距離が消える）をコメントで書く。既存の「追跡の停止は useLocationTracking 側で…」のコメントは残す。
      - `useWalkRecord` の呼び出しの後に、到達済みスポットの同期を追加する:
        `watch(visitedSpotIds, (spotIds) => { walkStore.setVisitedSpotIds(spotIds); });`
        `useRouteProgress` は配列を丸ごと差し替える（`visitedSpotIds.value = [...]`）ため `deep` は不要。この点をコメントに書く。
      - `handleConfirmEnd()`（71-74 行目）で `router.push` の**前**に `walkStore.endWalk();` を呼ぶ。`endedAt` を確定させてから結果画面へ進む必要があるため、という理由をコメントで書く。
      Files: `frontend/src/views/RouteNavigationView.vue`
      Verify: `cd frontend; npm run lint` と `npm run build` が通ること。未使用の import / 変数が残っていないこと。

- [ ] 5. 結果画面の表示元を予測値から実績値へ差し替える。
      `frontend/src/views/WalkResultView.vue` を変更する。
      - 2 行目 `import { computed } from 'vue';` を**削除**する（手順内で `spotCount` の computed を消すと `computed` の利用が無くなり、残すと lint の未使用 import になる。ファイル内の他の `computed` 利用は無いことを確認済み）。
      - 8 行目 `import { useRouteStore } from '@/stores/routeStore';` の次に `import { useWalkStore } from '@/stores/walkStore';` を追加。
      - 15 行目 `const routeStore = useRouteStore();` の次に `const walkStore = useWalkStore();` を追加。
      - 17-21 行目の `spotCount` computed（と直前の JSDoc コメント）を削除する。代わりに `walkStore.spotCount` を使う。
      - ファイル先頭の `@description`（10-13 行目）を実態に合わせて更新する。「集計値は歩いたルートの情報から算出する」→「集計値は案内中に計測した実績（walkStore）から表示する。ルート作成時の予測値は使わない」という趣旨に書き換える。
      - テンプレートの `WalkResultStats`（53-57 行目）の props を差し替える:
        `:distance-km="walkStore.totalDistanceKm"` / `:spot-count="walkStore.spotCount"` / `:duration-minutes="walkStore.elapsedMinutes"`。
      - `WalkResultStats` の**直後**（同じ `.result-content` 内）に、測位できなかった場合の注記を追加する:
        `<p v-if="!walkStore.hasLocationFix" class="hint" role="status">位置情報を取得できなかったため、実績を計測できませんでした</p>`
        クラスは global.css の既存 `.hint`（kebab-case）を流用する。`<style scoped>` は追加しない。`global.css` は変更しない。
      - `handleReturnHome()`（25-29 行目）に `walkStore.resetWalk();` を追加し、`routeStore.resetConditions();` と並べる（`router.push` より前）。
      - `DefaultLayout` の `v-if="routeStore.currentRoute"` と `#footer` スロットの構造はそのまま。
      Files: `frontend/src/views/WalkResultView.vue`
      Verify: `cd frontend; npm run lint` と `npm run build` が通ること。`WalkResultStats.vue` の props は 3 つすべて `required: true` の `Number` なので、`totalDistanceKm` / `spotCount` / `elapsedMinutes` が常に数値を返す（`null` や `undefined` にならない）ことをストアの実装と突き合わせて確認する。

- [ ] 6. 全体の検証（lint・ビルド・手動動作確認）を行う。
      `cd frontend; npm run lint` と `cd frontend; npm run build` を実行し、どちらもエラーなしで完了すること。`backend/` と `iac/` は変更していないため、それらのテストは実行不要（変更していないことを `git status --short` で確認する。差分が `.kiro/steering/naming-glossary.md`・`frontend/src/stores/walkStore.js`・`frontend/src/composables/useWalkRecord.js`・`frontend/src/views/RouteNavigationView.vue`・`frontend/src/views/WalkResultView.vue` の 5 ファイルと、未追跡の `frontend/.agents/` のみであること）。
      続いて `npm run dev`（リポジトリルート。フロント＋ローカルAPIが同時起動する）で手動確認する:
      ① ホーム → ルート作成 → 提案 → 決定で案内画面へ進める
      ② 案内画面で開発者ツールの Sensors から座標を複数回動かし、結果画面の「総距離」が予測値ではなく動かした分の実績になること（少しだけ動かした場合は `MIN_SEGMENT_DISTANCE_M` 未満なので増えないこと、遠くへ飛ばした場合は `MAX_SEGMENT_DISTANCE_M` を超えるので増えないこと）
      ③ スポットへ 40m 以内まで近づくと「巡ったスポット」が増え、結果画面にその数が出ること
      ④ 「所要時間」が案内の開始から終了までの経過分数になっていること
      ⑤ 位置情報をブロックしたまま案内を終了した場合に「位置情報を取得できなかったため、実績を計測できませんでした」が表示されること
      ⑥ 「ホームに戻る」→ もう一度ルートを作って案内 → 終了したときに、前回の距離・スポット数が積み上がっていないこと（`startWalk()` と `resetWalk()` の二重の初期化が効いている）
      Verify: 上記 ①〜⑥ がすべて期待どおりであること。`git commit` / `git push` は行わない。

---

## スコープ外（触らない）

`backend/` 全部、`iac/` 全部、`docs/` 全部、`frontend/src/composables/useRouteProgress.js`、`frontend/src/composables/useLocationTracking.js`、`frontend/src/utils/geoDistance.js`、`frontend/src/stores/routeStore.js`、`frontend/src/components/feature/walk/WalkResultStats.vue`、`frontend/src/assets/styles/global.css`、`.gitignore`、DB保存・API認可（段階2以降）、`git commit` / `git push`。
