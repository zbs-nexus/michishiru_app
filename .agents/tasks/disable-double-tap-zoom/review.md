# ダブルタップ拡大の抑止（地図以外の操作用UI部品）

地図以外の操作用UI部品に CSS `touch-action: manipulation` を当て、ダブルタップ拡大だけを止める変更。global.css に要素セレクタの共通ルールを1つ追加し、非ボタンの重なり部品（`.popup` / `.bottom-actions` / `.toast` / `.next-spot-banner` / `.review-toggles` / `.review-form`）に1行ずつ足している。viewport、地図、`.content` / `.screen` / `body`、既存の `touch-action: none` は未変更。作業ツリーは `feature/NZ-306` のままで、コミットやブランチ操作の痕跡はない。

Watch for: 実機（iPhone / Android）でしか確認できない点が残る（confirmed: jsdom では検証不能と verification.md に明記済み）。ブロックする問題は見つからなかった。

**Verdict**: APPROVED

## High-level view

共通ルールは `:where(button, a, label, summary, select, input, textarea, [role="button"]):not(.maplibregl-canvas-container *)`。特異度が 0 に近く、`.review-form-handle` / `.photo-viewer` の `touch-action: none`（scoped、特異度が高い）に負けない。さらに `touch-action` は祖先との積集合で決まるため、`.review-form`（manipulation）の子であるハンドルも `none` のまま動く。地図のマーカーやピンは `.maplibregl-canvas-container` の子孫なので除外される。

ピンチ拡大は止めていない。`index.html` は差分なしで、`user-scalable` / `maximum-scale` も入っていない。

テストは要件4点を宣言レベルで検証している。検証結果は verification.md に記録済み（lint・build・vitest 210件成功、dist の CSS に共通ルールが残っていることも確認済み）。再実行はしていない。記録に疑問を持つ点はなかった。

<details>
<summary>Issues (3)</summary>

1. **地図コントロールの `a` / `button` にも共通ルールが当たる（possible, 非ブロック）** — MapLibre のズーム・現在地ボタンや著作権表示のリンクは canvas コンテナの外にあり、manipulation が付く。plan.md で意図した挙動（連打による画面拡大の防止）。compass の `none` は MapLibre 側の特異度が高く勝つ。実機確認項目に入っているので対応不要。
2. **`touch-action: none` の全件検査は2ファイルのみ（likely, 非ブロック）** — テストは `ReviewPostForm.vue` と `ReviewPhotoViewer.vue` の `none` 維持と global.css に `none` が無いことを確認するが、`src/` 全体で `none` が増えていないことは見ていない。別ファイルに `none` が足されても検知できない。実害は小さいので任意の強化。
3. **参照コメントの文言が不揃い（confirmed, 非ブロック）** — `.popup` は「上の共通ルールのコメント」、`.bottom-actions` は「共通ルールのコメント」、他は「global.css の共通ルールのコメント」。意味は同じなので、次に触るときに揃える程度でよい。

</details>

<details>
<summary>Details</summary>

## 地図に manipulation が付かないこと

共通ルールの除外は `:not(.maplibregl-canvas-container *)`。MapLibre は canvas とマーカー（`.maplibregl-marker`）をこのコンテナ内に置くため、地図内の `button`（ピン等）は対象外になる（confirmed: global.css 214行、dist にも残存と記録済み）。`RouteMap.vue` / `RouteMapPreview.vue` / `RouteNavigationMap.vue` には `touch-action` の宣言が無い（grep で確認）。`.content` / `.screen` / `body` にも付いていない。

## 既存の `touch-action: none`

`touch-action` を含む全宣言を grep で洗った。`none` は `ReviewPhotoViewer.vue` 225行と `ReviewPostForm.vue` 659行の2か所のみで、いずれも行は未変更。`manipulation` は global.css 3か所と scoped 4か所で、同じブロックに `none` と混在していない。共通ルールの `:where` により特異度が最小なので、宣言順に関わらず個別指定が勝つ。

## 漏れの確認

plan.md の一覧と突き合わせた。ボタン類（次へ・前へ・終了・モーダルのボタン・トーストの閉じる・口コミ切り替え・フォーム内の入力欄・ホームの選択ボタン・スライダー・認証画面・メニュー）は共通ルールで覆われる。非ボタンの重なり部品は上記6つの個別指定で覆われる。plan.md の「対象外」（見出し・本文）は意図どおり未対応。

## 途中状態の取りこぼし

差分に途中で切れた CSS、重複コメント、不要ファイルは見当たらない。未追跡は `.agents/tasks/disable-double-tap-zoom/` と `frontend/src/assets/styles/__tests__/` のみ。`dist` / `cdk.out` は ignore 済み。

## テスト

`global.test.js` の7件が要件を検証している。(1) 共通ルールに manipulation と各タグ、(2) 地図コンテナの除外、(3) 重なり部品6つ、(4) 地図コンポーネントに manipulation なし、(5) `none` の維持と非混在、(6) pan-x / pan-y / pinch-zoom 無し、(7) viewport に拡大禁止なし。配置は `assets/styles/__tests__/global.test.js` で `.test` 命名、`vitest` から import しており、directory-structure.md に沿う。

## 規約

新しい用語・クラス名・ファイル名は無く、用語辞書の追記は不要。共通指定は global.css、固有の外枠は scoped という component-design.md の方針どおり。

</details>

<details>
<summary>File map</summary>

- `frontend/src/assets/styles/global.css` — 共通ルールと `.popup` / `.bottom-actions` への1行
- `frontend/src/components/base/BaseToast.vue` — `.toast`
- `frontend/src/components/feature/route/RouteNextSpotBanner.vue` — `.next-spot-banner`
- `frontend/src/components/feature/review/ReviewPostForm.vue` — `.review-form`
- `frontend/src/views/RouteNavigationView.vue` — `.review-toggles`
- `frontend/src/assets/styles/__tests__/global.test.js` — 新規テスト7件

差分全体: `git -C c:/ミチシル開発/michishiru_app diff`

</details>
