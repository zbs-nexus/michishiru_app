# Implementation Plan — 案内画面の経路を区間（leg）ごとに3段階で描き分ける

作業条件: ブランチ `feature/NZ-173` のまま作業する（ワークツリーなし・ブランチ作成/切替なし・コミット/プッシュなし）。
リポジトリ: `c:\ミチシル開発\michishiru_app`（Windows / PowerShell）。

## 現状把握（読んだコードに基づく）

- `backend/functions/createRoute/repositories/routesRepository.js`
  - `CalculateRoutesCommand` に `Origin: 現在地`, `Waypoints: spots.map(spot => ({ Position }))`, `Destination: 現在地`, `TravelMode: 'Pedestrian'`, `LegGeometryFormat: 'Simple'` を渡す。`Simple` なので各 leg は `Geometry.LineString`（`[[lng,lat],...]`）を持つ。`OptimizeWaypointOrder` は使っていないので順序は入力どおり。
  - `extractCoordinates` が `route.Legs[]` の `LineString` を連結して1本にし、取れなければ「現在地→spots→現在地」の直線で代替する。連結後に `simplifyCoordinates`（RDP）で間引く。
  - `extractSnappedSpotInfo` は「`Legs[i]` の末尾 = スポット i の到着点」とみなしている。つまり既存コードも leg の並びを「開始→spot1, spot1→spot2, …, spotN→開始」と前提している（leg 数 = spots数+1）。
  - 戻り値: `{ coordinates, totalDistanceM, totalDurationS, spotSnappedPositions, spotStrayDistancesM }`。leg 単位のデータは返していない。
  - Repository の単体テストは無い（`placesRepository.test.js` が `mock.method(GeoPlacesClient.prototype, 'send', ...)` で SDK を差し替えるパターン）。
- `backend/functions/createRoute/service.js`
  - `createRoute` は `calculateWalkingRoute({ currentLocation, spots })` を複数回呼び（距離調整・到達不能スポット除外・`ensureReviewSpot`）、最終の `spots` と `route` から応答 `{ routeTitle, conceptStory, totalDistanceM, totalDurationS, spots, coordinates, selectedGenres?, selectedDistanceKm? }` を作る。`spots` は `calculateWalkingRoute` に渡した順そのまま。
- `backend/functions/createRoute/handler.js` の `toResponseBody`: snake_case の `route_title / concept_story / summary{total_distance_m,total_duration_s} / waypoints / geometry{type:'LineString',coordinates} / selected_genres? / selected_distance_km?`。
- `getRoute` / DynamoDB: `getRoute/repository.js` と `seedRoutes.js` は `routeId / routeName / description / category / purpose / distance / waypoints / createdAt` のみで経路座標を持たない。`createRoute` は DynamoDB へルートを保存していない（読むのは口コミの場所のみ）。
- `frontend/src/utils/routeResponse.js` の `toRoute`: `geometry: toLineGeometry(body.geometry)`（2点未満や不正は null）。`routeStore.setCurrentRoute(route)` でこの結果をそのまま保持（永続化なし）。
- `frontend/src/components/feature/route/RouteMap.vue`
  - ソース `route`（geojson、`toRouteFeature` で `toRaw` + 数値配列へ作り直し）、レイヤー `route-line-outline`（白、`ROUTE_LINE_OUTLINE_WIDTH_PX`=9）→ `route-line`（`ROUTE_LINE_COLOR`=#1A73E8、`ROUTE_LINE_WIDTH_PX`=5）。`renderRouteLine` は既存ソースがあれば `setData`、無ければ addSource + addLayer。
  - paint の色は `frontend/src/constants/mapDefaults.js` の JS 定数で渡す（`ROUTE_LINE_COLOR` は「`--route-blue` と同色、変更時は両方直す」というコメントで CSS 変数と二重管理）。これを「既存のやり方」として踏襲する。
  - `watch([geometry, spots])` で線・マーカー・fit を描き直す。props はすでに16個。
