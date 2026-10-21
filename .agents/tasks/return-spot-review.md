# 案内画面の「前の目的地に戻る」ボタンと口コミ切り替えの1本化

案内中に誤って「次の目的地へ」を押したときに戻せるよう、`useRouteProgress` に `returnToPreviousSpot` と `canReturnToPreviousSpot` を足し、`RouteNavigationView` のバナー左下に戻るボタンを置いた。口コミの2トグル（縦2段）は1本のピルにまとめて2段目へ移し、空いた1段目の左に戻るボタンを入れている（ユーザーが選んだ案）。「前の目的地」は `visitedSpotIds` の末尾で、末尾を取り除けば computed の `nextSpot` が自動でそのスポットに戻るため、追加の状態は持たない。地図の足跡は既存の `watch(visitedSpotIds)` → `walkStore` / 地図マーカーの経路で消える。

Watch for: ビューのテストは足跡の元データ（`walkStore.visitedSpotIds`）までしか確かめておらず、地図へ渡る prop は検証していない（likely、非ブロッキング）。口コミトグルのタップ領域が以前よりわずかに低い（28px、likely、非ブロッキング）。

**Verdict**: APPROVED

## High-level view

状態の変更は `visitedSpotIds` の末尾を `slice(0, -1)` で落とすだけ。`advanceToNextSpot` が常に「spots 順で最初の未到達」を末尾に追加するので、末尾を外すと `nextSpot` はそのスポットに戻る。配列は丸ごと差し替えるため、deep なしの watch で `walkStore` と地図マーカーの両方に伝わる。到達済み0件で呼んでも何もしない。全到達後も戻せて、`isCompleted` が偽に戻り「次の目的地へ」も再表示される。

レイアウトは1段目（`top: 84px`）の左右に戻るボタンと「次の目的地へ」を置き、どちらも高さ32px固定で、バナーの端（`max(12px, calc(50% - 203px))`）に揃えている。口コミのピルは `top: 122px` に固定され、戻るボタンが `v-if` で消えても位置は変わらない。右上のズームコントロールは `margin-top: 124px` で右側に寄っているため、左のピルとは横方向で重ならない。

命名と辞書は規約どおり。`can` 接頭辞の computed、kebab-case のクラス名、`is-on` の状態クラス、`type` / `aria-label` / `aria-pressed` が揃っている。辞書には `visitedSpotIds` の説明の変更、2語の登録、2026/10/21 の更新履歴が入っている。`walkStore.js` の「ラッチ」コメントも実際の挙動に合わせて直してある。

<details>
<summary>Issues (3)</summary>

1. **地図の足跡はビューのテストで未検証**: `walkStore.visitedSpotIds` は確かめているが、`RouteNavigationMap` に渡る `visited-spot-ids` prop は確かめていない。必要ならスタブの props に対するアサーションを1行足す（非ブロッキング）。
2. **口コミトグルのタップ高さ**: 内側のボタンが `min-height: 28px` になり、以前（約32px）より低い。地図を狭めないという要望とのトレードオフなので、実機で押しにくければ 32px に戻す（非ブロッキング）。
3. **検証記録を本ステップで確認できない**: coder の lint/build/test の記録はこのステップに渡っておらず、確認できたのは対象2テストファイルの実行（19件成功）だけ。lint/build はマージ前に CI かローカルで通っていることを確認する（非ブロッキング）。

</details>

<details>
<summary>Details</summary>

### 末尾の削除による「1つ前」の定義

```
advance:  visited=[s1]       next=s2
advance:  visited=[s1,s2]    next=s3
return:   visited=[s1]       next=s2   ← s2 の足跡が消える
```

`advanceToNextSpot` が spots を飛ばすことはないので、`visitedSpotIds` は常に spots の先頭からの連続した並びになる。末尾を外すことと「ルート順で1つ前」は一致する（confirmed）。ガードは `canReturnToPreviousSpot` を再利用していて、ボタンの表示条件と関数の前提がずれない。

### 戻るボタンと口コミのピルの配置

360px 幅だと、戻るボタン（左12px〜約110px）と「次の目的地へ」（右12px から内側へ約100px）の間は十分空く。ピル（ラベル「口コミ」+「自分」+「みんな」、幅は約170px）は左側にあり、ズームコントロール（右上、上端は約134px）とは横方向で重ならない。表示文言を「自分」「みんな」に縮めたぶんは、`aria-label` に元の名称を入れて補っている。表示される文字は aria-label に含まれているので、音声操作でも名前が一致する。ピル側では `role="group"` と `aria-label` で文脈を伝え、見た目だけのラベルは `aria-hidden` にしている。

内側のトグルは `min-height: 28px`・`padding: 4px 10px` になり、以前の独立したボタン（padding 8px で約32px）よりタップできる高さが少し低い（likely）。外側のピルは32pxあるが、ボタン同士の間（gap 2px）と縁の余白はどちらのボタンにも当たらない。

### テストの範囲

`useRouteProgress.test.js`（新規）は、初期状態、0件で戻す、2回戻す、全到達後に戻す、配列の参照差し替え、`visitedCount` の追従を扱っている。`RouteNavigationView.test.js` は、開始直後に非表示、進めると表示、戻すとバナーの `spotName` が戻ること、全到達後の復帰、1本化したトグルの `aria-pressed` を扱う。

テストしていないもの: 地図の足跡は、`walkStore.visitedSpotIds` が空になることと既存の `RouteMap` の watch を通じて間接的に保証されているだけで、`RouteNavigationMap` スタブの prop は確かめていない（likely）。CSS の配置（重なりがないこと）は jsdom では確かめられないので、目視での確認が必要。

</details>

<details>
<summary>File map</summary>

- `frontend/src/composables/useRouteProgress.js` — `canReturnToPreviousSpot` / `returnToPreviousSpot` を追加し、方針コメントを更新
- `frontend/src/composables/__tests__/useRouteProgress.test.js` — 新規。進める・戻すの単体テスト
- `frontend/src/views/RouteNavigationView.vue` — 戻るボタンを追加、口コミトグルを1本のピルへ、1段目の高さを固定
- `frontend/src/views/__tests__/RouteNavigationView.test.js` — 戻るボタンとトグルのテストを追加
- `frontend/src/stores/walkStore.js` — 「ラッチ」コメントを実際の挙動に合わせて修正
- `.kiro/steering/naming-glossary.md` — 用語2件を登録、`visitedSpotIds` の説明と更新履歴を更新

全文の差分: `git diff` と未追跡の新規テストファイル。

</details>
