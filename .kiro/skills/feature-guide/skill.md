---
name: feature-guide
description: develop ブランチにマージされた修正から、開発初心者向けの機能解説書（HTML）を機能ごとに生成する。「解説書を作って」「機能解説書を生成して」と依頼されたときに使う。
---

# 機能解説書自動生成スキル

## 目的

develop ブランチにマージされた修正について、開発初心者向けの解説書を自動生成する。

## 対象範囲

### 期間

**既定は「実行日の6日前から実行日まで」**（実行日を含む7日間）に develop ブランチへマージされた修正を対象とする。

ただし、**依頼時に別途指示があった場合はその指示に従う。** 例えば次のような指示は既定の期間より優先する。

| 指示の例 | 対象 |
|---|---|
| 「最新5件のマージについて」 | 期間ではなく件数で絞る |
| 「9月分の解説書を作って」 | 指定された期間 |
| 「このブランチの解説書を作って」 | 指定されたブランチのマージ |
| 「口コミ機能の解説書を作って」 | 指定された機能に関わるマージ |

期間や件数の指示が曖昧な場合は、どの範囲を対象にするか確認してから進める。

### 対象外にするマージ

解説書にする価値が薄いマージは除外する。期間内であっても以下は作らない。

| 条件 | 例 |
|---|---|
| 変更ファイルが `.kiro/` 配下のみ | 規約・スキルの更新 |
| 変更ファイルが `docs/` 配下のみ | 仕様書・解説書自体の更新 |
| 変更ファイルがロックファイル・設定の微修正のみ | `package-lock.json`、`.gitignore`、`.vscode/` |
| 含まれるコミットの種別が `docs` / `chore` / `style` のみ | 体裁の調整、依存の更新 |

判断に迷う場合は作る側に倒す。利用者が「規約整備の解説書も作って」のように明示した場合は、除外条件に当てはまっても作成する。

除外したマージは、最後の報告で「対象外」として理由とともに列挙する。黙って飛ばさない。

`.github/workflows/` の変更（CI/CD）は**除外しない。** デプロイの仕組みは初心者がつまずきやすく、解説書の価値が高い。

### 分割の単位

**解説書は「機能」ごとに1本作成する。** featureブランチ1本＝解説書1本ではない。

- 複数の featureブランチ（＝複数のマージ）が合わさって1つの機能になることがある。その場合はまとめて1本の解説書にする
- 逆に、1本のマージに無関係な修正が混ざっている場合は、機能ごとに分けて書く

同じ機能とみなす判断材料は以下。

| 観点 | 同じ機能とみなす例 |
|---|---|
| 変更ファイル | 同じ画面・同じLambda関数・同じストアに触っている |
| ブランチ名 | `feature/review-post` と `fix/review-photo` のように内容が続いている |
| ユーザーストーリー | 別ブランチだが同じ US-X の受け入れ条件を満たす |
| 前後関係 | フロント側とバックエンド側に分かれているが、1つの機能として成立する |

グルーピングの結果は、解説書を書き始める前に一覧として提示し、分け方に問題がないか確認する。

## 解説書の要件

### 対象読者
- 開発初心者（プログラミング経験が浅いメンバー）
- 専門用語は避け、平易な日本語で説明する

### 構成要素

1. **基本情報**
   - 対象期間
   - マージ日付（複数ある場合はすべて）
   - 対象ブランチ名（複数ある場合はすべて）
   - 対象マージコミット（短縮ハッシュ。複数ある場合はすべて）
   - 実装した機能の概要

2. **先に知っておきたいこと**
   - この機能を理解するうえで前提になる知識を3〜5個、それぞれ1〜3文で説明する
   - 実装者向けの注意ではなく、**読み手が知らないと話が追えないこと**を書く
   - 例: 「Pinia のストアとは何か」「Lambda のレイヤー責務（handler / service / repository）」「Composable とは何か」「SPA では画面を再読み込みすると状態が消える」
   - 既存の解説書で説明済みの前提は、その解説書へのリンクに置き換えてよい

3. **機能の目的**
   - なぜこの機能が必要なのか
   - どんな問題を解決するのか
   - 関連するユーザーストーリー（US-X）があれば明記する

