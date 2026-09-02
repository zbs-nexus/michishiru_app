---
inclusion: fileMatch
fileMatchPattern: 'backend/**'
---

# データアクセスルール — ミチシル（Node.js + Lambda + DynamoDB）

---

## テーブル命名規則

| 対象 | 規則 | 例 |
|---|---|---|
| テーブル名 | PascalCase（単数形） + `-<環境>` | `Route-dev`, `Route-prod` |
| GSI名 | `GSI-<用途>` | `GSI-GenreDistance`, `GSI-UserRoutes` |
| LSI名 | `LSI-<用途>` | `LSI-SortOrder` |

### 環境識別子は後ろに付ける

`dev-Route` ではなく `Route-dev` とする。AWSコンソールでテーブル一覧を名前順に見たとき、同じリソースの dev / prod が隣に並ぶため。CDKのスタック名（`Michishiru-dev`）とも揃う。

テーブル名の実際の組み立ては IaC（`iac/lib/michishiru-stack.ts`）で行う。Lambda側は環境変数 `ROUTE_TABLE_NAME` から受け取り、コードにハードコードしない。

---

## 属性（カラム）命名規則

属性名に使う単語は `naming-glossary.md` の用語辞書に従う。特に `spot`（立ち寄り先）と `waypoint`（経路の座標点）を混同しないこと。

| 対象 | 規則 | 例 |
|---|---|---|
| パーティションキー | `pk` または意味のある名前（camelCase） | `routeId`, `userId` |
| ソートキー | `sk` または意味のある名前（camelCase） | `createdAt`, `sortOrder` |
| 通常属性 | camelCase | `routeName`, `spotCount`, `isPublic` |
| Boolean属性 | `is` / `has` / `can` プレフィックス | `isComplete`, `hasSpots` |
| 日時属性 | `〇〇At` 接尾辞 | `createdAt`, `updatedAt`, `deletedAt` |
| ID属性 | `〇〇Id` 接尾辞 | `routeId`, `userId`, `spotId` |

---

## キー設計ルール

| ルール | 詳細 |
|---|---|
| ID は UUID v4 を使う | 連番を使わない（分散環境に不向き） |
| 複合キーの区切り文字は `#` | 例: `USER#123`, `ROUTE#456` |
| アクセスパターンを先に設計する | テーブル設計前に「どう検索するか」を決める |
| GSI は最小限にする | コスト増につながるため、本当に必要なクエリのみ |
| 単一テーブル設計を基本とする | 関連データは同テーブルに格納し、PK/SK で区別する |

---

## Repository 層のルール

| ルール | 詳細 |
|---|---|
| AWS SDK v3 を使用する | v2 は使わない |
| DynamoDB クライアントは1度だけ生成する | 呼び出しごとにインスタンスを作らない |
| テーブル名は `constants.js` から import する | `repository.js` で `process.env` を直接読まない |
| Repository の関数は1つのDB操作に対応する | 複数操作の組み合わせは Service 層で行う |
| 戻り値は DynamoDB 形式ではなくアプリ形式に変換して返す | `{ S: "value" }` ではなく `"value"` で返す |

### テーブル名の取得（具体例）

```javascript
// constants.js — ここだけが process.env を読む
export const ROUTE_TABLE_NAME = process.env.ROUTE_TABLE_NAME ?? '';
export const GSI_GENRE_DISTANCE = 'GSI-GenreDistance';

// repository.js
import { GSI_GENRE_DISTANCE, ROUTE_TABLE_NAME } from './constants.js';
```

---

## クエリ操作の命名規則

| 操作 | 関数名の規則 | 例 |
|---|---|---|
| 1件取得 | `get〇〇ById` | `getRouteById`, `getUserById` |
| 一覧取得 | `list〇〇` または `get〇〇List` | `listRoutes`, `getSpotList` |
| 条件検索 | `query〇〇By△△` | `queryRoutesByGenre`, `queryRoutesByUserId` |
| 作成 | `create〇〇` | `createRoute`, `createSpot` |
| 更新 | `update〇〇` | `updateRoute`, `updateSpot` |
| 削除 | `delete〇〇` | `deleteRoute`, `deleteSpot` |
| 存在確認 | `exists〇〇` | `existsRoute`, `existsUser` |

---

## トランザクション・バッチ処理ルール

| ルール | 詳細 |
|---|---|
| トランザクションは Service 層で制御する | Repository は単一操作のみ |
| `TransactWriteItems` は最大25項目 | 超える場合は分割する |
| `BatchWriteItem` は最大25項目 | 超える場合はループで分割する |
| 部分的失敗への対応を必ず実装する | `UnprocessedItems` のリトライ処理 |

---

## ページネーションルール

| ルール | 詳細 |
|---|---|
| `LastEvaluatedKey` を使ったカーソル方式を採用する | offset/limit 方式は DynamoDB に不向き |
| 1回のクエリで取得する件数は `Limit` で制限する | デフォルト上限を定数で定義する（`DEFAULT_QUERY_LIMIT`、現在は20件） |
| クライアントには `nextToken`（Base64エンコードした LastEvaluatedKey）を返す | 生の Key を直接返さない |

---

## エラーハンドリングルール

| ルール | 詳細 |
|---|---|
| DynamoDB の例外はアプリ固有のエラーに変換する | AWS SDK のエラーをそのまま上位に投げない。変換先は `shared/constants/errorCodes.js` |
| `ConditionalCheckFailedException` → 「該当データなし」または「競合」に変換 | 意味のあるエラーにする |
| スロットリングエラーはリトライする | exponential backoff で最大3回 |
| 接続エラーはログ出力後に throw | 上位で適切なステータスコードに変換する |

### リトライ対象の例外

| 例外名 |
|---|
| `ProvisionedThroughputExceededException` |
| `ThrottlingException` |
| `RequestLimitExceeded` |

---

## セキュリティルール

| ルール | 詳細 |
|---|---|
| ユーザー入力をそのままキーに使わない | インジェクション防止 |
| 他ユーザーのデータにアクセスできないようにする | クエリ条件に必ず userId を含める |
| IAM ロールは最小権限にする | テーブル単位・操作単位で制限する |
| 機密データは暗号化して保存する | KMS または DynamoDB の暗号化機能を使う |

---

## やってはいけないこと

| NG | 理由 |
|---|---|
| `Scan` をデフォルトのデータ取得方法にする | 全件走査でコスト・パフォーマンス悪化 |
| テーブル名をコード内にハードコードする | 環境切り替えができなくなる |
| `repository.js` で `process.env` を直接読む | 環境変数の参照箇所が散らばる。`constants.js` に集約する |
| Repository 内でビジネスロジックの判定を行う | Service 層の責務 |
| DynamoDB のレスポンス形式をそのまま上位に返す | レイヤー間の依存が強くなる |
| 無制限にデータを取得する（Limit なしの Query） | メモリ・コスト問題 |
| 本番テーブルに対して手動で直接操作する | 事故防止。必ずスクリプト経由で |
| 属性名に用語辞書外の語を使う | 表記揺れの原因になる |

---

## 更新履歴

| 日付 | 内容 |
|---|---|
| - | 初版作成 |
| 2026/09/02 | 属性名の例を用語辞書に合わせて更新（`waypointCount` → `spotCount` 等）/ GSI名の例を `GSI-GenreDistance` に / 環境変数の参照先を `constants.js` に一本化 / リトライ対象の例外を明記 |
| 2026/09/02 | IaC の実装に合わせ、テーブル名の環境識別子を前置（`dev-Route`）から後置（`Route-dev`）に変更 |
