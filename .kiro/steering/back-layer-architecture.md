---
inclusion: fileMatch
fileMatchPattern: 'backend/**'
---

# レイヤー構成ルール — ミチシル（Node.js + Lambda）

## 概要

バックエンドは以下の3層 + バリデーション層で構成する。

```
Handler（Controller相当）
  ↓
Service（ビジネスロジック）
  ↓
Repository（データアクセス）
```

---

## 各レイヤーの責務

### Handler（Controller相当）

| 項目 | 内容 |
|---|---|
| 責務 | リクエストの受付とレスポンスの返却 |
| やってよいこと | イベントのパース、バリデーター呼び出し、レスポンス整形、ステータスコード決定 |
| やってはいけないこと | ビジネスロジック、DB操作、外部API呼び出し |
| 呼び出せる層 | Validator、Service |
| ファイル名 | `handler.js` |
| エクスポートする関数名 | `handler`（AWS が呼び出す固定名） |

### Service

| 項目 | 内容 |
|---|---|
| 責務 | ビジネスロジックの実行 |
| やってよいこと | データ加工、条件分岐、ビジネスルールの適用、複数Repositoryの組み合わせ |
| やってはいけないこと | HTTPレスポンスの構築、リクエストオブジェクトの直接参照、DB固有の記法 |
| 呼び出せる層 | Repository、他のService（循環依存禁止） |
| ファイル名 | `service.js` |

### Repository

| 項目 | 内容 |
|---|---|
| 責務 | データの永続化・取得（DynamoDB、外部API等） |
| やってよいこと | DBクエリの実行、外部サービスへのリクエスト、データの変換（DB形式↔アプリ形式） |
| やってはいけないこと | ビジネスロジック、バリデーション、レスポンス構築 |
| 呼び出せる層 | AWS SDK、外部ライブラリ、`constants.js` |
| ファイル名 | `repository.js` |

### Validator（補助層）

| 項目 | 内容 |
|---|---|
| 責務 | リクエスト入力のバリデーション |
| やってよいこと | 型チェック、必須項目チェック、値の範囲チェック |
| やってはいけないこと | DB参照を伴うチェック（それはServiceの責務）、副作用 |
| 呼び出せる層 | なし（純粋関数であること） |
| ファイル名 | `validator.js` |

---

## 呼び出し方向のルール

| ルール | 詳細 |
|---|---|
| 上から下への一方向 | Handler → Service → Repository の順でのみ呼び出す |
| 逆方向の呼び出し禁止 | Repository から Service を呼ばない。Service から Handler を呼ばない |
| 同レイヤー間の呼び出し | Service 同士は可（ただし循環依存禁止） |
| Repository 同士の呼び出し | 禁止。複数テーブルの操作は Service で組み合わせる |

---

## 各レイヤーの入出力ルール

| レイヤー | 入力 | 出力 |
|---|---|---|
| Handler | Lambda event オブジェクト | `{ statusCode, headers, body }` 形式のレスポンス |
| Service | プレーンなJSオブジェクト（HTTPに依存しない） | プレーンなJSオブジェクトまたは例外 throw |
| Repository | 検索条件やデータオブジェクト | アプリ形式に変換したデータ |

---

## エラーの伝搬ルール

| レイヤー | エラーの扱い |
|---|---|
| Repository | 外部サービスのエラーをアプリ固有のエラー（`errorCodes.js` のいずれか）に変換して throw |
| Service | Repository のエラーを catch し、ビジネス上の意味を持つエラーとして throw |
| Handler | Service のエラーを catch し、適切な HTTP ステータスコードとメッセージに変換して返す |

- 各レイヤーでエラーを握りつぶさない
- 最終的に Handler で必ず catch し、統一レスポンス形式で返す

---

## 依存関係のルール

| ルール | 詳細 |
|---|---|
| 外部ライブラリの直接利用は Repository のみ | AWS SDK、HTTPクライアント等は Repository に閉じ込める |
| Service は外部ライブラリに直接依存しない | Repository を介してアクセスする |
| Handler はフレームワーク固有の処理のみ | Lambda event/context の扱いだけ |
| 環境変数の参照は `constants.js` に集約する | どの層からも `process.env` を直接読まない。各層は `constants.js` から import する |

### 環境変数の扱い（具体例）

```javascript
// constants.js — ここだけが process.env を読む
export const ROUTE_TABLE_NAME = process.env.ROUTE_TABLE_NAME ?? '';

// repository.js — constants.js から受け取る
import { ROUTE_TABLE_NAME } from './constants.js';
```

こうすることで、環境変数の一覧が1ファイルを見れば分かり、設定漏れに気付ける。

---

## やってはいけないこと

| NG | 理由 |
|---|---|
| Handler に if 分岐のビジネスロジックを書く | テスト困難・責務の混在 |
| Service 内で `event.body` を直接参照する | HTTP に依存し、再利用できなくなる |
| Repository にビジネスルールの判定を書く | 判定は Service の責務 |
| 1ファイルに複数レイヤーの処理を混在させる | 可読性・保守性の低下 |
| レイヤーをスキップする（Handler → Repository 直接） | Service を経由しないとビジネスルールが漏れる |
| 循環依存（Service A → Service B → Service A） | 無限ループ・設計破綻 |
| `constants.js` 以外で `process.env` を読む | 環境変数の参照箇所が散らばる |

---

## 更新履歴

| 日付 | 内容 |
|---|---|
| - | 初版作成 |
| 2026/09/02 | 環境変数の参照先を `constants.js` に一本化（`back-data-access.md` との解釈のズレを解消）/ Handler のエクスポート関数名を明記 / Repository の出力をアプリ形式と明記 |
