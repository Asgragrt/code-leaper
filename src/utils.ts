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
