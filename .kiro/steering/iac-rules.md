---
inclusion: fileMatch
fileMatchPattern: 'iac/**'
---

# IaC・AWSリソース命名ルール — ミチシル（AWS CDK / TypeScript）

`iac/` 配下は AWS CDK（TypeScript）で記述する。CDK には強い慣例があるため、本ファイルの規則は CDK の標準に合わせている。`naming-conventions.md` の一般ルールと異なる箇所は本ファイルを優先する。

---

## ファイル名

| 対象 | 規則 | 例 |
|---|---|---|
| スタック定義 | kebab-case + `-stack.ts` | `michishiru-stack.ts`, `oidc-stack.ts` |
| エントリーポイント | kebab-case | `bin/iac.ts` |
| テスト | 対象名 + `.test.ts` | `test/iac.test.ts` |

`naming-conventions.md` は「JS/TSモジュールは camelCase」と定めているが、`iac/` は例外とする。CDK 公式のテンプレートおよび自動生成されるファイルが kebab-case であり、逆らうと混在するため。

---

## TypeScript の命名

| 対象 | 規則 | 例 |
|---|---|---|
| クラス（スタック・Construct） | PascalCase | `MichishiruStack`, `OidcStack` |
| インターフェース（プロパティ） | 対象クラス名 + `Props` | `MichishiruStackProps`, `OidcStackProps` |
| 型エイリアス | PascalCase | `Stage` |
| 変数・関数 | camelCase | `siteBucket`, `getRouteFn`, `frontendDistDir` |
| 定数 | UPPER_SNAKE_CASE | - |
| プロパティ | camelCase + `readonly` | `readonly stage: Stage` |

- `Props` インターフェースのプロパティは `readonly` を付ける（CDK の慣例。意図しない書き換えを防ぐ）
- `I` プレフィックス（`IStackProps` 等）は付けない

---

## CDK の論理ID（Construct ID）

`new s3.Bucket(this, 'SiteBucket', ...)` の第2引数。

| 規則 | PascalCase。役割を表す名詞 |
|---|---|
| 例 | `SiteBucket`, `RouteTable`, `GetRouteFunction`, `MichishiruApi`, `SiteDistribution`, `DeploySite` |

| ルール | 理由 |
|---|---|
| 環境名（`dev` / `prod`）を含めない | スタック自体が環境ごとに分かれているため不要 |
| 一度決めた論理IDを変更しない | CloudFormation はリソースを削除・再作成する。データが消える |
| リソース種別を接尾辞に付けるかは対象で判断 | `RouteTable`, `GetRouteFunction` のように種別が伝わる名前にする |

### CfnOutput の論理ID

| 規則 | PascalCase。取得できる値を表す |
|---|---|
| 例 | `ApiEndpoint`, `RouteTableName`, `SiteUrl`, `DistributionId`, `SiteBucketName`, `DeployRoleArn` |

---

## スタック名

| 種別 | 規則 | 例 |
|---|---|---|
| 環境ごとに作るスタック | `Michishiru-<環境>` | `Michishiru-dev`, `Michishiru-prod` |
| 環境に依存しないスタック | `Michishiru<用途>Stack` | `MichishiruOidcStack` |

環境ごとのスタックに `Stack` を付けないのは、CLI で頻繁に打つため（`npx cdk deploy Michishiru-dev`）。

---

## 物理名を指定するリソース／しないリソース

CloudFormation は「置き換えが必要な変更」でリソースを作り直す。物理名を固定していると、旧リソースが残っている間に同名の新リソースを作れずデプロイが失敗する。**原則として物理名は指定せず、CDK の自動生成に任せる。**

| リソース | 物理名 | 理由 |
|---|---|---|
| Lambda関数 | **指定しない** | 自動生成に任せる。名前で参照する場面がない |
| S3バケット | **指定しない** | 同上。グローバルで一意である必要があり衝突しやすい |
| CloudFront | **指定しない** | 同上 |
| DynamoDBテーブル | **指定する**（`Route-<環境>`） | seed スクリプトや運用作業で名前を指定するため |
| API Gateway | **指定する**（`michishiru-api-<環境>`） | AWSコンソールで識別するため |
| IAMロール | **指定する**（`github-actions-michishiru-deploy`） | GitHub Actions の設定に ARN を書くため |
| DynamoDB GSI | **指定する**（`GSI-<用途>`） | クエリ時にコードから名前で指定するため |

