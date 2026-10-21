# Implementation Plan — 前の目的地に戻るボタン + 口コミ切り替えの1段化

作業場所: `c:\ミチシル開発\michishiru_app`（ワークツリーなし。コミットしない）
検証コマンドはすべて `c:\ミチシル開発\michishiru_app\frontend` で実行する: `npm run lint` / `npm run build` / `npm test`（= `vitest run`）。

## 設計上の決定（理由つき）

- 「前の目的地」= `visitedSpotIds` の末尾。`advanceToNextSpot` は常に `nextSpot`（`spots` の順で最初の未到達）を末尾に追加するだけなので、末尾 = ルート順で最後に到達済みにしたスポット。末尾を取り除けば `nextSpot` は自動的にそのスポットへ戻る（computed なので追加の状態は不要）。
- 戻れる条件 `canReturnToPreviousSpot` = `visitedSpotIds.length > 0`。到達済み0件（1スポット目・散歩開始直後）は false でボタンを出さない。
- 全到達後（`isCompleted`）でも戻れるようにする（採用）。誤って最後のスポットで「次の目的地へ」を押した場合も同じ困りごとが起きるため。戻すとバナーは完了メッセージから最後のスポットの案内へ戻り、「次の目的地へ」ボタンも再表示される。
- 配列は `advanceToNextSpot` と同じく丸ごと差し替える（`slice(0, -1)`）。View の `watch(visitedSpotIds)` が deep なしで拾い、`walkStore.setVisitedSpotIds` → 結果画面の `spotCount` も1減る。地図の足跡は `RouteMap.vue` の `watch(() => props.visitedSpotIds)` → `applySpotMarkerState`（`classList.toggle('is-visited', …)` で双方向）で消えることを確認済み。地図側の変更は不要。
- レイアウト: 1段目（`top: 84px`）を左右対称にし、左に戻るボタン、右に既存の「次の目的地へ」。2段目に口コミ2トグルを1本のピルにまとめる。
  - 戻るボタンは `v-if="canReturnToPreviousSpot"` で出し分ける（非表示時は DOM に無い＝テストで `exists()` が false になり、支援技術にも出ない）。
  - 口コミのピルは戻るボタンの有無に関係なく固定位置 `top: 122px`（= 84px + 1段目の高さ 32px + 間隔 6px）に置き、位置が跳ねないようにする。1段目の2ボタンに `height: 32px`（`display: inline-flex; align-items: center; box-sizing: border-box`）を明示して段の高さを確定させる（現状の padding 8px + 12px 文字でほぼ同じ高さなので見た目はほぼ変わらない）。
  - 口コミのピルの左端は戻るボタンと同じ `left: max(12px, calc(50% - 203px))`（バナーの左端）に揃える。
- RouteNextSpotBanner.vue は変更しない。

---

- [ ] 1. `useRouteProgress.js` に `returnToPreviousSpot` と `canReturnToPreviousSpot` を追加する。
      - `canReturnToPreviousSpot = computed(() => visitedSpotIds.value.length > 0)`（JSDoc: 「前の目的地へ戻せるかどうか。到達済みが1件以上あるとき真」）。
      - `returnToPreviousSpot()`: `canReturnToPreviousSpot` が偽なら何もしない。真なら `visitedSpotIds.value = visitedSpotIds.value.slice(0, -1)`。JSDoc に「直前に到達済みにしたスポットを未到達へ戻し、次の目的地をそのスポットに戻す。足跡（到達済みのスタンプ）も消える。配列は丸ごと差し替える」と書く。
      - return オブジェクトに `canReturnToPreviousSpot` と `returnToPreviousSpot` を追加。
      - ファイル冒頭のコメント「到達済みのスポットは未到達へ戻さない。切り替えは一方向にのみ進める。」を「到達済みのスポットは、利用者が returnToPreviousSpot で戻した場合（直前の1件ずつ）にのみ未到達へ戻す。」へ変更。`visitedSpotIds` の JSDoc「ボタン操作で末尾にのみ追加する」を「ボタン操作で末尾に追加し、戻す操作で末尾から取り除く」へ変更。`@returns` の説明に「前の目的地へ戻す関数」を追記。
      - `frontend/src/stores/walkStore.js` 164〜165行のコメント（「到達済みを未到達へ戻さないラッチは useRouteProgress 側が担保している」）を「到達状況の増減は useRouteProgress 側が決めるため、ここでは判定せず渡された一覧をそのまま持つ」へ直す。51行の「visitedSpotIds と同じラッチの方針」という記述も事実と合わなくなるので「（一度立てたら戻さない）」だけに直す。コードの挙動は変えない。
      Files: frontend/src/composables/useRouteProgress.js, frontend/src/stores/walkStore.js
      Verify: `npm run lint` がエラーなし。

