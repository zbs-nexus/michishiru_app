---
inclusion: fileMatch
fileMatchPattern: 'frontend/**'
---

# ディレクトリ構成ルール — ミチシル（ルート作成地図アプリ）

---

## 全体構成

```
frontend/src/
├── views/            # URLに対応するページ
├── components/
│   ├── base/         # 汎用UI部品
│   ├── layout/       # 画面の骨格
│   └── feature/      # 機能ごとのコンポーネント
├── composables/      # リアクティブなロジック
├── services/         # APIとの通信
├── router/           # Vue Router のルート定義
├── stores/           # Pinia のグローバル状態管理
├── utils/            # Vueに依存しない汎用関数
├── constants/        # アプリ全体で使う定数
├── assets/           # 画像・フォント・グローバルCSS
├── App.vue
└── main.js
```

---

## views/

| ルール | 詳細 |
|---|---|
| 1ルート = 1ファイル | URLに対応するページごとに作成する |
| 命名 | `〇〇View.vue`（PascalCase + View 接尾辞） |
| 配置 | `src/views/` 直下 |
| 直接UIを書きすぎない | components を組み合わせて構成する |

### URLを持たない画面は View にしない

ローディング表示や確認ポップアップは URL を持たないため、View ではなくコンポーネントとして作る。

| 画面 | URLを持つか | 配置 |
|---|---|---|
| 情報入力（ホーム） | 持つ | `views/RouteConditionView.vue` |
| ロード中の表示 | 持たない | `components/feature/route/RouteLoadingOverlay.vue` |
| ルート提案 | 持つ | `views/RouteSuggestionView.vue` |
| 案内 | 持つ | `views/RouteNavigationView.vue` |
| 終了確認ポップアップ | 持たない | `components/base/BaseModal.vue` を使う |
| 散歩結果 | 持つ | `views/WalkResultView.vue` |

---

## components/

### サブディレクトリ構成

| ディレクトリ | 役割 | 命名規則 | 例 |
|---|---|---|---|
| `base/` | 汎用部品 | `Base` プレフィックス | `BaseButton.vue`, `BaseModal.vue` |
| `layout/` | 画面の骨格 | `〇〇Layout` | `DefaultLayout.vue` |
| `feature/<機能名>/` | 機能ごとのコンポーネント | 機能名 + 役割（PascalCase） | `RouteInfoCard.vue`, `WalkResultStats.vue` |

`App` プレフィックスは使用しない（`App.vue` と混同するため）。

### ルール

| ルール | 詳細 |
|---|---|
| 同じ機能のコンポーネントが3つ以上 | `feature/` 配下にサブディレクトリを分ける |
| データ取得 | components 内では行わない。View または composable で行う |
| 名前から置き場所が決まる | `Base〇〇` → `base/`、`〇〇Layout` → `layout/`、それ以外 → `feature/` |

---

## composables/

| ルール | 詳細 |
|---|---|
| 命名 | `use` プレフィックス + camelCase（`useRouteCreation.js`） |
| 1ファイル = 1つの関心事 | まとめない |
| 戻り値 | オブジェクトで返す |
| DOM操作しない | テンプレートの責務 |

---

## services/

| ルール | 詳細 |
|---|---|
| 命名 | `〇〇Service.js`（camelCase） |
| 1ファイル = 1リソース | `routeService.js` はルート関連のAPIのみ |
| 戻り値 | レスポンスの `data` を返す |
| エラー処理 | throw し、composable で catch する |

---

## stores/

| ルール | 詳細 |
|---|---|
| 命名 | `〇〇Store.js`（camelCase） |
| エクスポートする関数 | `use〇〇Store` |
| `defineStore` のID | 対象を表す単数形の小文字（`'route'`） |
| 使う場面 | 複数の画面をまたいで保持する必要がある状態のみ |

ミチシルでは検索条件（目的・ジャンル・距離）と生成済みルートが該当する。

---

## router/

| ルール | 詳細 |
|---|---|
| ファイル | `router/index.js` に集約する |
| ルート名（`name`） | kebab-case（`route-condition`, `walk-result`） |
| 画面遷移 | `router.push({ name: '...' })` で名前指定する。パスを直書きしない |

---

## その他のディレクトリ

| ディレクトリ | 役割 |
|---|---|
| `utils/` | フレームワークに依存しない汎用関数 |
| `constants/` | アプリ全体で使う定数 |
| `assets/` | 画像・フォント・グローバルCSS |

---

## 使い分けフローチャート

```
Q: URLに対応するページか？                → views/
Q: UIの表示部品か？                       → components/
Q: リアクティブなロジックか？              → composables/
Q: 複数画面をまたぐ状態か？                → stores/
Q: APIとの通信か？                        → services/
Q: Vueに依存しない汎用処理か？             → utils/
Q: アプリ全体で使う固定値か？              → constants/
```

---

## テストの配置

フロントエンドのテストツールは未決定（`naming-conventions.md` の「未決定事項」を参照）。決定後、本節に配置ルールを追記する。

決定までの暫定方針として、ファイル名は `〇〇.test.js` とする（バックエンド・IaC と揃えるため）。

---

## やってはいけないこと

| NG | 理由 | 正しい配置 |
|---|---|---|
| views/ 内に再利用コンポーネントを置く | 参照しづらい | components/ |
| components/ 内でAPIを直接呼ぶ | 責務の混在 | composable → service |
| composables/ に表示ロジックを書く | テンプレートの責務 | コンポーネント側 |
| utils/ にリアクティブな処理を書く | composableの責務 | composables/ |
| URLを持たない画面を views/ に置く | ルート定義と対応しなくなる | components/ |
| 1ディレクトリにファイルを20個以上 | 探しにくい | サブディレクトリ |

---

## 更新履歴

| 日付 | 内容 |
|---|---|
| - | 初版作成 |
| 2026/09/02 | `App` プレフィックスを廃止 / stores・router の節を追加 / URLを持たない画面の扱いを明記 / 名前と置き場所の対応を追記 / テスト配置の節（未決定）を追加 |