- `RouteNavigationMap.vue` は受け取った props を RouteMap へ素通しするだけ。`RouteNavigationView.vue` が `routeStore.currentRoute.geometry`、`spots`、`visitedSpotIds` 等を渡す。
- `frontend/src/composables/useRouteProgress.js`: `visitedSpotIds` は `advanceToNextSpot`（次の目的地を末尾に追加）と `returnToPreviousSpot`（末尾を削除）でのみ変わり、`nextSpot` は spots の順で最初の未到達。よって `visitedCount`（= k）は常に「次の目的地の添字」に一致する。`isCompleted` は k = N。View は現在 `visitedCount` を受け取っていない。
- テスト: `RouteMap.test.js` は `vi.mock('maplibre-gl')` の FakeMap（`getSource` は常に null、`addSource/addLayer` は記録なし）。`RouteNavigationView.test.js` は `shallow` マウント + `mountNavigationViewWithRoute()`（`setCurrentRoute({ spots: NAVIGATION_SPOTS, geometry: null })`）で `.next-spot-btn` / `.previous-spot-btn` を押す形。
- コマンド: backend `npm test`（`node --test "functions/**/__tests__/**/*.test.js"`）、frontend `npm run lint` / `npm run build` / `npx vitest --run`。
- API仕様の記載場所: `docs/仕様書.md` の「7. API仕様」（現状は 7.1 ルート取得のみ）。`docs/設計書.md` には createRoute の応答の記載なし。

## 設計上の判断

1. 応答の形: `legs: [{ geometry: { type: 'LineString', coordinates: [[lng,lat],...] } }, ...]`。キーは単語1つなので camelCase/snake_case の差は出ない。既存 `geometry`（全体の1本線）は残す。
   - 距離・所要時間は付けない。理由: 今回の描き分けで使う箇所が無く、次の目的地までの距離は既存の `useRouteProgress`（全体 geometry に沿って計測）が持っている。使い道ができた時点で `distanceM` を足せば互換を壊さない。
   - 各 leg の座標は Repository で leg ごとに `simplifyCoordinates`（既存 RDP）を通す。全体の `coordinates` は従来どおり連結後に間引く（既存挙動を変えない）。
2. 区間の妥当性判定（leg 数 = spots数+1、各 leg が2点以上）は Service（業務判断）で行う。満たさない場合は `legs: []` を返し `logWarn` する。Repository は Routes の Legs を順に変換して返すだけ（直線代替時・応答なし時は `[]`）。フロントでも同じ条件を純粋関数で再確認し、満たさなければ1色描画（防御を二重にする。保存済みルートや古い応答も同じ経路で1色になる）。
3. DynamoDB に legs は保存しない。理由: `createRoute` はルートを DynamoDB に保存しておらず、`getRoute` の保存項目（seed）は経路座標（`geometry`）すら持たない。legs だけ保存しても描けない。保存済みルートは従来どおり legs なし → 1色。
4. 区間の分類は純粋関数 `toRouteLegSections` を `frontend/src/utils/routeLegs.js` に置く（Vue 非依存なので utils/。命名は `to〇〇` 変換の既存パターン `toRoute` / `toRouteMeasure` に合わせる）。
   - 入力: `{ legs, spotCount, visitedCount }`（`legs` は `toRoute` が返す `[{ geometry }]`）
   - 出力: `{ walkedLegs: geometry[], currentLeg: geometry, upcomingLegs: geometry[] }` または `null`（1色で描く）
   - `currentLegIndex = visitedCount`。`walkedLegs = legs[0..k-1]`、`currentLeg = legs[k]`、`upcomingLegs = legs[k+1..]`。k=N（全到達後）は `legs[N]`（最終スポット→開始地点の帰り道）が currentLeg。
   - `null` を返す条件: `legs` が配列でない / 空、`spotCount` が1未満、`legs.length !== spotCount + 1`、`visitedCount` が 0〜spotCount の整数でない、いずれかの leg の `geometry.coordinates` が2点未満。