- [ ] 2. `useRouteProgress` の単体テストを新規作成する（現状テストなし）。
      `frontend/src/composables/__tests__/useRouteProgress.test.js`。`describe/test/expect` は `vitest` から import（既存の `useScreenWakeLock.test.js` 等と同じ書き方）。`spots = ref([{spotId:'spot-1',name:'A',lat:35.0,lng:139.0}, {spotId:'spot-2',...}, {spotId:'spot-3',...}])`、`currentLocation = ref({lat:35.0,lng:139.0})` で呼ぶ（geometry は省略＝直線距離）。観点:
      - 初期状態: `nextSpot` が spot-1、`canReturnToPreviousSpot` が false。
      - 到達済み0件で `returnToPreviousSpot()` を呼んでも `visitedSpotIds` は `[]`、`nextSpot` は spot-1 のまま。
      - `advanceToNextSpot()` ×2 → `returnToPreviousSpot()` で `nextSpot` が spot-2 に戻り、`visitedSpotIds` が `['spot-1']`（spot-2 が消える）、`canReturnToPreviousSpot` は true のまま。
      - さらに戻すと `[]`・`nextSpot` が spot-1・`canReturnToPreviousSpot` が false。
      - 全到達（×3）で `isCompleted` true・`nextSpot` null・`canReturnToPreviousSpot` true → 戻すと `isCompleted` false、`nextSpot` が spot-3、`visitedSpotIds` が `['spot-1','spot-2']`。
      - 戻すたびに配列の参照が変わる（`not.toBe(before)`）＝ deep なしの watch で拾える。
      - `visitedCount` が増減に追従する。
      Files: frontend/src/composables/__tests__/useRouteProgress.test.js（新規）
      Verify: `npm test` で新規テストを含め全テストが pass。

