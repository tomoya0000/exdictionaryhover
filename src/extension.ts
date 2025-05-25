import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { parse } from "csv-parse/sync";

let sqlMap: Record<string, string> = {};

/**
 * CSVまたはTSVファイルから指定した列番号の値をキー・値としてsqlMapに格納します。
 *
 * @param filePath - CSVまたはTSVファイルのパス
 * @param idCol - SQL IDの列番号（0始まり）
 * @param sqlCol - SQL文の列番号（0始まり）
 * @param descCol - 説明の列番号（0始まり、未使用なら-1）
 */
function loadSqlMapFromCsv(
  filePath: string,
  idCol: number,
  sqlCol: number,
  descCol: number = -1,
  hasHeader: boolean = true
) {
  let content: string;
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch (error) {
    return; // File does not exist or cannot be read
  }
  const isTsv = path.extname(filePath).toLowerCase() === ".tsv";
  const records = parse(content, {
    columns: false,
    skip_empty_lines: true,
    delimiter: isTsv ? "\t" : ",",
    trim: true,
  });
  // ヘッダー行をスキップするかどうかを確認
  const startIndex = hasHeader ? 1 : 0;
  for (let i = startIndex; i < records.length; i++) {
    for (let i = 1; i < records.length; i++) {
      const row = records[i];
      const id = row[idCol];
      const sql = row[sqlCol];
      const desc = descCol >= 0 ? row[descCol] : "";
      if (id && sql) {
        // 必要に応じて説明も格納したい場合は値をオブジェクトにする
        sqlMap[id.trim()] = desc
          ? `${sql.trim()}\n\nーーーーーーーーーーーーーーーーーーーー\n\n${desc.trim()}`
          : sql.trim();
      }
    }
  }
}

/**
 * ExDictionaryHover拡張機能をアクティブ化します。
 *
 * この関数は拡張機能がアクティブ化されたときに呼び出されます。主な処理内容は以下の通りです:
 * - 拡張機能がアクティブ化されたことをログに出力します。
 * - ユーザー設定（settings.json）の "exDictionaryHover.csvFiles" キーからCSVファイル設定を読み込みます。
 * - CSVファイルが設定されていない場合は、デフォルトのテスト用CSVファイルパスを設定します。
 * - 各CSVファイルについて絶対パスを解決し、`loadSqlMapFromCsv` を使ってSQLマップを読み込みます。
 * - すべての言語に対してホバープロバイダーを登録し、SQL IDに対応するSQL文をホバー表示します。
 *
 * @param context - VS Codeから提供される拡張機能コンテキスト。拡張機能の環境情報やサブスクリプション管理に使用されます。
 */
export function activate(context: vscode.ExtensionContext) {
  console.log(
    'Congratulations, your extension "exdictionaryhover" is now active!'
  );

  // settings.jsonからファイル設定を取得
  const config = vscode.workspace.getConfiguration("exDictionaryHover");
  const csvFiles: Array<{
    filePath: string;
    idCol: number;
    sqlCol: number;
    descCol?: number;
  }> = config.get("csvFiles") || [];

  // if (csvFiles.length === 0) {
  //   // デフォルトのパスを設定※テスト用
  //   csvFiles.push({
  //     filePath: path.join(context.extensionPath, "sql", "sqlmap.tsv"),
  //     idCol: 0,
  //     sqlCol: 1,
  //     descCol: 2, // 説明列はオプション
  //   });
  //   csvFiles.push({
  //     filePath: path.join(context.extensionPath, "sql", "sqlmap2.tsv"),
  //     idCol: 0,
  //     sqlCol: 1,
  //     descCol: 2, // 説明列はオプション
  //   });
  // }

  csvFiles.forEach((file) => {
    // 相対パスは拡張機能ディレクトリ基準に変換
    const absPath = path.isAbsolute(file.filePath)
      ? file.filePath
      : path.join(context.extensionPath, file.filePath);
    loadSqlMapFromCsv(
      absPath,
      file.idCol,
      file.sqlCol,
      file.descCol !== undefined ? file.descCol : -1
    );
  });

  const provider = vscode.languages.registerHoverProvider("*", {
    provideHover(document, position, token) {
      const range = document.getWordRangeAtPosition(position, /(\w+)/);
      if (!range) {
        return;
      }

      const sqlid = document.getText(range).replace(/"/g, "");
      const sql = sqlMap[sqlid];
      if (sql) {
        return new vscode.Hover(sql);
      }
    },
  });

  context.subscriptions.push(provider);
}

// このメソッドは拡張機能が非アクティブ化されたときに呼び出されます
export function deactivate() {
  // No cleanup is required when the extension is deactivated.
}
