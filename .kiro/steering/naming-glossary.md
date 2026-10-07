---
inclusion: always
---

# ドメイン用語辞書 — ミチシル（ルート作成地図アプリ）

---

## 運用ルール

| ルール | 詳細 |
|---|---|
| 新しい用語を使う前にこのファイルに追記する | コードより先に辞書を更新する |
| 同じ概念に複数の英語を使わない | チーム内で1つの訳語に統一する |
| 別の概念には別の語を割り当てる | 似ていても中身が違うものを1語にまとめない |
| 略語は合意したもののみ使う | 勝手に略語を作らない |
| 辞書にない用語をレビューで見つけたら指摘する | 統一を維持するための仕組み |
| 既存の用語を変更する場合はチーム全員に通知する | コード全体への影響があるため |

---

## 特に間違えやすい2組

### `spot` と `waypoint`

どちらも「地図上の点」だが、**別のもの**なので使い分ける。

| 語 | 何を指すか | 個数の目安 | 誰が見るか |
|---|---|---|---|
| `spot` | ユーザーが立ち寄る場所（公園・神社・カフェ等） | 1ルートに2〜5個 | ユーザーに表示する |
| `waypoint` | 経路を描くための座標の点（交差点・道の折れ点） | 1ルートに数十個 | 地図描画に使う内部データ |

混同すると「巡ったスポット数」に道の曲がり角まで数えて `4` ではなく `37` と表示される、という不具合が起きる。エラーにならず数字が出るため気付きにくい。

判断に迷ったら「ユーザーがそこで足を止めるか」で分ける。止まるなら `spot`、通過するだけなら `waypoint`。

### `genre` と `category`

| 語 | 何を指すか | 状態 |
|---|---|---|
| `genre` | スポットの種類。ユーザーがホーム画面で1つ選ぶ（自然・街歩き・歴史・グルメ） | 使用中 |
| `category` | ルートの分類 | 予約。現在は未使用 |

`ミチシル_前提条件.md` の「ジャンル」は `genre` を指す。

---

## 用語一覧

### ルートとスポット