- [ ] 3. `RouteNavigationView.vue` に戻るボタンを追加し、口コミ2トグルを1本のピルへまとめる。（1 に依存）
      script:
      - `useRouteProgress` の分割代入（147〜151行付近）に `canReturnToPreviousSpot`, `returnToPreviousSpot` を追加。
      template（`RouteNextSpotBanner` と `.next-spot-btn` の間に追加）:
      ```vue
      <!--
        誤って「次の目的地へ」を押したときに1つ前へ戻す。戻したスポットの足跡も消える。
        到達済みが無い（1スポット目）ときは戻す先が無いため出さない。すべて巡った後も戻せる。
      -->
      <button
        v-if="canReturnToPreviousSpot"
        class="previous-spot-btn"
        type="button"
        aria-label="前の目的地に戻る"
        @click="returnToPreviousSpot"
      >
        ← 前の目的地
      </button>
      ```
      `.review-toggles` を以下へ置き換える（クラス名・`is-on`・`aria-pressed`・`toggleMyReviews`/`toggleOtherReviews` は維持）:
      ```vue
      <div class="review-toggles" role="group" aria-label="口コミのピンの表示">
        <span class="review-toggles-label" aria-hidden="true">口コミ</span>
        <button class="review-toggle review-toggle-mine" :class="{ 'is-on': showMyReviews }"
          type="button" :aria-pressed="showMyReviews" aria-label="自分の口コミ" @click="toggleMyReviews">
          <span class="review-toggle-dot" />自分
        </button>
        <button class="review-toggle review-toggle-other" :class="{ 'is-on': showOtherReviews }"
          type="button" :aria-pressed="showOtherReviews" aria-label="みんなの口コミ" @click="toggleOtherReviews">
          <span class="review-toggle-dot" />みんな
        </button>
      </div>
      ```
      （実際の属性は1行1属性の既存スタイルで改行する。）
      style（`<style scoped>`、色は `:root` の変数。`#F39C12` / `#8E44AD` / `#D8DEE4` は既存のまま）:
      - `.next-spot-btn`: 既存に `display: inline-flex; align-items: center; height: 32px; box-sizing: border-box;` を追加。コメントの「大きさは口コミの表示切り替えボタンと揃える」を「大きさは前の目的地に戻るボタンと揃える」に直す。
      - `.previous-spot-btn`（新規）: `position: fixed; top: 84px; left: max(12px, calc(50% - 203px)); z-index: 45; display: inline-flex; align-items: center; height: 32px; box-sizing: border-box; padding: 8px 12px; font-size: 12px; font-weight: 600; color: var(--primary-color); background: var(--white); border: 1px solid var(--primary-color); border-radius: 999px; box-shadow: var(--shadow); cursor: pointer;`。`:active` は `background: var(--bg-light)`。コメントで「バナーの左下に置き、左端をバナーの左端に揃える。主操作の『次の目的地へ』と区別するため白地に紫の文字・枠線にする」と説明。
      - `.review-toggles`: `position: fixed; top: 122px; left: max(12px, calc(50% - 203px)); z-index: 45; display: inline-flex; flex-direction: row; align-items: center; gap: 2px; min-height: 32px; box-sizing: border-box; padding: 2px; padding-left: 10px; background: var(--white); border-radius: 999px; box-shadow: var(--shadow);`。コメントに「top は 1段目（84px + 高さ32px）+ 間隔6px。戻るボタンが出ていないときも位置を動かさない（跳ねて誤タップするのを防ぐ）」と書く。
      - `.review-toggles-label`（新規）: `font-size: 11px; font-weight: 600; color: var(--text-gray); margin-right: 2px;`
      - `.review-toggle`: `display: inline-flex; align-items: center; gap: 6px; min-height: 28px; padding: 4px 10px; font-size: 12px; font-weight: 600; color: var(--text-gray); background: transparent; border: none; border-radius: 999px; cursor: pointer;`（個別の `box-shadow` は削除。外側のピルが持つ）。`.review-toggle.is-on` は `color: var(--text-dark); background: var(--bg-light);`。
      - `.review-toggle-dot` と `.review-toggle-mine.is-on .review-toggle-dot` / `.review-toggle-other.is-on .review-toggle-dot` は既存のまま（点は 12px→10px に縮めてもよいが既存どおりで可）。
      - 既存の `.review-toggles` コメント（左上に置く理由）は「バナーの左下・戻るボタンの下に置く」へ更新。
      Files: frontend/src/views/RouteNavigationView.vue
      Verify: `npm run lint` と `npm run build` がエラーなし。`npm run dev` で案内画面を開き、(a) 開始直後は左上に戻るボタンが無く、口コミのピルは top 122px の位置、(b)「次の目的地へ」を押すと左に「← 前の目的地」が出て、ピルの位置は変わらない、(c) 戻ると バナーの目的地が1つ前に戻り、地図のそのスポットの足跡が番号表示に戻る、(d) 全到達後も戻るボタンが出て押すと最後のスポットの案内に戻る、(e) 360px幅でピルがズームコントロール（右上）やバナーと重ならない、を目視確認（できない環境ならその旨を報告）。

