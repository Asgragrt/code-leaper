import * as vscode from 'vscode';
import parser from 'web-tree-sitter';
import { toPosition, clampPositionToRange } from './utils';

type getNodeAtLocation = (location: vscode.Location) => parser.SyntaxNode;

export enum GoToFunctions {
    nextNonEmpty = 'nextNonEmptyLineStart',
    prevNonEmpty = 'prevNonEmptyLineStart',
}

export default class SelectionHelper {
    private static getNodeAtLocation?: getNodeAtLocation;
    private editor: vscode.TextEditor;
    private document: vscode.TextDocument;

    constructor(editor: vscode.TextEditor) {
        this.editor = editor;
        this.document = editor.document;
    }

    async init(): Promise<undefined> {
        if (SelectionHelper.getNodeAtLocation) return;

        // Activate parse-tree extension
        const parseTreeExtension =
            vscode.extensions.getExtension('pokey.parse-tree');

        if (parseTreeExtension == null) {
            throw new Error('Depends on pokey.parse-tree extension');
        }

        const { getNodeAtLocation } = (await parseTreeExtension.activate()) as {
            getNodeAtLocation: getNodeAtLocation;
        };
        console.log('Invoking pokey.parse-tree extension');
        SelectionHelper.getNodeAtLocation = getNodeAtLocation;
    }

    private getNode(
        position: vscode.Position | vscode.Range
    ): parser.SyntaxNode {
        const location = new vscode.Location(this.document.uri, position);

        if (!SelectionHelper.getNodeAtLocation) {
            throw new Error('Must init the extension first');
        }

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
            !(
                this.isEndOfLine(currentEndPosition) ||
                currentNode.nextSibling?.grammarType.includes('comment')
            ) ||
            !(
                this.isStartOfLine(currentStartPosition) ||
                currentNode.previousSibling?.grammarType.includes('comment')
            ) ||
            currentNode.childCount == 0
        ) {
            if (!currentNode.parent) break;
            currentNode = currentNode.parent;
            currentEndPosition = toPosition(currentNode.endPosition);
            currentStartPosition = toPosition(currentNode.startPosition);
        }

        return currentNode;
    }

    async getStatement(
        position: vscode.Position | vscode.Range
    ): Promise<parser.SyntaxNode> {
        return this.growNodeToStatement(await this.getNode(position));
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
