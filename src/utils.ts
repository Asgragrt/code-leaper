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
