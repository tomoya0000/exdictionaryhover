# ExDictionaryHover

ExDictionaryHoverは、外部ファイル（CSV/TSV形式）で定義したSQL辞書を参照し、エディタ上でSQL IDにカーソルを合わせると対応するSQL文や説明をホバー表示するVisual Studio Code拡張機能です。

## 主な機能

- 複数のCSV/TSVファイルからSQL ID・SQL文・説明を読み込み、IDとSQL文・説明をマッピング
- 任意の言語ファイルでSQL IDにマウスカーソルを合わせると、対応するSQL文と説明をポップアップ表示
- 辞書ファイルのパスや列番号は設定で柔軟に指定可能

## 使い方

1. `sql/sqlmap.tsv` など、SQL ID・SQL文・説明を含むCSVまたはTSVファイルを用意します。
2. `settings.json` で `exDictionaryHover.csvFiles` にファイルパスや列番号を設定します（未設定の場合はデフォルトのテスト用ファイルが読み込まれます）。
3. エディタ上でSQL IDにカーソルを合わせると、対応するSQL文・説明がホバー表示されます。

## 拡張機能設定

この拡張機能は以下の設定をサポートします（`settings.json`に記述）:

```json
"exDictionaryHover.csvFiles": [
  {
    "filePath": "sql/sqlmap.tsv",
    "idCol": 0,
    "sqlCol": 1,
    "descCol": 2,
    "encode": "utf-8",
  }
]
```

- `filePath`: CSV/TSVファイルのパス（拡張機能ディレクトリ基準、または絶対パス）
- `idCol`: SQL IDの列番号（0始まり）
- `sqlCol`: SQL文の列番号（0始まり）
- `descCol`: 説明の列番号（0始まり、省略可）
- `encode`: ファイルのエンコード（省略可能、デフォルトutf-8）

## 必要条件

- Visual Studio Code v1.100.0 以上

## 既知の問題

- SQL IDが辞書に存在しない場合は何も表示されません。
- CSV/TSVファイルの1行目はヘッダーとして扱われます。

## リリースノート

### 0.0.1

- 初期リリース: SQL辞書ファイルのホバー表示に対応

---

## 開発・デバッグ

- F5キーで拡張機能をデバッグ実行できます。
- `src/extension.ts` に主なロジックがあります。

---

## ライセンス

MIT
