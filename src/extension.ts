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
            // The code you place here will be executed every time your command is executed
            // Display a message box to the user
            vscode.window.showInformationMessage(
                'Hello World from Code Leaper!'
            );

            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            const cursorPosition = editor.selection.end;

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

            // TODO check if descendants
            /*
            const lastChild = node.lastChild;
            if (lastChild) {
                const newPosition = new vscode.Position(
                    lastChild.endPosition.row,
                    lastChild.endPosition.column
                );
                setCursorPosition(editor, newPosition);
                return;
            }
            */

            const position = findStatementEnd(editor, node);

            setCursorPosition(editor, position);

            jumpToCursor(editor);

            console.log(node);

            /*
            // TODO set as option
            if (
                editor.document.lineAt(editor.selection.end.line)
                    .isEmptyOrWhitespace
            ) {
                goToNonEmptyLine(editor);
            }

            lineSelect(editor);

            await growSelection(editor, cursorPosition);

            setCursorPosition(editor, editor.selection.active);

            // Reveal current cursor position
            const position = editor.selection.active;
            const range = new vscode.Range(position, position);
            editor.revealRange(range, vscode.TextEditorRevealType.Default);
            */
        }
    );

    context.subscriptions.push(disposable);
}

function jumpToCursor(editor: vscode.TextEditor) {
    const position = editor.selection.active;
    const range = new vscode.Range(position, position);
    editor.revealRange(range, vscode.TextEditorRevealType.Default);
}

const lineSelect = function lineSelect(editor: vscode.TextEditor) {
    const { document } = editor;

    const selection = editor.selection;

    const currentLine = selection.active.line;

    if (document.lineAt(currentLine).isEmptyOrWhitespace) {
        goToNonEmptyLine(editor);
    }

    const { start: lineStart, end: lineEnd } = getLinePosition(
        document,
        currentLine
    );

    const lineSelection = new vscode.Selection(lineEnd, lineStart);

    editor.selection = lineSelection;
};

const growSelection = async function growSelection(
    editor: vscode.TextEditor,
    originalPosition: vscode.Position
) {
    const { document } = editor;
    // Find better way of getting this expansion and check if command exists
    await vscode.commands.executeCommand('editor.action.smartSelect.expand');

    const { start: newStart, end: newEnd } = editor.selection;

    if (
        newStart.isEqual(newEnd) ||
        document.lineAt(newEnd.line).isEmptyOrWhitespace ||
        newEnd.isEqual(originalPosition)
    ) {
        goToNonEmptyLine(editor);
        return;
    }

    if (newStart.character == 0) {
        //setCursorPosition(editor, newEnd);
        return;
    }

    await growSelection(editor, originalPosition);
};

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

const getLinePosition = function getLineTextRange(
    document: vscode.TextDocument,
    line: number
): { start: vscode.Position; end: vscode.Position } {
    const {
        firstNonWhitespaceCharacterIndex: lineStart,
        range: lineRange,
        lineNumber,
    } = document.lineAt(line);

    return {
        start: new vscode.Position(lineNumber, lineStart),
        end: lineRange.end,
    };
};

// This method is called when your extension is deactivated
export function deactivate() {}