4. **処理の流れ**
   - 全体的な処理フロー（図解または番号付きリスト）
   - 各ステップの詳細説明
   - 重要なファイルとその役割
   - 複数のマージにまたがる場合は、どのマージがどの部分を担っているかを示す

5. **コードの解説**
   - 主要な関数・メソッドの説明
   - 入力と出力
   - 注意すべきポイント

6. **動作確認方法**
   - ローカルでの確認手順
   - テストの実行方法

7. **関連ファイル一覧**
   - 変更・追加されたファイルのリスト
   - 各ファイルの役割

8. **関連ドキュメント**
   - 解説書を読んだ後に参照すべき既存ドキュメントへのリンクを置く
   - 解説書を独立した読み物にせず、既存ドキュメントへの入口にする

   | リンク先 | `docs/解説書/` からの相対パス | 何を書くか |
   |---|---|---|
   | 前提条件書（該当するUS） | `../../.kiro/steering/ミチシル_前提条件.md` | この機能が満たす US-X の受け入れ条件 |
   | 設計書 | `../設計書.md` | API仕様・データ構造の詳細 |
   | 仕様書 | `../仕様書.md` | 画面仕様 |
   | 用語辞書 | `../../.kiro/steering/naming-glossary.md` | 本文に出てくる用語の定義 |
   | 関連する他の解説書 | `./<機能名>_実装解説.html` | 前提になる機能、続きの機能 |

   - 存在しないドキュメントへのリンクは書かない。張る前にファイルの有無を確認する
   - リンクには「何が書いてあるか」を一言添える。URLだけ並べない

## 解説書の形式

- **フォーマット**: HTML
- **ファイル名**: `<機能名>_実装解説.html`
- **保存先**: `docs/解説書/`

### 機能名の決め方

機能名を思いつきで付けると、同じ機能が別名で2本できたり（`口コミ投稿` と `レビュー投稿`）、別の機能が同名になって1本に混ざったりする。次の順で決める。

1. **既存ファイル名を先に確認する。** `docs/解説書/` と `docs/` のファイル名を一覧で取得し、今回の機能が既存のどれかに該当しないか判断する。該当するなら**既存の名前をそのまま使い、ファイル名は変えない**（更新になる）
2. **新規なら `naming-glossary.md` の日本語表記から語を選ぶ。** 「口コミ」「散歩結果」「案内」「ルート提案」「パスワード再設定」などは辞書にあるので、そこから採れば実行ごとにブレない
3. **辞書にない機能なら、先に辞書へ追記する。** 用語辞書の運用ルール（コードより先に辞書を更新する）と同じ。追記は利用者に提案し、承諾を得てから行う

### 既存ファイル名との照合

過去に作られた解説書は、現在の命名規則と違う形のファイル名になっていることがある。

| 項目 | 扱い |
|---|---|
| 照合の方法 | ファイル名が規則どおりでなくても、**機能名の部分が一致すれば同じ機能とみなす** |
| 既存ファイルのリネーム | **しない。** 他ドキュメントからのリンクが切れるため、今のファイル名のまま更新する |
| 新規ファイル | 現在の規則に従う（`<機能名>_実装解説.html`） |

### ファイル名に使える文字

- 日本語を使う（`docs/` 配下は日本語ファイル名を許容する、という規約に従う）
- `\ / : * ? " < > |` は使えない。機能名にこれらが入る場合は言い換える（`API/認可` → `APIの認可`）
- 中点（`・`）と全角括弧は使える

## 既存ファイルの扱い（上書きの方針）

**既定では上書きしない。** 解説書を書き始める前に `docs/` および `docs/解説書/` の既存ファイルを確認し、下表に従って処理を決める。

| 既存ファイルの状態 | 処理 |
|---|---|
| 同じ機能の解説書がない | 新規作成する |
| 同じ機能の解説書があり、対象マージがすべて記載済み | 何もしない（スキップしたことを報告する） |
| 同じ機能の解説書があり、対象マージに未記載のものがある | 既存ファイルを**更新**する。既存の記述は消さず、追加されたマージの内容を該当する節へ加え、基本情報の対象期間・ブランチ・マージコミットを追記する |
| 既存の記述が現在のコードと食い違っている | 食い違っている箇所を指摘し、更新するか確認してから直す |

記載済みかどうかは、既存ファイルの基本情報にあるマージコミットの短縮ハッシュで判定する。ファイル名では判定しない。