| 日本語 | 英語（コード上） | 説明 |
|---|---|---|
| ルート | route | 出発地から目的地までの経路 |
| ルートタイトル | routeTitle | AIが生成したルートの見出し |
| 解説文 | conceptStory | AIが生成したルートの見どころの説明 |
| スポット | spot | ユーザーが立ち寄る場所（公園・神社・カフェ等） |
| スポットID | spotId | スポットを一意に識別する値 |
| 候補スポット | candidateSpots | 周辺検索で得た、選定前のスポットの一覧 |
| スポットのカテゴリ | spotCategory | スポット検索に渡す種別（Places のカテゴリ） |
| スポットのカテゴリID | spotCategoryId | `spotCategory` を識別する値。カテゴリマスタが持つ |
| スポット数 | spotCount | 立ち寄ったスポットの個数 |
| スポット種別 | spotType | スポットの種類（`park` / `shrine` / `cafe` / `viewpoint` / `city` / `gourmet`） |
| 経由点 | waypoint | 経路を構成する座標の点。地図描画用 |
| 出発地 | origin | ルートの開始地点 |
| 目的地 | destination | ルートの終了地点 |
| 距離 | distance | 2地点間の距離。単位は km |
| 総距離 | totalDistance | 実際に歩いた散歩全体の距離 |
| 所要時間 | duration | ルートの移動時間 |
| 次の目的地 | nextSpot | 案内中にこれから向かうスポット |
| 次の目的地までの距離 | distanceToNextM | 現在地から次の目的地までの直線距離（メートル） |
| 到達済みのスポットID | visitedSpotIds | 到達したスポットのIDの一覧。到達後は未到達へ戻さない |
| 到達済みのスポット数 | visitedCount | 到達したスポットの個数 |
| 到達判定の距離 | ARRIVAL_THRESHOLD_M | 到達とみなす距離（メートル）。`useRouteProgress.js` の定数 |
| 距離表示の丸め単位 | DISTANCE_ROUNDING_UNIT_M | 距離表示を丸める単位（メートル）。`RouteNextSpotBanner.vue` の定数 |
| 採用する測位精度の上限 | MAX_ACCEPTABLE_ACCURACY_M | この値より精度が悪い測位は現在地に採用しない（メートル）。`useLocationTracking.js` の定数 |
| 経路に沿った距離 | alongRouteDistanceM | 直線距離ではなく、経路の折れ線をたどった距離（メートル） |
| 経路からの離れ | deviationM | 現在地が経路の折れ線からどれだけ離れているか（メートル） |
| 経路の測定用データ | routeMeasure | 経路の各点までの累積距離をまとめたもの。距離計算に使う |
| 経路沿いを採用する離れの上限 | MAX_ROUTE_DEVIATION_M | これ以上経路から離れたら直線距離へ切り替える（メートル）。`useRouteProgress.js` の定数 |
| 実績の総距離 | totalDistanceM | 実際に歩いた距離（メートル）。GPSの軌跡から積算する |
| 測位できたかどうか | hasLocationFix | 一度でも現在地を採用できたか。できていない場合は実績を計測できない |
| 区間距離 | segmentDistanceM | 前回採用した地点から現在地までの距離（メートル） |
| 採用する最小区間距離 | MIN_SEGMENT_DISTANCE_M | これを下回る移動はGPSのゆらぎとみなして積算しない。`useWalkRecord.js` の定数 |
| 採用する最大区間距離 | MAX_SEGMENT_DISTANCE_M | これを上回る移動は測位の飛びとみなして積算しない。`useWalkRecord.js` の定数 |
| 距離を積算できる精度の上限 | MAX_MEASURABLE_ACCURACY_M | これより精度が悪い測位では距離を積算しない（メートル）。`useWalkRecord.js` の定数。現在地の採用を決める `MAX_ACCEPTABLE_ACCURACY_M` とは目的が別 |

### 検索条件

| 日本語 | 英語（コード上） | 説明 |
|---|---|---|
| 検索条件 | condition / conditions | 目的・ジャンル・距離をまとめたもの |
| 目的 | purpose | 散歩の目的。ユーザーが1つ選ぶ |
| ジャンル | genre | スポットの種類。ユーザーが1つ選ぶ |
| ジャンルID | genreId | ジャンルを識別する値（`nature` / `city` / `history` / `gourmet`） |
| ジャンル名 | genreName | ジャンルの表示名（`自然` / `街歩き` / `歴史` / `グルメ`） |
| カテゴリ | category | ルートの分類（予約。現在は未使用） |

#### 目的（purpose）の選択値

| 日本語 | 値 |
|---|---|
| 気分転換 | refresh |
| 運動 | exercise |
| 観光 | sightseeing |
| カフェ | cafe |

#### ジャンル（genre）の選択値

| 日本語 | 値 |
|---|---|
| 自然 | nature |
| 街歩き | city |
| 歴史 | history |
| グルメ | gourmet |

### 画面と操作

| 日本語 | 英語（コード上） | 説明 |
|---|---|---|
| 散歩 | walk | ユーザーが実際に歩く行為 |
| 散歩結果 | walkResult | 散歩終了後に表示する集計（総距離・スポット数） |
| ルート提案 | suggestion | 生成したルートをユーザーに提示すること |
| 案内 | navigation | ルートに沿って歩く際の画面・機能 |
| 再作成 | regenerate | 同じ条件で別のルートを作り直すこと |
| ロード中 | loading | 処理中の状態 |
| 散歩の開始時刻 | startedAt | 案内を開始した時刻 |
| 散歩の終了時刻 | endedAt | 案内を終了した時刻 |
| 経過時間 | elapsedMinutes | 案内の開始から終了までの時間（分） |

