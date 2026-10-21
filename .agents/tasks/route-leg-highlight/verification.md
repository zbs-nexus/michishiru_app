# 検証結果 — 案内画面の経路を区間（leg）ごとに3段階で描き分ける（反復1回目）

- ブランチ: `feature/NZ-173`（開始時に確認。作成・切替なし）
- コミット・プッシュ: していない（変更は作業ツリーに残置）
- review.json: 無し（1回目の反復。修正した指摘なし）

## 実行したコマンドと結果

| 場所 | コマンド | 結果 |
|---|---|---|
| backend | `npm test` | 成功。tests 170 / pass 170 / fail 0（suites 28） |
| frontend | `npx vitest --run` | 成功。Test Files 23 passed / Tests 202 passed |
| frontend | `npm run lint` | 成功（エラー・警告なし、終了コード0） |
| frontend | `npm run build` | 成功（終了コード0） |

途中の失敗（修正済み）: 新規 `routesRepository.test.js` の「経路が返らない場合」で、直線の代替座標列を完全一致で比べたところ、代替も `simplifyCoordinates`（RDP）で間引かれ一直線上の点が省かれるため不一致になった。既存挙動どおりなのでテスト側を「両端が現在地・3点以上」の確認に直した。

## 追加・変更したテスト

- `backend/functions/createRoute/__tests__/routesRepository.test.js`（新規、4件）: legs を Legs の順のまま返す / 全体の coordinates は従来どおり連結 / `Routes: []` で legCoordinates が `[]`・全体は直線代替 / 送信する `CalculateRoutesCommand` の Origin・Destination=現在地、Waypoints=spots の順、`LegGeometryFormat: 'Simple'`
- `backend/functions/createRoute/__tests__/service.test.js`（describe「区間ごとの線」5件）: 3スポットで legs 4件・各 `{ coordinates }` / leg 数が ±1 ずれると `[]`（全体の coordinates は返る）/ 1点の leg を含むと `[]` / legCoordinates を返さない経路計算でも `[]` / スポット削減後も最終スポット数+1
- `frontend/src/utils/__tests__/routeResponse.test.js`（describe「toRoute（区間ごとの線）」4件）: legs を受け取る / legs なし・getRoute 形式は `[]` / 2点未満を含むと `[]` / geometry は不変
- `frontend/src/utils/__tests__/routeLegs.test.js`（新規、9件）: k=0 / 途中 k=1 / k=N-1 / 全到達後 k=N（帰り道）/ legs なし（undefined・[]）/ leg 数不一致（3件・5件）/ visitedCount 範囲外（-1・4・1.5）/ 2点未満の leg / spotCount 0
- `frontend/src/components/feature/route/__tests__/RouteMap.test.js`: FakeMap が addSource / getSource / setData / addLayer を記録するよう拡張。describe「区間ごとの描き分け」5件（legSections なし→`route` は全体の Feature・追加ソースは空 / あり→各ソースに upcoming・walked・current / レイヤー順と paint の値（current 緑・幅7、casing 白・幅12、walked 灰・幅4・dasharray、route-line は従来の青）/ setProps で setData 更新・addLayer 数は不変 / null に戻すと1本に戻る）。describe「global.css（区間の色）」2件（CSS 変数と JS 定数の一致）
- `frontend/src/views/__tests__/RouteNavigationView.test.js`（describe「区間の描き分け」4件）: 開始直後は legs[0] / `.next-spot-btn` で legs[1]・`.previous-spot-btn` で legs[0] に戻る / 3回進めると帰り道 legs[3] / legs なしは null

## 変更ファイル

- backend/functions/createRoute/repositories/routesRepository.js（`legCoordinates` を返す）
- backend/functions/createRoute/service.js（`toRouteLegs` で検証し `legs` を返す）
- backend/functions/createRoute/handler.js（応答に `legs: [{ geometry: LineString }]`）
- backend/functions/createRoute/__tests__/service.test.js
- backend/functions/createRoute/__tests__/routesRepository.test.js（新規）
- frontend/src/utils/routeResponse.js（`toLegs`、`toRoute` に `legs`）
- frontend/src/utils/routeLegs.js（新規、`toRouteLegSections`）
- frontend/src/utils/__tests__/routeResponse.test.js
- frontend/src/utils/__tests__/routeLegs.test.js（新規）
- frontend/src/assets/styles/global.css（`--route-walked-leg` / `--route-current-leg`）
- frontend/src/constants/mapDefaults.js（`ROUTE_WALKED_LEG_*` / `ROUTE_CURRENT_LEG_*`）
- frontend/src/components/feature/route/RouteMap.vue（prop `legSections`、ソース2・レイヤー3追加、watch）
- frontend/src/components/feature/route/RouteNavigationMap.vue（prop `legSections` を素通し）
- frontend/src/components/feature/route/__tests__/RouteMap.test.js
- frontend/src/views/RouteNavigationView.vue（`visitedCount` から `legSections` を computed）
- frontend/src/views/__tests__/RouteNavigationView.test.js
- docs/仕様書.md（7.3 区間ごとの線）
- .kiro/steering/naming-glossary.md（用語8語と更新履歴 2026/10/21）

RouteSuggestionView / RouteMapPreview / getRoute / routeStore / useRouteProgress は変更していない（提案画面は従来の1色）。`ミチシル_前提条件.md` は構成が変わらないため更新していない。

## 計画からの逸脱

- `routesRepository.test.js` の直線代替ケースは、計画の「coordinates は直線代替」を完全一致ではなく両端と点数で確認した（上記の理由。代替座標列も既存どおり間引かれるため）。
- service.test.js のスタブ拡張は計画の `legCountOffset` に加え、1点の leg を作る `hasShortLeg` を追加した（ケース (c) のため）。また「legCoordinates を返さない古いスタブ」のケースを1件追加した。
- それ以外は計画どおり。

## jsdom で確認できない事項

- MapLibre の実描画（灰の破線・白い縁取り・緑の太線の見た目、重なり順の実際の表示、`line-dasharray` の破線の見え方）。テストではソース/レイヤーの追加・更新と paint の値までを確認した。
- Routes v2 の実応答で leg 数が spots数+1 になること。既存の `extractSnappedSpotInfo` と同じ前提に立っており、dev 環境での実機確認が必要。数が合わない場合はバックエンド・フロントの両方で1色描画にフォールバックする。