利用者が「作り直して」「上書きして」と明示した場合のみ、既存ファイルを破棄して新規作成する。

作成・更新・スキップの結果は、最後に一覧で報告する。

## 目次ページ

解説書が増えると探しづらくなるため、`docs/解説書/index.html` を目次として維持する。**解説書を作成・更新したら必ず目次も更新する。**

| 項目 | 内容 |
|---|---|
| 保存先 | `docs/解説書/index.html` |
| 載せる対象 | `docs/解説書/` 配下の全解説書。加えて `docs/` 直下に置かれている実装解説のHTMLも載せる（相対パスで `../` を付けてリンクする） |
| 並び順 | 最終更新日の新しい順 |
| 列 | 機能名（リンク） / 一行説明 / 最終更新日 / 対象マージ |
| 更新方法 | 既存の行は壊さず、追加・変更した機能の行だけ差し替える |

目次のテンプレート構造：

```html
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>ミチシル 機能解説書 一覧</title>
    <style>
        body {
            font-family: 'Segoe UI', Meiryo, sans-serif;
            line-height: 1.8;
            max-width: 1000px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background-color: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
        }
        .lead {
            background-color: #e8f4f8;
            border-left: 4px solid #3498db;
            padding: 15px;
            margin: 20px 0;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
            vertical-align: top;
        }
        th {
            background-color: #3498db;
            color: white;
        }
        a {
            color: #2980b9;
        }
        code {
            background-color: #f4f4f4;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 13px;
        }
    </style>
</head>
<body>
    <div class="container">
        <h1>ミチシル 機能解説書 一覧</h1>

        <div class="lead">
            develop ブランチにマージされた機能の実装解説です。開発に参加したばかりの方は、
            上から順に読まず、担当する機能のものから読んでください。
        </div>

        <table>
            <tr>
                <th>機能</th>
                <th>どんな機能か</th>
                <th>最終更新</th>
                <th>対象マージ</th>
            </tr>
            <tr>
                <td><a href="[ファイル名]">[機能名]</a></td>
                <td>[一行説明]</td>
                <td>YYYY-MM-DD</td>
                <td><code>abc1234</code></td>
            </tr>
        </table>
    </div>
</body>
</html>
```

## 解説書のテンプレート構造

