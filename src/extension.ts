import * as vscode from "vscode";
import * as path from "path";
import * as fs from "fs";
import { parse } from "csv-parse/sync";

// 出力チャンネルの作成
let outputChannel: vscode.OutputChannel;

// Mapを使用してルックアップパフォーマンスを改善
let sqlMap: Map<string, string> = new Map();

/**
 * CSVまたはTSVファイルから指定した列番号の値をキー・値としてsqlMapに格納します。
 * ファイルの読み込み、パース、マッピングの作成を行い、エラーが発生した場合は適切にログを出力します。
 *
 * @param filePath - CSVまたはTSVファイルのパス。絶対パスまたは相対パスを指定可能
 * @param idCol - SQL IDが格納されている列番号（0始まり）。この値がマップのキーとなる
 * @param sqlCol - SQL文が格納されている列番号（0始まり）。この値がマップの値となる
 * @param descCol - 説明文が格納されている列番号（0始まり、未使用なら-1）。指定時はSQL文と共に表示
 * @param encode - ファイルのエンコード（デフォルトutf-8）。ShiftJISなど他の文字コードも指定可能
 * @param hasHeader - ファイルの1行目をヘッダーとしてスキップするかどうか（デフォルトtrue）
 * @throws Error ファイルの読み込みに失敗した場合
 */
function loadSqlMapFromCsv(
  filePath: string,
  idCol: number,
  sqlCol: number,
  descCol: number = -1,
  encode: BufferEncoding = "utf-8",
  hasHeader: boolean = true
) {
  let content: string;
  try {
    outputChannel.appendLine(
      `[ExDictionaryHover] ファイル読み込み開始: ${filePath}, エンコード: ${encode}`
    );
    // エンコーディングをより明示的に指定
    content = fs.readFileSync(filePath, { encoding: encode, flag: "r" });
    outputChannel.appendLine(
      `[ExDictionaryHover] ファイル読み込み成功: ${filePath}, サイズ: ${content.length}バイト`
    );
  } catch (error) {
    console.error(`[ExDictionaryHover] ファイル読み込みエラー: ${filePath}`, {
      error: error instanceof Error ? error.message : error,
      stack: error instanceof Error ? error.stack : undefined,
      encode,
    });
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
    const row = records[i];
    const id = row[idCol];
    const sql = row[sqlCol];
    const desc = descCol >= 0 ? row[descCol] : "";
    if (id && sql) {
      try {
        const trimmedId = id.trim();
        const trimmedSql = sql.trim();
        const trimmedDesc = desc ? desc.trim() : "";
        // 必要に応じて説明も格納したい場合は値をオブジェクトにする
        sqlMap.set(
          trimmedId,
          trimmedDesc
            ? `${trimmedSql}\n\nーーーーーーーーーーーーーーーーーーーー\n\n${trimmedDesc}`
            : trimmedSql
        );
        console.log(
          `[ExDictionaryHover] SQLマップ登録成功: ID=${trimmedId}, 長さ=${trimmedSql.length}文字`
        );
      } catch (error) {
        console.error(`[ExDictionaryHover] SQLマップ登録エラー:`, {
          error: error instanceof Error ? error.message : error,
          stack: error instanceof Error ? error.stack : undefined,
          id: id,
          sqlLength: sql.length,
          descLength: desc ? desc.length : 0,
        });
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
  // 出力チャンネルの初期化
  outputChannel = vscode.window.createOutputChannel("ExDictionaryHover");
  context.subscriptions.push(outputChannel);

  // settings.jsonからファイル設定を取得
  const config = vscode.workspace.getConfiguration("exDictionaryHover");
  const csvFiles: Array<{
    filePath: string;
    idCol: number;
    sqlCol: number;
    descCol?: number;
    encode?: string;
  }> = config.get("csvFiles") || [];

  // if (csvFiles.length === 0) {
  //   // デフォルトのパスを設定※テスト用
  //   csvFiles.push({
  //     filePath: path.join(context.extensionPath, "sql", "sqlmap.tsv"),
  //     idCol: 0,
  //     sqlCol: 1,
  //     descCol: 2, // 説明列はオプション
  //     encode: "utf-8",　// エンコードはオプション
  //   });
  //   csvFiles.push({
  //     filePath: path.join(context.extensionPath, "sql", "sqlmap2.tsv"),
  //     idCol: 0,
  //     sqlCol: 1,
  //     descCol: 2, // 説明列はオプション
  //     encode: "utf-8", // エンコードはオプション
  //   });
  // }

  csvFiles.forEach((file) => {
    const absPath = path.isAbsolute(file.filePath)
      ? file.filePath
      : path.join(context.extensionPath, file.filePath);

    // 設定値とパスをログ出力
    console.log(`[ExDictionaryHover] 設定:`, {
      absPath,
      idCol: file.idCol,
      sqlCol: file.sqlCol,
      descCol: file.descCol,
      encode: file.encode,
    });

    // ファイル存在チェック
    if (!fs.existsSync(absPath)) {
      const errorMsg = `[ExDictionaryHover] ファイルが存在しません: ${absPath}`;
      outputChannel.appendLine(errorMsg);
      vscode.window.showErrorMessage(errorMsg);
    }

    loadSqlMapFromCsv(
      absPath,
      file.idCol,
      file.sqlCol,
      file.descCol,
      file.encode as BufferEncoding | undefined
    );
  });

  const provider = vscode.languages.registerHoverProvider("*", {
    provideHover(document, position, token) {
      // カーソル位置の単語を取得（英数字とアンダースコアのみ）
      const range = document.getWordRangeAtPosition(position, /(\w+)/);
      if (!range) {
        return undefined; // 有効な単語が見つからない場合は処理終了
      }

      // ホバー時のIDを取得（各種クォーテーションを除去）し、マッピング状況をログ出力
      const sqlid = document
        .getText(range)
        .replace(/['"'"』「」]/g, "") // 半角・全角の引用符を除去
        .trim(); // 念のため前後の空白も除去
      console.log(
        `[ExDictionaryHover] ホバーID: ${sqlid}, 元の文字列: ${document.getText(
          range
        )}`
      );
      const sql = sqlMap.get(sqlid);
      if (sql) {
        // マッピングが存在する場合はホバー表示
        return new vscode.Hover(sql, range);
      }
      // マッピングが無い場合は警告ログ
      console.warn(`[ExDictionaryHover] マッピング無し: ${sqlid}`);
      return undefined;
    },
  });

  context.subscriptions.push(provider);

  console.log(
    `Extension "exdictionaryhover" is now active! Loaded ${sqlMap.size} SQL mappings from ${csvFiles.length} CSV file(s).`
  );
}

// このメソッドは拡張機能が非アクティブ化されたときに呼び出されます
export function deactivate() {
  // No cleanup is required when the extension is deactivated.
  // If any resources (e.g., event listeners) are added in the future, they should be disposed of here.
}