### 口コミ

| 日本語 | 英語（コード上） | 説明 |
|---|---|---|
| 口コミ | review | ユーザーがスポットに付ける感想と評価のまとまり |
| 口コミ投稿 | postReview | 口コミを投稿すること |
| 口コミ投稿フォーム | ReviewPostForm | 口コミを入力するフォーム（コンポーネント名） |
| 評価 | rating | スポットへの5段階評価（1〜5の整数） |
| 平均評価 | ratingAverage | その場所の評価の平均。合計と件数から算出する |
| 評価件数 | ratingCount | その場所に付いた口コミ（評価）の件数 |
| ロケーション名 | spotName | 口コミ対象のスポットの名称。ユーザーが入力する |
| ピンの座標 | pinPosition | 地図の長押しで立てるピンの座標 `{ lng, lat }` |
| 丸めセル | geoCell | 近接する場所を同一視するためのグリッドのセルキー。半径40mの候補絞り込みに使う |

`location`（単独）は使わない。口コミ対象の場所の名称は `spotName` に統一する（辞書の「使ってはいけない表記揺れ」で `place` / `location` を `spot` に寄せているため）。

### 地図

| 日本語 | 英語（コード上） | 説明 |
|---|---|---|
| 地図 | map | 地図表示領域 |
| 現在地 | currentLocation | ユーザーの現在位置 |
| ズーム | zoom | 地図の拡大率 |
| ピン | pin | 地図上に表示するマーカー |
| マーカー | marker | 地図上の地点を示すアイコン |
| 経路形状 | geometry | ルートの線を描くためのGeoJSON。`type` は `LineString` |
| 座標 | position | 1点の座標。`[経度, 緯度]` の配列。地図APIの入出力形式に合わせている |
| 座標列 | coordinates | `geometry` が持つ `[経度, 緯度]` の配列。経路上の座標点（= `waypoint`）の集まり |
| 表示範囲 | bounds | 地図に収める矩形。`[[南西の経度, 緯度], [北東の経度, 緯度]]` |
| 地図スタイル | mapStyle | 地図の見た目とタイル配信元の定義 |

### 環境とデプロイ

| 日本語 | 英語（コード上） | 説明 |
|---|---|---|
| 環境（ステージ） | stage | デプロイ先の区分。値は `dev` / `prod` の2つのみ |
| 開発環境 | dev | `develop` ブランチから自動デプロイされる環境 |
| 本番環境 | prod | `main` ブランチから自動デプロイされる環境 |
| デプロイ | deploy | AWSへ反映すること |

`development` / `production` / `stg` / `staging` は使わない。値は `dev` / `prod` に統一する。

### ユーザーとデータ

| 日本語 | 英語（コード上） | 説明 |
|---|---|---|
| ユーザー | user | アプリ利用者 |
| プロフィール | profile | ユーザーの情報 |
| 検索 | search | 場所や住所の検索 |
| お気に入り | favorite | 保存したルートや地点 |
| 共有 | share | ルートを他ユーザーと共有する |
| タグ | tag | ルートに付与するラベル |
| 公開 | isPublic | ルートを他ユーザーに見せるかどうか |
| 作成日時 | createdAt | データの作成日時 |
| 更新日時 | updatedAt | データの最終更新日時 |

### 認証

画面の名前は日本語（「ログイン画面」「ユーザー登録画面」）、コード上の名前は Cognito と Amplify の API 名に合わせる。