5. RouteMap への追加 prop は1つ: `legSections`（`toRouteLegSections` の戻り値、default `null`）。RouteNavigationMap も同名 prop を1つ追加して素通し。View で `computed` にするので `advanceToNextSpot` / `returnToPreviousSpot` で自動的に切り替わる。RouteSuggestionView / RouteMapPreview は渡さないので従来の1色。
6. RouteMap の描き方（3ソース・5レイヤー、常に作成し、データで出し分ける）
   - ソース `route`: `legSections` が null なら従来どおり全体 geometry の Feature。非 null なら `upcomingLegs` の FeatureCollection（歩き終えた区間・今の区間の下に青い線が透けないようにするため）。レイヤー `route-line-outline` / `route-line` は従来どおり。
   - ソース `route-walked-legs` + レイヤー `route-walked-leg-line`: 灰 `ROUTE_WALKED_LEG_COLOR`、幅4、`line-dasharray: [2, 1.5]`、`line-cap: 'butt'`（round だと破線が潰れるため）。
   - ソース `route-current-leg` + レイヤー `route-current-leg-casing`（白 `ROUTE_LINE_OUTLINE_COLOR`、幅12）→ `route-current-leg-line`（緑 `ROUTE_CURRENT_LEG_COLOR`、幅7）。最後に addLayer するので最前面。
   - `legSections` が null のときは2つの追加ソースに空の FeatureCollection を入れる。
   - `watch(() => props.legSections, ...)` では線だけ描き直す（`fitToRoute` は呼ばない。進めるたびに地図が戻されるのを防ぐ）。`hasNoGeometry`・開始地点マーカー・fit は従来どおり全体 `geometry` を使う。
7. 色: `global.css` の `:root` に `--route-walked-leg: #9AA0A6;` と `--route-current-leg: var(--accent-green);` を追加。MapLibre の paint は CSS 変数を読めないため、既存の `ROUTE_LINE_COLOR` と同じく `mapDefaults.js` に同値の JS 定数（`ROUTE_WALKED_LEG_COLOR = '#9AA0A6'`、`ROUTE_CURRENT_LEG_COLOR = '#3F7A5C'`）を置き、二重管理のずれはテストで検出する（CSS を読んで値を比較）。

## 用語（辞書に追加する語）

`leg`（区間。Routes の Legs に対応。開始地点・スポット間・帰り道の1区切り）、`legs`（区間の一覧。巡る順）、`legCoordinates`（Repository が返す区間ごとの座標列の配列）、`currentLegIndex`（今の区間の番号 = visitedCount）、`legSections`（区間の描き分け。歩き終えた・今・これからの3つにまとめたもの）、`walkedLegs`、`currentLeg`、`upcomingLegs`。

---

- [ ] 1. Repository が leg ごとの座標列を返すようにし、単体テストを追加する。
      `calculateWalkingRoute` の戻り値に `legCoordinates: number[][][]` を追加する。`(route?.Legs ?? []).map((leg) => simplifyCoordinates(leg.Geometry?.LineString ?? []))` で、Legs の順をそのまま保つ（判定はしない）。応答が無い・直線代替の場合は `[]`。JSDoc の `@returns` と、leg の並び（開始→spot1→…→spotN→開始）の説明コメントを更新。`LegGeometryFormat: 'Simple'` は変更しない（コメントで「leg ごとに LineString を得るため Simple」と明記）。
      新規テスト `backend/functions/createRoute/__tests__/routesRepository.test.js` を `placesRepository.test.js` と同じく `mock.method(GeoRoutesClient.prototype, 'send', ...)` で作る。ケース: (a) 3スポット・4 legs の応答で `legCoordinates.length === 4` かつ各要素が対応する leg の座標（2点の leg はそのまま）、(b) 全体 `coordinates` が従来どおり連結されている、(c) `Routes: []` の応答で `legCoordinates` が `[]` かつ `coordinates` は直線代替、(d) 送った `CalculateRoutesCommand` の `input` が `Origin`/`Destination` = 現在地、`Waypoints` = spots の順、`LegGeometryFormat: 'Simple'`。
      Files: backend/functions/createRoute/repositories/routesRepository.js, backend/functions/createRoute/__tests__/routesRepository.test.js
      Verify: `backend` で `npm test` — 新規テストを含め全件成功。

