# 実装計画 — チュートリアル表示の不具合2件

ミチシル（Vue 3 SPA + Lambda）のチュートリアルに関する2つの不具合を修正する。

- Fix 2: チュートリアル中にジャンルのボタンが全部押せなくなっている（対象ジャンルが本番に存在しない `city` 固定のため）。
- Fix 1: チュートリアルの吹き出しが下部固定（TutorialMascot）で地図などに重なり、ホームでレイアウトがずれる。各画面の通常マスコット位置へ統一し、TutorialMascot を廃止する。

リポジトリルート: `c:\Users\hanbai01\Desktop\agventure lab\work\スプリント3\michishiru_app`

## 前提（確定事実・調査結果）

- 本番 DynamoDB のジャンルマスタの genreId は `nature` / `photo` / `history` / `gourmet` の4つ。`city`（街歩き）は `photo`（表示名「写真」）に完全置換済み。`city` はもう存在しない。
- genreName はコードではなく DynamoDB マスタが持つ。`getConditions` Lambda が実テーブルを Scan して返し、フロントはそれをそのまま表示する。`backend/functions/getConditions/seedConditions.js` はテーブル未設定時のローカルフォールバックにすぎず本番では使われない。
- チュートリアルの文言「写真を選んでみてね」（`frontend/src/constants/tutorialSteps.js` の SELECT_GENRE）は正しい。維持する。
- ロックの仕組み（調査済み）: `frontend/src/components/feature/route/RouteConditionForm.vue` の `isGenreButtonLocked(value)` は、ジャンル段階で `value === props.tutorialGenreValue` のボタンだけを押せるようにし、それ以外を `disabled` にする。`tutorialGenreValue` は `RouteConditionView.vue` から `:tutorial-genre-value="TUTORIAL_GENRE_ID"` で渡される。`TUTORIAL_GENRE_ID = 'city'` のため、本番の選択肢（nature/photo/history/gourmet）のどれとも一致せず全ボタンが無効化される。
- tutorialStore（調査済み）: `isActive` / `currentStep` / `currentMessage`（今のステップの文言）/ `isStep(step)` / `STEP` を公開。`currentMessage` は `TUTORIAL_STEPS[stepIndex].message`。
- MascotSpeechBubble の props（調査済み）: `message`(String)・`level`(Number)・`size`('small'|'medium'|'large')・`placement`('side'|'stacked')・`variant`('normal'|'alert')・`hasLevelLabel`(Boolean)。名前付きスロット `experience`、既定スロット（message の代わりに本文を差し込める）を持つ。
- TutorialMascot（調査済み）: `MascotSpeechBubble` を `placement="side" size="small"` で包み、`position: fixed; bottom: 16px; z-index: 70` で下部固定しているだけの薄いラッパー。props は `message`(必須)・`level`。
- ビルド/テストコマンド（package.json で確認済み）:
  - frontend: `npm run lint`(eslint .)・`npm run build`(vite build)・`npm test`(vitest run)
  - backend: `npm test`（Node 標準テストランナー）
  - ルート: `npm run dev`（フロント＋APIを同時起動）
- 既存のフロントのチュートリアル関連テストは無い（`frontend/src/**/__tests__` に tutorial 対象なし）。backend のテストに `city` を例示として使う箇所がある（後述）。

## `'city'` 参照の一覧と判断（grep 済み）