| 日本語 | 英語（コード上） | 説明 |
|---|---|---|
| ログイン（画面・行為） | login | 画面名・URL・ルート名に使う（`/login` / `route name: login`） |
| サインイン | signIn | ログイン処理そのもの。関数名・状態名に使う（`signIn` / `isSigningIn`） |
| サインアウト | signOut | ログアウト処理 |
| ユーザー登録（画面・行為） | signUp | 画面名は「ユーザー登録」、コード上は `signUp`（`/sign-up` / `isSigningUp`） |
| ユーザー名 | username | Cognito のサインイン識別子 |
| メールアドレス | email | 確認コードの送信先。Cognito の必須属性 |
| パスワード | password | - |
| 確認コード | confirmationCode | ユーザー登録後にメールで届く6桁の数字 |
| ユーザー登録の確認 | confirmSignUp | 確認コードでユーザーを有効化すること |
| パスワード再設定（画面・行為） | resetPassword | 画面名は「パスワードの再設定」、コード上は `resetPassword`（`/password-reset` / `isResettingPassword`） |
| パスワード再設定の確認 | confirmResetPassword | 確認コードと新しいパスワードで再設定を確定すること |
| 新しいパスワード | newPassword | 再設定で利用者が決めるパスワード |
| 確認パスワード | passwordConfirmation | 打ち間違いを防ぐため、パスワードをもう一度入力させる欄 |
| 入力チェックの結果 | fieldErrors | 項目名をキーに、エラー文言を持つオブジェクト。エラーが無い項目は持たない |
| ログイン済みかどうか | isSignedIn | - |
| パスワードを表示中かどうか | isPasswordVisible | 目のアイコンでパスワードを平文表示しているかどうか |
| 表示ボタンを出せるかどうか | isPasswordRevealAvailable | エラー直後は false にし、入力が修正されるまで表示ボタンを出さない |

`logout` は使わない（`signOut` に統一）。`register` / `signup`（大文字なし）も使わない。
`forgotPassword` / `reissuePassword` も使わない（`resetPassword` に統一）。Cognito は新しいパスワードを発行せず利用者に決めさせるため、「再発行」ではなく「再設定」と呼ぶ。

---

## 使ってはいけない表記揺れ

| NG（使わない） | OK（統一する） | 理由 |
|---|---|---|
| path | route | 「経路」は route に統一 |
| point | spot または waypoint | 単に point だと立ち寄り先か経路の点か区別できない |
| location | currentLocation | 単に location だと曖昧 |
| goal | destination | 「目的地」は destination に統一 |
| start | origin | 「出発地」は origin に統一 |
| bookmark | favorite | 「お気に入り」は favorite に統一 |
| like | favorite | 同上 |
| label | tag | 「ラベル」は tag に統一 |
| time | duration | 「所要時間」は duration に統一 |
| place | spot | 「立ち寄り先」は spot に統一 |
| landmark | spot | 同上 |
| recreate | regenerate | 「再作成」は regenerate に統一 |
| development / production | dev / prod | 環境名は短い形に統一 |
| stg / staging | （使わない） | 環境は dev / prod の2つのみ |
| env | stage | 環境の区分を指す語は stage に統一（`env` はAWSのアカウント・リージョン指定に使うため） |

`spot` は使用可。以前は禁止語だったが、`waypoint` とは別概念のため解禁した（「特に間違えやすい2組」を参照）。

---

## 略語一覧

| 略語 | 正式名 | 使用可否 |
|---|---|---|
| btn | button | ○ |
| msg | message | ○ |
| err | error | ○ |
| req | request | ○ |
| res | response | ○ |
| lat | latitude | ○ |
| lng | longitude | ○ |
| idx | index | ○ |
| hdr | header | ✕（省略しすぎ） |
| rte | route | ✕（省略しすぎ） |
| wp | waypoint | ✕（省略しすぎ） |
| usr | user | ✕（省略しすぎ） |

### 略語と正式名のどちらを使うか

| 場面 | 使うもの | 例 |
|---|---|---|
| 座標のように略語が一般的なもの | 略語 | `lat`, `lng` |
| それ以外 | 正式名 | `button`, `message`, `request` |

`lat` / `lng` は地図APIの世界で標準的な書き方のため、正式名（`latitude` / `longitude`）ではなく略語を優先する。

---

## 追記テンプレート

新しい用語を追加する場合は以下の形式で追記する。

