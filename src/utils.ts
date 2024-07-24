import * as vscode from 'vscode';
import parser from 'web-tree-sitter';

export function toPosition(position: parser.Point) {
    return new vscode.Position(position.row, position.column);
}

export function clampPositionToRange(
    position: vscode.Position,
    range: vscode.Range
): vscode.Position {
    if (range.contains(position)) return position;

    if (position.isBefore(range.start)) return range.start;

    return range.end;
}

export function setCursorPosition(
    editor: vscode.TextEditor,
    position: vscode.Position
): void {
    editor.selection = new vscode.Selection(position, position);
}

export function jumpToCursor(editor: vscode.TextEditor) {
    const position = editor.selection.active;
    const range = new vscode.Range(position, position);
    editor.revealRange(range, vscode.TextEditorRevealType.Default);
}

export function moveCursor(
    editor: vscode.TextEditor,
    position: vscode.Position
): void {
    setCursorPosition(editor, position);
    jumpToCursor(editor);
}

export function endPosition(node: parser.SyntaxNode): vscode.Position {
    return toPosition(node.endPosition);
}

export function startPosition(node: parser.SyntaxNode): vscode.Position {
    return toPosition(node.startPosition);
}

export function nodeRange(node: parser.SyntaxNode): vscode.Range {
    const start = node.startPosition;
    const end = node.endPosition;
    return new vscode.Range(start.row, start.column, end.row, end.column);
}

export function isComment(node: parser.SyntaxNode): boolean {
    return node.grammarType.includes('comment');
}