| ファイル:行 | 内容 | 判断 | 根拠 |
|---|---|---|---|
| `frontend/src/constants/tutorial.js:11` | `export const TUTORIAL_GENRE_ID = 'city'` | **変更** → `'photo'` | Fix 2 の直接原因。本番マスタに合わせる |
| `frontend/src/constants/tutorial.js:45,57` | ダミースポットの `spotType: 'city'` | **変更** → `'photo'` | `TUTORIAL_GENRE_ID` を photo に統一するなら、写真ジャンルのダミーも種別を揃えるのが整合的。spotType は地図のアイコン程度の内部種別で挙動を壊さない。コメント「写真(city)ジャンル」も「写真」に直す |
| `frontend/src/constants/tutorial.js:156` | `genreId: TUTORIAL_GENRE_ID`（紫ピンのダミー） | 変更不要（定数参照のため自動で photo になる） | 定数を直せば追従する。`genreName: '写真'` は既に正しい |
| `backend/functions/getConditions/seedConditions.js:52-55` | genreId `city` / genreName `街歩き` / iconEmoji `🏙️` | **変更** → genreId `photo` / genreName `写真` / iconEmoji `📷`。sortOrder 2 は維持 | ローカルと本番の食い違いをなくすため、本番実データ（photo=写真）に合わせる |
| `backend/tools/reviewSpotSeeds.js:25`（SEED_GENRES） | `city: '街歩き'` | **変更** → `photo: '写真'` | 同上。検索条件マスタの genreId/genreName と揃える役割のため |
| `backend/tools/reviewSpotSeeds.js:48-60`（13件のシード） | `genreId: 'city'` と「// 街歩き」コメント | **変更** → `genreId: 'photo'`、コメント「// 街歩き」→「// 写真」 | 同上。本番に存在しない genreId のシードを残さない |
| `backend/functions/createReview/__tests__/service.test.js:127,129,189`（他） | テストの入力・期待値に `city` / `街歩き` を例示 | **据え置き** | 純粋な例示データ。genreId の値自体に意味は無く、テストの検証は「入力が保存・更新される」こと。photo 置換と矛盾する固定参照ではない。必須修正対象外 |
| `backend/functions/createRoute/__tests__/service.test.js:408,453,938,946,961`（他） | `listConditions` スタブ等に `city` / `街歩き` を例示 | **据え置き** | 同上。おまかせ選定ロジックのテスト用の任意のジャンル集合であり、本番マスタの値に依存しない。必須修正対象外 |
| `backend/functions/getRoute/constants.js:22` | `ALLOWED_CATEGORIES = ['nature','city','history','gourmet']` | **据え置き（計画の対象外）** | `getRoute` は旧ルート取得系で、`category`（予約語・別概念）を扱う別系統。今回の2件（チュートリアル表示 + getConditions/reviewSpotSeeds のローカル整合）の範囲外。本番マスタ整合とは別課題のため、スコープを広げない |
| `backend/functions/getRoute/seedRoutes.js:39,43` | `category: 'city'` / `type: 'city'`（ダミールート） | **据え置き（計画の対象外）** | 同上。`getRoute` の例示データで、チュートリアルや createRoute の genre とは別経路 |

注: getRoute 系の `city` は「genre」ではなく「category」（辞書で予約・未使用の別概念）であり、本番ジャンルマスタの置換とは独立。今回のスコープを getConditions / reviewSpotSeeds / フロントのチュートリアルに限定する。もし将来 getRoute 系も本番マスタへ寄せるなら別課題として扱う。

## MascotSpeechBubble の使い方と各 View の配置方針（Fix 1）

共通: チュートリアル中は `tutorialStore.currentMessage` を `message` に渡す。チュートリアルでは経験値バー/レベルラベルは出さない（`experience` スロットと `has-level-label` を付けない）。固定オーバーレイ（position: fixed）では置かず、各画面の通常の配置フローに乗せる。

- RouteConditionView: 通常の `home-mascot`（`placement="side" size="medium"`、見出し `.section-title` の上）と同じ位置・サイズ・余白（`.home-mascot` の margin）で、チュートリアル中はメッセージだけ差し替える。
- WalkResultView: 通常の `result-mascot`（`placement="stacked" size="large"`、`.result-body` 内）と同じ位置に、チュートリアル中はメッセージを出す。
- RouteSuggestionView: 通常マスコットの定位置は無い（RouteInfoCard がマスコットレベルを使うのみ）。既存レイアウトを崩さない空き場所に `placement` は `side`、`size` は `small`〜`medium` で置く。固定オーバーレイで地図/ボタンに重ねない。最終的な置き場所は実装/レビューで微調整可。
- RouteNavigationView: 地図フルスクリーンで通常マスコットは無い。既存の `.navigation-top`（バナー/前後ボタン/口コミ切替を縦積み、z-index 45）やフッターの終了ボタン、地図操作を隠さない空き位置へ配置。既存の「口コミフォーム表示中は出さない」制御（`!isReviewFormVisible`）は維持。固定オーバーレイで重ねない配置を選ぶ。最終判断は実装/レビューに委ねる。

---

# Implementation Plan

