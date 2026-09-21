# 機能解説書自動生成スキル

## 目的

developブランチにマージされた機能について、開発初心者向けの解説書を自動生成する。

## 実行タイミング

- developブランチへの新しいマージを検知したとき
- 手動で「解説書を作成して」と依頼されたとき

## 解説書の要件

### 対象読者
- 開発初心者（プログラミング経験が浅いメンバー）
- 専門用語は避け、平易な日本語で説明する

### 構成要素

1. **基本情報**
   - マージ日付
   - featureブランチ名
   - 課題番号（NZ-X）
   - 実装した機能の概要

2. **機能の目的**
   - なぜこの機能が必要なのか
   - どんな問題を解決するのか

3. **処理の流れ**
   - 全体的な処理フロー（図解または番号付きリスト）
   - 各ステップの詳細説明
   - 重要なファイルとその役割

4. **コードの解説**
   - 主要な関数・メソッドの説明
   - 入力と出力
   - 注意すべきポイント

5. **動作確認方法**
   - ローカルでの確認手順
   - テストの実行方法

6. **関連ファイル一覧**
   - 変更・追加されたファイルのリスト
   - 各ファイルの役割

## 解説書の形式

- **フォーマット**: HTML
- **ファイル名**: `<課題番号>_<機能名>_実装解説.html`
- **保存先**: `docs/解説書/`

## 重複の防止

解説書作成前に以下を確認する：

1. `docs/` および `docs/解説書/` 内の既存ファイルをチェック
2. 同じ課題番号（NZ-X）の解説書が存在する場合はスキップ
3. 作成済みリストをログとして記録

## 解説書のテンプレート構造

```html
<!DOCTYPE html>
<html lang="ja">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>[課題番号] [機能名] - 実装解説</title>
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
    </style>
</head>
<body>
    <div class="container">
        <h1>[課題番号] [機能名] - 実装解説</h1>
        
        <div class="info-box">
            <strong>📅 マージ日:</strong> YYYY-MM-DD<br>
            <strong>🌿 ブランチ:</strong> feature/NZ-X-xxx<br>
            <strong>📝 課題番号:</strong> NZ-X
        </div>

        <h2>📖 この機能について</h2>
        <p>[機能の目的と概要を初心者にも分かりやすく説明]</p>

        <h2>🎯 なぜこの機能が必要？</h2>
        <p>[背景と必要性を説明]</p>

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
                </tr>
                <tr>
                    <td><code>[ファイルパス]</code></td>
                    <td>[役割の説明]</td>
                </tr>
            </table>
        </div>
    </div>
</body>
</html>
```

## 実行手順

### 1. マージ情報の取得

```bash
git log --first-parent develop --merges --pretty=format:"%h|%ai|%s" | Select-Object -First 10
```

### 2. 既存解説書の確認

`docs/` および `docs/解説書/` 内のファイルをチェック

### 3. 差分の特定

各マージコミットについて：
- `git diff <commit>^1 <commit> --name-only` で変更ファイルを取得
- `git show <commit>` でコミットメッセージと詳細を取得

### 4. 解説書の生成

- テンプレートに情報を埋め込む
- コードの重要部分を抽出
- 処理フローを整理
- 初心者向けに平易な言葉で説明を追加

### 5. 保存

`docs/解説書/<課題番号>_<機能名>_実装解説.html` に保存

## プロンプト例

```
developブランチの最新5件のマージについて、まだ解説書が作成されていない機能の解説書を作成してください。
```

## 注意事項

- 専門用語を使う場合は必ず補足説明を入れる
- 図やフローチャートを積極的に使用する（Mermaidなど）
- コードの抜粋は必要最小限にし、重要な部分のみを示す
- 実際の動作例やスクリーンショットがあれば含める
- 既存の解説書と重複しないよう必ずチェックする
