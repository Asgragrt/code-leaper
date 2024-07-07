// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import SelectionHelper, { GoToFunctions } from './selectionHelper';
import { moveCursor, endPosition, startPosition, nodeRange } from './utils';
import parser from 'web-tree-sitter';

async function getStatement(
    editor: vscode.TextEditor,
    goToName: GoToFunctions,
    statementPosition: (node: parser.SyntaxNode) => vscode.Position
) {
    const helper = new SelectionHelper(editor);

    await helper.init();

    const goTo: (p: vscode.Position) => vscode.Position =
        helper[goToName].bind(helper);

    const processedPosition = helper.processPosition(
        editor.selection.active,
        goTo
    );

    // If EOL go to previous character to avoid overgrowing
    const offsetPosition = helper.isEndOfLine(processedPosition)
        ? processedPosition.translate(0, -1)
        : processedPosition;

    // Get statement
    const baseStatement = helper.getStatement(offsetPosition);

    // If the position of the statement is the same as the cursor position go to next
    let statement: parser.SyntaxNode | undefined;
    if (statementPosition(baseStatement).isEqual(processedPosition)) {
        const newPosition = goTo(processedPosition);
        statement = helper.getStatement(newPosition);
    }

    return statement ? statement : baseStatement;
}

async function getNextStatement(editor: vscode.TextEditor) {
    return await getStatement(editor, GoToFunctions.nextNonEmpty, endPosition);
}

async function getPrevStatement(editor: vscode.TextEditor) {
    return await getStatement(
        editor,
        GoToFunctions.prevNonEmpty,
        startPosition
    );
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
    // Use the console to output diagnostic information (console.log) and errors (console.error)
    // This line of code will only be executed once when your extension is activated
    console.log('Initializing "code-leaper"!');

    // The command has been defined in the package.json file
    // Now provide the implementation of the command with registerCommand
    // The commandId parameter must match the command field in package.json
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'code-leaper.jumpNextStatement',
            async () => {
                const editor = vscode.window.activeTextEditor;
                if (!editor) return;

                const statement = await getNextStatement(editor);

                moveCursor(editor, endPosition(statement));
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            'code-leaper.jumpPrevStatement',
            async () => {
                const editor = vscode.window.activeTextEditor;
                if (!editor) return;

                const statement = await getPrevStatement(editor);

                moveCursor(editor, startPosition(statement));
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            'code-leaper.selectNextStatement',
            async () => {
                const editor = vscode.window.activeTextEditor;
                if (!editor) return;

                const statement = await getNextStatement(editor);

                const range = nodeRange(statement);

                editor.selection = new vscode.Selection(range.start, range.end);
            }
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            'code-leaper.selectPrevStatement',
            async () => {
                const editor = vscode.window.activeTextEditor;
                if (!editor) return;

                const statement = await getPrevStatement(editor);

                const range = nodeRange(statement);

                editor.selection = new vscode.Selection(range.start, range.end);
            }
        )
    );
}

// This method is called when your extension is deactivated
export function deactivate() {
    // empty
}
