// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import SelectionHelper from './selectionHelper';
//import { moveCursor } from './utils';
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
                const start = performance.now();
                const editor = vscode.window.activeTextEditor;
                if (!editor) return;

                const initStart = performance.now();

                const helper = new SelectionHelper(editor);

                if (!SelectionHelper.isInit) await SelectionHelper.init();

                const initEnd = performance.now();

                const basePosition = editor.selection.end;

                // Go to next non-empty line (ignoring comments)
                const position = helper.isLineEmpty(basePosition)
                    ? helper.nextStart(basePosition)
                    : basePosition;

                let range = helper.getCurrentStatement(position);

                const end1 = performance.now();

                // Clamp to ignore characters such as \r\n
                // Go to next statement if at the end of statement
                if (position.isEqual(helper.clampToLine(range.end))) {
                    range = helper.getCurrentStatement(
                        helper.nextStart(position)
                    );
                }

                const end2 = performance.now();

                // Improve selection by getting the largest at the end (should help overall)
                // ? Maybe make it an option
                range = helper.getCurrentStatement(range.end);

                const end3 = performance.now();

                console.log(
                    `Duration init: ${(initEnd - initStart).toString()} ms`
                );
                console.log(`Duration 1: ${(end1 - start).toString()} ms`);
                console.log(`Duration 2: ${(end2 - start).toString()} ms`);
                console.log(`Duration 3: ${(end3 - start).toString()} ms`);

                //moveCursor(editor, range.end);
                editor.selection = new vscode.Selection(range.start, range.end);
                //moveCursor(editor, (await getNext(editor)).end);
            }
        )
    );
    /* context.subscriptions.push(
        vscode.commands.registerCommand(
            'code-leaper.jumpNextStatement',
            async () => {
                const editor = vscode.window.activeTextEditor;
                if (!editor) return;

                const helper = new SelectionHelper(editor);

                await helper.init();

                const basePosition = editor.selection.end;

                // Go to next non-empty line (ignoring comments)
                const position = helper.isLineEmpty(basePosition)
                    ? helper.nextStart(basePosition)
                    : basePosition;

                let range = helper.getCurrentStatement(position);

                // Clamp to ignore characters such as \r\n
                // Go to next statement if at the end of statement
                if (position.isEqual(helper.clampToLine(range.end))) {
                    range = helper.getCurrentStatement(
                        helper.nextStart(position)
                    );
                }

                moveCursor(editor, range.end);
                //moveCursor(editor, (await getNext(editor)).end);
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
