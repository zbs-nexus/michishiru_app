# 実装計画: ダブルタップ拡大の無効化（地図以外の操作用UI部品）

ブランチ: `feature/NZ-306`（切り替え・作成なし。コミット・プッシュなし）
作業ディレクトリ: `c:\ミチシル開発\michishiru_app\frontend`

## 0. 調査結果（実際に読んで確認したこと）

- `touch-action` の既存箇所は2か所だけ。いずれも `none`（スワイプ用）。
  - `ReviewPostForm.vue` `.review-form-handle`（scoped、特異度 0,2,0）。シートを上下にスワイプする `<button>`。
  - `ReviewPhotoViewer.vue` `.photo-viewer`（scoped）。写真の送りスワイプ。全画面の `<Teleport to="body">` のルート。中の閉じる／送りボタンはその子孫。
  - ほかは `dist/` のビルド成果物の MapLibre CSS のみ（compass ボタンに `none`。`.maplibregl-canvas-container.maplibregl-touch-*` に `pan-x pan-y`）。ソースには無い。
- `touch-action` は継承されない。ただし実効値は「要素＋祖先（最寄りのスクロールコンテナまで）の積集合」になる。したがって
  - 子に `manipulation` を足しても、祖先の `none` / `pan-x pan-y` は消えない（スワイプも MapLibre の設定も壊れない）。
  - 親要素1つに付ければ、その子孫（テキスト・非ボタン）も覆える。
- `global.css` に button の共通ルールは `button, input, select, textarea { font-family: inherit; }` の1つだけ（約191行付近）。ここに近い位置へ追記する。
- 地図まわりのクラス名: `.route-map` / `.route-map-canvas`（RouteMap.vue）、`.map-preview` / `.map-frame`（RouteMapPreview.vue）、`.navigation-map` / `.map-full`（RouteNavigationMap.vue）、MapLibre 側 `.maplibregl-map` / `.maplibregl-canvas-container` / `.maplibregl-ctrl-group`。これらには **付けない**。
- `.content`（DefaultLayout）にはルート提案画面で `RouteMapPreview` が入る。`.screen` も地図を含む。よって `.content` / `.screen` / `body` / `html` への一括指定は **しない**（地図の中まで届くため）。
- `index.html` の viewport は `width=device-width, initial-scale=1.0` のみ。変更しない。
- `vite.config.js` の test: jsdom、`src/**/__tests__/**/*.test.js`。既存の `RouteMap.test.js` に `readFileSync(resolve(process.cwd(), 'src/assets/styles/global.css'))` で CSS を読む前例がある（`process.cwd()` は `frontend`）。

## 1. 操作部品の一覧と覆い方

方針: **(A) 要素セレクタの共通ルールを global.css に1つ** ＋ **(B) 非ボタンの重なり部品はそれぞれの scoped / 既存の global ブロックに1行**。

### (A) global.css の共通ルール（ボタン類すべて）

対象: `button, a, label, summary, select, input, textarea, [role="button"]`（地図の canvas コンテナ内を除く）

