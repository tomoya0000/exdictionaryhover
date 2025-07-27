# ExDictionaryHover AI Development Guide

このプロジェクトはすべての開発プロセスと文書を日本語で管理しています。
AI アシスタントは必ずすべての応答を日本語で行ってください。

このガイドは、ExDictionaryHover VS Code 拡張機能の開発に関する重要な情報を提供します。

## アーキテクチャの概要

### コアコンポーネント

- **SQL マップ管理** (`extension.ts`):
  - グローバルな`sqlMap: Map<string, string>`で SQL ID と SQL 文のマッピングを管理
  - パフォーマンス重視の設計：O(1)検索を実現
- **ファイル処理** (`extension.ts`: `loadSqlMapFromCsv`, `readFileWithEncoding`):
  - CSV/TSV ファイルの読み込みと解析
  - マルチエンコーディング対応（UTF-8, Shift-JIS, EUC-JP）
- **ホバー処理** (`extension.ts`: `provideHover`):
  - SQL ID 検索とホバー表示の制御
  - 柔軟な検索ロジック（完全一致 → 末尾 1 桁除外）

### データフロー

1. 拡張機能アクティベーション時に CSV/TSV ファイルを読み込み
2. SQL ID と SQL 文を Map に格納
3. エディタでのホバーイベント時に Map を検索
4. 該当する SQL 文を表示

## 開発ワークフロー

### ビルドとテスト

```bash
npm install          # 依存関係のインストール
npm run watch       # 開発時の自動ビルド
npm run compile     # 単独ビルド
npm run test        # テストの実行
npx vsce package     # VSIX作成
```

### デバッグ

- `F5`でデバッグセッション開始
- 出力パネルの「ExDictionaryHover」でログ確認
- テスト時は`extension.test.ts`の一時ディレクトリ作成を確認

## プロジェクト固有の規約

### コードスタイル

- TypeScript の厳格な型チェック
- グローバル変数は最小限（`sqlMap`と`outputChannel`のみ）
- エラー処理は出力チャネルとユーザー通知の併用

### テスト規約

- 一時ディレクトリを使用したファイル操作テスト
- 正常系と異常系の両方をカバー
- ホバープロバイダーのテストは`vscode.commands.executeCommand`を使用

### 設定ファイル形式

CSV/TSV ファイルの要件:

- 1 行目はヘッダー行として扱う
- 必須列: SQL ID, SQL 文
- オプション列: 説明文

## 重要なファイル

- `src/extension.ts`: メイン実装
- `src/test/extension.test.ts`: テストケース
- `sql/sqlmap.tsv`: SQL マップのサンプル
- `package.json`: 拡張機能の設定と依存関係

## パフォーマンス考慮事項

- メモリ使用量は SQL 数に比例
- 大規模辞書への対応:
  - Map による効率的な検索
  - エンコーディング変換の最適化