- [ ] 1. Fix 2 フロント: チュートリアルの対象ジャンルを本番マスタに合わせる。
      `frontend/src/constants/tutorial.js` の `TUTORIAL_GENRE_ID` を `'city'` → `'photo'` に変更する。あわせて同ファイルのダミースポット2件の `spotType: 'city'` を `'photo'` にし、`TUTORIAL_SPOTS` 上のコメント「写真(city)ジャンルらしい」を「写真ジャンルらしい」に直す。`TUTORIAL_GENRE_ID` 行のコメント「表示上は『写真』のジャンル」はそのまま妥当なので維持。`genreId: TUTORIAL_GENRE_ID` を参照する紫ピンのダミー（156行目付近）は定数参照のため自動で追従する。
      Files: `frontend/src/constants/tutorial.js`
      Verify: `frontend` で `npm run lint` と `npm run build` が成功する。

- [ ] 2. Fix 2 バックエンド（getConditions シード）: ローカルフォールバックを本番に合わせる。
      `backend/functions/getConditions/seedConditions.js` のジャンル `city` のエントリを genreId `'photo'` / genreName `'写真'` / iconEmoji `'📷'` に変更する。sortOrder 2 と isActive は維持。
      Files: `backend/functions/getConditions/seedConditions.js`
      Verify: `backend` で `npm test` が成功する（既存テストがこのファイルに依存していないことの確認を含む）。

- [ ] 3. Fix 2 バックエンド（reviewSpotSeeds）: 口コミシードのジャンルを本番に合わせる。
      `backend/tools/reviewSpotSeeds.js` の `SEED_GENRES` の `city: '街歩き'` を `photo: '写真'` に変更し、`REVIEW_SPOT_SEEDS` の `genreId: 'city'` の13件すべてを `genreId: 'photo'` にする。区切りコメント「// 街歩き」を「// 写真」に直す（名前の文言自体は街歩き/撮り歩きどちらでも成立するため変更は任意だが、genreId と齟齬が出ないようコメント見出しは「写真」に揃える）。
      Files: `backend/tools/reviewSpotSeeds.js`
      Verify: `backend` で `npm test` が成功する。

- [ ] 4. Fix 1: RouteConditionView をチュートリアル中も home-mascot 位置に吹き出しを出すよう統一する。
      `frontend/src/views/RouteConditionView.vue` で、通常の `MascotSpeechBubble`（class="home-mascot"）の `v-if` から `&& !tutorialStore.isActive` を外す方針に切り替える。実装は、チュートリアル中は同じ home-mascot の位置・`placement="side"`・`size="medium"`・`.home-mascot` の余白を保ったまま `message` を `tutorialStore.currentMessage` に切り替え、`variant` は `normal`、`has-level-label` と経験値スロットは付けない（チュートリアル中はレベル表示・バーを出さない）。表示条件は「実績読み込み完了かつ条件マスタ読み込み完了」かつ「（通常の案内文がある）または（チュートリアル中で currentMessage がある）」を満たすときとする。下部固定の `<TutorialMascot .../>` と import を削除する。`TUTORIAL_GENRE_ID` の import は項目1の変更後も RouteConditionForm へ渡すため残す。
      Files: `frontend/src/views/RouteConditionView.vue`
      Verify: `frontend` で `npm run lint` と `npm run build` が成功する。

- [ ] 5. Fix 1: WalkResultView のチュートリアル吹き出しを result-mascot 位置に出す。
      `frontend/src/views/WalkResultView.vue` で、下部固定の `<TutorialMascot .../>` と import を削除する。チュートリアル中は `result-mascot` の `MascotSpeechBubble`（`placement="stacked" size="large"`、`.result-body` 内）に `message="tutorialStore.currentMessage"` を出す。現状この吹き出しは既定スロットに結果見出し・労い文を差し込んでいるため、チュートリアル中はスロット本文（`result-title` と `mascotSubMessage`）をそのまま見せる形でよい（`mascotSubMessage` は既にチュートリアル用の文言分岐を持つ）か、または `tutorialStore.currentMessage` を本文として見せる。レベルラベル・経験値バーはチュートリアル中は出さない（既存のとおり `!tutorialStore.isActive` 条件を維持）。どちらの見せ方にするかは、ステップごとの `currentMessage` を優先して表示する方針で実装する（チュートリアルの案内文が見えること）。
      Files: `frontend/src/views/WalkResultView.vue`
      Verify: `frontend` で `npm run lint` と `npm run build` が成功する。

