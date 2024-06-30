import * as vscode from 'vscode';
import parser from 'web-tree-sitter';

export function toPosition(position: parser.Point) {
    return new vscode.Position(position.row, position.column);
}
