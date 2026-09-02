---
inclusion: fileMatch
fileMatchPattern: 'backend/**'
---

# バックエンド規約 — ミチシル（Node.js + Lambda）

---

## 命名規則

命名の基本形は `naming-conventions.md` に従う。本ファイルはバックエンド固有の内容のみを扱う。

### ファイル名

| 対象 | 規則 | 例 |
|---|---|---|
| レイヤーファイル | 役割名で固定（機能名を入れない） | `handler.js`, `service.js`, `repository.js`, `validator.js` |
| ユーティリティ | camelCase | `responseBuilder.js`, `errorHandler.js` |
| 定数ファイル | camelCase | `constants.js`, `errorCodes.js` |
| テストファイル | 対象名 + `.test` | `service.test.js`, `validator.test.js` |

#### レイヤーファイル名を固定する理由

同じフォルダ内の4ファイルがすべて役割名で揃うため、どのファイルが何をするかが一目で分かる。機能名はフォルダ名（`functions/getRoute/`）で表現されるので、ファイル名に重ねて持つ必要がない。

```
functions/getRoute/     ← ここで機能が分かる
├── handler.js          ← ここでは役割が分かる
├── service.js
├── repository.js
└── validator.js
```

Lambda の入口ファイルを `handler.js` にするのは AWS の慣例でもある。

### 関数名・変数名

| 対象 | 規則 | 例 |
|---|---|---|
| 関数 | camelCase（動詞 + 名詞） | `createRoute`, `validateRequest`, `buildResponse` |
| 変数 | camelCase | `routeData`, `userId`, `spotList` |
| 定数 | UPPER_SNAKE_CASE | `MAX_SPOTS`, `ROUTE_TABLE_NAME`, `DEFAULT_QUERY_LIMIT` |
| Boolean | `is` / `has` / `can` プレフィックス | `isValid`, `hasPermission` |

**例外:** Lambda の入口としてエクスポートする関数は `handler` とする。AWS がこの名前で呼び出すため、「動詞 + 名詞」の規則は適用しない。

```javascript
export const handler = async (event) => { ... };
```

### 環境変数

| 規則 | UPPER_SNAKE_CASE |
|---|---|
| 例 | `ROUTE_TABLE_NAME`, `AUTH_SECRET`, `API_STAGE` |

参照は `constants.js` に集約し、`service.js` / `repository.js` から `process.env` を直接読まない。

```javascript
// constants.js
export const ROUTE_TABLE_NAME = process.env.ROUTE_TABLE_NAME ?? '';
```

### Lambda関数名

| 対象 | 規則 | 例 |
|---|---|---|
| 論理名（コード上・フォルダ名） | camelCase（動詞 + 名詞） | `getRoute`, `createRoute`, `deleteWaypoint` |
| AWS上の物理名 | 未決定（`naming-conventions.md` の「未決定事項」を参照） | - |

フォルダ名は論理名と一致させる（`functions/getRoute/`）。

### エラーコード

| 規則 | UPPER_SNAKE_CASE。`<対象>_<状態>` の形 |
|---|---|
| 例 | `ROUTE_NOT_FOUND`, `VALIDATION_ERROR`, `DATA_SOURCE_ERROR`, `INTERNAL_ERROR` |

- 定義は `shared/constants/errorCodes.js` に集約する
- HTTPステータスコードとの対応も同ファイルで持つ
- 外部サービス固有のエラーは、この一覧のいずれかに変換してから上位へ渡す

---

## パッケージ構成（ディレクトリ構成）

### 全体構造

```
backend/
└── functions/
    └── <Lambda関数の論理名>/
        ├── handler.js          # エントリーポイント（Lambda ハンドラ）
        ├── service.js          # ビジネスロジック
        ├── repository.js       # DB/外部サービスアクセス
        ├── validator.js        # 入力バリデーション
        ├── constants.js        # 関数固有の定数・環境変数の参照
        ├── package.json        # 関数ごとの依存定義
        └── __tests__/          # テスト
```

### 共通モジュール

```
backend/
└── shared/
    ├── utils/              # 関数横断のユーティリティ
    │   ├── responseBuilder.js
    │   ├── errorHandler.js
    │   └── logger.js
    ├── middleware/          # 共通ミドルウェア（認証チェック等）
    ├── constants/           # 共通定数
    └── validators/          # 共通バリデーション
```