- [ ] 6. Fix 1: RouteSuggestionView のチュートリアル吹き出しを空き場所に出す。
      `frontend/src/views/RouteSuggestionView.vue` で、下部固定の `<TutorialMascot .../>` と import を削除する。通常マスコットの定位置が無いため、既存レイアウト（`.suggestion-content` の見出し付近、またはフッターの `.bottom-actions` 付近の空き場所）にチュートリアル中のみ `MascotSpeechBubble`（`placement="side"`, `size="small"`〜`medium"`, `message="tutorialStore.currentMessage"`, 経験値・レベルラベル無し）を `tutorialStore.isActive && tutorialStore.currentMessage` のとき出す。地図（RouteMapPreview）・各ボタンに固定オーバーレイで重ねない。配置の微調整は実装/レビューで可。
      Files: `frontend/src/views/RouteSuggestionView.vue`
      Verify: `frontend` で `npm run lint` と `npm run build` が成功する。

- [ ] 7. Fix 1: RouteNavigationView のチュートリアル吹き出しを空き場所に出す。
      `frontend/src/views/RouteNavigationView.vue` で、下部固定の `<TutorialMascot .../>` と import を削除する。地図フルスクリーンで通常マスコットが無いため、`.navigation-top`（バナー/前後ボタン/口コミ切替、z-index 45）・フッターの終了ボタン・地図操作（右下の帰属表示やズーム）を隠さない空き位置に `MascotSpeechBubble`（`placement="side"`, `size="small"`, `message="tutorialStore.currentMessage"`, 経験値・レベルラベル無し）を出す。表示条件は既存どおり `tutorialStore.isActive && tutorialStore.currentMessage && !isReviewFormVisible`（口コミフォーム表示中は出さない）を維持。固定オーバーレイで重ねない配置を選ぶ。最終判断は実装/レビューに委ねる。
      Files: `frontend/src/views/RouteNavigationView.vue`
      Verify: `frontend` で `npm run lint` と `npm run build` が成功する。

- [ ] 8. Fix 1: TutorialMascot.vue を削除する。
      項目4〜7で全4 View の import と使用箇所を置き換えた後、`frontend/src/components/feature/tutorial/TutorialMascot.vue` をファイルごと削除する。削除前に `TutorialMascot` と `tutorial-mascot` の残参照が無いことをグローバル検索で確認する（import 漏れがあるとビルドが落ちる）。
      Files: `frontend/src/components/feature/tutorial/TutorialMascot.vue`（削除）
      Verify: `frontend` で `npm run lint` と `npm run build` が成功する（未解決 import が無いこと）。

- [ ] 9. 全体検証（ビルド・テスト・目視）。
      `frontend` で `npm run lint` と `npm run build`、`backend` で `npm test` をすべて成功させる。iac は変更しないため実行不要。可能ならルートで `npm run dev`（フロント＋API同時起動、長時間サーバはバックグラウンド起動し確認後に停止）でチュートリアルを起動し、ログインのうえ次を目視する: (1) チュートリアルで「写真」ボタン（genreId=photo）だけが押せ、押すと距離ステップへ進む。(2) ホームでレイアウトが上に詰まらず、チュートリアルの吹き出しが通常マスコット位置（見出し `.section-title` の上）に出て、地図背景（paper-map-bg）に重ならない。(3) 提案・案内・結果の各画面でもチュートリアルの吹き出しが空き場所に出て、地図/ボタン/バナーに重ならない。
      Files: （検証のみ、変更なし）
      Verify: 上記3コマンドが成功し、目視3項目を満たす。

---

## Git 運用メモ（実装ステップ向け）

- git は必ず `git -C "c:\Users\hanbai01\Desktop\agventure lab\work\スプリント3\michishiru_app" ...` 形式で実行する（カレントディレクトリが frontend にずれる事象があったため）。
- worktree は使わず、ユーザーのチェックアウト上で直接作業する。
- `develop` / `main` へ直接 push しない。コミットは明示指示があるまで作らない。
- コミット種別の目安（将来コミットする場合）: Fix 2 は `fix`、Fix 1（TutorialMascot 廃止・吹き出し統一）は `fix` または `refactor`。