- [ ] 2. Service で区間を検証して `legs` を返し、Handler の応答に `legs` を追加する（1に依存）。
      `service.js` に内部関数 `toRouteLegs(legCoordinates, spotCount)` を追加: 配列であり `length === spotCount + 1` かつ全 leg が2点以上なら `[{ coordinates }]` を返し、そうでなければ `logWarn('区間の数がスポット数と合わないため、区間ごとの線を返しません', { legCount, spotCount })` して `[]`。`legCoordinates` が undefined（古いスタブ等）でも `[]`。`createRoute` の最終応答に `legs: toRouteLegs(route.legCoordinates, spots.length)` を追加（`ensureReviewSpot` 後の最終 route/spots を使う）。`@returns` の JSDoc に `legs` を追記。
      `handler.js` の `toResponseBody` に `legs: route.legs.map((leg) => ({ geometry: { type: 'LineString', coordinates: leg.coordinates } }))` を `geometry` の直後に追加（コメント: 区間ごとの線。巡る順で legs[i] はスポット i への区間、最後は帰り道。検証できない場合は空配列）。
      `service.test.js`: `createRepositoryStub` の `calculateWalkingRoute` に `legCoordinates`（spots.length+1 個の2点の線。オプション `legCountOffset` で個数をずらせるようにする）を追加。追加ケース: (a) 3スポットで `result.legs.length === 4`、各要素が `{ coordinates }`、(b) leg 数が spots数+1 と異なる場合 `result.legs` が `[]`、(c) 1点しかない leg を含む場合 `[]`、(d) スポットを削って再計算した場合（既存の距離超過ケース `distancesM` を流用）も最終 spots 数+1 の legs になる。既存テストはすべて通ること。
      Files: backend/functions/createRoute/service.js, backend/functions/createRoute/handler.js, backend/functions/createRoute/__tests__/service.test.js
      Verify: `backend` で `npm test` — 全件成功。

- [ ] 3. フロントの正規化で `legs` を受け取る。
      `routeResponse.js` に `toLegs(items)` を追加: 配列でなければ `[]`。各要素の `geometry` を既存 `toLineGeometry` で変換し、1つでも null があれば区間の対応がずれるため `[]`（全か無か）。結果は `[{ geometry }]`。`toRoute` の戻り値に `legs: toLegs(body.legs)` を追加し、JSDoc の戻り値型に `legs` を追記（getRoute の応答には無いので `[]` になる旨）。
      `routeResponse.test.js` に describe `toRoute（区間ごとの線）` を追加。ケース: 正常な legs を `[{ geometry: { type:'LineString', coordinates } }]` で返す / `legs` が無い古い応答・getRoute 形式は `[]` / 2点未満の leg を含むと `[]` / 既存の `geometry` は変わらない。
      Files: frontend/src/utils/routeResponse.js, frontend/src/utils/__tests__/routeResponse.test.js
      Verify: `frontend` で `npx vitest --run src/utils` — 成功。

- [ ] 4. 区間の分類を行う純粋関数 `toRouteLegSections` を作る。
      `frontend/src/utils/routeLegs.js` に `export const toRouteLegSections = ({ legs, spotCount, visitedCount }) => ...` を実装（判断5のとおり。`currentLegIndex = visitedCount`）。戻り値の geometry は `legs[i].geometry` をそのまま返す（RouteMap 側で toRaw/数値化する）。ファイル冒頭に leg の並びの前提とフォールバック条件をコメントで書く。
      新規テスト `frontend/src/utils/__tests__/routeLegs.test.js`（vitest から import）。spots 3件・legs 4件で: k=0 → walked なし・current=legs[0]・upcoming=legs[1..3] / 途中 k=1 → walked=[legs[0]]・current=legs[1]・upcoming=[legs[2],legs[3]] / k=N-1=2 → current=legs[2]（前のスポット→最終スポット）/ 全到達後 k=N=3 → walked=legs[0..2]・current=legs[3]（帰り道）・upcoming なし / legs なし（undefined・[]）→ null / leg 数不一致（3件・5件）→ null / visitedCount が範囲外（-1・4・1.5）→ null / 2点未満の leg を含む → null / spotCount 0 → null。
      Files: frontend/src/utils/routeLegs.js, frontend/src/utils/__tests__/routeLegs.test.js
      Verify: `frontend` で `npx vitest --run src/utils` — 成功。

- [ ] 5. 色の CSS 変数と描画用の定数を追加する。
      `global.css` の `:root` で `--route-blue` の直後に `--route-walked-leg: #9AA0A6;`（歩き終えた区間の灰）と `--route-current-leg: var(--accent-green);`（今の区間。トーストの左枠と同じ緑）を追加し、「MapLibre の paint は mapDefaults.js の定数で渡すため変更時は両方直す」とコメント。
      `mapDefaults.js` に `ROUTE_WALKED_LEG_COLOR = '#9AA0A6'`、`ROUTE_WALKED_LEG_WIDTH_PX = 4`、`ROUTE_WALKED_LEG_DASH_ARRAY = [2, 1.5]`（線幅を単位とする破線の長さと間隔）、`ROUTE_CURRENT_LEG_COLOR = '#3F7A5C'`、`ROUTE_CURRENT_LEG_WIDTH_PX = 7`、`ROUTE_CURRENT_LEG_CASING_WIDTH_PX = 12` を、既存 `ROUTE_LINE_*` と同じ JSDoc 形式（対応する CSS 変数名を明記）で追加。縁取り色は既存 `ROUTE_LINE_OUTLINE_COLOR`（白）を再利用。ファイルは UTF-8 のまま編集すること（PowerShell の既定エンコーディングで読むと文字化けして見えるが、ファイル自体は UTF-8）。
      Files: frontend/src/assets/styles/global.css, frontend/src/constants/mapDefaults.js
      Verify: `frontend` で `npm run lint` と `npm run build` — 成功。

