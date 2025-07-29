import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { parse } from "csv-parse/sync";
import * as iconv from "iconv-lite";

// グローバル変数
let outputChannel: vscode.OutputChannel;
let sqlMap: Map<string, string> = new Map();

// 型定義
interface CsvFileConfig {
  filePath: string;
  idCol: number;
  sqlCol: number;
  descCol?: number | number[];
  encode?: string;
}

/**
 * CSVまたはTSVファイルから指定した列番号の値をキー・値としてsqlMapに格納します。
 */
function loadSqlMapFromCsv(
  filePath: string,
  idCol: number,
  sqlCol: number,
  descCol: number | number[] = -1,
  encode: string = "utf-8",
  hasHeader: boolean = true
) {
  try {
    outputChannel.appendLine(
      `[${EXTENSION_NAME}] ファイル読み込み開始: ${filePath}`
    );

    const content = readFileWithEncoding(filePath, encode);
    const isTsv = path.extname(filePath).toLowerCase() === ".tsv";

    const records = parse(content, {
      columns: false,
      skip_empty_lines: true,
      delimiter: isTsv ? "\t" : ",",
      trim: true,
      relax_column_count: true,
      skip_records_with_error: false,
      quote: false,
      escape: false,
    });

    const startIndex = hasHeader ? 1 : 0;
    let registeredCount = 0;

    for (let i = startIndex; i < records.length; i++) {
      const record = records[i];
      if (processRecord(record, idCol, sqlCol, descCol)) {
        registeredCount++;
      }
    }

    outputChannel.appendLine(
      `[${EXTENSION_NAME}] 読み込み完了: ${registeredCount}件を登録`
    );
  } catch (error) {
    const errorMsg = `[${EXTENSION_NAME}] ファイル読み込みエラー: ${filePath}`;
    outputChannel.appendLine(errorMsg);
    outputChannel.appendLine(
      `詳細: ${error instanceof Error ? error.message : error}`
    );
    console.error(errorMsg, error);
  }
}

