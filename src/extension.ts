import * as vscode from 'vscode';
import SelectionHelper from './selectionHelper';
import { moveCursor } from './utils';

export async function activate(context: vscode.ExtensionContext) {
    console.log('Initializing "code-leaper"!');

    await SelectionHelper.init();

    context.subscriptions.push(
        vscode.commands.registerCommand('code-leaper.jumpNextStatement', () => {
            const editor = vscode.window.activeTextEditor;
            if (!editor) return;

            const helper = new SelectionHelper(editor);

            const basePosition = editor.selection.end;

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
            // ? Maybe make it an option
            range = helper.getCurrentStatement(range.end);

            moveCursor(editor, range.end);
            //editor.selection = new vscode.Selection(range.start, range.end);
        })
    );
}

export function deactivate() {
    // empty
}
