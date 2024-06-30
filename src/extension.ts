// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import parser from 'web-tree-sitter';

function toPosition(position: parser.Point) {
    return new vscode.Position(position.row, position.column);
}

function endOfLine(
    editor: vscode.TextEditor,
    position: vscode.Position
): boolean {
    return position.isEqual(editor.document.lineAt(position.line).range.end);
}

function findStatementEnd(
    editor: vscode.TextEditor,
    node: parser.SyntaxNode
): vscode.Position {
    let currentNode: parser.SyntaxNode = node;
    let currentPosition: vscode.Position = toPosition(currentNode.endPosition);
    while (!endOfLine(editor, currentPosition)) {
        if (!currentNode.parent) break;
        currentNode = currentNode.parent;
        currentPosition = toPosition(currentNode.endPosition);
    }
    return currentPosition;
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Congratulations, your extension "code-leaper" is now active!');

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    const disposable = vscode.commands.registerCommand(
        'code-leaper.helloWorld',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            const parseTreeExtension =
                vscode.extensions.getExtension('pokey.parse-tree');

            if (parseTreeExtension == null) {
                throw new Error('Depends on pokey.parse-tree extension');
            }

            const { getNodeAtLocation } = await parseTreeExtension.activate();

            const newRange = new vscode.Range(
                editor.selection.start,
                editor.selection.end
            );

            const location = new vscode.Location(editor.document.uri, newRange);

            const node: parser.SyntaxNode = getNodeAtLocation(location);

            const position = findStatementEnd(editor, node);

            setCursorPosition(editor, position);

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