```html
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>[機能名] - 実装解説</title>
    <style>
        body {
            font-family: 'Segoe UI', Meiryo, sans-serif;
            line-height: 1.8;
            max-width: 1000px;
            margin: 0 auto;
            padding: 20px;
            background-color: #f5f5f5;
        }
        .container {
            background-color: white;
            padding: 40px;
            border-radius: 8px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        h1 {
            color: #2c3e50;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
        }
        h2 {
            color: #34495e;
            margin-top: 30px;
            border-left: 4px solid #3498db;
            padding-left: 10px;
        }
        h3 {
            color: #555;
        }
        .info-box {
            background-color: #e8f4f8;
            border-left: 4px solid #3498db;
            padding: 15px;
            margin: 20px 0;
        }
        .prereq {
            background-color: #f0f7ec;
            border-left: 4px solid #27ae60;
            padding: 15px;
            margin: 15px 0;
        }
        .code-block {
            background-color: #f8f8f8;
            border: 1px solid #ddd;
            border-radius: 4px;
            padding: 15px;
            overflow-x: auto;
            font-family: 'Consolas', 'Monaco', monospace;
            font-size: 14px;
        }
        .flow-step {
            background-color: #fff9e6;
            border-left: 4px solid #f39c12;
            padding: 15px;
            margin: 10px 0;
        }
        .file-list {
            background-color: #f0f0f0;
            padding: 15px;
            border-radius: 4px;
        }
        .important {
            background-color: #ffe6e6;
            border-left: 4px solid #e74c3c;
            padding: 10px;
            margin: 15px 0;
        }
        ul, ol {
            margin-left: 20px;
        }
        code {
            background-color: #f4f4f4;
            padding: 2px 6px;
            border-radius: 3px;
            font-family: 'Consolas', 'Monaco', monospace;
        }
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 12px;
            text-align: left;
        }
        th {
            background-color: #3498db;
            color: white;
        }
        a {
            color: #2980b9;
        }
    </style>
</head>
<body>
    <div class="container">
        <p><a href="./index.html">← 解説書の一覧へ</a></p>

        <h1>[機能名] - 実装解説</h1>

        <div class="info-box">
            <strong>🗓 対象期間:</strong> YYYY-MM-DD 〜 YYYY-MM-DD<br>
            <strong>📅 マージ日:</strong> YYYY-MM-DD（複数ある場合は列挙）<br>
            <strong>🌿 対象ブランチ:</strong> feature/xxx, fix/yyy<br>
            <strong>🔖 対象マージ:</strong> <code>abc1234</code>, <code>def5678</code>
        </div>

        <h2>🧩 先に知っておきたいこと</h2>
        <div class="prereq">
            <strong>[前提知識の名前]</strong><br>
            [1〜3文で説明。既存の解説書で説明済みならそちらへリンクする]
        </div>
        <div class="prereq">
            <strong>[前提知識の名前]</strong><br>
            [1〜3文で説明]
        </div>

        <h2>📖 この機能について</h2>
        <p>[機能の目的と概要を初心者にも分かりやすく説明]</p>

        <h2>🎯 なぜこの機能が必要？</h2>
        <p>[背景と必要性を説明。関連するユーザーストーリー（US-X）があれば明記]</p>

        <h2>🔄 処理の流れ</h2>
        <div class="flow-step">
            <strong>Step 1:</strong> [ステップの説明]
        </div>
        <div class="flow-step">
            <strong>Step 2:</strong> [ステップの説明]
        </div>

        <h2>💻 コードの解説</h2>
        <h3>[ファイル名]</h3>
        <p>[ファイルの役割]</p>
        <div class="code-block">
            <pre>[重要なコードの抜粋]</pre>
        </div>
        <p>[コードの解説]</p>

        <h2>⚠️ 注意ポイント</h2>
        <div class="important">
            [重要な注意事項]
        </div>

        <h2>✅ 動作確認方法</h2>
        <ol>
            <li>[確認手順1]</li>
            <li>[確認手順2]</li>
        </ol>

        <h2>📁 関連ファイル一覧</h2>
        <div class="file-list">
            <table>
                <tr>
                    <th>ファイル</th>
                    <th>役割</th>
                    <th>由来のブランチ</th>
                </tr>
                <tr>
                    <td><code>[ファイルパス]</code></td>
                    <td>[役割の説明]</td>
                    <td>[feature/xxx]</td>
                </tr>
            </table>
        </div>

        <h2>🔗 関連ドキュメント</h2>
        <table>
            <tr>
                <th>ドキュメント</th>
                <th>何が書いてあるか</th>
            </tr>
            <tr>
                <td><a href="../../.kiro/steering/ミチシル_前提条件.md">前提条件書</a></td>
                <td>この機能が満たす US-X の受け入れ条件</td>
            </tr>
            <tr>
                <td><a href="../設計書.md">設計書</a></td>
                <td>[参照すべき節と、そこに書かれていること]</td>
            </tr>
            <tr>
                <td><a href="../../.kiro/steering/naming-glossary.md">用語辞書</a></td>
                <td>本文に出てくる用語の定義</td>
            </tr>
            <tr>
                <td><a href="./[関連する解説書]">[関連する機能名]</a></td>
                <td>[前提になる機能／続きの機能]</td>
            </tr>
        </table>
    </div>
</body>
</html>
```

## 実行手順

### 1. 対象期間の決定

依頼に別途の指示がなければ、実行日の6日前から実行日までを対象期間とする。指示があればそれに従う。

### 2. マージ情報の取得

既定の期間（直近7日間）を対象にする場合：

```bash
git log --first-parent develop --merges --since="6 days ago" --pretty=format:"%h|%ai|%s"
```

期間を明示的に指定する場合：

```bash
git log --first-parent develop --merges --since="2026-10-08" --until="2026-10-14 23:59:59" --pretty=format:"%h|%ai|%s"
```

件数で指示された場合（例: 最新5件）：

```bash
git log --first-parent develop --merges -n 5 --pretty=format:"%h|%ai|%s"
```

`develop` がローカルで古い場合は `git fetch origin develop` の後に `origin/develop` を対象にする。

該当するマージが0件なら、解説書を作らずその旨を報告して終了する。

### 3. 差分の特定

