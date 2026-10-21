# レビュー — 案内画面の経路を区間（leg）ごとに3段階で描き分ける（反復1回目）

判定: APPROVED（ブロッキングな指摘なし）

## 確認した根拠

1. API 互換: `handler.js` の `toResponseBody` は既存の `geometry`（全体の1本線）を残し、`legs: [{ geometry: { type: 'LineString', coordinates } }]` を追加しただけ。キーは単語1つ（`legs` / `geometry` / `coordinates`）なので camelCase / snake_case の差は出ない（既存応答は snake_case のため、この形で既存と衝突しない）。`docs/仕様書.md` に 7.3 として形・並び・数・空配列になる条件・保存しないことを追記済み。
2. フォールバック:
   - Service `toRouteLegs` は数が `spots.length + 1` でない、または2点未満の区間を含む、または `legCoordinates` が無い場合に `[]` を返す。`createRoute` では最終の `spots` と `route` は必ず同じ `calculateWalkingRoute({ currentLocation, spots })` 呼び出しの組（service.js 743/762/789 行付近と `ensureReviewSpot`）なので対応はずれない。応答の `spots` は `map` で順序を保つ。
   - Repository は `Origin`/`Destination` = 現在地、`Waypoints` = `spots` の順、`OptimizeWaypointOrder` なしで送るため Legs は「開始→spot1→…→spotN→開始」。既存 `extractSnappedSpotInfo` と同じ前提。
   - フロント `toLegs` は1件でも線にならなければ `[]`、`toRouteLegSections` は legs なし・数不一致・到達数範囲外・2点未満で `null`。getRoute 形式・routeStore に legs が無いルートは `[]`→`null`→RouteMap が従来どおり全体を1本で描く。
3. 区間の分類: `routeLegs.js` の純粋関数で `walkedLegs = legs[0..k-1]`、`currentLeg = legs[k]`、`upcomingLegs = legs[k+1..]`、k = `visitedCount`（0〜N、k=N は帰り道）。`visitedCount` は `visitedSpotIds.length` で、`advanceToNextSpot`（spots 順で最初の未到達を追加）/`returnToPreviousSpot`（末尾削除）だけが変えるため、次の目的地の添字と一致する。View の `computed` なので両操作で切り替わる。テストは k=0・途中・k=N-1・k=N・legs なし・数不一致・範囲外・2点未満・spotCount 0 を網羅（routeLegs.test.js）、View の進める/戻す/帰り道/legs なしも RouteNavigationView.test.js で確認と記録。
4. 見た目: RouteMap は `legSections` が null のとき追加ソースを空にし、`route` ソースは全体の Feature のまま（提案画面・RouteMapPreview は prop を渡さず従来の1色）。非 null のとき青はこれからの区間のみ、灰の破線（幅4・dasharray・butt）、白 casing 幅12 → 緑 幅7 を最後に addLayer して最前面。色は `:root` の `--route-walked-leg` / `--route-current-leg: var(--accent-green)` と、既存 `ROUTE_LINE_COLOR` と同じく mapDefaults.js の JS 定数の二重管理で、一致をテストで検出。RouteMap / RouteNavigationMap の追加 prop は `legSections` 1つずつ。`legSections` の watch は fit しない。
5. 命名・辞書: 「ルートとスポット」に leg / legs / legCoordinates / currentLegIndex / legSections / walkedLegs / currentLeg / upcomingLegs を追加し、更新履歴に 2026/10/21 の行あり。path / point 等の表記揺れは無い。
6. レイヤー責務: Routes の生レスポンス（`Legs[].Geometry.LineString`）の解釈は Repository、数と形の妥当性判定と組み立ては Service、HTTP の形（LineString 包み）は handler。DynamoDB に保存しない判断と理由（createRoute は保存しない・getRoute は座標自体を持たない）は plan.md 判断3と仕様書に記載。
7. 制約: ブランチ `feature/NZ-173`、HEAD は `develop` と同じ `ce94517`、`develop..HEAD` のコミットなし。変更は作業ツリーのみ。

## 検証記録

verification.md に backend `npm test`（170 pass）、frontend `npx vitest --run`（202 pass）、`npm run lint`、`npm run build` の成功が記録されている。再実行はしていない。

## 指摘

ブロッキングな指摘なし。

## 申し送り（非ブロッキング）

- MapLibre の実描画と Routes v2 実応答の leg 数は jsdom で確認できないため、dev 環境での実機確認が必要（verification.md に明記済み）。
