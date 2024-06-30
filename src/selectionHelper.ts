import * as vscode from 'vscode';
import parser from 'web-tree-sitter';
import { toPosition, clampPositionToRange } from './utils';

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
            !this.isStartOfLine(currentStartPosition) ||
            currentNode.childCount == 0
        ) {
            if (!currentNode.parent) break;
            currentNode = currentNode.parent;
            currentEndPosition = toPosition(currentNode.endPosition);
            currentStartPosition = toPosition(currentNode.startPosition);
        }

        return currentNode;
    }

    //async getStatementAtNode

    async nextStatement(
        startPosition: vscode.Position
    ): Promise<parser.SyntaxNode> {
        const clampedPosition = this.clampPositionToText(
            this.isLineEmpty(startPosition.line)
                ? this.nextNonEmptyLineStart(startPosition.line)
                : startPosition
        );

        // If EOL check if is the end of the statement
        let newPosition = this.isEndOfLine(clampedPosition)
            ? clampedPosition.translate(0, -1)
            : clampedPosition;

        const baseNode = await this.getNode(newPosition);

        const statementNode = this.growNodeToStatement(baseNode);

        let nextStatement: parser.SyntaxNode | undefined;
        // If the cursor was at the end of the statement jump to the next
        if (toPosition(statementNode.endPosition).isEqual(clampedPosition)) {
            const nextPosition = this.nextNonEmptyLineStart(
                clampedPosition.line
            );
            const nextBase = await this.getNode(nextPosition);
            nextStatement = this.growNodeToStatement(nextBase);
        }

        return nextStatement ? nextStatement : statementNode;
    }

    // Line utils
    private getLine(line: number): vscode.TextLine {
        return this.document.lineAt(line);
    }

    private firstCharacterPosition(line: number): vscode.Position;
    private firstCharacterPosition(position: vscode.Position): vscode.Position;
    private firstCharacterPosition(
        argument: vscode.Position | number
    ): vscode.Position {
        const line =
            argument instanceof vscode.Position ? argument.line : argument;
        const { firstNonWhitespaceCharacterIndex: column } = this.getLine(line);
        return new vscode.Position(line, column);
    }

    private lastCharacterPosition(line: number): vscode.Position;
    private lastCharacterPosition(position: vscode.Position): vscode.Position;
    private lastCharacterPosition(
        argument: vscode.Position | number
    ): vscode.Position {
        const line =
            argument instanceof vscode.Position ? argument.line : argument;
        const { text } = this.getLine(line);
        return new vscode.Position(line, text.trimEnd().length);
    }

    private lineTextRange(line: number): vscode.Range;
    private lineTextRange(position: vscode.Position): vscode.Range;
    private lineTextRange(argument: vscode.Position | number): vscode.Range {
        const line =
            argument instanceof vscode.Position ? argument.line : argument;
        return new vscode.Range(
            this.firstCharacterPosition(line),
            this.lastCharacterPosition(line)
        );
    }

    private clampPositionToText(position: vscode.Position): vscode.Position {
        return clampPositionToRange(position, this.lineTextRange(position));
    }

    private isStartOfLine(position: vscode.Position): boolean {
        return position.isEqual(this.firstCharacterPosition(position));
    }

    private isEndOfLine(position: vscode.Position): boolean {
        return position.isEqual(this.lastCharacterPosition(position));
    }

    private isLineEmpty(line: number): boolean {
        return this.getLine(line).isEmptyOrWhitespace;
    }

    private nextNonEmptyLine(currentLine: number): number {
        let line = currentLine + 1;
        while (line < this.document.lineCount && this.isLineEmpty(line)) {
            line++;
        }

        return line < this.document.lineCount ? line : currentLine;
    }

    private nextNonEmptyLineStart(currentLine: number): vscode.Position {
        const line = this.nextNonEmptyLine(currentLine);

        return this.firstCharacterPosition(line);
    }

    private prevNonEmptyLine(currentLine: number): number {
        let line = currentLine - 1;
        while (line >= 0 && this.isLineEmpty(line)) {
            line--;
        }

        return line >= 0 ? line : currentLine;
    }

    private prevNonEmptyLineStart(currentLine: number): vscode.Position {
        const line = this.prevNonEmptyLine(currentLine);

        return this.firstCharacterPosition(line);
    }
}
