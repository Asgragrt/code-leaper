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
    private static _isInit = false;

    public static get isInit() {
        return this._isInit;
    }

    private editor: vscode.TextEditor;
    private document: vscode.TextDocument;
    private languageId: string;
    private readonly root: Node;

    constructor(editor: vscode.TextEditor) {
        this.editor = editor;
        this.document = editor.document;
        this.languageId = this.document.languageId;
        this.root = this.getRoot();
    }

    static async init(): Promise<undefined> {
        if (this._isInit) return;

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
        this.getNodeAtLocation = getNodeAtLocation;
        this.getTree = getTree;
        this._isInit = true;
    }

    private getRoot(): Node {
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

    private excludeNode(n: Node): boolean {
        const grammars = languages[this.languageId];
        const grammar = n.grammarType;
        const isComment = grammar.includes('comment');
        if (!grammars) return isComment;
        return isComment || grammars.some((type) => type === grammar);
    }

    private getLineNode(line: number): Node | null {
        if (line < 0 || line >= this.document.lineCount)
            throw new RangeError('line out of bounds');

        const rootNode = this.root;
        let node: Node | null = null;

        const collectNodes = function collectNodes(
            helper: SelectionHelper,
            currentNode: Node
        ) {
            const nodeOnLine =
                currentNode.startPosition.row === line ||
                currentNode.endPosition.row === line;

            if (
                nodeOnLine &&
                currentNode.parent &&
                currentNode.endPosition.column != 0 &&
                !helper.excludeNode(currentNode)
            ) {
                node = currentNode;
                return;
            }

            const childCount = currentNode.childCount;
            for (let i = 0; i < childCount; i++) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                const child = currentNode.child(i)!;
                if (
                    child.startPosition.row <= line &&
                    child.endPosition.row >= line
                ) {
                    collectNodes(helper, child);
                }

                if (node) break;
            }
        };

        collectNodes(this, rootNode);

        return node;
    }

    getCurrentStatement(
        position: vscode.Position | vscode.Range
    ): vscode.Range {
        const line =
            position instanceof vscode.Range
                ? position.end.line
                : position.line;

        let baseNode = this.getLineNode(line);
        if (!baseNode) throw new Error('No valid nodes');

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

    private getLineStartNodes(line: number): Node[] {
        if (line < 0 || line >= this.document.lineCount)
            throw new RangeError('line out of bounds');

        const rootNode = this.root;
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
        const rootNode = this.root;
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
        const rootNode = this.root;
        let node: Node | undefined;

        const collectNodes = function collectNodes(currentNode: Node) {
            if (node) return;

            // ? Maybe expand this condition
            if (
                currentNode.startPosition.row > currentLine &&
                !currentNode.grammarType.includes('comment')
            ) {
                node = currentNode;
                return;
            }

            const childCount = currentNode.childCount;
            for (let i = 0; i < childCount; i++) {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                const child = currentNode.child(i)!;
                if (child.endPosition.row > currentLine) collectNodes(child);
            }
        };

        collectNodes(rootNode);

        return node ? startPosition(node) : this.getEOL(currentLine);
    }
}
