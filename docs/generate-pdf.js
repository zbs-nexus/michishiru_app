/**
 * Markdownファイルをブラウザで開けるHTMLに変換するスクリプト
 * PDFはブラウザの印刷機能で生成する
 */

import fs from 'fs';
import { marked } from 'marked';

const markdownPath = './ルート生成改善レポート.md';
const htmlPath = './ルート生成改善レポート.html';

// Markdownファイルを読み込む
const markdown = fs.readFileSync(markdownPath, 'utf-8');

// HTMLに変換
const contentHtml = marked(markdown);

// HTMLテンプレート
const html = `<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>ルート生成改善レポート</title>
  <style>
    @page {
      size: A4;
      margin: 20mm;
    }
    
    body {
      font-family: 'Yu Gothic', 'Meiryo', sans-serif;
      line-height: 1.8;
      color: #333;
      max-width: 210mm;
      margin: 0 auto;
      padding: 20px;
      font-size: 11pt;
    }
    
    h1 {
      color: #1a5490;
      border-bottom: 3px solid #1a5490;
      padding-bottom: 10px;
      margin-top: 30px;
      font-size: 24pt;
      page-break-after: avoid;
    }
    
    h2 {
      color: #2c6cb5;
      border-left: 5px solid #2c6cb5;
      padding-left: 15px;
      margin-top: 25px;
      font-size: 18pt;
      page-break-after: avoid;
    }
    
    h3 {
      color: #4a90e2;
      margin-top: 20px;
      font-size: 14pt;
      page-break-after: avoid;
    }
    
    h4 {
      color: #666;
      margin-top: 15px;
      font-size: 12pt;
      page-break-after: avoid;
    }
    
    table {
      border-collapse: collapse;
      width: 100%;
      margin: 15px 0;
      font-size: 10pt;
      page-break-inside: avoid;
    }
    
    th {
      background-color: #1a5490;
      color: white;
      padding: 10px;
      text-align: left;
      font-weight: bold;
    }
    
    td {
      border: 1px solid #ddd;
      padding: 8px;
    }
    
    tr:nth-child(even) {
      background-color: #f9f9f9;
    }
    
    tr:hover {
      background-color: #f0f7ff;
    }
    
    code {
      background-color: #f4f4f4;
      padding: 2px 6px;
      border-radius: 3px;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 9pt;
    }
    
    pre {
      background-color: #f4f4f4;
      padding: 15px;
      border-radius: 5px;
      overflow-x: auto;
      page-break-inside: avoid;
      font-size: 9pt;
    }
    
    pre code {
      background-color: transparent;
      padding: 0;
    }
    
    blockquote {
      border-left: 4px solid #ddd;
      padding-left: 15px;
      margin-left: 0;
      color: #666;
      font-style: italic;
    }
    
    ul, ol {
      margin: 10px 0;
      padding-left: 25px;
    }
    
    li {
      margin: 5px 0;
    }
    
    strong {
      color: #1a5490;
      font-weight: bold;
    }
    
    hr {
      border: none;
      border-top: 2px solid #ddd;
      margin: 30px 0;
    }
    
    .success {
      color: #28a745;
      font-weight: bold;
    }
    
    .warning {
      color: #ffc107;
      font-weight: bold;
    }
    
    .error {
      color: #dc3545;
      font-weight: bold;
    }
    
    .page-break {
      page-break-after: always;
    }
    
    @media print {
      body {
        max-width: 100%;
        padding: 0;
      }
      
      .no-print {
        display: none;
      }
      
      h1, h2, h3, h4 {
        page-break-after: avoid;
      }
      
      table, pre, blockquote {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="no-print" style="background: #e3f2fd; padding: 15px; border-radius: 5px; margin-bottom: 20px;">
    <strong>PDF生成方法:</strong> ブラウザの印刷機能（Ctrl+P または Cmd+P）で「PDFとして保存」を選択してください。
  </div>
  
  ${contentHtml}
  
  <hr>
  <footer style="text-align: center; color: #999; font-size: 9pt; margin-top: 30px;">
    <p>ミチシル - ルート作成地図アプリ</p>
    <p>© 2026 Michishiru Development Team</p>
  </footer>
</body>
</html>`;

// HTMLファイルを出力
fs.writeFileSync(htmlPath, html);

console.log(`✅ HTMLファイルを生成しました: ${htmlPath}`);
console.log('\n次のステップ:');
console.log('1. 生成されたHTMLファイルをブラウザで開く');
console.log('2. ブラウザの印刷機能（Ctrl+P）を開く');
console.log('3. 「送信先」で「PDFに保存」を選択');
console.log('4. 「保存」をクリック');
