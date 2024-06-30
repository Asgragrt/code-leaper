import * as vscode from 'vscode';
import parser from 'web-tree-sitter';
import { toPosition } from './utils';

export default class SelectionHelper {
    private static getNodeAtLocation?: (
        location: vscode.Location
    ) => parser.SyntaxNode;
    private editor: vscode.TextEditor;
    private document: vscode.TextDocument;

    constructor(editor: vscode.TextEditor) {
        this.editor = editor;
        this.document = editor.document;
    }

    private async getNode(
        position: vscode.Position | vscode.Range
    ): Promise<parser.SyntaxNode> {
        if (!SelectionHelper.getNodeAtLocation) {
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
            console.log('Invoking pokey.parse-tree extension');
            SelectionHelper.getNodeAtLocation = getNodeAtLocation;
        }

        const location = new vscode.Location(this.document.uri, position);

        return SelectionHelper.getNodeAtLocation(location);
    }

    private growNodeToStatement(node: parser.SyntaxNode): parser.SyntaxNode {
        // TODO Clean this part
        let currentNode: parser.SyntaxNode = node;
        let currentEndPosition: vscode.Position = toPosition(
            currentNode.endPosition
        );
        let currentStartPosition: vscode.Position = toPosition(
            currentNode.startPosition
        );

        while (
            !this.isEndOfLine(currentEndPosition) ||
            !this.isStartOfLine(currentStartPosition)
        ) {
            if (!currentNode.parent) break;
            currentNode = currentNode.parent;
            currentEndPosition = toPosition(currentNode.endPosition);
            currentStartPosition = toPosition(currentNode.startPosition);
        }

        return currentNode;
    }

    //async getStatementAtNode

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

    // Line utils
    private getLine(line: number): vscode.TextLine {
        return this.document.lineAt(line);
    }

    private isStartOfLine(position: vscode.Position): boolean {
        const { firstNonWhitespaceCharacterIndex: column } = this.getLine(
            position.line
        );
        const startPosition = new vscode.Position(position.line, column);
        return position.isEqual(startPosition);
    }

    private isEndOfLine(position: vscode.Position): boolean {
        const { text } = this.getLine(position.line);
        const endPosition = new vscode.Position(
            position.line,
            text.trimEnd().length
        );
        return position.isEqual(endPosition);
    }

    private isLineEmpty(line: number): boolean {
        return this.getLine(line).isEmptyOrWhitespace;
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