- [ ] 4. `RouteNavigationView.test.js` に戻るボタンのテストを追加する。（3 に依存）
      既存ファイル `frontend/src/views/__tests__/RouteNavigationView.test.js` に `describe('RouteNavigationView の前の目的地に戻るボタン', …)` を追加。既存の `beforeEach`（pinia・fake timers・geolocation のモック）と `mountNavigationView()`（shallow）を流用する。テンプレートは `v-if="routeStore.currentRoute"` のため、マウント前に `useRouteStore().setCurrentRoute({ spots: [spot-1, spot-2, spot-3（spotId/name/lat/lng）], geometry: null })` を呼ぶ（`import { useRouteStore } from '@/stores/routeStore'` を追加）。shallow でも `DefaultLayout` がスタブになりデフォルトスロットが描画されない場合は、`mount(RouteNavigationView, { shallow: true, global: { stubs: { DefaultLayout: { template: '<div><slot /><slot name="footer" /></div>' } } } })` の専用ヘルパーを用意する（既存テストの `mountNavigationView` は変えない）。観点:
      - 開始直後は `.previous-spot-btn` が存在しない（`exists()` false）、`.next-spot-btn` は存在する。
      - `.next-spot-btn` を `trigger('click')` → `.previous-spot-btn` が表示され、`walkStore.visitedSpotIds` が `['spot-1']`。
      - `.previous-spot-btn` を click → `.previous-spot-btn` が消え、`walkStore.visitedSpotIds` が `[]`（ハンドラ `returnToPreviousSpot` が配線され、足跡の元データが消えることの確認）。`RouteNextSpotBanner` スタブの `spot-name` prop（`wrapper.findComponent(RouteNextSpotBanner).props('spotName')`）が `'A'`（spot-1 の name）に戻る。
      - 3回進めて全到達 → `.next-spot-btn` が消え `.previous-spot-btn` は存在する。click で `.next-spot-btn` が再表示され、バナーの `spotName` が spot-3 の name。
      - 口コミの2トグルが `aria-pressed="true"` で描画され、`.review-toggle-mine` の click で `aria-pressed="false"` になる（1段化で配線が壊れていないこと）。
      Files: frontend/src/views/__tests__/RouteNavigationView.test.js
      Verify: `npm test` で既存テストと新規テストがすべて pass。

- [ ] 5. 用語辞書を更新する。（1〜4 と独立。最後に実施）
      `.kiro/steering/naming-glossary.md` の「ルートとスポット」表:
      - `visitedSpotIds` の説明「到達したスポットのIDの一覧。到達後は未到達へ戻さない」→「到達したスポットのIDの一覧。到達した順に並ぶ。未到達へ戻すのは returnToPreviousSpot（末尾の1件ずつ）のみ」。
      - `advanceToNextSpot` の説明末尾に「誤って進めた場合は returnToPreviousSpot で戻す」を追記。
      - `advanceToNextSpot` 行の直後に2行追加:
        `| 前の目的地へ戻す | returnToPreviousSpot | 直前に到達済みにしたスポットを未到達へ戻し、次の目的地をそのスポットに戻すこと。足跡も消える。すべて巡った後も使える。useRouteProgress.js の関数 |`
        `| 前の目的地へ戻せるかどうか | canReturnToPreviousSpot | 到達済みのスポットが1件以上あるか。偽（1スポット目）のときは戻るボタンを出さない。useRouteProgress.js の computed |`
      - 末尾の更新履歴に1行追加: `| 2026/10/21 | 案内中に前の目的地へ戻すボタンの追加に伴い「ルートとスポット」へ returnToPreviousSpot / canReturnToPreviousSpot を追加。visitedSpotIds の「到達後は未到達へ戻さない」を、returnToPreviousSpot でのみ戻す旨へ変更 |`
      Files: .kiro/steering/naming-glossary.md
      Verify: 表の列数（3列）が崩れていないことを Markdown プレビューで確認し、`npm run lint` / `npm run build` / `npm test` を最終確認として再実行して全て通る。

## 最終確認（全項目完了後）
`c:\ミチシル開発\michishiru_app\frontend` で `npm run lint`、`npm run build`、`npm test` がすべて成功すること。コミットはしない。
