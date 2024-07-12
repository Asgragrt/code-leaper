import * as vscode from 'vscode';
import parser from 'web-tree-sitter';
import {
    clampPositionToRange,
    // nodeRange,
    endPosition,
    startPosition,
} from './utils';

type getNodeAtLocation = (location: vscode.Location) => parser.SyntaxNode;
type getTree = (document: vscode.TextDocument) => parser.Tree;

export enum GoToFunctions {
    nextNonEmpty = 'nextNonEmptyLineStart',
    nextNonEmpty2 = 'nextStart',
    prevNonEmpty = 'prevNonEmptyLineStart',
    prevNonEmpty2 = 'prevEnd',
}

export default class SelectionHelper {
    private static getNodeAtLocation?: getNodeAtLocation;
    private static getTree?: getTree;
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

        const { getNodeAtLocation, getTree } =
            (await parseTreeExtension.activate()) as {
                getNodeAtLocation: getNodeAtLocation;
                getTree: getTree;
            };
        console.log('Invoking pokey.parse-tree extension');
        SelectionHelper.getNodeAtLocation = getNodeAtLocation;
        SelectionHelper.getTree = getTree;
    }

    private getRootNode(): parser.SyntaxNode {
        if (!SelectionHelper.getTree)
            throw new Error('Must init the extension first');
        return SelectionHelper.getTree(this.document).rootNode;
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

    // Line utils
    private getLine(line: number): vscode.TextLine {
        return this.document.lineAt(line);
    }

    private firstCharacterPosition(
        argument: vscode.Position | number
    ): vscode.Position {
        const line =
            argument instanceof vscode.Position ? argument.line : argument;
        const { firstNonWhitespaceCharacterIndex: column } = this.getLine(line);
        return new vscode.Position(line, column);
    }

    private lastCharacterPosition(
        argument: vscode.Position | number
    ): vscode.Position {
        const line =
            argument instanceof vscode.Position ? argument.line : argument;
        const { text } = this.getLine(line);
        return new vscode.Position(line, text.trimEnd().length);
    }

    private lineTextRange(argument: vscode.Position | number): vscode.Range {
        const line =
            argument instanceof vscode.Position ? argument.line : argument;
        return new vscode.Range(
            this.firstCharacterPosition(line),
            this.lastCharacterPosition(line)
        );
    }

    private clampToLine(position: vscode.Position): vscode.Position {
        return clampPositionToRange(position, this.lineTextRange(position));
    }

    private getLineNodes(line: number): parser.SyntaxNode[] {
        if (line < 0 || line >= this.document.lineCount)
            throw new RangeError('line out of bounds');

        const rootNode = this.getRootNode();
        const nodesOnLine: parser.SyntaxNode[] = [];

        const collectNodes = function collectNodes(
            currentNode: parser.SyntaxNode
        ) {
            if (
                currentNode.startPosition.row === line ||
                currentNode.endPosition.row === line
            ) {
                nodesOnLine.push(currentNode);
            }

            const childCount = currentNode.childCount;
            for (let i = 0; i < childCount; i++) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                const child = currentNode.child(i)!;
                if (
                    child.startPosition.row <= line &&
                    child.endPosition.row >= line &&
                    !child.grammarType.includes('comment')
                ) {
                    collectNodes(child);
                }
            }
        };

        collectNodes(rootNode);

        return nodesOnLine;
    }

    private getLineStartNodes(line: number): parser.SyntaxNode[] {
        if (line < 0 || line >= this.document.lineCount)
            throw new RangeError('line out of bounds');

        const rootNode = this.getRootNode();
        const nodesOnLine: parser.SyntaxNode[] = [];

        const collectNodes = function collectNodes(
            currentNode: parser.SyntaxNode
        ) {
            // ? Maybe expand this condition
            if (currentNode.startPosition.row === line) {
                nodesOnLine.push(currentNode);
            }

            const childCount = currentNode.childCount;
            for (let i = 0; i < childCount; i++) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                const child = currentNode.child(i)!;
                if (
                    child.startPosition.row <= line &&
                    child.endPosition.row >= line &&
                    !child.grammarType.includes('comment')
                ) {
                    collectNodes(child);
                }
            }
        };

        collectNodes(rootNode);

        return nodesOnLine;
    }

    // SOL => Start of line
    getSOL(argument: vscode.Position | number | parser.SyntaxNode[]) {
        let nodes: parser.SyntaxNode[];
        let line: number;
        if (argument instanceof Array) {
            nodes = argument;
            if (!nodes[0]) throw new Error('No valid nodes');
            line = nodes[0].startPosition.row;
        } else {
            line =
                argument instanceof vscode.Position ? argument.line : argument;
            nodes = this.getLineStartNodes(line);
        }

        return nodes[0]
            ? startPosition(nodes[0])
            : this.firstCharacterPosition(line);
    }

    getEOL(
        argument: vscode.Position | number | parser.SyntaxNode[]
    ): vscode.Position {
        let nodes: parser.SyntaxNode[];
        let line: number;
        if (argument instanceof Array) {
            nodes = argument;
            if (!nodes[0]) throw new Error('No valid nodes');
            line = nodes[0].startPosition.row;
        } else {
            line =
                argument instanceof vscode.Position ? argument.line : argument;
            nodes = this.getLineStartNodes(line);
        }

        const lastNode = nodes.pop();
        return lastNode
            ? endPosition(lastNode)
            : this.lastCharacterPosition(line);
    }

    isLineEmpty(argument: vscode.Position | number): boolean {
        const line =
            argument instanceof vscode.Position ? argument.line : argument;
        return this.getLine(line).isEmptyOrWhitespace
            ? true
            : this.getLineStartNodes(line).length == 0;
    }

    isSOL(position: vscode.Position): boolean {
        const sol = this.getSOL(position);
        return sol.isAfterOrEqual(position);
    }

    isEOL(position: vscode.Position): boolean {
        const eol = this.getEOL(position);
        return eol.isBeforeOrEqual(position);
    }

    prevEnd(argument: vscode.Position | number): vscode.Position {
        const currentLine =
            argument instanceof vscode.Position ? argument.line : argument;
        const rootNode = this.getRootNode();
        const nodesAfterLine: parser.SyntaxNode[] = [];

        const collectNodes = function collectNodes(
            currentNode: parser.SyntaxNode
        ) {
            if (nodesAfterLine.length > 0) return;

            // ? Maybe expand this condition
            if (
                currentNode.endPosition.row < currentLine &&
                !currentNode.grammarType.includes('comment')
            ) {
                nodesAfterLine.push(currentNode);
            }

            for (let i = currentNode.childCount - 1; i >= 0; i--) {
                const child = currentNode.child(i);
                if (!child) continue;
                collectNodes(child);
            }
        };

        collectNodes(rootNode);

        return nodesAfterLine[0]
            ? startPosition(nodesAfterLine[0])
            : this.getEOL(currentLine);
    }

    nextStart(argument: vscode.Position | number): vscode.Position {
        const currentLine =
            argument instanceof vscode.Position ? argument.line : argument;
        const rootNode = this.getRootNode();
        const nodesAfterLine: parser.SyntaxNode[] = [];

        const collectNodes = function collectNodes(
            currentNode: parser.SyntaxNode
        ) {
            if (nodesAfterLine.length > 0) return;

            // ? Maybe expand this condition
            if (
                currentNode.startPosition.row > currentLine &&
                !currentNode.grammarType.includes('comment')
            ) {
                nodesAfterLine.push(currentNode);
                return;
            }

            const childCount = currentNode.childCount;
            for (let i = 0; i < childCount; i++) {
                const child = currentNode.child(i);
                if (!child) continue;
                collectNodes(child);
            }
        };

        collectNodes(rootNode);

        return nodesAfterLine[0]
            ? startPosition(nodesAfterLine[0])
            : this.getEOL(currentLine);
    }
}
