// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import parser from 'web-tree-sitter';

class SelectionHelper {
    editor: vscode.TextEditor;
    document: vscode.TextDocument;
    getNodeAtLocation?: (location: vscode.Location) => parser.SyntaxNode;

    constructor(editor: vscode.TextEditor) {
        this.editor = editor;
        this.document = editor.document;
    }

    private async getNode(
        position: vscode.Position | vscode.Range
    ): Promise<parser.SyntaxNode> {
        if (!this.getNodeAtLocation) {
            // Activate parse-tree extension
            const parseTreeExtension =
                vscode.extensions.getExtension('pokey.parse-tree');

            if (parseTreeExtension == null) {
                throw new Error('Depends on pokey.parse-tree extension');
            }

            const {
                getNodeAtLocation,
            }: {
                getNodeAtLocation: (
                    location: vscode.Location
                ) => parser.SyntaxNode;
            } = await parseTreeExtension.activate();
            this.getNodeAtLocation = getNodeAtLocation;
        }

        const location = new vscode.Location(this.document.uri, position);

        return this.getNodeAtLocation(location);
    }

    private growNodeToStatement(node: parser.SyntaxNode): parser.SyntaxNode {
        let currentNode: parser.SyntaxNode = node;
        let currentPosition: vscode.Position = toPosition(
            currentNode.endPosition
        );

        while (!this.isEndOfLine(currentPosition)) {
            if (!currentNode.parent) break;
            currentNode = currentNode.parent;
            currentPosition = toPosition(currentNode.endPosition);
        }

        return currentNode;
    }

    async getStatement(position: vscode.Position): Promise<parser.SyntaxNode> {
        // If EOL check if is the end of the statement
        let newPosition = this.isEndOfLine(position)
            ? position.translate(0, -1)
            : position;

        const baseNode = await this.getNode(newPosition);

        // TODO fix this :D
        const statementNode = this.growNodeToStatement(baseNode);

        let nextStatement: parser.SyntaxNode | undefined;
        // If the cursor was at the end of the statement jump to the next
        if (toPosition(statementNode.endPosition).isEqual(position)) {
            const nextPosition = this.getNextNonEmptyPosition(position.line);
            const nextBase = await this.getNode(nextPosition);
            nextStatement = this.growNodeToStatement(nextBase);
        }

        return nextStatement ? nextStatement : statementNode;
    }

    private isEndOfLine(position: vscode.Position): boolean {
        return position.isEqual(this.getLine(position.line).range.end);
    }

    private isLineEmpty(line: number): boolean {
        return this.getLine(line).isEmptyOrWhitespace;
    }

    private getLine(line: number): vscode.TextLine {
        return this.document.lineAt(line);
    }

    private getNextNonEmptyPosition(currentLine: number): vscode.Position {
        let line = currentLine + 1;
        while (line < this.document.lineCount && this.isLineEmpty(line)) {
            line++;
        }

        if (line >= this.document.lineCount) {
            return this.getLine(currentLine).range.end;
        }

        const { firstNonWhitespaceCharacterIndex: column } = this.getLine(line);

        return new vscode.Position(line, column);
    }
}

function toPosition(position: parser.Point) {
    return new vscode.Position(position.row, position.column);
}

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
        'code-leaper.helloWorld',
        async () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            if (isCursorOnEmptyLine(editor)) {
                goToNonEmptyLine(editor);
            }

            const statement = await new SelectionHelper(editor).getStatement(
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
