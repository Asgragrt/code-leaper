// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import SelectionHelper from './selectionHelper';
import { toPosition } from './utils';

function isCursorOnEmptyLine(editor: vscode.TextEditor) {
    return isLineEmpty(editor, editor.selection.active.line);
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Initializing "code-leaper"!');

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    const disposable = vscode.commands.registerCommand(
        'code-leaper.jumpNextStatement',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            const statement = await new SelectionHelper(editor).nextStatement(
                editor.selection.active
            );

            setCursorPosition(editor, toPosition(statement.endPosition));

            jumpToCursor(editor);
        }
    );

    context.subscriptions.push(disposable);
}

function jumpToCursor(editor: vscode.TextEditor) {
    const position = editor.selection.active;
    const range = new vscode.Range(position, position);
    editor.revealRange(range, vscode.TextEditorRevealType.Default);
}

function isLineEmpty(editor: vscode.TextEditor, line: number): boolean {
    return editor.document.lineAt(line).isEmptyOrWhitespace;
}

function goToNonEmptyLine(editor: vscode.TextEditor) {
    const { document } = editor;

    let line = editor.selection.end.line + 1;
    while (
        line < document.lineCount &&
        document.lineAt(line).isEmptyOrWhitespace
    ) {
        line++;
    }
    if (line >= document.lineCount) return;

    const { firstNonWhitespaceCharacterIndex: column } = document.lineAt(line);
    setCursorPosition(editor, line, column);
}

function setCursorPosition(
    editor: vscode.TextEditor,
    position: vscode.Position
): void;
function setCursorPosition(
    editor: vscode.TextEditor,
    line: number,
    column: number
): void;
function setCursorPosition(
    ...args:
        | [vscode.TextEditor, vscode.Position]
        | [vscode.TextEditor, number, number]
): void {
    if (args.length == 3) {
        const newPosition = new vscode.Position(args[1], args[2]);
        args[0].selection = new vscode.Selection(newPosition, newPosition);
        return;
    }

    args[0].selection = new vscode.Selection(args[1], args[1]);
}

// This method is called when your extension is deactivated
export function deactivate() {
    // empty
}