| 部品 | ファイル | 覆うもの |
|---|---|---|
| 「次の目的地へ」`.next-spot-btn` / 「前の目的地」`.previous-spot-btn` | RouteNavigationView.vue | (A) button |
| 口コミ切り替え `.review-toggle`（2個） | RouteNavigationView.vue | (A) button |
| 終了ボタン `.primary-btn.full-width`（BaseButton） | BaseButton.vue / global.css | (A) button |
| 終了確認モーダルの `.popup-btn` 2個 | BaseModal.vue | (A) button |
| トーストの閉じる `.toast-close-btn` | BaseToast.vue | (A) button |
| 口コミフォーム内のボタン・入力欄（評価 `ReviewRatingInput`、写真 `ReviewPhotoInput`、`textarea` 等、閉じる、投稿） | ReviewPostForm.vue ほか | (A) button / input / textarea / select |
| 写真の全画面表示の閉じる・前後ボタン | ReviewPhotoViewer.vue | (A) button（ただし祖先 `.photo-viewer` の `none` との積集合で `none` のまま。スワイプは壊れない） |
| ホーム画面 `.select-btn`、`.random-icon-btn`、距離スライダー `input[type=range]` | RouteConditionForm.vue / BaseSlider.vue | (A) button / input |
| ルート提案画面 `.primary-btn` / `.secondary-btn`（`.action-buttons`） | RouteSuggestionView.vue | (A) button |
| ログイン／登録／再設定の入力欄・ボタン・リンク（`.auth-switch a`）、`PasswordVisibilityButton` | auth/* | (A) input / button / a |
| `SignOutMenu` の `.menu-btn` / `.menu-item` | SignOutMenu.vue | (A) button |
| 散歩結果のホーム画面ボタン | WalkResultView.vue | (A) button |
| MapLibre のズーム／現在地ボタン（`.maplibregl-ctrl-group button`、`.recenter-btn`） | MapLibre / RouteMap.vue | (A) button。canvas コンテナ外のコントロールなので覆う（連打で画面が拡大するのを防ぐ）。compass ボタンの `touch-action: none` は特異度が高く勝つ |

### (B) 非ボタンの重なり部品（親要素に1行）

| 部品 | 置き場所 | 追加先セレクタ |
|---|---|---|
| トースト | `components/base/BaseToast.vue` の `<style scoped>` | `.toast` |
| 次の目的地のバナー | `components/feature/route/RouteNextSpotBanner.vue` の `<style scoped>` | `.next-spot-banner` |
| 口コミ切り替えピルの枠（ラベルと隙間） | `views/RouteNavigationView.vue` の `<style scoped>` | `.review-toggles` |
| 口コミ投稿フォーム（シート全体） | `components/feature/review/ReviewPostForm.vue` の `<style scoped>` | `.review-form`（ハンドルは子孫で `none` のまま） |
| 終了確認モーダルの背景と札 | `assets/styles/global.css` の既存 `.popup` ブロック | `.popup`（`.popup-content` は子孫なので追加不要） |
| 下部アクション帯（距離表示ラベルなど） | `assets/styles/global.css` の既存 `.bottom-actions` ブロック | `.bottom-actions` |

置き場所の判断: steering `component-design.md`「全画面共通のみ global.css、固有は scoped」に従う。要素セレクタ（全画面に効く）は global.css、特定コンポーネントの外枠は scoped。`.popup` / `.bottom-actions` は元から global.css にあるクラスなので既存ブロックに足す。BaseModal / BaseToast はスタイルを持つ（Toast）・持たない（Modal）が、Modal は global の `.popup` で覆えるため Base 側の変更は不要。

### 対象外（付けない）

- 地図: `.route-map`, `.route-map-canvas`, `.map-preview`, `.map-frame`, `.navigation-map`, `.map-full`, `.maplibregl-map`, `.maplibregl-canvas-container`、およびその内側のマーカー・ピン（`.review-pin` 等のボタン）。
- `body` / `html` / `.screen` / `.content`（地図を含むため）。
- `index.html` の viewport メタ。
- 地図以外の説明文だけの領域（見出し・本文）。ダブルタップ拡大が起きうるが、要件は「操作用UI部品」。既知の範囲外として最終報告に書く。

## 2. 変更ファイルと追加内容

変更するファイルは次の5つ＋テスト1つ。コードは実装担当が書く（以下は案）。

1. `frontend/src/assets/styles/global.css`
   - 既存の `button, input, select, textarea { font-family: inherit; }` ブロックの直後に追加:

   ```css
   /*
    * 操作用のUI部品でダブルタップしても、ブラウザが画面を拡大しないようにする。
    * 口コミの切り替えなどを素早く2回押す誤操作で、画面が勝手に拡大して戻しにくくなるため。
    *
    * 止めるのはダブルタップによる拡大だけで、ピンチ拡大は許す（manipulation は
    * パンとピンチ拡大を残す）。視力が弱い人が文字を拡大できなくなるのを避けるため。
    * 同じ理由で index.html の viewport に user-scalable=no や maximum-scale は書かない
    * （ページ全体の拡大が止まり、iOS はそもそも無視する）。
    *
    * 地図の canvas コンテナの中には付けない。地図の拡大縮小は MapLibre が
    * 自前で扱い、touch-action も MapLibre が要素に設定するため、上書きしない。
    * touch-action は祖先との積集合で決まるので、touch-action: none を持つ
    * スワイプ用の要素（口コミフォームのハンドル・写真の全画面表示）も変わらない。
    * 特異度は低いまま（:where）にして、個別の指定が常に勝つようにする。
    */
   :where(button, a, label, summary, select, input, textarea, [role="button"]):not(.maplibregl-canvas-container *) {
     touch-action: manipulation;
   }
   ```
   - 既存 `.popup` ブロック（`position: fixed; inset: 0; ...`）に `touch-action: manipulation;` を1行追加（コメントは「理由は上の共通ルールのコメント」と短く参照）。
   - 既存 `.bottom-actions` ブロックに同じく1行。
   - 注意: `:where(...)` は iOS 14+/Chrome 88+ が前提。サポート外では規則ごと無視されるだけ（従来どおりの挙動に戻る）。実装担当は `:not(.maplibregl-canvas-container *)` の複合セレクタがビルド（Vite/lightningcss 変換）後も残っていることを `dist` の CSS で確認する。

2. `frontend/src/components/base/BaseToast.vue` — `.toast` に `touch-action: manipulation;`（コメント1行: 理由は global.css 参照、ピンチは許可）
3. `frontend/src/components/feature/route/RouteNextSpotBanner.vue` — `.next-spot-banner` に同上
4. `frontend/src/views/RouteNavigationView.vue` — `.review-toggles` に同上
5. `frontend/src/components/feature/review/ReviewPostForm.vue` — `.review-form` に同上。`.review-form-handle` の `touch-action: none` と周囲のコメントは **触らない**。
6. テスト（下記 4）

辞書（`naming-glossary.md`）の追加は不要（CSSプロパティのみ、新しい語を導入しない）。新規クラス名も作らない。`.kiro/steering` の更新も不要。

## 3. 地図・既存 `touch-action: none` を壊さないための確認方法

実装後に次を確認する。

1. `grep` で `touch-action` を全件洗う（`frontend/src` のみ。`dist` と `node_modules` は除く）。期待値:
   - `none` はちょうど2か所（`ReviewPostForm.vue` `.review-form-handle`、`ReviewPhotoViewer.vue` `.photo-viewer`）で、行は未変更。
   - `manipulation` は global.css の共通ルール・`.popup`・`.bottom-actions` と、scoped の4か所（`.toast` / `.next-spot-banner` / `.review-toggles` / `.review-form`）のみ。
   - `none` と `manipulation` が同じブロックに同居しない。
2. `manipulation` を持つセレクタに地図のクラス（`route-map`, `map-preview`, `map-frame`, `navigation-map`, `map-full`, `maplibregl-map`, `canvas`）が現れない。例外は共通ルールの `:not(.maplibregl-canvas-container *)` の除外指定のみ（テストで除去してから検査する）。
3. 重ならない確認: `.review-form`（manipulation）の子 `.review-form-handle`（none）は積集合で `none`。`.photo-viewer`（none）の子ボタンは (A) の manipulation が付くが積集合で `none`。どちらも要素自身が none なので動作は変わらない。
4. `.review-form-handle` の特異度（scoped で 0,2,0）が共通ルール（`:where` + `:not`、0,1,0）より高いので、`none` が勝つ。`dist` の CSS でも宣言順に依らず結果が同じことを確認する。
5. 実機確認項目は最終報告に載せる（下記 6）。

## 4. 追加するテスト

置き場所: `frontend/src/assets/styles/__tests__/global.test.js`（steering `directory-structure.md`「対象の隣に `__tests__/`、`<対象>.test.js`」に従う。`describe` / `test` / `expect` は `vitest` から import）。

既存 `RouteMap.test.js` の `blockOf` と同じ考え方で、`readFileSync(resolve(process.cwd(), 'src/...'), 'utf8')` で各ファイルを読む。`.vue` は `<style scoped>` 部分だけを対象に宣言を見る。

テスト項目:

1. 共通ルール: global.css に `touch-action: manipulation` を持つブロックがあり、そのセレクタに `button` / `a` / `input` / `textarea` / `select` / `label` が含まれる。
2. 共通ルールは地図の canvas コンテナを除外している（セレクタに `:not(.maplibregl-canvas-container *)` を含む）。
3. 重なり部品: `.popup`、`.bottom-actions`（global.css）、`.toast`（BaseToast.vue）、`.next-spot-banner`（RouteNextSpotBanner.vue）、`.review-toggles`（RouteNavigationView.vue）、`.review-form`（ReviewPostForm.vue）が各ブロックに `touch-action: manipulation` を持つ。
4. 地図に付けない: 上記ファイルすべてと RouteMap.vue / RouteMapPreview.vue / RouteNavigationMap.vue から `touch-action: manipulation` を持つブロックを全部集め、`:not(...)` の除外指定を取り除いたセレクタに `map` / `canvas` / `maplibregl` が含まれない。RouteMap.vue / RouteMapPreview.vue / RouteNavigationMap.vue は manipulation を1件も持たない。
5. スワイプ用を保つ: `ReviewPostForm.vue` の `.review-form-handle` と `ReviewPhotoViewer.vue` の `.photo-viewer` が `touch-action: none` のまま。`none` と `manipulation` が同じブロックに無い。
6. ピンチを止めない: `src/` の `.css` / `.vue` に、`touch-action: pan-x`、`pan-y` 単独、`pinch-zoom` を除く値（`none` は上記2か所のみ）が増えていない。`global.css` に `touch-action: none` が無い。
7. `index.html` を `resolve(process.cwd(), 'index.html')` で読み、viewport メタに `user-scalable` / `maximum-scale` / `minimum-scale` が含まれず、`width=device-width, initial-scale=1.0` が残っている。

jsdom ではダブルタップ拡大そのものは検証できない。テストは宣言の存在と範囲のみを確かめる（テスト内のコメントに明記）。

## 5. 実装順序

1. global.css に共通ルールと `.popup` / `.bottom-actions` を追加（コメントは共通ルールの1か所に集約）。
2. scoped の4か所に1行ずつ追加（コメントは「理由は global.css の共通ルール」と短く参照）。
3. テストを追加。
4. 検証コマンドを実行（下記）。
5. `dist` の CSS を確認（`:where` / `:not` の複合セレクタが残っているか）。`frontend/dist` は `.gitignore` 済み（`git check-ignore` で確認）なので、ビルド後の差分は気にしなくてよい。

## 6. 検証コマンド（`frontend` で実行）

```powershell
cd c:\ミチシル開発\michishiru_app\frontend
npm run lint
npm run build
npx vitest --run
```

すべて通ること。`npx vitest --run src/assets/styles` で新規テストだけを先に確認してもよい。

### 実機確認項目（最終報告に書く）

iPhone（Safari）と Android（Chrome）で:

- 案内画面で口コミの「自分／みんな」をダブルタップしても画面が拡大しない。
- 次の目的地へ／前の目的地／終了ボタン、終了確認モーダルのボタンをダブルタップしても拡大しない。
- トースト・バナー・終了ボタン付近をピンチアウトすると、従来どおり拡大する（仕様。アクセシビリティのため）。
- 地図のダブルタップ拡大、ピンチ、パン、長押しは従来どおり動く。ズーム／現在地ボタンの連打で画面が拡大しない。
- 写真の全画面表示で左右スワイプによる写真送りが動く。口コミフォームのハンドルの上下スワイプで展開・収納が動く。
- ホーム画面の距離スライダーが従来どおり動く（range への指定の影響確認）。ログイン画面の入力欄を連打しても拡大しない。
- 既知の範囲外: 見出し・本文など操作部品でない領域のダブルタップでは、拡大する可能性が残る。
