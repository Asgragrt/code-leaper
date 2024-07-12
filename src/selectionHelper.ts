import * as vscode from 'vscode';
import parser from 'web-tree-sitter';
import {
    clampPositionToRange,
    nodeRange,
    endPosition,
    startPosition,
} from './utils';

const languages: Record<string, string[]> = {
    haskell: ['declarations'],
    python: ['block'],
} as const;

type Node = parser.SyntaxNode;

type getNodeAtLocation = (location: vscode.Location) => Node;
type getTree = (document: vscode.TextDocument) => parser.Tree;

export default class SelectionHelper {
    private static getNodeAtLocation?: getNodeAtLocation;
    private static getTree?: getTree;
    private editor: vscode.TextEditor;
    private document: vscode.TextDocument;
    private languageId: string;

    constructor(editor: vscode.TextEditor) {
        this.editor = editor;
        this.document = editor.document;
        this.languageId = this.document.languageId;
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

    private getRootNode(): Node {
        if (!SelectionHelper.getTree)
            throw new Error('Must init the extension first');
        return SelectionHelper.getTree(this.document).rootNode;
    }

    private getNode(position: vscode.Position | vscode.Range): Node {
        const location = new vscode.Location(this.document.uri, position);

        if (!SelectionHelper.getNodeAtLocation) {
            throw new Error('Must init the extension first');
        }

        return SelectionHelper.getNodeAtLocation(location);
    }

    private excludeNode(s: string): boolean {
        const grammars = languages[this.languageId];
        if (!grammars) return false;
        return grammars.some((node) => node === s);
    }

    getCurrentStatement(
        position: vscode.Position | vscode.Range
    ): vscode.Range {
        const line =
            position instanceof vscode.Range
                ? position.end.line
                : position.line;

        //console.log(line + 1);
        //console.log(this.document.languageId);

        const relatedNodes = this.getLineNodes(line).filter(
            (n) =>
                !!n.parent &&
                n.endPosition.column != 0 &&
                !this.excludeNode(n.grammarType)
        );

        //console.log(relatedNodes);

        if (!relatedNodes[0]) throw new Error('No valid nodes');

        let baseNode = relatedNodes[0];

        let baseRange = nodeRange(baseNode);

        if (
            baseNode.parent &&
            ((!this.isSOL(baseRange.start) && !this.isEOL(baseRange.end)) ||
                (!baseNode.isNamed && // ? Clean this condition
                    baseNode.endPosition.column -
                        baseNode.startPosition.column ==
                        1))
        ) {
            baseNode = baseNode.parent;
            baseRange = nodeRange(baseNode);
        }

        let sibling = baseNode.nextSibling;
        while (
            !this.isEOL(baseRange.end) &&
            !!sibling /* && !sibling.isNamed */
        ) {
            if (!sibling.grammarType.includes('comment')) {
                baseRange = baseRange.union(nodeRange(sibling));
            }
            sibling = sibling.nextSibling;
        }

        return baseRange;
    }

    // ! Line utils
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

    clampToLine(position: vscode.Position): vscode.Position {
        return clampPositionToRange(position, this.lineTextRange(position));
    }

    private getLineNodes(line: number): Node[] {
        if (line < 0 || line >= this.document.lineCount)
            throw new RangeError('line out of bounds');

        const rootNode = this.getRootNode();
        const nodesOnLine: Node[] = [];

        const collectNodes = function collectNodes(currentNode: Node) {
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

    private getLineStartNodes(line: number): Node[] {
        if (line < 0 || line >= this.document.lineCount)
            throw new RangeError('line out of bounds');

        const rootNode = this.getRootNode();
        const nodesOnLine: Node[] = [];

        const collectNodes = function collectNodes(currentNode: Node) {
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
    getSOL(argument: vscode.Position | number | Node[]) {
        let nodes: Node[];
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

    getEOL(argument: vscode.Position | number | Node[]): vscode.Position {
        let nodes: Node[];
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
        const nodesAfterLine: Node[] = [];

        const collectNodes = function collectNodes(currentNode: Node) {
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
        const nodesAfterLine: Node[] = [];

        const collectNodes = function collectNodes(currentNode: Node) {
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
