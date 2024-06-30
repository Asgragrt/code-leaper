import * as vscode from 'vscode';
import parser from 'web-tree-sitter';
import { toPosition, clampPositionToRange } from './utils';

type getNodeAtLocation = (location: vscode.Location) => parser.SyntaxNode;

export default class SelectionHelper {
    private static getNodeAtLocation?: getNodeAtLocation;
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

            const { getNodeAtLocation } =
                (await parseTreeExtension.activate()) as {
                    getNodeAtLocation: getNodeAtLocation;
                };
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
        const newPosition = this.isEndOfLine(clampedPosition)
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

    async prevStatement(
        startPosition: vscode.Position
    ): Promise<parser.SyntaxNode> {
        const clampedPosition = this.clampPositionToText(
            this.isLineEmpty(startPosition.line)
                ? this.prevNonEmptyLineStart(startPosition.line)
                : startPosition
        );

        // If EOL go to previous character to avoid overgrowing
        const newPosition = this.isEndOfLine(clampedPosition)
            ? clampedPosition.translate(0, -1)
            : clampedPosition;

        const baseNode = await this.getNode(newPosition);

        // TODO fix this :D
        const statementNode = this.growNodeToStatement(baseNode);

        console.log(statementNode);

        let prevStatement: parser.SyntaxNode | undefined;
        // If the cursor was at the start of the statement jump to the previous
        if (toPosition(statementNode.startPosition).isEqual(clampedPosition)) {
            const prevPosition = this.prevNonEmptyLineStart(
                clampedPosition.line
            );
            const prevBase = await this.getNode(prevPosition);
            prevStatement = this.growNodeToStatement(prevBase);
        }

        return prevStatement ? prevStatement : statementNode;
    }

    // Apply goTo to the position if the line is empty, then clamp it to the text
    processPosition(
        position: vscode.Position,
        goTo: (p: vscode.Position) => vscode.Position
    ) {
        const goPosition = this.isLineEmpty(position)
            ? goTo(position)
            : position;
        return this.clampPositionToText(goPosition);
    }

    // Line utils
    getLine(line: number): vscode.TextLine {
        return this.document.lineAt(line);
    }

    firstCharacterPosition(
        argument: vscode.Position | number
    ): vscode.Position {
        const line =
            argument instanceof vscode.Position ? argument.line : argument;
        const { firstNonWhitespaceCharacterIndex: column } = this.getLine(line);
        return new vscode.Position(line, column);
    }

    lastCharacterPosition(argument: vscode.Position | number): vscode.Position {
        const line =
            argument instanceof vscode.Position ? argument.line : argument;
        const { text } = this.getLine(line);
        return new vscode.Position(line, text.trimEnd().length);
    }

    lineTextRange(argument: vscode.Position | number): vscode.Range {
        const line =
            argument instanceof vscode.Position ? argument.line : argument;
        return new vscode.Range(
            this.firstCharacterPosition(line),
            this.lastCharacterPosition(line)
        );
    }

    clampPositionToText(position: vscode.Position): vscode.Position {
        return clampPositionToRange(position, this.lineTextRange(position));
    }

    isStartOfLine(position: vscode.Position): boolean {
        return position.isEqual(this.firstCharacterPosition(position));
    }

    isEndOfLine(position: vscode.Position): boolean {
        return position.isEqual(this.lastCharacterPosition(position));
    }

    isLineEmpty(argument: vscode.Position | number): boolean {
        const line =
            argument instanceof vscode.Position ? argument.line : argument;
        return this.getLine(line).isEmptyOrWhitespace;
    }

    nextNonEmptyLine(argument: vscode.Position | number): number {
        const currentLine =
            argument instanceof vscode.Position ? argument.line : argument;
        let line = currentLine + 1;
        while (line < this.document.lineCount && this.isLineEmpty(line)) {
            line++;
        }

        return line < this.document.lineCount ? line : currentLine;
    }

    nextNonEmptyLineStart(argument: vscode.Position | number): vscode.Position {
        const currentLine =
            argument instanceof vscode.Position ? argument.line : argument;
        const line = this.nextNonEmptyLine(currentLine);

        return this.firstCharacterPosition(line);
    }

    prevNonEmptyLine(argument: vscode.Position | number): number {
        const currentLine =
            argument instanceof vscode.Position ? argument.line : argument;
        let line = currentLine - 1;
        while (line >= 0 && this.isLineEmpty(line)) {
            line--;
        }

        return line >= 0 ? line : currentLine;
    }

    prevNonEmptyLineStart(argument: vscode.Position | number): vscode.Position {
        const currentLine =
            argument instanceof vscode.Position ? argument.line : argument;
        const line = this.prevNonEmptyLine(currentLine);

        return this.firstCharacterPosition(line);
    }
}