- [ ] 6. RouteMap に `legSections` を追加し、3段階で描く（4・5に依存）。
      `RouteMap.vue`:
      - prop `legSections`（Object, default null。JSDoc: 案内画面のみ渡す。null なら1色）。
      - 定数 `WALKED_LEGS_SOURCE_ID = 'route-walked-legs'`、`CURRENT_LEG_SOURCE_ID = 'route-current-leg'`、`WALKED_LEG_LAYER_ID = 'route-walked-leg-line'`、`CURRENT_LEG_CASING_LAYER_ID = 'route-current-leg-casing'`、`CURRENT_LEG_LAYER_ID = 'route-current-leg-line'`。
      - `toRouteFeature` の座標の作り直し部分を `toPlainCoordinates(geometry)` に切り出し、`toLegFeatureCollection(geometries)`（各 geometry を LineString Feature にした FeatureCollection。toRaw のコメントの理由も同じ）を追加。
      - `renderRouteLine` を、`route` ソースのデータを「legSections が null なら全体、非 null なら upcomingLegs」に変え、追加ソース2つ（null 時は空の FeatureCollection）の setData / 初回 addSource + addLayer を行う形に整理。addLayer の順は `route-line-outline` → `route-line` → `route-walked-leg-line` → `route-current-leg-casing` → `route-current-leg-line`。歩き終えた区間の layout は `line-cap: 'butt'`、`line-join: 'round'`、paint は `line-color / line-width / line-dasharray`。`hasNoGeometry` は従来どおり全体 geometry で判定。
      - `watch(() => props.legSections, () => { if (map === null || !map.isStyleLoaded()) return; renderRouteLine(); })` を追加（fit しない）。
      `RouteMap.test.js`:
      - FakeMap を拡張し、`addSource(id, spec)` で `{ data, setData: vi.fn(...) }` を記録し `getSource(id)` で返す、`addLayer(layer)` を配列に記録する（モジュールスコープの `createdSources` / `addedLayers` を `beforeEach` でクリア）。既存テストが通ることを確認。
      - 新 describe `RouteMap（区間ごとの描き分け）`: (a) legSections なし → `route` ソースは全体の Feature、追加ソース2つは features 空 / (b) legSections あり → `route` は upcoming、`route-walked-legs` は walked、`route-current-leg` は current の座標を持つ / (c) レイヤーの順で最後が `route-current-leg-line`、その直前が casing（幅12・白）、current の paint が `ROUTE_CURRENT_LEG_COLOR`・幅7、walked の paint が `ROUTE_WALKED_LEG_COLOR`・幅4・`line-dasharray` あり / (d) `setProps({ legSections: 次の区分 })` で各ソースの `setData` が新しいデータで呼ばれ、addLayer の数は増えない / (e) legSections を null に戻すと `route` が全体に戻り追加ソースが空になる。
      - `global.css` の describe に「`--route-walked-leg` が `ROUTE_WALKED_LEG_COLOR` と一致、`--route-current-leg` が `var(--accent-green)` で `--accent-green` の値が `ROUTE_CURRENT_LEG_COLOR` と一致」を追加（`:root` の宣言を正規表現で読む。`@/constants/mapDefaults` を import）。
      Files: frontend/src/components/feature/route/RouteMap.vue, frontend/src/components/feature/route/__tests__/RouteMap.test.js
      Verify: `frontend` で `npx vitest --run src/components` — 成功。