各マージコミットについて：
- `git diff <commit>^1 <commit> --name-only` で変更ファイルを取得
- `git show <commit>` でコミットメッセージと詳細を取得
- `git log <commit>^1..<commit> --pretty=format:"%s"` でマージに含まれる個々のコミットを取得

### 4. 対象外マージの除外

「対象外にするマージ」に従い、変更ファイルとコミット種別から除外対象を判定する。除外したものは理由を控えておき、最後の報告に載せる。

### 5. 機能ごとのグルーピング

残ったマージを機能単位にまとめる。

1. 変更ファイル・ブランチ名・ユーザーストーリーから、同じ機能に属するマージを束ねる
2. 1つのマージに複数の機能が混ざっている場合は分ける
3. グルーピング結果を次の形で提示し、分け方を確認する

| 機能名 | 含まれるマージ | 主な変更ファイル | 既存の解説書 |
|---|---|---|---|
| 口コミ投稿 | `abc1234`, `def5678` | `frontend/src/components/feature/review/` ほか | なし（新規作成） |
| 散歩実績の保存 | `9876fed` | `backend/functions/createWalkResult/` ほか | あり（更新） |

### 6. 既存解説書の確認と機能名の決定

1. `docs/` および `docs/解説書/` のファイル名を一覧取得する
2. 「機能名の決め方」に従い、既存ファイルへの該当を判断してから機能名を決める
3. 「既存ファイルの扱い（上書きの方針）」に従い、新規作成・更新・スキップを決める
4. 辞書にない語を機能名に使う必要がある場合は、`naming-glossary.md` への追記を提案する

### 7. 解説書の生成

機能ごとに1本ずつ生成する。

- テンプレートに情報を埋め込む
- 実際のコードを読んで確認した内容だけを書く。コミットメッセージからの推測で説明を書かない
- コードの重要部分を抽出
- 処理フローを整理（複数マージにまたがる場合はどのマージが何を担うか示す）
- 「先に知っておきたいこと」は、その機能を読むのに必要な前提知識に絞る
- 「関連ドキュメント」のリンクは、張る前にリンク先ファイルの存在を確認する
- 初心者向けに平易な言葉で説明を追加

### 8. 目次の更新

`docs/解説書/index.html` を更新する。追加・変更した機能の行だけ差し替え、既存の行は壊さない。目次が未作成なら新規作成し、既存の解説書すべてを載せる。

### 9. 報告

結果を一覧で報告する。

| 機能名 | ファイル | 処理 |
|---|---|---|
| 口コミ投稿 | `docs/解説書/口コミ投稿_実装解説.html` | 新規作成 |
| 散歩実績の保存 | `docs/解説書/散歩実績の保存_実装解説.html` | 更新（`9876fed` を追記） |
| - | `docs/解説書/index.html` | 更新 |

対象外にしたマージも理由とともに載せる。

| マージ | 理由 |
|---|---|
| `1a2b3c4` | 変更が `.kiro/steering/` のみ（規約更新） |

## プロンプト例

```
解説書を作成してください。
```
→ 実行日の6日前から実行日までに develop へマージされた修正を対象に、機能ごとに解説書を作成する。

```
developブランチの最新5件のマージについて、まだ解説書が作成されていない機能の解説書を作成してください。
```
→ 期間ではなく件数の指示が優先される。

## 注意事項

- 期間の既定は「実行日の6日前から実行日まで」。別途指示があればそちらを優先する
- 解説書は機能単位。featureブランチ単位で機械的に分割しない
- グルーピングは書き始める前に提示して確認を取る
- 機能名は思いつきで付けない。既存ファイル名の確認 → 用語辞書 の順で決める
- 既存ファイルは既定で上書きしない。同じ機能に新しいマージがあれば更新する
- 既存ファイルのリネームはしない（リンクが切れる）
- 解説書を作成・更新したら目次（`index.html`）も必ず更新する
- 対象外にしたマージは黙って飛ばさず、理由とともに報告する
- 専門用語を使う場合は必ず補足説明を入れる
- 図やフローチャートを積極的に使用する（Mermaidなど）
- コードの抜粋は必要最小限にし、重要な部分のみを示す
- 実際の動作例やスクリーンショットが手元にあれば含める（撮影の自動化は未対応）
- 用語は `.kiro/steering/naming-glossary.md` に揃える（`spot` と `waypoint` の混同に注意）