// 定数定義
const EXTENSION_NAME = "ExDictionaryHover";
const ENCODING_UTF8 = "utf-8";
const QUOTE_REGEX = /['"'"』「」]/g;
const WORD_REGEX = /(\w+)/;

// エンコーディング名を正規化する関数
function normalizeEncoding(encoding: string): string {
  const enc = encoding.toLowerCase().replace(/[-_]/g, "");
  const encodingMap: Record<string, string> = {
    sjis: "shift_jis",
    shiftjis: "shift_jis",
    eucjp: "euc-jp",
    euc: "euc-jp",
    utf8: "utf-8",
  };
  return encodingMap[enc] || encoding;
}

/**
 * ファイルを指定されたエンコーディングで読み込む
 */
function readFileWithEncoding(filePath: string, encoding: string): string {
  const buffer = fs.readFileSync(filePath);
  const normalizedEncoding = normalizeEncoding(encoding);

  if (iconv.encodingExists(normalizedEncoding)) {
    return iconv.decode(buffer, normalizedEncoding);
  } else {
    outputChannel.appendLine(
      `[${EXTENSION_NAME}] 警告: エンコード '${encoding}' は未サポート。UTF-8として処理します。`
    );
    return buffer.toString("utf8");
  }
}

/**
 * CSVレコードを解析してSQLマップに登録する
 */
function processRecord(
  row: string[],
  idCol: number,
  sqlCol: number,
  descCol: number | number[]
): boolean {
  if (!row || row.length <= Math.max(idCol, sqlCol)) {
    return false;
  }

  const id = row[idCol]?.trim();
  const sql = row[sqlCol]?.trim();
  
  // 複数の説明列を処理
  let desc = "";
  if (Array.isArray(descCol)) {
    // 配列の場合、各列の内容を区切り線で結合
    const descriptions = descCol
      .filter(col => col >= 0 && col < row.length)
      .map(col => row[col]?.trim() || "")
      .filter(text => text.length > 0);
    desc = descriptions.join("\n\n");
  } else if (descCol >= 0 && descCol < row.length) {
    // 単一列の場合
    desc = row[descCol]?.trim() || "";
  }

  if (!id || !sql) {
    return false;
  }

  try {
    const value = desc
      ? `${sql}\n\nーーーーーーーーーーーーーーーーーーーー\n\n${desc}`
      : sql;

    sqlMap.set(id, value);
    return true;
  } catch (error) {
    console.error(`[${EXTENSION_NAME}] SQLマップ登録エラー:`, error);
    return false;
  }
}

/**
 * SQL IDに対してマッピングされたSQL文を検索する
 */
function findSqlMapping(
  originalSqlid: string
): { sql: string; usedSqlid: string } | null {
  // 最初に完全一致で検索
  let sql = sqlMap.get(originalSqlid);
  let usedSqlid = originalSqlid;

  // 完全一致しない場合、末尾1桁を除外して再検索
  if (!sql && originalSqlid.length > 1) {
    const truncatedSqlid = originalSqlid.slice(0, -1);
    sql = sqlMap.get(truncatedSqlid);

    if (sql) {
      usedSqlid = truncatedSqlid;
      console.log(
        `[${EXTENSION_NAME}] 末尾1桁除外でマッピング発見: ${originalSqlid} → ${truncatedSqlid}`
      );
    }
  }

  return sql ? { sql, usedSqlid } : null;
}

/**
 * ホバー時のSQL IDを正規化する
 */
function normalizeHoverId(text: string): string {
  return text
    .replace(QUOTE_REGEX, "") // 半角・全角の引用符を除去
    .trim(); // 念のため前後の空白も除去
}

/**
 * ホバー表示用のコンテンツを生成する
 */
function createHoverContent(
  sql: string,
  usedSqlid: string,
  originalSqlid: string
): string {
  return usedSqlid !== originalSqlid
    ? `**SQL ID: ${usedSqlid}** (元: ${originalSqlid})\n\n${sql}`
    : sql;
}

/**
 * CSV設定ファイルを検証し、存在確認とロードを行う
 */
function loadCsvFiles(
  context: vscode.ExtensionContext,
  csvFiles: CsvFileConfig[]
): void {
  csvFiles.forEach((file) => {
    const absPath = path.isAbsolute(file.filePath)
      ? file.filePath
      : path.join(context.extensionPath, file.filePath);

    if (!fs.existsSync(absPath)) {
      const errorMsg = `[${EXTENSION_NAME}] ファイルが存在しません: ${absPath}`;
      outputChannel.appendLine(errorMsg);
      vscode.window.showErrorMessage(errorMsg);
      return;
    }

    loadSqlMapFromCsv(
      absPath,
      file.idCol,
      file.sqlCol,
      file.descCol,
      file.encode
    );
  });
}
export function activate(context: vscode.ExtensionContext) {
  // 出力チャンネルの初期化
  outputChannel = vscode.window.createOutputChannel("ExDictionaryHover");
  context.subscriptions.push(outputChannel);

  // settings.jsonからファイル設定を取得
  const config = vscode.workspace.getConfiguration("exDictionaryHover");
  const csvFiles: CsvFileConfig[] = config.get("csvFiles") || [];

  // CSVファイルを読み込む
  loadCsvFiles(context, csvFiles);

  // ホバープロバイダーを登録
  const provider = vscode.languages.registerHoverProvider("*", {
    provideHover(document, position, token) {
      // カーソル位置の単語を取得（英数字とアンダースコアのみ）
      const range = document.getWordRangeAtPosition(position, WORD_REGEX);
      if (!range) {
        return undefined;
      }

      // ホバー時のIDを正規化
      const originalSqlid = normalizeHoverId(document.getText(range));

      // SQL IDマッピングを検索
      const mapping = findSqlMapping(originalSqlid);

      if (mapping) {
        const hoverContent = createHoverContent(
          mapping.sql,
          mapping.usedSqlid,
          originalSqlid
        );
        return new vscode.Hover(hoverContent, range);
      }

      return undefined;
    },
  });

  context.subscriptions.push(provider);

  outputChannel.appendLine(
    `[${EXTENSION_NAME}] 拡張機能がアクティブになりました。${sqlMap.size}件のマッピングを読み込みました。`
  );
}

// このメソッドは拡張機能が非アクティブ化されたときに呼び出されます
export function deactivate() {
  // リソースのクリーンアップが必要な場合はここで実行
}
