// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import SelectionHelper from './selectionHelper';
///import { moveCursor, endPosition, startPosition, nodeRange } from './utils';
//import parser from 'web-tree-sitter';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Initializing "code-leaper"!');

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'code-leaper.jumpNextStatement',
            async () => {
                const editor = vscode.window.activeTextEditor;
                if (!editor) return;

                const helper = new SelectionHelper(editor);

                await helper.init();

                const basePosition = editor.selection.active;

                // Go to next line if its the end of the line
                const position =
                    helper.isLineEmpty(basePosition) ||
                    helper.isEOL(basePosition)
                        ? helper.nextStart(basePosition)
                        : basePosition;

                const baseStatementRange = helper.getCurrentStatement(position);

                editor.selection = new vscode.Selection(
                    baseStatementRange.start,
                    baseStatementRange.end
                );
            }
        )
    );

    /* context.subscriptions.push(
        vscode.commands.registerCommand(
            'code-leaper.jumpPrevStatement',
            async () => {
                const editor = vscode.window.activeTextEditor;
                if (!editor) return;

                const statement = await getPrevStatement(editor);

                moveCursor(editor, startPosition(statement));
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            'code-leaper.selectNextStatement',
            async () => {
                const editor = vscode.window.activeTextEditor;
                if (!editor) return;

                const statement = await getNextStatement(editor);

                const range = nodeRange(statement);

                editor.selection = new vscode.Selection(range.start, range.end);
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            'code-leaper.selectPrevStatement',
            async () => {
                const editor = vscode.window.activeTextEditor;
                if (!editor) return;

                const statement = await getPrevStatement(editor);

                const range = nodeRange(statement);

                editor.selection = new vscode.Selection(range.end, range.start);
            }
        )
    ); */
}

// This method is called when your extension is deactivated
export function deactivate() {
    // empty
}