### 配置ルール

| ルール | 詳細 |
|---|---|
| 1 Lambda = 1責務 | CRUD を 1 つのハンドラにまとめない |
| レイヤー分離 | handler → service → repository の順に呼び出す |
| handler にロジックを書かない | handler はリクエスト受付とレスポンス返却のみ |
| 共通処理は `shared/` に切り出す | 2つ以上の関数で使うものは共通化する |
| 関数ごとに `package.json` を持つ | 依存を最小限にしてデプロイサイズを抑える |
| テストは `__tests__/` に置く | 対象ファイルと同名 + `.test.js` |

### レイヤーの責務

| レイヤー | 役割 | やってよいこと | やってはいけないこと |
|---|---|---|---|
| handler | リクエスト受付・レスポンス返却 | イベントのパース、レスポンス整形 | ビジネスロジック、DB操作 |
| service | ビジネスロジック | データ加工、条件分岐、ルール適用 | HTTP レスポンス構築、直接DB操作 |
| repository | データアクセス | DynamoDB/外部API呼び出し | ビジネスロジック |
| validator | 入力検証 | バリデーション、型チェック | データ取得、副作用 |

詳細は `back-layer-architecture.md` を参照。

---

## テスト

| 項目 | 内容 |
|---|---|
| 実行ツール | Node.js 標準テストランナー（`node --test`） |
| 実行コマンド | `npm test`（`backend/` で実行） |
| 対象パターン | `functions/**/__tests__/**/*.test.js` |
| ファイル名 | 対象ファイル名 + `.test.js`（`.spec` は使用しない） |

`.spec` を使わない理由は `naming-conventions.md` の「テストファイルについて」に記載。

---

## JSDoc / コメント利用方針

Node.js にはアノテーション（Java の `@Override` 等）がないため、**JSDoc コメント**で型情報・説明を補完する。

### 必須で書く場所

| 対象 | 必須/任意 |
|---|---|
| handler 関数 | 必須 |
| service の public 関数 | 必須 |
| repository の関数 | 必須 |
| 複雑なロジックの関数 | 必須 |
| 自明な短い関数 | 任意 |

### 記述ルール

| ルール | 詳細 |
|---|---|
| `@param` | 引数の型と説明を書く |
| `@returns` | 戻り値の型と説明を書く |
| `@throws` | throw する可能性があるエラーを書く |
| `@description` | 関数の概要を1文で書く（省略して1行目に書いてもよい） |

### TODO / FIXME コメント

| タグ | 用途 |
|---|---|
| `// TODO:` | 後で対応する予定の箇所 |
| `// FIXME:` | 既知のバグ・問題がある箇所 |
| `// HACK:` | 一時的な回避策。理由を併記する |

- TODO/FIXME には担当者名または課題番号を付ける（例: `// TODO(yamamoto): NZ-42 ページネーション対応`）
- 長期間放置しない。PRレビュー時に期限を確認する

---

## やってはいけないこと

| NG | 理由 |
|---|---|
| handler 内にビジネスロジックを書く | テスト困難・肥大化 |
| 環境変数をハードコードする | 環境ごとに値が変わるため |
| `service.js` / `repository.js` で `process.env` を直接読む | 参照箇所が散らばる。`constants.js` に集約する |
| `any` 的な曖昧な引数名（`data`, `obj`, `item`）を多用する | 可読性が下がる |
| JSDoc なしで複雑な関数を書く | 他メンバーが理解できない |
| shared/ のモジュールが特定の関数に依存する | 共通モジュールの独立性を保つ |
| 入口の関数名を `handler` 以外にする | AWS が呼び出せない |

---

## 更新履歴

| 日付 | 内容 |
|---|---|
| - | 初版作成 |
| 2026/09/02 | レイヤーファイル名を役割名固定に統一（`createRoute.js` の記載を削除）/ テストファイル名を `.test` に統一 / `handler` 関数名の例外を明記 / 環境変数の参照先を `constants.js` に明記 / エラーコードの命名規則とテストの節を追加 / Lambda物理名を未決定として整理 |