### 物理名の書式

| リソース | 書式 | 例 |
|---|---|---|
| DynamoDBテーブル | PascalCase（単数形） + `-<環境>` | `Route-dev`, `Route-prod` |
| DynamoDB GSI | `GSI-<用途>`（PascalCase） | `GSI-GenreDistance` |
| API Gateway | kebab-case + `-<環境>` | `michishiru-api-dev` |
| IAMロール | kebab-case | `github-actions-michishiru-deploy` |
| IAM PolicyStatement の `sid` | PascalCase | `AssumeCdkBootstrapRoles` |

環境識別子は**後ろに付ける**（`dev-Route` ではなく `Route-dev`）。AWSコンソールで名前順に並べたとき、同じリソースの dev / prod が隣に並ぶため。

---

## 環境（stage）

型は `iac/lib/michishiru-stack.ts` で定義し、他ファイルから import する。

```typescript
export type Stage = 'dev' | 'prod';
```

| 項目 | 内容 |
|---|---|
| 値 | 小文字の `dev` / `prod` のみ。`development` `production` `stg` などは使わない |
| ブランチとの対応 | `develop` → `dev`、`main` → `prod` |
| スタック名 | `Michishiru-dev` / `Michishiru-prod` |

---

## タグ

スタック全体に付与する。

| キー | 規則 | 値の例 |
|---|---|---|
| `Project` | PascalCase | `michishiru` |
| `Stage` | PascalCase | `dev` / `prod` |

タグのキーは PascalCase、値は小文字。AWS の課金レポートでグループ化するため、キーは全スタックで揃える。

---

## CDK context キー

`npx cdk deploy -c withBackend=true` のように渡す値。

| 規則 | camelCase |
|---|---|
| 例 | `withBackend` |

真偽値は文字列として渡るため、`app.node.tryGetContext('withBackend') === 'true'` の形で比較する。

---

## テストの配置

| 項目 | 内容 |
|---|---|
| 配置 | `iac/test/` |
| ファイル名 | `<対象>.test.ts` |
| ツール | Jest（`jest.config.js`） |
| 実行 | `npm test`（`iac/` で実行） |

`backend/` は `__tests__/` を使うが、`iac/` は `test/` を使う。それぞれの標準に合わせているため統一しない。

---

## セキュリティ・構成ルール

`ミチシル_前提条件.md` の「構成上の前提ルール」に加え、IaC 側で守ること。

| ルール | 詳細 |
|---|---|
| S3バケットは非公開にする | `BLOCK_ALL` + CloudFront の OAC 経由のみ |
| 暗号化と HTTPS を強制する | `encryption`, `enforceSSL` を指定する |
| 本番データは保護する | `removalPolicy` を prod は `RETAIN`、dev は `DESTROY` |
| IAM は最小権限にする | ワイルドカードの `*` を漫然と付けない |
| アカウントID・リポジトリ名はコードに書く | シークレットではないため可。**キーやトークンは書かない** |
| デプロイロールの ARN は GitHub Secrets で渡す | `AWS_DEPLOY_ROLE_ARN` |

---

## やってはいけないこと

| NG | 理由 |
|---|---|
| 一度作った論理ID（Construct ID）を変更する | リソースが削除・再作成される。DynamoDBならデータが消える |
| Lambda・S3・CloudFront に物理名を指定する | 置き換えを伴う変更でデプロイが失敗する |
| 論理IDに環境名を入れる | スタックが環境ごとに分かれているため冗長 |
| GSI名や属性名をデプロイ後に変更する | GSIの作り直しとデータ移行が必要になる。**デプロイ前に確定させる** |
| `cdk deploy` をローカルから本番へ実行する | デプロイは GitHub Actions 経由に限定する |
| APIキー・シークレットを `iac/` に書く | リポジトリに残る。Secrets Manager / SSM / GitHub Secrets を使う |

---

## 更新履歴

| 日付 | 内容 |
|---|---|
| 2026/09/02 | 新規作成。`iac/` の追加に伴い、TypeScript の命名・CDK論理ID・スタック名・AWSリソース物理名・タグ・context キー・テスト配置の規則を定義 |