```
| <日本語> | <英語> | <説明> |
```

追記した際は、どの表（ルートとスポット / 検索条件 / 画面と操作 / 地図 / ユーザーとデータ）に入れたかをPRの説明に書く。

---

## 更新履歴

| 日付 | 内容 |
|---|---|
| - | 初版作成 |
| 2026/09/02 | `spot` を解禁し `waypoint` と役割を分離 / `genre` を追加し `category` を予約に変更 / 使用中で未登録だった語（purpose, condition, walk, suggestion, navigation, regenerate, loading, spotType, spotCount, totalDistance, 選択値）を追加 / 略語の優先順位を追記 |
| 2026/09/02 | CI/CD導入に伴い「環境とデプロイ」の節を追加（stage / dev / prod / deploy）/ `development`・`staging`・`env` を表記揺れとして禁止 |
| 2026/09/09 | 地図描画（Step 6）の実装に伴い「地図」へ `geometry` / `coordinates` / `bounds` / `mapStyle` を追加 / 「ルートとスポット」へ `spotId` を追加 |
| 2026/09/09 | `createRoute`（Places + Bedrock + Routes）の実装に伴い「ルートとスポット」へ `routeTitle` / `conceptStory` / `candidateSpots` / `spotCategory`、「地図」へ `position` を追加 |
| 2026/09/09 | 案内中の次の目的地表示に伴い「ルートとスポット」へ `nextSpot` / `distanceToNextM` / `visitedSpotIds` / `visitedCount` / `ARRIVAL_THRESHOLD_M` を追加 |
| 2026/09/09 | ジャンルマスタ参照の実装に伴い `genreId` / `genreName` / `spotCategoryId` を追加。`genreId`（英語ID）と `genreName`（日本語の表示名）を明確に区別する |
| 2026/09/30 | ユーザー登録画面の追加に伴い「認証」の節を新設。未登録だったログイン関連の語（login / signIn / signOut / isSignedIn / username / password）と、登録で使う語（signUp / email / confirmationCode / confirmSignUp）を登録。`logout` / `register` を禁止 |
| 2026/09/30 | パスワード再設定画面の追加に伴い「認証」へ `resetPassword` / `confirmResetPassword` / `newPassword` を登録。`forgotPassword` / `reissuePassword` を禁止し、「再発行」ではなく「再設定」と呼ぶことを明記 |
| 2026/09/30 | 認証フォームの入力チェック追加に伴い「認証」へ `passwordConfirmation` / `fieldErrors` を登録 |
| 2026/09/30 | GPSのゆらぎ対策に伴い「ルートとスポット」へ `DISTANCE_ROUNDING_UNIT_M` / `MAX_ACCEPTABLE_ACCURACY_M` を追加 |
| 2026/09/30 | 次の目的地までの距離を経路沿いに変更。「ルートとスポット」へ `alongRouteDistanceM` / `deviationM` / `routeMeasure` / `MAX_ROUTE_DEVIATION_M` を追加 |
| 2026/10/07 | 口コミ投稿機能（フロント）の追加に伴い「口コミ」の節を新設。`review` / `postReview` / `ReviewPostForm` / `rating` / `spotName` / `pinPosition` を登録。口コミ対象の場所の名称は `spotName` に統一し `location` 単独を禁止 |
| 2026/10/07 | 口コミ投稿のバックエンド実装に伴い「口コミ」へ `ratingAverage` / `ratingCount` / `geoCell` を追加（半径40mで同じ場所とみなし、場所ごとに評価を集計する） |
| 2026/10/07 | 散歩の実績計測に伴い `totalDistanceM` / `startedAt` / `endedAt` / `elapsedMinutes` / `hasLocationFix` / `segmentDistanceM` / `MIN_SEGMENT_DISTANCE_M` / `MAX_SEGMENT_DISTANCE_M` / `MAX_MEASURABLE_ACCURACY_M` を追加 |
