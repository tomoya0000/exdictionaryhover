// モジュール 'vscode' には VS Code 拡張機能 API が含まれています
// 以下のコードで vscode というエイリアスでこのモジュールをインポートして参照します
import * as vscode from "vscode";

// このメソッドは拡張機能がアクティブ化されたときに呼び出されます
// 拡張機能はコマンドが初めて実行されたときにアクティブ化されます
export function activate(context: vscode.ExtensionContext) {
  // コンソールを使用して診断情報（console.log）やエラー（console.error）を出力します
  // このコード行は拡張機能がアクティブ化されたときに一度だけ実行されます
  console.log(
    'Congratulations, your extension "exdictionaryhover" is now active!'
  );

  // コマンドは package.json ファイルで定義されています
  // ここで registerCommand を使ってコマンドの実装を提供します
  // commandId パラメータは package.json の command フィールドと一致する必要があります
  const disposable = vscode.commands.registerCommand(
    "exdictionaryhover.helloWorld",
    () => {
      // ここに記述したコードは、コマンドが実行されるたびに実行されます
      // ユーザーにメッセージボックスを表示します
      vscode.window.showInformationMessage(
        "Hello World from ExDictionaryHover!"
      );
    }
  );

  context.subscriptions.push(disposable);
}

// このメソッドは拡張機能が非アクティブ化されたときに呼び出されます
export function deactivate() {}
