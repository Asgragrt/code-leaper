import * as vscode from 'vscode';
import SelectionHelper from './selectionHelper';
import { moveCursor } from './utils';

function nextStatement(editor: vscode.TextEditor) {
    const helper = new SelectionHelper(editor);

    const basePosition = editor.selection.active;

    // Go to next non-empty line (ignoring comments)
    const position = helper.isLineEmpty(basePosition)
        ? helper.nextStart(basePosition)
        : basePosition;

    let range = helper.getCurrentStatement(position);

    // Clamp to ignore characters such as \r\n
    // Go to next statement if at the end of statement
    if (position.isEqual(helper.clampToLine(range.end))) {
        range = helper.getCurrentStatement(helper.nextStart(position));
    }

    // Improve selection by getting the largest at the end (should help overall)
    range = helper.getCurrentStatement(range.end);

    return range;
}
function prevStatement(editor: vscode.TextEditor) {
    const helper = new SelectionHelper(editor);

    const basePosition = editor.selection.active;

    // Go to next non-empty line (ignoring comments)
    const position = helper.isLineEmpty(basePosition)
        ? helper.prevEnd(basePosition)
        : basePosition;

    let range = helper.getCurrentStatement(position);

    // Clamp to ignore characters such as \r\n
    // Go to next statement if at the end of statement
    if (position.isEqual(helper.clampToLine(range.start))) {
        range = helper.getCurrentStatement(helper.prevEnd(position));
    }

    // Improve selection by getting the largest at the end (should help overall)
    range = helper.getCurrentStatement(range.end);

    return range;
}

export async function activate(context: vscode.ExtensionContext) {
    console.log('Initializing "code-leaper"!');

    await SelectionHelper.init();

    context.subscriptions.push(
        vscode.commands.registerCommand('code-leaper.jumpNextStatement', () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            moveCursor(editor, nextStatement(editor).end);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('code-leaper.jumpPrevStatement', () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            moveCursor(editor, prevStatement(editor).start);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            'code-leaper.selectNextStatement',
            () => {
                const editor = vscode.window.activeTextEditor;
                if (!editor) return;

                const range = nextStatement(editor);
                editor.selection = new vscode.Selection(range.start, range.end);
                editor.revealRange(range);
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            'code-leaper.selectPrevStatement',
            () => {
                const editor = vscode.window.activeTextEditor;
                if (!editor) return;

                const range = prevStatement(editor);
                editor.selection = new vscode.Selection(range.end, range.start);
                editor.revealRange(range);
            }
        )
    );
}

export function deactivate() {
    // empty
}