- [ ] 7. 案内画面で今の区間を決めて地図へ渡す（6に依存）。
      `RouteNavigationMap.vue` に prop `legSections`（Object, default null）を追加し、`<RouteMap :leg-sections="legSections" ...>` で素通し。
      `RouteNavigationView.vue`: `useRouteProgress` の分割代入に `visitedCount` を追加。`import { toRouteLegSections } from '@/utils/routeLegs'` し、`const legSections = computed(() => toRouteLegSections({ legs: routeStore.currentRoute?.legs, spotCount: spots.value.length, visitedCount: visitedCount.value }))` を追加（コメント: 次の目的地への区間を強調する。全スポット到達後は帰り道。区間を確かめられない場合は null で1色）。`<RouteNavigationMap :leg-sections="legSections">` を追加。RouteSuggestionView は変更しない。
      `RouteNavigationView.test.js`: `mountNavigationViewWithRoute` に任意引数で `legs` を渡せるようにし（既定は従来どおり legs なし）、`RouteNavigationMap` を import。新 describe `RouteNavigationView の区間の描き分け`: (a) 開始直後は `legSections.currentLeg` が legs[0]・walked 空 / (b) `.next-spot-btn` で legs[1] に切り替わり walked=[legs[0]] / (c) `.previous-spot-btn` で legs[0] に戻る / (d) 3回進めると current が legs[3]（帰り道）・upcoming 空 / (e) legs なしのルートでは `legSections` が null。
      Files: frontend/src/components/feature/route/RouteNavigationMap.vue, frontend/src/views/RouteNavigationView.vue, frontend/src/views/__tests__/RouteNavigationView.test.js
      Verify: `frontend` で `npx vitest --run` — 全件成功。

- [ ] 8. 用語辞書と API 仕様を更新する。
      `.kiro/steering/naming-glossary.md` の「ルートとスポット」表に追記: `区間 | leg | ルートを開始地点・スポットで区切った1区間。Routes の Legs に対応。legs[i] はスポット i へ向かう区間、最後は最終スポットから開始地点への帰り道`、`区間の一覧 | legs | 巡る順に並んだ区間。数はスポット数+1。確かめられない場合は空`、`区間ごとの座標列 | legCoordinates | routesRepository が返す区間ごとの座標列の配列`、`今の区間の番号 | currentLegIndex | 到達済みのスポット数（visitedCount）と同じ値`、`区間の描き分け | legSections | walkedLegs / currentLeg / upcomingLegs にまとめたもの。toRouteLegSections（utils/routeLegs.js）が作る。null は1色で描く`、`歩き終えた区間 | walkedLegs | 灰色の破線で描く`、`今の区間 | currentLeg | 緑の太線＋白の縁取りで最前面に描く`、`これからの区間 | upcomingLegs | 従来の経路の色で描く`。末尾の更新履歴に `| 2026/10/21 | 案内中の経路の区間ごとの描き分けに伴い「ルートとスポット」へ leg / legs / legCoordinates / currentLegIndex / legSections / walkedLegs / currentLeg / upcomingLegs を追加 |` を追記。
      `docs/仕様書.md` の「7. API仕様」に `### 7.3 ルート作成（POST /api/v1/routes）の区間ごとの線` を追加: `legs` の形（JSON 例）、並び（legs[i] = スポット i への区間、最後 = 帰り道、数 = waypoints数+1）、確かめられない場合は空配列、既存 `geometry` は全体の1本線として残す、距離は付けない、DynamoDB には保存しない（getRoute の応答には含まれない）こと、フロントは案内画面でのみ3段階に描き分ける（灰の破線 / 緑の太線＋白縁 / 従来の青）。
      `.kiro/steering/ミチシル_前提条件.md` は構成が変わらないため更新しない。
      Files: .kiro/steering/naming-glossary.md, docs/仕様書.md
      Verify: 次の項目の全体検証で確認（ドキュメントのみの変更）。

- [ ] 9. 全体検証。
      Verify:
      - `backend` で `npm test` — 全件成功
      - `frontend` で `npm run lint` — エラーなし
      - `frontend` で `npm run build` — 成功
      - `frontend` で `npx vitest --run` — 全件成功
      最終報告に明記すること: MapLibre の実描画（破線・縁取り・重なり順の見た目）は jsdom では確認できず、ソース/レイヤーの追加・更新とpaint の値までをテストで確認したこと。Routes v2 の実応答で leg 数が spots数+1 になることは既存の `extractSnappedSpotInfo` と同じ前提に立っており、実機（dev 環境）で確認が必要なこと。
