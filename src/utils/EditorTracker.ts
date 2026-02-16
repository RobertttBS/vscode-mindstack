import * as vscode from 'vscode';

export class EditorTracker implements vscode.Disposable {
    private _lastActiveEditor: vscode.TextEditor | undefined;
    private _disposables: vscode.Disposable[] = [];

    constructor() {
        this._lastActiveEditor = vscode.window.activeTextEditor;
        
        // Track the Active Editor changes
        vscode.window.onDidChangeActiveTextEditor(editor => {
            if (editor) {
                this._lastActiveEditor = editor;
            }
        }, null, this._disposables);

        // Key: When an Editor is closed, check if reference needs clearing to avoid Memory Leak
        vscode.window.onDidChangeVisibleTextEditors(editors => {
            if (this._lastActiveEditor && !editors.includes(this._lastActiveEditor)) {
                this._lastActiveEditor = undefined;
            }
        }, null, this._disposables);
    }

    public get activeOrLastEditor(): vscode.TextEditor | undefined {
        return vscode.window.activeTextEditor || this._lastActiveEditor;
    }

    public dispose() {
        this._disposables.forEach(d => d.dispose());
    }
}
